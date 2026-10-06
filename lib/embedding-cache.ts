import { createHash } from "node:crypto";

type CacheEntry = { vector: number[]; expiresAt: number; lastUsedAt: number };

type EmbeddingLoader = (inputs: string[]) => Promise<number[][]>;

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 256;
const cache = new Map<string, CacheEntry>();

export async function getCachedEmbeddings(
  inputs: string[],
  apiKey: string,
  loader: EmbeddingLoader,
  options: { ttlMs?: number; maxEntries?: number } = {},
): Promise<number[][]> {
  const ttlMs = Math.max(1_000, options.ttlMs ?? DEFAULT_TTL_MS);
  const maxEntries = Math.max(1, options.maxEntries ?? DEFAULT_MAX_ENTRIES);
  const now = Date.now();
  const keys = inputs.map((input) => cacheKey(input, apiKey));
  const missingInputs: string[] = [];
  const missingIndexes: number[] = [];
  const vectors = new Array<number[]>(inputs.length);

  for (let index = 0; index < keys.length; index += 1) {
    const entry = cache.get(keys[index]);
    if (!entry || entry.expiresAt <= now) {
      if (entry) cache.delete(keys[index]);
      missingInputs.push(inputs[index]);
      missingIndexes.push(index);
      continue;
    }
    entry.lastUsedAt = now;
    vectors[index] = [...entry.vector];
  }

  if (missingInputs.length > 0) {
    const loaded = await loader(missingInputs);
    if (loaded.length !== missingInputs.length) throw new Error("Embedding provider returned incomplete vectors.");
    loaded.forEach((vector, index) => {
      const value = [...vector];
      cache.set(keys[missingIndexes[index]], { vector: value, expiresAt: now + ttlMs, lastUsedAt: now });
      vectors[missingIndexes[index]] = [...value];
    });
  }

  evictExpiredAndOldest(Date.now(), maxEntries);
  return vectors;
}

export function clearEmbeddingCache(): void {
  cache.clear();
}

export function getEmbeddingCacheStats(): { entries: number } {
  evictExpiredAndOldest(Date.now(), Number.MAX_SAFE_INTEGER);
  return { entries: cache.size };
}

function cacheKey(input: string, apiKey: string): string {
  const keyFingerprint = createHash("sha256").update(apiKey).digest("hex");
  const inputFingerprint = createHash("sha256").update(input).digest("hex");
  return `${keyFingerprint}:${inputFingerprint}`;
}

function evictExpiredAndOldest(now: number, maxEntries: number): void {
  for (const [key, entry] of cache) if (entry.expiresAt <= now) cache.delete(key);
  while (cache.size > maxEntries) {
    const oldest = [...cache.entries()].reduce((candidate, current) => current[1].lastUsedAt < candidate[1].lastUsedAt ? current : candidate);
    cache.delete(oldest[0]);
  }
}
