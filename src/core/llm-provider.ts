import axios from "axios";
import type { ScoringResult } from "./classifier.js";

export interface ChatCompletionRequest {
  model?: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
    index: number;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LLMProvider {
  /**
   * 发送聊天补全请求
   */
  chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;

  /**
   * 获取提供商支持的所有模型列表
   */
  listModels(): string[];

  /**
   * 获取提供商的显示名称
   */
  getDisplayName(): string;
}

export class DeepSeekProvider implements LLMProvider {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(
    apiKey: string,
    baseUrl: string = "https://api.deepseek.com",
    defaultModel: string = "deepseek-chat"
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.defaultModel = defaultModel;
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const model = request.model ?? this.defaultModel;
    const url = `${this.baseUrl}/chat/completions`;

    try {
      const response = await axios.post(
        url,
        {
          model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.max_tokens,
          stream: request.stream ?? false,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      // 将 DeepSeek 响应映射为标准格式
      const data = response.data;
      return {
        id: data.id || `deepseek-${Date.now()}`,
        model: data.model || model,
        choices: data.choices.map((choice: any, index: number) => ({
          message: {
            role: choice.message.role,
            content: choice.message.content,
          },
          finish_reason: choice.finish_reason,
          index,
        })),
        usage: data.usage,
      };
    } catch (error) {
      console.error("DeepSeek chat completion failed:", error);
      throw new Error(
        `DeepSeek API error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  listModels(): string[] {
    return ["deepseek-chat", "deepseek-reasoner"];
  }

  getDisplayName(): string {
    return "DeepSeek";
  }
}

export class KimiProvider implements LLMProvider {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(
    apiKey: string,
    baseUrl: string = "https://api.moonshot.cn",
    defaultModel: string = "moonshot-v1-8k"
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.defaultModel = defaultModel;
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const model = request.model ?? this.defaultModel;
    const url = `${this.baseUrl}/v1/chat/completions`;

    try {
      const response = await axios.post(
        url,
        {
          model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.max_tokens,
          stream: request.stream ?? false,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      const data = response.data;
      return {
        id: data.id || `kimi-${Date.now()}`,
        model: data.model || model,
        choices: data.choices.map((choice: any, index: number) => ({
          message: {
            role: choice.message.role,
            content: choice.message.content,
          },
          finish_reason: choice.finish_reason,
          index,
        })),
        usage: data.usage,
      };
    } catch (error) {
      console.error("Kimi chat completion failed:", error);
      throw new Error(`Kimi API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  listModels(): string[] {
    return ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"];
  }

  getDisplayName(): string {
    return "Kimi (Moonshot AI)";
  }
}

export class ZhipuProvider implements LLMProvider {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(
    apiKey: string,
    baseUrl: string = "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: string = "glm-4-plus"
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.defaultModel = defaultModel;
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const model = request.model ?? this.defaultModel;
    const url = `${this.baseUrl}/chat/completions`;

    try {
      const response = await axios.post(
        url,
        {
          model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.max_tokens,
          stream: request.stream ?? false,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      const data = response.data;
      return {
        id: data.id || `zhipu-${Date.now()}`,
        model: data.model || model,
        choices: data.choices.map((choice: any, index: number) => ({
          message: {
            role: choice.message.role,
            content: choice.message.content,
          },
          finish_reason: choice.finish_reason,
          index,
        })),
        usage: data.usage,
      };
    } catch (error) {
      console.error("Zhipu chat completion failed:", error);
      throw new Error(`Zhipu API error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  listModels(): string[] {
    return ["glm-4-plus", "glm-4-vision", "glm-3-turbo"];
  }

  getDisplayName(): string {
    return "Zhipu AI (GLM)";
  }
}

export class QianwenProvider implements LLMProvider {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor(
    apiKey: string,
    baseUrl: string = "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: string = "qwen-plus"
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.defaultModel = defaultModel;
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const model = request.model ?? this.defaultModel;
    const url = `${this.baseUrl}/chat/completions`;

    try {
      const response = await axios.post(
        url,
        {
          model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.max_tokens,
          stream: request.stream ?? false,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      const data = response.data;
      return {
        id: data.id || `qianwen-${Date.now()}`,
        model: data.model || model,
        choices: data.choices.map((choice: any, index: number) => ({
          message: {
            role: choice.message.role,
            content: choice.message.content,
          },
          finish_reason: choice.finish_reason,
          index,
        })),
        usage: data.usage,
      };
    } catch (error) {
      console.error("Qianwen chat completion failed:", error);
      throw new Error(
        `Qianwen API error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  listModels(): string[] {
    return ["qwen-plus", "qwen-max", "qwen-turbo"];
  }

  getDisplayName(): string {
    return "Qianwen (Alibaba)";
  }
}

/**
 * 根据分类结果选择模型的简单路由器
 */
export function selectModelByTier(tier: ScoringResult["tier"]): string {
  return getModelsByTier(tier)[0]!;
}

/**
 * 根据分类结果获取推荐的模型列表（按优先级排序）
 */
export function getModelsByTier(tier: ScoringResult["tier"]): string[] {
  switch (tier) {
    case "SIMPLE":
    case "MEDIUM":
      // 简单任务：轻量级模型
      return [
        "deepseek-chat",
        "moonshot-v1-8k",
        "glm-3-turbo",
        "qwen-turbo",
        "glm-4-plus",
        "qwen-plus",
        "moonshot-v1-32k",
      ];
    case "COMPLEX":
    case "REASONING":
      // 复杂任务：高性能模型
      return [
        "deepseek-reasoner",
        "moonshot-v1-128k",
        "glm-4-plus",
        "qwen-max",
        "glm-4-vision",
        "qwen-plus",
        "moonshot-v1-32k",
      ];
    default:
      return ["deepseek-chat"];
  }
}

/**
 * 模型路由器，根据分类结果和配置选择提供商
 */
export class ModelRouter {
  private providers: Map<string, LLMProvider> = new Map();

  registerProvider(name: string, provider: LLMProvider): void {
    this.providers.set(name, provider);
  }

  getProvider(name: string): LLMProvider | undefined {
    return this.providers.get(name);
  }

  hasProviders(): boolean {
    return this.providers.size > 0;
  }

  getProviders(): Array<{ name: string; provider: LLMProvider }> {
    return Array.from(this.providers.entries()).map(([name, provider]) => ({
      name,
      provider,
    }));
  }

  /**
   * 根据分类结果选择提供商和模型
   */
  routeByTier(
    tier: ScoringResult["tier"],
    preferredModel?: string
  ): { provider: LLMProvider; model: string } {
    // 如果有首选模型，尝试查找支持该模型的提供商
    if (preferredModel) {
      for (const provider of this.providers.values()) {
        if (provider.listModels().includes(preferredModel)) {
          return { provider, model: preferredModel };
        }
      }
    }

    // 否则根据 tier 选择模型
    const tierModels = getModelsByTier(tier);
    for (const model of tierModels) {
      for (const provider of this.providers.values()) {
        if (provider.listModels().includes(model)) {
          return { provider, model };
        }
      }
    }

    // 回退到第一个可用的提供商
    const firstProvider = this.providers.values().next().value;
    if (!firstProvider) {
      throw new Error("No LLM provider available");
    }
    const models = firstProvider.listModels();
    if (models.length === 0) {
      throw new Error("No models available in provider");
    }
    return { provider: firstProvider, model: models[0]! };
  }
}
