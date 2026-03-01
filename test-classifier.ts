import { TopClassifier } from "./src/core/classifier.js";

const classifier = new TopClassifier();

const testCases = [
    { name: "简单问候", prompt: "你好，请问你是谁？", tokens: 10 },
    { name: "复杂代码", prompt: "请帮我写一个异步的 Python 函数，使用 import aiohttp 来抓取网页内容并解析 JSON。", tokens: 60 },
    { name: "数学证明", prompt: "证明勾股定理，并给出逐步推导过程。", tokens: 40 },
    { name: "长文本分析", prompt: "根据以下文档分析其核心架构逻辑：[此处省略1000字]...", tokens: 1200 },
];

console.log("=== TopRouter 14-D Classifier Test ===\n");

testCases.forEach(tc => {
    const result = classifier.classify(tc.prompt, tc.tokens);
    console.log(`Case: ${tc.name}`);
    console.log(`Prompt: ${tc.prompt}`);
    console.log(`Score: ${result.score.toFixed(4)} | Tier: ${result.tier} | Confidence: ${result.confidence.toFixed(2)}`);
    console.log(`Signals: ${result.signals.join(", ")}`);
    console.log("-".repeat(30));
});
