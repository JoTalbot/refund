export interface SecretResolver {
  resolve(secretId: string): Promise<string | undefined>;
}

export class EnvSecretResolver implements SecretResolver {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async resolve(secretId: string): Promise<string | undefined> {
    if (!secretId) return undefined;
    if (secretId === this.env.DATABASE_URL_SECRET_ID) {
      return undefinedIfBlank(this.env.DATABASE_URL);
    }
    if (secretId === this.env.TEMPORAL_ADDRESS_SECRET_ID) {
      return undefinedIfBlank(this.env.TEMPORAL_ADDRESS);
    }
    const encoded = secretId.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase();
    return undefinedIfBlank(this.env[encoded] ?? this.env[secretId]);
  }
}

export function redactSecret(value: string): string {
  return value.replace(/:([^:@/]+)@/g, ":***@");
}

export async function resolveDatabaseUrl(
  secrets: SecretResolver,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | undefined> {
  const secretId = env.DATABASE_URL_SECRET_ID;
  if (secretId) {
    return secrets.resolve(secretId);
  }
  return undefinedIfBlank(env.DATABASE_URL);
}

function undefinedIfBlank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
