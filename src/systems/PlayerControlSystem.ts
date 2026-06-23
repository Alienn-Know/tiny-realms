import { InputComponent, VelocityComponent, TransformComponent, SizeComponent } from '../components';
import { System, World } from '../core/ecs';
import { KeyBindings } from '../core/input/KeyBindings';
import { CollisionGrid } from '../map/CollisionGrid';

/**
 * 🕹️ Превращает `InputComponent` в `VelocityComponent` и применяет движение
 * с **collision check** (sliding).
 *
 * Логика:
 * - Читает нажатия через {@link KeyBindings} (раскладка无关 — `event.code`).
 * - Считает вектор направления, нормализует, умножает на `speed`.
 * - Двигает по X и Y **раздельно**, проверяя коллизию (`CollisionGrid.isBoxWalkable`).
 *   Если блок — откатывает соответствующую ось (sliding по стенам).
 *
 * Применяется к entity с **InputComponent + VelocityComponent + TransformComponent + SizeComponent**.
 */
export class PlayerControlSystem extends System {
  /** 🏃 Скорость в пикселях в секунду. */
  private speed: number;

  /** 🪢 Биндинги. */
  private bindings: KeyBindings;

  /** 🛡️ Collision grid (in-memory). */
  private collision: CollisionGrid;

  /**
   * @param speed - px/с
   * @param collision - `CollisionGrid` (обязателен)
   * @param bindings - опционально (default: WASD + стрелки)
   */
  constructor(speed: number, collision: CollisionGrid, bindings?: KeyBindings) {
    super();
    this.speed = speed;
    this.collision = collision;
    this.bindings = bindings ?? new KeyBindings();
  }

  update(world: World, dt: number): void {
    for (const entity of world.getEntitiesWith(InputComponent, VelocityComponent, TransformComponent, SizeComponent)) {
      const input = world.getComponent(entity, InputComponent)!;
      const velocity = world.getComponent(entity, VelocityComponent)!;
      const transform = world.getComponent(entity, TransformComponent)!;
      const size = world.getComponent(entity, SizeComponent)!;

      // 1️⃣ Compute desired velocity from input
      let dx = 0;
      let dy = 0;
      if (this.bindings.isActive(input.keys, 'move-up')) dy -= 1;
      if (this.bindings.isActive(input.keys, 'move-down')) dy += 1;
      if (this.bindings.isActive(input.keys, 'move-left')) dx -= 1;
      if (this.bindings.isActive(input.keys, 'move-right')) dx += 1;

      const len = Math.hypot(dx, dy);
      if (len > 0) {
        velocity.vx = (dx / len) * this.speed;
        velocity.vy = (dy / len) * this.speed;
      } else {
        velocity.vx = 0;
        velocity.vy = 0;
        continue; // нет движения → нечего чекать
      }

      // 2️⃣ Sliding collision: проверяем X и Y отдельно
      const w = size.halfWidth * 2;
      const h = size.halfHeight * 2;
      const newX = transform.x + velocity.vx * dt;
      if (this.collision.isBoxWalkable(newX - size.halfWidth, transform.y - size.halfHeight, w, h)) {
        transform.x = newX;
      } else {
        velocity.vx = 0; // упёрся в стену по X
      }

      const newY = transform.y + velocity.vy * dt;
      if (this.collision.isBoxWalkable(transform.x - size.halfWidth, newY - size.halfHeight, w, h)) {
        transform.y = newY;
      } else {
        velocity.vy = 0; // упёрся в стену по Y
      }
    }
  }
}
