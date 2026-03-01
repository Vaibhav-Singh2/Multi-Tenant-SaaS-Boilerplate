import { Redis } from "ioredis";

let _client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!_client) {
    const url = process.env["REDIS_URL"] ?? "redis://localhost:6379";
    const client = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      retryStrategy(times: number) {
        if (times > 10) return null; // stop retrying after 10 attempts
        return Math.min(times * 100, 3000);
      },
      reconnectOnError(err: Error) {
        return err.message.includes("READONLY");
      },
      lazyConnect: false,
    });

    client.on("error", (err: Error) => {
      console.error("[Redis] Connection error:", err.message);
    });

    client.on("connect", () => {
      console.info("[Redis] Connected");
    });

    _client = client;
  }
  return _client!;
}

export async function closeRedisClient(): Promise<void> {
  if (_client) {
    await _client.quit();
    _client = null;
  }
}

export type { Redis };
