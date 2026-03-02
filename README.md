# TopRouter

**高点智能路由** - 高性能、无支付依赖的 AI 智能路由网关，具备 14 维多语言静态分析与动态回退路由能力。

## 核心特性

- **14 维多语言静态分析**：基于推理、代码、技术术语、多步骤模式等多个维度的加权分类。
- **L1/L2 回退系统**：快速规则分类（L1）与低置信度时的可选 LLM 辅助分类（L2）。
- **LRU 缓存**：结果缓存，TTL 过期机制，避免对相同提示重复分类。
- **OpenAI 兼容 API**：提供 `/v1/classify` 分类端点和具备智能路由的 `/v1/chat/completions` 端点。
- **MCP（模型上下文协议）支持**：JSON‑RPC 2.0 接口，用于 OpenClaw 集成，支持工具调用和资源访问。
- **智能模型路由**：根据分类结果自动跨多个提供商路由请求到合适模型（如 SIMPLE → 轻量级模型，REASONING → 高性能模型）。
- **多提供商支持**：集成支持 DeepSeek、Kimi（Moonshot AI）、智谱AI（GLM）、通义千问（阿里云）。
- **速率限制**：基于 IP 的 API 端点访问频率限制。
- **无支付设计**：无外部支付依赖，采用本地配额和基于 API 密钥的速率限制。
- **管理面板**：内置监控端点，用于 API 密钥使用情况、提供商状态和服务器统计。

## 快速开始

### 先决条件

- Node.js 18+ (ES 模块)
- npm 或 yarn

### 安装

```bash
git clone https://github.com/YangjianForWork/TopRouter.git
cd TopRouter
npm install
```

### 配置

复制示例环境文件并调整配置值：

```bash
cp .env.example .env
```

编辑 `.env` 文件，设置 API 密钥：

- `DEEPSEEK_API_KEY`：用于 L2 回退分类和聊天补全
- `KIMI_API_KEY`、`ZHIPU_API_KEY`、`QIANWEN_API_KEY`：用于国内 LLM 提供商（聊天补全）
- 其他配置选项根据需要设置

### 运行服务器

**开发模式（热重载）：**

```bash
npm run dev
```

**生产模式（先构建）：**

```bash
npm run build
npm start
```

服务器将在 `http://localhost:94527`（或 `PORT` 环境变量设置的端口）启动。

## API 参考

### 健康检查

**端点:** `GET /health`
**响应:**

```json
{
  "status": "ok",
  "timestamp": "2026-02-28T12:34:56.789Z"
}
```

### 提示分类

**端点:** `POST /v1/classify`
对提示进行分类并评估其复杂度等级。

**请求体:**

```json
{
  "prompt": "请帮我写一个异步的 Python 函数，使用 import aiohttp 来抓取网页内容并解析 JSON。",
  "estimatedTokens": 60
}
```

**响应:**

```json
{
  "score": 0.15,
  "tier": "MEDIUM",
  "confidence": 0.86,
  "signals": ["code(import,函数)"],
  "cached": false
}
```

### 智能聊天补全

**端点:** `POST /v1/chat/completions`
OpenAI 兼容端点，具备智能路由功能。

**请求体:**

```json
{
  "messages": [{ "role": "user", "content": "证明勾股定理，并给出逐步推导过程。" }],
  "model": "deepseek-chat", // 可选：覆盖自动路由
  "temperature": 0.7,
  "max_tokens": 100
}
```

**响应:** (遵循 OpenAI 聊天补全格式)

### MCP 集成

**端点:** `POST /mcp`
OpenClaw 集成的模型上下文协议端点。

**可用工具:**

- `classify_prompt`: 分类提示并确定其复杂度等级。
- `chat_completion`: 生成聊天补全，具备智能路由。
- `list_providers`: 列出可用的 LLM 提供商及其模型。

### 管理面板

管理面板提供监控和管理端点（开发环境中无需认证）。

**端点:** `GET /admin/health`
**响应:**

```json
{
  "status": "ok",
  "timestamp": "2026-02-28T12:34:56.789Z",
  "cacheSize": 42,
  "providers": "available",
  "classifier": "enabled"
}
```

**端点:** `GET /admin/providers`
**响应:**

```json
{
  "providers": [
    {
      "name": "deepseek",
      "displayName": "DeepSeek",
      "models": ["deepseek-chat", "deepseek-reasoner"]
    }
  ],
  "count": 1
}
```

**端点:** `GET /admin/keys`（需要启用配额管理）
**响应:**

