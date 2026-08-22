import { readFileSync, statSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

export function resolvePublicFile(pathname: string): { path: string; type: string } | null {
  const trimmed = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const safe = normalize(trimmed);
  if (safe.startsWith("..") || safe.includes(`..${sep}`)) return null;
  const full = join(PUBLIC_DIR, safe);
  if (!full.startsWith(PUBLIC_DIR)) return null;
  try {
    if (!statSync(full).isFile()) return null;
  } catch {
    return null;
  }
  return { path: full, type: TYPES[extname(full)] ?? "application/octet-stream" };
}

export function readPublicFile(pathname: string): { body: Buffer; type: string } | null {
  const resolved = resolvePublicFile(pathname);
  if (!resolved) return null;
  return { body: readFileSync(resolved.path), type: resolved.type };
}
