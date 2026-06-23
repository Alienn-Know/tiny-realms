import { Container } from 'pixi.js';
import { CameraComponent, SpriteComponent, TileMapComponent } from './components';
import { World, type Entity } from './core/ecs';
import { GameLoop } from './core/loop/GameLoop';
import { createApp } from './app/bootstrap';
import { AssetsManager } from './core/assets';
import { LoadingScreen } from './ui/LoadingScreen';
import {
  CameraInputSystem,
  CameraRenderSystem,
  CameraSystem,
  ImageLayerRenderSystem,
  InputSystem,
  MovementSystem,
  PlayerControlSystem,
  RenderSystem,
  TileMapRenderSystem,
  TouchCameraInputSystem,
} from './systems';
import { TiledMapLoader } from './map/TiledMapLoader';
import { CollisionGrid } from './map/CollisionGrid';
import { ObjectSpawner } from './map/ObjectSpawner';
import { TileAnimationSystem } from './map/TileAnimationSystem';

const app = await createApp(document.body);

// 🔄 Фаза загрузки
const loadingScreen = new LoadingScreen(app.screen.width, app.screen.height);
app.stage.addChild(loadingScreen.container);

const config = await AssetsManager.loadConfig();
await AssetsManager.init(config);
await AssetsManager.loadAll((p) => loadingScreen.setProgress(p * 0.6));

// 🗺️ Загружаем тайлмап (v1 — single-map, берём по имени)
const tilemapCfg = config.tilemaps.find((t) => t.name === 'temple') ?? config.tilemaps[0];
if (!tilemapCfg) throw new Error('[main] load-config.json has no tilemaps');
const mapData = await TiledMapLoader.load(tilemapCfg, config.bundles, () => {});
loadingScreen.setProgress(0.8);

// 🌍 World container — все игровые объекты
const world = new World();
const worldContainer = new Container();
app.stage.addChild(worldContainer);

// 🗺️ Тайлмап как ECS-компонент
const tilemapEntity: Entity = world.createEntity();
const tileMapComp = new TileMapComponent(mapData);
world.addComponent(tilemapEntity, tileMapComp);
worldContainer.addChild(tileMapComp.container);

// 🛡️ Collision (in-memory: тайлы + AABB объектов)
const worldWidthPx = mapData.width * mapData.tileWidth;
const worldHeightPx = mapData.height * mapData.tileHeight;
const worldOriginX = mapData.offsetX;
const worldOriginY = mapData.offsetY;
const collision = new CollisionGrid(world, tilemapEntity, worldOriginX, worldOriginY, worldWidthPx, worldHeightPx);

// 🎮 Спавн сущностей из Tiled object layer
const player: Entity = ObjectSpawner.spawnAll({
  world,
  worldContainer,
  mapData,
  collision,
  tilemapEntity,
  tilemapConfig: tilemapCfg,
  textures: AssetsManager.getAllTextures(),
}) ?? (() => { throw new Error(`[main] No player_spawn in ${tilemapCfg.path}`); })();

worldContainer.addChild(world.getComponent(player, SpriteComponent)!.view);

// 🕹️ Игровые системы
world.addSystem(new InputSystem());
world.addSystem(new TileMapRenderSystem());
world.addSystem(new TileAnimationSystem());
world.addSystem(new ImageLayerRenderSystem(worldContainer, mapData));
world.addSystem(new PlayerControlSystem(140, collision));
world.addSystem(new MovementSystem());
world.addSystem(new CameraInputSystem());
world.addSystem(new TouchCameraInputSystem());
world.addSystem(new CameraSystem());
world.addSystem(new CameraRenderSystem(worldContainer));
world.addSystem(new RenderSystem());

loadingScreen.setProgress(1);

// 📷 Камера
const camera = world.createEntity();
const cameraComp = new CameraComponent();
cameraComp.viewportWidth = app.screen.width;
cameraComp.viewportHeight = app.screen.height;
// cameraComp.target = player;
cameraComp.minZoom = 0.2;
cameraComp.maxZoom = 4;
// 🎯 Центрируем камеру на центре текущих тайлов (с учётом смещения infinite map)
cameraComp.x = worldOriginX + worldWidthPx / 2;
cameraComp.y = worldOriginY + worldHeightPx / 2;
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
cameraComp.worldMinX = worldOriginX;
cameraComp.worldMinY = worldOriginY;
cameraComp.worldMaxX = worldOriginX + worldWidthPx;
cameraComp.worldMaxY = worldOriginY + worldHeightPx;
world.addComponent(camera, cameraComp);

app.renderer.on('resize', () => {
  cameraComp.viewportWidth = app.screen.width;
  cameraComp.viewportHeight = app.screen.height;
});

loadingScreen.destroy();
new GameLoop(world, app).start();
