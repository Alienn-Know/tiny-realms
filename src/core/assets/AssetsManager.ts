import { Assets, type AssetsManifest } from 'pixi.js';
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
 */
export class AssetsManager {
  static #config: LoadConfig | null = null;
  static #initialized = false;
  /** 🗺️ Кеш загруженных текстур: alias → Texture. */
  static #textures: Record<string, unknown> = {};

  /** 🖼️ Получить все загруженные текстуры (alias → Texture). */
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

  /** 📦📦 Загрузить все бандлы из конфига. */
  static async loadAll(onProgress?: (p: number) => void): Promise<void> {
    if (!this.#config) throw new Error('[AssetsManager] No config loaded. Call loadConfig() first.');
    const aliases = Object.keys(this.#config.bundles);
    this.#textures = await Assets.loadBundle(aliases, onProgress);
  }

  /** 🖼️ Получить текстуру по alias (для спрайтов/tileset). */
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
