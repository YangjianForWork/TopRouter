import express from "express";
import { createCache, generateCacheKey } from "./core/cache.js";
import { EnhancedClassifier } from "./core/enhanced-classifier.js";
import { DeepSeekClassifier } from "./core/llm-classifier.js";
import {
  DeepSeekProvider,
  KimiProvider,
  ZhipuProvider,
  QianwenProvider,
  ModelRouter,
} from "./core/llm-provider.js";
import { MCPServer } from "./mcp/server.js";
import { getConfig } from "./config.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";
import { MemoryQuotaManager } from "./quota/memory-quota.js";
import { authQuotaMiddleware } from "./middleware/auth-quota.js";

const config = getConfig();
const app = express();
app.use(express.json());

// Initialize cache
const cache = createCache({
  maxSize: config.cacheMaxSize,
  ttlMs: config.cacheTtlMs,
});

// Initialize quota manager
const quotaManager = new MemoryQuotaManager({
  apiKeys: config.apiKeys,
  defaultDailyTokenLimit: config.defaultDailyTokenLimit,
  defaultMonthlyTokenLimit: config.defaultMonthlyTokenLimit,
  quotaResetHour: config.quotaResetHour,
});

console.log(`Quota management ${config.enableQuota ? "enabled" : "disabled"}`);
if (config.apiKeys.length > 0) {
  console.log("Quota authentication enabled");
}

// Initialize L2 classifier if API key is provided
let l2Classifier = undefined;
if (config.deepseekApiKey) {
  l2Classifier = new DeepSeekClassifier(config.deepseekApiKey, config.deepseekApiUrl);
  console.log("L2 DeepSeek classifier enabled");
} else {
  console.log("L2 classifier disabled");
}

// Initialize enhanced classifier with L1 cache and optional L2 fallback
const classifier = new EnhancedClassifier({
  l1Cache: cache,
  l2Classifier: l2Classifier,
  confidenceThreshold: config.confidenceThreshold,
});

// Initialize model router for chat completions
const modelRouter = new ModelRouter();
if (config.deepseekApiKey) {
  const deepseekProvider = new DeepSeekProvider(config.deepseekApiKey, config.deepseekApiUrl);
  modelRouter.registerProvider("deepseek", deepseekProvider);
  console.log("DeepSeek provider registered for chat completions");
}
if (config.kimiApiKey) {
  const kimiProvider = new KimiProvider(config.kimiApiKey);
  modelRouter.registerProvider("kimi", kimiProvider);
  console.log("Kimi provider registered for chat completions");
}
if (config.zhipuApiKey) {
  const zhipuProvider = new ZhipuProvider(config.zhipuApiKey);
  modelRouter.registerProvider("zhipu", zhipuProvider);
  console.log("Zhipu provider registered for chat completions");
}
if (config.qianwenApiKey) {
  const qianwenProvider = new QianwenProvider(config.qianwenApiKey);
  modelRouter.registerProvider("qianwen", qianwenProvider);
  console.log("Qianwen provider registered for chat completions");
}

// Initialize MCP server for OpenClaw integration
const mcpServer = new MCPServer({
  classifier,
  modelRouter,
  quotaManager: config.enableQuota ? quotaManager : undefined,
  cache,
  serverInfo: {
    name: "TopRouter MCP Server",
    version: "1.0.0",
  },
});
console.log("MCP server initialized for OpenClaw integration");

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Admin endpoints (no authentication for simplicity)
app.get("/admin/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    cacheSize: cache.size(),
    providers: modelRouter.hasProviders() ? "available" : "none",
    classifier: "enabled",
  });
});

app.get("/admin/providers", (req, res) => {
  const providers = modelRouter.getProviders().map(({ name, provider }) => ({
    name,
    displayName: provider.getDisplayName(),
    models: provider.listModels(),
  }));
  res.json({
    providers,
    count: providers.length,
  });
});

