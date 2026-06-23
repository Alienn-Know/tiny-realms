import { Component } from '../core/ecs';

/**
 * 🎮 Хранит состояние клавиш у entity (обычно у player'а).
 *
 * Система ввода слушает `keydown`/`keyup` и обновляет `keys` через
 * `event.code` (физическая клавиша, не зависит от раскладки). Другие системы
 * (например, `PlayerControlSystem`) читают состояние через {@link KeyBindings}.
 *
 * Использование (низкоуровневое):
 * ```ts
 * const input = world.getComponent(player, InputComponent)!;
 * if (input.isDown('keyw')) { /* движение вверх — физическая W в любой раскладке *\/ }
 * ```
 *
 * Использование (рекомендуемое, через биндинги):
 * ```ts
 * const bindings = new KeyBindings();
 * if (bindings.isActive(input.keys, 'move-up')) { /* движение вверх *\/ }
 * ```
 */
export class InputComponent extends Component {
  static readonly typeId = Symbol('InputComponent');

  /** ⌨️ Множество `event.code` зажатых в данный момент клавиш (lowercase). */
  readonly keys = new Set<string>();

  /**
   * ✅ Нажата ли физическая клавиша `key` (регистр игнорируется).
   * @param key - `event.code` клавиши: `'KeyW'`, `'KeyA'`, `'ArrowUp'`, `'Space'` и т.п.
   * @returns `true`, если клавиша сейчас зажата
   */
  isDown(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }
}
