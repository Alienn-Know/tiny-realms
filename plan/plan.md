# 🎮 План движка для PixiJS Top-Down Pixel Game

## 🧠 Архитектура ядра

**ECS (Entity-Component-System)** — обязательно для такой игры. Сцен-граф Pixi — только для рендера, логика в собственных системах поверх данных.

```
core/
  ecs/        — World, Entity, Component, System
  loop/       — Fixed-timestap (60 логики) + render frame
  state/      — стек состояний (Game, Inventory, Build, Dialog)
  events/     — шина событий (damage, death, chunk_loaded)
  math/       — Vec2, AABB, circle, raycast
  assets/     — Assets.load + кеш
  save/       — сериализация мира/перса
```

**Цикл:** `fixedUpdate(dt=1/60) → Systems.run() → renderer.render(app.stage)`. Логика детерминирована по тикам — критично для будущей сети.

**Стейт-машина поверх:** `Boot → Loading → Menu → Game(Pause/Inventory/Build/Combat)`.

---

## ⚔️ Карта и мир (Tiled → бесконечный)

**Парсер Tiled JSON** — отдельный модуль `map/TiledLoader`. Конвертирует в рантайм-формат:
- слои тайлов → чанки 32×32 (или 16×16) тайлов
- объекты → entity-templates
- тайлсеты → атласы Pixi (`Spritesheet`)
- свойства тайлов → физика/коллизии/разрушаемость

**Чанковая система:**
```
MapChunk { cx, cy, tiles[], entities[], dirty, version }
ChunkManager — грузит радиус вокруг камеры, LRU-выгрузка
WorldStream — генератор: simplex noise (terrain) + биомы + структуры
```

**Бесконечность:** Tiled-карта как «стартовая зона», дальше — `WorldStream` дописывает чанки по seed (детерминированно, важно для сети). Коллизии и рендер — общий интерфейс `IChunkSource`.

**Слои рендера Pixi:** ground → ground-deco → entities → effects → lighting → UI.

---

## ⚙️ Управление (8 направлений + touch)

Один вход — `InputState { moveX, moveY, aimX, aimY, buttons[] }`. Нормализуется по диагонали.

- **PC:** WASD + мышь (прицел/цель), QWER — скилы, B — инвентарь, Shift — спринт
- **Mobile:** левый виртуальный стик (move), правый (aim), кнопки скилов поверх

`InputSystem` → `MovementSystem` — нормализация вектора × `speed × dt`. Анимация по `Math.atan2(aim.y, aim.x)` с 8 направлениями.

---

## ✅ UI / Инвентарь

Data-driven: `UIComponent { type, data, slots[] }`. Инвентарь — сетка `slots[rows][cols]` + drag&drop. Отдельно:
- HUD: HP/MP полоски, скил-бар, мини-карта
- Окна: инвентарь, крафт, прокачка, настройки
- Тултипы, драг-превью

Рендер: Pixi Containers + DOM overlay для текстовых полей ввода (если будут). Все строки в одном `i18n.ts`.

---

## ⚔️ Юниты, питомцы, AI

```
Entity { kind: Player|Pet|NPC|Enemy|Projectile, ... }
StatsComponent { hp, maxHp, mana, armor, speed, dmg ... }
AIComponent { behavior: tree|state-machine, target, aggroRange }
PetComponent { owner, follow, command: Idle|Follow|Attack|Stay }
```

AI — `BehaviorTree` (последовательность, селектор, декораторы) + `StateMachine` для боссов. Pet-команды как `IntentEvent`.

---

## ⚔️ Боевая система (как в Dota 2)

**Damage pipeline** (стадии с модификаторами):
```
Source → PreMitigation (базовый урон + бонусы) 
       → Armor/MagicResist (формула Dota: dmg × (1 - 0.06×armor / (1+0.06×|armor|)))
       → DamageType (Physical/Magical/Pure)
       → Block/Absorb/Immune
       → Final → hp
```