app.get("/admin/keys", (req, res) => {
  if (!config.enableQuota) {
    return res.json({
      quotaEnabled: false,
      message: "Quota management is disabled",
      keys: [],
    });
  }

  const usages = quotaManager.getAllUsage();
  const keys = usages.map(usage => {
    const limits = quotaManager.getLimits(usage.apiKey);
    return {
      apiKey: usage.apiKey.substring(0, 8) + "...", // Mask for security
      limits: limits || { dailyTokenLimit: 0, monthlyTokenLimit: 0 },
      usage: {
        dailyTokens: usage.dailyTokens,
        monthlyTokens: usage.monthlyTokens,
        remainingDaily: limits ? Math.max(0, limits.dailyTokenLimit - usage.dailyTokens) : 0,
        remainingMonthly: limits ? Math.max(0, limits.monthlyTokenLimit - usage.monthlyTokens) : 0,
        lastResetDaily: usage.lastResetDaily.toISOString(),
        lastResetMonthly: usage.lastResetMonthly.toISOString(),
        requestsCount: usage.requestsCount,
      },
    };
  });

  res.json({
    quotaEnabled: true,
    count: keys.length,
    keys,
  });
});

app.get("/admin/stats", (req, res) => {
  const providers = modelRouter.getProviders();
  const providerStats = providers.map(({ name, provider }) => ({
    name,
    displayName: provider.getDisplayName(),
    modelCount: provider.listModels().length,
  }));

  res.json({
    cache: {
      size: cache.size(),
      maxSize: config.cacheMaxSize,
      ttlMs: config.cacheTtlMs,
    },
    providers: {
      count: providers.length,
      details: providerStats,
    },
    quota: {
      enabled: config.enableQuota,
      keyCount: config.enableQuota ? quotaManager.getAllUsage().length : 0,
    },
    server: {
      uptime: process.uptime(),
      environment: config.nodeEnv,
      port: config.port,
    },
  });
});

app.get("/admin/cost", (req, res) => {
  // Placeholder for cost savings dashboard
  // In a real implementation, this would track actual token usage per model
  // and calculate savings based on model pricing differences
  res.json({
    costTrackingEnabled: false,
    message: "Cost tracking not yet implemented. Planned for Phase 3 enhancement.",
    estimatedSavings: {
      monthly: 0,
      currency: "USD",
    },
    recommendations: [
      "Implement token usage tracking per model",
      "Add pricing data for each provider",
      "Calculate savings from routing simple prompts to cheaper models",
    ],
  });
});

// Rate limiting for API endpoints
app.use("/v1", rateLimitMiddleware);

// Authentication and quota middleware (if enabled)
if (config.enableQuota) {
  app.use("/v1", ...authQuotaMiddleware(quotaManager));
  console.log("API key authentication and quota enforcement enabled for /v1 endpoints");
}

