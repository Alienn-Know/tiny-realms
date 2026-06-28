import { CameraComponent } from '../components';
import { System, World } from '../core/ecs';
import { ZoomController } from './ZoomController';

/**
 * 📱📷 Pinch двумя пальцами → `CameraComponent.zoom` (без anchor-сдвига камеры).
 *
 * `world` захватывается в конструкторе через замыкание — touch-handler может
 * сразу работать с камерой без отложенной записи через `update`.
 * `update` пустой (нужен только для API `World.addSystem`).
 *
 * Логика:
 * - `touchstart` с 2 пальцами → начало pinch, запоминаем начальную дистанцию
 * - `touchmove` с 2 пальцами → factor = currentDist / lastDist
 * - `touchend`/`touchcancel` < 2 пальцев → завершение жеста
 *
 * Порог 5px изменения дистанции перед применением зума — антидребезг
 * (защита от мелкой дрожи пальцев на старте жеста).
 */
export class TouchCameraInputSystem extends System {
  /** 🤏 Активен ли pinch-жест. */
  private pinchActive = false;

  /** 📏 Дистанция между пальцами на прошлом `touchmove` (CSS-пиксели). */
  private lastDist = 0;

  /** 📏 Порог изменения дистанции для антидребезга (px). */
  private static readonly DIST_THRESHOLD = 5;

  /**
   * @param world - мир ECS (для поиска `CameraComponent`)
   * @param target - элемент для подписки на touch events (по умолчанию `window`)
   */
  constructor(
    private readonly world: World,
    private readonly target: Window | HTMLElement = window,
  ) {
    super();
    const t = this.target as Window;
    t.addEventListener('touchstart', this.onTouchStart as EventListener, { passive: false });
    t.addEventListener('touchmove', this.onTouchMove as EventListener, { passive: false });
    t.addEventListener('touchend', this.onTouchEnd as EventListener);
    t.addEventListener('touchcancel', this.onTouchEnd as EventListener);
  }

  /** 🧹 Снимает подписки. Вызывай при остановке игры. */
  destroy(): void {
    const t = this.target as Window;
    t.removeEventListener('touchstart', this.onTouchStart as EventListener);
    t.removeEventListener('touchmove', this.onTouchMove as EventListener);
    t.removeEventListener('touchend', this.onTouchEnd as EventListener);
    t.removeEventListener('touchcancel', this.onTouchEnd as EventListener);
  }

  /** ⏱️ Пустой step — touch-handler полностью асинхронный. */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  update(): void {}

  /** 🤏 Начало pinch — ровно 2 пальца. */
  private onTouchStart = (event: TouchEvent): void => {
    if (event.touches.length !== 2) return;
    event.preventDefault();
    this.pinchActive = true;
    this.lastDist = this.#distance(event.touches);
  };

  /** 🤏 Движение pinch — зум (без anchor-сдвига). */
  private onTouchMove = (event: TouchEvent): void => {
    if (!this.pinchActive || event.touches.length !== 2) return;
    event.preventDefault();

    const dist = this.#distance(event.touches);
    // Антидребезг: пропускаем мелкие изменения < 5px
    if (Math.abs(dist - this.lastDist) < TouchCameraInputSystem.DIST_THRESHOLD) return;

    const factor = dist / this.lastDist;
    ZoomController.applyZoom(TouchCameraInputSystem.#getCamera(this.world), factor);

    this.lastDist = dist;
  };

  /** 🛑 Конец pinch — меньше 2 пальцев. */
  private onTouchEnd = (event: TouchEvent): void => {
    if (event.touches.length < 2) {
      this.pinchActive = false;
    }
  };

  /** 📏 Дистанция между двумя пальцами (CSS-пиксели). */
  #distance(touches: TouchList): number {
    const a = touches[0];
    const b = touches[1];
    const dx = b.clientX - a.clientX;
    const dy = b.clientY - a.clientY;
    return Math.hypot(dx, dy);
  }

  /** 📷 Достать `CameraComponent` из мира. Всегда ровно одна (assert в dev). */
  static #getCamera(world: World): CameraComponent {
    const entities = world.getEntitiesWith(CameraComponent);
    if (entities.length === 0) {
      throw new Error('[TouchCameraInputSystem] No CameraComponent in world — create it before instantiating');
    }
    const cam = world.getComponent(entities[0], CameraComponent);
    if (!cam) {
      throw new Error('[TouchCameraInputSystem] CameraComponent missing on entity — world is corrupted');
    }
    return cam;
  }
}
