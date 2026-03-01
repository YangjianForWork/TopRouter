# TopRouter

High-performance, payment-free AI intelligent routing gateway with 14‑dimensional multilingual static analysis and dynamic fallback routing.

高性能、无支付依赖的 AI 智能路由网关，具备 14 维多语言静态分析与动态回退路由能力。

## Features / 特性

- **14‑dimensional multilingual static analysis**: Weighted classification across reasoning, code, technical terms, multi‑step patterns, and more.  
  **14 维多语言静态分析**：基于推理、代码、技术术语、多步骤模式等多个维度的加权分类。
- **L1/L2 fallback system**: Fast rule‑based classification (L1) with optional LLM‑assisted classification (L2) when confidence is low.  
  **L1/L2 回退系统**：快速规则分类（L1）与低置信度时的可选 LLM 辅助分类（L2）。
- **LRU caching**: Results cached with TTL to avoid repeated classification of identical prompts.  
  **LRU 缓存**：结果缓存，TTL 过期机制，避免对相同提示重复分类。
- **OpenAI‑compatible API**: Provides `/v1/classify` classification and `/v1/chat/completions` with intelligent routing.  
  **OpenAI 兼容 API**：提供 `/v1/classify` 分类端点和具备智能路由的 `/v1/chat/completions` 端点。
- **MCP (Model Context Protocol) support**: JSON‑RPC 2.0 interface for OpenClaw integration with tool calling and resource access.  
  **MCP（模型上下文协议）支持**：JSON‑RPC 2.0 接口，用于 OpenClaw 集成，支持工具调用和资源访问。
- **Intelligent model routing**: Automatically routes requests to appropriate models (e.g., SIMPLE → `deepseek-chat`, REASONING → `deepseek-reasoner`).  
  **智能模型路由**：根据分类结果自动路由请求到合适模型（如 SIMPLE → `deepseek-chat`, REASONING → `deepseek-reasoner`）。
- **Rate limiting**: Per‑IP rate limiting for API endpoints.  
  **速率限制**：基于 IP 的 API 端点访问频率限制。
- **Payment‑free design**: No external payment dependencies; uses local quota and API‑key‑based rate limiting.  
  **无支付设计**：无外部支付依赖，采用本地配额和基于 API 密钥的速率限制。

## Quick Start / 快速开始

### Prerequisites / 先决条件

- Node.js 18+ (ES modules)
- npm or yarn

### Installation / 安装

```bash
git clone <repository-url>
cd TopRouter
npm install
```

### Configuration / 配置

Copy the example environment file and adjust the values:

复制示例环境文件并调整配置值：

```bash
cp .env.example .env
```

Edit `.env` to set your API keys (e.g., `DEEPSEEK_API_KEY` for L2 fallback) and other options.

编辑 `.env` 文件，设置 API 密钥（例如用于 L2 回退的 `DEEPSEEK_API_KEY`）和其他选项。

### Running the Server / 运行服务器

**Development (hot reload):** / **开发模式（热重载）:**

```bash
npm run dev
```

**Production (build first):** / **生产模式（先构建）:**

```bash
npm run build
npm start
```

The server will start on `http://localhost:94527` (or the port set in `PORT`).

服务器将在 `http://localhost:94527`（或 `PORT` 环境变量设置的端口）启动。

## API Reference / API 参考

### `GET /health`

Health check endpoint. / 健康检查端点。

**Response:** / **响应:**

```json
{
  "status": "ok",
  "timestamp": "2026-02-28T12:34:56.789Z"
}
```

### `POST /v1/classify`

Classify a prompt and estimate its complexity tier. / 对提示进行分类并评估其复杂度等级。

**Request Body:** / **请求体:**

```json
{
  "prompt": "请帮我写一个异步的 Python 函数，使用 import aiohttp 来抓取网页内容并解析 JSON。",
  "estimatedTokens": 60
}
```

- `prompt` (required): The user prompt to classify. / **必需**：待分类的用户提示。
- `estimatedTokens` (optional): Estimated token count. If omitted, a rough estimate (`prompt.length / 4`) is used. / **可选**：预估 token 数。如未提供，使用粗略估算（`prompt.length / 4`）。

**Response:** / **响应:**

```json
{
  "score": 0.15,
  "tier": "MEDIUM",
  "confidence": 0.86,
  "signals": ["code(import,函数)"],
  "cached": false
}
```

- `score`: Weighted score (0‑1). / 加权分数（0‑1）。
- `tier`: One of `"SIMPLE"`, `"MEDIUM"`, `"COMPLEX"`, `"REASONING"`. / 等级：`"SIMPLE"`、`"MEDIUM"`、`"COMPLEX"`、`"REASONING"` 之一。
- `confidence`: Confidence of the classification (0‑1). / 分类置信度（0‑1）。
- `signals`: Detected keywords/patterns. / 检测到的关键词/模式。
- `cached`: Whether the result was served from cache. / 结果是否来自缓存。

