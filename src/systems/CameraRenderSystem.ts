import { Container } from 'pixi.js';
import { CameraComponent } from '../components';
import { System, World } from '../core/ecs';

/**
 * 📷➡️🖼️ Применяет состояние `CameraComponent` к `worldContainer`.
 *
 * Все игровые объекты (тайлы, спрайты) — дети `worldContainer`. Эта система
 * выставляет `scale` и `position` контейнера так, чтобы:
 *
 *   screen = (world - camera) * zoom + viewportCenter
 *
 * Что эквивалентно:
 *   worldContainer.scale = zoom
 *   worldContainer.x = viewportWidth  / 2 - camera.x * zoom
 *   worldContainer.y = viewportHeight / 2 - camera.y * zoom
 *
 * За счёт этого все спрайты могут хранить **мировые** координаты напрямую,
 * а изометрия/зум/следование камеры применяются автоматически на уровне
 * одного контейнера (один matrix update, ноль per-sprite math).
 */
export class CameraRenderSystem extends System {
  /**
   * @param worldContainer - контейнер, в который добавлены все игровые объекты
   */
  constructor(private readonly worldContainer: Container) {
    super();
  }

  /**
   * ▶️ Шаг системы: обновляет transform `worldContainer` по камере.
   * @param world - мир ECS
   */
  update(world: World): void {
    const cameraEntities = world.getEntitiesWith(CameraComponent);
    if (cameraEntities.length === 0) {
      this.worldContainer.x = 0;
      this.worldContainer.y = 0;
      this.worldContainer.scale.set(1);
      return;
    }

    const cam = world.getComponent(cameraEntities[0], CameraComponent)!;
    const zoom = Math.max(cam.zoom, 0.0001);

    this.worldContainer.scale.set(zoom);
    this.worldContainer.x = cam.viewportWidth / 2 - cam.x * zoom;
    this.worldContainer.y = cam.viewportHeight / 2 - cam.y * zoom;
  }
}
