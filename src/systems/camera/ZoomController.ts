import { CameraComponent } from '../../components';

/**
 * 🔍 ZoomController — чистая логика зума камеры с anchor-точкой.
 *
 * Общий для wheel (мышь) и pinch (touch) — DRY.
 * Инкапсулирует:
 * - anchor-коррекцию (точка мира под anchor остаётся под ней после зума)
 * - factor clamp ±15% per event (защита от резких прыжков)
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
   * 🔍 Применить зум с anchor-точкой (в экранных координатах).
   *
   * @param cam - камера (мутируется)
   * @param factor - >1 приближение, <1 отдаление
   * @param anchorScreenX - X anchor в CSS-пикселях (курсор / midpoint pinch)
   * @param anchorScreenY - Y anchor
   */
  static applyZoom(
    cam: CameraComponent,
    factor: number,
    anchorScreenX: number,
    anchorScreenY: number,
  ): void {
    // 1. Точка мира под anchor (до изменения зума)
    const oldZoom = cam.zoom;
    const worldX = (anchorScreenX - cam.viewportWidth / 2) / oldZoom + cam.x;
    const worldY = (anchorScreenY - cam.viewportHeight / 2) / oldZoom + cam.y;

    // 2. Clamp factor ±15% per event (защита от резких прыжков трекпада/pinch)
    const clampedFactor = Math.max(ZoomController.MIN_FACTOR, Math.min(ZoomController.MAX_FACTOR, factor));

    // 3. Применяем zoom + zoomRest
    cam.zoom *= clampedFactor;
    cam.zoomRest = Math.max(cam.minZoom, Math.min(cam.maxZoom, cam.zoomRest * clampedFactor));

    // 4. Overshoot elastic cap (rubber-band)
    const absMinZoom = cam.minZoom * (1 - cam.zoomOvershoot);
    const absMaxZoom = cam.maxZoom * (1 + cam.zoomOvershoot);
    cam.zoom = Math.max(absMinZoom, Math.min(absMaxZoom, cam.zoom));

    // 5. Reset overshoot timer при активном зуме (камера "прилипает" в overshoot)
    if (cam.zoom > cam.maxZoom || cam.zoom < cam.minZoom) {
      cam.zoomPushTimer = 0;
    }

    // 6. Anchor-коррекция: точка мира остаётся под anchor после зума
    if (cam.zoom > 0) {
      cam.x = worldX - (anchorScreenX - cam.viewportWidth / 2) / cam.zoom;
      cam.y = worldY - (anchorScreenY - cam.viewportHeight / 2) / cam.zoom;
    }
  }
}
