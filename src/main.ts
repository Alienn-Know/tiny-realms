import { SpriteComponent } from './components';
import { World } from './core/ecs';
import { GameLoop } from './core/loop/GameLoop';
import { createApp } from './app/bootstrap';
import { AssetsManager } from './core/assets';
import { LoadingScreen } from './ui/LoadingScreen';
import { computeWorldBounds, setupCamera } from './camera/setupCamera';
import { loadTiledMap } from './map/MapLoader';
import { ObjectSpawner } from './map/spawn';
import { createCollisionGrid, createWorldContainer } from './map/setupWorld';
import { registerGameSystems } from './systems/registerSystems';

const app = await createApp(document.body);

// 🔄 Фаза загрузки
const loadingScreen = new LoadingScreen(app.screen.width, app.screen.height);
app.stage.addChild(loadingScreen.container);

const config = await AssetsManager.loadConfig();
await AssetsManager.init(config);
await AssetsManager.loadAll((p) => loadingScreen.setProgress(p * 0.6));

// 🗺️ Тайлмап (через свой `loadTiledMap` — URL-safe для leading-`/` tilesets)
const tilemapCfg = config.tilemaps.find((t) => t.name === 'temple') ?? config.tilemaps[0];
if (!tilemapCfg) throw new Error('[main] load-config.json has no tilemaps');
const { mapData, container: tiledMap } = await loadTiledMap(tilemapCfg.path);
loadingScreen.setProgress(0.8);

// 🌍 World + container + collision
const world = new World();
const worldContainer = createWorldContainer(app, tiledMap);
const collision = createCollisionGrid(mapData);

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

// 📷 Камера (до регистрации систем — нужна entity для follow)
const bounds = computeWorldBounds(mapData);
setupCamera(world, app, player, bounds);

// 🕹️ Регистрация всех систем
registerGameSystems(world, { worldContainer, tiledMap, collision });

loadingScreen.setProgress(1);
loadingScreen.destroy();
new GameLoop(world, app).start();