// Classification endpoint
app.post("/v1/classify", async (req, res) => {
  try {
    const { prompt, estimatedTokens } = req.body;

    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return res.status(400).json({ error: "prompt is required and must be a non-empty string" });
    }

    const tokens = estimatedTokens ?? Math.ceil(prompt.length / 4); // rough estimate if not provided
    if (typeof tokens !== "number" || tokens < 0) {
      return res.status(400).json({ error: "estimatedTokens must be a non-negative number" });
    }

    const result = await classifier.classify(prompt, tokens);
    res.json({
      ...result,
      cached: cache.get(generateCacheKey(prompt, tokens)) !== undefined,
    });
  } catch (error) {
    console.error("Classification error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Quota usage endpoint (requires API key)
app.get("/v1/quota", (req, res) => {
  try {
    const apiKey = (req as any).apiKey;

    if (!apiKey && config.enableQuota) {
      return res.status(401).json({
        error: "Authentication required",
        message: "API key is required to view quota usage",
      });
    }

    if (!apiKey) {
      // If quota is disabled and no API key, return info about disabled quota
      return res.json({
        quotaEnabled: false,
        message: "Quota management is disabled",
      });
    }

    const usage = quotaManager.getUsage(apiKey);
    const limits = quotaManager.getLimits(apiKey);

    if (!usage || !limits) {
      return res.status(404).json({
        error: "Not found",
        message: "API key not found or quota data unavailable",
      });
    }

    res.json({
      quotaEnabled: true,
      apiKey: apiKey.substring(0, 8) + "...", // Mask for security
      limits: {
        dailyTokenLimit: limits.dailyTokenLimit,
        monthlyTokenLimit: limits.monthlyTokenLimit,
      },
      usage: {
        dailyTokens: usage.dailyTokens,
        monthlyTokens: usage.monthlyTokens,
        remainingDaily: Math.max(0, limits.dailyTokenLimit - usage.dailyTokens),
        remainingMonthly: Math.max(0, limits.monthlyTokenLimit - usage.monthlyTokens),
        lastResetDaily: usage.lastResetDaily.toISOString(),
        lastResetMonthly: usage.lastResetMonthly.toISOString(),
        requestsCount: usage.requestsCount,
      },
    });
  } catch (error) {
    console.error("Quota endpoint error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// OpenAI-compatible chat completions endpoint with intelligent routing
app.post("/v1/chat/completions", async (req, res) => {
  try {
    const { messages, model: requestedModel, temperature, max_tokens, stream } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Invalid request",
        message: "messages must be a non-empty array",
      });
    }

    // Extract prompt from messages (concatenate all content for classification)
    const prompt = messages.map(msg => msg.content).join("\n");
    const estimatedTokens = Math.ceil(prompt.length / 4); // rough estimate

    // Classify the prompt
    const classification = await classifier.classify(prompt, estimatedTokens);
    console.log(
      `Classification: ${classification.tier} (confidence: ${classification.confidence})`
    );

    // Check if any providers are available
    if (!modelRouter.hasProviders()) {
      return res.status(503).json({
        error: "Service unavailable",
        message: "No LLM providers configured. Please set at least one API key.",
      });
    }

    // Route to appropriate provider
    const { provider, model: selectedModel } = modelRouter.routeByTier(
      classification.tier,
      requestedModel
    );

    // Prepare chat completion request
    const chatRequest = {
      model: selectedModel,
      messages,
      temperature,
      max_tokens,
      stream: stream ?? false,
    };

    // Call provider
    const startTime = Date.now();
    const response = await provider.chatCompletion(chatRequest);
    const elapsed = Date.now() - startTime;
    console.log(`Provider ${provider.getDisplayName()} responded in ${elapsed}ms`);

    // Consume quota if enabled and API key is present
    if (config.enableQuota) {
      const apiKey = (req as any).apiKey;
      if (apiKey && quotaManager.isValidApiKey(apiKey)) {
        const usedTokens = response.usage?.total_tokens ?? estimatedTokens;
        quotaManager.consumeQuota(apiKey, usedTokens);
      }
    }

    // Return OpenAI-compatible response
    res.json(response);
  } catch (error) {
    console.error("Chat completion error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// MCP (Model Context Protocol) endpoint for OpenClaw integration
app.post("/mcp", async (req, res) => {
  try {
    const requestBody = req.body;

    if (!requestBody || typeof requestBody !== "object") {
      return res.status(400).json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32600,
          message: "Invalid Request",
          data: "Request body must be a JSON object",
        },
      });
    }

    // Handle the JSON-RPC request
    const response = await mcpServer.handleRequest(requestBody);
    res.json(response);
  } catch (error) {
    console.error("MCP endpoint error:", error);
    res.status(500).json({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32000,
        message: "Internal server error",
        data: error instanceof Error ? error.message : String(error),
      },
    });
  }
});

// Start server
const port = config.port;
app.listen(port, () => {
  console.log(`TopRouter server listening on port ${port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Cache size: ${config.cacheMaxSize}, TTL: ${config.cacheTtlMs}ms`);
});
