import { Container, Graphics, Matrix, RenderTexture, Sprite, type Application } from 'pixi.js';

export type CreateWaterSurfaceOptions = {
  app: Application;
  world: Container;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  scale?: number;
  color?: number;
};

export type WaterSurface = {
  container: Container;
  update: () => void;
  destroy: () => void;
};

// ╔══════════════════════════════════════════════════════════════════╗
// ║  ⚡ ПРОИЗВОДИТЕЛЬНОСТЬ: рендер world в RenderTexture каждый кадр ║
// ╚══════════════════════════════════════════════════════════════════╝
//
// 💀 Стоимость одного вызова app.renderer.render({ container: world, ... }):
//
//   🔍 Обход дерева:   O(n) по числу объектов в world
//   ✂️  Frustum cull:   проверка для каждого объекта (PixiJS делает сам)
//   🎨 Draw calls:     не зависят от transform
//   🧮 transform:      6 float-uniform на батч → бесплатно на GPU
//   💾 Запись в FBO:   width × height пикселей (тут 256×64 = 16 384)
//
// 🚨 Главный оверхед — не сама запись в текстуру, а обход всего графа world.
//    При 2000 объектах рендерер обходит все 2000 ради полоски 256×64.
//
// ─────────────────────────────────────────────────────────────────────
// 🛠️ Стратегии оптимизации (от простых к продвинутым)
// ─────────────────────────────────────────────────────────────────────
//
// ① 🗺️ Spatial hash + ручной cull                            [ЛУЧШИЙ ROI]
//    Разбить сцену на клетки (cellSize ≈ 64-128 px), каждый объект
//    положить в свою клетку. Каждый кадр query по клеткам, попадающим
//    в [x, y-height]..[x+width, y]. Рендерить только найденные.
//
//      class SpatialHash { ... }
//      const visible = hash.query(new Rectangle(x, y - height, width, height));
//      app.renderer.render({ container: tempContainerWith(visible), ... });
//
// ② 📍 Только рядом стоящие
//    Наивный AABB-фильтр по позиции (без spatial hash):
//      obj.x >= x && obj.x <= x + width &&
//      obj.y >= y - height && obj.y <= y
//    Уберёт 99% объектов, если рядом с лужей реально 5-20 штук.
//
// ③ ⏱️ Рендерить реже + интерполяция ripples
//    Отражение не обязано обновляться 60 раз в секунду. Достаточно 15-20 fps:
//
//      let lastReflectionTime = 0;
//      const REFLECTION_INTERVAL = 50; // ms
//      function update(time: number) {
//        if (time - lastReflectionTime >= REFLECTION_INTERVAL) {
//          lastReflectionTime = time;
//          app.renderer.render({ /* ... */ });
//        }
//        // ripples обновляются на 60 fps — это дёшево
//      }
//
// ④ 📸 Предрендер по хешу сцены
//    Если игрок/мобы стоят — вообще не рендерить:
//
//      let sceneHash = '';
//      const currentHash = hashNearbyState(); // x,y ближайших
//      if (currentHash !== sceneHash) {
//        sceneHash = currentHash;
//        app.renderer.render({ /* ... */ });
//      }
//
// ⑤ 🔬 Понизить разрешение текстуры (самый дешёвый выигрыш):
//
//      const renderTexture = RenderTexture.create({
//        width, height,
//        resolution: 0.5, // в 4 раза меньше GPU-работы
//      });
//      reflectionSprite.scale.set(0.5); // компенсируем размер
//
// ⑥ 📦 Раздельный контейнер "для отражений"
//    Держать только отражаемые сущности в отдельном графе и рендерить
//    его, а не world. Но это усложняет архитектуру и ломает z-index.
//
// ─────────────────────────────────────────────────────────────────────
// 🚫 Что НЕ помогает
// ─────────────────────────────────────────────────────────────────────
//
//   ❌ transform: НЕ тяжёлый, это uniform. Проблема не в нём.
//   ❌ mask:      НЕ отсекает объекты до рендера, только при растеризации.
//   ❌ Пересоздание RenderTexture: дорого, делать один раз.
//
// ─────────────────────────────────────────────────────────────────────
// 🎯 Рекомендация для текущего кода
// ─────────────────────────────────────────────────────────────────────
//
//   ⭐ Внедрить spatial hash (подход ①) — главный рычаг.
//   ⭐ Плюс resolution: 0.5 (подход ⑤) — тривиально, −75% пикселей.
//   ⭐ Плюс рендер раз в 2-3 кадра (подход ③) — −50-66% обходов.
//   📊 Итого: с 2000 объектов → 5-20 эффективно обрабатываемых.
// ════════════════════════════════════════════════════════════════════

const RIPPLE_COUNT = 3;
const RIPPLE_AMPLITUDE = 2;
const RIPPLE_SPEED = 0.003;

export function createWaterSurface(options: CreateWaterSurfaceOptions): WaterSurface {
  const {
    app,
    world,
    x = 300,
    y = 560,
    width = 256,
    height = 64,
    color = 0x38deff,
  } = options;

  const container = new Container();
  container.position.set(x, y);

  const renderTexture = RenderTexture.create({ 
    width, 
    height,
    resolution: 1,
  });
  renderTexture.source.scaleMode = 'nearest';

  const reflectionSprite = new Sprite(renderTexture);
  reflectionSprite.scale.y = -1; //переворот пикселей по y
  reflectionSprite.y = height;
  reflectionSprite.alpha = 0.8;
  container.addChild(reflectionSprite);

  const waterColor = new Graphics();
  waterColor.rect(0, 0, width, height);
  waterColor.fill({ color, alpha: 0.3 });
  container.addChild(waterColor);

  const ripples: Graphics[] = [];
  for (let i = 0; i < RIPPLE_COUNT; i++) {
    const ripple = new Graphics();
    ripple.rect(0, 0, width, 2);
    ripple.fill({ color: 0xffffff, alpha: 0.15 });
    ripple.y = (height / (RIPPLE_COUNT + 1)) * (i + 1);
    container.addChild(ripple);
    ripples.push(ripple);
  }

  let time = 0;
  const renderMatrix = new Matrix().translate(-x, -(y - height));

  function update(): void {
    time += app.ticker.deltaMS;
    console.log(time);

    container.visible = false;
    app.renderer.render({
      container: world,
      target: renderTexture,
      transform: renderMatrix,
    });
    container.visible = true;

    ripples.forEach((ripple, i) => {
      const baseY = (height / (RIPPLE_COUNT + 1)) * (i + 1);
      const offset = Math.sin(time * RIPPLE_SPEED + i * 1.5) * RIPPLE_AMPLITUDE;
      ripple.y = baseY + offset;
    });
  }

  function destroy(): void {
    renderTexture.destroy(true);
    container.destroy({ children: true });
  }

  return { container, update, destroy };
}
