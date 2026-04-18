import { crc32 } from "./crc32.js";
import { readUint16LE, readUint32LE } from "./util.js";

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;

export class ZipArchive {
  constructor(bytes, entries) {
    this.bytes = bytes;
    this.entries = entries;
  }

  static async fromFile(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return new ZipArchive(bytes, readEntries(bytes));
  }

  files() {
    return this.entries.filter(entry => !entry.name.endsWith("/"));
  }

  find(name) {
    const normalized = normalizePath(name);
    return this.entries.find(entry => normalizePath(entry.name) === normalized);
  }

  findByBasename(name) {
    const lower = name.toLowerCase();
    return this.files().find(entry => basename(entry.name).toLowerCase() === lower);
  }

  async read(entry) {
    const localOffset = entry.localHeaderOffset;
    const local = new DataView(this.bytes.buffer, this.bytes.byteOffset + localOffset);
    if (readUint32LE(local, 0) !== LOCAL_FILE_HEADER) {
      throw new Error(`Invalid local header for ${entry.name}`);
    }
    const nameLength = readUint16LE(local, 26);
    const extraLength = readUint16LE(local, 28);
    const dataStart = localOffset + 30 + nameLength + extraLength;
    const compressed = this.bytes.slice(dataStart, dataStart + entry.compressedSize);

    if (entry.compressionMethod === 0) {
      return compressed;
    }
    if (entry.compressionMethod === 8) {
      return inflateDeflated(compressed, entry.uncompressedSize, entry.name);
    }
    throw new Error(`Unsupported ZIP compression method ${entry.compressionMethod}: ${entry.name}`);
  }
}

export async function createStoredZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    const compressed = await deflateRawForZip(data);
    const method = compressed ? 8 : 0;
    const payload = compressed || data;
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    writeUint32(localView, 0, LOCAL_FILE_HEADER);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0x0800);
    writeUint16(localView, 8, method);
    writeUint16(localView, 10, 0);
    writeUint16(localView, 12, 0);
    writeUint32(localView, 14, crc);
    writeUint32(localView, 18, payload.length);
    writeUint32(localView, 22, data.length);
    writeUint16(localView, 26, nameBytes.length);
    writeUint16(localView, 28, 0);
    local.set(nameBytes, 30);
    localParts.push(local, payload);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    writeUint32(centralView, 0, CENTRAL_DIRECTORY_HEADER);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0x0800);
    writeUint16(centralView, 10, method);
    writeUint16(centralView, 12, 0);
    writeUint16(centralView, 14, 0);
    writeUint32(centralView, 16, crc);
    writeUint32(centralView, 20, payload.length);
    writeUint32(centralView, 24, data.length);
    writeUint16(centralView, 28, nameBytes.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, offset);
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length + payload.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  writeUint32(eocdView, 0, END_OF_CENTRAL_DIRECTORY);
  writeUint16(eocdView, 8, files.length);
  writeUint16(eocdView, 10, files.length);
  writeUint32(eocdView, 12, centralSize);
  writeUint32(eocdView, 16, centralOffset);

  return concatBytes([...localParts, ...centralParts, eocd]);
}

async function deflateRawForZip(data) {
  if (!("CompressionStream" in globalThis)) {
    return null;
  }
  try {
    const stream = new Blob([data]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    return compressed.length > 0 ? compressed : null;
  } catch {
    return null;
  }
}

function readEntries(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findEocd(view);
  const count = readUint16LE(view, eocdOffset + 10);
  const centralOffset = readUint32LE(view, eocdOffset + 16);
  const decoder = new TextDecoder("utf-8");
  const entries = [];
  let offset = centralOffset;

  for (let i = 0; i < count; i++) {
    if (readUint32LE(view, offset) !== CENTRAL_DIRECTORY_HEADER) {
      throw new Error("Invalid ZIP central directory");
    }
    const flags = readUint16LE(view, offset + 8);
    const compressionMethod = readUint16LE(view, offset + 10);
    const compressedSize = readUint32LE(view, offset + 20);
    const uncompressedSize = readUint32LE(view, offset + 24);
    const nameLength = readUint16LE(view, offset + 28);
    const extraLength = readUint16LE(view, offset + 30);
    const commentLength = readUint16LE(view, offset + 32);
    const localHeaderOffset = readUint32LE(view, offset + 42);
    const nameBytes = bytes.slice(offset + 46, offset + 46 + nameLength);
    const name = decoder.decode(nameBytes);
    entries.push({ name, flags, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function findEocd(view) {
  const min = Math.max(0, view.byteLength - 0xffff - 22);
  for (let offset = view.byteLength - 22; offset >= min; offset--) {
    if (readUint32LE(view, offset) === END_OF_CENTRAL_DIRECTORY) {
      return offset;
    }
  }
  throw new Error("ZIP end of central directory not found");
}

async function inflateDeflated(bytes, expectedSize, name) {
  if (!("DecompressionStream" in globalThis)) {
    throw new Error("This browser does not support ZIP deflate decompression.");
  }
  const raw = await tryInflate(bytes, "deflate-raw").catch(() => new Uint8Array());
  if (!expectedSize || raw.length === expectedSize) {
    return raw;
  }

  const wrapped = await tryInflate(bytes, "deflate").catch(() => new Uint8Array());
  if (!expectedSize || wrapped.length === expectedSize) {
    return wrapped;
  }

  throw new Error(`ZIP decompression size mismatch for ${name}: expected ${expectedSize}, got ${raw.length}`);
}

async function tryInflate(bytes, format) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function concatBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function normalizePath(path) {
  return path.replaceAll("\\", "/");
}

function basename(path) {
  return normalizePath(path).split("/").at(-1);
}
