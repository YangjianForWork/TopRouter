/**
 * Model Context Protocol (MCP) Type Definitions for TopRouter
 * Based on JSON-RPC 2.0 specification
 */

export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: unknown;
}

export interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: JSONRPCError;
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * MCP Server Information
 */
export interface MCPServerInfo {
  name: string;
  version: string;
  capabilities: MCPServerCapabilities;
}

export interface MCPServerCapabilities {
  tools?: MCPServerToolCapabilities;
  resources?: MCPServerResourceCapabilities;
}

export interface MCPServerToolCapabilities {
  listChanged?: boolean;
}

export interface MCPServerResourceCapabilities {
  listChanged?: boolean;
  subscribe?: boolean;
}

/**
 * MCP Tools
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: MCPToolInputSchema;
}

export interface MCPToolInputSchema {
  type: "object";
  properties: Record<string, MCPToolInputProperty>;
  required?: string[];
}

export interface MCPToolInputProperty {
  type: string;
  description: string;
  enum?: string[];
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
}

/**
 * MCP Resources
 */
export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface MCPResourceContents {
  uri: string;
  contents: Array<{
    type: "text";
    text: string;
  }>;
}

/**
 * MCP Methods (JSON-RPC methods)
 */
export type MCPMethod =
  | "initialize"
  | "tools/list"
  | "tools/call"
  | "resources/list"
  | "resources/read"
  | "notifications/initialized"
  | "ping";

/**
 * MCP Requests and Responses
 */
export interface MCPInitializeRequest {
  method: "initialize";
  params: {
    protocolVersion: string;
    capabilities: {
      client: Record<string, unknown>;
    };
  };
}

export interface MCPInitializeResponse {
  result: {
    protocolVersion: string;
    capabilities: MCPServerCapabilities;
    serverInfo: MCPServerInfo;
  };
}

export interface MCPToolsListRequest {
  method: "tools/list";
  params?: Record<string, never>;
}

export interface MCPToolsListResponse {
  result: {
    tools: MCPTool[];
  };
}

export interface MCPToolsCallRequest {
  method: "tools/call";
  params: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface MCPToolsCallResponse {
  result: MCPToolResult;
}

export interface MCPResourcesListRequest {
  method: "resources/list";
  params?: Record<string, never>;
}

export interface MCPResourcesListResponse {
  result: {
    resources: MCPResource[];
  };
}

export interface MCPResourcesReadRequest {
  method: "resources/read";
  params: {
    uri: string;
  };
}

export interface MCPResourcesReadResponse {
  result: MCPResourceContents;
}
