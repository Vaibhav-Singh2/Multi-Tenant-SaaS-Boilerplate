import { GenericContainer, type StartedTestContainer } from "testcontainers";

// ─── PostgreSQL ───────────────────────────────────────────────────────────────

export interface StartedPostgresContainer {
  container: StartedTestContainer;
  connectionString: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export async function startPostgresContainer(): Promise<StartedPostgresContainer> {
  const user = "testuser";
  const password = "testpassword";
  const database = "testdb";

  const container = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({
      POSTGRES_USER: user,
      POSTGRES_PASSWORD: password,
      POSTGRES_DB: database,
    })
    .withExposedPorts(5432)
    .withStartupTimeout(60_000)
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(5432);
  const connectionString = `postgres://${user}:${password}@${host}:${port}/${database}`;

  return { container, connectionString, host, port, database, user, password };
}

// ─── Redis ────────────────────────────────────────────────────────────────────

export interface StartedRedisContainer {
  container: StartedTestContainer;
  connectionString: string;
  host: string;
  port: number;
}

export async function startRedisContainer(): Promise<StartedRedisContainer> {
  const container = await new GenericContainer("redis:7-alpine")
    .withExposedPorts(6379)
    .withStartupTimeout(30_000)
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(6379);
  const connectionString = `redis://${host}:${port}`;

  return { container, connectionString, host, port };
}
