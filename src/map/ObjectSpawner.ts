import { AnimatedSprite, Container, Sprite, Text, TextStyle, type Spritesheet, type Texture } from 'pixi.js';
import { World, type Entity } from '../core/ecs';
import { AnimationComponent } from '../components/AnimationComponent';
import { AnimationDefinitionComponent, type AnimationDef, type Facing, type FacingFrames } from '../components/AnimationDefinitionComponent';
import { InputComponent } from '../components/InputComponent';
import { PropertiesComponent } from '../components/PropertiesComponent';
import { ShapeComponent, type ShapeData } from '../components/ShapeComponent';
import { SpriteComponent } from '../components/SpriteComponent';
import { TransformComponent } from '../components/TransformComponent';
import { VelocityComponent } from '../components/VelocityComponent';
import { SizeComponent } from '../components/SizeComponent';
import { CollisionGrid } from './CollisionGrid';
import { TiledMapLoader } from './TiledMapLoader';
import type { MapData } from './MapData';
import type { TiledObject, TiledProperty, TiledText } from './TiledTypes';
import type { TilemapConfig } from '../core/assets/AssetsConfig';
import { decodeGid } from './utils/gid';

/**
 * 🎮 Контекст для ObjectSpawner — всё, что handler'у нужно для спавна.
 */
export type SpawnContext = {
  world: World;
  worldContainer: Container;
  mapData: MapData;
  collision: CollisionGrid;
  tilemapEntity: Entity;
  tilemapConfig: TilemapConfig;
  /** 🖼️ alias → Texture (из AssetsManager — для non-tile объектов). */
  textures: Record<string, unknown>;
};

/**
 * 👤 ObjectSpawner — generic спавнер сущностей из Tiled object layer.
 *
 * Поддерживает:
 * - Rectangle objects (текущая логика, через `objectTypes` mapping)
 * - Tile objects (`obj.gid` — текстура из resolved tileset)
 * - Shape objects (point/ellipse/polygon/polyline/capsule → `ShapeComponent`)
 * - Text objects (Pixi `Text` вместо `Sprite`)
 * - Templates (уже материализованы в `TiledMapLoader`)
 */
export class ObjectSpawner {
  /** 🎬 Спавнит все объекты из `mapData.objects`. Возвращает id player (или null). */
  static spawnAll(ctx: SpawnContext): Entity | null {
    let playerId: Entity | null = null;

    for (const obj of ctx.mapData.objects) {
      const id = ObjectSpawner.#spawnOne(ctx, obj);
      if (id < 0) continue;
      const alias = ctx.tilemapConfig.objectTypes[obj.type ?? ''];
      if (obj.type === 'player_spawn' || alias === 'player') {
        if (playerId !== null) {
          console.warn('[ObjectSpawner] Multiple player_spawn, using first');
        } else {
          playerId = id;
        }
      }
    }

    return playerId;
  }

  /** 🛠️ Спавн одного объекта. */
  static #spawnOne(ctx: SpawnContext, obj: TiledObject): Entity {
    // 1. Resolve alias (необязательно для tile/text/shape объектов)
    const alias = ctx.tilemapConfig.objectTypes[obj.type ?? ''];

    // 2. Resolve size
    const tileSize = ctx.mapData.tileWidth;
    let w = obj.width;
    let h = obj.height;
    if (w <= 0 || h <= 0) {
      if (ctx.tilemapConfig.objectSizeFallback === 'tile') {
        w = w <= 0 ? tileSize : w;
        h = h <= 0 ? tileSize : h;
      } else if (ctx.tilemapConfig.objectSizeFallback === 'zero') {
        w = w <= 0 ? 0 : w;
        h = h <= 0 ? 0 : h;
      }
    }

    // 3. Center position (Tiled origin = top-left → +w/2, +h/2)
    const cx = obj.x + w / 2;
    const cy = obj.y + h / 2;
    const rotation = obj.rotation ? (obj.rotation * Math.PI) / 180 : 0;

    // 4. Create entity + transform
    const id = ctx.world.createEntity();
    ctx.world.addComponent(id, new TransformComponent(cx, cy, rotation));
    ctx.world.addComponent(id, new VelocityComponent());

    // 5. Shape objects → ShapeComponent (без Sprite)
    const shape = ObjectSpawner.#extractShape(obj);
    if (shape) {
      ctx.world.addComponent(id, new ShapeComponent(shape));
    }

