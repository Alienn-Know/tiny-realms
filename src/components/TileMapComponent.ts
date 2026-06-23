import { Container } from 'pixi.js';
import { Component } from '../core/ecs';
import type { MapData, TileLayerData, TilesetData } from '../map/MapData';
import { TiledMapLoader } from '../map/TiledMapLoader';
import { unpackFlipFlags } from '../map/utils/gid';

/**
 * ⚠️ `TileMapComponent` создаёт **собственный** `Container` для тайлов.
 * Нельзя передавать сюда `worldContainer` — это создаст цикл в scene graph
 * (`worldContainer.addChild(worldContainer)`) и вызовет бесконечную рекурсию
 * при обходе графа сцены (bounds/transform/render → stack overflow).
 */

/**
 * 🗺️ Данные тайловой карты — компонент ECS (живёт в `World`).
 *
 * Multi-layer поддержка: хранит массив слоёв, каждый со своими `data`/`flipFlags`/`width`/`height`.
 * Infinite maps: слои могут иметь `chunkOffsetX/Y` (смещение в тайлах относительно мира).
 * Collision: `isWalkableAt` проверяет **все** слои (top-most non-empty gid определяет
 * проходимость — если **любой** слой в точке имеет непроходимый тайл, точка блокирована).
 *
 * Конвенция: `TransformComponent` для таймапа не нужен — позиция = (0, 0),
 * `worldContainer` сам позиционируется камерой.
 */
export class TileMapComponent extends Component {
  static readonly typeId = Symbol('TileMapComponent');

  /** 🗺️ Tile layers (z-порядок = индекс в массиве). */
  layers: TileLayerData[];

  /** ↔️ Ширина карты в тайлах (общий bounding box). */
  width: number;

  /** ↕️ Высота карты в тайлах. */
  height: number;

  /** 📏 Размер тайла в пикселях. */
  tileWidth: number;

  /** 📏 Размер тайла в пикселях (Y). */
  tileHeight: number;

  /** ↔️ Глобальное смещение карты в пикселях (для infinite maps с neg chunk coords). */
  offsetX: number;

  /** ↕️ Глобальное смещение карты в пикселях. */
  offsetY: number;

  /** 🗂️ Тайлсеты (для resolveGid → texture). */
  tilesets: TilesetData[];

  /** 🚧 `gid → walkable` (быстрый lookup, default true). */
  walkableByGid: Map<number, boolean>;

  /** 🖼️ Pixi-контейнер, в котором лежат sprite-тайлы (контейнер на каждый слой). */
  container: Container;

  /** 🏁 Флаг: компонент изменился, нужно перерисовать. */
  dirty: boolean = true;

  /** 🪃 Per-tile animation state: `layerIndex|tileIndex → { frameIndex, accumMs }`. */
  #animationState: Map<string, { frameIndex: number; accumMs: number }> = new Map();

  constructor(mapData: MapData) {
    super();
    if (mapData.tileLayers.length === 0) {
      throw new Error('[TileMapComponent] mapData has no tile layers');
    }

    this.layers = mapData.tileLayers;
    this.width = mapData.width;
    this.height = mapData.height;
    this.tileWidth = mapData.tileWidth;
    this.tileHeight = mapData.tileHeight;
    this.offsetX = mapData.offsetX;
    this.offsetY = mapData.offsetY;
    this.tilesets = mapData.tilesets;
    this.walkableByGid = this.#buildWalkableByGid();
    this.container = new Container();
    // ⚠️ Не сдвигаем container на offsetX — каждый слой позиционируется
    // самостоятельно через chunkOffsetX/Y (иначе двойное смещение).
    this.container.x = 0;
    this.container.y = 0;
  }

