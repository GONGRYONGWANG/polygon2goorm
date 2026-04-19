import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createStoredZip, ZipArchive } from "../src/zip.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "polygon2goorm-extension.zip");
const INCLUDE = [
  "manifest.json",
  "popup.html",
  "popup.js",
  "styles.css",
  "options.html",
  "options.css",
  "options.js",
  "src",
  "icons"
];
const REQUIRED = [
  "manifest.json",
  "popup.html",
  "popup.js",
  "styles.css",
  "options.html",
  "options.css",
  "options.js",
  "src/polygon.js",
  "src/zip.js",
  "src/util.js",
  "src/crc32.js",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png"
];
const FORBIDDEN = [
  /^\.git\//,
  /^archive\//,
  /^node_modules\//,
  /(^|\/)polygon2goorm-extension\.zip$/,
  /\.zip$/i
];

async function main() {
  const files = [];
  for (const item of INCLUDE) {
    await collect(path.join(ROOT, item), item.split("\\").join("/"), files);
  }

  const zipBytes = await createStoredZip(files);
  await fs.writeFile(OUTPUT, zipBytes);
  await validateZip(zipBytes);
  console.log(`Created ${path.basename(OUTPUT)} (${zipBytes.length} bytes, ${files.length} files)`);
}

async function collect(absolutePath, zipPath, files) {
  const stat = await fs.stat(absolutePath);
  if (stat.isDirectory()) {
    const children = await fs.readdir(absolutePath);
    children.sort();
    for (const child of children) {
      await collect(path.join(absolutePath, child), `${zipPath}/${child}`, files);
    }
    return;
  }

  const normalized = zipPath.split("\\").join("/");
  if (FORBIDDEN.some(pattern => pattern.test(normalized))) {
    throw new Error(`Refusing to package forbidden file: ${normalized}`);
  }
  files.push({ name: normalized, data: new Uint8Array(await fs.readFile(absolutePath)) });
}

async function validateZip(zipBytes) {
  const parsed = await ZipArchive.fromFile({ arrayBuffer: async () => zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength) });
  const names = new Set(parsed.files().map(file => file.name));
  for (const required of REQUIRED) {
    if (!names.has(required)) {
      throw new Error(`Packaged ZIP is missing ${required}`);
    }
  }
  for (const name of names) {
    if (FORBIDDEN.some(pattern => pattern.test(name))) {
      throw new Error(`Packaged ZIP contains forbidden file: ${name}`);
    }
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
