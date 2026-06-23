import { Container, Sprite, Rectangle, Texture } from 'pixi.js';
import { System, World } from '../core/ecs';
import { TileMapComponent } from '../components/TileMapComponent';
import { TiledMapLoader } from '../map/TiledMapLoader';
import type { TilesetData } from '../map/MapData';
import type { TiledRenderOrder } from '../map/TiledTypes';

/**
 * 🎨 Рендер `TileMapComponent` — sprite-based тайлы с текстурой из тайлсетов.
 *
 * Multi-layer: создаёт `Container` на каждый tile-слой, z-порядок = индекс в `layers`.
 * Flipping: hFlip/vFlip/diagRot из `flipFlags` применяются к спрайту.
 * Margin/spacing: учитываются при вычислении UV-прямоугольника тайла.
 * TileOffset: сдвигает визуал тайла (не collision).
 * Renderorder: 4 варианта (right-down, right-up, left-down, left-up).
 * Infinite maps: per-layer width/height + chunkOffset для позиционирования.
 */
export class TileMapRenderSystem extends System {
  /** 🗂️ Кеш `texture-клон` для каждого тайла: клонируем базовую текстуру с rectangle-фреймом. */
  #tileTextures: WeakMap<TileMapComponent, Map<string, Texture>> = new WeakMap();

  update(world: World, _dt: number): void {
    for (const entity of world.getEntitiesWith(TileMapComponent)) {
      const comp = world.getComponent(entity, TileMapComponent)!;
      if (!comp.dirty) continue;
      this.#renderTiles(comp);
      comp.dirty = false;
    }
  }

  #renderTiles(comp: TileMapComponent): void {
    // Очищаем корневой контейнер
    while (comp.container.children.length > 0) {
      const child = comp.container.children[0];
      comp.container.removeChild(child);
      child.destroy({ children: true });
    }

    let textures = this.#tileTextures.get(comp);
    if (!textures) {
      textures = new Map();
      this.#tileTextures.set(comp, textures);
    }

    // Рендерим каждый слой в отдельный Container (z-порядок = индекс)
    for (let li = 0; li < comp.layers.length; li++) {
      const layer = comp.layers[li];
      if (!layer.visible) continue;
      const layerContainer = new Container();
      // Смещение слоя: layer offset (px) + chunkOffset (в тайлах → px)
      layerContainer.x = layer.offsetX + layer.chunkOffsetX * comp.tileWidth;
      layerContainer.y = layer.offsety + layer.chunkOffsetY * comp.tileHeight;
      layerContainer.alpha = layer.opacity;

      this.#renderLayer(comp, layer, li, textures, layerContainer);

      comp.container.addChild(layerContainer);
    }
  }

  /** 🎨 Рендер одного слоя с учётом renderorder и per-layer dimensions. */
  #renderLayer(
    comp: TileMapComponent,
    layer: { data: Int32Array; width: number; height: number; chunkOffsetX: number; chunkOffsetY: number },
    layerIndex: number,
    textures: Map<string, Texture>,
    layerContainer: Container,
  ): void {
    const renderorder: TiledRenderOrder = 'right-down'; // TODO: хранить в comp, пока дефолт

    for (let ty = 0; ty < layer.height; ty++) {
      for (let tx = 0; tx < layer.width; tx++) {
        const { srcX, srcY, dstX, dstY } = this.#mapCoords(tx, ty, layer.width, layer.height, renderorder);
        const srcIdx = srcY * layer.width + srcX;
        const gid = layer.data[srcIdx];
        if (gid === 0) continue;

        // Используем layer-local индекс (srcIdx) для анимации и flip-флагов
        const localId = comp.getCurrentLocalId(srcIdx, layerIndex) ?? 0;
        const resolved = TiledMapLoader.resolveGid(gid, comp.tilesets);
        if (!resolved) continue;

        // Кешируем текстуру по ключу (tileset.firstgid + localId)
        const textureKey = `${resolved.tileset.firstgid}:${localId}`;
        let tex = textures.get(textureKey);
        if (!tex) {
          tex = this.#createTileTexture(resolved.tileset, localId);
          textures.set(textureKey, tex);
        }

        const sprite = new Sprite(tex);
        const tileOffset = resolved.tileset.tileOffset;
        sprite.x = dstX * comp.tileWidth - (tileOffset?.x ?? 0);
        sprite.y = dstY * comp.tileHeight - (tileOffset?.y ?? 0);

        // Применяем flipping (по layer-local индексу)
        const flip = comp.getFlipFlags(layerIndex, srcIdx);
        this.#applyFlip(sprite, flip, comp.tileWidth, comp.tileHeight);

        layerContainer.addChild(sprite);
      }
    }
  }

  /** 🗺️ Преобразование координат в зависимости от renderorder. */
  #mapCoords(
    tx: number,
    ty: number,
    mapWidth: number,
    mapHeight: number,
    renderorder: TiledRenderOrder,
  ): { srcX: number; srcY: number; dstX: number; dstY: number } {
    switch (renderorder) {
      case 'right-down':
        return { srcX: tx, srcY: ty, dstX: tx, dstY: ty };
      case 'right-up':
        return { srcX: tx, srcY: ty, dstX: tx, dstY: mapHeight - 1 - ty };
      case 'left-down':
        return { srcX: tx, srcY: ty, dstX: mapWidth - 1 - tx, dstY: ty };
      case 'left-up':
        return { srcX: tx, srcY: ty, dstX: mapWidth - 1 - tx, dstY: mapHeight - 1 - ty };
    }
  }

  /** 🔄 Применить flip-флаги к спрайту. */
  #applyFlip(
    sprite: Sprite,
    flip: { hFlip: boolean; vFlip: boolean; diagRot: boolean },
    tileWidth: number,
    tileHeight: number,
  ): void {
    if (flip.hFlip) {
      sprite.scale.x = -1;
      sprite.x += tileWidth;
    }
    if (flip.vFlip) {
      sprite.scale.y = -1;
      sprite.y += tileHeight;
    }
    if (flip.diagRot) {
      // Diagonal = rotate 90° anti-clockwise + flip
      sprite.rotation = -Math.PI / 2;
      sprite.x += tileWidth;
    }
  }

  /** 🖼️ Создать клон текстуры с rectangle-фреймом для конкретного тайла (с margin/spacing). */
  #createTileTexture(ts: TilesetData, localId: number): Texture {
    const col = localId % ts.columns;
    const row = Math.floor(localId / ts.columns);
    const frame = new Rectangle(
      ts.margin + col * (ts.tileWidth + ts.spacing),
      ts.margin + row * (ts.tileHeight + ts.spacing),
      ts.tileWidth,
      ts.tileHeight,
    );
    return new Texture({ source: ts.texture.source, frame });
  }
}
