import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(ROOT, "manifest.json");
const release = process.argv[2] || "patch";
const allowed = new Set(["patch", "minor", "major"]);

if (!allowed.has(release)) {
  console.error("Usage: npm run version:patch | version:minor | version:major");
  process.exit(1);
}

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const parts = String(manifest.version || "0.0.0").split(".").map(value => Number.parseInt(value, 10));
while (parts.length < 3) parts.push(0);
if (parts.some(value => !Number.isInteger(value) || value < 0)) {
  throw new Error(`Invalid manifest version: ${manifest.version}`);
}

if (release === "major") {
  parts[0] += 1;
  parts[1] = 0;
  parts[2] = 0;
} else if (release === "minor") {
  parts[1] += 1;
  parts[2] = 0;
} else {
  parts[2] += 1;
}

manifest.version = parts.join(".");
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`manifest.json version -> ${manifest.version}`);
