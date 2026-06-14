# uiMiniAtlas.ts.md

> Автогенерируемая карточка исходного файла.

## 🌟 Для чего нужен

Нужен для хранения координат, текстур или helper-логики, связанной с ассетами.

## 🍎 Принцип

Работает как слой доступа к ассетам: хранит данные о ресурсах и отдает их в удобной для других модулей форме.


## 🧩 Методы

- В этом файле нет явных именованных методов верхнего уровня.

## 🔑 Ключевые константы

### `uiMiniFrames`

- Значение: `{ confirmIdle: { col: 0, row: 0 }, confirmPressed: { col: 1, row: 0 }, panelTopLeft: { ...`
- Для чего нужен: Нужна как опорная константа файла: хранит значение, с которым работает остальная логика.

### `frameTexturePromises`

- Значение: `new Map<UiMiniFrameName, Promise<Texture>>()`
- Для чего нужен: Нужна как опорная константа файла: хранит значение, с которым работает остальная логика.

## 👥 Связи

- 👤 Родительский модуль: [`src/assets`](README.md)
- 📄 Исходный файл: [`uiMiniAtlas.ts`](../../../src/assets/uiMiniAtlas.ts)

### 🍎 Зависит от

- 🍎 Нет прямых локальных зависимостей.

### 🍑 Используется в

- 🍑 `components/uiButton.ts`
- 🍑 `components/uiWindow.ts`
- 🍑 `features/ui/contextMenu.ts`

```mermaid
flowchart LR
    file_assets_uiMiniAtlas_ts["assets/uiMiniAtlas.ts"]
    file_usedBy_components_uiButton_ts["components/uiButton.ts"] --> file_assets_uiMiniAtlas_ts
    file_usedBy_components_uiWindow_ts["components/uiWindow.ts"] --> file_assets_uiMiniAtlas_ts
    file_usedBy_features_ui_contextMenu_ts["features/ui/contextMenu.ts"] --> file_assets_uiMiniAtlas_ts
```
