/**
 * 🗂️ ExternalTilesetLoader — загрузка внешних тайлсетов (`.tsx`/`.json`).
 *
 * В Tiled JSON map тайлсет может быть:
 * 1. Inline — все поля прямо в map JSON (текущий путь)
 * 2. External — `{ firstgid, source: "path/to/tileset.json" }`,
 *    остальные поля грузятся из внешнего файла.
 *
 * Поддерживаем только JSON-формат внешних тайлсетов (export from Tiled as JSON).
 * XML-формат (.tsx) — warn + объект как есть (без tiles/animations).
 */

import type { TiledTileset } from '../TiledTypes';

/** 🔄 Мердж external tileset с inline-описанием из map. */
export function mergeExternalTileset(inline: TiledTileset, external: TiledTileset): TiledTileset {
  // firstgid — только из inline (в external его нет)
  return {
    ...external,
    firstgid: inline.firstgid,
    // source не нужен после резолва
    source: undefined,
  };
}

/** 🔗 Резолвить относительный путь external tileset от пути карты.
 * @param mapUrl - URL карты (например "maps/level1.json")
 * @param source - значение tileset.source (например "tilesets/terrain.json")
 * @returns абсолютный URL для fetch
 */
export function resolveTilesetPath(mapUrl: string, source: string): string {
  return new URL(source, new URL(mapUrl, location.href)).href;
}

/** 📥 Загрузить внешний тайлсет (JSON).
 * @throws если source указывает на .tsx (XML) — не поддерживаем.
 */
export async function loadExternalTileset(
  mapUrl: string,
  inline: TiledTileset,
): Promise<TiledTileset> {
  if (!inline.source) return inline;

  const lower = inline.source.toLowerCase();
  if (lower.endsWith('.tsx') || lower.endsWith('.xml')) {
    console.warn(
      `[ExternalTilesetLoader] XML-формат внешних тайлсетов (.tsx) не поддерживается. ` +
        `Тайлсет "${inline.source}" будет загружен без per-tile данных. ` +
        `Экспортируйте тайлсет как JSON в Tiled.`,
    );
    // Возвращаем минимальный инлайн без per-tile данных — текстуру загрузит loader по image
    return { ...inline };
  }

  const url = resolveTilesetPath(mapUrl, inline.source);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `[ExternalTilesetLoader] Failed to load external tileset: ${res.status} ${url}`,
    );
  }
  const external = (await res.json()) as TiledTileset;
  return mergeExternalTileset(inline, external);
}

/** 🔗 Резолвить список тайлсетов: external → loaded, inline → как есть. */
export async function resolveAllTilesets(
  mapUrl: string,
  tilesets: TiledTileset[],
): Promise<TiledTileset[]> {
  return Promise.all(
    tilesets.map((ts) => (ts.source ? loadExternalTileset(mapUrl, ts) : Promise.resolve(ts))),
  );
}
