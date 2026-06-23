import { InputComponent } from '../components';
import { System, World } from '../core/ecs';

/**
 * ⌨️ Слушает клавиатуру; обновляет `InputComponent.keys` каждый кадр.
 *
 * Архитектура:
 * - `keydown`/`keyup` events асинхронные (между кадрами).
 * - Состояние клавиш хранится в `heldKeys` на самой системе.
 * - В {@link update} (синхронно с game loop) копируем состояние во все
 *   `InputComponent` в World.
 *
 * ⚠️ Колесо мыши (`wheel`) вынесено в {@link CameraInputSystem} — это
 * камерный вход, а не общий инпут. Не подписывается на `wheel` здесь.
 */
export class InputSystem extends System {
  /** ⌨️ `event.code` клавиш, зажатых в данный момент (lowercase). */
  private readonly heldKeys = new Set<string>();

  /**
   * 🛠️ Создаёт систему и подписывается на keyboard events.
   * @param target - элемент для подписки (по умолчанию `window`)
   */
  constructor(private readonly target: Window | HTMLElement = window) {
    super();
    (this.target as Window).addEventListener('keydown', this.onKeyDown as EventListener);
    (this.target as Window).addEventListener('keyup', this.onKeyUp as EventListener);
  }

  /**
   * 🧹 Снимает подписки. Вызывай при остановке игры.
   */
  destroy(): void {
    (this.target as Window).removeEventListener('keydown', this.onKeyDown as EventListener);
    (this.target as Window).removeEventListener('keyup', this.onKeyUp as EventListener);
  }

  /**
   * ▶️ Шаг системы: копирует текущее состояние клавиш во все `InputComponent`.
   * @param world - мир ECS
   */
  update(world: World): void {
    for (const entity of world.getEntitiesWith(InputComponent)) {
      const input = world.getComponent(entity, InputComponent)!;
      input.keys.clear();
      for (const key of this.heldKeys) {
        input.keys.add(key);
      }
    }
  }

  /** 🔽 Добавить клавишу в `heldKeys`. */
  private onKeyDown = (event: KeyboardEvent): void => {
    // 📌 Используем `event.code` (физическая клавиша) вместо `event.key`
    // (символ с учётом раскладки). Так `KeyW` сработает на физической W
    // в любой раскладке: EN, RU ('ц'), DE, FR ('z') и т.д.
    this.heldKeys.add(event.code.toLowerCase());
  };

  /** 🔼 Убрать клавишу из `heldKeys`. */
  private onKeyUp = (event: KeyboardEvent): void => {
    this.heldKeys.delete(event.code.toLowerCase());
  };
}
