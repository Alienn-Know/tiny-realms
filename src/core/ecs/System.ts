import type { World } from './World';

export abstract class System {
  abstract update(world: World, dt: number): void;
}
