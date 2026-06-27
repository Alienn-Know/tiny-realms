import type { ResolvedMap, ResolvedTileset } from 'pixi-tiledmap';

/**
 * 🚶 WalkableResolver — строит lookup `gid → walkable` из `ResolvedMap`.
 *
 * Проходит по всем тайлсетам, читает per-tile property с заданным именем
 * (по умолчанию `walkable`). Если property отсутствует у тайла — он считается
 * проходимым (`true`) — это совпадает с поведением Tiled editor.
 *
 * Зачем свой resolver?
 * - pixi-tiledmap не предоставляет API для collision queries из коробки.
 * - Нам нужен O(1) lookup по `gid` (без флагов трансформации).
 *
 * @param map - resolved map (после `parseMap` / `parseMapAsync`)
 * @param propertyName - имя property для walkable (default `'walkable'`)
 * @returns Map: `gid (без флагов) → walkable`
 */
export function buildWalkableByGid(
  map: ResolvedMap,
  propertyName = 'walkable',
): Map<number, boolean> {
  const result = new Map<number, boolean>();

  for (let tsIndex = 0; tsIndex < map.tilesets.length; tsIndex++) {
    const ts = map.tilesets[tsIndex];
    const firstgid = ts.firstgid;
    appendTilesetWalkable(result, ts, firstgid, propertyName);
  }

  return result;
}

/**
 * 🚶 Дополнить walkable-карту данными из одного тайлсета.
 * Используется для late-binding тайлсетов, добавленных после построения карты.
 */
function appendTilesetWalkable(
  out: Map<number, boolean>,
  ts: ResolvedTileset,
  firstgid: number,
  propertyName: string,
): void {
  for (const [localId, tile] of ts.tiles) {
    const gid = firstgid + localId;
    const prop = tile.properties?.find((p) => p.name === propertyName);
    let walkable: boolean;
    if (!prop) {
      walkable = true;
    } else {
      const v = prop.value;
      walkable = v === false || v === 'false' ? false : Boolean(v);
    }
    out.set(gid, walkable);
  }
}
