import { Assets, Texture } from 'pixi.js';
import type {
  TiledImageLayer,
  TiledLayer,
  TiledMap,
  TiledObject,
  TiledTileLayer,
  TiledTileset,
  TiledTilesetTile,
} from './TiledTypes';
import type {
  GroupLayerData,
  ImageLayerData,
  MapData,
  NestedLayer,
  TileAnimation,
  TileLayerData,
  TilesetData,
} from './MapData';
import type { BundleConfig, TilemapConfig } from '../core/assets/AssetsConfig';
import {
  decodeChunk,
  decodeTileLayer,
  flattenChunks,
} from './utils/TileLayerDataDecoder';
import { resolveAllTilesets } from './utils/ExternalTilesetLoader';
import { resolveAllTemplates, resolveTemplate } from './utils/ObjectTemplateResolver';

/**
 * 🗺️ TiledMapLoader — fetch + parse Tiled JSON → MapData.
 *
 * Flow:
 * 1. `fetch` JSON карты
 * 2. Резолв external tilesets (если `source`) — параллельно
 * 3. Маппинг tileset→bundle для walkableProperty
 * 4. Загрузка текстур тайлсетов через `Assets.load` (с учётом margin/spacing/tileoffset)
 * 5. Декодировать tile layers: CSV / base64 / zlib / gzip; zstd → warn+empty; chunks → flatten
 * 6. Распаковать gid флип-биты → `flipFlags: Uint8Array`
 * 7. Резолв templates для объектов (cache + merge)
 * 8. Собрать объекты из всех objectgroup слоёв рекурсивно (через group layers)
 * 9. Извлечь `tile.objectgroup` → `tileCollisionShapes`
 * 10. Собрать imagelayers (загрузить их текстуры) + group layers
 * 11. Построить `walkableByLocalId` по `walkableProperty` из конфига (fallback `'walkable'`)
 * 12. Построить `animationsByLocalId`
 */
