# itemData.ts.md

> Автогенерируемая карточка исходного файла.

## 🌟 Для чего нужен

Нужен как отдельный модуль, который решает свою локальную задачу внутри проекта.

## 🍎 Принцип

Работает как локальный модуль проекта: получает входные данные, подготавливает результат и отдает его другим частям приложения.


## 🧩 Методы

- В этом файле нет явных именованных методов верхнего уровня.

## 👥 Связи

- 👤 Родительский модуль: [`src/features/items`](README.md)
- 📄 Исходный файл: [`itemData.ts`](../../../../src/features/items/itemData.ts)

### 🍎 Зависит от

- 🍎 `assets/icons16Atlas.ts`

```mermaid
flowchart LR
    file_features_items_itemData_ts["features/items/itemData.ts"]
    file_features_items_itemData_ts --> file_dependsOn_assets_icons16Atlas_ts["assets/icons16Atlas.ts"]
```

### 🍑 Используется в

- 🍑 `features/items/itemIconsLayer.ts`
- 🍑 `features/items/itemInfoPanel.ts`

```mermaid
flowchart LR
    file_features_items_itemData_ts["features/items/itemData.ts"]
    file_usedBy_features_items_itemIconsLayer_ts["features/items/itemIconsLayer.ts"] --> file_features_items_itemData_ts
    file_usedBy_features_items_itemInfoPanel_ts["features/items/itemInfoPanel.ts"] --> file_features_items_itemData_ts
```