### `POST /v1/chat/completions`

OpenAI‑compatible endpoint with intelligent routing. Routes requests to appropriate LLM models based on classification results.  
OpenAI 兼容端点，具备智能路由功能。根据分类结果将请求路由到合适的 LLM 模型。

**Request Body:** / **请求体:**

```json
{
  "messages": [{ "role": "user", "content": "证明勾股定理，并给出逐步推导过程。" }],
  "model": "deepseek-chat", // Optional: override automatic routing
  "temperature": 0.7,
  "max_tokens": 100
}
```

- `messages` (required): Array of message objects (same as OpenAI format). / **必需**：消息对象数组（与 OpenAI 格式相同）。
- `model` (optional): Specific model to use (overrides automatic routing). / **可选**：指定使用的模型（覆盖自动路由）。
- `temperature`, `max_tokens`, `stream`: Same as OpenAI parameters. / 与 OpenAI 参数相同。

**Response:** / **响应:**

```json
{
  "id": "chatcmpl-123",
  "model": "deepseek-reasoner",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "勾股定理的证明如下..."
      },
      "finish_reason": "stop",
      "index": 0
    }
  ],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 85,
    "total_tokens": 100
  }
}
```

- `model`: The actual model used (may differ from request if routed). / 实际使用的模型（如果经过路由，可能与请求不同）。
- Other fields follow OpenAI's chat completions specification. / 其他字段遵循 OpenAI 聊天补全规范。

### `POST /mcp`

Model Context Protocol endpoint for OpenClaw integration. Provides JSON‑RPC 2.0 interface for tool calling and resource access.  
OpenClaw 集成的模型上下文协议端点。提供 JSON‑RPC 2.0 接口，用于工具调用和资源访问。

**Request Body:** / **请求体:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "classify_prompt",
    "arguments": {
      "prompt": "请帮我写一个异步的 Python 函数...",
      "estimatedTokens": 60
    }
  }
}
```

- `jsonrpc`: Must be `"2.0"` (JSON‑RPC 2.0). / 必须为 `"2.0"`（JSON‑RPC 2.0）。
- `id`: Request identifier (string or number). / 请求标识符（字符串或数字）。
- `method`: JSON‑RPC method (`initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`, `ping`). / JSON‑RPC 方法（`initialize`、`tools/list`、`tools/call`、`resources/list`、`resources/read`、`ping`）。
- `params`: Method parameters. / 方法参数。

**Response:** / **响应:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"score\":0.187,\"tier\":\"MEDIUM\",...}"
      }
    ]
  }
}
```

**Available Tools:** / **可用工具:**

- `classify_prompt`: Classify a prompt and determine its complexity tier. / 分类提示并确定其复杂度等级。
- `chat_completion`: Generate chat completion with intelligent routing. / 生成聊天补全，具备智能路由。
- `list_providers`: List available LLM providers and their models. / 列出可用的 LLM 提供商及其模型。

**Available Resources:** / **可用资源:**

- `toprouter://providers`: List of available LLM providers. / 可用 LLM 提供商列表。
- `toprouter://cache/stats`: Cache usage statistics. / 缓存使用统计。
- `toprouter://classifier/config`: Classifier configuration. / 分类器配置。

## Usage Examples / 使用示例

### Classifying a Prompt / 分类提示

```bash
curl -X POST http://localhost:94527/v1/classify \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "请帮我写一个异步的 Python 函数，使用 import aiohttp 来抓取网页内容并解析 JSON。",
    "estimatedTokens": 60
  }'
```

Response will include the classification tier, confidence score, and detected signals.  
响应将包含分类等级、置信度分数和检测到的信号。

### Intelligent Chat Routing / 智能聊天路由

```bash
curl -X POST http://localhost:94527/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "证明勾股定理，并给出逐步推导过程。"}
    ],
    "temperature": 0.1,
    "max_tokens": 200
  }'
```

The system will automatically route this reasoning request to `deepseek-reasoner`. For simple queries, it routes to `deepseek-chat`.  
系统会自动将此推理请求路由到 `deepseek-reasoner`。对于简单查询，则会路由到 `deepseek-chat`。

### Checking Server Health / 检查服务器健康状态

```bash
curl http://localhost:94527/health
```

### Using MCP Interface / 使用 MCP 接口

Initialize the MCP connection: / 初始化 MCP 连接：

```bash
curl -X POST http://localhost:94527/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {}
    }
  }'
```

List available tools: / 列出可用工具：

```bash
curl -X POST http://localhost:94527/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }'
```

Classify a prompt via MCP: / 通过 MCP 分类提示：

```bash
curl -X POST http://localhost:94527/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "classify_prompt",
      "arguments": {
        "prompt": "请帮我写一个异步的 Python 函数...",
        "estimatedTokens": 60
      }
    }
  }'
```

