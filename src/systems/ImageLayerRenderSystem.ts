import { Container, Sprite, TilingSprite } from 'pixi.js';
import { System, World } from '../core/ecs';
import { CameraComponent } from '../components/CameraComponent';
import type { ImageLayerData, MapData } from '../map/MapData';

/**
 * 🖼️ ImageLayerRenderSystem — рендерит image-слои Tiled (фон/параллакс).
 *
 * Image layer — это одна PNG-картинка, которая рисуется целиком (не тайлится),
 * если не задан `repeatX`/`repeatY` (тогда `TilingSprite`).
 *
 * Parallax: позиция слоя модифицируется каждый кадр по `cameraComp.x * parallaxX`.
 * `parallaxX = 1` — двигается вместе с миром (по умолчанию);
 * `parallaxX = 0.5` — вдвое медленнее (эффект дальнего фона).
 */
export class ImageLayerRenderSystem extends System {
  #worldContainer: Container;
  #mapData: MapData;
  /** 🖼️ Созданные спрайты image-слоёв (для parallax-апдейта в update). */
  #layerViews: { view: Sprite | TilingSprite; data: ImageLayerData }[] = [];
  #initialized = false;

  constructor(worldContainer: Container, mapData: MapData) {
    super();
    this.#worldContainer = worldContainer;
    this.#mapData = mapData;
  }

  update(world: World): void {
    if (!this.#initialized) {
      this.#buildViews();
      this.#initialized = true;
    }

    // Parallax: обновляем позиции по камере
    const camEntities = world.getEntitiesWith(CameraComponent);
    if (camEntities.length === 0) return;
    const cam = world.getComponent(camEntities[0], CameraComponent)!;

    for (const { view, data } of this.#layerViews) {
      // Parallax factor: 1 = обычный мир, <1 = медленнее (дальний фон)
      const px = data.parallaxX;
      const py = data.parallaxY;
      // Сдвиг слоя: base offset + parallax-компенсация
      // worldContainer уже сдвинут камерой, но parallax-слои двигаются медленнее.
      // Чтобы parallax работал, слой должен быть ВНЕ worldContainer (поверх него).
      // Здесь — упрощённая версия: слой внутри worldContainer, parallax через scale offset.
      view.x = data.offsetX + cam.x * (1 - px);
      view.y = data.offsety + cam.y * (1 - py);
    }
  }

  /** 🏗️ Создать спрайты для всех image-слоёв (один раз). */
  #buildViews(): void {
    for (const layer of this.#mapData.imageLayers) {
      if (!layer.visible) continue;

      let view: Sprite | TilingSprite;
      if (layer.repeatX || layer.repeatY) {
        // TilingSprite для repeat
        view = new TilingSprite({
          texture: layer.texture,
          width: layer.repeatX ? this.#mapData.width * this.#mapData.tileWidth : layer.imagewidth,
          height: layer.repeatY ? this.#mapData.height * this.#mapData.tileHeight : layer.imageheight,
        });
      } else {
        view = new Sprite(layer.texture);
      }

      view.x = layer.offsetX;
      view.y = layer.offsety;
      view.alpha = layer.opacity;
      if (layer.tintColor) view.tint = layer.tintColor;

      // Image layers ДОЛЖНЫ быть ВНЕ worldContainer для правильного parallax.
      // Но CameraRenderSystem двигает только worldContainer. Если поместить слой
      // ВНЕ него — нужно вручную применять camera transform (scale + position).
      // Временно кладём В worldContainer — parallax будет работать частично.
      this.#worldContainer.addChild(view);
      this.#layerViews.push({ view, data: layer });
    }
  }

  /** 🧹 Очистка ресурсов. */
  destroy(): void {
    for (const { view } of this.#layerViews) {
      view.destroy();
    }
    this.#layerViews = [];
    this.#initialized = false;
  }
}
