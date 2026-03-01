import type { EnhancedClassifier } from "../core/enhanced-classifier.js";
import type { ModelRouter } from "../core/llm-provider.js";
import type { MemoryQuotaManager } from "../quota/memory-quota.js";
import type { ClassificationCache } from "../core/cache.js";
import type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCError,
  MCPServerInfo,
  MCPServerCapabilities,
  MCPTool,
  MCPToolResult,
  MCPResource,
  MCPResourceContents,
} from "./types.js";

export interface MCPServerOptions {
  classifier: EnhancedClassifier;
  modelRouter: ModelRouter;
  quotaManager?: MemoryQuotaManager | undefined;
  cache?: ClassificationCache | undefined;
  serverInfo?: Partial<MCPServerInfo>;
}

export class MCPServer {
  private classifier: EnhancedClassifier;
  private modelRouter: ModelRouter;
  private quotaManager: MemoryQuotaManager | undefined;
  private cache: ClassificationCache | undefined;
  private serverInfo: MCPServerInfo;

  constructor(options: MCPServerOptions) {
    this.classifier = options.classifier;
    this.modelRouter = options.modelRouter;
    this.quotaManager = options.quotaManager;
    this.cache = options.cache;

    this.serverInfo = {
      name: options.serverInfo?.name || "TopRouter MCP Server",
      version: options.serverInfo?.version || "1.0.0",
      capabilities: options.serverInfo?.capabilities || {
        tools: { listChanged: true },
        resources: { listChanged: true },
      },
    };
  }

