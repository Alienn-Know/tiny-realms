/**
 * 🧱 Базовый класс компонента ECS.
 *
 * Каждый подкласс ОБЯЗАН переопределить `static readonly typeId` собственным
 * `Symbol(...)` — иначе несколько типов компонентов сольются в одну карту.
 *
 * Пример:
 * ```ts
 * class TransformComponent extends Component {
 *   static readonly typeId = Symbol('TransformComponent');
 * }
 * ```
 *
 * Symbol-ключ устойчив к минификации (минификатор не может «склеить» два
 * разных `Symbol(...)` в один).
 */
export abstract class Component {
  /** 🔑 Уникальный идентификатор типа компонента. Переопредели в подклассе! */
  static readonly typeId: symbol = Symbol('Component');
}
