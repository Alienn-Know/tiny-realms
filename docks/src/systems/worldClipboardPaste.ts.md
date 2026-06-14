# worldClipboardPaste.ts.md

> Автогенерируемая карточка исходного файла.

## 🌟 Для чего нужен

Нужен как отдельный модуль, который решает свою локальную задачу внутри проекта.

## 🍎 Принцип

Работает как локальный модуль проекта: получает входные данные, подготавливает результат и отдает его другим частям приложения.


## 🧩 Методы

- В этом файле нет явных именованных методов верхнего уровня.

## 👥 Связи

- 👤 Родительский модуль: [`src/systems`](README.md)
- 📄 Исходный файл: [`worldClipboardPaste.ts`](../../../src/systems/worldClipboardPaste.ts)

### 🍎 Зависит от

- 🍎 `features/fonts/gameBitmapText.ts`

```mermaid
flowchart LR
    file_systems_worldClipboardPaste_ts["systems/worldClipboardPaste.ts"]
    file_systems_worldClipboardPaste_ts --> file_dependsOn_features_fonts_gameBitmapText_ts["features/fonts/gameBitmapText.ts"]
```

### 🍑 Используется в

- 🍑 `main.ts`

```mermaid
flowchart LR
    file_systems_worldClipboardPaste_ts["systems/worldClipboardPaste.ts"]
    file_usedBy_main_ts["main.ts"] --> file_systems_worldClipboardPaste_ts
```
