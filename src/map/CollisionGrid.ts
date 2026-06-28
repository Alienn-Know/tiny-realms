import type { ResolvedMap, ResolvedTileLayer } from 'pixi-tiledmap';
import type { Entity } from '../core/ecs';
import { computeWorldBounds } from './worldBounds';
import { buildWalkableByGid } from './WalkableResolver';

/** 📦 AABB (axis-aligned bounding box) в мировых координатах. */
export type AABB = { x: number; y: number; w: number; h: number };

/**
 * 🛡️ CollisionGrid — проверка проходимости в мире.
 *
 * Работает поверх `ResolvedMap` из pixi-tiledmap. Хранит:
 * - `walkableByGid` — lookup gid → walkable (из `WalkableResolver`).
 * - Список `entityBoxes` — AABB solid-объектов (entity), зарегистрированных через `addSolidBox`.
 *
 * Проходимость тайла:
 * - Точка проходима, если ВСЕ тайл-слои в этой точке проходимы (если хотя бы один
 *   слой блокирует — точка заблокирована: поведение Tiled — walls поверх ground).
 * - gid берётся без флагов трансформации (флаги не влияют на проходимость).
 *
 * Мировые bounds:
 * - finite: `0..width*tilewidth, 0..height*tileheight`.
 * - infinite: bbox из chunks (`chunks[i].x/y/width/height` в тайлах).
 *
 * Производительность v1: O(L) на точку (L = кол-во tile layers), O(1) для AABB
 * по 5 точкам + linear scan entity boxes. Spatial hash добавим при boxes > 100.
 */
export class CollisionGrid {
  /** 🚶 gid (без flip-флагов) → walkable. */
  #walkableByGid: Map<number, boolean>;

  /** 📐 Мировой bbox карты (для ранних выходов). */
  #worldBounds: AABB;

  /** 📚 Кеш tile-слоёв (только top-level, не из group — group не используем). */
  #tileLayers: ResolvedTileLayer[];

  /** 📏 Размер тайла (px). */
  #tileWidth: number;

  /** 📏 Размер тайла (px). */
  #tileHeight: number;

  /** 🧊 Список твёрдых AABB (entity). */
  #entityBoxes: Map<Entity, AABB> = new Map();

