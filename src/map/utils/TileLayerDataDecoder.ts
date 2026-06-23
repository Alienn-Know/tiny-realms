/**
 * 🗜️ TileLayerDataDecoder — декодинг data tile-слоя в Int32Array.
 *
 * Поддерживаемые форматы (Tiled JSON):
 * - `encoding: 'csv'` (default) → data: number[]
 * - `encoding: 'base64'` + `compression: ''`   → data: base64-string
 * - `encoding: 'base64'` + `compression: 'zlib'` → deflate
 * - `encoding: 'base64'` + `compression: 'gzip'`
 * - `encoding: 'base64'` + `compression: 'zstd'` → ⚠️ skip + warn (нет нативной поддержки)
 *
 * Для infinite maps: `chunks[]` парсятся отдельно, сливаем в плоский массив.
 */

import type { TiledChunk, TiledCompression, TiledEncoding, TiledTileLayer } from '../TiledTypes';

/** 📦 Результат декодинга: gid-данные + per-tile флаги трансформации. */
export type DecodedTileData = {
  /** 🆔 GIDs без флагов (построчно, row-major). */
  data: Int32Array;
  /** 🔄 Per-tile флаги: [hFlip, vFlip, diagRot] упакованы в 4 бита. */
  flipFlags: Uint8Array;
};

/** 🔧 Декодировать base64 → Uint8Array (browser atob). */
function decodeBase64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** 🗜️ Распаковать zlib/gzip через DecompressionStream (built-in browser API). */
async function decompress(bytes: Uint8Array, format: 'deflate' | 'gzip'): Promise<Uint8Array> {
  const ds = new DecompressionStream(format);
  const writer = ds.writable.getWriter();
  // Копируем в новый ArrayBuffer чтобы избежать SharedArrayBuffer-проблем с типами
  const safeBytes = new Uint8Array(bytes.length);
  safeBytes.set(bytes);
  writer.write(safeBytes);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let totalLen = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLen += value.length;
  }
  const out = new Uint8Array(totalLen);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

/** 📦 Bytes → Int32Array (little-endian, Tiled использует LE). */
function bytesToInt32(bytes: Uint8Array): Int32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = bytes.byteLength >>> 2;
  const out = new Int32Array(count);
  for (let i = 0; i < count; i++) out[i] = view.getInt32(i * 4, true);
  return out;
}

/** 🗜️ Распаковать base64 + compression → raw gids (с флагами). */
async function decodeBase64Layer(
  b64: string,
  compression: TiledCompression,
): Promise<Int32Array> {
  const bytes = decodeBase64ToBytes(b64);
  switch (compression) {
    case '':
      return bytesToInt32(bytes);
    case 'zlib':
      return bytesToInt32(await decompress(bytes, 'deflate'));
    case 'gzip':
      return bytesToInt32(await decompress(bytes, 'gzip'));
    case 'zstd': {
      console.warn(
        '[TileLayerDataDecoder] zstd compression не поддерживается в браузере. ' +
          'Слой будет пустым. Используйте zlib/gzip/csv.',
      );
      return new Int32Array(0);
    }
  }
}

/** 🔍 Разделить gids на чистые gid + флаги flip. */
function splitFlipFlags(raw: Int32Array): DecodedTileData {
  const data = new Int32Array(raw.length);
  const flipFlags = new Uint8Array(raw.length);
  const H = 0x80000000;
  const V = 0x40000000;
  const D = 0x20000000;
  const MASK = ~(H | V | D) >>> 0;
  for (let i = 0; i < raw.length; i++) {
    const g = raw[i];
    data[i] = (g & MASK) >>> 0;
    flipFlags[i] =
      (g & H ? 1 : 0) | (g & V ? 2 : 0) | (g & D ? 4 : 0);
  }
  return { data, flipFlags };
}

