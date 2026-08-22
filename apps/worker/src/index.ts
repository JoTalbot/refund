/** Durable workflow workers will be attached here. Workers must use job leases,
 * idempotency keys and external checkpoints; no critical state lives on this host. */
console.log(JSON.stringify({ service: 'refund-worker', status: 'idle', timestamp: new Date().toISOString() }));
