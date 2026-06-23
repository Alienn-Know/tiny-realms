/**
 * 🔧 gid — утилиты для Global Tile ID.
 *
 * В Tiled верхние биты gid хранят флаги трансформации:
 * - bit 32: FLIPPED_HORIZONTALLY
 * - bit 31: FLIPPED_VERTICALLY
 * - bit 30: FLIPPED_DIAGONALLY (rotate 90° + flip)
 *
 * Ссылка: https://doc.mapeditor.org/en/stable/global-tile-ids/
 */

/** ↔️ Бит horizontal flip. */
export const FLIPPED_HORIZONTALLY = 0x80000000;
/** ↕️ Бит vertical flip. */
export const FLIPPED_VERTICALLY = 0x40000000;
/** 🔄 Бит diagonal rotation (90° + flip). */
export const FLIPPED_DIAGONALLY = 0x20000000;

/** 🧩 Маска для очистки флагов (оставляет только localId/gid). */
const GID_MASK = ~(FLIPPED_HORIZONTALLY | FLIPPED_VERTICALLY | FLIPPED_DIAGONALLY) >>> 0;

/** 🔄 Распакованный gid: localId + 3 флага трансформации. */
export type DecodedGid = {
  /** 🆔 gid без флагов (для resolveGid). */
  gid: number;
  /** ↔️ Horizontal flip. */
  hFlip: boolean;
  /** ↕️ Vertical flip. */
  vFlip: boolean;
  /** 🔄 Diagonal rotation (90° anti-clockwise + flip). */
  diagRot: boolean;
};

/** 🔍 Распаковать gid: выделить localId и флаги трансформации. */
export function decodeGid(rawGid: number): DecodedGid {
  return {
    gid: (rawGid & GID_MASK) >>> 0,
    hFlip: (rawGid & FLIPPED_HORIZONTALLY) !== 0,
    vFlip: (rawGid & FLIPPED_VERTICALLY) !== 0,
    diagRot: (rawGid & FLIPPED_DIAGONALLY) !== 0,
  };
}

/** 🔧 Запаковать gid + флаги обратно (для редактирования/экспорта). */
export function encodeGid(gid: number, hFlip: boolean, vFlip: boolean, diagRot: boolean): number {
  return (
    (gid & GID_MASK) |
    (hFlip ? FLIPPED_HORIZONTALLY : 0) |
    (vFlip ? FLIPPED_VERTICALLY : 0) |
    (diagRot ? FLIPPED_DIAGONALLY : 0)
  ) >>> 0;
}

/** 🗂️ 4-битная маска флагов: [hFlip, vFlip, diagRot] → 0..7. */
export function packFlipFlags(hFlip: boolean, vFlip: boolean, diagRot: boolean): number {
  return (hFlip ? 1 : 0) | (vFlip ? 2 : 0) | (diagRot ? 4 : 0);
}

/** 🗂️ Распаковать 4-битную маску флагов. */
export function unpackFlipFlags(flags: number): { hFlip: boolean; vFlip: boolean; diagRot: boolean } {
  return {
    hFlip: (flags & 1) !== 0,
    vFlip: (flags & 2) !== 0,
    diagRot: (flags & 4) !== 0,
  };
}
