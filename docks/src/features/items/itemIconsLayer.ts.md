# itemIconsLayer.ts.md

> Автогенерируемая карточка исходного файла.

## 🌟 Для чего нужен

Нужен как отдельный модуль, который решает свою локальную задачу внутри проекта.

## 🍎 Принцип

Работает как локальный модуль проекта: получает входные данные, подготавливает результат и отдает его другим частям приложения.


## 🧩 Методы

- В этом файле нет явных именованных методов верхнего уровня.

## 👥 Связи

- 👤 Родительский модуль: [`src/features/items`](README.md)
- 📄 Исходный файл: [`itemIconsLayer.ts`](../../../../src/features/items/itemIconsLayer.ts)

### 🍎 Зависит от

- 🍎 `assets/icons16Atlas.ts`
- 🍎 `components/draggableIcons.ts`
- 🍎 `features/items/itemData.ts`
- 🍎 `features/items/itemInfoPanel.ts`

```mermaid
flowchart LR
    file_features_items_itemIconsLayer_ts["features/items/itemIconsLayer.ts"]
    file_features_items_itemIconsLayer_ts --> file_dependsOn_assets_icons16Atlas_ts["assets/icons16Atlas.ts"]
    file_features_items_itemIconsLayer_ts --> file_dependsOn_components_draggableIcons_ts["components/draggableIcons.ts"]
    file_features_items_itemIconsLayer_ts --> file_dependsOn_features_items_itemData_ts["features/items/itemData.ts"]
    file_features_items_itemIconsLayer_ts --> file_dependsOn_features_items_itemInfoPanel_ts["features/items/itemInfoPanel.ts"]
```

### 🍑 Используется в

- 🍑 `main.ts`

```mermaid
flowchart LR
    file_features_items_itemIconsLayer_ts["features/items/itemIconsLayer.ts"]
    file_usedBy_main_ts["main.ts"] --> file_features_items_itemIconsLayer_ts
```
