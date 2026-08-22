import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { oidcFromEnv, StderrLogSink } from "@refund/domain";
import { SqlJobStore } from "@refund/persist";
import { createHandler, type ApiRequest } from "./http.js";
import { createRuntime } from "./runtime.js";
import { readPublicFile } from "./static.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const allowDevActor = process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_ACTOR === "1";

export function readRequest(request: IncomingMessage, bodyText: string): ApiRequest {
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

function applyCors(response: ServerResponse): void {
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader(
    "access-control-allow-headers",
    "content-type, authorization, x-actor-id, x-actor-role, x-tenant-id, x-step-up, x-trace-id, idempotency-key",
  );
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
}

export function createHttpServer(handle: (request: ApiRequest) => Promise<{ status: number; body: unknown }>) {
  return createServer((request: IncomingMessage, response: ServerResponse) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      void (async () => {
        applyCors(response);
        if (request.method === "OPTIONS") {
          response.writeHead(204);
          response.end();
          return;
        }
        const hostHeader = request.headers.host ?? "localhost";
        const url = new URL(request.url ?? "/", `http://${hostHeader}`);
        if (request.method === "GET") {
          const file = readPublicFile(url.pathname);
          if (file) {
            response.setHeader("content-type", file.type);
            response.writeHead(200);
            response.end(file.body);
            return;
          }
        }
        response.setHeader("content-type", "application/json; charset=utf-8");
        try {
          const parsed = readRequest(request, Buffer.concat(chunks).toString("utf8"));
          const result = await handle(parsed);
          response.writeHead(result.status);
          response.end(JSON.stringify(result.body));
        } catch (error) {
          response.writeHead(400);
          response.end(JSON.stringify({ error: "bad_request", message: (error as Error).message }));
        }
      })();
    });
  });
}

export async function startServer() {
  const runtime = await createRuntime();
  const handle = createHandler(runtime.platform, {
    allowDevActor,
    store: runtime.store,
    persistence: runtime.persistence,
    oidc: oidcFromEnv(),
    jobs: new SqlJobStore(runtime.sql),
    logger: new StderrLogSink(),
  });
  const httpServer = createHttpServer(handle);
  await new Promise<void>((resolve) => {
    httpServer.listen(port, host, () => {
      process.stdout.write(
        JSON.stringify({ msg: "listening", host, port, persistence: runtime.persistence }) + "\n",
      );
      resolve();
    });
  });
  return httpServer;
}

if (process.env.VITEST !== "true") {
  await startServer();
}
