import { build } from "esbuild";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "composition");
const require = createRequire(import.meta.url);

mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [join(root, "src/composition-serverless.ts")],
  outfile: join(outDir, "api.js"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: true,
  logLevel: "info",
  // Native addons stay external; we vendor them next to the bundle.
  external: ["@prisma/client", ".prisma/client", "sharp"],
  footer: {
    js: "module.exports = module.exports.default || module.exports;",
  },
});

/** Resolve pnpm realpath for a package and copy into composition/node_modules. */
function vendorPackage(name) {
  const resolved = require.resolve(`${name}/package.json`);
  const pkgDir = dirname(resolved);
  const dest = join(outDir, "node_modules", name);
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  cpSync(pkgDir, dest, { recursive: true });
  return dest;
}

function vendorPrismaEngines() {
  // .prisma/client lives next to @prisma/client in the pnpm store layout
  const clientPkg = dirname(require.resolve("@prisma/client/package.json"));
  const prismaClientDir = join(clientPkg, "..", ".prisma", "client");
  const alt = join(clientPkg, "node_modules", ".prisma", "client");
  const src = existsSync(prismaClientDir)
    ? prismaClientDir
    : existsSync(alt)
      ? alt
      : null;
  if (!src) {
    // Walk up from @prisma/client to find .prisma/client
    let dir = clientPkg;
    for (let i = 0; i < 8; i++) {
      const candidate = join(dir, ".prisma", "client");
      if (existsSync(candidate)) {
        const dest = join(outDir, "node_modules", ".prisma", "client");
        mkdirSync(dirname(dest), { recursive: true });
        if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
        cpSync(candidate, dest, { recursive: true });
        console.log("[api] vendored .prisma/client from", candidate);
        return;
      }
      dir = dirname(dir);
    }
    throw new Error("Could not locate .prisma/client engines to vendor");
  }
  const dest = join(outDir, "node_modules", ".prisma", "client");
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
  console.log("[api] vendored .prisma/client from", src);
}

vendorPackage("@prisma/client");
vendorPrismaEngines();

// sharp is optional at cold start (dynamic import in media). Vendor if present.
try {
  const sharpEntry = require.resolve("sharp");
  // .../node_modules/sharp/dist/index.cjs → package root
  let sharpDir = dirname(sharpEntry);
  while (sharpDir !== dirname(sharpDir)) {
    const pkgPath = join(sharpDir, "package.json");
    if (existsSync(pkgPath)) {
      const name = JSON.parse(readFileSync(pkgPath, "utf8")).name;
      if (name === "sharp") break;
    }
    sharpDir = dirname(sharpDir);
  }
  const dest = join(outDir, "node_modules", "sharp");
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  cpSync(sharpDir, dest, { recursive: true });
  const imgDir = join(sharpDir, "node_modules", "@img");
  if (existsSync(imgDir)) {
    const imgDest = join(outDir, "node_modules", "@img");
    if (existsSync(imgDest)) rmSync(imgDest, { recursive: true, force: true });
    cpSync(imgDir, imgDest, { recursive: true });
  }
  console.log("[api] vendored sharp from", sharpDir);
} catch (err) {
  console.warn("[api] sharp not vendored:", err.message);
}

writeFileSync(
  join(outDir, "package.json"),
  JSON.stringify({ type: "commonjs", private: true }, null, 2),
);

const engines = existsSync(join(outDir, "node_modules", ".prisma", "client"))
  ? readdirSync(join(outDir, "node_modules", ".prisma", "client")).filter((f) =>
      f.includes("libquery_engine"),
    )
  : [];
console.log("[api] composition bundle ok; engines:", engines.join(", ") || "none");