```json
{
  "quotaEnabled": true,
  "count": 2,
  "keys": [
    {
      "apiKey": "sk_test_1...",
      "limits": { "dailyTokenLimit": 1000000, "monthlyTokenLimit": 30000000 },
      "usage": {
        "dailyTokens": 12500,
        "monthlyTokens": 45000,
        "remainingDaily": 987500,
        "remainingMonthly": 29955000,
        "lastResetDaily": "2026-02-28T00:00:00.000Z",
        "lastResetMonthly": "2026-02-01T00:00:00.000Z",
        "requestsCount": 15
      }
    }
  ]
}
```

**端点:** `GET /admin/stats`
**响应:**

```json
{
  "cache": {
    "size": 42,
    "maxSize": 1000,
    "ttlMs": 3600000
  },
  "providers": {
    "count": 1,
    "details": [
      {
        "name": "deepseek",
        "displayName": "DeepSeek",
        "modelCount": 2
      }
    ]
  },
  "quota": {
    "enabled": false,
    "keyCount": 0
  },
  "server": {
    "uptime": 3600.5,
    "environment": "development",
    "port": 94527
  }
}
```

**端点:** `GET /admin/cost`
**响应:**

```json
{
  "costTrackingEnabled": false,
  "message": "成本跟踪尚未实现。计划在第三阶段增强中实现。",
  "estimatedSavings": {
    "monthly": 0,
    "currency": "USD"
  },
  "recommendations": [
    "为每个模型实现令牌使用跟踪",
    "添加每个提供商的定价数据",
    "计算将简单提示路由到更便宜模型的节省成本"
  ]
}
```

## 使用示例

### 分类提示

```bash
curl -X POST http://localhost:94527/v1/classify \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "请帮我写一个异步的 Python 函数，使用 import aiohttp 来抓取网页内容并解析 JSON。",
    "estimatedTokens": 60
  }'
```

### 智能聊天路由

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

### 检查服务器健康状态

```bash
curl http://localhost:94527/health
```

### 使用管理面板监控

```bash
# 检查提供商状态
curl http://localhost:94527/admin/providers

# 查看服务器统计
curl http://localhost:94527/admin/stats

# 检查 API 密钥使用情况（如果启用配额）
curl http://localhost:94527/admin/keys
```

## 架构

- **L1 分类器**：基于规则的 14 维加权评分器，实现在 `src/core/classifier.ts`。
- **L2 分类器**：可选的 LLM 支持分类器（`DeepSeekClassifier`），当 L1 置信度低于配置阈值时调用。
- **缓存**：带 TTL 的 LRU 缓存（`src/core/cache.ts`）。
- **增强分类器**：协调 L1/L2 回退（`src/core/enhanced‑classifier.ts`）。
- **LLM 提供商**：可扩展的提供商系统，支持多个 LLM 服务（`src/core/llm‑provider.ts`）。
- **模型路由器**：基于分类等级的智能路由。
- **MCP 服务器**：用于 OpenClaw 集成的模型上下文协议服务器（`src/mcp/server.ts`）。
- **HTTP 服务器**：基于 Express 的 API 服务器（`src/server.ts`）。
- **配置**：基于环境变量的配置，使用 Zod 验证（`src/config.ts`）。

## 开发

### 脚本

- `npm run typecheck` – TypeScript 类型检查（不输出文件）。
- `npm run build` – 将 TypeScript 编译到 `dist/` 目录。
- `npm run dev` – 启动开发服务器（带热重载）。
- `npm start` – 启动生产服务器（需先执行 `npm run build`）。
- `npm test` – 运行手动分类器测试。

### 添加新的 LLM 提供商

1. 实现 `LLMProvider` 接口（参见 `src/core/llm‑provider.ts`）。
2. 在 `src/config.ts` 中添加对应的 API 密钥配置。
3. 当密钥存在时，在 `src/server.ts` 中注册该提供商。
4. 模型路由器会自动将新提供商纳入路由决策。

查看 [AGENTS.md](./AGENTS.md) 了解详细的编码规范和工作流指南。

## 开发状态

TopRouter v1.0.0 已完成原始路线图中的第一阶段（核心引擎）和第二阶段（协议与转发）。

**当前功能:**

- ✅ 14 维多语言分类器，支持 L1/L2 回退
- ✅ OpenAI 兼容 API，具备智能路由
- ✅ 可扩展的 LLM 提供商系统（DeepSeek、Kimi、智谱、通义千问）
- ✅ 本地配额管理
- ✅ 速率限制与缓存
- ✅ 管理面板原型（密钥、统计、提供商）

**下一步重点:**

