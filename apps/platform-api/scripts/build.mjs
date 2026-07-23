import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "dist"), { recursive: true });
mkdirSync(join(root, "api"), { recursive: true });

const shared = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: true,
  logLevel: "info",
  // Native / heavy packages stay external; workspace services are bundled.
  external: [
    "@prisma/client",
    ".prisma/client",
    "sharp",
    "bcryptjs",
    "cloudinary",
    "nodemailer",
    "otplib",
    "qrcode",
    "jsonwebtoken",
    "uuid",
  ],
};

await build({
  ...shared,
  entryPoints: [join(root, "src/main.ts")],
  outfile: join(root, "dist/main.js"),
});

await build({
  ...shared,
  entryPoints: [join(root, "src/serverless.ts")],
  outfile: join(root, "dist/serverless.js"),
});

await build({
  ...shared,
  entryPoints: [join(root, "src/serverless.ts")],
  outfile: join(root, "api/index.js"),
  footer: {
    js: "module.exports = module.exports.default || module.exports;",
  },
});

console.log("[platform-api] build ok");
