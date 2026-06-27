import { CameraComponent, TransformComponent } from '../components';
import { System, World } from '../core/ecs';
import { ZoomController } from './camera/ZoomController';

/**
 * 📱📷 Pinch двумя пальцами → `CameraComponent` (зум, anchor = midpoint).
 *
 * Симметрично {@link CameraInputSystem} (wheel), но для touch.
 * Зум-math переиспользуется через {@link ZoomController} (DRY).
 *
 * Логика:
 * - `touchstart` с 2 пальцами → начало pinch, запоминаем начальную дистанцию
 * - `touchmove` с 2 пальцами → factor = currentDist / lastDist; anchor = midpoint
 * - `touchend`/`touchcancel` < 2 пальцев → завершение жеста
 *
 * Порог 5px изменения дистанции перед применением зума — антидребезг
 * (защита от мелкой дрожи пальцев на старте жеста).
 *
 * Подписка на нативные `TouchEvent` (не Pixi FederatedEvent) —
 * pinch = 2 одновременных pointer'а, нативные TouchEvent удобнее.
 */
export class TouchCameraInputSystem extends System {
  /** 🌍 Ссылка на World (устанавливается в `update`). */
  private worldRef: World | null = null;

  /** 🤏 Активен ли pinch-жест. */
  private pinchActive = false;

  /** 📏 Дистанция между пальцами на прошлом `touchmove` (CSS-пиксели). */
  private lastDist = 0;

  /** 📏 Порог изменения дистанции для антидребезга (px). */
  private static readonly DIST_THRESHOLD = 5;

  /**
   * @param target - элемент для подписки на touch events (по умолчанию `window`)
   */
  constructor(private readonly target: Window | HTMLElement = window) {
    super();
    const t = this.target as Window;
    t.addEventListener('touchstart', this.onTouchStart as EventListener, { passive: false });
    t.addEventListener('touchmove', this.onTouchMove as EventListener, { passive: false });
    t.addEventListener('touchend', this.onTouchEnd as EventListener);
    t.addEventListener('touchcancel', this.onTouchEnd as EventListener);
  }

  /**
   * 🧹 Снимает подписки. Вызывай при остановке игры.
   */
  destroy(): void {
    const t = this.target as Window;
    t.removeEventListener('touchstart', this.onTouchStart as EventListener);
    t.removeEventListener('touchmove', this.onTouchMove as EventListener);
    t.removeEventListener('touchend', this.onTouchEnd as EventListener);
    t.removeEventListener('touchcancel', this.onTouchEnd as EventListener);
  }

  /**
   * ▶️ Шаг системы: сохраняет ссылку на World (нужна touch-обработчикам).
   * @param world - мир ECS
   */
  update(world: World): void {
    this.worldRef = world;
  }

  /** 🤏 Начало pinch — ровно 2 пальца. */
  private onTouchStart = (event: TouchEvent): void => {
    if (event.touches.length !== 2) return;
    event.preventDefault();
    this.pinchActive = true;
    this.lastDist = this.#distance(event.touches);
  };

  /** 🤏 Движение pinch — зум с anchor = midpoint. */
  private onTouchMove = (event: TouchEvent): void => {
    if (!this.pinchActive || event.touches.length !== 2 || !this.worldRef) return;
    event.preventDefault();

    const dist = this.#distance(event.touches);
    // Антидребезг: пропускаем мелкие изменения < 5px
    if (Math.abs(dist - this.lastDist) < TouchCameraInputSystem.DIST_THRESHOLD) return;

    const factor = dist / this.lastDist;
    const mid = this.#midpoint(event.touches);

    const cameraEntities = this.worldRef.getEntitiesWith(CameraComponent);
    for (const entity of cameraEntities) {
      const cam = this.worldRef.getComponent(entity, CameraComponent)!;
      // 📸 Snapshot target'а в момент touch (а не в момент update).
      const target = cam.target !== null
        ? this.worldRef.getComponent(cam.target, TransformComponent)
        : null;
      const tx = target?.x ?? cam.x;
      const ty = target?.y ?? cam.y;
      ZoomController.applyZoom(cam, factor, mid.x, mid.y, tx, ty);
    }

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

  /** 📍 Midpoint между двумя пальцами (CSS-пиксели). */
  #midpoint(touches: TouchList): { x: number; y: number } {
    const a = touches[0];
    const b = touches[1];
    return {
      x: (a.clientX + b.clientX) / 2,
      y: (a.clientY + b.clientY) / 2,
    };
  }
}