export class TiledMapLoader {
  /**
   * @param config - конфиг из load-config.json (для имён слоёв, objectTypes и т.д.)
   * @param bundles - бандлы из load-config.json (для маппинга walkableProperty по tileset image)
   * @param onProgress - опциональный колбэк прогресса (0..1)
   */
  static async load(
    config: TilemapConfig,
    bundles: Record<string, BundleConfig>,
    onProgress?: (p: number) => void,
  ): Promise<MapData> {
    onProgress?.(0);

    // 1️⃣ Fetch JSON
    const res = await fetch(config.path);
    if (!res.ok) {
      throw new Error(`[TiledMapLoader] Failed to load map: ${res.status} ${config.path}`);
    }
    const json: TiledMap = await res.json();
    onProgress?.(0.1);

    // 2️⃣ Resolve external tilesets
    const tilesetsRaw = await resolveAllTilesets(config.path, json.tilesets);
    onProgress?.(0.25);

    // 3️⃣+4️⃣ Load tileset textures + build TilesetData
    const tilesets: TilesetData[] = [];
    for (let i = 0; i < tilesetsRaw.length; i++) {
      const ts = tilesetsRaw[i];
      const data = await TiledMapLoader.#loadTileset(ts, bundles, config.path);
      tilesets.push(data);
      onProgress?.(0.25 + 0.3 * ((i + 1) / tilesetsRaw.length));
    }

    // 5️⃣+6️⃣ Decode tile layers (only configured ones)
    const tileLayers: TileLayerData[] = [];
    const configuredTileLayerNames = config.tileLayers;
    const allTileLayers = TiledMapLoader.#collectTileLayers(json.layers, configuredTileLayerNames);
    for (let i = 0; i < allTileLayers.length; i++) {
      const layer = allTileLayers[i];
      const decoded = await TiledMapLoader.#decodeLayer(layer);
      tileLayers.push(decoded);
      onProgress?.(0.55 + 0.15 * ((i + 1) / allTileLayers.length));
    }
    if (tileLayers.length === 0) {
      throw new Error(
        `[TiledMapLoader] No configured tile layers (${configuredTileLayerNames.join(', ')}) ` +
          `found in ${config.path}`,
      );
    }

    // 📐 Compute global bounding box for infinite maps (chunks may have negative coords)
    let mapWidth = json.width;
    let mapHeight = json.height;
    let mapOffsetX = 0;
    let mapOffsetY = 0;
    if (json.infinite) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const layer of tileLayers) {
        if (layer.chunkOffsetX < minX) minX = layer.chunkOffsetX;
        if (layer.chunkOffsetY < minY) minY = layer.chunkOffsetY;
        if (layer.chunkOffsetX + layer.width > maxX) maxX = layer.chunkOffsetX + layer.width;
        if (layer.chunkOffsetY + layer.height > maxY) maxY = layer.chunkOffsetY + layer.height;
      }
      if (minX !== Infinity) {
        mapWidth = maxX - minX;
        mapHeight = maxY - minY;
        mapOffsetX = minX * json.tilewidth;
        mapOffsetY = minY * json.tileheight;
      }
    }

    // 7️⃣+8️⃣ Collect objects from objectgroup layers (recursive) + resolve templates
    const rawObjects = TiledMapLoader.#collectObjects(json.layers, config.objectLayers);
    const objects = await resolveAllTemplates(config.path, rawObjects);
    onProgress?.(0.75);

    // 9️⃣ Extract tileCollisionShapes (already done in #loadTileset)

    // 🔟 Collect imagelayers + group layers (resolve image paths relative to map)
    const imageLayers = await TiledMapLoader.#collectImageLayers(json.layers, config.path);
    const groupLayers = TiledMapLoader.#collectGroupLayers(json.layers);
    onProgress?.(0.9);

    onProgress?.(1);

    return {
      width: mapWidth,
      height: mapHeight,
      tileWidth: json.tilewidth,
      tileHeight: json.tileheight,
      orientation: json.orientation,
      renderorder: json.renderorder ?? 'right-down',
      backgroundcolor: json.backgroundcolor,
      infinite: json.infinite ?? false,
      offsetX: mapOffsetX,
      offsetY: mapOffsetY,
      parallaxOriginX: json.parallaxoriginx ?? 0,
      parallaxOriginY: json.parallaxoriginy ?? 0,
      tileLayers,
      imageLayers,
      groupLayers,
      objects,
      tilesets,
    };
  }

  /**
   * 🔍 Resolve gid → (tileset, localId).
   * Поддерживает multi-tileset: ищет tileset, в диапазон firstgid которого попадает gid.
   */
  static resolveGid(
    gid: number,
    tilesets: TilesetData[],
  ): { tileset: TilesetData; localId: number } | null {
    if (gid === 0) return null;
    let chosen: TilesetData | null = null;
    for (const ts of tilesets) {
      if (ts.firstgid <= gid) chosen = ts;
      else break;
    }
    if (!chosen) return null;
    return { tileset: chosen, localId: gid - chosen.firstgid };
  }

  // ── private: tileset loading ──────────────────────────────────────────

  /** 🗂️ Загрузить тайлсет: текстуру + walkable/animations/collision maps. */
  static async #loadTileset(
    ts: TiledTileset,
    bundles: Record<string, BundleConfig>,
    mapUrl: string,
  ): Promise<TilesetData> {
    if (!ts.image) {
      throw new Error(
        `[TiledMapLoader] Tileset "${ts.name ?? ts.firstgid}" has no image. ` +
          `Image collection tilesets не поддерживаются (нужен атлас).`,
      );
    }
    // 🔗 Резолвим относительный путь тайлсета от URL карты
    const imageUrl = TiledMapLoader.#resolveAssetPath(ts.image, mapUrl);
    const texture = await Assets.load<Texture>(imageUrl);
    const walkableProp = TiledMapLoader.#findWalkableProperty(ts, bundles);

    return {
      name: ts.name,
      firstgid: ts.firstgid,
      texture,
      tileWidth: ts.tilewidth,
      tileHeight: ts.tileheight,
      columns: ts.columns ?? 0,
      tileCount: ts.tilecount ?? 0,
      margin: ts.margin ?? 0,
      spacing: ts.spacing ?? 0,
      tileOffset: ts.tileoffset,
      walkableByLocalId: TiledMapLoader.#buildWalkableMap(ts, walkableProp),
      animationsByLocalId: TiledMapLoader.#buildAnimationsMap(ts),
      tileCollisionShapes: TiledMapLoader.#buildCollisionShapes(ts),
    };
  }

  /** 🔗 Резолвить относительный путь ассета (image, source, template) от URL карты. */
  static #resolveAssetPath(path: string, mapUrl: string): string {
    // Если путь уже абсолютный (http/https) или начинается с / — возвращаем как есть
    if (/^(https?:)?\/\//i.test(path) || path.startsWith('/')) return path;
    // Иначе резолвим относительно URL карты
    try {
      return new URL(path, new URL(mapUrl, location.href)).href;
    } catch {
      return path;
    }
  }

  /** 🏷️ Найти `walkableProperty` для тайлсета в конфиге бандлов (по совпадению image↔path). */
  static #findWalkableProperty(
    ts: TiledTileset,
    bundles: Record<string, BundleConfig>,
  ): string {
    if (!ts.image) return 'walkable';
    const tsImage = ts.image.replace(/\\/g, '/');

    for (const bundle of Object.values(bundles)) {
      if (bundle.type !== 'tileset') continue;
      const bundlePath = bundle.path.replace(/\\/g, '/');
      // Совпадение по полному пути или по окончанию (Tiled может писать относительные пути)
      if (bundlePath === tsImage || tsImage.endsWith(bundlePath) || bundlePath.endsWith(tsImage)) {
        return bundle.walkableProperty ?? 'walkable';
      }
    }
    return 'walkable';
  }

  /** 🚧 Построить `localId → walkable` из property тайлов. */
  static #buildWalkableMap(ts: TiledTileset, walkableProp: string): Map<number, boolean> {
    const map = new Map<number, boolean>();
    if (!ts.tiles) return map;

    for (const tile of ts.tiles) {
      const id = tile.id;
      if (!tile.properties) {
        map.set(id, true);
        continue;
      }
      const prop = tile.properties.find((p) => p.name === walkableProp);
      if (!prop) {
        map.set(id, true);
        continue;
      }
      const value = prop.value;
      map.set(id, value === false ? false : value === 'false' ? false : Boolean(value));
    }
    return map;
  }

  /** 🪃 Построить `localId → animation` из тайлсета. */
  static #buildAnimationsMap(ts: TiledTileset): Map<number, TileAnimation> {
    const map = new Map<number, TileAnimation>();
    if (!ts.tiles) return map;

    for (const tile of ts.tiles) {
      if (!tile.animation || tile.animation.length === 0) continue;
      map.set(tile.id, {
        frames: tile.animation.map((f) => ({
          localId: f.tileid,
          durationMs: f.duration,
        })),
        loop: true,
      });
    }
    return map;
  }

  /** 🚧 Построить `localId → collision shapes` из `tile.objectgroup.objects`. */
  static #buildCollisionShapes(ts: TiledTileset): Map<number, TiledObject[]> {
    const map = new Map<number, TiledObject[]>();
    if (!ts.tiles) return map;

    for (const tile of ts.tiles) {
      if (!tile.objectgroup?.objects) continue;
      map.set(tile.id, tile.objectgroup.objects);
    }
    return map;
  }

  // ── private: layer decoding ───────────────────────────────────────────

  /** 🔧 Декодировать tile-слой (CSV/base64/zlib/gzip/chunks → плоский Int32Array).
   * Возвращает TileLayerData + metadata о bounding box для infinite maps. */
  static async #decodeLayer(
    layer: TiledTileLayer,
  ): Promise<TileLayerData> {
    // Infinite map: chunks → flatten
    if (layer.chunks && layer.chunks.length > 0) {
      const decodedChunks = await Promise.all(
        layer.chunks.map(async (c) => ({
          x: c.x,
          y: c.y,
          width: c.width,
          height: c.height,
          decoded: await decodeChunk(c),
        })),
      );
      const flat = flattenChunks(decodedChunks);
      return TiledMapLoader.#makeTileLayerData(layer, flat.data, flat.flipFlags, flat.realWidth, flat.realHeight, flat.offsetX, flat.offsetY);
    }

    // Finite map: data
    const decoded = await decodeTileLayer(layer);
    return TiledMapLoader.#makeTileLayerData(layer, decoded.data, decoded.flipFlags, layer.width, layer.height, 0, 0);
  }

  /** 📦 Собрать TileLayerData из декодированных данных. */
  static #makeTileLayerData(
    layer: TiledTileLayer,
    data: Int32Array,
    flipFlags: Uint8Array,
    width: number,
    height: number,
    chunkOffsetX: number,
    chunkOffsetY: number,
  ): TileLayerData {
    return {
      name: layer.name,
      data,
      flipFlags,
      width,
      height,
      chunkOffsetX,
      chunkOffsetY,
      encoding: layer.encoding ?? 'csv',
      compression: layer.compression ?? '',
      offsetX: layer.offsetx ?? 0,
      offsety: layer.offsety ?? 0,
      opacity: layer.opacity ?? 1,
      parallaxX: layer.parallaxx ?? 1,
      parallaxY: layer.parallaxy ?? 1,
      tintColor: layer.tintcolor,
      visible: layer.visible ?? true,
    };
  }

  // ── private: layer collection (recursive) ─────────────────────────────

  /** 🗺️ Собрать все tile layers (рекурсивно через group layers), отфильтровать по именам. */
  static #collectTileLayers(layers: TiledLayer[], names: string[]): TiledTileLayer[] {
    const result: TiledTileLayer[] = [];
    for (const layer of layers) {
      if (layer.type === 'tilelayer') {
        if (names.length === 0 || names.includes(layer.name)) {
          result.push(layer);
        }
      } else if (layer.type === 'group') {
        result.push(...TiledMapLoader.#collectTileLayers(layer.layers, names));
      }
    }
    return result;
  }

  /** 👥 Собрать все объекты (рекурсивно через group layers), отфильтровать objectgroup по именам. */
  static #collectObjects(layers: TiledLayer[], names: string[]): TiledObject[] {
    const result: TiledObject[] = [];
    for (const layer of layers) {
      if (layer.type === 'objectgroup') {
        if (names.length === 0 || names.includes(layer.name)) {
          result.push(...layer.objects);
        }
      } else if (layer.type === 'group') {
        result.push(...TiledMapLoader.#collectObjects(layer.layers, names));
      }
    }
    return result;
  }

  /** 🖼️ Собрать image layers (нерекурсивно — group layers обрабатываются отдельно). */
  static async #collectImageLayers(layers: TiledLayer[], mapUrl: string): Promise<ImageLayerData[]> {
    const result: ImageLayerData[] = [];
    for (const layer of layers) {
      if (layer.type !== 'imagelayer') continue;
      result.push(await TiledMapLoader.#makeImageLayerData(layer, mapUrl));
    }
    return result;
  }

  /** 🖼️ Загрузить текстуру image-слоя + собрать runtime-структуру. */
  static async #makeImageLayerData(layer: TiledImageLayer, mapUrl: string): Promise<ImageLayerData> {
    const imageUrl = TiledMapLoader.#resolveAssetPath(layer.image, mapUrl);
    const texture = await Assets.load<Texture>(imageUrl);
    return {
      name: layer.name,
      texture,
      imagewidth: layer.imagewidth ?? texture.width,
      imageheight: layer.imageheight ?? texture.height,
      offsetX: layer.offsetx ?? 0,
      offsety: layer.offsety ?? 0,
      opacity: layer.opacity ?? 1,
      parallaxX: layer.parallaxx ?? 1,
      parallaxY: layer.parallaxy ?? 1,
      tintColor: layer.tintcolor,
      visible: layer.visible ?? true,
      repeatX: layer.repeatx ?? false,
      repeatY: layer.repeaty ?? false,
    };
  }

  /** 📁 Собрать group layers (рекурсивно — вложенные группы). */
  static #collectGroupLayers(layers: TiledLayer[]): GroupLayerData[] {
    const result: GroupLayerData[] = [];
    for (const layer of layers) {
      if (layer.type !== 'group') continue;
      result.push(TiledMapLoader.#makeGroupLayerData(layer));
    }
    return result;
  }

  /** 📁 Собрать GroupLayerData (с вложенными слоями). */
  static #makeGroupLayerData(layer: { name: string; layers: TiledLayer[]; offsetx?: number; offsety?: number; opacity?: number; parallaxx?: number; parallaxy?: number; tintcolor?: string; visible?: boolean }): GroupLayerData {
    const nested: NestedLayer[] = [];
    for (const sub of layer.layers) {
      if (sub.type === 'tilelayer') {
        // Tile layers внутри group: обрабатываем отдельно (вне configured tileLayers)
        // ⚠️ Они попадают в groupLayers, но не в tileLayers (чтобы не дублировать рендер).
        // Если нужны tile layers из group в основном рендере — добавь их имена в tileLayers конфига
        // и они поднимутся через #collectTileLayers. Здесь — skip (avoid double-render).
        continue;
      }
      if (sub.type === 'imagelayer') {
        // Image layers из group пока skip в синхронной сборке (async texture load)
        // TODO: если станет нужно — вынести в async
        continue;
      }
      if (sub.type === 'group') {
        nested.push(TiledMapLoader.#makeGroupLayerData(sub));
      }
    }
    return {
      name: layer.name,
      offsetX: layer.offsetx ?? 0,
      offsety: layer.offsety ?? 0,
      opacity: layer.opacity ?? 1,
      parallaxX: layer.parallaxx ?? 1,
      parallaxY: layer.parallaxy ?? 1,
      tintColor: layer.tintcolor,
      visible: layer.visible ?? true,
      layers: nested,
    };
  }

  // ── private: template helpers (статичные ссылки на utils) ─────────────

  /** 📋 Резолв template одного объекта (для внешнего использования). */
  static resolveObjectTemplate(mapUrl: string, obj: TiledObject): Promise<TiledObject> {
    return resolveTemplate(mapUrl, obj);
  }

  /** 🧱 Найти tile по localId (для tile collision shapes из tileset tiles). */
  static findTileDefinition(ts: TiledTileset, localId: number): TiledTilesetTile | undefined {
    return ts.tiles?.find((t) => t.id === localId);
  }
}
