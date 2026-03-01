export interface QuotaUsage {
  apiKey: string;
  dailyTokens: number;
  monthlyTokens: number;
  lastResetDaily: Date;
  lastResetMonthly: Date;
  requestsCount: number;
}

export interface QuotaLimit {
  dailyTokenLimit: number;
  monthlyTokenLimit: number;
}

export interface QuotaCheckResult {
  allowed: boolean;
  remainingDaily: number;
  remainingMonthly: number;
  reason?: string;
}

export interface QuotaManager {
  /**
   * 检查 API Key 是否存在且有效
   */
  isValidApiKey(apiKey: string): boolean;

  /**
   * 检查配额是否足够
   */
  checkQuota(apiKey: string, estimatedTokens: number): QuotaCheckResult;

  /**
   * 消耗配额（在请求处理后调用）
   */
  consumeQuota(apiKey: string, usedTokens: number): void;

  /**
   * 获取配额使用情况
   */
  getUsage(apiKey: string): QuotaUsage | null;

  /**
   * 重置配额（手动或定时任务）
   */
  resetQuota(apiKey?: string): void;

  /**
   * 获取所有 API Key 的使用情况
   */
  getAllUsage(): QuotaUsage[];

  /**
   * 添加新的 API Key
   */
  addApiKey(apiKey: string, limits?: Partial<QuotaLimit>): void;

  /**
   * 移除 API Key
   */
  removeApiKey(apiKey: string): void;

  /**
   * 获取 API Key 的配额限制
   */
  getLimits(apiKey: string): QuotaLimit | null;

  /**
   * 更新 API Key 的配额限制
   */
  updateLimits(apiKey: string, limits: Partial<QuotaLimit>): void;
}
