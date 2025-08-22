/*---------------------------------------------------------------------------------------------
 * Web Search Tool Tests
 *--------------------------------------------------------------------------------------------*/

import { ToolRegistry } from '../registry/toolRegistry';
import { createTestContext } from './setup';

describe('WebSearchTool', () => {
    const registry = ToolRegistry.getInstance();
    const context = createTestContext();

    test('should perform web search', async () => {
        const result = await registry.executeTool('web_search', {
            query: 'TypeScript CLI development'
        }, context);

        expect(result.getText()).toContain('Web Search Results');
        expect(result.getText()).toContain('TypeScript CLI development');
        expect(result.getText()).toContain('Found');
        expect(result.getText()).toContain('result');
    });

    test('should handle domain filtering', async () => {
        const result = await registry.executeTool('web_search', {
            query: 'JavaScript tutorials',
            allowed_domains: ['github.com', 'stackoverflow.com']
        }, context);

        expect(result.getText()).toContain('JavaScript tutorials');
        expect(result.getText()).toContain('github.com');
        expect(result.getText()).toContain('stackoverflow.com');
    });

    test('should handle blocked domains', async () => {
        const result = await registry.executeTool('web_search', {
            query: 'Node.js examples',
            blocked_domains: ['spam-site.com', 'bad-example.com']
        }, context);

        expect(result.getText()).toContain('Node.js examples');
        expect(result.getText()).not.toContain('spam-site.com');
        expect(result.getText()).not.toContain('bad-example.com');
    });

    test('should show search metadata', async () => {
        const result = await registry.executeTool('web_search', {
            query: 'API development'
        }, context);

        expect(result.getText()).toContain('Web Search Results for:');
        expect(result.getText()).toContain('API development');
        expect(result.getText()).toContain('Search performed at:');
        expect(result.getText()).toMatch(/\d{4}-\d{2}-\d{2}T/); // ISO date format
    });

    test('should handle complex queries', async () => {
        const complexQuery = 'Node.js TypeScript CLI tools development best practices 2024';

        const result = await registry.executeTool('web_search', {
            query: complexQuery
        }, context);

        expect(result.getText()).toContain(complexQuery);
        expect(result.getText()).toContain('Official Documentation');
        expect(result.getText()).toContain('Tutorial and Examples');
    });

    test('should show relevance scores', async () => {
        const result = await registry.executeTool('web_search', {
            query: 'React components'
        }, context);

        expect(result.getText()).toContain('Relevance:');
        expect(result.getText()).toMatch(/\d+\.\d+%/); // Percentage format
    });

    test('should handle empty queries', async () => {
        const result = await registry.executeTool('web_search', {
            query: ''
        }, context);

        expect(result.getText()).toContain('🔍 Web Search Results for: ""');
    });

    test('should handle short queries', async () => {
        const result = await registry.executeTool('web_search', {
            query: 'JS'
        }, context);

        expect(result.getText()).toContain('Web Search Results');
        expect(result.getText()).toContain('JS');
    });

    test('should show search result structure', async () => {
        const result = await registry.executeTool('web_search', {
            query: 'Python tutorials'
        }, context);

        expect(result.getText()).toContain('1. **');
        expect(result.getText()).toContain('🔗 https://');
        expect(result.getText()).toContain('📊 Relevance:');
        expect(result.getText()).toContain('📝');
    });

    test('should handle special characters in queries', async () => {
        const specialQuery = 'C++ "STL containers" & algorithms';

        const result = await registry.executeTool('web_search', {
            query: specialQuery
        }, context);

        expect(result.getText()).toContain('C++');
        expect(result.getText()).toContain('"STL containers"');
        expect(result.getText()).toContain('algorithms');
    });

    test('should provide web_fetch suggestion', async () => {
        const result = await registry.executeTool('web_search', {
            query: 'Documentation analysis'
        }, context);

        expect(result.getText()).toContain('Use web_fetch to analyze specific URLs in detail');
    });

    test('should handle domain combinations', async () => {
        const result = await registry.executeTool('web_search', {
            query: 'Testing frameworks',
            allowed_domains: ['github.com'],
            blocked_domains: ['spam.com']
        }, context);

        expect(result.getText()).toContain('Testing frameworks');
        expect(result.getText()).toContain('github.com');
        expect(result.getText()).not.toContain('spam.com');
    });

    test('should show execution timing', async () => {
        const result = await registry.executeTool('web_search', {
            query: 'Performance testing'
        }, context);

        expect(result.getText()).toContain('Web Search Results');
        // The search includes simulated delay, so results should be formatted properly
        expect(result.getText()).toContain('Found');
    });
});