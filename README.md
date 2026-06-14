# Tiny Realms

Интерактивная визуализация на **TypeScript + PixiJS**. Проект развивается по плану из [`plan/plan.md`](./plan/plan.md).

## Фаза 0 — Готова ✅

Базовая подготовка перед прохождением плана:

- [x] Создан репозиторий `tiny-realms`
- [x] Настроен каркас `Vite + TypeScript`
- [x] Установлен `PixiJS v8`
- [x] Создана базовая структура `src/`: `app/`, `components/`, `utils/`, `assets/`
- [x] Написан минимальный `bootstrap` приложения
- [x] Отрисованы базовые фигуры: круг, квадрат, текст
- [x] Работает `npm run dev` и `npm run build`

## Структура

```
src/
├── app/
│   └── bootstrap.ts      # создание PixiJS Application
├── components/           # будущие компоненты сцены
├── utils/
│   └── constants.ts      # общие константы проекта
├── assets/               # ассеты проекта
├── main.ts               # точка входа
├── style.css             # базовые стили
└── vite-env.d.ts
```

## Быстрый старт

```bash
npm install
npm run dev
```

## Скрипты

- `npm run dev` — запуск dev-сервера
- `npm run build` — сборка
- `npm run preview` — превью сборки

## План

См. [`plan/plan.md`](./plan/plan.md).

Следующий шаг — **Фаза 1: Основы** (TypeScript + PixiJS).
