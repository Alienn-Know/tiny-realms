import './style.css';
import { Graphics } from 'pixi.js';
import { TransformComponent, VelocityComponent, SpriteComponent } from './components';
import { World } from './core/ecs';
import { GameLoop } from './core/loop/GameLoop';
import { createApp } from './app/bootstrap';
import { BoundarySystem, MovementSystem, RenderSystem } from './systems';

const app = await createApp(document.body);

const world = new World();

world.addSystem(new MovementSystem());
world.addSystem(new BoundarySystem(app.screen.width, app.screen.height));
world.addSystem(new RenderSystem());

const player = world.createEntity();

const playerSize = 48;
const playerView = new Graphics();
playerView.fill(0xe94560);
playerView.stroke({ width: 2, color: 0xffffff, alpha: 0.4 });
playerView.rect(-playerSize / 2, -playerSize / 2, playerSize, playerSize);

app.stage.addChild(playerView);

world.addComponent(player, new TransformComponent(app.screen.width / 2, app.screen.height / 2));
world.addComponent(player, new VelocityComponent(120, 80));
world.addComponent(player, new SpriteComponent(playerView));

window.addEventListener('resize', () => {
  // BoundarySystem использует app.screen.width/height напрямую,
  // поэтому пересоздаём его с новыми размерами
  world.addSystem(new BoundarySystem(app.screen.width, app.screen.height));
});

const loop = new GameLoop(world, app);
loop.start();
