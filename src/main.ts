import { Container } from 'pixi.js';
import { CameraComponent, SpriteComponent, TransformComponent } from './components';
import { World } from './core/ecs';
import { GameLoop } from './core/loop/GameLoop';
import { createApp } from './app/bootstrap';
import { AssetsManager } from './core/assets';
import { LoadingScreen } from './ui/LoadingScreen';
import {
  AnimationSystem,
  CameraInputSystem,
  CameraRenderSystem,
  CameraSystem,
  InputSystem,
  MovementSystem,
  PlayerControlSystem,
  RenderSystem,
  TouchCameraInputSystem,
} from './systems';
import { CollisionGrid } from './map/CollisionGrid';
import { loadTiledMap } from './map/MapLoader';
import { ObjectSpawner } from './map/ObjectSpawner';

const app = await createApp(document.body);

// 🔄 Фаза загрузки
const loadingScreen = new LoadingScreen(app.screen.width, app.screen.height);
app.stage.addChild(loadingScreen.container);

const config = await AssetsManager.loadConfig();
await AssetsManager.init(config);
await AssetsManager.loadAll((p) => loadingScreen.setProgress(p * 0.6));

// 🗺️ Загружаем тайлмап через свой `loadTiledMap` (URL-safe resolution для tilesets).
//    Не используем `tiledMapLoader` extension — он склеивает URL через `path.join`,
//    что ломается при leading-`/` путях от Tiled Editor.
const tilemapCfg = config.tilemaps.find((t) => t.name === 'temple') ?? config.tilemaps[0];
if (!tilemapCfg) throw new Error('[main] load-config.json has no tilemaps');
const { mapData, container: tiledMap } = await loadTiledMap(tilemapCfg.path);
loadingScreen.setProgress(0.8);

// 🌍 World container — все игровые объекты
const world = new World();
const worldContainer = new Container();
app.stage.addChild(worldContainer);

// 🗺️ Тайлмап (rendering — внутри pixi-tiledmap; packed mesh + image layers)
worldContainer.addChild(tiledMap);

// 🛡️ Collision (in-memory: тайлы + AABB объектов).
const collision = new CollisionGrid(mapData, 'walkable');

// 🎮 Спавн сущностей из Tiled object layer
const player = ObjectSpawner.spawnAll({
  world,
  worldContainer,
  resolvedMap: mapData,
  tileSetRenderers: tiledMap.tileSetRenderers,
  collision,
  tilemapConfig: tilemapCfg,
  textures: AssetsManager.getAllTextures(),
});

if (player === null) {
  throw new Error(`[main] No player_spawn in ${tilemapCfg.path}`);
}

worldContainer.addChild(world.getComponent(player, SpriteComponent)!.view);

// 🕹️ Игровые системы
world.addSystem(new InputSystem());
world.addSystem(new PlayerControlSystem(140, collision));
world.addSystem(new MovementSystem());
world.addSystem(new AnimationSystem());
world.addSystem(new CameraInputSystem());
world.addSystem(new TouchCameraInputSystem());
world.addSystem(new CameraSystem());
world.addSystem(new CameraRenderSystem(worldContainer, tiledMap));
world.addSystem(new RenderSystem());

loadingScreen.setProgress(1);

// 📷 Камера
const camera = world.createEntity();
const cameraComp = new CameraComponent();
cameraComp.viewportWidth = app.screen.width;
cameraComp.viewportHeight = app.screen.height;
cameraComp.target = player;
cameraComp.minZoom = 0.2;
cameraComp.maxZoom = 4;

// 🗺️ World bounds: finite — декларация, infinite — bbox по chunks
const worldMinX = 0;
const worldMinY = 0;
let worldMaxX = mapData.width * mapData.tilewidth;
let worldMaxY = mapData.height * mapData.tileheight;
if (mapData.infinite) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const layer of mapData.layers) {
    if (layer.type !== 'tilelayer' || !layer.chunks) continue;
    for (const c of layer.chunks) {
      const lx = c.x * mapData.tilewidth;
      const ly = c.y * mapData.tileheight;
      const rx = (c.x + c.width) * mapData.tilewidth;
      const ry = (c.y + c.height) * mapData.tileheight;
      if (lx < minX) minX = lx;
      if (ly < minY) minY = ly;
      if (rx > maxX) maxX = rx;
      if (ry > maxY) maxY = ry;
    }
  }
  if (minX !== Infinity) {
    worldMaxX = maxX - minX;
    worldMaxY = maxY - minY;
  }
}
const worldWidthPx = worldMaxX;
const worldHeightPx = worldMaxY;

// 🎯 Player spawn: берём из Tiled player_spawn объекта (ObjectSpawner уже выставил transform).
//    ObjectSpawner ставит transform в центр объекта; renderX/renderY интерполяция стартует оттуда.
const playerTransform = world.getComponent(player, TransformComponent)!;
playerTransform.renderX = playerTransform.x;
playerTransform.renderY = playerTransform.y;

// 🎯 Центрируем камеру на центре карты (с учётом смещения infinite map)
cameraComp.x = worldMinX + worldWidthPx / 2;
cameraComp.y = worldMinY + worldHeightPx / 2;
// Зум: если карта меньше вьюпорта — fit-to-screen, иначе читаемый 1.5x
const fitZoom = Math.min(
  app.screen.width / worldWidthPx,
  app.screen.height / worldHeightPx,
);
const initialZoom = Math.max(fitZoom, 1.5);
cameraComp.zoom = initialZoom;
cameraComp.zoomRest = initialZoom;
cameraComp.zoomOvershoot = 0.2;
cameraComp.zoomHoldTime = 0.5;
cameraComp.worldMinX = worldMinX;
cameraComp.worldMinY = worldMinY;
cameraComp.worldMaxX = worldMaxX;
cameraComp.worldMaxY = worldMaxY;
world.addComponent(camera, cameraComp);

app.renderer.on('resize', () => {
  cameraComp.viewportWidth = app.screen.width;
  cameraComp.viewportHeight = app.screen.height;
});

loadingScreen.destroy();
new GameLoop(world, app).start();
