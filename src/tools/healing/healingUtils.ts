/*---------------------------------------------------------------------------------------------
 * Tool Healing Utilities - Core healing functions and LLM interactions
 *--------------------------------------------------------------------------------------------*/

import {
    HealingEndpoint,
    ObjectJsonSchema,
    OLD_STRING_CORRECTION_SCHEMA,
    NEW_STRING_CORRECTION_SCHEMA,
    PATCH_HEALING_SCHEMA,
    ChatRole,
    ChatCompletionContentPartKind,
    ChatFetchResponseType,
    ChatLocation
} from './healingTypes';

/**
 * Corrige oldString usando LLM quando não há match exato
 */
export async function correctOldStringMismatch(
    healEndpoint: HealingEndpoint,
    fileContent: string,
    problematicSnippet: string,
    token: string,
): Promise<string> {
    const prompt = `
Context: A process needs to find an exact literal, unique match for a specific text snippet within a file's content. The provided snippet failed to match exactly.

Task: Analyze the provided file content and the problematic target snippet. Identify the segment in the file content that the snippet was *most likely* intended to match.

Problematic target snippet:
\`\`\`
${problematicSnippet}
\`\`\`

File Content:
\`\`\`
${fileContent}
\`\`\`

Return ONLY the corrected target snippet in JSON format with key 'corrected_target_snippet'.
`.trim();

    try {
        const result = await getJsonResponse(healEndpoint, prompt, OLD_STRING_CORRECTION_SCHEMA, token);
        return result?.corrected_target_snippet || problematicSnippet;
    } catch (error) {
        console.warn('Failed to correct old string via LLM:', error);
        return problematicSnippet;
    }
}

/**
 * Corrige newString para evitar problemas de escaping
 */
export async function correctNewString(
    healEndpoint: HealingEndpoint,
    originalOldString: string,
    correctedOldString: string,
    originalNewString: string,
    token: string,
): Promise<string> {
    const prompt = `
Context: A string replacement operation needs to correct the new string to match the corrected old string format.

Original old string:
\`\`\`
${originalOldString}
\`\`\`

Corrected old string:
\`\`\`
${correctedOldString}
\`\`\`

Original new string (potentially with escaping issues):
\`\`\`
${originalNewString}
\`\`\`

Task: Provide a corrected new string that maintains the same escaping/formatting style as the corrected old string.

Return ONLY the corrected new string in JSON format with key 'corrected_new_string'.
`.trim();

    try {
        const result = await getJsonResponse(healEndpoint, prompt, NEW_STRING_CORRECTION_SCHEMA, token);
        return result?.corrected_new_string || originalNewString;
    } catch (error) {
        console.warn('Failed to correct new string via LLM:', error);
        return originalNewString;
    }
}

/**
 * Cura patch que falhou em aplicar
 */
export async function healPatch(
    healEndpoint: HealingEndpoint,
    patch: string,
    explanation: string,
    token: string,
): Promise<string | undefined> {
    const prompt = `The following patch failed to apply cleanly. Please fix it:

Original patch:
\`\`\`
${patch}
\`\`\`

Context: ${explanation}

Please provide a corrected patch that will apply cleanly. Return the result in JSON format.`;

    try {
        const result = await getJsonResponse(healEndpoint, prompt, PATCH_HEALING_SCHEMA, token);
        return result?.corrected_patch;
    } catch (error) {
        console.warn('Failed to heal patch via LLM:', error);
        return undefined;
    }
}

/**
 * Faz request JSON estruturado para LLM
 */
async function getJsonResponse(
    endpoint: HealingEndpoint,
    prompt: string,
    schema: ObjectJsonSchema,
    token: string
): Promise<{ corrected_target_snippet?: string; corrected_new_string?: string; corrected_patch?: string }> {
    const messages = [
        {
            role: ChatRole.User,
            content: [
                {
                    type: ChatCompletionContentPartKind.Text,
                    text: prompt
                }
            ]
        }
    ];

    const result = await endpoint.makeChatRequest(
        'toolHealing',
        messages,
        undefined,
        token,
        ChatLocation.Other
    );

    if (result.type === ChatFetchResponseType.Success && result.value?.content) {
        try {
            // Extract JSON from response content
            const content = Array.isArray(result.value.content) 
                ? result.value.content[0]?.text || result.value.content 
                : result.value.content;
            
            const jsonStr = typeof content === 'string' ? content : JSON.stringify(content);
            
            // Try to find JSON in the response
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            // If no JSON found, try to parse the whole response
            return JSON.parse(jsonStr);
        } catch (parseError) {
            throw new Error(`Failed to parse JSON response: ${parseError}`);
        }
    }

    throw new Error(`LLM request failed: ${result.error?.message || 'Unknown error'}`);
}

/**
 * Fix específico para bugs do Gemini com escaping
 */
