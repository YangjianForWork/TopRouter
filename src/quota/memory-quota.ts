import { LRUCache } from "lru-cache";
import type { QuotaManager, QuotaUsage, QuotaLimit, QuotaCheckResult } from "./types.js";

export interface MemoryQuotaOptions {
  apiKeys?: string[];
  defaultDailyTokenLimit?: number;
  defaultMonthlyTokenLimit?: number;
  maxApiKeys?: number;
  quotaResetHour?: number; // UTC hour (0-23) to reset daily quota
}

export class MemoryQuotaManager implements QuotaManager {
  private quotaCache: LRUCache<string, QuotaUsage>;
  private limits: Map<string, QuotaLimit>;
  private defaultLimits: QuotaLimit;
  private quotaResetHour: number;

  constructor(options: MemoryQuotaOptions = {}) {
    const maxKeys = options.maxApiKeys || 1000;
    this.quotaCache = new LRUCache<string, QuotaUsage>({
      max: maxKeys,
      ttl: 30 * 24 * 60 * 60 * 1000, // 30 days retention
      updateAgeOnGet: true,
    });

    this.defaultLimits = {
      dailyTokenLimit: options.defaultDailyTokenLimit || 1000000,
      monthlyTokenLimit: options.defaultMonthlyTokenLimit || 30000000,
    };

    this.quotaResetHour = options.quotaResetHour || 0;
    this.limits = new Map();

    // Initialize with provided API keys
    if (options.apiKeys) {
      for (const apiKey of options.apiKeys) {
        this.addApiKey(apiKey);
      }
    }

    // Start periodic quota reset check
    this.startQuotaResetChecker();
  }

  isValidApiKey(apiKey: string): boolean {
    return this.limits.has(apiKey);
  }

  checkQuota(apiKey: string, estimatedTokens: number): QuotaCheckResult {
    if (!this.isValidApiKey(apiKey)) {
      return {
        allowed: false,
        remainingDaily: 0,
        remainingMonthly: 0,
        reason: "Invalid API key",
      };
    }

    const usage = this.getOrCreateUsage(apiKey);
    const limits = this.limits.get(apiKey) || this.defaultLimits;

    // Check if quota needs reset
    this.checkAndResetQuotaIfNeeded(usage);

    const remainingDaily = Math.max(0, limits.dailyTokenLimit - usage.dailyTokens);
    const remainingMonthly = Math.max(0, limits.monthlyTokenLimit - usage.monthlyTokens);

    const hasDailyQuota = remainingDaily >= estimatedTokens;
    const hasMonthlyQuota = remainingMonthly >= estimatedTokens;

    if (!hasDailyQuota) {
      return {
        allowed: false,
        remainingDaily,
        remainingMonthly,
        reason: "Daily token limit exceeded",
      };
    }

    if (!hasMonthlyQuota) {
      return {
        allowed: false,
        remainingDaily,
        remainingMonthly,
        reason: "Monthly token limit exceeded",
      };
    }

    return {
      allowed: true,
      remainingDaily,
      remainingMonthly,
    };
  }

  consumeQuota(apiKey: string, usedTokens: number): void {
    if (!this.isValidApiKey(apiKey)) {
      return;
    }

    const usage = this.getOrCreateUsage(apiKey);
    this.checkAndResetQuotaIfNeeded(usage);

    usage.dailyTokens += usedTokens;
    usage.monthlyTokens += usedTokens;
    usage.requestsCount += 1;

    this.quotaCache.set(apiKey, usage);
  }

  getUsage(apiKey: string): QuotaUsage | null {
    if (!this.isValidApiKey(apiKey)) {
      return null;
    }

    const usage = this.getOrCreateUsage(apiKey);
    this.checkAndResetQuotaIfNeeded(usage);
    return { ...usage }; // Return copy
  }

  resetQuota(apiKey?: string): void {
    if (apiKey) {
      const usage = this.quotaCache.get(apiKey);
      if (usage) {
        usage.dailyTokens = 0;
        usage.monthlyTokens = 0;
        usage.lastResetDaily = new Date();
        usage.lastResetMonthly = new Date();
        usage.requestsCount = 0;
        this.quotaCache.set(apiKey, usage);
      }
    } else {
      // Reset all quotas
      for (const key of this.quotaCache.keys()) {
        const usage = this.quotaCache.get(key);
        if (usage) {
          usage.dailyTokens = 0;
          usage.monthlyTokens = 0;
          usage.lastResetDaily = new Date();
          usage.lastResetMonthly = new Date();
          usage.requestsCount = 0;
          this.quotaCache.set(key, usage);
        }
      }
    }
  }

