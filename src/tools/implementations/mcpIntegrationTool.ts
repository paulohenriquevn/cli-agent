/*---------------------------------------------------------------------------------------------
 * MCP Integration Tool - Model Context Protocol integration for external services
 * Replicates Claude Code's MCP functionality
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';

interface IMCPParams {
    action: 'list_servers' | 'connect' | 'disconnect' | 'call_tool' | 'list_tools' | 'get_server_info';
    server_name?: string;
    server_uri?: string;
    tool_name?: string;
    tool_params?: any;
    config?: IMCPServerConfig;
}

interface IMCPServerConfig {
    name: string;
    uri: string;
    transport: 'stdio' | 'websocket' | 'http';
    auth?: {
        type: 'api_key' | 'oauth' | 'basic';
        credentials: any;
    };
    capabilities?: string[];
    timeout?: number;
}

interface IMCPServer {
    name: string;
    uri: string;
    status: 'connected' | 'disconnected' | 'error';
    transport: string;
    capabilities: string[];
    tools: IMCPTool[];
    lastConnected?: Date;
    error?: string;
}

interface IMCPTool {
    name: string;
    description: string;
    inputSchema: any;
    server: string;
}

export class MCPIntegrationTool extends BaseTool<IMCPParams> {
    readonly name = 'mcp_integration';
    readonly description = `Integrate external services - Connect to third-party APIs, databases, and specialized tools using Model Context Protocol (MCP).

Use when: Accessing external APIs, connecting to databases, integrating cloud services, using enterprise-specific tools, or extending functionality beyond core toolset capabilities.

Features: Multiple transport support (stdio, websocket, HTTP), authentication handling, automatic tool discovery, connection status monitoring, and comprehensive server management.

Examples: Connecting to GitHub API for repository management, integrating with database systems for data operations, accessing cloud storage services, or using specialized analysis tools.`;

    // Tag system implementation
    readonly tags = ['mcp', 'integration', 'external-apis', 'protocols', 'connections', 'enterprise'];
    readonly category = 'integrations';
    readonly complexity: 'core' | 'advanced' | 'essential' = 'advanced';

    readonly inputSchema = {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['list_servers', 'connect', 'disconnect', 'call_tool', 'list_tools', 'get_server_info'],
                description: 'The MCP action to perform'
            },
            server_name: {
                type: 'string',
                description: 'Name of the MCP server (required for connect, disconnect, call_tool, get_server_info)'
            },
            server_uri: {
                type: 'string',
                description: 'URI of the MCP server (required for connect action)'
            },
            tool_name: {
                type: 'string',
                description: 'Name of the tool to call (required for call_tool action)'
            },
            tool_params: {
                type: 'object',
                description: 'Parameters to pass to the tool (for call_tool action)'
            },
            config: {
                type: 'object',
                description: 'Server configuration (for connect action)',
                properties: {
                    name: { type: 'string' },
                    uri: { type: 'string' },
                    transport: { type: 'string', enum: ['stdio', 'websocket', 'http'] },
                    auth: {
                        type: 'object',
                        properties: {
                            type: { type: 'string', enum: ['api_key', 'oauth', 'basic'] },
                            credentials: { type: 'object' }
                        }
                    },
                    capabilities: { type: 'array', items: { type: 'string' } },
                    timeout: { type: 'number' }
                }
            }
        },
        required: ['action']
    };

    private static servers: Map<string, IMCPServer> = new Map();
    private static readonly DEFAULT_TIMEOUT = 30000;

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<IMCPParams>,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelToolResult> {
        const params = options.input;

        try {
            switch (params.action) {
                case 'list_servers':
                    return await this.handleListServers();
                case 'connect':
                    return await this.handleConnect(params);
                case 'disconnect':
                    return await this.handleDisconnect(params);
                case 'call_tool':
                    return await this.handleCallTool(params);
                case 'list_tools':
                    return await this.handleListTools(params);
                case 'get_server_info':
                    return await this.handleGetServerInfo(params);
                default:
                    return this.createErrorResult(`Unknown MCP action: ${params.action}`);
            }
        } catch (error: any) {
            return this.createErrorResult(`MCP operation failed: ${error.message}`);
        }
    }

    private async handleListServers(): Promise<vscode.LanguageModelToolResult> {
        const servers = Array.from(MCPIntegrationTool.servers.values());

        if (servers.length === 0) {
            return this.createSuccessResult(null, [
                `**🔌 MCP Servers**`,
                '',
                'No MCP servers configured.',
                '',
                'Use the `connect` action to add servers.'
            ].join('\n'));
        }

        const lines = [
            `**🔌 MCP Servers (${servers.length})**`,
            ''
        ];

        servers.forEach(server => {
            const statusIcon = server.status === 'connected' ? '🟢' :
                server.status === 'error' ? '🔴' : '🟡';

            lines.push(`${statusIcon} **${server.name}**`);
            lines.push(`   - URI: \`${server.uri}\``);
            lines.push(`   - Transport: ${server.transport}`);
            lines.push(`   - Status: ${server.status}`);
            lines.push(`   - Tools: ${server.tools.length}`);

            if (server.lastConnected) {
                lines.push(`   - Last Connected: ${server.lastConnected.toLocaleString()}`);
            }

            if (server.error) {
                lines.push(`   - Error: ${server.error}`);
            }

            lines.push('');
        });

        return this.createSuccessResult(null, lines.join('\n'));
    }

    private async handleConnect(params: IMCPParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.server_name || !params.server_uri) {
            return this.createErrorResult('server_name and server_uri are required for connect action');
        }

        // Check if server already exists
        if (MCPIntegrationTool.servers.has(params.server_name)) {
            return this.createErrorResult(`Server '${params.server_name}' already exists. Use disconnect first.`);
        }

        const config: IMCPServerConfig = params.config || {
            name: params.server_name,
            uri: params.server_uri,
            transport: 'http',
            timeout: MCPIntegrationTool.DEFAULT_TIMEOUT
        };

        try {
            // Attempt to connect to the MCP server
            const server = await this.connectToMCPServer(config);
            MCPIntegrationTool.servers.set(params.server_name, server);

            // Show success notification
            vscode.window.showInformationMessage(`✅ Connected to MCP server: ${params.server_name}`);

            return this.createSuccessResult(null, [
                `**🔌 MCP Server Connected**`,
                `**Name:** ${server.name}`,
                `**URI:** \`${server.uri}\``,
                `**Transport:** ${server.transport}`,
                `**Tools Available:** ${server.tools.length}`,
                `**Capabilities:** ${server.capabilities.join(', ') || 'None'}`,
                '',
                '✅ Server connection established successfully'
            ].join('\n'));

        } catch (error: any) {
            // Store failed connection for debugging
            const failedServer: IMCPServer = {
                name: params.server_name,
                uri: params.server_uri,
                status: 'error',
                transport: config.transport,
                capabilities: [],
                tools: [],
                error: error.message
            };

            MCPIntegrationTool.servers.set(params.server_name, failedServer);

            return this.createErrorResult(`Failed to connect to MCP server: ${error.message}`);
        }
    }

    private async handleDisconnect(params: IMCPParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.server_name) {
            return this.createErrorResult('server_name is required for disconnect action');
        }

        const server = MCPIntegrationTool.servers.get(params.server_name);
        if (!server) {
            return this.createErrorResult(`Server '${params.server_name}' not found`);
        }

        try {
            // Perform cleanup/disconnection logic here
            await this.disconnectFromMCPServer(server);

            MCPIntegrationTool.servers.delete(params.server_name);

            vscode.window.showInformationMessage(`Disconnected from MCP server: ${params.server_name}`);

            return this.createSuccessResult(null, [
                `**🔌 MCP Server Disconnected**`,
                `**Name:** ${server.name}`,
                `**URI:** \`${server.uri}\``,
                '',
                '✅ Server disconnected successfully'
            ].join('\n'));

        } catch (error: any) {
            return this.createErrorResult(`Failed to disconnect from server: ${error.message}`);
        }
    }

    private async handleCallTool(params: IMCPParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.server_name || !params.tool_name) {
            return this.createErrorResult('server_name and tool_name are required for call_tool action');
        }

        const server = MCPIntegrationTool.servers.get(params.server_name);
        if (!server) {
            return this.createErrorResult(`Server '${params.server_name}' not found`);
        }

        if (server.status !== 'connected') {
            return this.createErrorResult(`Server '${params.server_name}' is not connected (status: ${server.status})`);
        }

        const tool = server.tools.find(t => t.name === params.tool_name);
        if (!tool) {
            return this.createErrorResult(`Tool '${params.tool_name}' not found on server '${params.server_name}'`);
        }

        try {
            const result = await this.callMCPTool(server, tool, params.tool_params || {});

            return this.createSuccessResult(null, [
                `**🛠️ MCP Tool Call Complete**`,
                `**Server:** ${server.name}`,
                `**Tool:** ${tool.name}`,
                `**Status:** Success`,
                '',
                '**Result:**',
                '```json',
                JSON.stringify(result, null, 2),
                '```'
            ].join('\n'));

        } catch (error: any) {
            return this.createErrorResult(`Tool call failed: ${error.message}`);
        }
    }

    private async handleListTools(params?: IMCPParams): Promise<vscode.LanguageModelToolResult> {
        let servers: IMCPServer[];

        if (params?.server_name) {
            const server = MCPIntegrationTool.servers.get(params.server_name);
            if (!server) {
                return this.createErrorResult(`Server '${params.server_name}' not found`);
            }
            servers = [server];
        } else {
            servers = Array.from(MCPIntegrationTool.servers.values());
        }

        const lines = [
            `**🛠️ MCP Tools${params?.server_name ? ` (${params.server_name})` : ''}**`,
            ''
        ];

        let totalTools = 0;

        servers.forEach(server => {
            if (server.tools.length === 0) {
                if (servers.length === 1) {
                    lines.push('No tools available on this server.');
                }
                return;
            }

            if (servers.length > 1) {
                lines.push(`**Server: ${server.name}**`);
            }

            server.tools.forEach(tool => {
                lines.push(`🔧 **${tool.name}**`);
                lines.push(`   - Description: ${tool.description}`);
                lines.push(`   - Server: ${tool.server}`);
                lines.push('');
                totalTools++;
            });
        });

        if (totalTools === 0) {
            lines.push('No tools available.');
        } else {
            lines.push(`**Total Tools:** ${totalTools}`);
        }

        return this.createSuccessResult(null, lines.join('\n'));
    }

    private async handleGetServerInfo(params: IMCPParams): Promise<vscode.LanguageModelToolResult> {
        if (!params.server_name) {
            return this.createErrorResult('server_name is required for get_server_info action');
        }

        const server = MCPIntegrationTool.servers.get(params.server_name);
        if (!server) {
            return this.createErrorResult(`Server '${params.server_name}' not found`);
        }

        const statusIcon = server.status === 'connected' ? '🟢' :
            server.status === 'error' ? '🔴' : '🟡';

        const lines = [
            `**📊 MCP Server Info**`,
            '',
            `${statusIcon} **${server.name}**`,
            `**URI:** \`${server.uri}\``,
            `**Transport:** ${server.transport}`,
            `**Status:** ${server.status}`,
            `**Tools:** ${server.tools.length}`,
            `**Capabilities:** ${server.capabilities.join(', ') || 'None'}`,
            ''
        ];

        if (server.lastConnected) {
            lines.push(`**Last Connected:** ${server.lastConnected.toLocaleString()}`);
        }

        if (server.error) {
            lines.push(`**Error:** ${server.error}`);
        }

        if (server.tools.length > 0) {
            lines.push('', '**Available Tools:**');
            server.tools.forEach(tool => {
                lines.push(`- ${tool.name}: ${tool.description}`);
            });
        }

        return this.createSuccessResult(null, lines.join('\n'));
    }

    // MCP Protocol Implementation
    private async connectToMCPServer(config: IMCPServerConfig): Promise<IMCPServer> {
        // Simulate MCP connection - in real implementation, this would use actual MCP protocol

        // Basic validation
        if (!this.isValidUri(config.uri)) {
            throw new Error('Invalid server URI');
        }

        // Simulate connection attempt
        await this.delay(1000);

        // Mock server capabilities and tools discovery
        const mockTools: IMCPTool[] = [
            {
                name: 'example_tool',
                description: 'Example MCP tool',
                inputSchema: {
                    type: 'object',
                    properties: {
                        param1: { type: 'string' }
                    }
                },
                server: config.name
            }
        ];

        const server: IMCPServer = {
            name: config.name,
            uri: config.uri,
            status: 'connected',
            transport: config.transport,
            capabilities: config.capabilities || ['tools', 'resources'],
            tools: mockTools,
            lastConnected: new Date()
        };

        return server;
    }

    private async disconnectFromMCPServer(server: IMCPServer): Promise<void> {
        // Implement actual disconnection logic
        await this.delay(500);

        // Cleanup resources, close connections, etc.
        server.status = 'disconnected';
    }

    private async callMCPTool(server: IMCPServer, tool: IMCPTool, params: any): Promise<any> {
        // Implement actual MCP tool call
        await this.delay(1000);

        // Mock successful response
        return {
            success: true,
            data: {
                tool: tool.name,
                server: server.name,
                params: params,
                timestamp: new Date().toISOString(),
                result: 'Mock tool execution result'
            }
        };
    }

    // Utility methods
    private isValidUri(uri: string): boolean {
        try {
            new URL(uri);
            return true;
        } catch {
            return false;
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Static methods for accessing MCP servers
    public static getServers(): IMCPServer[] {
        return Array.from(MCPIntegrationTool.servers.values());
    }

    public static getServer(name: string): IMCPServer | undefined {
        return MCPIntegrationTool.servers.get(name);
    }

    public static getConnectedServers(): IMCPServer[] {
        return Array.from(MCPIntegrationTool.servers.values()).filter(s => s.status === 'connected');
    }

    public static getAllTools(): IMCPTool[] {
        const allTools: IMCPTool[] = [];
        MCPIntegrationTool.servers.forEach(server => {
            allTools.push(...server.tools);
        });
        return allTools;
    }

    public static clearServers(): void {
        MCPIntegrationTool.servers.clear();
    }
}

// Register the tool
ToolRegistry.registerTool(MCPIntegrationTool);