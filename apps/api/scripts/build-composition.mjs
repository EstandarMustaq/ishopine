import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "composition"), { recursive: true });

await build({
  entryPoints: [join(root, "src/composition-serverless.ts")],
  outfile: join(root, "composition/api.js"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: true,
  logLevel: "info",
  // Keep native/binary packages external for Vercel includeFiles
  external: ["@prisma/client", ".prisma/client", "sharp"],
  footer: {
    js: "module.exports = module.exports.default || module.exports;",
  },
});

console.log("[api] composition bundle ok");
