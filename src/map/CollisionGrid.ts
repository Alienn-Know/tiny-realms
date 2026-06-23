import { World, type Entity } from '../core/ecs';
import { TileMapComponent } from '../components/TileMapComponent';

/** 📦 AABB (axis-aligned bounding box) в мировых координатах. */
export type AABB = { x: number; y: number; w: number; h: number };

/**
 * 🛡️ CollisionGrid — проверка проходимости в мире.
 *
 * Хранит в памяти:
 * - `walkableByGid` в `TileMapComponent` (для тайлов)
 * - список solid AABB (для entity-объектов, зарегистрированных через `addSolidBox`)
 *
 * Query API:
 * - `isPositionWalkable(x, y)` — точка проходима? (тайл + worldBounds)
 * - `isBoxWalkable(x, y, w, h)` — AABB проходим? (5 точек corners+center + entity boxes)
 *
 * Производительность v1: O(1) для точки, O(1) для AABB-проверки (5 точек + linear scan
 * по entity boxes). Spatial hash добавим когда entity boxes > 100.
 */
export class CollisionGrid {
  #world: World;
  #tilemapEntity: Entity;
  #entityBoxes: Map<Entity, AABB> = new Map();
  #worldBounds: AABB;

  constructor(world: World, tilemapEntity: Entity, originX: number, originY: number, worldWidth: number, worldHeight: number) {
    this.#world = world;
    this.#tilemapEntity = tilemapEntity;
    this.#worldBounds = { x: originX, y: originY, w: worldWidth, h: worldHeight };
  }

  /** ✅ Точка (px) проходима? (worldBounds + тайл) */
  isPositionWalkable(x: number, y: number): boolean {
    if (!this.#inWorldBoundsPoint(x, y)) return false;
    const tm = this.#getTileMap();
    return tm.isWalkableAt(x, y);
  }

  /** ✅ AABB проходим? (worldBounds + 5 точек тайла + entity boxes) */
  isBoxWalkable(x: number, y: number, w: number, h: number): boolean {
    if (!this.#inWorldBoundsBox(x, y, w, h)) return false;
    const tm = this.#getTileMap();
    // Проверяем 4 угла + центр (AABB-середины обычно достаточно)
    if (!tm.isWalkableAt(x, y)) return false;
    if (!tm.isWalkableAt(x + w, y)) return false;
    if (!tm.isWalkableAt(x, y + h)) return false;
    if (!tm.isWalkableAt(x + w, y + h)) return false;
    if (!tm.isWalkableAt(x + w / 2, y + h / 2)) return false;
    // Entity boxes (linear scan)
    const myBox: AABB = { x, y, w, h };
    for (const [entity, box] of this.#entityBoxes) {
      if (entity === this.#tilemapEntity) continue;
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

  #getTileMap(): TileMapComponent {
    const tm = this.#world.getComponent(this.#tilemapEntity, TileMapComponent);
    if (!tm) throw new Error('[CollisionGrid] TileMapComponent not found on tilemapEntity');
    return tm;
  }

  #inWorldBoundsPoint(x: number, y: number): boolean {
    return x >= this.#worldBounds.x && y >= this.#worldBounds.y && x < this.#worldBounds.x + this.#worldBounds.w && y < this.#worldBounds.y + this.#worldBounds.h;
  }

  #inWorldBoundsBox(x: number, y: number, w: number, h: number): boolean {
    return (
      x >= this.#worldBounds.x && y >= this.#worldBounds.y && x + w <= this.#worldBounds.x + this.#worldBounds.w && y + h <= this.#worldBounds.y + this.#worldBounds.h
    );
  }

  #aabbIntersects(a: AABB, b: AABB): boolean {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
}
