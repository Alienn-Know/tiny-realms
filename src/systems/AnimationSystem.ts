import { InputComponent, VelocityComponent, AnimationComponent, AnimationDefinitionComponent } from '../components';
import { System, World } from '../core/ecs';
import { KeyBindings } from '../core/input/KeyBindings';

/**
 * 🎬 Управляет анимациями сущностей.
 *
 * Каждый кадр:
 * 1. Снимает `attackLockTime` (если идёт attack).
 * 2. Определяет желаемый state по `Velocity` + `Input` (если не attack):
 *    - `velocity == 0` → `'idle'`
 *    - `velocity > 0` + `Shift` → `'run'`
 *    - `velocity > 0` (без Shift) → `'walk'`
 * 3. Продвигает кадры через `AnimationComponent.update`.
 *
 * `facing` обновляется в `PlayerControlSystem` по нажатым клавишам (надёжнее,
 * чем по направлению velocity — диагонали разрешаются по активной оси).
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
      }

      // 3️⃣ Frame advancement
      anim.update(def, dt);
    }
  }
}
