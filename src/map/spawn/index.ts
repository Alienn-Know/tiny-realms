/**
 * 📦 Barrel для папки `spawn/`.
 *
 * Внешний код импортирует через `./map/spawn` (а не напрямую `./map/spawn/ObjectSpawner`).
 * Внутренняя структура может меняться без поломки внешних импортов.
 */
export { ObjectSpawner } from './ObjectSpawner';
export type { SpawnContext } from './spawnContext';
