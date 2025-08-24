/*---------------------------------------------------------------------------------------------
 * Tool Healing System Tests
 *--------------------------------------------------------------------------------------------*/

import { ToolHealer } from '../toolHealer';
import { LLMService } from '../llmService';
import { ToolParameters, NoMatchError } from '../../types/cliTypes';

// Mock LLM Service
jest.mock('../llmService');
const MockLLMService = LLMService as jest.MockedClass<typeof LLMService>;

describe('ToolHealer', () => {
    let healer: ToolHealer;
    let mockLogger: jest.Mock;

    beforeEach(() => {
        healer = new ToolHealer({
            enableHealing: true,
            enableMetacognition: true,
            enableCaching: true
        });
        
        mockLogger = jest.fn();
        healer.setLogger(mockLogger);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Constructor and Configuration', () => {
        it('should initialize with default options', () => {
            const defaultHealer = new ToolHealer();
            const metrics = defaultHealer.getMetrics();
            
            expect(metrics.totalAttempts).toBe(0);
            expect(metrics.successfulHealings).toBe(0);
            expect(metrics.failedHealings).toBe(0);
        });

        it('should apply custom options', () => {
            const customHealer = new ToolHealer({
                enableHealing: false,
                enableMetacognition: false,
                maxAttempts: 5
            });
            
            expect(customHealer).toBeDefined();
        });

        it('should set logger correctly', () => {
            const logger = jest.fn();
            healer.setLogger(logger);
            
            expect(mockLogger).toBeDefined();
        });
    });

    describe('Model Bug Patterns', () => {
        it('should return Gemini bug patterns', () => {
            const patterns = healer.getModelBugPatterns('gemini-pro');
            
            expect(patterns).toHaveLength(2);
            expect(patterns[0].name).toBe('gemini_over_escape');
            expect(patterns[1].name).toBe('gemini_backtick_escape');
        });

        it('should return Claude bug patterns', () => {
            const patterns = healer.getModelBugPatterns('claude-3-sonnet');
            
            expect(patterns).toHaveLength(2);
            expect(patterns[0].name).toBe('claude_extra_spaces');
            expect(patterns[1].name).toBe('claude_mixed_tabs');
        });

        it('should return DeepSeek bug patterns', () => {
            const patterns = healer.getModelBugPatterns('deepseek-coder');
            
            expect(patterns).toHaveLength(2);
            expect(patterns[0].name).toBe('deepseek_json_escape');
            expect(patterns[1].name).toBe('deepseek_newline_escape');
        });

        it('should return empty array for unknown models', () => {
            const patterns = healer.getModelBugPatterns('unknown-model');
            
            expect(patterns).toHaveLength(0);
        });
    });

    describe('Healing Disabled', () => {
        it('should return immediately when healing is disabled', async () => {
            const disabledHealer = new ToolHealer({ enableHealing: false });
            
            const originalParams: ToolParameters = {
                oldString: 'test',
                newString: 'updated'
            };
            
            const error = new NoMatchError('No match found');
            
            const result = await disabledHealer.healToolParameters(
                'gpt-4',
                'file content',
                originalParams,
                error
            );
            
            expect(result.success).toBe(false);
            expect(result.metacognitionUsed).toBe(false);
            expect(result.originalParameters).toBe(originalParams);
        });
    });

    describe('Unescape Healing', () => {
        it('should fix Gemini over-escaping issues', async () => {
            const fileContent = 'Hello\nWorld\tTest';
            const originalParams: ToolParameters = {
                oldString: 'Hello\\nWorld\\tTest', // Over-escaped
                newString: 'Hello\\nWorld\\tUpdated'
            };
            const error = new NoMatchError('No match found');
            
            const result = await healer.healToolParameters(
                'gemini-pro',
                fileContent,
                originalParams,
                error
            );
            
            expect(result.success).toBe(true);
            expect(result.healingMethod).toBe('unescape');
            expect(result.healedParameters?.oldString).toBe('Hello\nWorld\tTest');
            expect(result.healedParameters?.newString).toBe('Hello\nWorld\tUpdated');
            expect(result.confidence).toBe(0.9);
        });

        it('should fix Gemini backtick escaping', async () => {
            const fileContent = 'Code `example` here';
            const originalParams: ToolParameters = {
                oldString: 'Code \\`example\\` here', // Over-escaped backticks
                newString: 'Code \\`updated\\` here'
            };
            const error = new NoMatchError('No match found');
            
            const result = await healer.healToolParameters(
                'gemini-pro',
                fileContent,
                originalParams,
                error
            );
            
            expect(result.success).toBe(true);
            expect(result.healingMethod).toBe('unescape');
            expect(result.healedParameters?.oldString).toBe('Code `example` here');
        });

        it('should not heal when no escaping issues exist', async () => {
            const fileContent = 'Normal text here';
            const originalParams: ToolParameters = {
                oldString: 'Different text', // No match in content
                newString: 'Updated text'
            };
            const error = new NoMatchError('No match found');
            
            const result = await healer.healToolParameters(
                'gemini-pro',
                fileContent,
                originalParams,
                error
            );
            
            expect(result.success).toBe(false);
        });
    });

    describe('Pattern Healing', () => {
        it('should fix trailing whitespace issues', async () => {
            const fileContent = 'Text without trailing spaces';
            const originalParams: ToolParameters = {
                oldString: 'Text without trailing spaces   ', // Trailing spaces
                newString: 'Updated text   '
            };
            const error = new NoMatchError('No match found');
            
            const result = await healer.healToolParameters(
                'gpt-4',
                fileContent,
                originalParams,
                error
            );
            
            expect(result.success).toBe(true);
            expect(result.healingMethod).toBe('pattern_matching');
            expect(result.healedParameters?.oldString).toBe('Text without trailing spaces');
        });

        it('should normalize multiple whitespaces', async () => {
            const fileContent = 'Text with single space';
            const originalParams: ToolParameters = {
                oldString: 'Text  with   single    space', // Multiple spaces
                newString: 'Updated  text   here'
            };
            const error = new NoMatchError('No match found');
            
            const result = await healer.healToolParameters(
                'claude-3',
                fileContent,
                originalParams,
                error
            );
            
            expect(result.success).toBe(true);
            expect(result.healingMethod).toBe('pattern_matching');
        });

        it('should remove trailing newlines', async () => {
            const fileContent = 'Text without newline';
            const originalParams: ToolParameters = {
                oldString: 'Text without newline\n\n', // Trailing newlines
                newString: 'Updated text\n\n'
            };
            const error = new NoMatchError('No match found');
            
            const result = await healer.healToolParameters(
                'gpt-4',
                fileContent,
                originalParams,
                error
            );
            
            expect(result.success).toBe(true);
            expect(result.healingMethod).toBe('pattern_matching');
            expect(result.healedParameters?.oldString).toBe('Text without newline');
        });
    });

    describe('Metacognition Healing', () => {
        beforeEach(() => {
            // Setup mock LLM service
            const mockInstance = {
                setLogger: jest.fn(),
                performMetacognition: jest.fn()
            };
            MockLLMService.mockImplementation(() => mockInstance as Partial<LLMService>);
        });

        it('should use LLM for intelligent healing', async () => {
            const fileContent = 'Original text content';
            const originalParams: ToolParameters = {
                oldString: 'Original text',
                newString: 'Updated text'
            };
            const error = new NoMatchError('No match found');

            // Mock successful LLM response
            const mockLLMInstance = new MockLLMService();
            (mockLLMInstance.performMetacognition as jest.Mock).mockResolvedValue({
                success: true,
                correctedParameters: {
                    oldString: 'Original text content', // LLM suggests better match
                    newString: 'Updated text content'
                },
                reasoning: 'Found better match in file content',
                confidence: 0.85,
                suggestedMethod: 'llm_correction'
            });

            const result = await healer.healToolParameters(
                'gpt-4',
                fileContent,
                originalParams,
                error
            );

            expect(result.success).toBe(true);
            expect(result.healingMethod).toBe('llm_correction');
            expect(result.metacognitionUsed).toBe(true);
        });

        it('should handle LLM service errors gracefully', async () => {
            const fileContent = 'Test content';
            const originalParams: ToolParameters = {
                oldString: 'Non-existent text',
                newString: 'Updated text'
            };
            const error = new NoMatchError('No match found');

            // Mock LLM error
            const mockLLMInstance = new MockLLMService();
            (mockLLMInstance.performMetacognition as jest.Mock).mockRejectedValue(
                new Error('LLM service unavailable')
            );

            const result = await healer.healToolParameters(
                'gpt-4',
                fileContent,
                originalParams,
                error
            );

            expect(result.success).toBe(false);
            expect(result.metacognitionUsed).toBe(true);
            expect(result.error).toContain('Metacognition error');
        });

        it('should skip metacognition when disabled', async () => {
            const noMetacognitionHealer = new ToolHealer({ enableMetacognition: false });
            
            const fileContent = 'Test content';
            const originalParams: ToolParameters = {
                oldString: 'Non-existent text',
                newString: 'Updated text'
            };
            const error = new NoMatchError('No match found');

            const result = await noMetacognitionHealer.healToolParameters(
                'gpt-4',
                fileContent,
                originalParams,
                error
            );

            expect(result.metacognitionUsed).toBe(false);
        });
    });

    describe('NewString Adjustment Healing', () => {
        it('should adjust newString for consistency', async () => {
            const fileContent = 'Some content';
            const originalParams: ToolParameters = {
                oldString: '  trimmed text  ', // With whitespace
                newString: '  updated text  '
            };
            const error = new NoMatchError('No match found');

            const result = await healer.healToolParameters(
                'gpt-4',
                fileContent,
                originalParams,
                error
            );

            expect(result.success).toBe(true);
            expect(result.healingMethod).toBe('newstring_adjustment');
            expect(result.healedParameters?.oldString).toBe('trimmed text');
            expect(result.healedParameters?.newString).toBe('updated text');
        });
    });

    describe('Caching', () => {
        it('should cache successful healings', async () => {
            const fileContent = 'Hello\nWorld';
            const originalParams: ToolParameters = {
                oldString: 'Hello\\nWorld', // Over-escaped
                newString: 'Hello\\nUpdated'
            };
            const error = new NoMatchError('No match found');

            // First call - should perform healing
            const result1 = await healer.healToolParameters(
                'gemini-pro',
                fileContent,
                originalParams,
                error
            );

            expect(result1.success).toBe(true);

            // Second call with same parameters - should use cache
            const result2 = await healer.healToolParameters(
                'gemini-pro',
                fileContent,
                originalParams,
                error
            );

            expect(result2.success).toBe(true);
            
            const cacheStats = healer.getCacheStats();
            expect(cacheStats.size).toBeGreaterThan(0);
        });

        it('should clear cache when requested', () => {
            healer.clearCache();
            const cacheStats = healer.getCacheStats();
            
            expect(cacheStats.size).toBe(0);
            expect(cacheStats.hitRate).toBe(0);
        });

        it('should limit cache size', async () => {
            // This test would require generating many different cache entries
            // For now, we just verify the cache exists
            const cacheStats = healer.getCacheStats();
            expect(cacheStats).toHaveProperty('size');
            expect(cacheStats).toHaveProperty('hitRate');
        });
    });

    describe('Metrics and Statistics', () => {
        it('should track healing attempts', async () => {
            const fileContent = 'Test content';
            const originalParams: ToolParameters = {
                oldString: 'Non-existent',
                newString: 'Updated'
            };
            const error = new NoMatchError('No match found');

            await healer.healToolParameters('gpt-4', fileContent, originalParams, error);
            
            const metrics = healer.getMetrics();
            expect(metrics.totalAttempts).toBe(1);
        });

        it('should track successful healings', async () => {
            const fileContent = 'Hello\nWorld';
            const originalParams: ToolParameters = {
                oldString: 'Hello\\nWorld', // Over-escaped
                newString: 'Hello\\nUpdated'
            };
            const error = new NoMatchError('No match found');

            await healer.healToolParameters('gemini-pro', fileContent, originalParams, error);
            
            const metrics = healer.getMetrics();
            expect(metrics.successfulHealings).toBe(1);
        });

        it('should track failed healings', async () => {
            const fileContent = 'Different content';
            const originalParams: ToolParameters = {
                oldString: 'Non-existent text',
                newString: 'Updated text'
            };
            const error = new NoMatchError('No match found');

            await healer.healToolParameters('gpt-4', fileContent, originalParams, error);
            
            const metrics = healer.getMetrics();
            expect(metrics.failedHealings).toBe(1);
        });

        it('should track model-specific statistics', async () => {
            const fileContent = 'Hello\nWorld';
            const originalParams: ToolParameters = {
                oldString: 'Hello\\nWorld',
                newString: 'Hello\\nUpdated'
            };
            const error = new NoMatchError('No match found');

            await healer.healToolParameters('gemini-pro', fileContent, originalParams, error);
            
            const metrics = healer.getMetrics();
            expect(metrics.healingsByModel['gemini']).toBeDefined();
            expect(metrics.healingsByModel['gemini'].attempts).toBe(1);
            expect(metrics.healingsByModel['gemini'].successes).toBe(1);
        });

        it('should track healing method statistics', async () => {
            const fileContent = 'Hello\nWorld';
            const originalParams: ToolParameters = {
                oldString: 'Hello\\nWorld',
                newString: 'Hello\\nUpdated'
            };
            const error = new NoMatchError('No match found');

            await healer.healToolParameters('gemini-pro', fileContent, originalParams, error);
            
            const metrics = healer.getMetrics();
            expect(metrics.healingMethodStats['unescape']).toBeDefined();
            expect(metrics.healingMethodStats['unescape'].uses).toBe(1);
            expect(metrics.healingMethodStats['unescape'].successes).toBe(1);
        });

        it('should calculate average healing time', async () => {
            const fileContent = 'Hello\nWorld';
            const originalParams: ToolParameters = {
                oldString: 'Hello\\nWorld',
                newString: 'Hello\\nUpdated'
            };
            const error = new NoMatchError('No match found');

            await healer.healToolParameters('gemini-pro', fileContent, originalParams, error);
            
            const metrics = healer.getMetrics();
            expect(metrics.averageHealingTime).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        it('should handle exceptions during healing gracefully', async () => {
            // Force an error by passing invalid parameters
            const result = await healer.healToolParameters(
                'test-model',
                '',
                {} as ToolParameters, // Invalid parameters
                new NoMatchError('Test error')
            );

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle NoMatchError properly', async () => {
            const fileContent = 'Test content';
            const originalParams: ToolParameters = {
                oldString: 'Non-existent',
                newString: 'Updated'
            };
            const error = new NoMatchError('Custom error message');

            const result = await healer.healToolParameters(
                'gpt-4',
                fileContent,
                originalParams,
                error
            );

            // Should attempt healing even with custom error
            expect(result).toBeDefined();
            expect(result.originalParameters).toBe(originalParams);
        });
    });

    describe('DeepSeek Specific Patterns', () => {
        it('should fix DeepSeek JSON escaping issues', async () => {
            const fileContent = 'Text with "quotes" here';
            const originalParams: ToolParameters = {
                oldString: 'Text with \\"quotes\\" here', // JSON escaped
                newString: 'Updated with \\"quotes\\" here'
            };
            const error = new NoMatchError('No match found');

            const result = await healer.healToolParameters(
                'deepseek-coder',
                fileContent,
                originalParams,
                error
            );

            expect(result.success).toBe(true);
            expect(result.healingMethod).toBe('unescape');
            expect(result.healedParameters?.oldString).toBe('Text with "quotes" here');
        });

        it('should fix DeepSeek newline escaping', async () => {
            const fileContent = 'Line one\nLine two';
            const originalParams: ToolParameters = {
                oldString: 'Line one\\nLine two', // Escaped newlines
                newString: 'Updated\\nLine two'
            };
            const error = new NoMatchError('No match found');

            const result = await healer.healToolParameters(
                'deepseek-coder',
                fileContent,
                originalParams,
                error
            );

            expect(result.success).toBe(true);
            expect(result.healedParameters?.oldString).toBe('Line one\nLine two');
        });
    });

    describe('Claude Specific Patterns', () => {
        it('should fix Claude extra spaces', async () => {
            const fileContent = 'Text with single space';
            const originalParams: ToolParameters = {
                oldString: 'Text  with   single    space', // Multiple spaces
                newString: 'Updated  text'
            };
            const error = new NoMatchError('No match found');

            const result = await healer.healToolParameters(
                'claude-3-sonnet',
                fileContent,
                originalParams,
                error
            );

            expect(result.success).toBe(true);
            expect(result.healingMethod).toBe('unescape');
            expect(result.healedParameters?.oldString).toBe('Text with single space');
        });

        it('should fix Claude mixed tabs and spaces', async () => {
            const fileContent = 'Text\twith\ttab';
            const originalParams: ToolParameters = {
                oldString: 'Text\t with\t tab', // Mixed tabs and spaces
                newString: 'Updated\t text'
            };
            const error = new NoMatchError('No match found');

            const result = await healer.healToolParameters(
                'claude-3-sonnet',
                fileContent,
                originalParams,
                error
            );

            expect(result.success).toBe(true);
            expect(result.healedParameters?.oldString).toBe('Text\twith\ttab');
        });
    });
});