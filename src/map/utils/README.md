# 🗂️ src/map/utils

Утилиты для парсинга Tiled JSON-формата. Используются `TiledMapLoader`-ом.

## 📦 Файлы

- **`gid.ts`** — распаковка/запаковка флагов трансформации (hFlip/vFlip/diagRot) из Global Tile ID. Верхние 3 бита gid хранят флаги, остальные — local id внутри тайлсета.
- **`TileLayerDataDecoder.ts`** — декодинг данных tile-слоя в `Int32Array`. Поддерживает CSV, base64, base64+zlib, base64+gzip. zstd — skip с warn (нет нативной браузерной поддержки). Для infinite maps: `decodeChunk` + `flattenChunks`.
- **`ExternalTilesetLoader.ts`** — загрузка внешних тайлсетов (`tileset.source` указывает на отдельный JSON-файл). Резолвит относительные пути от URL карты. XML-формат (.tsx) не поддерживается — нужен JSON-экспорт.
- **`ObjectTemplateResolver.ts`** — резолв Tiled object templates (`.txj`). Merge semantics: поля инстанса приоритетнее темплейта, `properties` мерджатся по name. Кеширует загруженные темплейты. XML-формат (.tx) не поддерживается.

## 🎯 Принципы

- Без внешних зависимостей — только browser API (`fetch`, `atob`, `DecompressionStream`, `URL`).
- Все функции async (I/O-bound операции).
- При unsupported форматах — warn + graceful degradation (не throw), где возможно.
