import Fastify, { type FastifyInstance } from 'fastify';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });
  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async () => ({ status: 'ready', dependencies: { database: 'not_checked', queue: 'not_checked' } }));
  app.get('/v1', async () => ({ name: 'refund-operations-api', version: '0.1.0' }));
  return app;
}
