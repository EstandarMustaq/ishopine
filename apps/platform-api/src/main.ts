import http from "node:http";
import handler from "./serverless";

const port = Number(process.env.PORT || 4000);

const server = http.createServer((req, res) => {
  void handler(req, res);
});

server.listen(port, () => {
  console.log(`[platform-api] composition edge :${port}`);
});
