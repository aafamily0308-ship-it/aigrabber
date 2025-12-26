// Tool Executor - Unified interface for executing tools from plugins and MCP
// Phase 4: MCP & Plugins

import { executeTool as executePluginTool, PluginContext, pluginRegistry } from './pluginSystem';
import { callMCPTool, mcpClient } from './mcpClient';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  source: 'plugin' | 'mcp';
  serverId?: string; // For MCP tools
}

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  source: 'plugin' | 'mcp';
  serverId?: string;
  serverName?: string;
  pluginId?: string;
  pluginName?: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

// Get all available tools from both plugins and MCP
export function getAllAvailableTools(): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  // Add plugin tools
  const pluginTools = pluginRegistry.getAllTools();
  for (const plugin of pluginRegistry.getEnabledPlugins()) {
    for (const tool of plugin.tools || []) {
      tools.push({
        name: tool.name,
        description: tool.description,
        source: 'plugin',
        pluginId: plugin.metadata.id,
        pluginName: plugin.metadata.name,
        parameters: tool.parameters as ToolDefinition['parameters'],
      });
    }
  }

  // Add MCP tools
  const mcpTools = mcpClient.getAllTools();
  for (const { serverId, serverName, tool } of mcpTools) {
    tools.push({
      name: tool.name,
      description: tool.description,
      source: 'mcp',
      serverId,
      serverName,
      parameters: tool.inputSchema as ToolDefinition['parameters'],
    });
  }

  return tools;
}

// Execute a tool by name
export async function executeToolByName(
  toolName: string,
  args: Record<string, unknown>,
  context: PluginContext
): Promise<ToolResult> {
  const startTime = Date.now();
  const toolCallId = `${toolName}-${Date.now()}`;

  // First check plugin tools
  const pluginTools = pluginRegistry.getAllTools();
  const pluginTool = pluginTools.find(t => t.name === toolName);
  
  if (pluginTool) {
    const result = await executePluginTool(toolName, args, context);
    return {
      toolCallId,
      success: result.success,
      result: result.result,
      error: result.error,
      executionTime: Date.now() - startTime,
    };
  }

  // Then check MCP tools
  const mcpTools = mcpClient.getAllTools();
  const mcpTool = mcpTools.find(t => t.tool.name === toolName);
  
  if (mcpTool) {
    const result = await callMCPTool(mcpTool.serverId, toolName, args);
    return {
      toolCallId,
      success: result.success,
      result: result.result,
      error: result.error,
      executionTime: Date.now() - startTime,
    };
  }

  return {
    toolCallId,
    success: false,
    error: `Tool "${toolName}" not found in plugins or MCP servers`,
    executionTime: Date.now() - startTime,
  };
}

// Execute multiple tools in parallel
export async function executeToolsParallel(
  toolCalls: ToolCall[],
  context: PluginContext
): Promise<ToolResult[]> {
  const promises = toolCalls.map(async (call) => {
    const startTime = Date.now();

    try {
      if (call.source === 'plugin') {
        const result = await executePluginTool(call.name, call.arguments, context);
        return {
          toolCallId: call.id,
          success: result.success,
          result: result.result,
          error: result.error,
          executionTime: Date.now() - startTime,
        };
      } else if (call.source === 'mcp' && call.serverId) {
        const result = await callMCPTool(call.serverId, call.name, call.arguments);
        return {
          toolCallId: call.id,
          success: result.success,
          result: result.result,
          error: result.error,
          executionTime: Date.now() - startTime,
        };
      } else {
        return {
          toolCallId: call.id,
          success: false,
          error: 'Invalid tool call configuration',
          executionTime: Date.now() - startTime,
        };
      }
    } catch (error: any) {
      return {
        toolCallId: call.id,
        success: false,
        error: error.message || 'Tool execution failed',
        executionTime: Date.now() - startTime,
      };
    }
  });

  return Promise.all(promises);
}

// Parse tool calls from AI response (for function calling)
export function parseToolCallsFromResponse(response: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  
  // Look for JSON tool call blocks in the response
  const toolCallPattern = /```tool\s*\n([\s\S]*?)\n```/g;
  let match;

  while ((match = toolCallPattern.exec(response)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.name && parsed.arguments) {
        // Determine source
        const mcpTools = mcpClient.getAllTools();
        const mcpTool = mcpTools.find(t => t.tool.name === parsed.name);

        toolCalls.push({
          id: `${parsed.name}-${Date.now()}-${toolCalls.length}`,
          name: parsed.name,
          arguments: parsed.arguments,
          source: mcpTool ? 'mcp' : 'plugin',
          serverId: mcpTool?.serverId,
        });
      }
    } catch (e) {
      console.warn('Failed to parse tool call:', e);
    }
  }

  return toolCalls;
}

// Format tool results for inclusion in AI context
export function formatToolResultsForContext(results: ToolResult[]): string {
  if (results.length === 0) return '';

  return results.map(result => {
    if (result.success) {
      return `Tool "${result.toolCallId}" succeeded:\n${JSON.stringify(result.result, null, 2)}`;
    } else {
      return `Tool "${result.toolCallId}" failed: ${result.error}`;
    }
  }).join('\n\n');
}

// Generate system prompt addition for available tools
export function generateToolsPrompt(): string {
  const tools = getAllAvailableTools();
  
  if (tools.length === 0) {
    return '';
  }

  const toolDescriptions = tools.map(tool => {
    const source = tool.source === 'plugin' 
      ? `Plugin: ${tool.pluginName}` 
      : `MCP: ${tool.serverName}`;
    
    return `- ${tool.name}: ${tool.description} (${source})`;
  }).join('\n');

  return `
You have access to the following tools:

${toolDescriptions}

To use a tool, include a code block with the following format:
\`\`\`tool
{
  "name": "tool_name",
  "arguments": {
    "arg1": "value1"
  }
}
\`\`\`

Tools will be executed and their results will be provided in the conversation.
`.trim();
}
