import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const wrappersPath = path.join(
  process.cwd(),
  "node_modules",
  "libsodium-wrappers-sumo",
  "dist",
  "modules-sumo-esm",
  "libsodium-wrappers.mjs",
);

if (!existsSync(wrappersPath)) {
  process.exit(0);
}

const brokenImport = 'import e from"./libsodium-sumo.mjs";';
const fixedImport =
  'import e from"../../../libsodium-sumo/dist/modules-sumo-esm/libsodium-sumo.mjs";';

const contents = readFileSync(wrappersPath, "utf8");

if (!contents.includes(brokenImport) || contents.includes(fixedImport)) {
  process.exit(0);
}

writeFileSync(wrappersPath, contents.replace(brokenImport, fixedImport));
