import type { ClassificationCache } from "./cache.js";
import { TopClassifier } from "./classifier.js";
import type { LLMClassifier } from "./llm-classifier.js";
import type { ScoringResult } from "./classifier.js";

export interface EnhancedClassifierOptions {
  l1Cache?: ClassificationCache | undefined;
  l2Classifier?: LLMClassifier | undefined;
  confidenceThreshold?: number; // default 0.7
}

export class EnhancedClassifier {
  private l1: TopClassifier;
  private l2: LLMClassifier | undefined;
  private confidenceThreshold: number;

  constructor(options: EnhancedClassifierOptions = {}) {
    this.l1 = new TopClassifier(options.l1Cache);
    this.l2 = options.l2Classifier;
    this.confidenceThreshold = options.confidenceThreshold ?? 0.7;
  }

  async classify(prompt: string, estimatedTokens: number): Promise<ScoringResult> {
    // Step 1: L1 classification
    const l1Result = this.l1.classify(prompt, estimatedTokens);

    // Step 2: Check confidence threshold
    if (l1Result.confidence >= this.confidenceThreshold || !this.l2) {
      return l1Result;
    }

    // Step 3: Fallback to L2 LLM classification
    console.log(`L2 fallback triggered for prompt: ${prompt.substring(0, 100)}...`);
    try {
      const l2Result = await this.l2.classify(prompt, estimatedTokens);
      // Blend results? For now, trust L2 completely
      // Could combine or weight by confidence
      return l2Result;
    } catch (error) {
      console.error("L2 classification failed, falling back to L1:", error);
      return l1Result;
    }
  }

  // Synchronous classify (returns L1 only, no fallback)
  classifySync(prompt: string, estimatedTokens: number): ScoringResult {
    return this.l1.classify(prompt, estimatedTokens);
  }
}
