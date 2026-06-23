/**
 * ⌨️🪢 Маппинг игровых действий на физические клавиши.
 *
 * Использует `event.code` (не `event.key`) — раскладка无关:
 * `KeyW` сработает на физической W в любой раскладке (EN, RU, DE, FR...).
 *
 * Гибкая настройка: `new KeyBindings().bind('move-up', ['KeyI'])` — например,
 * ZQSD-стиль для AZERTY, IJKL-стиль, или любые другие раскладки.
 */

export type GameAction = 'move-up' | 'move-down' | 'move-left' | 'move-right';

/** 🗺️ Дефолтные биндинги: WASD + стрелки. */
const DEFAULT_BINDINGS: Record<GameAction, string[]> = {
  'move-up':    ['KeyW', 'ArrowUp'],
  'move-down':  ['KeyS', 'ArrowDown'],
  'move-left':  ['KeyA', 'ArrowLeft'],
  'move-right': ['KeyD', 'ArrowRight'],
};

export class KeyBindings {
  /** 🗂️ Маппинг: действие → Set<event.code> (lowercase). */
  private map: Map<GameAction, Set<string>> = new Map();

  /** 🛠️ Создаёт биндинги с дефолтами. Можно сразу переопределить через `bind()`. */
  constructor() {
    for (const action of Object.keys(DEFAULT_BINDINGS) as GameAction[]) {
      this.bind(action, DEFAULT_BINDINGS[action]);
    }
  }

  /**
   * 🔗 Привязать действие к набору физических клавиш (любая из них сработает).
   * @param action - игровое действие (`'move-up'` и т.п.)
   * @param codes - массив `event.code` (`'KeyW'`, `'ArrowUp'`, `'Space'`, ...)
   */
  bind(action: GameAction, codes: string[]): void {
    this.map.set(action, new Set(codes.map((c) => c.toLowerCase())));
  }

  /**
   * ✅ Проверить, активно ли действие для данного набора зажатых клавиш.
   *
   * @param activeKeys - множество `event.code` (lowercase), которые зажаты прямо сейчас
   * @param action - игровое действие
   * @returns `true`, если хотя бы один привязанный код зажат
   */
  isActive(activeKeys: ReadonlySet<string>, action: GameAction): boolean {
    const codes = this.map.get(action);
    if (!codes) return false;
    for (const code of codes) {
      if (activeKeys.has(code)) return true;
    }
    return false;
  }
}
