/**
 * MCP Interface Test for TopRouter
 *
 * This script tests the MCP (Model Context Protocol) interface
 * for OpenClaw integration.
 */

import { MCPServer } from "./src/mcp/server.js";
import { EnhancedClassifier } from "./src/core/enhanced-classifier.js";
import { ModelRouter } from "./src/core/llm-provider.js";
import { DeepSeekProvider } from "./src/core/llm-provider.js";
import { createCache } from "./src/core/cache.js";
import { MemoryQuotaManager } from "./src/quota/memory-quota.js";

// Mock components for testing
async function createMockMCP() {
  // Create a simple cache
  const cache = createCache({ maxSize: 100, ttlMs: 60000 });

  // Create classifier with cache
  const classifier = new EnhancedClassifier({
    l1Cache: cache,
    l2Classifier: undefined,
    confidenceThreshold: 0.7,
  });

  // Create model router
  const modelRouter = new ModelRouter();

  // Note: In real usage, you would add actual providers with API keys
  console.log("Mock MCP server created (no actual LLM providers)");

  // Create MCP server
  const mcpServer = new MCPServer({
    classifier,
    modelRouter,
    quotaManager: undefined,
    cache,
    serverInfo: {
      name: "TopRouter MCP Test Server",
      version: "1.0.0",
    },
  });

  return mcpServer;
}

async function testMCPServer() {
  console.log("=== TopRouter MCP Interface Test ===\n");

  const mcpServer = await createMockMCP();

  // Test 1: Initialize request
  console.log("Test 1: Initialize request");
  const initRequest = {
    jsonrpc: "2.0" as const,
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {
        client: {},
      },
    },
  };

  try {
    const initResponse = await mcpServer.handleRequest(initRequest);
    console.log("✓ Initialize successful");
    console.log(
      `  Server: ${JSON.parse(JSON.stringify(initResponse.result)).serverInfo.name}`,
    );
  } catch (error) {
    console.error("✗ Initialize failed:", error);
  }

  // Test 2: List tools
  console.log("\nTest 2: List tools");
  const toolsRequest = {
    jsonrpc: "2.0" as const,
    id: 2,
    method: "tools/list",
    params: {},
  };

  try {
    const toolsResponse = await mcpServer.handleRequest(toolsRequest);
    const tools = JSON.parse(JSON.stringify(toolsResponse.result)).tools;
    console.log(`✓ Found ${tools.length} tools:`);
    tools.forEach((tool: any) => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });
  } catch (error) {
    console.error("✗ List tools failed:", error);
  }

  // Test 3: Classify prompt tool
  console.log("\nTest 3: Classify prompt tool");
  const classifyRequest = {
    jsonrpc: "2.0" as const,
    id: 3,
    method: "tools/call",
    params: {
      name: "classify_prompt",
      arguments: {
        prompt:
          "请帮我写一个异步的 Python 函数，使用 import aiohttp 来抓取网页内容并解析 JSON。",
        estimatedTokens: 60,
      },
    },
  };

  try {
    const classifyResponse = await mcpServer.handleRequest(classifyRequest);
    console.log("✓ Classify prompt successful");
    const result = JSON.parse(JSON.stringify(classifyResponse.result));
    console.log(`  Result: ${result.content[0].text.substring(0, 100)}...`);
  } catch (error) {
    console.error("✗ Classify prompt failed:", error);
  }

  // Test 4: List resources
  console.log("\nTest 4: List resources");
  const resourcesRequest = {
    jsonrpc: "2.0" as const,
    id: 4,
    method: "resources/list",
    params: {},
  };

  try {
    const resourcesResponse = await mcpServer.handleRequest(resourcesRequest);
    const resources = JSON.parse(
      JSON.stringify(resourcesResponse.result),
    ).resources;
    console.log(`✓ Found ${resources.length} resources:`);
    resources.forEach((resource: any) => {
      console.log(`  - ${resource.name} (${resource.uri})`);
    });
  } catch (error) {
    console.error("✗ List resources failed:", error);
  }

  // Test 5: Ping
  console.log("\nTest 5: Ping");
  const pingRequest = {
    jsonrpc: "2.0" as const,
    id: 5,
    method: "ping",
    params: {},
  };

  try {
    const pingResponse = await mcpServer.handleRequest(pingRequest);
    console.log("✓ Ping successful");
    const result = JSON.parse(JSON.stringify(pingResponse.result));
    console.log(`  Status: ${result.status}, Timestamp: ${result.timestamp}`);
  } catch (error) {
    console.error("✗ Ping failed:", error);
  }

  console.log("\n=== MCP Test Complete ===");
}

// Run test
testMCPServer().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