  /**
   * @param map - resolved map (после `parseMap` / `parseMapAsync`)
   * @param propertyName - имя Tiled-property для walkable (default `'walkable'`)
   */
  constructor(map: ResolvedMap, propertyName = 'walkable') {
    this.#walkableByGid = buildWalkableByGid(map, propertyName);
    this.#tileWidth = map.tilewidth;
    this.#tileHeight = map.tileheight;
    const bounds = computeWorldBounds(map);
    this.#worldBounds = {
      x: bounds.minX,
      y: bounds.minY,
      w: bounds.maxX - bounds.minX,
      h: bounds.maxY - bounds.minY,
    };
    this.#tileLayers = collectTileLayers(map);
  }

  /** ✅ Точка (px) проходима? (worldBounds + все тайл-слои) */
  isPositionWalkable(x: number, y: number): boolean {
    if (!this.#inWorldBoundsPoint(x, y)) return false;
    if (!this.#inWorldBoundsPoint(x + 0.001, y + 0.001)) {
      // граница inclusive-lower / exclusive-upper
      return false;
    }
    const tx = Math.floor(x / this.#tileWidth);
    const ty = Math.floor(y / this.#tileHeight);
    return this.#isTileWalkable(tx, ty);
  }

  /** ✅ AABB проходим? (worldBounds + 5 точек тайла + entity boxes) */
  isBoxWalkable(x: number, y: number, w: number, h: number): boolean {
    if (!this.#inWorldBoundsBox(x, y, w, h)) return false;

    if (
      !this.#isTileWalkable(Math.floor(x / this.#tileWidth), Math.floor(y / this.#tileHeight)) ||
      !this.#isTileWalkable(Math.floor((x + w) / this.#tileWidth), Math.floor(y / this.#tileHeight)) ||
      !this.#isTileWalkable(Math.floor(x / this.#tileWidth), Math.floor((y + h) / this.#tileHeight)) ||
      !this.#isTileWalkable(Math.floor((x + w) / this.#tileWidth), Math.floor((y + h) / this.#tileHeight)) ||
      !this.#isTileWalkable(Math.floor((x + w / 2) / this.#tileWidth), Math.floor((y + h / 2) / this.#tileHeight))
    ) {
      return false;
    }

    const myBox: AABB = { x, y, w, h };
    for (const box of this.#entityBoxes.values()) {
      if (this.#aabbIntersects(myBox, box)) return false;
    }
    return true;
  }

  /** ➕ Зарегистрировать твёрдый AABB (entity). */
  addSolidBox(entity: Entity, x: number, y: number, w: number, h: number): void {
    this.#entityBoxes.set(entity, { x, y, w, h });
  }

  /** ➖ Удалить твёрдый AABB. */
  removeSolidBox(entity: Entity): void {
    this.#entityBoxes.delete(entity);
  }

  /** 📦 Получить все зарегистрированные solid boxes (для отладки). */
  getSolidBoxes(): IterableIterator<[Entity, AABB]> {
    return this.#entityBoxes.entries();
  }

  // ── private ─────────────────────────────────────────────────────────

  #isTileWalkable(tx: number, ty: number): boolean {
    // top-most non-empty gid приоритетен, но непроходимый тайл в ЛЮБОМ слое блокирует.
    for (let i = this.#tileLayers.length - 1; i >= 0; i--) {
      const layer = this.#tileLayers[i];
      if (!layer.visible) continue;

      const lt = pickLayerTile(layer, tx, ty);
      if (lt === null) continue;

      const gid = lt.gid;
      if (gid === 0) continue;
      return this.#walkableByGid.get(gid) ?? true;
    }
    return true; // все слои пусты — проходимо
  }

  #inWorldBoundsPoint(x: number, y: number): boolean {
    const b = this.#worldBounds;
    return x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h;
  }

  #inWorldBoundsBox(x: number, y: number, w: number, h: number): boolean {
    const b = this.#worldBounds;
    return x >= b.x && y >= b.y && x + w <= b.x + b.w && y + h <= b.y + b.h;
  }

  #aabbIntersects(a: AABB, b: AABB): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
}

// ── helpers ──────────────────────────────────────────────────────────

/** 📚 Собрать все tile-слои (top-level, без recursion в group — group не используем). */
function collectTileLayers(map: ResolvedMap): ResolvedTileLayer[] {
  const out: ResolvedTileLayer[] = [];
  for (const layer of map.layers) {
    if (layer.type === 'tilelayer') out.push(layer);
  }
  return out;
}

/**
 * 📌 Получить тайл из слоя в глобальных тайловых координатах.
 * Возвращает `null` если координата вне слоя (включая chunks для infinite).
 */
function pickLayerTile(
  layer: ResolvedTileLayer,
  tx: number,
  ty: number,
): { gid: number; localId: number; tilesetIndex: number } | null {
  if (!layer.infinite) {
    if (tx < 0 || ty < 0 || tx >= layer.width || ty >= layer.height) return null;
    const idx = ty * layer.width + tx;
    return layer.tiles[idx] ?? null;
  }

  if (!layer.chunks) {
    if (tx < 0 || ty < 0 || tx >= layer.width || ty >= layer.height) return null;
    const idx = ty * layer.width + tx;
    return layer.tiles[idx] ?? null;
  }

  for (const c of layer.chunks) {
    if (tx >= c.x && tx < c.x + c.width && ty >= c.y && ty < c.y + c.height) {
      const lx = tx - c.x;
      const ly = ty - c.y;
      const idx = ly * c.width + lx;
      return c.tiles[idx] ?? null;
    }
  }
  return null;
}
