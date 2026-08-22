import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHandler } from "./http.js";
import { Platform } from "./platform.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const allowDevActor = process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_ACTOR === "1";

const platform = new Platform();
const handle = createHandler(platform, { allowDevActor });

export function readRequest(request: IncomingMessage, bodyText: string) {
  const hostHeader = request.headers.host ?? "localhost";
  const url = new URL(request.url ?? "/", `http://${hostHeader}`);
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value === "string") headers[key] = value;
    else if (Array.isArray(value)) headers[key] = value.join(",");
  }
  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value;
  }
  let body: unknown = null;
  if (bodyText) {
    body = JSON.parse(bodyText) as unknown;
  }
  return {
    method: request.method ?? "GET",
    path: url.pathname,
    headers,
    query,
    body,
  };
}

const server = createServer((request: IncomingMessage, response: ServerResponse) => {
  const chunks: Buffer[] = [];
  request.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });
  request.on("end", () => {
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader(
      "access-control-allow-headers",
      "content-type, x-actor-id, x-actor-role, x-tenant-id, x-step-up, x-trace-id, idempotency-key",
    );
    response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    try {
      const parsed = readRequest(request, Buffer.concat(chunks).toString("utf8"));
      const result = handle(parsed);
      response.writeHead(result.status);
      response.end(JSON.stringify(result.body));
    } catch (error) {
      response.writeHead(400);
      response.end(JSON.stringify({ error: "bad_request", message: (error as Error).message }));
    }
  });
});

if (process.env.VITEST !== "true") {
  server.listen(port, host, () => {
    process.stdout.write(JSON.stringify({ msg: "listening", host, port }) + "\n");
  });
}

export { server };
