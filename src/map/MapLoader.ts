import { Assets, type Texture } from 'pixi.js';
import { TiledMap, parseMapAsync, type ResolvedMap, type TiledMapData } from 'pixi-tiledmap';

/**
 * 🗺️ Результат загрузки Tiled карты.
 */
export type LoadedTiledMap = {
  /** 📦 Resolved runtime-структура карты (для `CollisionGrid`, `ObjectSpawner`). */
  mapData: ResolvedMap;
  /** 🖼️ Pixi-контейнер с распакованными слоями (для `worldContainer.addChild`). */
  container: TiledMap;
};

/**
 * 🗺️ Загрузить Tiled-карту с явным URL resolution для текстур тайлсетов.
 *
 * Зачем своя обёртка, если есть `tiledMapLoader` extension?
 * — `tiledMapLoader` использует `path.join(url-dirname, ts.image)`, что ломается,
 *   если Tiled Editor сохранил image с **leading `/`** (от корня хоста) для нашего
 *   layout: TMJ в `maps/`, tilesets в `tilesets/`. Loader склеивает
 *   `maps/tilesets/X.png` вместо `/tilesets/X.png` → 404.
 * — Здесь мы явно резолвим: leading-`/` и absolute URL → as-is, иначе → от URL карты.
 *   Это работает для любого layout, который Tiled Editor может сохранить.
 *
 * @param mapUrl - путь к `.tmj` / `.tmx` / `.json` файлу карты.
 *   ⚠️ loader extension из pixi-tiledmap использовать **не нужно** (см. URL bug выше).
 */
export async function loadTiledMap(mapUrl: string): Promise<LoadedTiledMap> {
  // 1️⃣ Fetch + parse JSON (TMX XML пока не поддерживаем — только JSON)
  const response = await fetch(mapUrl);
  if (!response.ok) {
    throw new Error(`[MapLoader] Failed to fetch: ${response.status} ${mapUrl}`);
  }
  const data = (await response.json()) as TiledMapData;

  // 2️⃣ Async parse: поддерживает gzip/zlib tile data (если встретятся)
  const mapData = await parseMapAsync(data);

  // 3️⃣ Загрузка текстур тайлсетов с правильным URL resolution
  const baseUrl = mapUrl.substring(0, mapUrl.lastIndexOf('/') + 1);
  const tilesetTextures = new Map<string, Texture>();
  await Promise.all(
    mapData.tilesets.map(async (ts) => {
      if (!ts.image) return;
      const texUrl = resolveAssetPath(ts.image, baseUrl);
      const tex = await Assets.load<Texture>(texUrl);
      // 🔑 pixi-tiledmap ищет текстуру по `ts.image` ключу — сохраняем оригинал.
      tilesetTextures.set(ts.image, tex);
    }),
  );

  // 4️⃣ Сборка Pixi-контейнера (packed mesh + parallax + image layers внутри)
  const container = new TiledMap(mapData, { tilesetTextures });
  return { mapData, container };
}

/**
 * 🔗 Резолвит путь ассета относительно URL карты.
 *  - `https://...` / `http://...` → as-is (absolute URL)
 *  - `/path/to/file` → as-is (от корня хоста, leading-slash)
 *  - `path/to/file` → `<baseUrl><path>` (относительно URL карты)
 */
function resolveAssetPath(path: string, baseUrl: string): string {
  if (/^(https?:)?\/\//i.test(path)) return path;
  if (path.startsWith('/')) return path;
  return baseUrl + path;
}
