import './style.css';
import { Container } from 'pixi.js';
import { bootApplication } from './app/boot';
import { attachStableViewportLayout } from './app/scheduleStableViewportLayout';
import { createNotebookPage } from './components/NotebookPage';
import { createFontShowcase } from './features/fonts/fontShowcase';
import { preloadGameBitmapFonts } from './features/fonts/gameBitmapText';
import { createTextAlignmentWorldDemo } from './features/fonts/textAlignDemo';
import { createItemIconsLayer } from './features/items/itemIconsLayer';
import { createWaterSurface } from './features/water/waterSurface';
import { attachCanvasContextMenu } from './features/ui/contextMenu';
import { createUiDemo } from './features/ui/uiDemo';
import { createCameraSystem } from './systems/camera';
import { createScreenUiSystem } from './systems/screenUi';
import { attachWorldClipboardPaste } from './systems/worldClipboardPaste';

const NOTEBOOK_PAGE_UI_SCALE = 4;
const NOTEBOOK_PAGE_INSET = 12;
const ORIGINAL_ZOOM = 1;
const MIN_ZOOM = ORIGINAL_ZOOM * 0.25;
const MAX_ZOOM = ORIGINAL_ZOOM * 10;
const WHEEL_ZOOM_STEP = 0.0015;
const ICON_DISPLAY_SCALE = 4;
const ICON_ROW_Y = 480;
const ICON_START_X = 72;
const ICON_GAP = 56;
const FONT_SHOWCASE_X = 560;
const FONT_SHOWCASE_Y = 48;

const app = await bootApplication();
const world = new Container();
const uiRoot = new Container();
app.stage.addChild(world);
app.stage.addChild(uiRoot);

const notebookPage = await createNotebookPage({
  x: NOTEBOOK_PAGE_INSET,
  y: NOTEBOOK_PAGE_INSET,
  scale: NOTEBOOK_PAGE_UI_SCALE,
});
world.addChild(notebookPage);

const screenUi = createScreenUiSystem({
  app,
  root: uiRoot,
});
const camera = createCameraSystem({
  app,
  world,
  zoomSnapFactor: NOTEBOOK_PAGE_UI_SCALE,
  originalZoom: ORIGINAL_ZOOM,
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  wheelZoomStep: WHEEL_ZOOM_STEP,
  shouldSuppressCameraAtClient: (clientX, clientY) => (
    screenUi.wheelBlocksWorldAtClient(clientX, clientY)
  ),
});

await preloadGameBitmapFonts();

const itemLayers = await createItemIconsLayer({
  world,
  screenToCanvasPoint: camera.screenToCanvasPoint,
  getWorldPoint: camera.getWorldPoint,
  notebookPageInset: NOTEBOOK_PAGE_INSET,
  notebookPageScale: NOTEBOOK_PAGE_UI_SCALE,
  iconDisplayScale: ICON_DISPLAY_SCALE,
  iconRowY: ICON_ROW_Y,
  iconStartX: ICON_START_X,
  iconGap: ICON_GAP,
});

createFontShowcase({
  world,
  x: FONT_SHOWCASE_X,
  y: FONT_SHOWCASE_Y,
});

createTextAlignmentWorldDemo({ world });

const water = createWaterSurface({ app, world });
world.addChild(water.container);
app.ticker.add(water.update);

await createUiDemo({
  screenUi,
});

await attachCanvasContextMenu({
  app,
  parent: uiRoot,
  screenToCanvasPoint: camera.screenToCanvasPoint,
  world,
  iconsLayer: itemLayers.iconsLayer,
  itemInfoLayer: itemLayers.itemInfoLayer,
});

camera.mount();
camera.resnapWorldScalePreserveScreenCenter();

attachWorldClipboardPaste({
  app,
  world,
  screenToCanvasPoint: camera.screenToCanvasPoint,
  getWorldPoint: camera.getWorldPoint,
  isPasteBlockedAtClient: (clientX, clientY) => (
    screenUi.wheelBlocksWorldAtClient(clientX, clientY)
  ),
});

attachStableViewportLayout({
  onLayout: () => {
    if (app.screen.width <= 0 || app.screen.height <= 0) {
      return;
    }
    if (app.canvas.clientWidth <= 0 || app.canvas.clientHeight <= 0) {
      return;
    }
    camera.resnapWorldScalePreserveScreenCenter();
    screenUi.layout();
  },
});
