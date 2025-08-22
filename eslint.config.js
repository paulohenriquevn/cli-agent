import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: 2020,
                sourceType: 'module',
            },
            globals: {
                console: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                global: 'readonly',
                module: 'readonly',
                require: 'readonly',
                exports: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': typescriptEslint,
        },
        rules: {
            // Basic ESLint rules
            'prefer-const': 'error',
            'no-var': 'error',
            'eqeqeq': 'error',
            'curly': 'error',
            'no-console': 'off', // Allow console.log in CLI tools
            
            // TypeScript rules (relaxed for CLI tools)
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-non-null-assertion': 'warn',
            '@typescript-eslint/no-var-requires': 'warn',
        },
    },
    {
        files: ['src/tools/tests/**/*.ts'],
        languageOptions: {
            parser: typescriptParser,
            globals: {
                describe: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                jest: 'readonly',
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off', // Allow any in tests
        },
    },
    {
        ignores: [
            'node_modules/',
            'dist/',
            '*.js',
            '!eslint.config.js',
            'src/tools/implementations/advancedDiffTool.ts',
            'src/tools/implementations/advancedNotebookTool.ts',
            'src/tools/implementations/advancedPatchTool.ts',
            'src/tools/implementations/computerUseTool.ts',
            'src/tools/implementations/createExecutionPlanTool.ts',
            'src/tools/implementations/enhancedWebSearchTool.ts',
            'src/tools/implementations/fetchDocumentationTool.ts',
            'src/tools/implementations/hooksManagementTool.ts',
            'src/tools/implementations/intelligentTestAnalyzerTool.ts',
            'src/tools/implementations/mcpIntegrationTool.ts',
            'src/tools/implementations/notebookEditTool.ts',
            'src/tools/implementations/notebookReadTool.ts',
            'src/tools/implementations/searchCodeTool.ts',
            'src/tools/implementations/subAgentsTool.ts',
            'src/tools/implementations/symbolAnalysisTool.ts',
            'src/tools/implementations/textEditorTool.ts',
        ],
    },
];