  getAllUsage(): QuotaUsage[] {
    const usages: QuotaUsage[] = [];
    for (const [apiKey, usage] of this.quotaCache.entries()) {
      if (this.isValidApiKey(apiKey)) {
        this.checkAndResetQuotaIfNeeded(usage);
        usages.push({ ...usage });
      }
    }
    return usages;
  }

  addApiKey(apiKey: string, customLimits?: Partial<QuotaLimit>): void {
    const limits: QuotaLimit = {
      dailyTokenLimit: customLimits?.dailyTokenLimit ?? this.defaultLimits.dailyTokenLimit,
      monthlyTokenLimit: customLimits?.monthlyTokenLimit ?? this.defaultLimits.monthlyTokenLimit,
    };

    this.limits.set(apiKey, limits);

    // Initialize usage record if not exists
    if (!this.quotaCache.has(apiKey)) {
      const now = new Date();
      const usage: QuotaUsage = {
        apiKey,
        dailyTokens: 0,
        monthlyTokens: 0,
        lastResetDaily: now,
        lastResetMonthly: now,
        requestsCount: 0,
      };
      this.quotaCache.set(apiKey, usage);
    }
  }

  removeApiKey(apiKey: string): void {
    this.limits.delete(apiKey);
    this.quotaCache.delete(apiKey);
  }

  getLimits(apiKey: string): QuotaLimit | null {
    const limits = this.limits.get(apiKey);
    if (!limits) return null;
    return { ...limits }; // Return copy
  }

  updateLimits(apiKey: string, newLimits: Partial<QuotaLimit>): void {
    const currentLimits = this.limits.get(apiKey);
    if (!currentLimits) {
      throw new Error(`API key not found: ${apiKey}`);
    }

    const updatedLimits: QuotaLimit = {
      dailyTokenLimit: newLimits.dailyTokenLimit ?? currentLimits.dailyTokenLimit,
      monthlyTokenLimit: newLimits.monthlyTokenLimit ?? currentLimits.monthlyTokenLimit,
    };

    this.limits.set(apiKey, updatedLimits);
  }

  private getOrCreateUsage(apiKey: string): QuotaUsage {
    let usage = this.quotaCache.get(apiKey);
    if (!usage) {
      const now = new Date();
      usage = {
        apiKey,
        dailyTokens: 0,
        monthlyTokens: 0,
        lastResetDaily: now,
        lastResetMonthly: now,
        requestsCount: 0,
      };
      this.quotaCache.set(apiKey, usage);
    }
    return usage;
  }

  private checkAndResetQuotaIfNeeded(usage: QuotaUsage): void {
    const now = new Date();

    // Check daily reset (based on UTC hour)
    const lastResetDaily = new Date(usage.lastResetDaily);
    const shouldResetDaily = this.shouldResetQuota(lastResetDaily, now, "daily");

    if (shouldResetDaily) {
      usage.dailyTokens = 0;
      usage.lastResetDaily = now;
    }

    // Check monthly reset (1st day of month)
    const lastResetMonthly = new Date(usage.lastResetMonthly);
    const shouldResetMonthly = this.shouldResetQuota(lastResetMonthly, now, "monthly");

    if (shouldResetMonthly) {
      usage.monthlyTokens = 0;
      usage.lastResetMonthly = now;
    }
  }

  private shouldResetQuota(lastReset: Date, now: Date, type: "daily" | "monthly"): boolean {
    if (type === "daily") {
      // Reset if:
      // 1. Different day (UTC), OR
      // 2. Same day but past reset hour and last reset was before reset hour
      const resetHour = this.quotaResetHour;
      const lastResetDay = lastReset.getUTCDate();
      const nowDay = now.getUTCDate();
      const lastResetHour = lastReset.getUTCHours();
      const nowHour = now.getUTCHours();

      if (lastResetDay !== nowDay) {
        return true;
      }

      // Same day, check if we're past reset hour and last reset was before reset hour
      if (nowHour >= resetHour && lastResetHour < resetHour) {
        return true;
      }

      return false;
    } else {
      // Monthly reset: check if different month
      return (
        lastReset.getUTCMonth() !== now.getUTCMonth() ||
        lastReset.getUTCFullYear() !== now.getUTCFullYear()
      );
    }
  }

  private startQuotaResetChecker(): void {
    // Check every hour if quotas need reset
    setInterval(
      () => {
        for (const [apiKey, usage] of this.quotaCache.entries()) {
          this.checkAndResetQuotaIfNeeded(usage);
          this.quotaCache.set(apiKey, usage);
        }
      },
      60 * 60 * 1000,
    ); // 1 hour
  }
}