    // 6. Text object → Pixi Text
    if (obj.text) {
      const text = ObjectSpawner.#createText(obj.text, w, h);
      ctx.world.addComponent(id, new SpriteComponent(text));
      if (w > 0 && h > 0) {
        ctx.world.addComponent(id, new SizeComponent(w, h, true));
      }
      ObjectSpawner.#addProperties(ctx, id, obj);
      return id;
    }

    // 7. Tile object (gid) → текстура из resolved tileset
    if (obj.gid) {
      const decoded = decodeGid(obj.gid);
      const resolved = TiledMapLoader.resolveGid(decoded.gid, ctx.mapData.tilesets);
      if (resolved) {
        const sprite = new Sprite(resolved.tileset.texture);
        // TODO: вырезать конкретный кадр из тайлсета (по localId)
        // Пока — используется вся текстура тайлсета. Для точного кадра нужен
        // #createTileTexture из TileMapRenderSystem, но он приват.
        // Fallback: если есть alias и текстура в ctx.textures — используем её
        if (alias && ctx.textures[alias]) {
          sprite.texture = ctx.textures[alias] as never;
        }
        ObjectSpawner.#applyGidFlip(sprite, decoded);
        ctx.world.addComponent(id, new SpriteComponent(sprite));
        if (w > 0 && h > 0) {
          ctx.world.addComponent(id, new SizeComponent(w, h, true));
        }
        ObjectSpawner.#finalizeSpawn(ctx, id, obj, alias);
        return id;
      }
    }

    // 8. Rectangle object — текущая логика (через objectTypes mapping)
    if (alias) {
      const tex = ctx.textures[alias];
      if (tex) {
        const sprite = new Sprite(tex as never);
        ctx.world.addComponent(id, new SpriteComponent(sprite));
        if (w > 0 && h > 0) {
          ctx.world.addComponent(id, new SizeComponent(w, h, true));
        }
      } else {
        console.warn(`[ObjectSpawner] No texture loaded for alias "${alias}"`);
      }
    } else if (obj.type) {
      console.warn(`[ObjectSpawner] No alias mapping for type "${obj.type}"`);
    }