/** 🔧 Декодировать данные tile-слоя (полная карта, не chunks). */
export async function decodeTileLayer(layer: TiledTileLayer): Promise<DecodedTileData> {
  const encoding: TiledEncoding = layer.encoding ?? 'csv';
  const compression: TiledCompression = layer.compression ?? '';

  if (encoding === 'csv') {
    if (!Array.isArray(layer.data)) {
      throw new Error(`[TileLayerDataDecoder] layer "${layer.name}": csv encoding ожидает array data`);
    }
    return splitFlipFlags(Int32Array.from(layer.data as number[]));
  }

  if (encoding === 'base64') {
    if (typeof layer.data !== 'string') {
      throw new Error(`[TileLayerDataDecoder] layer "${layer.name}": base64 encoding ожидает string data`);
    }
    const raw = await decodeBase64Layer(layer.data, compression);
    return splitFlipFlags(raw);
  }

  throw new Error(`[TileLayerDataDecoder] layer "${layer.name}": unknown encoding "${encoding}"`);
}

/** 🧩 Декодировать один chunk (infinite map). */
export async function decodeChunk(chunk: TiledChunk): Promise<DecodedTileData> {
  if (Array.isArray(chunk.data)) {
    return splitFlipFlags(Int32Array.from(chunk.data));
  }
  // base64 chunks не имеют своих encoding/compression полей — берём deflate по умолчанию
  const raw = await decodeBase64Layer(chunk.data, '');
  return splitFlipFlags(raw);
}

/** 🧩 Результат flatten: данные + вычисленный bounding box для infinite maps. */
export type FlattenedChunks = DecodedTileData & {
  /** 📐 Вычисленная ширина (в тайлах) по bounding box всех chunks. */
  realWidth: number;
  /** 📐 Вычисленная высота (в тайлах). */
  realHeight: number;
  /** ↔️ Смещение мира в тайлах: worldTileX = arrayIdxX + offsetX. */
  offsetX: number;
  /** ↕️ Смещение мира в тайлах. */
  offsetY: number;
};

/** 🧩 Слить chunks в плоский Int32Array для finite-подобного доступа.
 *
 * Для infinite maps вычисляет bounding box всех chunks (включая отрицательные
 * координаты), создаёт массив по bounding box и сдвигает все индексы так,
 чтобы минимум был (0, 0). Возвращает offset для конвертации array→world coords.
 *
 * @param chunks - список chunks с их decoded data
 */
export function flattenChunks(
  chunks: { x: number; y: number; width: number; height: number; decoded: DecodedTileData }[],
): FlattenedChunks {
  if (chunks.length === 0) {
    return { data: new Int32Array(0), flipFlags: new Uint8Array(0), realWidth: 0, realHeight: 0, offsetX: 0, offsetY: 0 };
  }

  // Вычисляем bounding box всех chunks
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of chunks) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x + c.width > maxX) maxX = c.x + c.width;
    if (c.y + c.height > maxY) maxY = c.y + c.height;
  }
  const realWidth = maxX - minX;
  const realHeight = maxY - minY;

  const data = new Int32Array(realWidth * realHeight);
  const flipFlags = new Uint8Array(realWidth * realHeight);

  for (const c of chunks) {
    for (let ry = 0; ry < c.height; ry++) {
      for (let rx = 0; rx < c.width; rx++) {
        // Сдвигаем в положительные координаты
        const dstX = c.x + rx - minX;
        const dstY = c.y + ry - minY;
        if (dstX < 0 || dstY < 0 || dstX >= realWidth || dstY >= realHeight) continue;
        const srcIdx = ry * c.width + rx;
        const dstIdx = dstY * realWidth + dstX;
        data[dstIdx] = c.decoded.data[srcIdx];
        flipFlags[dstIdx] = c.decoded.flipFlags[srcIdx];
      }
    }
  }
  return { data, flipFlags, realWidth, realHeight, offsetX: minX, offsetY: minY };
}
