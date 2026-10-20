/**
 * Lightweight, zero-dependency QR Code generator in TypeScript.
 * Encodes text into a 2D boolean array (true = black module, false = white module).
 */

export type QrMatrix = boolean[][];

export class QrCode {
  readonly size: number;
  private readonly modules: boolean[][];

  constructor(size: number) {
    this.size = size;
    this.modules = [];
    for (let y = 0; y < size; y++) {
      this.modules.push(new Array(size).fill(false));
    }
  }

  getModule(x: number, y: number): boolean {
    if (x < 0 || x >= this.size || y < 0 || y >= this.size) return false;
    return this.modules[y][x];
  }

  setModule(x: number, y: number, isDark: boolean): void {
    if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
      this.modules[y][x] = isDark;
    }
  }

  toMatrix(): boolean[][] {
    return this.modules.map(row => [...row]);
  }
}

// Galois Field GF(256) math for Reed-Solomon
const EXP_TABLE = new Uint8Array(256);
const LOG_TABLE = new Uint8Array(256);
(() => {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = val;
    LOG_TABLE[val] = i;
    val = (val << 1) ^ (val >= 128 ? 0x11d : 0);
  }
  EXP_TABLE[255] = EXP_TABLE[0];
})();

function gfMultiply(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[x] + LOG_TABLE[y]) % 255];
}

function reedSolomonComputeDivisor(degree: number): Uint8Array {
  const result = new Uint8Array(degree + 1);
  result[0] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = result.length - 1; j >= 1; j--) {
      result[j] = gfMultiply(result[j], root) ^ result[j - 1];
    }
    result[0] = gfMultiply(result[0], root);
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonComputeRemainder(data: Uint8Array, divisor: Uint8Array): Uint8Array {
  const degree = divisor.length - 1;
  const result = new Uint8Array(degree);
  for (const b of data) {
    const factor = b ^ result[0];
    for (let i = 0; i < degree - 1; i++) {
      result[i] = result[i + 1] ^ gfMultiply(divisor[divisor.length - 1 - i], factor);
    }
    result[degree - 1] = gfMultiply(divisor[1], factor);
  }
  return result;
}

// QR Table for Version 1 to 10 (ECC Level M)
// [version, totalCodewords, dataCodewords, ecCodewordsPerBlock, numBlocks]
const VERSION_PARAMS: [number, number, number, number, number][] = [
  [1, 26, 16, 10, 1],
  [2, 44, 28, 16, 1],
  [3, 70, 44, 26, 1],
  [4, 100, 64, 18, 2],
  [5, 134, 86, 24, 2],
  [6, 172, 108, 16, 4],
  [7, 196, 124, 18, 4],
  [8, 242, 154, 22, 4],
  [9, 292, 182, 22, 5],
  [10, 346, 216, 26, 5],
];

// Alignment pattern centers for versions 1 to 10
const ALIGNMENT_POS: number[][] = [
  [], // v1 (none)
  [6, 18], // v2
  [6, 22], // v3
  [6, 26], // v4
  [6, 30], // v5
  [6, 34], // v6
  [6, 22, 38], // v7
  [6, 24, 42], // v8
  [6, 26, 46], // v9
  [6, 28, 50], // v10
];

class BitBuffer {
  private buffer: number[] = [];
  private length = 0;

  get bitLength(): number {
    return this.length;
  }

  append(val: number, numBits: number): void {
    for (let i = numBits - 1; i >= 0; i--) {
      this.buffer.push((val >>> i) & 1);
      this.length++;
    }
  }

  getByte(index: number): number {
    let b = 0;
    for (let i = 0; i < 8; i++) {
      const bitIndex = index * 8 + i;
      if (bitIndex < this.buffer.length) {
        b = (b << 1) | this.buffer[bitIndex];
      } else {
        b = b << 1;
      }
    }
    return b;
  }

  getBytes(): Uint8Array {
    const totalBytes = Math.ceil(this.length / 8);
    const result = new Uint8Array(totalBytes);
    for (let i = 0; i < totalBytes; i++) {
      result[i] = this.getByte(i);
    }
    return result;
  }
}

