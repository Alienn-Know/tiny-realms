import { CameraComponent, TransformComponent } from '../components';
import { System, World } from '../core/ecs';

/**
 * 📷 Обновляет `CameraComponent` каждый кадр в стиле Clash of Clans.
 *
 * Три фазы:
 * 1. **Follow** — экспоненциальная интерполяция `(x, y)` к позиции `target`.
 * 2. **Zoom spring** — пружина возвращает `zoom` к `zoomRest` (rubber-band).
 *    Если пользователь "тянет" зум за лимит, `zoom` растягивается, но при
 *    отпускании плавно возвращается в `[minZoom, maxZoom]`.
 * 3. **Bounds clamp** — камера не выходит за `worldBounds` (с учётом `zoom`).
 */
export class CameraSystem extends System {
  /**
   * ▶️ Шаг системы.
   * @param world - мир ECS
   * @param dt - время с прошлого шага, сек
   */
  update(world: World, dt: number): void {
    for (const entity of world.getEntitiesWith(CameraComponent)) {
      const cam = world.getComponent(entity, CameraComponent)!;

      // 1. 📍 Follow target (frame-rate independent exponential decay)
      if (cam.target !== null) {
        const target = world.getComponent(cam.target, TransformComponent);
        if (target) {
          const t = 1 - Math.exp(-cam.smoothing * dt);
          cam.x += (target.x - cam.x) * t;
          cam.y += (target.y - cam.y) * t;
        }
      }

      // 2. 🔍 Zoom spring (подавлена в overshoot при "прилипании")
      //    a = -k * (zoom - zoomRest) - damping * zoomVelocity
      //    При k=80, damping=28 — overdamped: плавно тянет камеру обратно к лимиту
      //    без звона, после того как таймер удержания в overshoot истёк.
      const inOvershoot = cam.zoom > cam.maxZoom || cam.zoom < cam.minZoom;
      const springSuppressed = inOvershoot && cam.zoomPushTimer < cam.zoomHoldTime;
      if (springSuppressed) {
        // 🪃 Камера "прилипает" в overshoot: пружина выключена, velocity
        // обнуляется, чтобы при последующем включении стартовать с покоя.
        cam.zoomVelocity = 0;
      } else {
        const a = -cam.zoomSpringK * (cam.zoom - cam.zoomRest) - cam.zoomDamping * cam.zoomVelocity;
        cam.zoomVelocity += a * dt;
        cam.zoom += cam.zoomVelocity * dt;
      }

      // 3. 🗺️ Bounds clamp (с учётом зума — мир в координатах сцены, без зума)
      //    Эффективный размер вьюпорта в мировых единицах = пиксели / zoom.
      const zoom = Math.max(cam.zoom, 0.0001);
      const viewW = cam.viewportWidth / zoom;
      const viewH = cam.viewportHeight / zoom;
      const minX = cam.worldMinX + viewW / 2;
      const maxX = cam.worldMaxX - viewW / 2;
      const minY = cam.worldMinY + viewH / 2;
      const maxY = cam.worldMaxY - viewH / 2;
      // Клампим только если границы шире, чем вьюпорт (иначе карта меньше экрана)
      if (minX < maxX) cam.x = Math.max(minX, Math.min(maxX, cam.x));
      if (minY < maxY) cam.y = Math.max(minY, Math.min(maxY, cam.y));

      // 4. ⏱️ Overshoot-release таймер.
      //    Пока `cam.zoom` в overshoot-диапазоне (`zoom > maxZoom` или
      //    `zoom < minZoom`) — таймер растёт. Wheel-event (см. InputSystem)
      //    сбрасывает его в `0` → камера "прилипает" в overshoot пока юзер
      //    скроллит. Через `zoomHoldTime` секунд без wheel-event пружина
      //    размораживается и плавно тянет `zoom` обратно к `zoomRest`
      //    ("оттягивание" камеры к лимиту).
      if (inOvershoot) {
        cam.zoomPushTimer += dt;
      } else {
        cam.zoomPushTimer = 0;
      }
    }
  }
}
