---
name: return-case-management
description: Use when designing or changing return, refund, order, evidence, eligibility, or merchant API workflows. Enforces legitimate ownership, human authorization, merchant-policy compliance, idempotency, and auditable state transitions.
---
# Return Case Management

## Guardrails
- Work only with orders demonstrably owned or administered by the requesting user/merchant.
- Create a return request only for a genuine, supported reason and only under the seller's current policy.
- Never fabricate evidence, claim non-delivery/damage without basis, submit duplicate claims, or automate a payment/refund without approval.

## Workflow
1. Import authorised order data through an approved integration or user-provided evidence.
2. Evaluate eligibility against a versioned policy snapshot; show missing evidence and deadline.
3. Create a case in `draft`; collect explicit user attestation and consent.
4. Queue external submission behind a human approval gate. Use idempotency key and provider request/response audit references.
5. Reconcile webhook/poll updates; never infer monetary success from UI text alone.

## Required controls
- State machine; append-only audit events; actor, reason, policy version and timestamps.
- RBAC and step-up authentication for privileged approvals.
- Data-retention schedule, erasure path, encrypted PII and redacted logs.
- All provider actions must be retry-safe and reversible where the provider supports it.
