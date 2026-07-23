/**
 * Vercel entry. Default: Nest shell (health + cron) until composition is
 * promoted. Set COMPOSITION_BUILD=1 in build to emit composition/api.js and
 * switch this file — see apps/api/README.md and docs/SERVICES.md.
 *
 * Domain ownership lives in services/*; Nest must not re-implement domains.
 */
module.exports = require("../dist/src/serverless.js");
