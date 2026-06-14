import { SpriteComponent, TransformComponent, VelocityComponent } from '../components';
import { System, World } from '../core/ecs';

export class BoundarySystem extends System {
  constructor(private width: number, private height: number) {
    super();
  }

  update(world: World): void {
    for (const entity of world.getEntitiesWith(TransformComponent, VelocityComponent, SpriteComponent)) {
      const transform = world.getComponent(entity, TransformComponent)!;
      const velocity = world.getComponent(entity, VelocityComponent)!;
      const sprite = world.getComponent(entity, SpriteComponent)!;

      const bounds = sprite.view.getLocalBounds();
      const halfWidth = bounds.width / 2;
      const halfHeight = bounds.height / 2;

      const minX = halfWidth;
      const maxX = this.width - halfWidth;
      const minY = halfHeight;
      const maxY = this.height - halfHeight;

      if (transform.x < minX) {
        transform.x = minX;
        velocity.vx = Math.abs(velocity.vx);
      } else if (transform.x > maxX) {
        transform.x = maxX;
        velocity.vx = -Math.abs(velocity.vx);
      }

      if (transform.y < minY) {
        transform.y = minY;
        velocity.vy = Math.abs(velocity.vy);
      } else if (transform.y > maxY) {
        transform.y = maxY;
        velocity.vy = -Math.abs(velocity.vy);
      }
    }
  }
}