## Architecture / 架构

- **L1 Classifier**: Rule‑based 14‑dimensional weighted scorer implemented in `src/core/classifier.ts`.  
  **L1 分类器**：基于规则的 14 维加权评分器，实现在 `src/core/classifier.ts`。
- **L2 Classifier**: Optional LLM‑backed classifier (`DeepSeekClassifier`) that is invoked when L1 confidence falls below the configured threshold.  
  **L2 分类器**：可选的 LLM 支持分类器（`DeepSeekClassifier`），当 L1 置信度低于配置阈值时调用。
- **Cache**: LRU cache with TTL (`src/core/cache.ts`).  
  **缓存**：带 TTL 的 LRU 缓存（`src/core/cache.ts`）。
- **Enhanced Classifier**: Orchestrates L1/L2 fallback (`src/core/enhanced‑classifier.ts`).  
  **增强分类器**：协调 L1/L2 回退（`src/core/enhanced‑classifier.ts`）。
- **LLM Providers**: Extensible provider system for multiple LLM services (`src/core/llm‑provider.ts`).  
  **LLM 提供商**：可扩展的提供商系统，支持多个 LLM 服务（`src/core/llm‑provider.ts`）。
- **Model Router**: Intelligent routing based on classification tiers (`src/core/llm‑provider.ts`).  
  **模型路由器**：基于分类等级的智能路由（`src/core/llm‑provider.ts`）。
- **MCP Server**: Model Context Protocol server for OpenClaw integration (`src/mcp/server.ts`).  
  **MCP 服务器**：用于 OpenClaw 集成的模型上下文协议服务器（`src/mcp/server.ts`）。
- **HTTP Server**: Express‑based API server (`src/server.ts`).  
  **HTTP 服务器**：基于 Express 的 API 服务器（`src/server.ts`）。
- **Configuration**: Environment‑based configuration with Zod validation (`src/config.ts`).  
  **配置**：基于环境变量的配置，使用 Zod 验证（`src/config.ts`）。

## Development / 开发

See [AGENTS.md](./AGENTS.md) for detailed coding conventions, build commands, and workflow guidelines for AI agents.  
查看 [AGENTS.md](./AGENTS.md) 了解详细的编码规范、构建命令和 AI 代理工作流指南。

### Scripts / 脚本

- `npm run typecheck` – TypeScript type checking (no emit). / TypeScript 类型检查（不输出文件）。
- `npm run build` – Compile TypeScript to `dist/`. / 将 TypeScript 编译到 `dist/` 目录。
- `npm run dev` – Start development server with hot reload. / 启动开发服务器（带热重载）。
- `npm start` – Start production server (requires `npm run build` first). / 启动生产服务器（需先执行 `npm run build`）。
- `npm test` – Run the manual classifier test. / 运行手动分类器测试。

### Adding a New LLM Provider / 添加新的 LLM 提供商

1. Implement the `LLMProvider` interface (see `src/core/llm‑provider.ts`).  
   实现 `LLMProvider` 接口（参见 `src/core/llm‑provider.ts`）。
2. Add the corresponding API‑key configuration in `src/config.ts`.  
   在 `src/config.ts` 中添加对应的 API 密钥配置。
3. Register the provider in `src/server.ts` when the key is present.  
   当密钥存在时，在 `src/server.ts` 中注册该提供商。
4. The model router will automatically include the new provider in routing decisions.  
   模型路由器会自动将新提供商纳入路由决策。

## Development Status / 开发状态

TopRouter v1.0.0 has completed Phase 1 (core engine) and Phase 2 (protocol & forwarding) from the original roadmap.  
TopRouter v1.0.0 已完成原始路线图中的第一阶段（核心引擎）和第二阶段（协议与转发）。

**Current features** / **当前功能**:

- ✅ 14‑dimensional multilingual classifier with L1/L2 fallback / 14 维多语言分类器，支持 L1/L2 回退
- ✅ OpenAI‑compatible API with intelligent routing / OpenAI 兼容 API，具备智能路由
- ✅ Extensible LLM provider system / 可扩展的 LLM 提供商系统
- ✅ Local quota management / 本地配额管理
- ✅ Rate limiting and caching / 速率限制与缓存

**Next priorities** / **下一步重点**:

- Integration with domestic LLM providers (Kimi, Zhipu, Qianwen) / 集成国内 LLM 提供商（Kimi、智谱、通义千问）
- Advanced quota management and cost‑saving dashboard / 高级配额管理与成本节省看板
- Performance optimization and load testing / 性能优化与负载测试

## License / 许可证

MIT License. See the [LICENSE](./LICENSE) file for details.  
MIT 许可证。详见 [LICENSE](./LICENSE) 文件。

项目作者是 AI
