import { Text, TextStyle } from 'pixi.js';
import { SizeComponent } from '../../components/SizeComponent';
import { SpriteComponent } from '../../components/SpriteComponent';
import type { ResolvedObject, TiledText } from 'pixi-tiledmap';
import type { Entity } from '../../core/ecs';
import type { SpawnContext } from './spawnContext';
import { finalizeSpawn } from './spawnUtils';

/**
 * 📝 Спавн Text object: Tiled text → Pixi `Text` + SpriteComponent.
 */
export function spawnTextObject(
  ctx: SpawnContext,
  id: Entity,
  obj: ResolvedObject,
  w: number,
  h: number,
): Entity {
  if (!obj.text) return -1 as unknown as Entity;

  const text = createPixiText(obj.text, w, h);
  ctx.world.addComponent(id, new SpriteComponent(text));
  if (w > 0 && h > 0) {
    ctx.world.addComponent(id, new SizeComponent(w, h, true));
  }
  finalizeSpawn(ctx, id, obj, undefined);
  return id;
}

/**
 * 📝 Создать Pixi `Text` из Tiled text object.
 */
function createPixiText(tiledText: TiledText, w: number, _h: number): Text {
  const style = new TextStyle({
    fontFamily: tiledText.fontfamily ?? 'sans-serif',
    fontSize: tiledText.pixelsize ?? 16,
    fill: tiledText.color ?? '#000000',
    fontWeight: tiledText.bold ? 'bold' : 'normal',
    fontStyle: tiledText.italic ? 'italic' : 'normal',
    align: tiledText.halign ?? 'left',
    wordWrap: tiledText.wrap ?? false,
    wordWrapWidth: w > 0 ? w : undefined,
  });
  const text = new Text({ text: tiledText.text, style });
  if (tiledText.valign === 'center') text.anchor.y = 0.5;
  if (tiledText.valign === 'bottom') text.anchor.y = 1;
  if (tiledText.halign === 'center') text.anchor.x = 0.5;
  if (tiledText.halign === 'right') text.anchor.x = 1;
  return text;
}
