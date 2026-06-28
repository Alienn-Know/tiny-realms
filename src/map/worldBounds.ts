import type { ResolvedMap, ResolvedTileLayer } from 'pixi-tiledmap';

/**
 * 🗺️ Границы мира в пикселях (мировые координаты).
 *
 * Для finite-карт: `[0, 0] - [width, height]`.
 * Для infinite-карт: bbox по chunks в **абсолютных** координатах
 * (не сдвинутый к нулю — иначе рассинхрон с координатами сущностей
 * из Tiled, которые ObjectSpawner берёт as-is).
 */
export type WorldBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/**
 * 🗺️ Вычислить границы мира из `ResolvedMap` (после `parseMapAsync`).
 *
 * @param mapData - resolved Tiled map
 * @returns границы в мировых пикселях
 */
export function computeWorldBounds(mapData: ResolvedMap): WorldBounds {
  let minX = 0;
  let minY = 0;
  let maxX = mapData.width * mapData.tilewidth;
  let maxY = mapData.height * mapData.tileheight;

  if (mapData.infinite) {
    let bboxMinX = Infinity, bboxMinY = Infinity;
    let bboxMaxX = -Infinity, bboxMaxY = -Infinity;
    for (const layer of collectTileLayers(mapData)) {
      if (layer.chunks) {
        for (const c of layer.chunks) {
          const lx = c.x * mapData.tilewidth;
          const ly = c.y * mapData.tileheight;
          const rx = (c.x + c.width) * mapData.tilewidth;
          const ry = (c.y + c.height) * mapData.tileheight;
          if (lx < bboxMinX) bboxMinX = lx;
          if (ly < bboxMinY) bboxMinY = ly;
          if (rx > bboxMaxX) bboxMaxX = rx;
          if (ry > bboxMaxY) bboxMaxY = ry;
        }
      } else {
        const lx = 0;
        const ly = 0;
        const rx = layer.width * mapData.tilewidth;
        const ry = layer.height * mapData.tileheight;
        if (lx < bboxMinX) bboxMinX = lx;
        if (ly < bboxMinY) bboxMinY = ly;
        if (rx > bboxMaxX) bboxMaxX = rx;
        if (ry > bboxMaxY) bboxMaxY = ry;
      }
    }
    if (bboxMinX !== Infinity) {
      minX = bboxMinX;
      minY = bboxMinY;
      maxX = bboxMaxX;
      maxY = bboxMaxY;
    }
  }

  return { minX, minY, maxX, maxY };
}

/** 📚 Собрать все tile-слои (top-level). */
function collectTileLayers(map: ResolvedMap): ResolvedTileLayer[] {
  const out: ResolvedTileLayer[] = [];
  for (const layer of map.layers) {
    if (layer.type === 'tilelayer') out.push(layer);
  }
  return out;
}
