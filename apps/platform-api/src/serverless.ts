import type { IncomingMessage, ServerResponse } from "node:http";
import { handleComposition } from "./compose";

/**
 * Vercel / Node serverless entry for the composition API.
 * Domain traffic → services/* owned handlers exclusively.
 */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const handled = await handleComposition(req, res);
  if (handled) return;

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      message: "Not Found",
      mode: "composition",
      hint: "No domain owner for this path",
    }),
  );
}
