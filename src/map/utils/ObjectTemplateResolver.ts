/**
 * 📋 ObjectTemplateResolver — резолв templates объектов.
 *
 * Tiled template — это файл (.txj для JSON, .tx для XML) с дефолтами объекта.
 * Инстанс объекта в карте ссылается на template через `template: "path/to/template.txj"`.
 *
 * Merge semantics (по спеке Tiled):
 * - Поля инстанса приоритетнее полей темплейта.
 * - `properties` мерджатся: property с тем же name у инстанса перезаписывает темплейтный.
 * - `x, y` инстанса прибавляются к `x, y` темплейта? Нет — инстанс хранит абсолютные
 *   координаты, темплейтовые игнорируются при наличии у инстанса.
 *
 * Поддерживаем только JSON (.txj). XML (.tx) — warn + объект без template defaults.
 */

import type { TiledObject, TiledObjectTemplate, TiledProperty } from '../TiledTypes';

/** 🗂️ Cache: template path → resolved template object. */
const templateCache = new Map<string, TiledObjectTemplate>();

/** 🔗 Резолвить относительный путь template от пути карты. */
function resolveTemplatePath(mapUrl: string, template: string): string {
  return new URL(template, new URL(mapUrl, location.href)).href;
}

/** 📥 Загрузить template-файл (.txj). */
async function loadTemplate(mapUrl: string, templatePath: string): Promise<TiledObjectTemplate> {
  const cached = templateCache.get(templatePath);
  if (cached) return cached;

  const lower = templatePath.toLowerCase();
  if (lower.endsWith('.tx') && !lower.endsWith('.txj')) {
    console.warn(
      `[ObjectTemplateResolver] XML-формат templates (.tx) не поддерживается. ` +
        `Объект будет загружен без template defaults. ` +
        `Экспортируйте template как .txj в Tiled.`,
    );
    const stub: TiledObjectTemplate = { type: 'template', object: { id: -1, x: 0, y: 0, width: 0, height: 0 } };
    templateCache.set(templatePath, stub);
    return stub;
  }

  const url = resolveTemplatePath(mapUrl, templatePath);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `[ObjectTemplateResolver] Failed to load template: ${res.status} ${url}`,
    );
  }
  const tpl = (await res.json()) as TiledObjectTemplate;
  templateCache.set(templatePath, tpl);
  return tpl;
}

/** 🔀 Мердж properties: инстанс перезаписывает темплейт по name. */
function mergeProperties(base: TiledProperty[] = [], override: TiledProperty[] = []): TiledProperty[] {
  const map = new Map<string, TiledProperty>();
  for (const p of base) map.set(p.name, p);
  for (const p of override) map.set(p.name, p);
  return Array.from(map.values());
}

/** 🔀 Мердж object: инстанс приоритетнее, properties мерджятся. */
function mergeObject(base: TiledObject, instance: TiledObject): TiledObject {
  const out: TiledObject = {
    ...base,
    ...instance,
    // Сохраняем id инстанса (не темплейта)
    id: instance.id,
  };
  // Properties мерджатся по name
  if (base.properties || instance.properties) {
    out.properties = mergeProperties(base.properties, instance.properties);
  }
  // template-поле очищаем — резолв выполнен
  out.template = undefined;
  return out;
}

/** 🔧 Резолвить template у объекта. Если template нет — возвращает как есть. */
export async function resolveTemplate(mapUrl: string, obj: TiledObject): Promise<TiledObject> {
  if (!obj.template) return obj;
  const tpl = await loadTemplate(mapUrl, obj.template);
  return mergeObject(tpl.object, obj);
}

/** 🔧 Резолвить templates у списка объектов (параллельно). */
export async function resolveAllTemplates(
  mapUrl: string,
  objects: TiledObject[],
): Promise<TiledObject[]> {
  return Promise.all(objects.map((o) => resolveTemplate(mapUrl, o)));
}

/** 🧹 Очистить кеш templates (для hot-reload/смены карты). */
export function clearTemplateCache(): void {
  templateCache.clear();
}
