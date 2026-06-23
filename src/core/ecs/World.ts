import type { Component } from './Component';
import type { Entity } from './Entity';
import type { System } from './System';

/**
 * 🔑 Извлекает уникальный `typeId` из конструктора компонента.
 * Устойчиво к минификации, т.к. Symbol-значение — это ссылка, а не имя.
 */
type ComponentCtor<T extends Component = Component> = new (...args: any[]) => T;
const typeIdOf = (ctor: ComponentCtor): symbol => (ctor as unknown as { typeId: symbol }).typeId;

/**
 * 🌍 Центральный контейнер ECS: хранит сущности, их компоненты и системы,
 * которые обрабатывают их каждый кадр.
 *
 * Компоненты лежат в картах по `Symbol`-ключу `typeId` класса — O(1) доступ
 * и устойчивость к минификации (Symbol не переименовывается как имя класса).
 */
export class World {
  /** 🔢 Счётчик для генерации уникальных id сущностей. */
  private nextEntityId = 0;

  /** 📋 Множество всех живых сущностей. */
  private entities = new Set<Entity>();

  /** 🗂️ Карта компонентов: `typeId` (Symbol) → (entity → инстанс). */
  private components = new Map<symbol, Map<Entity, Component>>();

  /** ⚙️ Зарегистрированные системы, выполняются в порядке добавления. */
  private systems: System[] = [];

  /**
   * ➕ Создаёт новую сущность.
   * @returns id созданной сущности
   */
  createEntity(): Entity {
    const entity = this.nextEntityId++;
    this.entities.add(entity);
    return entity;
  }

  /**
   * 🗑️ Удаляет сущность и все её компоненты.
   *
   * ⚠️ Не уведомляет системы, которые могут хранить внешние ссылки на entity.
   * Пустые карты типов автоматически удаляются из реестра.
   * @param entity - id удаляемой сущности
   */
  removeEntity(entity: Entity): void {
    this.entities.delete(entity);
    for (const [typeId, map] of this.components) {
      map.delete(entity);
      if (map.size === 0) this.components.delete(typeId);
    }
  }

  /**
   * 🧩 Привязывает компонент к сущности. В качестве ключа используется
   * `static typeId` класса компонента.
   * @param entity - id сущности
   * @param component - инстанс компонента
   */
  addComponent(entity: Entity, component: Component): void {
    const typeId = typeIdOf(component.constructor as ComponentCtor);
    let map = this.components.get(typeId);
    if (!map) {
      map = new Map<Entity, Component>();
      this.components.set(typeId, map);
    }
    map.set(entity, component);
  }

  /**
   * 🔎 Возвращает компонент указанного типа у сущности.
   * @param entity - id сущности
   * @param type - конструктор класса компонента
   * @returns инстанс компонента или `undefined`, если его нет
   */
  getComponent<T extends Component>(entity: Entity, type: ComponentCtor<T>): T | undefined {
    return this.components.get(typeIdOf(type))?.get(entity) as T | undefined;
  }

  /**
   * ❌ Отвязывает компонент указанного типа от сущности.
   * Если после удаления карта типа пуста — она тоже удаляется.
   * @param entity - id сущности
   * @param type - конструктор класса компонента
   */
  removeComponent<T extends Component>(entity: Entity, type: ComponentCtor<T>): void {
    const typeId = typeIdOf(type);
    const map = this.components.get(typeId);
    if (!map) return;
    map.delete(entity);
    if (map.size === 0) this.components.delete(typeId);
  }

  /**
   * ✅ Проверяет наличие компонента указанного типа у сущности.
   * @param entity - id сущности
   * @param type - конструктор класса компонента
   * @returns `true`, если компонент привязан
   */
  hasComponent<T extends Component>(entity: Entity, type: ComponentCtor<T>): boolean {
    return this.components.get(typeIdOf(type))?.has(entity) ?? false;
  }

  /**
   * 🔗 Возвращает сущности, у которых привязаны ВСЕ указанные типы компонентов.
   *
   * 📌 Итерирует карту первого типа и фильтрует по остальным — для скорости
   * первым ставь самый редкий компонент.
   * @param types - список конструкторов компонентов
   * @returns массив id подходящих сущностей (пустой, если типов нет)
   */
  getEntitiesWith(...types: ComponentCtor[]): Entity[] {
    if (types.length === 0) return [];

    const firstMap = this.components.get(typeIdOf(types[0]));
    if (!firstMap) return [];

    const restTypeIds = types.slice(1).map(typeIdOf);
    const result: Entity[] = [];
    for (const entity of firstMap.keys()) {
      if (restTypeIds.every((tid) => this.components.get(tid)?.has(entity) ?? false)) {
        result.push(entity);
      }
    }
    return result;
  }

  /**
   * 🛠️ Регистрирует систему. Системы запускаются в порядке добавления.
   * @param system - инстанс системы
   */
  addSystem(system: System): void {
    this.systems.push(system);
  }

  /**
   * ▶️ Прогоняет все зарегистрированные системы по разу (порядок = порядок добавления).
   * @param dt - время с прошлого кадра, в секундах
   */
  update(dt: number): void {
    for (const system of this.systems) {
      system.update(this, dt);
    }
  }
}
