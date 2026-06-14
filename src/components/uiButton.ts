import {
  Container,
  Rectangle,
  Sprite,
  type FederatedPointerEvent,
} from 'pixi.js';
import {
  getUiMiniTexture,
  UI_BUTTON_FRAME_SIZE,
  UI_MINI_CELL,
  type UiMiniFrameName,
} from '../assets/uiMiniAtlas';

export type UiButtonState = 'idle' | 'hover' | 'pressed' | 'released';
export type UiButtonKind = 'confirm' | 'close' | 'up' | 'down';

export type UiButtonAnimationConfig = {
  frameCount: number;
  frameDurationMs: number;
};

export type CreateUiButtonOptions = {
  kind: UiButtonKind;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  onClick?: () => void;
  animation?: Partial<Record<UiButtonState, UiButtonAnimationConfig>>;
};

// все свойства контейнера + 2 стрелочных функции
export type UiButton = Container & {
  setState: (state: UiButtonState) => void;
  setEnabled: (enabled: boolean) => void;
};

// для каждой кнопки состояние покоя и нажатия
const BUTTON_FRAMES: Record<UiButtonKind, {
  idle: UiMiniFrameName;
  pressed: UiMiniFrameName;
}> = {
  confirm: { idle: 'confirmIdle', pressed: 'confirmPressed' },
  close: { idle: 'closeIdle', pressed: 'closePressed' },
  up: { idle: 'upIdle', pressed: 'upPressed' },
  down: { idle: 'upIdle', pressed: 'upPressed' },
};

// получить 'название' спрайта нажатия, покоя на определенную кнопку
function getFrameForState(
  kind: UiButtonKind,
  state: UiButtonState,
): UiMiniFrameName {
  if (state === 'pressed') {
    return BUTTON_FRAMES[kind].pressed;
  }

  return BUTTON_FRAMES[kind].idle;
}


export async function createUiButton(
  options: CreateUiButtonOptions,
): Promise<UiButton> {
  const width = options.width ?? UI_MINI_CELL * 2;
  const height = options.height ?? UI_MINI_CELL * 2;
  const root = new Container() as UiButton;
  const shouldUseButtonFrame = options.kind === 'confirm' || options.kind === 'close';
  const background = shouldUseButtonFrame
    ? new Sprite(await getUiMiniTexture('buttonFrame'))
    : undefined;
  const icon = new Sprite(await getUiMiniTexture(getFrameForState(options.kind, 'idle')));
  let state: UiButtonState = 'idle';
  let enabled = true;

  // смена состояния - смена текстуры кнопки
  async function renderState(nextState: UiButtonState): Promise<void> {
    icon.texture = await getUiMiniTexture(getFrameForState(options.kind, nextState));
  }

  function setState(nextState: UiButtonState): void {
    state = nextState;
    void renderState(state);
  }

  function setEnabled(nextEnabled: boolean): void {
    enabled = nextEnabled;
    root.alpha = enabled ? 1 : 0.45;
    root.eventMode = enabled ? 'static' : 'none';
    root.cursor = enabled ? 'pointer' : 'default';
  }

  const onPointerOver = (): void => {
    if (enabled && state !== 'pressed') {
      setState('hover');
    }
  };
  const onPointerOut = (): void => {
    if (enabled) {
      setState('idle');
    }
  };
  const onPointerDown = (): void => {
    if (enabled) {
      setState('pressed');
    }
  };
  const onPointerUp = (event: FederatedPointerEvent): void => {
    if (!enabled) {
      return;
    }

    setState('released');
    options.onClick?.();
    event.stopPropagation();
    window.setTimeout(() => setState('hover'), 90);
  };

  root.position.set(options.x ?? 0, options.y ?? 0);
  // добавление фона для кнопки
  if (background) {
    background.width = width;
    background.height = height;
    root.addChild(background);
  }

  icon.anchor.set(0.5);
  icon.position.set(Math.round(width / 2), Math.round(height / 2));
  icon.width = shouldUseButtonFrame
    ? Math.round((width / UI_BUTTON_FRAME_SIZE) * UI_MINI_CELL)
    : width;
  icon.height = shouldUseButtonFrame
    ? Math.round((height / UI_BUTTON_FRAME_SIZE) * UI_MINI_CELL)
    : height;
  if (options.kind === 'down') {
    icon.rotation = Math.PI;
  }

  root.addChild(icon);
  root.setState = setState;
  root.setEnabled = setEnabled;
  root.eventMode = 'static';
  root.cursor = 'pointer';
  root.hitArea = new Rectangle(0, 0, width, height);
  root.on('pointerover', onPointerOver);
  root.on('pointerout', onPointerOut);
  root.on('pointerdown', onPointerDown);
  root.on('pointerup', onPointerUp);
  root.on('pointerupoutside', onPointerOut);

  void renderState(state);

  return root;
}
