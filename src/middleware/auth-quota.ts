import type { Request, Response, NextFunction } from "express";
import type { QuotaManager } from "../quota/types.js";

export interface AuthQuotaOptions {
  quotaManager: QuotaManager;
  requireApiKey?: boolean;
  headerName?: string;
  headerPrefix?: string;
}

/**
 * 提取 API Key 的辅助函数
 */
function extractApiKey(req: Request, options: AuthQuotaOptions): string | null {
  const headerName = options.headerName || "authorization";
  const headerPrefix = options.headerPrefix || "Bearer ";

  // 从指定头部提取
  const headerValue = req.headers[headerName.toLowerCase()] as string;

  if (headerValue) {
    if (headerPrefix && headerValue.startsWith(headerPrefix)) {
      return headerValue.slice(headerPrefix.length).trim();
    }
    return headerValue.trim();
  }

  // 也检查 X-API-Key
  const xApiKey = req.headers["x-api-key"] as string;
  if (xApiKey) {
    return xApiKey.trim();
  }

  // 检查查询参数
  const queryKey = req.query.api_key as string;
  if (queryKey) {
    return queryKey.trim();
  }

  return null;
}

/**
 * 创建认证和配额检查中间件
 */
export function createAuthQuotaMiddleware(
  options: AuthQuotaOptions,
): (req: Request, res: Response, next: NextFunction) => void {
  const { quotaManager, requireApiKey = true } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // 健康检查端点不需要认证
    if (req.path === "/health") {
      return next();
    }

    // 提取 API Key
    const apiKey = extractApiKey(req, options);

    if (!apiKey) {
      if (requireApiKey) {
        return res.status(401).json({
          error: "Authentication required",
          message: "API key is missing. Provide it in Authorization header or X-API-Key header.",
        });
      } else {
        // 如果没有 API Key 且不是必须的，跳过配额检查
        (req as any).apiKey = null;
        return next();
      }
    }

    // 验证 API Key
    if (!quotaManager.isValidApiKey(apiKey)) {
      return res.status(403).json({
        error: "Invalid API key",
        message: "The provided API key is invalid or has been revoked.",
      });
    }

    // 附加 API Key 到请求对象
    (req as any).apiKey = apiKey;

    // 对于需要估计 Token 的端点，提前检查配额
    // 注意：实际 Token 消耗在请求处理后确定，这里只做预检查
    if (req.method === "POST" && req.path === "/v1/classify") {
      try {
        const body = req.body;
        const estimatedTokens = body.estimatedTokens ?? Math.ceil((body.prompt?.length || 0) / 4);

        // 预检查配额（使用预估 Token 数）
        const quotaCheck = quotaManager.checkQuota(apiKey, estimatedTokens);
        if (!quotaCheck.allowed) {
          return res.status(429).json({
            error: "Quota exceeded",
            message: quotaCheck.reason || "Token limit exceeded",
            remainingDaily: quotaCheck.remainingDaily,
            remainingMonthly: quotaCheck.remainingMonthly,
          });
        }

        // 附加配额检查结果到请求对象，供后续使用
        (req as any).quotaCheck = quotaCheck;
        (req as any).estimatedTokens = estimatedTokens;
      } catch (error) {
        // 如果预检查失败，继续处理（将在端点中处理错误）
        console.warn("Quota pre-check failed:", error);
      }
    }

    next();
  };
}

/**
 * 配额消耗后处理中间件
 * 应该在请求处理完成后调用，以实际消耗的 Token 数更新配额
 */
export function createQuotaConsumeMiddleware(
  quotaManager: QuotaManager,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send.bind(res);

    res.send = function (body: any): any {
      // 请求完成后消耗配额
      try {
        const apiKey = (req as any).apiKey;
        const estimatedTokens = (req as any).estimatedTokens;

        if (apiKey && estimatedTokens && res.statusCode < 400) {
          // 只有成功请求才消耗配额
          quotaManager.consumeQuota(apiKey, estimatedTokens);

          // 添加配额使用情况到响应头
          const usage = quotaManager.getUsage(apiKey);
          const limits = quotaManager.getLimits(apiKey);
          if (usage && limits) {
            res.setHeader(
              "X-Quota-Daily-Remaining",
              Math.max(0, limits.dailyTokenLimit - usage.dailyTokens),
            );
            res.setHeader(
              "X-Quota-Monthly-Remaining",
              Math.max(0, limits.monthlyTokenLimit - usage.monthlyTokens),
            );
            res.setHeader("X-Quota-Daily-Used", usage.dailyTokens);
            res.setHeader("X-Quota-Monthly-Used", usage.monthlyTokens);
          }
        }
      } catch (error) {
        console.error("Failed to consume quota:", error);
      }

      return originalSend(body);
    };

    next();
  };
}

/**
 * 默认的认证和配额中间件
 */
export function authQuotaMiddleware(
  quotaManager: QuotaManager,
): Array<(req: Request, res: Response, next: NextFunction) => void> {
  return [createAuthQuotaMiddleware({ quotaManager }), createQuotaConsumeMiddleware(quotaManager)];
}
