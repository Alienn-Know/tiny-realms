import './style.css';
import { Graphics, Text } from 'pixi.js';
import { createApp } from './app/bootstrap';

const app = await createApp(document.body);

const circle = new Graphics();
circle.fill(0xe94560);
circle.circle(0, 0, 48);
circle.x = app.screen.width / 2 - 80;
circle.y = app.screen.height / 2;
app.stage.addChild(circle);

const square = new Graphics();
square.fill(0x0f3460);
square.stroke({ width: 2, color: 0xffffff, alpha: 0.3 });
square.rect(-48, -48, 96, 96);
square.x = app.screen.width / 2 + 80;
square.y = app.screen.height / 2;
app.stage.addChild(square);

const label = new Text({
  text: 'Tiny Realms — Phase 0',
  style: {
    fontFamily: 'system-ui, sans-serif',
    fontSize: 24,
    fill: '#ffffff',
  },
});
label.anchor.set(0.5);
label.x = app.screen.width / 2;
label.y = 40;
app.stage.addChild(label);

app.ticker.add(() => {
  circle.rotation += 0.01;
  square.rotation -= 0.01;
});

window.addEventListener('resize', () => {
  circle.x = app.screen.width / 2 - 80;
  circle.y = app.screen.height / 2;
  square.x = app.screen.width / 2 + 80;
  square.y = app.screen.height / 2;
  label.x = app.screen.width / 2;
});
