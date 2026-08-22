import { createServer } from "node:http";
import { ALIEXPRESS_UA_SOURCE } from "@refund/domain";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("x-content-type-options", "nosniff");

  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200);
    response.end(JSON.stringify({ ok: true, service: "refund-api" }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/v1/sources/aliexpress-ua") {
    response.writeHead(200);
    response.end(
      JSON.stringify({
        slug: ALIEXPRESS_UA_SOURCE.slug,
        status: ALIEXPRESS_UA_SOURCE.status,
        importAllowed: false,
      }),
    );
    return;
  }

  response.writeHead(404);
  response.end(JSON.stringify({ error: "not_found" }));
});

server.listen(port, host, () => {
  process.stdout.write(JSON.stringify({ msg: "listening", host, port }) + "\n");
});
