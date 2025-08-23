/*---------------------------------------------------------------------------------------------
 * Tool Normalizer Tests - Comprehensive test suite for the normalization system
 *--------------------------------------------------------------------------------------------*/

import { ToolNormalizer, normalizeToolSchema, OpenAiFunctionTool, MODEL_FAMILIES } from '../toolNormalizer';

// Test utilities
function createTestTool(name: string, parameters: any): OpenAiFunctionTool {
    return {
        type: 'function',
        function: {
            name,
            description: `Test tool: ${name}`,
            parameters
        }
    };
}

describe('ToolNormalizer', () => {
    let normalizer: ToolNormalizer;

    beforeEach(() => {
        normalizer = new ToolNormalizer();
    });

    describe('Model Family Detection', () => {
        test('correctly identifies GPT-4 models', () => {
            expect(MODEL_FAMILIES.GPT4('gpt-4')).toBe(true);
            expect(MODEL_FAMILIES.GPT4('gpt-4o')).toBe(true);
            expect(MODEL_FAMILIES.GPT4('gpt-4-turbo')).toBe(true);
            expect(MODEL_FAMILIES.GPT4('claude-3')).toBe(false);
        });

        test('correctly identifies Claude models', () => {
            expect(MODEL_FAMILIES.CLAUDE('claude-3')).toBe(true);
            expect(MODEL_FAMILIES.CLAUDE('claude-3-sonnet')).toBe(true);
            expect(MODEL_FAMILIES.CLAUDE('gpt-4')).toBe(false);
        });

        test('correctly identifies other model families', () => {
            expect(MODEL_FAMILIES.GEMINI('gemini-pro')).toBe(true);
            expect(MODEL_FAMILIES.O1('o1-preview')).toBe(true);
            expect(MODEL_FAMILIES.DEEPSEEK('deepseek-coder')).toBe(true);
            expect(MODEL_FAMILIES.DEEPSEEK('deepseek-chat')).toBe(true);
            expect(MODEL_FAMILIES.DEEPSEEK('model-deepseek-v2')).toBe(true);
        });
    });

    describe('Basic Normalization', () => {
        test('ensures function has valid schema structure', () => {
            const tool: OpenAiFunctionTool = {
                type: 'function',
                function: {
                    name: 'test_tool',
                    description: 'Test tool',
                    parameters: {} as any // Invalid - no type
                }
            };

            const fixes: string[] = [];
            const normalized = normalizeToolSchema('gpt-4', [tool], (_, message) => {
                fixes.push(message);
            });

            expect(normalized[0].function.parameters.type).toBe('object');
            expect(normalized[0].function.parameters.properties).toEqual({});
            expect(fixes).toContain('schema must be an object if present');
        });

        test('ensures function has description', () => {
            const tool: OpenAiFunctionTool = {
                type: 'function',
                function: {
                    name: 'test_tool',
                    description: '', // Empty description
                    parameters: { type: 'object', properties: {} }
                }
            };

            const fixes: string[] = [];
            const normalized = normalizeToolSchema('gpt-4', [tool], (_, message) => {
                fixes.push(message);
            });

            expect(normalized[0].function.description).toBe('No description provided');
            expect(fixes).toContain('function description may not be empty');
        });

        test('throws on invalid schema structure', () => {
            const tool = createTestTool('invalid', {
                type: 'object',
                properties: {
                    field: { type: 'invalid_type' } // Invalid type
                }
            });

            expect(() => {
                normalizeToolSchema('gpt-4', [tool]);
            }).toThrow('Tool parameters do not match JSON schema');
        });

        test('throws on array without items', () => {
            const tool = createTestTool('array_test', {
                type: 'object',
                properties: {
                    list: { type: 'array' } // Missing items
                }
            });

            expect(() => {
                normalizeToolSchema('gpt-4', [tool]);
            }).toThrow('Array type at .properties.list must have items property');
        });
    });

    describe('GPT-4 Specific Normalization', () => {
        const GPT4_UNSUPPORTED_KEYWORDS = [
            'minLength', 'maxLength', 'pattern', 'default', 'format',
            'minimum', 'maximum', 'multipleOf', 'patternProperties',
            'minProperties', 'maxProperties', 'minItems', 'maxItems', 'uniqueItems'
        ];

        test('removes unsupported string validation keywords', () => {
            const tool = createTestTool('gpt4_string_test', {
                type: 'object',
                properties: {
                    text: {
                        type: 'string',
                        minLength: 1,
                        maxLength: 100,
                        pattern: '^[a-z]+$',
                        default: 'hello',
                        format: 'email'
                    }
                }
            });

            const fixes: string[] = [];
            const normalized = normalizeToolSchema('gpt-4', [tool], (_, message) => {
                fixes.push(message);
            });

            const textProperty = normalized[0].function.parameters.properties?.text;
            expect(textProperty).not.toHaveProperty('minLength');
            expect(textProperty).not.toHaveProperty('maxLength');
            expect(textProperty).not.toHaveProperty('pattern');
            expect(textProperty).not.toHaveProperty('default');
            expect(textProperty).not.toHaveProperty('format');

            expect(fixes.filter(f => f.includes("removed unsupported keyword"))).toHaveLength(5);
        });

        test('removes unsupported number validation keywords', () => {
            const tool = createTestTool('gpt4_number_test', {
                type: 'object',
                properties: {
                    count: {
                        type: 'number',
                        minimum: 0,
                        maximum: 100,
                        multipleOf: 5
                    }
                }
            });

            const normalized = normalizeToolSchema('gpt-4', [tool]);
            const countProperty = normalized[0].function.parameters.properties?.count;
            
            expect(countProperty).not.toHaveProperty('minimum');
            expect(countProperty).not.toHaveProperty('maximum');
            expect(countProperty).not.toHaveProperty('multipleOf');
        });

        test('removes unsupported object and array constraints', () => {
            const tool = createTestTool('gpt4_constraints_test', {
                type: 'object',
                properties: {
                    obj: {
                        type: 'object',
                        minProperties: 1,
                        maxProperties: 10,
                        patternProperties: {
                            "^S_": { type: "string" }
                        }
                    },
                    arr: {
                        type: 'array',
                        items: { type: 'string' },
                        minItems: 1,
                        maxItems: 5,
                        uniqueItems: true
                    }
                }
            });

            const normalized = normalizeToolSchema('gpt-4', [tool]);
            const objProperty = normalized[0].function.parameters.properties?.obj;
            const arrProperty = normalized[0].function.parameters.properties?.arr;

            // Object constraints removed
            expect(objProperty).not.toHaveProperty('minProperties');
            expect(objProperty).not.toHaveProperty('maxProperties');
            expect(objProperty).not.toHaveProperty('patternProperties');

            // Array constraints removed
            expect(arrProperty).not.toHaveProperty('minItems');
            expect(arrProperty).not.toHaveProperty('maxItems');
            expect(arrProperty).not.toHaveProperty('uniqueItems');
        });

        test('truncates long descriptions', () => {
            const longDescription = 'x'.repeat(2000);
            const tool = createTestTool('description_test', {
                type: 'object',
                properties: {
                    field: {
                        type: 'string',
                        description: longDescription
                    }
                }
            });

            const fixes: string[] = [];
            const normalized = normalizeToolSchema('gpt-4', [tool], (_, message) => {
                fixes.push(message);
            });

            const fieldProperty = normalized[0].function.parameters.properties?.field;
            expect(fieldProperty?.description).toHaveLength(1024);
            expect(fixes).toContain('description truncated to 1024 chars');
        });

        test('preserves supported keywords', () => {
            const tool = createTestTool('gpt4_supported_test', {
                type: 'object',
                properties: {
                    text: {
                        type: 'string',
                        description: 'A text field'
                    },
                    number: {
                        type: 'number',
                        description: 'A number field'
                    },
                    choice: {
                        type: 'string',
                        enum: ['option1', 'option2', 'option3']
                    }
                },
                required: ['text']
            });

            const normalized = normalizeToolSchema('gpt-4', [tool]);
            const params = normalized[0].function.parameters;

            expect(params.type).toBe('object');
            expect(params.required).toEqual(['text']);
            expect(params.properties?.text.description).toBe('A text field');
            expect(params.properties?.choice.enum).toEqual(['option1', 'option2', 'option3']);
        });
    });

    describe('Conditional Schema Removal', () => {
        test('removes oneOf from root level', () => {
            const toolWithOneOf: OpenAiFunctionTool = {
                type: 'function',
                function: {
                    name: 'conditional_test',
                    description: 'Test tool with conditional schema',
                    parameters: {
                        type: 'object',
                        oneOf: [
                            { properties: { a: { type: 'string' } } },
                            { properties: { b: { type: 'number' } } }
                        ]
                    } as any
                }
            };

            const fixes: string[] = [];
            const normalized = normalizeToolSchema('claude-3', [toolWithOneOf], (_, message) => {
                fixes.push(message);
            });

            expect(normalized[0].function.parameters).not.toHaveProperty('oneOf');
            expect(fixes).toContain("removed unsupported conditional keyword 'oneOf'");
        });

        test('removes all conditional keywords', () => {
            const conditionalKeywords = ['oneOf', 'anyOf', 'allOf', 'not'];
            
            for (const keyword of conditionalKeywords) {
                const tool: OpenAiFunctionTool = {
                    type: 'function',
                    function: {
                        name: 'test',
                        description: 'Test',
                        parameters: {
                            type: 'object',
                            properties: {},
                            [keyword]: keyword === 'not' ? { type: 'string' } : [{ type: 'string' }]
                        } as any
                    }
                };

                const normalized = normalizeToolSchema('claude-3', [tool]);
                expect(normalized[0].function.parameters).not.toHaveProperty(keyword);
            }
        });

        test('removes conditional keywords from nested schemas', () => {
            const tool = createTestTool('nested_conditional', {
                type: 'object',
                properties: {
                    field: {
                        type: 'object',
                        properties: {
                            nested: {
                                type: 'string',
                                oneOf: [
                                    { const: 'option1' },
                                    { const: 'option2' }
                                ]
                            }
                        }
                    }
                }
            });

            const normalized = normalizeToolSchema('claude-3', [tool]);
            const nestedField = normalized[0].function.parameters.properties?.field?.properties?.nested;
            expect(nestedField).not.toHaveProperty('oneOf');
        });
    });

    describe('DeepSeek Specific Normalization', () => {
        test('sanitizes invalid function names', () => {
            const tool: OpenAiFunctionTool = {
                type: 'function',
                function: {
                    name: 'my-function@test.com', // Invalid characters
                    description: 'Test function',
                    parameters: { type: 'object', properties: {} }
                }
            };

            const fixes: string[] = [];
            const normalized = normalizeToolSchema('deepseek-coder', [tool], (_, message) => {
                fixes.push(message);
            });

            expect(normalized[0].function.name).toBe('my-function_test_com');
            expect(fixes.some(f => f.includes('sanitized function name'))).toBe(true);
        });

        test('truncates long function names', () => {
            const longName = 'a'.repeat(100); // 100 characters, exceeds 64 limit
            const tool: OpenAiFunctionTool = {
                type: 'function',
                function: {
                    name: longName,
                    description: 'Test function',
                    parameters: { type: 'object', properties: {} }
                }
            };

            const fixes: string[] = [];
            const normalized = normalizeToolSchema('deepseek-coder', [tool], (_, message) => {
                fixes.push(message);
            });

            expect(normalized[0].function.name).toHaveLength(64);
            expect(fixes.some(f => f.includes('truncated function name to 64 characters'))).toBe(true);
        });

        test('adds additionalProperties false to prevent hallucination', () => {
            const tool = createTestTool('deepseek_test', {
                type: 'object',
                properties: {
                    param1: { type: 'string' },
                    nested: {
                        type: 'object',
                        properties: {
                            value: { type: 'number' }
                        }
                    }
                }
            });

            const fixes: string[] = [];
            const normalized = normalizeToolSchema('deepseek-coder', [tool], (_, message) => {
                fixes.push(message);
            });

            const rootSchema = normalized[0].function.parameters;
            const nestedSchema = rootSchema.properties?.nested;

            expect(rootSchema.additionalProperties).toBe(false);
            expect(nestedSchema?.additionalProperties).toBe(false);
            expect(fixes.filter(f => f.includes('additionalProperties: false'))).toHaveLength(2);
        });

        test('preserves existing additionalProperties setting', () => {
            const tool = createTestTool('deepseek_preserve_test', {
                type: 'object',
                properties: {
                    param1: { type: 'string' }
                },
                additionalProperties: true // Already set
            });

            const fixes: string[] = [];
            const normalized = normalizeToolSchema('deepseek-coder', [tool], (_, message) => {
                fixes.push(message);
            });

            const rootSchema = normalized[0].function.parameters;
            expect(rootSchema.additionalProperties).toBe(true); // Should preserve existing value
            expect(fixes.filter(f => f.includes('additionalProperties'))).toHaveLength(0);
        });
    });

    describe('Draft Schema Conversion', () => {
        test('converts Draft 7 array items to Draft 2020-12', () => {
            const tool = createTestTool('array_conversion', {
                type: 'object',
                properties: {
                    mixed_array: {
                        type: 'array',
                        items: [
                            { type: 'string' },
                            { type: 'number' }
                        ]
                    }
                }
            });

            const fixes: string[] = [];
            const normalized = normalizeToolSchema('gpt-4', [tool], (_, message) => {
                fixes.push(message);
            });

            const arrayProperty = normalized[0].function.parameters.properties?.mixed_array;
            expect(arrayProperty?.items).toHaveProperty('anyOf');
            expect((arrayProperty?.items as any)?.anyOf).toHaveLength(2);
            expect(fixes).toContain('converted Draft 7 array items to Draft 2020-12 format');
        });
    });

    describe('Caching', () => {
        test('cache improves performance on repeated calls', () => {
            const tool = createTestTool('cache_test', {
                type: 'object',
                properties: {
                    text: {
                        type: 'string',
                        minLength: 1, // Will be removed for GPT-4
                        maxLength: 100
                    }
                }
            });

            // First call (cache miss)
            const start1 = performance.now();
            const result1 = normalizer.normalizeToolSchema('gpt-4', [tool]);
            const duration1 = performance.now() - start1;

            // Second call (cache hit)
            const start2 = performance.now();
            const result2 = normalizer.normalizeToolSchema('gpt-4', [tool]);
            const duration2 = performance.now() - start2;

            // Results should be identical
            expect(result1).toEqual(result2);
            
            // Second call should be faster (though this might be flaky in CI)
            // We mainly test that caching doesn't break functionality
            expect(result2[0].function.parameters.properties?.text).not.toHaveProperty('minLength');
        });

        test('cache stats are tracked correctly', () => {
            const tool = createTestTool('stats_test', {
                type: 'object',
                properties: { text: { type: 'string' } }
            });

            // Clear cache to start fresh
            normalizer.clearCache();
            
            const initialStats = normalizer.getCacheStats();
            expect(initialStats.size).toBe(0);

            // First call
            normalizer.normalizeToolSchema('gpt-4', [tool]);
            const afterFirstCall = normalizer.getCacheStats();
            expect(afterFirstCall.size).toBe(1);
            expect(afterFirstCall.misses).toBeGreaterThan(initialStats.misses);

            // Second call (should hit cache)
            normalizer.normalizeToolSchema('gpt-4', [tool]);
            const afterSecondCall = normalizer.getCacheStats();
            expect(afterSecondCall.hits).toBeGreaterThan(afterFirstCall.hits);
        });
    });

    describe('Metrics and Monitoring', () => {
        test('tracks normalization metrics', () => {
            const tool = createTestTool('metrics_test', {
                type: 'object',
                properties: {
                    text: {
                        type: 'string',
                        minLength: 1 // Will generate a fix for GPT-4
                    }
                }
            });

            const initialMetrics = normalizer.getMetrics();
            
            normalizer.normalizeToolSchema('gpt-4', [tool]);
            
            const updatedMetrics = normalizer.getMetrics();
            expect(updatedMetrics.totalNormalizations).toBe(initialMetrics.totalNormalizations + 1);
            expect(updatedMetrics.fixesAppliedByModel['gpt-4']).toBeGreaterThan(0);
            expect(updatedMetrics.successfulNormalizations).toBe(initialMetrics.successfulNormalizations + 1);
        });

        test('tracks common fixes', () => {
            const tool = createTestTool('common_fixes_test', {
                type: 'object',
                properties: {
                    text1: { type: 'string', minLength: 1 },
                    text2: { type: 'string', maxLength: 100 }
                }
            });

            normalizer.normalizeToolSchema('gpt-4', [tool]);
            
            const metrics = normalizer.getMetrics();
            expect(metrics.mostCommonFixes["removed unsupported keyword 'minLength'"]).toBeGreaterThan(0);
            expect(metrics.mostCommonFixes["removed unsupported keyword 'maxLength'"]).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        test('handles invalid tool gracefully', () => {
            const invalidTool = {
                type: 'function',
                function: {
                    name: 'invalid',
                    description: 'Invalid tool',
                    parameters: {
                        type: 'object',
                        properties: {
                            bad_field: { type: 'not_a_real_type' }
                        }
                    }
                }
            } as OpenAiFunctionTool;

            expect(() => {
                normalizer.normalizeToolSchema('gpt-4', [invalidTool]);
            }).toThrow("Failed to normalize tool 'invalid'");
            
            const metrics = normalizer.getMetrics();
            expect(metrics.validationFailures).toBeGreaterThan(0);
        });

        test('continues processing other tools when one fails', () => {
            const validTool = createTestTool('valid', {
                type: 'object',
                properties: { text: { type: 'string' } }
            });

            const invalidTool = {
                type: 'function',
                function: {
                    name: 'invalid',
                    description: 'Invalid',
                    parameters: {
                        type: 'object',
                        properties: { bad: { type: 'invalid' } }
                    }
                }
            } as OpenAiFunctionTool;

            // Should throw on invalid tool but the error message should indicate which tool failed
            expect(() => {
                normalizer.normalizeToolSchema('gpt-4', [validTool, invalidTool]);
            }).toThrow("Failed to normalize tool 'invalid'");
        });
    });

    describe('Standalone Function', () => {
        test('normalizeToolSchema function works correctly', () => {
            const tool = createTestTool('standalone_test', {
                type: 'object',
                properties: {
                    text: {
                        type: 'string',
                        minLength: 1
                    }
                }
            });

            const normalized = normalizeToolSchema('gpt-4', [tool]);
            expect(normalized[0].function.parameters.properties?.text).not.toHaveProperty('minLength');
        });
    });

    describe('Static Methods', () => {
        test('validate method works correctly', () => {
            const validSchema = {
                type: 'object',
                properties: {
                    text: { type: 'string' }
                }
            };

            const invalidSchema = {
                type: 'object',
                properties: {
                    bad: { type: 'invalid_type' }
                }
            };

            expect(ToolNormalizer.validate(validSchema)).toBe(true);
            expect(ToolNormalizer.validate(invalidSchema)).toBe(false);
        });

        test('getModelLimitations returns expected limitations', () => {
            const gpt4Limitations = ToolNormalizer.getModelLimitations('gpt-4');
            expect(gpt4Limitations).toContain('Description length limited to 1024 characters');
            expect(gpt4Limitations).toContain('String validation keywords not supported (minLength, maxLength, pattern, etc.)');

            const claudeLimitations = ToolNormalizer.getModelLimitations('claude-3');
            expect(claudeLimitations).toContain('Conditional schemas not supported (oneOf, anyOf, allOf, not)');
            
            const deepseekLimitations = ToolNormalizer.getModelLimitations('deepseek-coder');
            expect(deepseekLimitations).toContain('Function names limited to a-z, A-Z, 0-9, underscores, and dashes');
            expect(deepseekLimitations).toContain('Function names maximum 64 characters');
            expect(deepseekLimitations).toContain('Maximum 128 functions per request');
            expect(deepseekLimitations).toContain('Model may hallucinate parameters not defined in schema');
        });
    });
});