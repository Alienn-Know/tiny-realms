import { TransformComponent, VelocityComponent } from '../components';
import { System, World } from '../core/ecs';

export class MovementSystem extends System {
  update(world: World, dt: number): void {
    for (const entity of world.getEntitiesWith(TransformComponent, VelocityComponent)) {
      const transform = world.getComponent(entity, TransformComponent)!;
      const velocity = world.getComponent(entity, VelocityComponent)!;

      transform.x += velocity.vx * dt;
      transform.y += velocity.vy * dt;
    }
  }
}