export function generateQrMatrix(text: string): boolean[][] {
  const utf8Encoder = new TextEncoder();
  const textBytes = utf8Encoder.encode(text);

  // Find minimum version that fits data in Byte Mode (ECC Level M)
  let selectedVersion = -1;
  let totalDataCodewords = 0;
  let ecCodewordsPerBlock = 0;
  let numBlocks = 0;

  for (const [ver, _total, dataWords, ecWords, blocks] of VERSION_PARAMS) {
    const requiredBits = 4 + (ver <= 9 ? 8 : 16) + textBytes.length * 8;
    if (requiredBits <= dataWords * 8) {
      selectedVersion = ver;
      totalDataCodewords = dataWords;
      ecCodewordsPerBlock = ecWords;
      numBlocks = blocks;
      break;
    }
  }

  if (selectedVersion === -1) {
    selectedVersion = 10;
    totalDataCodewords = VERSION_PARAMS[9][2];
    ecCodewordsPerBlock = VERSION_PARAMS[9][3];
    numBlocks = VERSION_PARAMS[9][4];
  }

  const bb = new BitBuffer();
  // Byte mode: 0100
  bb.append(0b0100, 4);
  // Character count indicator
  bb.append(textBytes.length, selectedVersion <= 9 ? 8 : 16);
  // Data bytes
  for (const b of textBytes) {
    bb.append(b, 8);
  }

  // Terminator (up to 4 zeroes)
  const remainingBits = totalDataCodewords * 8 - bb.bitLength;
  bb.append(0, Math.min(4, Math.max(0, remainingBits)));

  // Pad to byte boundary
  if (bb.bitLength % 8 !== 0) {
    bb.append(0, 8 - (bb.bitLength % 8));
  }

  // Pad bytes 0xEC, 0x11
  let padToggle = false;
  while (bb.bitLength < totalDataCodewords * 8) {
    bb.append(padToggle ? 0x11 : 0xec, 8);
    padToggle = !padToggle;
  }

  const dataBytes = bb.getBytes();

  // Divide into blocks and compute Reed-Solomon EC for each block
  const blockDataWords = Math.floor(totalDataCodewords / numBlocks);
  const shortBlocks = numBlocks - (totalDataCodewords % numBlocks);
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];

  const divisor = reedSolomonComputeDivisor(ecCodewordsPerBlock);
  let dataOffset = 0;

  for (let b = 0; b < numBlocks; b++) {
    const blockSize = blockDataWords + (b >= shortBlocks ? 1 : 0);
    const blockData = dataBytes.slice(dataOffset, dataOffset + blockSize);
    dataOffset += blockSize;
    dataBlocks.push(blockData);

    const padded = new Uint8Array(blockSize + ecCodewordsPerBlock);
    padded.set(blockData, 0);
    const ec = reedSolomonComputeRemainder(padded, divisor);
    ecBlocks.push(ec);
  }

  // Interleave data and EC codewords
  const finalCodewords: number[] = [];
  const maxBlockLen = blockDataWords + (shortBlocks < numBlocks ? 1 : 0);
  for (let i = 0; i < maxBlockLen; i++) {
    for (let b = 0; b < numBlocks; b++) {
      if (i < dataBlocks[b].length) {
        finalCodewords.push(dataBlocks[b][i]);
      }
    }
  }
  for (let i = 0; i < ecCodewordsPerBlock; i++) {
    for (let b = 0; b < numBlocks; b++) {
      finalCodewords.push(ecBlocks[b][i]);
    }
  }

  // Assemble QR Grid
  const qrSize = 17 + 4 * selectedVersion;
  const qr = new QrCode(qrSize);
  const isFunction = Array.from({ length: qrSize }, () => new Array(qrSize).fill(false));

  const markFunction = (x: number, y: number, isDark: boolean) => {
    qr.setModule(x, y, isDark);
    isFunction[y][x] = true;
  };

  // 1. Finder patterns
  const drawFinder = (startX: number, startY: number) => {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const x = startX + dx;
        const y = startY + dy;
        if (x >= 0 && x < qrSize && y >= 0 && y < qrSize) {
          const isDark =
            dx >= 0 &&
            dx <= 6 &&
            dy >= 0 &&
            dy <= 6 &&
            (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
          markFunction(x, y, isDark);
        }
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(qrSize - 7, 0);
  drawFinder(0, qrSize - 7);

  // 2. Timing patterns
  for (let i = 8; i < qrSize - 8; i++) {
    if (!isFunction[6][i]) markFunction(i, 6, i % 2 === 0);
    if (!isFunction[i][6]) markFunction(6, i, i % 2 === 0);
  }

  // 3. Alignment patterns
  const alignPoints = ALIGNMENT_POS[selectedVersion - 1];
  for (let i = 0; i < alignPoints.length; i++) {
    for (let j = 0; j < alignPoints.length; j++) {
      const cx = alignPoints[i];
      const cy = alignPoints[j];
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === alignPoints.length - 1) ||
        (i === alignPoints.length - 1 && j === 0)
      ) {
        continue;
      }
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const isDark = Math.max(Math.abs(dx), Math.abs(dy)) !== 1;
          markFunction(cx + dx, cy + dy, isDark);
        }
      }
    }
  }

  // 4. Reserve format bits areas
  for (let i = 0; i < 9; i++) {
    if (i < qrSize) {
      if (!isFunction[8][i]) isFunction[8][i] = true;
      if (!isFunction[i][8]) isFunction[i][8] = true;
    }
  }
  for (let i = qrSize - 8; i < qrSize; i++) {
    if (!isFunction[8][i]) isFunction[8][i] = true;
    if (!isFunction[i][8]) isFunction[i][8] = true;
  }
  markFunction(8, qrSize - 8, true);

  // 5. Place data bits (Mask 0: (x + y) % 2 === 0)
  let codewordIdx = 0;
  let bitIdx = 7;
  for (let right = qrSize - 1; right > 0; right -= 2) {
    if (right === 6) right--;
    for (let vert = 0; vert < qrSize; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? qrSize - 1 - vert : vert;

        if (!isFunction[y][x]) {
          let dark = false;
          if (codewordIdx < finalCodewords.length) {
            dark = ((finalCodewords[codewordIdx] >>> bitIdx) & 1) !== 0;
            bitIdx--;
            if (bitIdx < 0) {
              bitIdx = 7;
              codewordIdx++;
            }
          }
          if ((x + y) % 2 === 0) {
            dark = !dark;
          }
          qr.setModule(x, y, dark);
        }
      }
    }
  }

  // 6. Format bits for ECC M (00) + Mask 0 (000) -> 00000
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];

  const positionsTopLeft = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
  ];
  for (let i = 0; i < 15; i++) {
    const [fx, fy] = positionsTopLeft[i];
    qr.setModule(fx, fy, formatBits[i] === 1);
  }

  for (let i = 0; i < 7; i++) {
    qr.setModule(qrSize - 1 - i, 8, formatBits[i] === 1);
  }
  for (let i = 7; i < 15; i++) {
    qr.setModule(8, qrSize - 15 + i, formatBits[i] === 1);
  }

  return qr.toMatrix();
}
