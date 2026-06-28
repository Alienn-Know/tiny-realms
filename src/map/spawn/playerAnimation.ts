import { AnimatedSprite, Texture, type Spritesheet } from 'pixi.js';
import { AnimationComponent } from '../../components/AnimationComponent';
import {
  AnimationDefinitionComponent,
  type AnimationDef,
  type Facing,
  type FacingFrames,
} from '../../components/AnimationDefinitionComponent';
import { InputComponent } from '../../components/InputComponent';
import { SizeComponent } from '../../components/SizeComponent';
import { SpriteComponent } from '../../components/SpriteComponent';
import type { Entity } from '../../core/ecs';
import type { SpawnContext } from './spawnContext';

/**
 * 🎬 Инициализирует `AnimationComponent` + `AnimationDefinitionComponent` для player'а.
 *
 * Берёт спрайтшит (Pixi `Spritesheet`) из `ctx.textures['player']` и режет кадры
 * по схеме `<state>-<facing>-<i>`, описанной в `slime3.json` (`layout`).
 * Подменяет `SpriteComponent.view` (был `Sprite`) на `AnimatedSprite`.
 */
export function setupPlayerAnimation(ctx: SpawnContext, id: Entity): void {
  const sheet = ctx.textures['player'] as Spritesheet | undefined;
  if (!sheet) {
    console.warn('[ObjectSpawner] No spritesheet loaded for alias "player"');
    return;
  }

  ctx.world.addComponent(id, new InputComponent());

  const layout = parseLayout(sheet);
  if (!layout) {
    console.warn('[ObjectSpawner] Spritesheet JSON missing "layout" metadata');
    return;
  }

  // 🧩 Собираем AnimationDef'ы по state × facing
  const def = new AnimationDefinitionComponent(buildAnimationStates(sheet, layout));
  ctx.world.addComponent(id, def);

  // 🎞️ Создаём AnimatedSprite с начальными кадрами (idle-front).
  //    `animationSpeed = 0` + `autoUpdate = false`: кадры двигаем вручную
  //    в `AnimationComponent.update()` через `stateTime` для точного контроля.
  const initialFrames = def.states.idle?.frames.front ?? [];
  const body = new AnimatedSprite({ textures: initialFrames, loop: true, animationSpeed: 0 });
  body.autoUpdate = false;
  body.anchor.set(0.5, 1); // ноги стоят на тайле

  // 🖼️ Подменяем Sprite в SpriteComponent на AnimatedSprite
  replaceSpriteView(ctx, id, body);

  // 📏 SizeComponent из frame size (collision AABB)
  const frameSize = layout.frameSize;
  ctx.world.addComponent(id, new SizeComponent(frameSize, frameSize, true));

  // 🎬 AnimationComponent (инициализирует кадры на body)
  const anim = new AnimationComponent(body, def);
  ctx.world.addComponent(id, anim);
}

/**
 * 🗺️ Извлечь layout метаданные из spritesheet JSON.
 */
function parseLayout(sheet: Spritesheet): SpritesheetLayout | null {
  const dataAny = sheet.data as { layout?: Record<string, unknown> } | Record<string, unknown> | undefined;
  const layoutRaw = (dataAny as { layout?: Record<string, unknown> })?.layout;
  return (layoutRaw as SpritesheetLayout | undefined) ?? null;
}

/**
 * 🧩 Собрать `Record<state, AnimationDef>` из layout + sheet.textures.
 */
function buildAnimationStates(
  sheet: Spritesheet,
  layout: SpritesheetLayout,
): Record<string, AnimationDef> {
  const states: Record<string, AnimationDef> = {};
  for (const state of layout.states) {
    const facingFrames: FacingFrames = { front: [], back: [], left: [], right: [] };
    for (const facing of layout.facings) {
      collectFramesForFacing(sheet, state, facing, facingFrames);
    }
    states[state] = {
      frames: facingFrames,
      frameTime: layout.frameTime[state] ?? 0.12,
      loop: layout.loop[state] ?? false,
    };
  }
  return states;
}

/**
 * 🖼️ Найти все кадры для конкретного state+facing и сложить в facingFrames.
 */
function collectFramesForFacing(
  sheet: Spritesheet,
  state: string,
  facing: Facing,
  facingFrames: FacingFrames,
): void {
  const prefix = `${state}-${facing}-`;
  const keys = Object.keys(sheet.textures)
    .filter((k) => k.startsWith(prefix))
    .sort((a, b) => parseFrameIndex(a, prefix) - parseFrameIndex(b, prefix));
  for (const k of keys) {
    const tex = sheet.textures[k] as Texture;
    if (tex) facingFrames[facing].push(tex);
  }
}

/** 🔢 Извлечь порядковый номер кадра из имени текстуры. */
function parseFrameIndex(key: string, prefix: string): number {
  return parseInt(key.slice(prefix.length), 10);
}

/**
 * 🖼️ Удалить старый Sprite из контейнера, добавить AnimatedSprite.
 */
function replaceSpriteView(ctx: SpawnContext, id: Entity, body: AnimatedSprite): void {
  const spriteComp = ctx.world.getComponent(id, SpriteComponent);
  if (spriteComp) {
    const oldView = spriteComp.view;
    const parent = oldView.parent;
    if (parent) {
      parent.removeChild(oldView);
      parent.addChild(body);
    }
    oldView.destroy();
    spriteComp.view = body;
  } else {
    ctx.world.addComponent(id, new SpriteComponent(body));
    ctx.worldContainer.addChild(body);
  }
}

/** 🗺️ Структура layout-метаданных в spritesheet JSON (см. tools/build-slime3-atlas.mjs). */
type SpritesheetLayout = {
  frameSize: number;
  framesPerRow: number;
  facings: Facing[];
  states: string[];
  frameTime: Record<string, number>;
  loop: Record<string, boolean>;
};