    ObjectSpawner.#finalizeSpawn(ctx, id, obj, alias);
    return id;
  }

  /** 🏁 Финализация спавна: InputComponent + properties + collision + animations (player). */
  static #finalizeSpawn(ctx: SpawnContext, id: Entity, obj: TiledObject, alias: string | undefined): void {
    // Player gets InputComponent + Animation + AnimationDefinition
    if (obj.type === 'player_spawn' || alias === 'player') {
      ctx.world.addComponent(id, new InputComponent());
      ObjectSpawner.#setupPlayerAnimation(ctx, id);
    }

    ObjectSpawner.#addProperties(ctx, id, obj);

    // Solid object → collision grid
    const w = obj.width;
    const h = obj.height;
    const isSolid = obj.properties?.some((p) => p.name === 'solid' && p.value === true) ?? false;
    if (isSolid && w > 0 && h > 0) {
      const cx = obj.x + w / 2;
      const cy = obj.y + h / 2;
      ctx.collision.addSolidBox(id, cx, cy, w, h);
    }
  }

  /**
   * 🎬 Инициализирует `AnimationComponent` + `AnimationDefinitionComponent` для player'а.
   *
   * Берёт спрайтшит (Pixi `Spritesheet`) из `ctx.textures['player']` и режет кадры
   * по схеме `<state>-<facing>-<i>`, описанной в `slime3.json` (`layout`).
   * Подменяет `SpriteComponent.view` (был `Sprite`) на `AnimatedSprite`.
   */
  static #setupPlayerAnimation(ctx: SpawnContext, id: Entity): void {
    const sheet = ctx.textures['player'] as Spritesheet | undefined;
    if (!sheet) {
      console.warn('[ObjectSpawner] No spritesheet loaded for alias "player"');
      return;
    }

    // 🗺️ Layout из JSON (см. tools/build-slime3-atlas.mjs)
    const dataAny = sheet.data as { layout?: Record<string, unknown> } | Record<string, unknown> | undefined;
    const layoutRaw = (dataAny as { layout?: Record<string, unknown> })?.layout;
    if (!layoutRaw) {
      console.warn('[ObjectSpawner] Spritesheet JSON missing "layout" metadata');
    }
    const layout = layoutRaw as {
      frameSize: number;
      framesPerRow: number;
      facings: Facing[];
      states: string[];
      frameTime: Record<string, number>;
      loop: Record<string, boolean>;
    };

    // 🧩 Собираем AnimationDef'ы по state × facing
    const states: Record<string, AnimationDef> = {};
    for (const state of layout.states) {
      const facingFrames: FacingFrames = { front: [], back: [], left: [], right: [] };
      for (const facing of layout.facings) {
        // Ищем кадры с префиксом "<state>-<facing>-<i>"
        const prefix = `${state}-${facing}-`;
        const keys = Object.keys(sheet.textures)
          .filter((k) => k.startsWith(prefix))
          .sort((a, b) => {
            const ai = parseInt(a.slice(prefix.length), 10);
            const bi = parseInt(b.slice(prefix.length), 10);
            return ai - bi;
          });
        for (const k of keys) {
          const tex = sheet.textures[k] as Texture;
          if (tex) facingFrames[facing].push(tex);
        }
      }
      states[state] = {
        frames: facingFrames,
        frameTime: layout.frameTime[state] ?? 0.12,
        loop: layout.loop[state] ?? false,
      };
    }

    const def = new AnimationDefinitionComponent(states);
    ctx.world.addComponent(id, def);

    // 🎞️ Создаём AnimatedSprite с начальными кадрами (idle-front).
    //    `animationSpeed = 0` + `autoUpdate = false`: кадры двигаем вручную
    //    в `AnimationComponent.update()` через `stateTime` для точного контроля.
    const initialFrames = def.states.idle?.frames.front ?? [];
    const body = new AnimatedSprite({ textures: initialFrames, loop: true, animationSpeed: 0 });
    body.autoUpdate = false;
    body.anchor.set(0.5, 1); // ноги стоят на тайле

    // 🖼️ Заменяем Sprite в SpriteComponent (был Sprite) на AnimatedSprite
    const spriteComp = ctx.world.getComponent(id, SpriteComponent);
    if (spriteComp) {
      // Удаляем старый Sprite из контейнера, добавляем AnimatedSprite
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

    // 📏 SizeComponent из frame size (collision AABB)
    const frameSize = layout.frameSize;
    ctx.world.addComponent(id, new SizeComponent(frameSize, frameSize, true));

    // 🎬 AnimationComponent (инициализирует кадры на body)
    const anim = new AnimationComponent(body, def);
    ctx.world.addComponent(id, anim);
  }

  /** 🏷️ Custom properties → PropertiesComponent. */
  static #addProperties(ctx: SpawnContext, id: Entity, obj: TiledObject): void {
    if (obj.properties && obj.properties.length > 0) {
      const data = ObjectSpawner.#propertiesToObject(obj.properties);
      ctx.world.addComponent(id, new PropertiesComponent(data));
    }
  }

  /** 📐 Извлечь ShapeData из объекта (если это shape-объект). */
  static #extractShape(obj: TiledObject): ShapeData | null {
    if (obj.point) return { kind: 'point' };
    if (obj.ellipse) return { kind: 'ellipse', width: obj.width, height: obj.height };
    if (obj.capsule) return { kind: 'capsule', width: obj.width, height: obj.height };
    if (obj.polygon && obj.polygon.length > 0) return { kind: 'polygon', points: obj.polygon };
    if (obj.polyline && obj.polyline.length > 0) return { kind: 'polyline', points: obj.polyline };
    return null;
  }

  /** 📝 Создать Pixi Text из Tiled text object. */
  static #createText(tiledText: TiledText, w: number, _h: number): Text {
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

  /** 🔄 Применить flip-флаги gid к спрайту tile-объекта. */
  static #applyGidFlip(
    sprite: Sprite,
    decoded: { hFlip: boolean; vFlip: boolean; diagRot: boolean },
  ): void {
    if (decoded.hFlip) sprite.scale.x = -1;
    if (decoded.vFlip) sprite.scale.y = -1;
    if (decoded.diagRot) sprite.rotation = -Math.PI / 2;
  }

  /** 📋 Tiled properties `[{name, type, value}]` → plain object. */
  static #propertiesToObject(props: TiledProperty[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const p of props) {
      out[p.name] = p.value;
    }
    return out;
  }
}
