import axios from "axios";
import type { ScoringResult, Tier } from "./classifier.js";

export interface LLMClassifier {
  classify(prompt: string, estimatedTokens: number): Promise<ScoringResult>;
}

export class DeepSeekClassifier implements LLMClassifier {
  private apiKey: string;
  private apiUrl: string;

  constructor(apiKey: string, apiUrl: string = "https://api.deepseek.com") {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
  }

  async classify(prompt: string, _estimatedTokens: number): Promise<ScoringResult> {
    const systemPrompt = `你是一个AI请求分类器。请分析以下用户请求，并返回一个JSON对象，包含以下字段：
- score: 浮点数，范围0-1，表示请求的复杂程度（0最简单，1最复杂）
- tier: 字符串，取值为 "SIMPLE", "MEDIUM", "COMPLEX", "REASONING" 之一
- confidence: 浮点数，范围0-1，表示你对分类的置信度
- signals: 字符串数组，列出你检测到的关键信号（如 "code", "reasoning", "multi-step" 等）

分类标准：
- SIMPLE: 简单问答、定义、翻译、问候等基础请求
- MEDIUM: 需要一定逻辑、代码编写、技术解释等中等复杂请求
- COMPLEX: 涉及系统设计、架构、多步骤操作、长上下文等复杂请求
- REASONING: 需要数学证明、逻辑推导、逐步推理的请求

请只返回JSON，不要额外解释。`;

    try {
      const response = await axios.post(
        `${this.apiUrl}/chat/completions`,
        {
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 200,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        },
      );

      const content = response.data.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error("Empty response from LLM");
      }

      // Parse JSON from response (may contain markdown code blocks)
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/({[\s\S]*})/);
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
      const result = JSON.parse(jsonStr);

      // Validate and normalize result
      const tier = this.normalizeTier(result.tier);
      const score = this.clamp(result.score, 0, 1);
      const confidence = this.clamp(result.confidence, 0, 1);
      const signals = Array.isArray(result.signals) ? result.signals : [];

      return { score, tier, confidence, signals };
    } catch (error) {
      console.error("DeepSeek classification failed:", error);
      // Fallback to a default result
      return {
        score: 0.5,
        tier: "MEDIUM",
        confidence: 0.5,
        signals: ["llm_fallback"],
      };
    }
  }

  private normalizeTier(tier: string): Tier {
    const upper = tier.toUpperCase();
    if (upper === "SIMPLE" || upper === "MEDIUM" || upper === "COMPLEX" || upper === "REASONING") {
      return upper as Tier;
    }
    // Heuristic mapping
    if (upper.includes("REASON") || upper.includes("PROOF")) return "REASONING";
    if (upper.includes("COMPLEX") || upper.includes("DESIGN")) return "COMPLEX";
    if (upper.includes("SIMPLE") || upper.includes("BASIC")) return "SIMPLE";
    return "MEDIUM";
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