  /** 🚧 Строит `gid → walkable` из всех тайлсетов. */
  #buildWalkableByGid(): Map<number, boolean> {
    const map = new Map<number, boolean>();
    for (const ts of this.tilesets) {
      ts.walkableByLocalId.forEach((walkable: boolean, localId: number) => {
        map.set(ts.firstgid + localId, walkable);
      });
    }
    return map;
  }

  /** 🔍 gid → walkable? Используется `CollisionGrid`. */
  isGidWalkable(gid: number): boolean {
    if (gid === 0) return true;
    return this.walkableByGid.get(gid) ?? true;
  }

  /** 🌍 Пиксель мира → координаты тайла (для collision queries).
   * Контейнер карты не сдвинут, тайлы в натуральных мировых координатах. */
  worldToTile(wx: number, wy: number): { tx: number; ty: number } {
    return {
      tx: Math.floor(wx / this.tileWidth),
      ty: Math.floor(wy / this.tileHeight),
    };
  }

  /** ✅ Точка в мире проходима?
   *
   * Проверяет **все** слои: если любой слой в точке имеет непроходимый тайл,
   * точка блокирована (поведение Tiled: walls поверх ground).
   *
   * ⚠️ gid берётся без флагов трансформации (флаги не влияют на проходимость).
   * Учитывает per-layer chunkOffset для infinite maps.
   */
  isWalkableAt(wx: number, wy: number): boolean {
    // Глобальные bounds карты (с учётом offset)
    const worldMinX = this.offsetX;
    const worldMinY = this.offsetY;
    const worldMaxX = this.offsetX + this.width * this.tileWidth;
    const worldMaxY = this.offsetY + this.height * this.tileHeight;
    if (wx < worldMinX || wy < worldMinY || wx >= worldMaxX || wy >= worldMaxY) {
      return false;
    }
    const { tx, ty } = this.worldToTile(wx, wy);
    // Top-most non-empty gid приоритетен, но непроходимый тайл в любом слое блокирует
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      // Переводим глобальные tile coords в layer-local coords (с учётом chunkOffset)
      const localTx = tx - layer.chunkOffsetX;
      const localTy = ty - layer.chunkOffsetY;
      if (localTx < 0 || localTy < 0 || localTx >= layer.width || localTy >= layer.height) continue;
      const idx = localTy * layer.width + localTx;
      const gid = layer.data[idx];
      if (gid === 0) continue;
      return this.isGidWalkable(gid);
    }
    return true; // все слои пусты — проходимо
  }

  /** 🪃 Обновить анимацию одного тайла (вызывается из `TileAnimationSystem`).
   * Обходит все слои, продвигает анимацию каждого анимированного тайла.
   * @param layerLocalIndex - индекс тайла ВНУТРИ слоя (ty * layer.width + tx)
   * @param layerIndex - индекс слоя
   * @returns новый localId если кадр сменился, иначе null
   */
  advanceAnimation(layerLocalIndex: number, layerIndex: number, dtMs: number): number | null {
    const layer = this.layers[layerIndex];
    if (!layer) return null;
    if (layerLocalIndex < 0 || layerLocalIndex >= layer.data.length) return null;

    const gid = layer.data[layerLocalIndex];
    if (gid === 0) return null;
    const resolved = TiledMapLoader.resolveGid(gid, this.tilesets);
    if (!resolved) return null;
    const anim = resolved.tileset.animationsByLocalId.get(resolved.localId);
    if (!anim) return null;

    const stateKey = `${layerIndex}|${layerLocalIndex}`;
    let state = this.#animationState.get(stateKey);
    if (!state) {
      state = { frameIndex: 0, accumMs: 0 };
      this.#animationState.set(stateKey, state);
    }
    state.accumMs += dtMs;
    const currentFrame = anim.frames[state.frameIndex];
    if (state.accumMs >= currentFrame.durationMs) {
      state.accumMs -= currentFrame.durationMs;
      state.frameIndex = (state.frameIndex + 1) % anim.frames.length;
      this.dirty = true;
      return anim.frames[state.frameIndex].localId;
    }
    return null;
  }

  /** 🏷️ Текущий frame localId для конкретного слоя (или текущий gid).
   *
   * Возвращает localId для **указанного слоя**, с учётом анимации.
   * Если тайл в этом слое пуст (gid=0) — возвращает null.
   *
   * @param layerLocalIndex - индекс тайла ВНУТРИ слоя (ty * layer.width + tx)
   * @param layerIndex - индекс слоя
   */
  getCurrentLocalId(layerLocalIndex: number, layerIndex: number): number | null {
    const layer = this.layers[layerIndex];
    if (!layer) return null;
    if (layerLocalIndex < 0 || layerLocalIndex >= layer.data.length) return null;

    const gid = layer.data[layerLocalIndex];
    if (gid === 0) return null;

    const resolved = TiledMapLoader.resolveGid(gid, this.tilesets);
    if (!resolved) return null;

    const stateKey = `${layerIndex}|${layerLocalIndex}`;
    const state = this.#animationState.get(stateKey);
    if (!state) return resolved.localId;
    const anim = resolved.tileset.animationsByLocalId.get(resolved.localId);
    if (!anim) return resolved.localId;
    return anim.frames[state.frameIndex].localId;
  }

  /** 🔄 Флаги трансформации тайла (hFlip/vFlip/diagRot) для конкретного слоя.
   * @param layerIndex - индекс слоя
   * @param layerLocalIndex - индекс тайла ВНУТРИ слоя (ty * layer.width + tx)
   */
  getFlipFlags(layerIndex: number, layerLocalIndex: number): { hFlip: boolean; vFlip: boolean; diagRot: boolean } {
    const layer = this.layers[layerIndex];
    if (!layer) return { hFlip: false, vFlip: false, diagRot: false };
    if (layerLocalIndex < 0 || layerLocalIndex >= layer.flipFlags.length) {
      return { hFlip: false, vFlip: false, diagRot: false };
    }
    const flags = layer.flipFlags[layerLocalIndex] ?? 0;
    return unpackFlipFlags(flags);
  }

  /** 🗺️ Количество tile-слоёв. */
  get layerCount(): number {
    return this.layers.length;
  }
}
