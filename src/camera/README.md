# 📷 src/camera

Камера в стиле Clash of Clans: follow за target, rubber-band зум, bounds clamp.

## 📦 Файлы

- **`CameraComponent.ts`** *(перенесён из `src/components/`)* — данные камеры: позиция, зум, target, bounds.
- **`CameraSystem.ts`** *(перенесён из `src/systems/`)* — per-frame логика: follow, zoom spring, bounds clamp.
- **`CameraInputSystem.ts`** *(перенесён из `src/systems/`)* — wheel → zoom.
- **`TouchCameraInputSystem.ts`** *(перенесён из `src/systems/`)* — pinch → zoom.
- **`CameraRenderSystem.ts`** *(перенесён из `src/systems/`)* — применяет `cam.{x,y,zoom}` к `worldContainer`.
- **`ZoomController.ts`** *(перенесён из `src/systems/camera/`)* — чистая статика: factor clamp, overshoot cap, timer reset.
- **`setupCamera.ts`** — composition root: создание entity, настройка дефолтов, bounds, resize handler.

## 🎯 Принципы

- **Single source of truth** — все параметры камеры (minZoom, overshoot, etc) в `src/config/camera.config.ts`.
- **Composition root** — `setupCamera()` инкапсулирует всю инициализацию, `main.ts` только вызывает.
- **DRY** — zoom-math в `ZoomController`, оба устройства ввода используют её.
- **SRP** — каждая система отвечает за одну вещь: ввод / логика / рендер.
