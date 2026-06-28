import { CameraComponent } from '../components';
import { System, World } from '../core/ecs';
import { ZoomController } from './ZoomController';

/**
 * 🖱️📷 Колесо мыши → `CameraComponent.zoom` (без anchor-сдвига камеры).
 *
 * `world` захватывается в конструкторе через замыкание — listener может
 * сразу работать с камерой без отложенной записи через `update`.
 * `update` пустой (нужен только для API `World.addSystem`).
 *
 * `event.deltaY` → factor (через `cam.zoomSensitivity`) → `ZoomController.applyZoom`.
 */
export class CameraInputSystem extends System {
  /**
   * @param world - мир ECS (для поиска `CameraComponent`)
   * @param target - элемент для подписки на `wheel` (по умолчанию `window`)
   */
  constructor(
    private readonly world: World,
    private readonly target: Window | HTMLElement = window,
  ) {
    super();
    (this.target as Window).addEventListener('wheel', this.onWheel as EventListener, { passive: false });
  }

  /** 🧹 Снимает подписку. Вызывай при остановке игры. */
  destroy(): void {
    (this.target as Window).removeEventListener('wheel', this.onWheel as EventListener);
  }

  /** ⏱️ Пустой step — listener полностью асинхронный. */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  update(): void {}

  /**
   * 🖱️ Колесо мыши → зум камеры (без anchor-сдвига — камера остаётся на target).
   * `event.deltaY > 0` (scroll down) → factor < 1 → zoom уменьшается (отдаление).
   * `event.deltaY < 0` (scroll up)   → factor > 1 → zoom увеличивается (приближение).
   */
  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const cam = CameraInputSystem.#getCamera(this.world);
    const factor = Math.exp(-event.deltaY * cam.zoomSensitivity);
    ZoomController.applyZoom(cam, factor);
  };

  /** 📷 Достать `CameraComponent` из мира. Всегда ровно одна (assert в dev). */
  static #getCamera(world: World): CameraComponent {
    const entities = world.getEntitiesWith(CameraComponent);
    if (entities.length === 0) {
      throw new Error('[CameraInputSystem] No CameraComponent in world — create it before instantiating');
    }
    const cam = world.getComponent(entities[0], CameraComponent);
    if (!cam) {
      throw new Error('[CameraInputSystem] CameraComponent missing on entity — world is corrupted');
    }
    return cam;
  }
}
