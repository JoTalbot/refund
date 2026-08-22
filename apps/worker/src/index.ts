import { EnvSecretResolver } from "@refund/persist";

export function workerMode(env: NodeJS.ProcessEnv = process.env): "lease" | "temporal" {
  return env.TEMPORAL_ADDRESS_SECRET_ID ? "temporal" : "lease";
}

export async function describeWorker(env: NodeJS.ProcessEnv = process.env) {
  const secrets = new EnvSecretResolver(env);
  const temporalAddress = env.TEMPORAL_ADDRESS_SECRET_ID
    ? await secrets.resolve(env.TEMPORAL_ADDRESS_SECRET_ID)
    : undefined;
  return {
    mode: workerMode(env),
    databaseSecretId: env.DATABASE_URL_SECRET_ID ?? null,
    temporalConfigured: Boolean(temporalAddress),
    connectors: [],
  };
}

if (process.env.VITEST !== "true") {
  const info = await describeWorker();
  process.stdout.write(JSON.stringify({ msg: "worker-ready", ...info }) + "\n");
}