- 增强的成本节省看板（实际令牌跟踪）
- 性能优化与负载测试
- 针对国内提供商的高级模型层级优化

## 许可证

MIT 许可证。详见 [LICENSE](./LICENSE) 文件。

项目作者是 AI

---
High-performance, payment-free AI intelligent routing gateway with 14‑dimensional multilingual static analysis and dynamic fallback routing.

## Features

### Core Capabilities

- **14-dimensional multilingual static analysis**: Weighted classification across reasoning, code, technical terms, multi‑step patterns, and more.
- **L1/L2 fallback system**: Fast rule‑based classification (L1) with optional LLM‑assisted classification (L2) when confidence is low.
- **LRU caching**: Results cached with TTL to avoid repeated classification of identical prompts.
- **OpenAI‑compatible API**: Provides `/v1/classify` classification and `/v1/chat/completions` with intelligent routing.
- **MCP (Model Context Protocol) support**: JSON‑RPC 2.0 interface for OpenClaw integration with tool calling and resource access.
- **Intelligent model routing**: Automatically routes requests to appropriate models across multiple providers (e.g., SIMPLE → lightweight models, REASONING → high-performance models).
- **Multi‑provider support**: Integrated support for DeepSeek, Kimi (Moonshot AI), Zhipu AI (GLM), and Qianwen (Alibaba).
- **Rate limiting**: Per‑IP rate limiting for API endpoints.
- **Payment‑free design**: No external payment dependencies; uses local quota and API‑key‑based rate limiting.
- **Admin dashboard**: Built‑in monitoring endpoints for API key usage, provider status, and server statistics.

## Quick Start

### Prerequisites

- Node.js 18+ (ES modules)
- npm or yarn

### Installation

```bash
git clone https://github.com/YangjianForWork/TopRouter.git
cd TopRouter
npm install
```

### Configuration

Copy the example environment file and adjust the values:

```bash
cp .env.example .env
```

Edit `.env` to set your API keys:

- `DEEPSEEK_API_KEY`: For L2 fallback classification and chat completions
- `KIMI_API_KEY`, `ZHIPU_API_KEY`, `QIANWEN_API_KEY`: For domestic LLM providers (chat completions)
- Other configuration options as needed

### Running the Server

**Development mode (hot reload):**

```bash
npm run dev
```

**Production mode (build first):**

```bash
npm run build
npm start
```

The server will start on `http://localhost:94527` (or the port set in `PORT`).

## API Reference

### Health Check

**Endpoint:** `GET /health`
**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-02-28T12:34:56.789Z"
}
```

### Prompt Classification

**Endpoint:** `POST /v1/classify`
Classify a prompt and estimate its complexity tier.

**Request Body:**

```json
{
  "prompt": "请帮我写一个异步的 Python 函数，使用 import aiohttp 来抓取网页内容并解析 JSON。",
  "estimatedTokens": 60
}
```

**Response:**

```json
{
  "score": 0.15,
  "tier": "MEDIUM",
  "confidence": 0.86,
  "signals": ["code(import,函数)"],
  "cached": false
}
```

### Intelligent Chat Completion

**Endpoint:** `POST /v1/chat/completions`
OpenAI‑compatible endpoint with intelligent routing.

**Request Body:**

```json
{
  "messages": [{ "role": "user", "content": "证明勾股定理，并给出逐步推导过程。" }],
  "model": "deepseek-chat", // Optional: override automatic routing
  "temperature": 0.7,
  "max_tokens": 100
}
```

**Response:** (Follows OpenAI's chat completions format)

### MCP Integration

**Endpoint:** `POST /mcp`
Model Context Protocol endpoint for OpenClaw integration.

**Available Tools:**

- `classify_prompt`: Classify a prompt and determine its complexity tier.
- `chat_completion`: Generate chat completion with intelligent routing.
- `list_providers`: List available LLM providers and their models.

### Admin Dashboard

The admin dashboard provides monitoring and management endpoints (no authentication required in development).

**Endpoint:** `GET /admin/health`
**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-02-28T12:34:56.789Z",
  "cacheSize": 42,
  "providers": "available",
  "classifier": "enabled"
}
```

**Endpoint:** `GET /admin/providers`
**Response:**

```json
{
  "providers": [
    {
      "name": "deepseek",
      "displayName": "DeepSeek",
      "models": ["deepseek-chat", "deepseek-reasoner"]
    }
  ],
  "count": 1
}
```

**Endpoint:** `GET /admin/keys` (requires quota management enabled)
**Response:**

