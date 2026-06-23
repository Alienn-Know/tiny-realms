# 📷 src/systems/camera

Камерные утилиты — общая логика, переиспользуемая между устройствами ввода.

## 📦 Файлы

- **`ZoomController.ts`** — чистая функция зума камеры с anchor-точкой. Общий для wheel (мышь) и pinch (touch). Инкапсулирует anchor-коррекцию, factor clamp, overshoot elastic cap, `zoomPushTimer` reset. Не подписывается на events — вызывается из `CameraInputSystem` / `TouchCameraInputSystem`.

## 🎯 Принципы

- **DRY** — zoom-math в одном месте, оба устройства ввода используют её
- **SRP** — `ZoomController` не знает про wheel/touch, только про математику зума
- **Тестируемость** — чистая функция без side-effects кроме мутации `CameraComponent`
