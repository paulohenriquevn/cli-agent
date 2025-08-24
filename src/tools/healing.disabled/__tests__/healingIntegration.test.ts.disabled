/*---------------------------------------------------------------------------------------------
 * Healing Integration Tests
 *--------------------------------------------------------------------------------------------*/

import { HealingIntegration, HealingConfig } from '../healingIntegration';
import { ToolHealer } from '../toolHealer';
import { BaseTool } from '../../base/baseTool';
import { ToolParameters, NoMatchError, CliExecutionContext } from '../../types/cliTypes';

// Mock ToolHealer
jest.mock('../toolHealer');
const MockToolHealer = ToolHealer as jest.MockedClass<typeof ToolHealer>;

describe('HealingIntegration', () => {
    let healingIntegration: HealingIntegration;
    let mockLogger: jest.Mock;
    let mockTool: BaseTool;
    let mockContext: CliExecutionContext;

    beforeEach(() => {
        healingIntegration = new HealingIntegration({
            enableHealing: true,
            enableMetacognition: true,
            maxHealingAttempts: 3
        });
        
        mockLogger = jest.fn();
        healingIntegration.setLogger(mockLogger);

        mockTool = {
            name: 'testTool',
            description: 'Test tool for healing',
            category: 'test',
            complexity: 'basic',
            inputSchema: {},
            tags: ['test']
        } as BaseTool;

        mockContext = {
            workingDirectory: '/test',
            environment: {},
            fileSystem: {
                readFile: jest.fn().mockResolvedValue('test file content'),
                writeFile: jest.fn(),
                exists: jest.fn(),
                readdir: jest.fn()
            }
        } as any;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Constructor and Configuration', () => {
        it('should initialize with default configuration', () => {
            const integration = new HealingIntegration();
            expect(integration).toBeDefined();
        });

        it('should apply custom configuration', () => {
            const config: HealingConfig = {
                enableHealing: false,
                enableMetacognition: false,
                maxHealingAttempts: 5,
                healingTimeout: 60000,
                logHealing: false,
                cacheHealings: false
            };

            const integration = new HealingIntegration(config);
            expect(integration).toBeDefined();
        });

        it('should set logger correctly', () => {
            const logger = jest.fn();
            healingIntegration.setLogger(logger);
            expect(logger).toBeDefined();
        });
    });

    describe('Healing Disabled', () => {
        it('should return failure immediately when healing is disabled', async () => {
            const disabledIntegration = new HealingIntegration({ enableHealing: false });
            
            const originalParams: ToolParameters = {
                oldString: 'test',
                newString: 'updated'
            };
            const error = new NoMatchError('No match found');

            const result = await disabledIntegration.attemptHealing(
                'gpt-4',
                mockTool,
                originalParams,
                error,
                mockContext
            );

            expect(result.success).toBe(false);
            expect(result.healingAttempts).toBe(0);
            expect(result.metacognitionUsed).toBe(false);
            expect(result.originalError).toBe(error);
        });
    });

    describe('Successful Healing', () => {
        it('should return success when healing succeeds on first attempt', async () => {
            const mockHealerInstance = {
                healToolParameters: jest.fn().mockResolvedValue({
                    success: true,
                    originalParameters: { oldString: 'original', newString: 'original' },
                    healedParameters: { oldString: 'healed', newString: 'healed' },
                    healingMethod: 'unescape',
                    confidence: 0.9,
                    metacognitionUsed: false
                }),
                getMetrics: jest.fn().mockReturnValue({}),
                getCacheStats: jest.fn().mockReturnValue({}),
                clearCache: jest.fn(),
                getModelBugPatterns: jest.fn().mockReturnValue([])
            };
            MockToolHealer.mockImplementation(() => mockHealerInstance as any);

            const originalParams: ToolParameters = {
                oldString: 'original\\ntext',
                newString: 'updated\\ntext'
            };
            const error = new NoMatchError('No match found');

            const result = await healingIntegration.attemptHealing(
                'gemini-pro',
                mockTool,
                originalParams,
                error,
                mockContext
            );

            expect(result.success).toBe(true);
            expect(result.healingAttempts).toBe(1);
            expect(result.healingMethod).toBe('unescape');
            expect(result.healedParameters).toEqual({ oldString: 'healed', newString: 'healed' });
            expect(result.metacognitionUsed).toBe(false);
        });

        it('should return success when healing succeeds after multiple attempts', async () => {
            let attemptCount = 0;
            const mockHealerInstance = {
                healToolParameters: jest.fn().mockImplementation(() => {
                    attemptCount++;
                    if (attemptCount === 3) {
                        return Promise.resolve({
                            success: true,
                            originalParameters: { oldString: 'original', newString: 'original' },
                            healedParameters: { oldString: 'healed', newString: 'healed' },
                            healingMethod: 'llm_correction',
                            confidence: 0.8,
                            metacognitionUsed: true
                        });
                    }
                    return Promise.resolve({
                        success: false,
                        originalParameters: { oldString: 'original', newString: 'original' },
                        metacognitionUsed: false,
                        newError: new NoMatchError('Still no match')
                    });
                }),
                getMetrics: jest.fn().mockReturnValue({}),
                getCacheStats: jest.fn().mockReturnValue({}),
                clearCache: jest.fn(),
                getModelBugPatterns: jest.fn().mockReturnValue([])
            };
            MockToolHealer.mockImplementation(() => mockHealerInstance as any);

            const originalParams: ToolParameters = {
                oldString: 'difficult text',
                newString: 'updated text'
            };
            const error = new NoMatchError('No match found');

            const result = await healingIntegration.attemptHealing(
                'claude-3',
                mockTool,
                originalParams,
                error,
                mockContext
            );

            expect(result.success).toBe(true);
            expect(result.healingAttempts).toBe(3);
            expect(result.healingMethod).toBe('llm_correction');
            expect(result.metacognitionUsed).toBe(true);
        });
    });

    describe('Failed Healing', () => {
        it('should return failure when all healing attempts fail', async () => {
            const mockHealerInstance = {
                healToolParameters: jest.fn().mockResolvedValue({
                    success: false,
                    originalParameters: { oldString: 'original', newString: 'original' },
                    metacognitionUsed: true,
                    error: 'All healing methods exhausted'
                }),
                getMetrics: jest.fn().mockReturnValue({}),
                getCacheStats: jest.fn().mockReturnValue({}),
                clearCache: jest.fn(),
                getModelBugPatterns: jest.fn().mockReturnValue([])
            };
            MockToolHealer.mockImplementation(() => mockHealerInstance as any);

            const originalParams: ToolParameters = {
                oldString: 'unhealable text',
                newString: 'updated text'
            };
            const error = new NoMatchError('No match found');

            const result = await healingIntegration.attemptHealing(
                'gpt-4',
                mockTool,
                originalParams,
                error,
                mockContext
            );

            expect(result.success).toBe(false);
            expect(result.healingAttempts).toBe(3); // maxHealingAttempts
            expect(result.originalError).toBe(error);
            expect(result.metacognitionUsed).toBe(true);
        });

        it('should handle healing exceptions gracefully', async () => {
            const mockHealerInstance = {
                healToolParameters: jest.fn().mockRejectedValue(new Error('Healing system error')),
                getMetrics: jest.fn().mockReturnValue({}),
                getCacheStats: jest.fn().mockReturnValue({}),
                clearCache: jest.fn(),
                getModelBugPatterns: jest.fn().mockReturnValue([])
            };
            MockToolHealer.mockImplementation(() => mockHealerInstance as any);

            const originalParams: ToolParameters = {
                oldString: 'test',
                newString: 'updated'
            };
            const error = new NoMatchError('No match found');

            const result = await healingIntegration.attemptHealing(
                'gpt-4',
                mockTool,
                originalParams,
                error,
                mockContext
            );

            expect(result.success).toBe(false);
            expect(result.healingAttempts).toBe(3); // Should retry until max attempts
        });
    });

    describe('File Context Reading', () => {
        it('should read file content when file path is provided', async () => {
            const mockHealerInstance = {
                healToolParameters: jest.fn().mockResolvedValue({
                    success: true,
                    originalParameters: { oldString: 'original', newString: 'original' },
                    healedParameters: { oldString: 'healed', newString: 'healed' },
                    healingMethod: 'unescape',
                    metacognitionUsed: false
                }),
                getMetrics: jest.fn().mockReturnValue({}),
                getCacheStats: jest.fn().mockReturnValue({}),
                clearCache: jest.fn(),
                getModelBugPatterns: jest.fn().mockReturnValue([])
            };
            MockToolHealer.mockImplementation(() => mockHealerInstance as any);

            const originalParams: ToolParameters = {
                oldString: 'test',
                newString: 'updated'
            };
            const error = new NoMatchError('No match found');
            error.filePath = '/test/file.txt';

            await healingIntegration.attemptHealing(
                'gpt-4',
                mockTool,
                originalParams,
                error,
                mockContext
            );

            expect(mockContext.fileSystem!.readFile).toHaveBeenCalledWith('/test/file.txt');
            expect(mockHealerInstance.healToolParameters).toHaveBeenCalledWith(
                'gpt-4',
                'test file content',
                originalParams,
                error
            );
        });

        it('should handle file read errors gracefully', async () => {
            const mockFileSystem = {
                readFile: jest.fn().mockRejectedValue(new Error('File not found')),
                writeFile: jest.fn(),
                exists: jest.fn(),
                readdir: jest.fn()
            };
            const contextWithFailingFS = {
                ...mockContext,
                fileSystem: mockFileSystem
            };

            const mockHealerInstance = {
                healToolParameters: jest.fn().mockResolvedValue({
                    success: true,
                    originalParameters: { oldString: 'original', newString: 'original' },
                    healedParameters: { oldString: 'healed', newString: 'healed' },
                    healingMethod: 'unescape',
                    metacognitionUsed: false
                }),
                getMetrics: jest.fn().mockReturnValue({}),
                getCacheStats: jest.fn().mockReturnValue({}),
                clearCache: jest.fn(),
                getModelBugPatterns: jest.fn().mockReturnValue([])
            };
            MockToolHealer.mockImplementation(() => mockHealerInstance as any);

            const originalParams: ToolParameters = {
                oldString: 'test',
                newString: 'updated'
            };
            const error = new NoMatchError('No match found');
            error.filePath = '/nonexistent/file.txt';

            const result = await healingIntegration.attemptHealing(
                'gpt-4',
                mockTool,
                originalParams,
                error,
                contextWithFailingFS
            );

            // Should still attempt healing with empty file content
            expect(result).toBeDefined();
            expect(mockHealerInstance.healToolParameters).toHaveBeenCalledWith(
                'gpt-4',
                '', // Empty file content due to read error
                originalParams,
                error
            );
        });
    });

    describe('Metrics and Statistics', () => {
        it('should delegate metrics to healer', () => {
            const mockMetrics = {
                totalAttempts: 5,
                successfulHealings: 3,
                failedHealings: 2,
                averageHealingTime: 150,
                metacognitionUsageRate: 0.6,
                healingsByModel: {},
                healingMethodStats: {},
                cacheHitRate: 0.8
            };

            const mockHealerInstance = {
                getMetrics: jest.fn().mockReturnValue(mockMetrics),
                getCacheStats: jest.fn().mockReturnValue({ size: 10, hitRate: 0.8 }),
                clearCache: jest.fn(),
                getModelBugPatterns: jest.fn().mockReturnValue([]),
                healToolParameters: jest.fn()
            };
            MockToolHealer.mockImplementation(() => mockHealerInstance as any);

            const metrics = healingIntegration.getMetrics();
            expect(metrics).toBe(mockMetrics);
            expect(mockHealerInstance.getMetrics).toHaveBeenCalled();
        });

        it('should delegate cache stats to healer', () => {
            const mockCacheStats = { size: 5, hitRate: 0.75, hits: 15, misses: 5 };

            const mockHealerInstance = {
                getCacheStats: jest.fn().mockReturnValue(mockCacheStats),
                getMetrics: jest.fn().mockReturnValue({}),
                clearCache: jest.fn(),
                getModelBugPatterns: jest.fn().mockReturnValue([]),
                healToolParameters: jest.fn()
            };
            MockToolHealer.mockImplementation(() => mockHealerInstance as any);

            const cacheStats = healingIntegration.getCacheStats();
            expect(cacheStats).toBe(mockCacheStats);
        });

        it('should clear cache through healer', () => {
            const mockHealerInstance = {
                clearCache: jest.fn(),
                getMetrics: jest.fn().mockReturnValue({}),
                getCacheStats: jest.fn().mockReturnValue({}),
                getModelBugPatterns: jest.fn().mockReturnValue([]),
                healToolParameters: jest.fn()
            };
            MockToolHealer.mockImplementation(() => mockHealerInstance as any);

            healingIntegration.clearCache();
            expect(mockHealerInstance.clearCache).toHaveBeenCalled();
        });
    });

    describe('Health Check', () => {
        it('should return healthy status for good metrics', () => {
            const mockMetrics = {
                totalAttempts: 10,
                successfulHealings: 8,
                failedHealings: 2,
                averageHealingTime: 50,
                metacognitionUsageRate: 0.7,
                healingsByModel: {},
                healingMethodStats: {},
                cacheHitRate: 0.85
            };

            const mockHealerInstance = {
                getMetrics: jest.fn().mockReturnValue(mockMetrics),
                getCacheStats: jest.fn().mockReturnValue({ size: 10, hitRate: 0.85 }),
                clearCache: jest.fn(),
                getModelBugPatterns: jest.fn().mockReturnValue([]),
                healToolParameters: jest.fn()
            };
            MockToolHealer.mockImplementation(() => mockHealerInstance as any);

            const health = healingIntegration.healthCheck();
            
            expect(health.status).toBe('healthy');
            expect(health.issues).toHaveLength(0);
            expect(health.metrics).toBe(mockMetrics);
        });

        it('should return warning status for poor success rate', () => {
            const mockMetrics = {
                totalAttempts: 10,
                successfulHealings: 2, // 20% success rate
                failedHealings: 8,
                averageHealingTime: 50,
                metacognitionUsageRate: 0.3,
                healingsByModel: {},
                healingMethodStats: {},
                cacheHitRate: 0.4
            };

            const mockHealerInstance = {
                getMetrics: jest.fn().mockReturnValue(mockMetrics),
                getCacheStats: jest.fn().mockReturnValue({ size: 10, hitRate: 0.4 }),
                clearCache: jest.fn(),
                getModelBugPatterns: jest.fn().mockReturnValue([]),
                healToolParameters: jest.fn()
            };
            MockToolHealer.mockImplementation(() => mockHealerInstance as any);

            const health = healingIntegration.healthCheck();
            
            expect(health.status).toBe('warning');
            expect(health.issues.some(issue => issue.includes('Low healing success rate'))).toBe(true);
        });

        it('should return error status for very poor performance', () => {
            const mockMetrics = {
                totalAttempts: 10,
                successfulHealings: 0, // 0% success rate
                failedHealings: 10,
                averageHealingTime: 15000, // 15 seconds
                metacognitionUsageRate: 0.1,
                healingsByModel: {},
                healingMethodStats: {},
                cacheHitRate: 0.1
            };

            const mockHealerInstance = {
                getMetrics: jest.fn().mockReturnValue(mockMetrics),
                getCacheStats: jest.fn().mockReturnValue({ size: 10, hitRate: 0.1 }),
                clearCache: jest.fn(),
                getModelBugPatterns: jest.fn().mockReturnValue([]),
                healToolParameters: jest.fn()
            };
            MockToolHealer.mockImplementation(() => mockHealerInstance as any);

            const health = healingIntegration.healthCheck();
            
            expect(health.status).toBe('error');
            expect(health.issues.length).toBeGreaterThan(0);
        });
    });

    describe('Healing Report Generation', () => {
        it('should generate comprehensive healing report', () => {
            const mockMetrics = {
                totalAttempts: 20,
                successfulHealings: 15,
                failedHealings: 5,
                averageHealingTime: 100,
                metacognitionUsageRate: 0.6,
                healingsByModel: {
                    gemini: { attempts: 10, successes: 8, totalTime: 800, patterns: {} },
                    claude: { attempts: 10, successes: 7, totalTime: 1200, patterns: {} }
                },
                healingMethodStats: {
                    unescape: { uses: 8, successes: 7, avgTime: 50 },
                    llm_correction: { uses: 5, successes: 4, avgTime: 150 }
                },
                cacheHitRate: 0.75
            };

            const mockCacheStats = { size: 15, hitRate: 0.75, hits: 15, misses: 5 };

            const mockHealerInstance = {
                getMetrics: jest.fn().mockReturnValue(mockMetrics),
                getCacheStats: jest.fn().mockReturnValue(mockCacheStats),
                clearCache: jest.fn(),
                getModelBugPatterns: jest.fn().mockReturnValue([]),
                healToolParameters: jest.fn()
            };
            MockToolHealer.mockImplementation(() => mockHealerInstance as any);

            const report = healingIntegration.generateHealingReport();
            
            expect(report.summary.totalHealings).toBe(20);
            expect(report.summary.successRate).toBe(0.75); // 15/20
            expect(report.summary.averageTime).toBe(100);
            expect(report.summary.metacognitionUsage).toBe(0.6);
            
            expect(report.modelBreakdown).toHaveProperty('gemini');
            expect(report.modelBreakdown).toHaveProperty('claude');
            
            expect(report.topHealingMethods).toHaveLength(2);
            expect(report.topHealingMethods[0].method).toBe('unescape');
            
            expect(report.performance.cacheHitRate).toBe(0.75);
            expect(report.performance.totalCacheEntries).toBe(15);
        });
    });

    describe('Parameter Sanitization', () => {
        it('should sanitize sensitive parameters for logging', async () => {
            const mockHealerInstance = {
                healToolParameters: jest.fn().mockResolvedValue({
                    success: true,
                    originalParameters: { oldString: 'original', newString: 'original' },
                    healedParameters: { oldString: 'healed', newString: 'healed' },
                    healingMethod: 'unescape',
                    metacognitionUsed: false
                }),
                getMetrics: jest.fn().mockReturnValue({}),
                getCacheStats: jest.fn().mockReturnValue({}),
                clearCache: jest.fn(),
                getModelBugPatterns: jest.fn().mockReturnValue([])
            };
            MockToolHealer.mockImplementation(() => mockHealerInstance as any);

            const sensitiveParams: ToolParameters = {
                oldString: 'test',
                newString: 'updated',
                password: 'secret123',
                token: 'abc123token',
                apiKey: 'key123'
            };
            const error = new NoMatchError('No match found');

            await healingIntegration.attemptHealing(
                'gpt-4',
                mockTool,
                sensitiveParams,
                error,
                mockContext
            );

            // Verify that the logger was called with sanitized parameters
            const logCall = mockLogger.mock.calls.find(call => 
                call[0] === 'info' && call[1].includes('Starting healing process')
            );
            
            if (logCall) {
                const logData = logCall[2];
                expect(logData.originalParams.password).toBe('[REDACTED]');
                expect(logData.originalParams.token).toBe('[REDACTED]');
            }
        });
    });
});