import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const configSchema = z.object({
  port: z.number().default(94527),
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),
  cacheMaxSize: z.number().default(1000),
  cacheTtlMs: z.number().default(60 * 60 * 1000), // 1 hour
  // LLM provider configuration for L2 fallback
  deepseekApiKey: z.string().optional(),
  deepseekApiUrl: z.string().default("https://api.deepseek.com"),
  geminiApiKey: z.string().optional(),
  // Additional LLM providers
  kimiApiKey: z.string().optional(),
  zhipuApiKey: z.string().optional(),
  qianwenApiKey: z.string().optional(),
  // Confidence threshold for L2 fallback
  confidenceThreshold: z.number().min(0).max(1).default(0.7),
  // Rate limiting
  rateLimitWindowMs: z.number().default(60 * 1000), // 1 minute
  rateLimitMax: z.number().default(100), // requests per window
  // Quota management
  enableQuota: z.boolean().default(false),
  apiKeys: z
    .string()
    .transform((str) => {
      if (!str) return [];
      return str
        .split(",")
        .map((key) => key.trim())
        .filter(Boolean);
    })
    .default(""),
  defaultDailyTokenLimit: z.number().default(1000000), // 1M tokens per day
  defaultMonthlyTokenLimit: z.number().default(30000000), // 30M tokens per month
  quotaResetHour: z.number().min(0).max(23).default(0), // UTC hour to reset daily quota
  // Redis for distributed quota (optional)
  redisUrl: z.string().optional(),
  redisPassword: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

export const config = configSchema.parse({
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
  nodeEnv: process.env.NODE_ENV,
  cacheMaxSize: process.env.CACHE_MAX_SIZE
    ? parseInt(process.env.CACHE_MAX_SIZE, 10)
    : undefined,
  cacheTtlMs: process.env.CACHE_TTL_MS
    ? parseInt(process.env.CACHE_TTL_MS, 10)
    : undefined,
  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  deepseekApiUrl: process.env.DEEPSEEK_API_URL,
  geminiApiKey: process.env.GEMINI_API_KEY,
  kimiApiKey: process.env.KIMI_API_KEY,
  zhipuApiKey: process.env.ZHIPU_API_KEY,
  qianwenApiKey: process.env.QIANWEN_API_KEY,
  confidenceThreshold: process.env.CONFIDENCE_THRESHOLD
    ? parseFloat(process.env.CONFIDENCE_THRESHOLD)
    : undefined,
  rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS
    ? parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10)
    : undefined,
  rateLimitMax: process.env.RATE_LIMIT_MAX
    ? parseInt(process.env.RATE_LIMIT_MAX, 10)
    : undefined,
  enableQuota: process.env.ENABLE_QUOTA
    ? process.env.ENABLE_QUOTA === "true"
    : undefined,
  apiKeys: process.env.API_KEYS,
  defaultDailyTokenLimit: process.env.DEFAULT_DAILY_TOKEN_LIMIT
    ? parseInt(process.env.DEFAULT_DAILY_TOKEN_LIMIT, 10)
    : undefined,
  defaultMonthlyTokenLimit: process.env.DEFAULT_MONTHLY_TOKEN_LIMIT
    ? parseInt(process.env.DEFAULT_MONTHLY_TOKEN_LIMIT, 10)
    : undefined,
  quotaResetHour: process.env.QUOTA_RESET_HOUR
    ? parseInt(process.env.QUOTA_RESET_HOUR, 10)
    : undefined,
  redisUrl: process.env.REDIS_URL,
  redisPassword: process.env.REDIS_PASSWORD,
});

export function getConfig(): Config {
  return config;
}
