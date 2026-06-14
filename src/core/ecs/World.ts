import type { Component } from './Component';
import type { Entity } from './Entity';
import type { System } from './System';

export class World {
  private nextEntityId = 0;
  private entities = new Set<Entity>();
  private components = new Map<new (...args: any[]) => Component, Map<Entity, Component>>();
  private systems: System[] = [];

  createEntity(): Entity {
    const entity = this.nextEntityId++;
    this.entities.add(entity);
    return entity;
  }

  removeEntity(entity: Entity): void {
    this.entities.delete(entity);
    for (const map of this.components.values()) {
      map.delete(entity);
    }
  }

  addComponent(entity: Entity, component: Component): void {
    const type = component.constructor as new (...args: any[]) => Component;
    let map = this.components.get(type);
    if (!map) {
      map = new Map<Entity, Component>();
      this.components.set(type, map);
    }
    map.set(entity, component);
  }

  getComponent<T extends Component>(entity: Entity, type: new (...args: any[]) => T): T | undefined {
    return this.components.get(type)?.get(entity) as T | undefined;
  }

  removeComponent<T extends Component>(entity: Entity, type: new (...args: any[]) => T): void {
    this.components.get(type)?.delete(entity);
  }

  hasComponent<T extends Component>(entity: Entity, type: new (...args: any[]) => T): boolean {
    return this.components.get(type)?.has(entity) ?? false;
  }

  getEntitiesWith(...types: (new (...args: any[]) => Component)[]): Entity[] {
    if (types.length === 0) return [];

    const firstMap = this.components.get(types[0]);
    if (!firstMap) return [];

    const result: Entity[] = [];
    for (const entity of firstMap.keys()) {
      if (types.every((type) => this.hasComponent(entity, type))) {
        result.push(entity);
      }
    }
    return result;
  }

  addSystem(system: System): void {
    this.systems.push(system);
  }

  update(dt: number): void {
    for (const system of this.systems) {
      system.update(this, dt);
    }
  }
}
