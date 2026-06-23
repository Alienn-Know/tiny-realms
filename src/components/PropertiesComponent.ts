import { Component } from '../core/ecs';

/**
 * 🏷️ Хранит custom properties из Tiled (любая вложенность/поля).
 *
 * Для объектов типа `enemy` Tiled может задать `{hp: 50, faction: "goblin", ai: {aggressive: true}}`
 * — всё это пробрасывается в {@link data} и читается через {@link get}.
 *
 * v1: используется как passthrough для будущих handler'ов (AI, dialog, и т.п.).
 */
export class PropertiesComponent extends Component {
  static readonly typeId = Symbol('PropertiesComponent');

  constructor(public data: Record<string, unknown> = {}) {
    super();
  }

  /** 🔍 Достать значение по ключу. */
  get<T = unknown>(key: string): T | undefined {
    return this.data[key] as T | undefined;
  }

  /** ✅ Проверить наличие ключа. */
  has(key: string): boolean {
    return key in this.data;
  }
}
