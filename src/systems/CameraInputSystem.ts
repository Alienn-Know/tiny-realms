import { CameraComponent } from '../components';
import { System, World } from '../core/ecs';
import { ZoomController } from './camera/ZoomController';

/**
 * 🖱️📷 Колесо мыши → `CameraComponent` (зум, overshoot-release, cursor-anchor).
 *
 * Выделено из `InputSystem` для разделения ответственности:
 * - `InputSystem` занимается **клавиатурой** → `InputComponent.keys`
 * - `CameraInputSystem` занимается **колесом** → `CameraComponent`
 *
 * Зум-math вынесена в {@link ZoomController} — общий с `TouchCameraInputSystem` (DRY).
 * Эта система только переводит wheel-event → factor + anchor (курсор).
 */
export class CameraInputSystem extends System {
  /** 🌍 Ссылка на World (устанавливается в `update`). */
  private worldRef: World | null = null;

  /**
   * @param target - элемент для подписки на `wheel` (по умолчанию `window`)
   */
  constructor(private readonly target: Window | HTMLElement = window) {
    super();
    (this.target as Window).addEventListener('wheel', this.onWheel as EventListener, { passive: false });
  }

  /**
   * 🧹 Снимает подписку. Вызывай при остановке игры.
   */
  destroy(): void {
    (this.target as Window).removeEventListener('wheel', this.onWheel as EventListener);
  }

  /**
   * ▶️ Шаг системы: сохраняет ссылку на World (нужна wheel-обработчику).
   * @param world - мир ECS
   */
  update(world: World): void {
    this.worldRef = world;
  }

  /**
   * 🖱️ Колесо мыши → зум камеры + cursor-anchor.
   *
   * `event.clientX/Y` — CSS-пиксели (с `autoDensity: true` совпадает с
   * `app.screen.width/height`). anchor = позиция курсора.
   */
  private onWheel = (event: WheelEvent): void => {
    if (!this.worldRef) return;
    event.preventDefault();

    const cameraEntities = this.worldRef.getEntitiesWith(CameraComponent);
    for (const entity of cameraEntities) {
      const cam = this.worldRef.getComponent(entity, CameraComponent)!;
      // deltaY > 0 (scroll down) → factor < 1 → zoom уменьшается (отдаление)
      // deltaY < 0 (scroll up)   → factor > 1 → zoom увеличивается (приближение)
      const factor = Math.exp(-event.deltaY * cam.zoomSensitivity);
      ZoomController.applyZoom(cam, factor, event.clientX, event.clientY);
    }
  };
}