export function _unescapeStringForGeminiBug(inputString: string): string {
    return inputString.replace(
        /\\+(n|t|r|'|"|`|\\|\n)/g,
        (match, capturedChar) => {
            switch (capturedChar) {
                case 'n': return '\n';    // \\n → \n
                case 't': return '\t';    // \\t → \t  
                case 'r': return '\r';    // \\r → \r
                case "'": return "'";     // \\' → '
                case '"': return '"';     // \\" → "
                case '`': return '`';     // \\` → `
                case '\\': return '\\';   // \\\\ → \
                case '\n': return '\n';   // \\\n → \n
                default: return match;
            }
        },
    );
}

/**
 * Conta ocorrências de string no conteúdo
 */
export function count(content: string, searchString: string): number {
    if (!searchString) {return 0;}
    
    let count = 0;
    let index = 0;
    
    while ((index = content.indexOf(searchString, index)) !== -1) {
        count++;
        index += searchString.length;
    }
    
    return count;
}

/**
 * Conta matches considerando end-of-line
 */
export function matchAndCount(content: string, searchString: string, eol: string): number {
    // Normaliza line endings se necessário
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const normalizedSearch = searchString.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    if (eol === '\r\n') {
        // Se o arquivo usa CRLF, ajusta a busca
        const crlfContent = normalizedContent.replace(/\n/g, '\r\n');
        const crlfSearch = normalizedSearch.replace(/\n/g, '\r\n');
        return count(crlfContent, crlfSearch);
    }
    
    return count(normalizedContent, normalizedSearch);
}

/**
 * Otimização de trim - remove espaços desnecessários nas pontas
 */
export function trimPairIfPossible(
    oldString: string,
    newString: string,
    fileContent: string,
    expectedReplacements: number
): { targetString: string; pair: string } {
    let trimmedOld = oldString;
    let trimmedNew = newString;
    
    // Tenta trim do início
    while (trimmedOld.length > 1 && trimmedNew.length > 1) {
        const firstCharOld = trimmedOld[0];
        const firstCharNew = trimmedNew[0];
        
        if (firstCharOld === firstCharNew && (firstCharOld === ' ' || firstCharOld === '\t')) {
            const testOld = trimmedOld.slice(1);
            const testNew = trimmedNew.slice(1);
            
            if (count(fileContent, testOld) === expectedReplacements) {
                trimmedOld = testOld;
                trimmedNew = testNew;
                continue;
            }
        }
        break;
    }
    
    // Tenta trim do final
    while (trimmedOld.length > 1 && trimmedNew.length > 1) {
        const lastCharOld = trimmedOld[trimmedOld.length - 1];
        const lastCharNew = trimmedNew[trimmedNew.length - 1];
        
        if (lastCharOld === lastCharNew && (lastCharOld === ' ' || lastCharOld === '\t')) {
            const testOld = trimmedOld.slice(0, -1);
            const testNew = trimmedNew.slice(0, -1);
            
            if (count(fileContent, testOld) === expectedReplacements) {
                trimmedOld = testOld;
                trimmedNew = testNew;
                continue;
            }
        }
        break;
    }
    
    return {
        targetString: trimmedOld,
        pair: trimmedNew
    };
}

/**
 * Extrai patch da resposta do LLM
 */
export function extractPatchFromResponse(response: { content?: unknown }): string | undefined {
    if (!response) {return undefined;}
    
    const content = Array.isArray(response.content) 
        ? response.content[0]?.text || response.content 
        : response.content;
    
    if (typeof content !== 'string') {return undefined;}
    
    // Procura por patch entre ```
    const patchMatch = content.match(/```(?:diff|patch)?\n?([\s\S]*?)```/);
    if (patchMatch) {
        return patchMatch[1].trim();
    }
    
    // Se não encontrou, assume que todo o conteúdo é o patch
    return content.trim();
}

/**
 * Valida se string contém apenas whitespace
 */
export function isWhitespaceOnly(str: string): boolean {
    return /^\s*$/.test(str);
}

/**
 * Normaliza line endings baseado no sistema
 */
export function normalizeLineEndings(content: string, targetEol: string): string {
    // Primeiro normaliza tudo para \n
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Depois converte para o target
    if (targetEol === '\r\n') {
        return normalized.replace(/\n/g, '\r\n');
    } else if (targetEol === '\r') {
        return normalized.replace(/\n/g, '\r');
    }
    
    return normalized;
}

/**
 * Detecta line ending usado no arquivo
 */
export function detectLineEnding(content: string): '\r\n' | '\n' | '\r' {
    const crlfCount = (content.match(/\r\n/g) || []).length;
    const lfCount = (content.match(/(?<!\r)\n/g) || []).length;
    const crCount = (content.match(/\r(?!\n)/g) || []).length;
    
    if (crlfCount > lfCount && crlfCount > crCount) {
        return '\r\n';
    } else if (crCount > lfCount) {
        return '\r';
    }
    
    return '\n';
}

/**
 * Cria contexto resumido para healing (evita tokens excessivos)
 */
export function createHealingContext(
    fileContent: string,
    problematicSnippet: string,
    maxContextLength = 2000
): string {
    if (fileContent.length <= maxContextLength) {
        return fileContent;
    }
    
    // Encontra posição aproximada do snippet
    const snippetIndex = fileContent.indexOf(problematicSnippet);
    
    if (snippetIndex === -1) {
        // Se não encontrou, pega começo e fim do arquivo
        const half = Math.floor(maxContextLength / 2);
        return fileContent.slice(0, half) + '\n\n[... content truncated ...]\n\n' + 
               fileContent.slice(-half);
    }
    
    // Pega contexto ao redor do snippet
    const contextRadius = Math.floor((maxContextLength - problematicSnippet.length) / 2);
    const start = Math.max(0, snippetIndex - contextRadius);
    const end = Math.min(fileContent.length, snippetIndex + problematicSnippet.length + contextRadius);
    
    let context = fileContent.slice(start, end);
    
    if (start > 0) {
        context = '[... content before ...]\n\n' + context;
    }
    
    if (end < fileContent.length) {
        context = context + '\n\n[... content after ...]';
    }
    
    return context;
}

/**
 * Verifica se model family é Gemini (para aplicar unescape bug fix)
 */
export function isGeminiModel(model?: { family: string; name: string }): boolean {
    return model?.family.toLowerCase().includes('gemini') || false;
}

/**
 * Cria função de unescape baseada no modelo
 */
export function createUnescapeFunction(model?: { family: string; name: string }): (str: string) => string {
    return isGeminiModel(model) ? _unescapeStringForGeminiBug : (s: string) => s;
}