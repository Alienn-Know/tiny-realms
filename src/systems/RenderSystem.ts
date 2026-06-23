import { SpriteComponent, TransformComponent } from '../components';
import { System, World } from '../core/ecs';

/**
 * 🎨 Синхронизирует `TransformComponent` с `SpriteComponent.view`.
 *
 * Записывает **мировые** координаты и поворот из `TransformComponent` в view-контейнер.
 * Зум/следование камеры применяются к общему `worldContainer` в {@link CameraRenderSystem},
 * поэтому здесь работаем с "сырыми" мировыми координатами без пересчёта в экранные.
 */
export class RenderSystem extends System {
  /**
   * ▶️ Шаг системы.
   * @param world - мир ECS
   */
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