```json
{
  "quotaEnabled": true,
  "count": 2,
  "keys": [
    {
      "apiKey": "sk_test_1...",
      "limits": { "dailyTokenLimit": 1000000, "monthlyTokenLimit": 30000000 },
      "usage": {
        "dailyTokens": 12500,
        "monthlyTokens": 45000,
        "remainingDaily": 987500,
        "remainingMonthly": 29955000,
        "lastResetDaily": "2026-02-28T00:00:00.000Z",
        "lastResetMonthly": "2026-02-01T00:00:00.000Z",
        "requestsCount": 15
      }
    }
  ]
}
```

**Endpoint:** `GET /admin/stats`
**Response:**

```json
{
  "cache": {
    "size": 42,
    "maxSize": 1000,
    "ttlMs": 3600000
  },
  "providers": {
    "count": 1,
    "details": [
      {
        "name": "deepseek",
        "displayName": "DeepSeek",
        "modelCount": 2
      }
    ]
  },
  "quota": {
    "enabled": false,
    "keyCount": 0
  },
  "server": {
    "uptime": 3600.5,
    "environment": "development",
    "port": 94527
  }
}
```

**Endpoint:** `GET /admin/cost`
**Response:**

```json
{
  "costTrackingEnabled": false,
  "message": "Cost tracking not yet implemented. Planned for Phase 3 enhancement.",
  "estimatedSavings": {
    "monthly": 0,
    "currency": "USD"
  },
  "recommendations": [
    "Implement token usage tracking per model",
    "Add pricing data for each provider",
    "Calculate savings from routing simple prompts to cheaper models"
  ]
}
```

## Usage Examples

### Classifying a Prompt

```bash
curl -X POST http://localhost:94527/v1/classify \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "请帮我写一个异步的 Python 函数，使用 import aiohttp 来抓取网页内容并解析 JSON。",
    "estimatedTokens": 60
  }'
```

### Intelligent Chat Routing

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

### Checking Server Health

```bash
curl http://localhost:94527/health
```

### Monitoring with Admin Dashboard

```bash
# Check provider status
curl http://localhost:94527/admin/providers

# View server statistics
curl http://localhost:94527/admin/stats

# Check API key usage (if quota enabled)
curl http://localhost:94527/admin/keys
```

## Architecture

- **L1 Classifier**: Rule‑based 14‑dimensional weighted scorer implemented in `src/core/classifier.ts`.
- **L2 Classifier**: Optional LLM‑backed classifier (`DeepSeekClassifier`) invoked when L1 confidence is low.
- **Cache**: LRU cache with TTL (`src/core/cache.ts`).
- **Enhanced Classifier**: Orchestrates L1/L2 fallback (`src/core/enhanced‑classifier.ts`).
- **LLM Providers**: Extensible provider system for multiple LLM services (`src/core/llm‑provider.ts`).
- **Model Router**: Intelligent routing based on classification tiers.
- **MCP Server**: Model Context Protocol server for OpenClaw integration (`src/mcp/server.ts`).
- **HTTP Server**: Express‑based API server (`src/server.ts`).
- **Configuration**: Environment‑based configuration with Zod validation (`src/config.ts`).

## Development

### Scripts

- `npm run typecheck` – TypeScript type checking (no emit).
- `npm run build` – Compile TypeScript to `dist/`.
- `npm run dev` – Start development server with hot reload.
- `npm start` – Start production server (requires `npm run build` first).
- `npm test` – Run the manual classifier test.

### Adding a New LLM Provider

1. Implement the `LLMProvider` interface (see `src/core/llm‑provider.ts`).
2. Add the corresponding API‑key configuration in `src/config.ts`.
3. Register the provider in `src/server.ts` when the key is present.
4. The model router will automatically include the new provider in routing decisions.

See [AGENTS.md](./AGENTS.md) for detailed coding conventions and workflow guidelines.

## Development Status

TopRouter v1.0.0 has completed Phase 1 (core engine) and Phase 2 (protocol & forwarding) from the original roadmap.

**Current features:**

- ✅ 14‑dimensional multilingual classifier with L1/L2 fallback
- ✅ OpenAI‑compatible API with intelligent routing
- ✅ Extensible LLM provider system (DeepSeek, Kimi, Zhipu, Qianwen)
- ✅ Local quota management
- ✅ Rate limiting and caching
- ✅ Admin dashboard prototype (keys, stats, providers)

**Next priorities:**

- Enhanced cost‑saving dashboard with actual token tracking
- Performance optimization and load testing
- Advanced model‑specific tier optimization for domestic providers

## License

MIT License. See the [LICENSE](./LICENSE) file for details.
