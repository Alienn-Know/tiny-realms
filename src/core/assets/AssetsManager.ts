import { Assets, Spritesheet, type AssetsManifest, type Texture } from 'pixi.js';
import type { LoadConfig } from './AssetsConfig';

/**
 * 🗂️ AssetsManager — config-driven обёртка над Pixi Assets.
 *
 * Заменяет старый `manifest.ts`. Конфиг ассетов грузится из
 * `public/load-config.json` в runtime, не хардкодится в TS.
 *
 * Использование:
 * ```ts
 * const config = await AssetsManager.loadConfig();
 * await AssetsManager.init(config);
 * await AssetsManager.loadAll(progress => loading.setProgress(progress));
 * const tex = AssetsManager.getTexture('player');
 * ```
 *
 * Поддерживаемые типы бандлов (см. {@link LoadConfig}):
 * - `sprite` — одиночная текстура → `Texture`
 * - `tileset` — одиночная текстура (для тайлсетов) → `Texture`
 * - `spritesheet` — атлас → `Spritesheet` (image + JSON descriptor)
 */
export class AssetsManager {
  static #config: LoadConfig | null = null;
  static #initialized = false;
  /** 🗺️ Кеш загруженных ресурсов: alias → Texture | Spritesheet. */
  static #textures: Record<string, unknown> = {};

  /** 🖼️ Получить все загруженные ресурсы (alias → Texture | Spritesheet). */
  static getAllTextures(): Record<string, unknown> {
    return this.#textures;
  }

  /** 📥 Загрузить `load-config.json` (fetch). */
  static async loadConfig(url = 'load-config.json'): Promise<LoadConfig> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`[AssetsManager] Failed to load config: ${res.status} ${url}`);
    this.#config = (await res.json()) as LoadConfig;
    return this.#config;
  }

  /** 🔧 Инициализировать Pixi Assets манифестом, сгенерированным из конфига. */
  static async init(config: LoadConfig): Promise<void> {
    if (this.#initialized) return;
    this.#config = config;
    const manifest = this.#toManifest(config);
    await Assets.init({ manifest });
    this.#initialized = true;
  }

  /** 📦 Загрузить один бандл (alias). Возвращает записи (alias → texture). */
  static async loadBundle(alias: string, onProgress?: (p: number) => void): Promise<Record<string, unknown>> {
    return Assets.loadBundle(alias, onProgress);
  }

  /**
   * 📦📦 Загрузить все бандлы из конфига.
   *
   * Для каждого бандла:
   * - `sprite`/`tileset` → грузим через `Assets.loadBundle` (возвращает Texture)
   * - `spritesheet` → собираем `Spritesheet` вручную из image + JSON
   *   (`Assets.loadBundle` для spritesheet-бандлов в Pixi v8 возвращает
   *   `{ 'alias-image': Texture, 'alias-data': JSON }`, а не готовый Spritesheet)
   */
  static async loadAll(onProgress?: (p: number) => void): Promise<void> {
    if (!this.#config) throw new Error('[AssetsManager] No config loaded. Call loadConfig() first.');

    const bundles = this.#config.bundles;
    const aliases = Object.keys(bundles);
    const total = aliases.length;
    let done = 0;

    const textures: Record<string, unknown> = {};
    for (const alias of aliases) {
      const bundle = bundles[alias];
      if (bundle.type === 'spritesheet') {
        textures[alias] = await AssetsManager.#loadSpritesheet(bundle.image, bundle.data);
      } else {
        const result = await Assets.loadBundle(alias);
        textures[alias] = result[alias];
      }
      done += 1;
      onProgress?.(done / total);
    }
    this.#textures = textures;
  }

  /**
   * 🎞️ Собрать `Spritesheet` из пары image + JSON descriptor.
   * Возвращает `Spritesheet` (parse() дожидается завершения нарезки кадров).
   */
  static async #loadSpritesheet(imagePath: string, dataPath: string): Promise<Spritesheet> {
    const [image, json] = await Promise.all([
      Assets.load<Texture>(imagePath),
      fetch(dataPath).then((r) => r.json()),
    ]);
    const sheet = new Spritesheet({ texture: image.source, data: json });
    await sheet.parse();
    return sheet;
  }

  /** 🖼️ Получить ресурс по alias (Texture или Spritesheet). */
  static getTexture(alias: string): unknown {
    return this.#textures[alias];
  }

  /** 🗺️ Получить конфиг тайлмапа по имени. */
  static getTilemapConfig(name: string) {
    return this.#config?.tilemaps.find((t) => t.name === name);
  }

  /** 📋 Получить весь конфиг (для TiledMapLoader, ObjectSpawner). */
  static getConfig(): LoadConfig | null {
    return this.#config;
  }

  /** 🔄 Конвертирует LoadConfig → Pixi AssetsManifest (внутренний формат). */
  static #toManifest(config: LoadConfig): AssetsManifest {
    const bundles: AssetsManifest['bundles'] = [];

    for (const [alias, bundle] of Object.entries(config.bundles)) {
      switch (bundle.type) {
        case 'tileset':
        case 'sprite':
          bundles.push({
            name: alias,
            assets: { [alias]: bundle.path },
          });
          break;
        case 'spritesheet':
          // Регистрируем оба ассета в бандле — но `loadAll` использует
          // прямой `Assets.load` для image и `fetch` для JSON, минуя loadBundle.
          bundles.push({
            name: alias,
            assets: {
              [alias + '-image']: bundle.image,
              [alias + '-data']: bundle.data,
            },
          });
          break;
      }
    }

    return { bundles };
  }
}
