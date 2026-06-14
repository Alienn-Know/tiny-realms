# Tiny Realms

Top-down pixel game на **TypeScript + PixiJS v8**. Развивается по плану из [`plan/plan.md`](./plan/plan.md).

## Фаза 0 — Готова ✅

Каркас проекта: `Vite + Pixi v8 + ECS + GameLoop`.

- [x] `Vite` + `TypeScript`
- [x] `PixiJS v8`
- [x] Самописный **ECS**: `World`, `Entity`, `Component`, `System`
- [x] **GameLoop** на `requestAnimationFrame` с fixed timestep (`60 TPS`)
- [x] **Интерполяция** между тиками для плавного рендера
- [x] Компоненты: `Transform`, `Velocity`, `Sprite`
- [x] Системы: `MovementSystem`, `BoundarySystem`, `RenderSystem`
- [x] Тестовая сущность: движущийся квадрат с отскоком от границ

## Структура

```
src/
├── core/
│   ├── ecs/              # Entity-Component-System
│   │   ├── World.ts
│   │   ├── Entity.ts
│   │   ├── Component.ts
│   │   ├── System.ts
│   │   └── index.ts
│   └── loop/
│       └── GameLoop.ts   # fixed timestep + interpolation
├── components/           # игровые компоненты
├── systems/              # игровые системы
├── app/
│   └── bootstrap.ts      # создание Pixi Application
├── main.ts               # точка входа
├── style.css
└── vite-env.d.ts
```

## Быстрый старт

```bash
npm install
npm run dev
```

## Скрипты

- `npm run dev` — dev-сервер
- `npm run build` — сборка
- `npm run preview` — превью сборки

## План

См. [`plan/plan.md`](./plan/plan.md).

Следующий шаг — **Фаза 1: Tiled-загрузчик + камера + 8-направленное движение**.
