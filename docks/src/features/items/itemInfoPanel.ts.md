# itemInfoPanel.ts.md

> Автогенерируемая карточка исходного файла.

## 🌟 Для чего нужен

Нужен как отдельный модуль, который решает свою локальную задачу внутри проекта.

## 🍎 Принцип

Работает как локальный модуль проекта: получает входные данные, подготавливает результат и отдает его другим частям приложения.


## 🧩 Методы

- В этом файле нет явных именованных методов верхнего уровня.

## 🔑 Ключевые константы

### `ITEM_TYPEWRITER_MS`

- Значение: `36`
- Для чего нужен: Нужна как опорная константа файла: хранит значение, с которым работает остальная логика.

## 👥 Связи

- 👤 Родительский модуль: [`src/features/items`](README.md)
- 📄 Исходный файл: [`itemInfoPanel.ts`](../../../../src/features/items/itemInfoPanel.ts)

### 🍎 Зависит от

- 🍎 `components/NotebookPage.ts`
- 🍎 `features/fonts/gameBitmapText.ts`
- 🍎 `features/fonts/typewriterBitmapText.ts`
- 🍎 `features/items/itemData.ts`

```mermaid
flowchart LR
    file_features_items_itemInfoPanel_ts["features/items/itemInfoPanel.ts"]
    file_features_items_itemInfoPanel_ts --> file_dependsOn_components_NotebookPage_ts["components/NotebookPage.ts"]
    file_features_items_itemInfoPanel_ts --> file_dependsOn_features_fonts_gameBitmapText_ts["features/fonts/gameBitmapText.ts"]
    file_features_items_itemInfoPanel_ts --> file_dependsOn_features_fonts_typewriterBitmapText_ts["features/fonts/typewriterBitmapText.ts"]
    file_features_items_itemInfoPanel_ts --> file_dependsOn_features_items_itemData_ts["features/items/itemData.ts"]
```

### 🍑 Используется в

- 🍑 `features/items/itemIconsLayer.ts`

```mermaid
flowchart LR
    file_features_items_itemInfoPanel_ts["features/items/itemInfoPanel.ts"]
    file_usedBy_features_items_itemIconsLayer_ts["features/items/itemIconsLayer.ts"] --> file_features_items_itemInfoPanel_ts
```