  /**
   * Handle JSON-RPC request and return response
   */
  async handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    try {
      const result = await this.handleMethod(request.method, request.params);
      return {
        jsonrpc: "2.0",
        id: request.id,
        result,
      };
    } catch (error) {
      return this.createErrorResponse(request.id, error);
    }
  }

  /**
   * Handle raw JSON string request
   */
  async handleJsonRequest(jsonString: string): Promise<string> {
    let request: JSONRPCRequest;
    try {
      request = JSON.parse(jsonString);
    } catch (error) {
      const errorResponse: JSONRPCResponse = {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Parse error",
          data: error instanceof Error ? error.message : String(error),
        },
      };
      return JSON.stringify(errorResponse);
    }

    const response = await this.handleRequest(request);
    return JSON.stringify(response);
  }

  /**
   * Dispatch to appropriate method handler
   */
  private async handleMethod(method: string, params: unknown): Promise<unknown> {
    switch (method) {
    case "initialize":
      return this.handleInitialize(params);
    case "tools/list":
      return this.handleToolsList(params);
    case "tools/call":
      return this.handleToolsCall(params);
    case "resources/list":
      return this.handleResourcesList(params);
    case "resources/read":
      return this.handleResourcesRead(params);
    case "ping":
      return this.handlePing(params);
    default:
      throw new Error(`Method not found: ${method}`);
    }
  }

  /**
   * Initialize method
   */
  private handleInitialize(params: unknown): {
    protocolVersion: string;
    capabilities: MCPServerCapabilities;
    serverInfo: MCPServerInfo;
  } {
    // Validate params if needed
    const _params = params as { protocolVersion?: string };
    return {
      protocolVersion: _params.protocolVersion || "2024-11-05",
      capabilities: this.serverInfo.capabilities,
      serverInfo: this.serverInfo,
    };
  }

  /**
   * List available tools
   */
  private handleToolsList(_params: unknown): { tools: MCPTool[] } {
    const tools: MCPTool[] = [
      {
        name: "classify_prompt",
        description: "Classify a prompt and determine its complexity tier",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "The prompt text to classify",
            },
            estimatedTokens: {
              type: "number",
              description: "Estimated token count (optional)",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "chat_completion",
        description: "Generate chat completion with intelligent routing",
        inputSchema: {
          type: "object",
          properties: {
            messages: {
              type: "array",
              description: "Array of message objects",
            },
            model: {
              type: "string",
              description: "Model to use (optional, overrides automatic routing)",
            },
            temperature: {
              type: "number",
              description: "Sampling temperature (optional)",
            },
            max_tokens: {
              type: "number",
              description: "Maximum tokens to generate (optional)",
            },
          },
          required: ["messages"],
        },
      },
      {
        name: "list_providers",
        description: "List available LLM providers and their models",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ];

    return { tools };
  }

  /**
   * Call a tool
   */
  private async handleToolsCall(params: unknown): Promise<MCPToolResult> {
    const p = params as { name: string; arguments: Record<string, unknown> };
    const toolName = p.name;
    const args = p.arguments;

    switch (toolName) {
    case "classify_prompt":
      return await this.handleClassifyPrompt(args);
    case "chat_completion":
      return await this.handleChatCompletion(args);
    case "list_providers":
      return await this.handleListProviders(args);
    default:
      throw new Error(`Tool not found: ${toolName}`);
    }
  }

  /**
   * Classify prompt tool implementation
   */
  private async handleClassifyPrompt(args: Record<string, unknown>): Promise<MCPToolResult> {
    const prompt = args.prompt as string;
    if (!prompt || typeof prompt !== "string") {
      throw new Error("prompt is required and must be a string");
    }

    const estimatedTokens = (args.estimatedTokens as number) || Math.ceil(prompt.length / 4);
    const result = await this.classifier.classify(prompt, estimatedTokens);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * Chat completion tool implementation
   */
  private async handleChatCompletion(args: Record<string, unknown>): Promise<MCPToolResult> {
    const messages = args.messages;
    if (!Array.isArray(messages)) {
      throw new Error("messages must be an array");
    }

    // Extract prompt for classification
    const prompt = messages.map((msg: any) => msg.content).join("\n");
    const estimatedTokens = Math.ceil(prompt.length / 4);

    // Classify the prompt
    const classification = await this.classifier.classify(prompt, estimatedTokens);

    // Route to appropriate provider
    if (!this.modelRouter.hasProviders()) {
      throw new Error("No LLM providers available");
    }

    const requestedModel = args.model as string | undefined;
    const { provider, model: selectedModel } = this.modelRouter.routeByTier(
      classification.tier,
      requestedModel,
    );

    // Prepare chat completion request
    const validatedMessages = this.validateAndConvertMessages(messages);
    const chatRequest = {
      model: selectedModel,
      messages: validatedMessages,
      temperature: (args.temperature as number) || 0.7,
      max_tokens: args.max_tokens as number,
      stream: false,
    };

    // Call provider
    const response = await provider.chatCompletion(chatRequest);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  }

  /**
   * List providers tool implementation
   */
  private async handleListProviders(_args: Record<string, unknown>): Promise<MCPToolResult> {
    const providers = this.modelRouter.getProviders();
    const providerInfo = providers.map(({ name, provider }) => ({
      name,
      displayName: provider.getDisplayName(),
      models: provider.listModels(),
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              providers: providerInfo,
              count: providerInfo.length,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  /**
   * List available resources
   */
  private handleResourcesList(_params: unknown): { resources: MCPResource[] } {
    const resources: MCPResource[] = [
      {
        uri: "toprouter://providers",
        name: "LLM Providers",
        description: "List of available LLM providers and their models",
        mimeType: "application/json",
      },
      {
        uri: "toprouter://cache/stats",
        name: "Cache Statistics",
        description: "Cache usage statistics and hit rates",
        mimeType: "application/json",
      },
      {
        uri: "toprouter://classifier/config",
        name: "Classifier Configuration",
        description: "Current classifier configuration and weights",
        mimeType: "application/json",
      },
    ];

    return { resources };
  }

  /**
   * Read a resource
   */
  private handleResourcesRead(params: unknown): MCPResourceContents {
    const p = params as { uri: string };
    const uri = p.uri;

    switch (uri) {
    case "toprouter://providers":
      return this.handleProvidersResource();
    case "toprouter://cache/stats":
      return this.handleCacheStatsResource();
    case "toprouter://classifier/config":
      return this.handleClassifierConfigResource();
    default:
      throw new Error(`Resource not found: ${uri}`);
    }
  }

  /**
   * Providers resource implementation
   */
  private handleProvidersResource(): MCPResourceContents {
    const providers = this.modelRouter.getProviders();
    const providerInfo = providers.map(({ name, provider }) => ({
      name,
      displayName: provider.getDisplayName(),
      models: provider.listModels(),
    }));

    return {
      uri: "toprouter://providers",
      contents: [
        {
          type: "text",
          text: JSON.stringify(
            {
              providers: providerInfo,
              count: providerInfo.length,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  /**
   * Cache stats resource implementation
   */
  private handleCacheStatsResource(): MCPResourceContents {
    const cacheSize = this.cache?.size() || 0;
    // In a real implementation, you might track cache hits/misses
    return {
      uri: "toprouter://cache/stats",
      contents: [
        {
          type: "text",
          text: JSON.stringify(
            {
              cacheSize,
              cacheEnabled: !!this.cache,
              timestamp: new Date().toISOString(),
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  /**
   * Classifier config resource implementation
   */
  private handleClassifierConfigResource(): MCPResourceContents {
    // This is a placeholder - in a real implementation, you'd expose actual config
    return {
      uri: "toprouter://classifier/config",
      contents: [
        {
          type: "text",
          text: JSON.stringify(
            {
              description: "14-dimensional multilingual classifier",
              features: [
                "reasoningMarkers",
                "codePresence",
                "technicalTerms",
                "multiStepPatterns",
                "agenticTask",
              ],
              timestamp: new Date().toISOString(),
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  /**
   * Validate and convert messages to ensure proper role types
   */
  private validateAndConvertMessages(
    messages: unknown,
  ): Array<{ role: "system" | "user" | "assistant"; content: string }> {
    if (!Array.isArray(messages)) {
      throw new Error("messages must be an array");
    }

    const validatedMessages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [];

    for (const msg of messages) {
      if (typeof msg !== "object" || msg === null) {
        throw new Error("Each message must be an object");
      }

      const messageObj = msg as Record<string, unknown>;
      const role = messageObj.role;
      const content = messageObj.content;

      if (typeof role !== "string" || typeof content !== "string") {
        throw new Error("Each message must have string 'role' and 'content' properties");
      }

      // Convert role to allowed values
      let validRole: "system" | "user" | "assistant";
      if (role === "system" || role === "user" || role === "assistant") {
        validRole = role;
      } else {
        // Default to "user" if role is unknown
        validRole = "user";
      }

      validatedMessages.push({
        role: validRole,
        content,
      });
    }

    return validatedMessages;
  }

  /**
   * Ping method
   */
  private handlePing(_params: unknown): { status: string; timestamp: string } {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create error response
   */
  private createErrorResponse(id: string | number | null, error: unknown): JSONRPCResponse {
    const jsonrpcError: JSONRPCError = {
      code: -32000,
      message: error instanceof Error ? error.message : String(error),
      data: error,
    };

    return {
      jsonrpc: "2.0",
      id,
      error: jsonrpcError,
    };
  }
}
