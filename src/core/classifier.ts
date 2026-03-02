import {
  CODE_KEYWORDS,
  REASONING_KEYWORDS,
  SIMPLE_KEYWORDS,
  TECHNICAL_KEYWORDS,
  CREATIVE_KEYWORDS,
  AGENTIC_KEYWORDS,
  IMPERATIVE_VERBS,
  CONSTRAINT_INDICATORS,
  OUTPUT_FORMAT_KEYWORDS,
  REFERENCE_KEYWORDS,
  NEGATION_KEYWORDS,
  DOMAIN_SPECIFIC_KEYWORDS,
  DIMENSION_WEIGHTS,
  TIER_BOUNDARIES,
} from "./keywords.js";
import type { ClassificationCache } from "./cache.js";
import { generateCacheKey } from "./cache.js";

export type Tier = "SIMPLE" | "MEDIUM" | "COMPLEX" | "REASONING";

export interface ScoringResult {
  score: number;
  tier: Tier;
  confidence: number;
  signals: string[];
  agenticScore?: number;
}

export class TopClassifier {
  private cache: ClassificationCache | undefined;

  constructor(cache?: ClassificationCache) {
    this.cache = cache;
  }

  /**
   * 14维核心评分逻辑
   */
  classify(prompt: string, estimatedTokens: number): ScoringResult {
    // 缓存检查
    if (this.cache) {
      const key = generateCacheKey(prompt, estimatedTokens);
      const cached = this.cache.get(key);
      if (cached) {
        return cached.result;
      }
    }

    const text = prompt.toLowerCase();
    let weightedScore = 0;
    const signals: string[] = [];

    // 1. tokenCount (0.08)
    const tokenScore = estimatedTokens < 50 ? -1.0 : estimatedTokens > 500 ? 1.0 : 0;
    weightedScore += tokenScore * DIMENSION_WEIGHTS.tokenCount;

    // 2. codePresence (0.15)
    const codeMatches = CODE_KEYWORDS.filter((kw: string) => text.includes(kw.toLowerCase()));
    const codeScore = codeMatches.length >= 2 ? 1.0 : codeMatches.length >= 1 ? 0.5 : 0;
    weightedScore += codeScore * DIMENSION_WEIGHTS.codePresence;
    if (codeScore > 0) signals.push(`code(${codeMatches.slice(0, 2).join(",")})`);

    // 3. reasoningMarkers (0.18) - 最高权重
    const reasoningMatches = REASONING_KEYWORDS.filter((kw: string) =>
      text.includes(kw.toLowerCase()),
    );
    const reasoningScore =
      reasoningMatches.length >= 2 ? 1.0 : reasoningMatches.length >= 1 ? 0.7 : 0;
    weightedScore += reasoningScore * DIMENSION_WEIGHTS.reasoningMarkers;
    if (reasoningScore > 0) signals.push(`reasoning(${reasoningMatches.slice(0, 2).join(",")})`);

    // 4. simpleIndicators (0.02) - 负分项
    const simpleMatches = SIMPLE_KEYWORDS.filter((kw: string) => text.includes(kw.toLowerCase()));
    if (simpleMatches.length > 0) {
      weightedScore += -1.0 * DIMENSION_WEIGHTS.simpleIndicators;
      signals.push("simple_query");
    }

    // 5. multiStepPatterns (0.12)
    // Fixed regex to avoid polynomial backtracking: split into safer patterns
    const hasMultiStep = 
      (text.includes('first') && text.includes('then')) ||
      /step\s+\d/.test(text) ||
      /\d\.\s/.test(text);
    
    if (hasMultiStep) {
      weightedScore += 0.5 * DIMENSION_WEIGHTS.multiStepPatterns;
      signals.push("multi-step");
    }

    // 6. agenticTask (0.04)
    const agentMatches = AGENTIC_KEYWORDS.filter((kw: string) => text.includes(kw.toLowerCase()));
    const agentScore = agentMatches.length >= 3 ? 1.0 : agentMatches.length >= 1 ? 0.2 : 0;
    weightedScore += agentScore * DIMENSION_WEIGHTS.agenticTask;

    // 7. technicalTerms (0.10)
    const technicalMatches = TECHNICAL_KEYWORDS.filter((kw: string) =>
      text.includes(kw.toLowerCase()),
    );
    const technicalScore =
      technicalMatches.length >= 4 ? 1.0 : technicalMatches.length >= 2 ? 0.5 : 0;
    weightedScore += technicalScore * DIMENSION_WEIGHTS.technicalTerms;
    if (technicalScore > 0) signals.push(`technical(${technicalMatches.slice(0, 2).join(",")})`);

    // 8. creativeMarkers (0.05)
    const creativeMatches = CREATIVE_KEYWORDS.filter((kw: string) =>
      text.includes(kw.toLowerCase()),
    );
    const creativeScore = creativeMatches.length >= 2 ? 0.7 : creativeMatches.length >= 1 ? 0.5 : 0;
    weightedScore += creativeScore * DIMENSION_WEIGHTS.creativeMarkers;
    if (creativeScore > 0) signals.push(`creative(${creativeMatches.slice(0, 2).join(",")})`);

    // 9. questionComplexity (0.05)
    const questionCount = (prompt.match(/\?/g) || []).length;
    const questionScore = questionCount > 3 ? 0.5 : 0;
    weightedScore += questionScore * DIMENSION_WEIGHTS.questionComplexity;
    if (questionScore > 0) signals.push(`questions(${questionCount})`);

    // 10. imperativeVerbs (0.03)
    const imperativeMatches = IMPERATIVE_VERBS.filter((kw: string) =>
      text.includes(kw.toLowerCase()),
    );
    const imperativeScore =
      imperativeMatches.length >= 2 ? 0.5 : imperativeMatches.length >= 1 ? 0.3 : 0;
    weightedScore += imperativeScore * DIMENSION_WEIGHTS.imperativeVerbs;
    if (imperativeScore > 0) signals.push(`imperative(${imperativeMatches.slice(0, 2).join(",")})`);

    // 11. constraintCount (0.04)
    const constraintMatches = CONSTRAINT_INDICATORS.filter((kw: string) =>
      text.includes(kw.toLowerCase()),
    );
    const constraintScore =
      constraintMatches.length >= 3 ? 0.7 : constraintMatches.length >= 1 ? 0.3 : 0;
    weightedScore += constraintScore * DIMENSION_WEIGHTS.constraintCount;
    if (constraintScore > 0)
      signals.push(`constraints(${constraintMatches.slice(0, 2).join(",")})`);

    // 12. outputFormat (0.03)
    const formatMatches = OUTPUT_FORMAT_KEYWORDS.filter((kw: string) =>
      text.includes(kw.toLowerCase()),
    );
    const formatScore = formatMatches.length >= 2 ? 0.7 : formatMatches.length >= 1 ? 0.4 : 0;
    weightedScore += formatScore * DIMENSION_WEIGHTS.outputFormat;
    if (formatScore > 0) signals.push(`format(${formatMatches.slice(0, 2).join(",")})`);

    // 13. referenceComplexity (0.02)
    const referenceMatches = REFERENCE_KEYWORDS.filter((kw: string) =>
      text.includes(kw.toLowerCase()),
    );
    const referenceScore =
      referenceMatches.length >= 2 ? 0.5 : referenceMatches.length >= 1 ? 0.3 : 0;
    weightedScore += referenceScore * DIMENSION_WEIGHTS.referenceComplexity;
    if (referenceScore > 0) signals.push(`references(${referenceMatches.slice(0, 2).join(",")})`);

    // 14. negationComplexity (0.01)
    const negationMatches = NEGATION_KEYWORDS.filter((kw: string) =>
      text.includes(kw.toLowerCase()),
    );
    const negationScore = negationMatches.length >= 3 ? 0.5 : negationMatches.length >= 2 ? 0.3 : 0;
    weightedScore += negationScore * DIMENSION_WEIGHTS.negationComplexity;
    if (negationScore > 0) signals.push(`negation(${negationMatches.slice(0, 2).join(",")})`);

    // 15. domainSpecificity (0.02)
    const domainMatches = DOMAIN_SPECIFIC_KEYWORDS.filter((kw: string) =>
      text.includes(kw.toLowerCase()),
    );
    const domainScore = domainMatches.length >= 2 ? 0.8 : domainMatches.length >= 1 ? 0.5 : 0;
    weightedScore += domainScore * DIMENSION_WEIGHTS.domainSpecificity;
    if (domainScore > 0) signals.push(`domain(${domainMatches.slice(0, 2).join(",")})`);

    // 长上下文保障规则 (estimatedTokens > 100k → COMPLEX tier)
    if (estimatedTokens > 100000) {
      return {
        score: weightedScore,
        tier: "COMPLEX",
        confidence: 0.9,
        signals: [...signals, "long_context"],
        agenticScore: agentScore,
      };
    }

    // 推理强制升级规则 (ClawRouter 核心逻辑)
    if (reasoningMatches.length >= 2) {
      return {
        score: weightedScore,
        tier: "REASONING",
        confidence: 0.9,
        signals,
        agenticScore: agentScore,
      };
    }

    // Tier 映射
    let tier: Tier = "MEDIUM";
    let distanceFromBoundary = 0;

    if (weightedScore < TIER_BOUNDARIES.simpleMedium) {
      tier = "SIMPLE";
      distanceFromBoundary = TIER_BOUNDARIES.simpleMedium - weightedScore;
    } else if (weightedScore < TIER_BOUNDARIES.mediumComplex) {
      tier = "MEDIUM";
      distanceFromBoundary = Math.min(
        weightedScore - TIER_BOUNDARIES.simpleMedium,
        TIER_BOUNDARIES.mediumComplex - weightedScore,
      );
    } else if (weightedScore < TIER_BOUNDARIES.complexReasoning) {
      tier = "COMPLEX";
      distanceFromBoundary = Math.min(
        weightedScore - TIER_BOUNDARIES.mediumComplex,
        TIER_BOUNDARIES.complexReasoning - weightedScore,
      );
    } else {
      tier = "REASONING";
      distanceFromBoundary = weightedScore - TIER_BOUNDARIES.complexReasoning;
    }

    // Sigmoid 置信度校准
    const confidence = 1 / (1 + Math.exp(-12 * distanceFromBoundary));

    const result = {
      score: weightedScore,
      tier,
      confidence,
      signals,
      agenticScore: agentScore,
    };

    // 缓存存储
    if (this.cache) {
      const key = generateCacheKey(prompt, estimatedTokens);
      this.cache.set(key, result);
    }

    return result;
  }
}
