export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string) {
    super("forbidden", message);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super("conflict", message);
    this.name = "ConflictError";
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super("validation", message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super("not_found", message);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "authentication required") {
    super("unauthorized", message);
    this.name = "UnauthorizedError";
  }
}

export class AuditImmutabilityError extends DomainError {
  constructor(message = "audit_events is append-only") {
    super("audit_immutable", message);
    this.name = "AuditImmutabilityError";
  }
}

export class RateLimitError extends DomainError {
  constructor(message = "rate limit exceeded") {
    super("rate_limited", message);
    this.name = "RateLimitError";
  }
}
