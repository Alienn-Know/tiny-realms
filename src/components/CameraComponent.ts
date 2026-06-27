import { Component } from '../core/ecs';

/**
 * 📷 Компонент камеры в стиле Clash of Clans.
 *
 * Что умеет:
 * - 🔗 **Follow** — плавно интерполирует позицию к `target` (entity с `TransformComponent`).
 * - 🔍 **Зум с rubber-band** — колесо мыши меняет `zoom`; значения `zoomRest` жёстко
 *   ограничены `[minZoom, maxZoom]`, а `zoom` может кратковременно "упруго" уходить
 *   за лимиты. При отпускании пружина возвращает `zoom` к `zoomRest` (как в iOS).
 * - 🗺️ **Bounds clamp** — камера не выходит за прямоугольник `worldBounds`
 *   (с учётом текущего `zoom`).
 * - 🖱️ **Зум-анкор к курсору** — точка мира под курсором остаётся под курсором
 *   при изменении `zoom` (см. `InputSystem.onWheel`).
 *
 * Координатное пространство камеры: центр вьюпорта находится в мировой точке
 * `(x, y)`. Все спрайты/тайлы хранятся в мировых координатах; transform камеры
 * применяется к общему `worldContainer` в {@link CameraRenderSystem}.
 */
export class CameraComponent extends Component {
  static readonly typeId = Symbol('CameraComponent');

  /** 🌍 X камеры в мировых координатах (центр экрана). */
  x = 0;

  /** 🌍 Y камеры в мировых координатах (центр экрана). */
  y = 0;

  /** 📏 Ширина viewport'а в пикселях (обычно `app.screen.width`). */
  viewportWidth = 0;

  /** 📏 Высота viewport'а в пикселях. */
  viewportHeight = 0;

  // === FOLLOW ===

  /** 🎯 Id entity, за которой камера следует, или `null` (статичная). */
  target: number | null = null;

  /** 🧈 Коэффициент плавности следования (больше = жёстче, frame-rate independent). */
  smoothing = 8;

  // === ZOOM (rubber-band) ===

  /** 🔍 Текущий видимый зум. Может на короткое время выходить за `[minZoom, maxZoom]`. */
  zoom = 1;

  /** 🎯 Целевой зум, к которому пружинит `zoom`. Всегда в пределах `[minZoom, maxZoom]`. */
  zoomRest = 1;

  /** 💨 Скорость изменения `zoom` (для пружинной анимации). */
  zoomVelocity = 0;

  /** 📐 Минимальный зум (камера максимально далеко от сцены). */
  minZoom = 0.5;

  /** 📐 Максимальный зум (камера максимально близко к сцене). */
  maxZoom = 2;

  /** 🧈 Жёсткость пружины зума. Больше = быстрее возвращается к лимиту. */
  // zoomSpringK = 80;
  zoomSpringK = 80;

  /** 🛑 Коэффициент демпфирования пружины зума. Больше = меньше колебаний. */
  // zoomDamping = 14;
  zoomDamping = 28;

  /** 🖱️ Чувствительность колеса мыши. Больше = сильнее реагирует на один тик.
   *  В {@link InputSystem.onWheel} дополнительно клампится итоговый множитель
   *  за один event (MIN_FACTOR = 0.85). */
  zoomSensitivity = 0.0012;

  /** 🛡️ Допустимый overshoot `cam.zoom` за лимиты `[minZoom, maxZoom]`.
   *  Мультипликативный фактор: `0` = hard cap (нельзя превысить ни на сколько),
   *  `0.3` = можно уйти до `[minZoom × 0.7, maxZoom × 1.3]`,
   *  `1.0` = можно уйти до `[0, maxZoom × 2]`.
   *  Используется в {@link InputSystem.onWheel} как safety-net:
   *  rubber-band растяжение жёстко ограничено этим фактором, чтобы зум
   *  не "улетал" в космос при серии wheel-событий. */
  zoomOvershoot = 0;

  /** ⏱️ Сколько секунд камера может оставаться в overshoot-диапазоне без скролла,
   *  прежде чем её "отпустит" обратно к лимиту. Логика:
   *  - Камера входит в overshoot (`zoom > maxZoom` или `zoom < minZoom`) — таймер
   *    начинает считать (`CameraSystem`).
   *  - Каждый wheel-event в overshoot сбрасывает таймер в `0` (`InputSystem`).
   *    Пока юзер скроллит — камера "прилипает" в overshoot.
   *  - Через `zoomHoldTime` секунд без скролла — камера "отпускается"
   *    (`zoom = zoomRest`, snap к лимиту).
   *  - Стоит камере уйти из overshoot — таймер сбрасывается в `0`. */
  zoomHoldTime = 0.5;

  /** ⏱️ Текущий счётчик пребывания в overshoot-диапазоне без wheel-событий (сек).
   *  Управляется `InputSystem` (сброс в `0` на wheel) и `CameraSystem`
   *  (инкремент пока в overshoot, snap при достижении `zoomHoldTime`). */
  zoomPushTimer = 0;

  // === BOUNDS ===

  /** 🗺️ Минимальный X мира, за который камера не выйдет. */
  worldMinX = -Infinity;

  /** 🗺️ Минимальный Y мира. */
  worldMinY = -Infinity;

  /** 🗺️ Максимальный X мира. */
  worldMaxX = Infinity;

  /** 🗺️ Максимальный Y мира. */
  worldMaxY = Infinity;

  // === ZOOM-ANCHOR OFFSET ===

  /**
   * 🎯 Смещение камеры относительно `target`, введённое wheel-anchor-коррекцией.
   *
   * При скролле колеса `ZoomController` сдвигает камеру так, чтобы точка мира
   * под курсором оставалась под курсором. Это смещение (`cam.x - target.x`)
   * сохраняется здесь, чтобы `CameraSystem.follow` (snap) мог применить его
   * без сглаживания — иначе follow стирал бы anchor каждый кадр и камера
   * «улетала» бы к точке под курсором при непрерывном скролле.
   *
   * Стирание: плавный decay в `CameraSystem` после `zoomPushTimer >= zoomHoldTime`
   * (камера возвращается на target, когда пользователь перестал скроллить).
   */
  anchorOffsetX = 0;

  /** 🎯 То же по Y. */
  anchorOffsetY = 0;
}