**Статусы:** Stun, Slow, Silence, Root, Disarm, Invulnerable — как `StatusEffect` с тиками.

**Скилы:**
- `ActiveSkill { castTime, cooldown, cost, range, targetType, onCast }`
- `PassiveSkill { trigger, condition, effect }`
- `AuraSkill { radius, modifiers[] }` — апдейтится в `AuraSystem`
- **Projectile:** `ProjectileComponent { source, target, speed, behavior: linear|homing|arc, hitRadius, onHit }`
- **Баллистика:** `BallisticSystem` — gravity для arc, хоминг с коррекцией курса, столкновения через spatial-hash

**Прокачка:** `LevelSystem` + skill-tree JSON (узлы с пре-реквизитами).

---

## 🎆 Эффекты и частицы

**GPU-частицы:** `@pixi/particle-emitter` (или своё на `ParticleContainer`). Профили частиц в JSON.

**Система эффектов:**
- одноразовые: взрыв, искры, blood
- зацикленные: аура, trail
- скриптованные: `VfxGraph { steps: [{t, action}] }` — по таймеру

Освещение: `LightingSystem` (point/ambient) через `BlitFilter` или `pixi-filters`. Дневной/ночной цикл.

---

## 🏗️ Строительство и изменение мира

**Сетка размещения:** `BuildGrid` (то же, что `CollisionGrid`, разные маски). Действия:
- `place(x, y, tileId, rotation)` 
- `remove(x, y)` → дроп
- `mine(x, y, tool, power)` → с прогрессом HP тайла
- `paint(x, y, newTile)` — terraform

**Тайлы-объекты:** `PlacedEntity { defId, hp, owner, rot, items[] }` — для сундуков, печей, верстаков. Тик в `ProductionSystem`.

**Сеть:** все мутации мира — `WorldOp { id, kind, payload }` с версией чанка. Чанк помечается `dirty=true` → пересериализация для соседей/клиентов.

**Синхронизация с рендером:** dirty-чанк → перестроить `tilemap` Pixi (через `Tilemap` или свой атлас).

---

## 🌐 Сеть (план, реализация позже)

**Архитектура:** authoritative server (Node/ts + Colyseus или Rust/Bevy). Клиент — input + state-interpolation.

**Подготовка с самого начала:**
- Все мутации — через `WorldOp` (cmd-паттерн)
- Детерминированный fixed-timestep
- EntityId = server-issued
- `InterestManager` — AoI вокруг игрока
- Replication с приоритетами: ближе = чаще
- Для питомцев/юнитов — ownership

**Протокол:** WebSocket + бинарный (msgpack/protobuf). Предактинг на клиенте + серверная валидация.

---

## 🧾 Приоритеты реализации

| Фаза | Что | Срок |
|---|---|---|
| 0 | Каркас: Vite + Pixi v8 + ECS + GameLoop | 2–3 дня |
| 1 | Tiled-загрузчик + камера + 8-направленное движение | 1 нед |
| 2 | Анимация, базовый HUD, инвентарь | 1 нед |
| 3 | Боевая: damage pipeline, 1–2 скила, projectile | 1–2 нед |
| 4 | Эффекты, частицы, освещение | 3–5 дней |
| 5 | Чанкование + procedural-генерация | 1–2 нед |
| 6 | Строительство/добыча | 1 нед |
| 7 | AI, питомцы, прокачка | 1–2 нед |
| 8 | Сеть (AoI, replication) | 2+ нед |

---

## ⚠️ Главные риски

- **Чанковый рендер Pixi:** `pixi-tilemap` (map.z 5+) либо `pixi-supertilemap` — выбрать и зафиксировать с фазы 1
- **Двойные источники правды:** ECS-state vs Pixi-sprites — синхронизировать через `RenderSystem` (один), иначе расхождения
- **Сеть потом:** без ECS+WorldOp+deterministic-tick с самого начала — переделка всего
