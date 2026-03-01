import { LRUCache } from "lru-cache";
import type { ScoringResult } from "./classifier.js";

export interface CachedResult {
  result: ScoringResult;
  timestamp: number;
}

export interface ClassificationCache {
  get(key: string): CachedResult | undefined;
  set(key: string, result: ScoringResult): void;
  clear(): void;
  size(): number;
}

export function createCache(options?: { maxSize?: number; ttlMs?: number }): ClassificationCache {
  const maxSize = options?.maxSize ?? 1000;
  const ttlMs = options?.ttlMs ?? 60 * 60 * 1000; // 1 hour default

  const cache = new LRUCache<string, CachedResult>({
    max: maxSize,
    ttl: ttlMs,
    updateAgeOnGet: true,
  });

  return {
    get(key: string): CachedResult | undefined {
      return cache.get(key);
    },
    set(key: string, result: ScoringResult): void {
      cache.set(key, { result, timestamp: Date.now() });
    },
    clear(): void {
      cache.clear();
    },
    size(): number {
      return cache.size;
    },
  };
}

export function generateCacheKey(prompt: string, estimatedTokens: number): string {
  return `${prompt}:${estimatedTokens}`;
}
