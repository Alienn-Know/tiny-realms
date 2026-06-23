import { InputComponent, VelocityComponent, AnimationComponent, AnimationDefinitionComponent, type Facing } from '../components';
import { System, World } from '../core/ecs';
import { KeyBindings } from '../core/input/KeyBindings';

/**
 * 🧭 Определяет направление entity по вектору скорости.
 *
 * Приоритет для 4-direction top-down:
 * - `vy < 0` → `'back'` (движение от камеры, вверх по экрану)
 * - `vy > 0` → `'front'` (движение к камере, вниз по экрану)
 * - `vx < 0` → `'left'`
 * - `vx > 0` → `'right'`
 *
 * Диагональные направления (vx≠0 и vy≠0) разрешаются по приоритету Y > X.
 * @returns направление или `null`, если скорость нулевая
 */
function facingFromVelocity(vx: number, vy: number): Facing | null {
  if (vy < 0) return 'back';
  if (vy > 0) return 'front';
  if (vx < 0) return 'left';
  if (vx > 0) return 'right';
  return null;
}

/**
 * 🎬 Управляет анимациями сущностей.
 *
 * Каждый кадр:
 * 1. Снимает `attackLockTime` (если идёт attack).
 * 2. Определяет желаемый state по `Velocity` + `Input` (если не attack):
 *    - `velocity == 0` → `'idle'`
 *    - `velocity > 0` + `Shift` → `'run'`
 *    - `velocity > 0` (без Shift) → `'walk'`
 * 3. Обновляет `facing` по направлению движения.
 * 4. Продвигает кадры через `AnimationComponent.update`.
 *
 * Применяется к entity с `AnimationComponent + AnimationDefinitionComponent
 * + VelocityComponent + InputComponent`.
 */
export class AnimationSystem extends System {
  /** 🪢 Биндинги (для проверки Shift/sprint). */
  private bindings: KeyBindings;

  constructor(bindings?: KeyBindings) {
    super();
    this.bindings = bindings ?? new KeyBindings();
  }

  update(world: World, dt: number): void {
    for (const entity of world.getEntitiesWith(
      AnimationComponent,
      AnimationDefinitionComponent,
      VelocityComponent,
      InputComponent,
    )) {
      const anim = world.getComponent(entity, AnimationComponent)!;
      const def = world.getComponent(entity, AnimationDefinitionComponent)!;
      const vel = world.getComponent(entity, VelocityComponent)!;
      const input = world.getComponent(entity, InputComponent)!;

      // 1️⃣ Attack-lock countdown (если идёт)
      if (anim.attackLockTime > 0) {
        anim.attackLockTime -= dt;
        if (anim.attackLockTime <= 0) {
          anim.attackLockTime = 0;
          anim.attacking = false;
        }
      }

      // 2️⃣ State determination (только если не attack)
      if (anim.currentState !== 'attack' || !anim.attacking) {
        const speed = Math.hypot(vel.vx, vel.vy);
        let desired: string;
        if (speed === 0) {
          desired = 'idle';
        } else if (this.bindings.isActive(input.keys, 'sprint')) {
          desired = 'run';
        } else {
          desired = 'walk';
        }
        if (anim.currentState !== desired) {
          anim.setState(desired, def);
        }

        // 3️⃣ Facing update (только при движении)
        const newFacing = facingFromVelocity(vel.vx, vel.vy);
        if (newFacing !== null && newFacing !== anim.facing) {
          anim.facing = newFacing;
          // Перезагрузить кадры для нового направления
          anim.refreshFrames(def);
        }
      }

      // 4️⃣ Frame advancement
      anim.update(def, dt);
    }
  }
}
