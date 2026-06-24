import { InputComponent, VelocityComponent, TransformComponent, SizeComponent, AnimationComponent, AnimationDefinitionComponent, type Facing } from '../components';
import { System, World } from '../core/ecs';
import { KeyBindings } from '../core/input/KeyBindings';
import { CollisionGrid } from '../map/CollisionGrid';

/**
 * 🕹️ Превращает `InputComponent` в `VelocityComponent` и применяет движение
 * с **collision check** (sliding).
 *
 * Логика:
 * - Читает нажатия через {@link KeyBindings} (раскладка无关 — `event.code`).
 * - Считает вектор направления, нормализует, умножает на `speed × runMultiplier`.
 * - Двигает по X и Y **раздельно**, проверяя коллизию (`CollisionGrid.isBoxWalkable`).
 *   Если блок — откатывает соответствующую ось (sliding по стенам).
 * - Триггерит `attack` через `AnimationComponent.triggerAttack()` если entity
 *   имеет `Animation` + `AnimationDefinition`. **Не блокирует** движение:
 *   attack-анимация играет поверх walk/idle.
 *
 * Применяется к entity с **InputComponent + VelocityComponent + TransformComponent + SizeComponent**.
 * Опционально поддерживает `AnimationComponent + AnimationDefinitionComponent`.
 */
export class PlayerControlSystem extends System {
  /** 🏃 Скорость в пикселях в секунду (без спринта). */
  private speed: number;

  /** ⚡ Множитель скорости при спринте (Shift зажат). */
  private runMultiplier: number;

  /** 🪢 Биндинги. */
  private bindings: KeyBindings;

  /** 🛡️ Collision grid (in-memory). */
  private collision: CollisionGrid;

  /**
   * @param speed - px/с (без спринта)
   * @param collision - `CollisionGrid` (обязателен)
   * @param bindings - опционально (default: WASD + стрелки + Space/Shift)
   * @param runMultiplier - множитель скорости при Shift (default 1.5)
   */
  /** 🗺️ World bounds (min/max corners в мировых координатах). Опционально. */
  private worldMinX = -Infinity;
  private worldMinY = -Infinity;
  private worldMaxX = Infinity;
  private worldMaxY = Infinity;

  constructor(speed: number, collision: CollisionGrid, bindings?: KeyBindings, runMultiplier = 1.5) {
    super();
    this.speed = speed;
    this.collision = collision;
    this.bindings = bindings ?? new KeyBindings();
    this.runMultiplier = runMultiplier;
  }

  /**
   * 🗺️ Установить границы мира для clamp'а player'а.
   * @param minX - левый край мира
   * @param minY - верхний край мира
   * @param maxX - правый край мира
   * @param maxY - нижний край мира
   */
  setWorldBounds(minX: number, minY: number, maxX: number, maxY: number): void {
    this.worldMinX = minX;
    this.worldMinY = minY;
    this.worldMaxX = maxX;
    this.worldMaxY = maxY;
  }

  update(world: World, dt: number): void {
    for (const entity of world.getEntitiesWith(InputComponent, VelocityComponent, TransformComponent, SizeComponent)) {
      const input = world.getComponent(entity, InputComponent)!;
      const velocity = world.getComponent(entity, VelocityComponent)!;
      const transform = world.getComponent(entity, TransformComponent)!;
      const size = world.getComponent(entity, SizeComponent)!;
      const anim = world.getComponent(entity, AnimationComponent);
      const animDef = world.getComponent(entity, AnimationDefinitionComponent);

      // 1️⃣ Attack trigger (без блокировки движения)
      if (anim && animDef && this.bindings.isActive(input.keys, 'attack') && !anim.attacking) {
        anim.triggerAttack(animDef);
      }

      // 2️⃣ Compute desired velocity from input
      let dx = 0;
      let dy = 0;
      if (this.bindings.isActive(input.keys, 'move-up')) dy -= 1;
      if (this.bindings.isActive(input.keys, 'move-down')) dy += 1;
      if (this.bindings.isActive(input.keys, 'move-left')) dx -= 1;
      if (this.bindings.isActive(input.keys, 'move-right')) dx += 1;

      const len = Math.hypot(dx, dy);
      const sprint = this.bindings.isActive(input.keys, 'sprint') ? this.runMultiplier : 1;
      const effectiveSpeed = this.speed * sprint;

      // 2.5️⃣ Update facing по нажатым клавишам (надёжнее чем velocity direction).
      //    Приоритет для диагоналей: вертикаль (вверх/вниз) > горизонталь.
      //    Если ничего не нажато — facing остаётся прежним (idle сохраняет последнее направление).
      if (anim && len > 0) {
        let newFacing: Facing | null = null;
        if (dy < 0) newFacing = 'back';
        else if (dy > 0) newFacing = 'front';
        else if (dx < 0) newFacing = 'left';
        else if (dx > 0) newFacing = 'right';
        if (newFacing !== null && newFacing !== anim.facing) {
          anim.facing = newFacing;
          // Перезагрузить кадры сразу — без ожидания AnimationSystem
          anim.refreshFrames(animDef!);
        }
      }

      if (len > 0) {
        velocity.vx = (dx / len) * effectiveSpeed;
        velocity.vy = (dy / len) * effectiveSpeed;
      } else {
        velocity.vx = 0;
        velocity.vy = 0;
        // НЕ continue — collision всё равно нужен для corner case
      }

      // 3️⃣ Sliding collision: проверяем X и Y отдельно
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

      // 4️⃣ World bounds clamp (не даём игроку выйти за границы карты).
      //    AABB учитывает половины ширины/высоты, чтобы player не "выглядывал"
      //    за край ни на пиксель.
      const minBoundX = this.worldMinX + size.halfWidth;
      const maxBoundX = this.worldMaxX - size.halfWidth;
      const minBoundY = this.worldMinY + size.halfHeight;
      const maxBoundY = this.worldMaxY - size.halfHeight;
      if (transform.x < minBoundX) { transform.x = minBoundX; velocity.vx = 0; }
      else if (transform.x > maxBoundX) { transform.x = maxBoundX; velocity.vx = 0; }
      if (transform.y < minBoundY) { transform.y = minBoundY; velocity.vy = 0; }
      else if (transform.y > maxBoundY) { transform.y = maxBoundY; velocity.vy = 0; }
    }
  }
}
