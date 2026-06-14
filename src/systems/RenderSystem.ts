import { SpriteComponent, TransformComponent } from '../components';
import { System, World } from '../core/ecs';

export class RenderSystem extends System {
  update(world: World): void {
    for (const entity of world.getEntitiesWith(TransformComponent, SpriteComponent)) {
      const transform = world.getComponent(entity, TransformComponent)!;
      const sprite = world.getComponent(entity, SpriteComponent)!;

      sprite.view.x = transform.renderX;
      sprite.view.y = transform.renderY;
      sprite.view.rotation = transform.renderRotation;
      sprite.view.scale.set(transform.scale);
    }
  }
}
