/**
 * Production entry — composition edge.
 * Domain traffic → services/* owned handlers exclusively (no Nest domain).
 */
module.exports = require("../composition/api.js");
