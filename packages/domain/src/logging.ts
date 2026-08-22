import { ValidationError } from "./errors.js";
import type { StructuredLog } from "./types.js";

const SECRETISH =
  /password|secret|token|authorization|cookie|set-cookie|database_url|postgres:\/\/|ghp_[A-Za-z0-9]|bearer\s+[A-Za-z0-9._-]+/i;

export function createLogEvent(input: {
  level?: StructuredLog["level"];
  message: string;
  traceId: string;
  actorId?: string;
  caseId?: string;
  sourceId?: string;
  action?: string;
  status?: number;
}): StructuredLog {
  if (!input.message.trim()) {
    throw new ValidationError("log message is required");
  }
  const event: StructuredLog = {
    level: input.level ?? "info",
    message: scrub(input.message),
    traceId: input.traceId || "trace-local",
    actorId: input.actorId,
    caseId: input.caseId,
    sourceId: input.sourceId,
    action: input.action,
    status: input.status,
  };
  assertNoSecrets(event);
  return event;
}

export function formatLogLine(event: StructuredLog): string {
  assertNoSecrets(event);
  return `${JSON.stringify(event)}\n`;
}

export function assertNoSecrets(value: unknown): void {
  const text = JSON.stringify(value);
  if (SECRETISH.test(text)) {
    throw new ValidationError("refusing to log secret-like material");
  }
}

export function scrub(text: string): string {
  return text.replace(SECRETISH, "[redacted]");
}

export interface LogSink {
  write(event: StructuredLog): void;
}

export class MemoryLogSink implements LogSink {
  readonly events: StructuredLog[] = [];

  write(event: StructuredLog): void {
    assertNoSecrets(event);
    this.events.push(event);
  }
}

export class StderrLogSink implements LogSink {
  write(event: StructuredLog): void {
    process.stderr.write(formatLogLine(event));
  }
}
