import { CameraComponent, TransformComponent } from '../components';
import { System, World } from '../core/ecs';

/**
 * 📷 Обновляет `CameraComponent` каждый кадр в стиле Clash of Clans.
 *
 * Три фазы:
 * 1. **Follow** — snap `cam.x/y = target.x/y`. Зум **не сдвигает** камеру —
 *    она всегда на персонаже (см. {@link ZoomController}).
 * 2. **Zoom spring** — пружина возвращает `zoom` к `zoomRest` (rubber-band).
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

      // 1. 📍 Follow target (snap). Зум не сбивает камеру — она всегда на target.
      if (cam.target !== null) {
        const target = world.getComponent(cam.target, TransformComponent);
        if (target) {
          cam.x = target.x;
          cam.y = target.y;
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
      //    Если вьюпорт ШИРЕ мира — камера лочится в центре мира (иначе
      //    видны "пустоты" за границами). Если уже — обычный clamp в диапазон.
      //    Раньше clamp просто отключался при `minY >= maxY` — камера могла
      //    застрять на границе диапазона (резкий переход через 0-ширину).
      const zoom = Math.max(cam.zoom, 0.0001);
      const viewW = cam.viewportWidth / zoom;
      const viewH = cam.viewportHeight / zoom;
      const worldCenterX = (cam.worldMinX + cam.worldMaxX) / 2;
      const worldCenterY = (cam.worldMinY + cam.worldMaxY) / 2;

      // X
      const xRange = cam.worldMaxX - cam.worldMinX - viewW;
      if (xRange > 0) {
        const minX = cam.worldMinX + viewW / 2;
        const maxX = cam.worldMaxX - viewW / 2;
        cam.x = Math.max(minX, Math.min(maxX, cam.x));
      } else {
        cam.x = worldCenterX;
      }

      // Y
      const yRange = cam.worldMaxY - cam.worldMinY - viewH;
      if (yRange > 0) {
        const minY = cam.worldMinY + viewH / 2;
        const maxY = cam.worldMaxY - viewH / 2;
        cam.y = Math.max(minY, Math.min(maxY, cam.y));
      } else {
        cam.y = worldCenterY;
      }

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
