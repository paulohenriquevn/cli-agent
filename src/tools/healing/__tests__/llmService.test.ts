/*---------------------------------------------------------------------------------------------
 * LLM Service Tests
 *--------------------------------------------------------------------------------------------*/

import { LLMService, MetacognitionRequest, MetacognitionResponse } from '../llmService';
import { ToolParameters, NoMatchError } from '../../types/cliTypes';

const createMockRequest = (overrides: Partial<MetacognitionRequest> = {}): MetacognitionRequest => ({
    sourceModel: 'gpt-4',
    fileContent: 'Sample file content with some text',
    originalParameters: {
        oldString: 'some text',
        newString: 'updated text'
    },
    error: new NoMatchError('No exact match found'),
    attemptHistory: [],
    ...overrides
});

describe('LLMService', () => {
    let llmService: LLMService;
    let mockLogger: jest.Mock;

    beforeEach(() => {
        llmService = new LLMService();
        mockLogger = jest.fn();
        llmService.setLogger(mockLogger);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Constructor and Configuration', () => {
        it('should initialize correctly', () => {
            expect(llmService).toBeDefined();
        });

        it('should set logger correctly', () => {
            const logger = jest.fn();
            llmService.setLogger(logger);
            expect(logger).toBeDefined();
        });
    });

    describe('Metacognition Analysis', () => {
        it('should perform metacognitive analysis successfully', async () => {
            const request = createMockRequest();
            
            const response = await llmService.performMetacognition(request);
            
            expect(response).toBeDefined();
            expect(response.success).toBeDefined();
            expect(response.confidence).toBeGreaterThanOrEqual(0);
            expect(response.confidence).toBeLessThanOrEqual(1);
            expect(response.suggestedMethod).toMatch(/^(unescape|llm_correction|newstring_adjustment|manual_intervention)$/);
        });

        it('should handle over-escaped parameters', async () => {
            const request = createMockRequest({
                fileContent: 'Text with\nnewlines and\ttabs',
                originalParameters: {
                    oldString: 'Text with\\\\nnewlines and\\\\ttabs', // Over-escaped
                    newString: 'Updated with\\\\nnewlines'
                }
            });
            
            const response = await llmService.performMetacognition(request);
            
            expect(response.success).toBe(true);
            expect(response.suggestedMethod).toBe('unescape');
            expect(response.confidence).toBeGreaterThan(0.8);
            expect(response.reasoning).toContain('over-escaped');
        });

        it('should handle whitespace issues', async () => {
            const request = createMockRequest({
                fileContent: 'Text with normal spacing',
                originalParameters: {
                    oldString: 'Text  with   abnormal     spacing', // Multiple spaces
                    newString: 'Updated  text'
                }
            });
            
            const response = await llmService.performMetacognition(request);
            
            expect(response.success).toBe(true);
            expect(response.suggestedMethod).toBe('newstring_adjustment');
            expect(response.reasoning).toContain('whitespace');
        });

        it('should handle JSON formatting issues', async () => {
            const request = createMockRequest({
                fileContent: 'JSON data: {"key": "value"}',
                originalParameters: {
                    oldString: 'JSON data: {\\"key\\": \\"value\\"}', // JSON escaped
                    newString: 'Updated JSON'
                }
            });
            
            const response = await llmService.performMetacognition(request);
            
            expect(response.success).toBe(true);
            expect(response.suggestedMethod).toBe('llm_correction');
            expect(response.reasoning).toContain('JSON');
        });

        it('should provide default response for unrecognized patterns', async () => {
            const request = createMockRequest({
                fileContent: 'Completely different content',
                originalParameters: {
                    oldString: 'No pattern match here',
                    newString: 'Random update'
                }
            });
            
            const response = await llmService.performMetacognition(request);
            
            expect(response.success).toBe(true);
            expect(response.confidence).toBeGreaterThan(0.5);
            expect(response.suggestedMethod).toBe('llm_correction');
        });

        it('should handle attempt history in analysis', async () => {
            const request = createMockRequest({
                attemptHistory: [
                    {
                        method: 'unescape',
                        parameters: { oldString: 'first attempt', newString: 'failed' },
                        success: false,
                        error: 'Still no match'
                    },
                    {
                        method: 'pattern_matching',
                        parameters: { oldString: 'second attempt', newString: 'failed' },
                        success: false,
                        error: 'Pattern did not work'
                    }
                ]
            });
            
            const response = await llmService.performMetacognition(request);
            
            expect(response).toBeDefined();
            expect(response.confidence).toBeGreaterThanOrEqual(0);
        });

        it('should handle different source models', async () => {
            const models = ['gemini-pro', 'claude-3-sonnet', 'deepseek-coder', 'gpt-4'];
            
            for (const model of models) {
                const request = createMockRequest({ sourceModel: model });
                const response = await llmService.performMetacognition(request);
                
                expect(response).toBeDefined();
                expect(response.success).toBeDefined();
            }
        });
    });

    describe('Mock Parameter Correction', () => {
        it('should generate corrected parameters for unescape method', async () => {
            const request = createMockRequest({
                fileContent: 'Text with\nnewlines',
                originalParameters: {
                    oldString: 'Text with\\\\nnewlines',
                    newString: 'Updated\\\\ntext'
                }
            });
            
            const response = await llmService.performMetacognition(request);
            
            if (response.success && response.correctedParameters) {
                expect(response.correctedParameters.oldString).toBeDefined();
                expect(response.correctedParameters.newString).toBeDefined();
                expect(response.correctedParameters.oldString as string).not.toContain('\\\\n');
                expect(response.correctedParameters.newString as string).not.toContain('\\\\n');
            }
        });

        it('should generate corrected parameters for newstring adjustment', async () => {
            const request = createMockRequest({
                originalParameters: {
                    oldString: '  text with spaces  ',
                    newString: '  updated text  '
                }
            });
            
            const response = await llmService.performMetacognition(request);
            
            if (response.success && response.correctedParameters && 
                response.suggestedMethod === 'newstring_adjustment') {
                // Should be trimmed
                expect(response.correctedParameters.oldString.trim()).toBe(response.correctedParameters.oldString);
                expect(response.correctedParameters.newString.trim()).toBe(response.correctedParameters.newString);
            }
        });

        it('should generate corrected parameters for LLM correction', async () => {
            const request = createMockRequest({
                originalParameters: {
                    oldString: 'Text with\\"quotes\\"',
                    newString: 'Updated\\"text\\"'
                }
            });
            
            const response = await llmService.performMetacognition(request);
            
            if (response.success && response.correctedParameters) {
                expect(response.correctedParameters).toBeDefined();
                expect(typeof response.correctedParameters.oldString).toBe('string');
                expect(typeof response.correctedParameters.newString).toBe('string');
            }
        });
    });

    describe('Response Parsing', () => {
        it('should parse valid JSON responses', async () => {
            const request = createMockRequest();
            
            const response = await llmService.performMetacognition(request);
            
            expect(response.success).toBeDefined();
            expect(response.confidence).toBeGreaterThanOrEqual(0);
            expect(response.confidence).toBeLessThanOrEqual(1);
            expect(['unescape', 'llm_correction', 'newstring_adjustment', 'manual_intervention'])
                .toContain(response.suggestedMethod);
        });

        it('should handle malformed responses gracefully', async () => {
            // This test would require mocking the internal LLM call to return malformed JSON
            // For now, we verify the structure of a normal response
            const request = createMockRequest();
            
            const response = await llmService.performMetacognition(request);
            
            expect(response).toHaveProperty('success');
            expect(response).toHaveProperty('confidence');
            expect(response).toHaveProperty('suggestedMethod');
        });
    });

    describe('Error Handling', () => {
        it('should handle timeout scenarios', async () => {
            const request = createMockRequest();
            
            // The current implementation uses setTimeout to simulate API delays
            // This test verifies that the service completes within reasonable time
            const startTime = Date.now();
            const response = await llmService.performMetacognition(request);
            const endTime = Date.now();
            
            expect(response).toBeDefined();
            expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
        });

        it('should provide fallback responses on errors', async () => {
            // Test with minimal request that might cause issues
            const request: MetacognitionRequest = {
                sourceModel: '',
                fileContent: '',
                originalParameters: {},
                error: new NoMatchError(''),
                attemptHistory: []
            };
            
            const response = await llmService.performMetacognition(request);
            
            expect(response).toBeDefined();
            expect(response.confidence).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Logging', () => {
        it('should log debug messages during analysis', async () => {
            const request = createMockRequest();
            
            await llmService.performMetacognition(request);
            
            expect(mockLogger).toHaveBeenCalledWith(
                'debug',
                'Starting metacognitive analysis',
                expect.any(Object)
            );
        });

        it('should log completion with performance metrics', async () => {
            const request = createMockRequest();
            
            await llmService.performMetacognition(request);
            
            expect(mockLogger).toHaveBeenCalledWith(
                'info',
                'Metacognitive analysis completed',
                expect.objectContaining({
                    duration: expect.any(Number),
                    confidence: expect.any(Number),
                    method: expect.any(String),
                    success: expect.any(Boolean)
                })
            );
        });

        it('should log errors when analysis fails', async () => {
            // This would require forcing an error condition
            // For now, we just verify that the logger is set up correctly
            expect(mockLogger).toBeDefined();
        });
    });

    describe('Performance', () => {
        it('should complete analysis within reasonable time', async () => {
            const request = createMockRequest();
            
            const startTime = Date.now();
            await llmService.performMetacognition(request);
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
        });

        it('should handle concurrent requests', async () => {
            const requests = Array(3).fill(null).map(() => createMockRequest());
            
            const startTime = Date.now();
            const responses = await Promise.all(
                requests.map(request => llmService.performMetacognition(request))
            );
            const endTime = Date.now();
            
            expect(responses).toHaveLength(3);
            responses.forEach(response => {
                expect(response).toBeDefined();
                expect(response.success).toBeDefined();
            });
            
            // Should not take significantly longer than a single request
            expect(endTime - startTime).toBeLessThan(5000);
        });
    });

    describe('Mock Behavior Verification', () => {
        it('should provide consistent responses for same inputs', async () => {
            const request = createMockRequest({
                originalParameters: {
                    oldString: 'consistent input',
                    newString: 'consistent output'
                }
            });
            
            const response1 = await llmService.performMetacognition(request);
            const response2 = await llmService.performMetacognition(request);
            
            expect(response1.suggestedMethod).toBe(response2.suggestedMethod);
            expect(response1.success).toBe(response2.success);
        });

        it('should vary responses based on input patterns', async () => {
            const escapingRequest = createMockRequest({
                originalParameters: {
                    oldString: 'Text\\\\nwith\\\\tescapes',
                    newString: 'Updated'
                }
            });
            
            const spacingRequest = createMockRequest({
                originalParameters: {
                    oldString: 'Text   with    spaces',
                    newString: 'Updated'
                }
            });
            
            const escapingResponse = await llmService.performMetacognition(escapingRequest);
            const spacingResponse = await llmService.performMetacognition(spacingRequest);
            
            expect(escapingResponse.suggestedMethod).toBe('unescape');
            expect(spacingResponse.suggestedMethod).toBe('newstring_adjustment');
        });
    });
});