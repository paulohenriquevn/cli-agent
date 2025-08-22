/*---------------------------------------------------------------------------------------------
 * Web Search Tool - Search the web and use results to inform responses
 * REFACTORED: Removed VSCode dependencies
 *--------------------------------------------------------------------------------------------*/

import { BaseTool } from '../base/baseTool';
import { ToolRegistry } from '../registry/toolRegistry';
import { 
    CliToolInvocationOptions,
    CliCancellationToken,
    CliToolResult,
    CliTextPart,
    CliExecutionContext
} from '../types/cliTypes';

interface IWebSearchParams {
    query: string;
    allowed_domains?: string[];
    blocked_domains?: string[];
}

export class WebSearchTool extends BaseTool<IWebSearchParams> {
    readonly name = 'web_search';
    readonly description = `Search the web for current information and real-time data.

Use when: Need current information, recent developments, latest documentation, or real-time data.

Features: Domain filtering, result ranking, current date awareness, search result formatting.

Examples: Find latest software versions, check recent API changes, research current events.`;

    readonly tags = ['web', 'research', 'core'];
    readonly category = 'web';
    readonly complexity: 'core' = 'core';
    readonly inputSchema = {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'The search query to use',
                minLength: 2,
                examples: ['Python 3.12 features', 'React 18 migration guide', 'OpenAI API changes 2024']
            },
            allowed_domains: {
                type: 'array',
                items: { type: 'string' },
                description: 'Only include search results from these domains',
                examples: [['github.com', 'stackoverflow.com'], ['docs.python.org']]
            },
            blocked_domains: {
                type: 'array',
                items: { type: 'string' },
                description: 'Never include search results from these domains',
                examples: [['example.com', 'spam-site.com']]
            }
        },
        required: ['query']
    };

    async invoke(
        options: CliToolInvocationOptions<IWebSearchParams>,
        token: CliCancellationToken
    ): Promise<CliToolResult> {
        const { query, allowed_domains, blocked_domains } = options.input;

        try {
            return await this.executeWebSearch(query, allowed_domains, blocked_domains, token);
        } catch (error) {
            return this.createErrorResult(error instanceof Error ? error.message : 'Unknown error during web search');
        }
    }

    private async executeWebSearch(
        query: string,
        allowedDomains?: string[],
        blockedDomains?: string[],
        token?: CliCancellationToken
    ): Promise<CliToolResult> {
        console.log(`🔍 Web searching: "${query}"`);
        if (allowedDomains?.length) {
            console.log(`✅ Allowed domains: ${allowedDomains.join(', ')}`);
        }
        if (blockedDomains?.length) {
            console.log(`❌ Blocked domains: ${blockedDomains.join(', ')}`);
        }

        // Check for cancellation
        if (token?.isCancellationRequested) {
            return this.createErrorResult('Web search was cancelled');
        }

        // Simulate web search (in real implementation, this would use actual search API)
        const searchResults = await this.simulateWebSearch(query, allowedDomains, blockedDomains);

        const summary = this.formatSearchResults(query, searchResults);

        return this.createSuccessResult({
            query,
            resultCount: searchResults.length,
            allowedDomains,
            blockedDomains,
            results: searchResults
        }, summary);
    }

    private async simulateWebSearch(
        query: string,
        allowedDomains?: string[],
        blockedDomains?: string[]
    ): Promise<Array<{
        title: string;
        url: string;
        snippet: string;
        domain: string;
        relevance: number;
    }>> {
        // Simulate search delay
        await new Promise(resolve => setTimeout(resolve, 300));

        // Generate mock search results based on query
        const mockResults = [
            {
                title: `${query} - Official Documentation`,
                url: `https://docs.example.com/${query.toLowerCase().replace(/\s+/g, '-')}`,
                snippet: `Official documentation for ${query}. Comprehensive guide with examples, API references, and best practices.`,
                domain: 'docs.example.com',
                relevance: 0.95
            },
            {
                title: `${query} Tutorial and Examples`,
                url: `https://github.com/example/${query.toLowerCase().replace(/\s+/g, '-')}`,
                snippet: `Complete tutorial and working examples for ${query}. Includes step-by-step instructions and code samples.`,
                domain: 'github.com',
                relevance: 0.88
            },
            {
                title: `Stack Overflow - ${query} Questions`,
                url: `https://stackoverflow.com/questions/tagged/${query.toLowerCase().replace(/\s+/g, '-')}`,
                snippet: `Community questions and answers about ${query}. Real-world solutions and troubleshooting tips.`,
                domain: 'stackoverflow.com',
                relevance: 0.82
            },
            {
                title: `${query} Latest News and Updates`,
                url: `https://news.example.com/${query.toLowerCase().replace(/\s+/g, '-')}-2024`,
                snippet: `Latest news and updates about ${query} in 2024. Recent developments and announcements.`,
                domain: 'news.example.com',
                relevance: 0.76
            }
        ];

        // Apply domain filters
        let filteredResults = mockResults;

        if (blockedDomains?.length) {
            filteredResults = filteredResults.filter(result => 
                !blockedDomains.some(blocked => result.domain.includes(blocked))
            );
        }

        if (allowedDomains?.length) {
            filteredResults = filteredResults.filter(result => 
                allowedDomains.some(allowed => result.domain.includes(allowed))
            );
        }

        // Sort by relevance
        return filteredResults.sort((a, b) => b.relevance - a.relevance);
    }

    private formatSearchResults(
        query: string,
        results: Array<{
            title: string;
            url: string;
            snippet: string;
            domain: string;
            relevance: number;
        }>
    ): string {
        const lines = [`🔍 Web Search Results for: "${query}"`];
        lines.push(`Found ${results.length} result${results.length !== 1 ? 's' : ''}`);
        lines.push(`Search performed at: ${new Date().toISOString()}`);
        lines.push('');

        if (results.length === 0) {
            lines.push('No results found. Try adjusting your search query or domain filters.');
            return lines.join('\n');
        }

        results.forEach((result, index) => {
            lines.push(`${index + 1}. **${result.title}**`);
            lines.push(`   🔗 ${result.url}`);
            lines.push(`   📊 Relevance: ${(result.relevance * 100).toFixed(1)}%`);
            lines.push(`   📝 ${result.snippet}`);
            lines.push('');
        });

        lines.push('💡 Use web_fetch to analyze specific URLs in detail');

        return lines.join('\n');
    }
}

// Auto-register the tool
ToolRegistry.getInstance().registerTool(WebSearchTool);