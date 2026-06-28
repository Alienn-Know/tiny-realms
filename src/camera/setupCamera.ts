import type { Application } from 'pixi.js';
import { CameraComponent } from '../components';
import { CAMERA_DEFAULTS } from '../config/camera.config';
import type { Entity, World } from '../core/ecs';
import type { WorldBounds } from '../map/worldBounds';

export type { WorldBounds } from '../map/worldBounds';
export { computeWorldBounds } from '../map/worldBounds';

/**
 * 🔍 Вычислить стартовый зум камеры.
 *
 * Если карта меньше вьюпорта — fit-to-screen, иначе читаемый минимум.
 */
export function computeInitialZoom(viewportW: number, viewportH: number, bounds: WorldBounds): number {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const fitZoom = Math.min(viewportW / width, viewportH / height);
  return Math.max(fitZoom, CAMERA_DEFAULTS.initialZoomFallback);
}

/**
 * 📷 Создать `CameraComponent` и привязать его к entity + resize handler.
 *
 * Возвращает настроенный компонент, готовый к добавлению в world.
 *
 * @param world - мир ECS
 * @param app - Pixi Application (для viewport size + resize)
 * @param target - entity за которой камера следует (обычно player)
 * @param bounds - границы мира (из `computeWorldBounds`)
 */
export function setupCamera(
  world: World,
  app: Application,
  target: Entity,
  bounds: WorldBounds,
): { entity: Entity; component: CameraComponent } {
  const comp = new CameraComponent();
  comp.viewportWidth = app.screen.width;
  comp.viewportHeight = app.screen.height;
  comp.target = target;
  comp.minZoom = CAMERA_DEFAULTS.minZoom;
  comp.maxZoom = CAMERA_DEFAULTS.maxZoom;
  comp.smoothing = CAMERA_DEFAULTS.smoothing;
  comp.zoomSpringK = CAMERA_DEFAULTS.zoomSpringK;
  comp.zoomDamping = CAMERA_DEFAULTS.zoomDamping;
  comp.zoomSensitivity = CAMERA_DEFAULTS.zoomSensitivity;
  comp.zoomOvershoot = CAMERA_DEFAULTS.zoomOvershoot;
  comp.zoomHoldTime = CAMERA_DEFAULTS.zoomHoldTime;

  // 🎯 Стартовая позиция — центр карты (первый же кадр CameraSystem
  //    snap'ит на target через follow).
  comp.x = bounds.minX + (bounds.maxX - bounds.minX) / 2;
  comp.y = bounds.minY + (bounds.maxY - bounds.minY) / 2;

  // 🔍 Стартовый зум
  const initialZoom = computeInitialZoom(app.screen.width, app.screen.height, bounds);
  comp.zoom = initialZoom;
  comp.zoomRest = initialZoom;

  // 🗺️ Bounds clamp
  comp.worldMinX = bounds.minX;
  comp.worldMinY = bounds.minY;
  comp.worldMaxX = bounds.maxX;
  comp.worldMaxY = bounds.maxY;

  const entity = world.createEntity();
  world.addComponent(entity, comp);

  // 📐 Resize handler: обновляем viewport size, CameraSystem пересчитает clamp
  app.renderer.on('resize', () => {
    comp.viewportWidth = app.screen.width;
    comp.viewportHeight = app.screen.height;
  });

  return { entity, component: comp };
}
