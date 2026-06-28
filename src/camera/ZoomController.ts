import { CameraComponent } from '../components';

/**
 * 🔍 ZoomController — чистая логика зума камеры.
 *
 * Камера **не сдвигается** при зуме (zoom не сбивает follow):
 * - `cam.x, cam.y` остаются нетронутыми.
 * - `CameraSystem.follow` каждый кадр snap'ит камеру к target — и зум
 *   никак на это не влияет.
 *
 * Инкапсулирует:
 * - factor clamp ±15% per event (защита от резких прыжков трекпада/pinch)
 * - overshoot elastic cap (rubber-band)
 * - zoomPushTimer reset (прилипание в overshoot пока юзер зумит)
 *
 * Не подписывается на events — вызывается из `CameraInputSystem` / `TouchCameraInputSystem`.
 */
export class ZoomController {
  /** 📏 Минимальный factor per event (±15%). */
  static readonly MIN_FACTOR = 0.85;
  /** 📏 Максимальный factor per event. */
  static readonly MAX_FACTOR = 1 / ZoomController.MIN_FACTOR;

  /**
   * 🔍 Применить зум (БЕЗ anchor-коррекции — камера остаётся на target).
   *
   * @param cam - камера (мутируется)
   * @param factor - >1 приближение, <1 отдаление
   */
  static applyZoom(cam: CameraComponent, factor: number): void {
    // 1. Clamp factor ±15% per event (защита от резких прыжков трекпада/pinch)
    const clampedFactor = Math.max(ZoomController.MIN_FACTOR, Math.min(ZoomController.MAX_FACTOR, factor));

    // 2. Применяем zoom + zoomRest
    cam.zoom *= clampedFactor;
    cam.zoomRest = Math.max(cam.minZoom, Math.min(cam.maxZoom, cam.zoomRest * clampedFactor));

    // 3. Overshoot elastic cap (rubber-band)
    const absMinZoom = cam.minZoom * (1 - cam.zoomOvershoot);
    const absMaxZoom = cam.maxZoom * (1 + cam.zoomOvershoot);
    cam.zoom = Math.max(absMinZoom, Math.min(absMaxZoom, cam.zoom));

    // 4. Reset overshoot timer при активном зуме (камера "прилипает" в overshoot)
    if (cam.zoom > cam.maxZoom || cam.zoom < cam.minZoom) {
      cam.zoomPushTimer = 0;
    }
  }
}
