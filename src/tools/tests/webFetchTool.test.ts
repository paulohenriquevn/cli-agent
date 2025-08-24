/*---------------------------------------------------------------------------------------------
 * Web Fetch Tool Tests
 *--------------------------------------------------------------------------------------------*/

import { ToolRegistry } from '../registry/toolRegistry';
import { createTestContext } from './setup';

describe('WebFetchTool', () => {
    // const registry = ToolRegistry;
    const context = createTestContext();

    test('should fetch and analyze web content', async () => {
        const result = await ToolRegistry.executeTool('web_fetch', {
            url: 'https://example.com',
            prompt: 'Analyze the content of this webpage'
        }, context);

        expect(result.getText()).toContain('🌐 Web Fetch Complete');
        expect(result.getText()).toContain('https://example.com');
        expect(result.getText()).toContain('Analyze the content');
    });

    test('should validate URL format', async () => {
        const result = await ToolRegistry.executeTool('web_fetch', {
            url: 'invalid-url',
            prompt: 'Test invalid URL'
        }, context);

        expect(result.hasErrors()).toBe(true);
    });

    test('should handle different URL schemes', async () => {
        const urls = [
            'https://example.com',
            'http://example.com',
            'https://docs.example.com/api'
        ];

        for (const url of urls) {
            const result = await ToolRegistry.executeTool('web_fetch', {
                url,
                prompt: 'Test URL scheme'
            }, context);

            expect(result.getText()).toContain('🌐 Web Fetch Complete');
            expect(result.getText()).toContain('URL:');
        }
    });

    test('should handle complex analysis prompts', async () => {
        const complexPrompt = `Please analyze this webpage and extract:
1. The main title and headings
2. Any code examples or technical content
3. Navigation structure
4. Key information for developers
5. Any API documentation or endpoints mentioned`;

        const result = await ToolRegistry.executeTool('web_fetch', {
            url: 'https://api.example.com/docs',
            prompt: complexPrompt
        }, context);

        expect(result.getText()).toContain('main title and headings');
        expect(result.getText()).toContain('code examples');
        expect(result.getText()).toContain('API documentation');
    });

    test('should show fetch metadata', async () => {
        const result = await ToolRegistry.executeTool('web_fetch', {
            url: 'https://example.com',
            prompt: 'Get page info'
        }, context);

        expect(result.getText()).toContain('URL:');
        expect(result.getText()).toContain('Processing prompt:');
        expect(result.getText()).toContain('📊 AI Analysis:');
    });

    test('should handle missing prompt', async () => {
        const result = await ToolRegistry.executeTool('web_fetch', {
            url: 'https://example.com'
            // Missing prompt
        }, context);

        expect(result.getText()).toContain('🌐 Web Fetch Complete');
    });

    test('should handle HTTPS upgrade', async () => {
        const result = await ToolRegistry.executeTool('web_fetch', {
            url: 'http://example.com',
            prompt: 'Test HTTPS upgrade'
        }, context);

        expect(result.getText()).toContain('https://example.com');
    });

    test('should simulate fetch timeout', async () => {
        const result = await ToolRegistry.executeTool('web_fetch', {
            url: 'https://very-slow-website.example',
            prompt: 'Test timeout handling'
        }, context);

        expect(result.getText()).toContain('🌐 Web Fetch Complete');
    });

    test('should handle special characters in prompts', async () => {
        const specialPrompt = 'Analyze: "quotes", & symbols, émojis 🚀, and other chars @#$%';

        const result = await ToolRegistry.executeTool('web_fetch', {
            url: 'https://example.com',
            prompt: specialPrompt
        }, context);

        expect(result.getText()).toContain('"quotes"');
        expect(result.getText()).toContain('émojis 🚀');
    });

    test('should show execution time', async () => {
        const result = await ToolRegistry.executeTool('web_fetch', {
            url: 'https://example.com',
            prompt: 'Time test'
        }, context);

        expect(result.getText()).toContain('Content length:');
        expect(result.getText()).toMatch(/\d+ characters/);
    });

    test('should handle domain redirects info', async () => {
        const result = await ToolRegistry.executeTool('web_fetch', {
            url: 'https://redirect.example.com',
            prompt: 'Test redirect handling'
        }, context);

        expect(result.getText()).toContain('🌐 Web Fetch Complete');
        expect(result.getText()).toContain('redirect.example.com');
    });
});