/**
 * CodeGeneratorAgent.js
 * 
 * Converts pseudo-code or natural language to executable Python code using LLM.
 * Part of Sprint 11.2: AI Judgment & Scaffolding.
 */

const CodeGeneratorAgent = {
    /**
     * Convert pseudo-code or natural language to Python code.
     * @param {string} input - User's pseudo-code or natural language
     * @param {object} context - { skillId, drillType, inputType }
     * @returns {Promise<object>} { success, code, language, confidence, error, retryable }
     */
    async generateCode(input, context = {}, retries = 2) {
        // Edge case: empty, null, undefined input
        if (!input || typeof input !== 'string' || !input.trim()) {
            return {
                success: false,
                code: null,
                language: 'python',
                confidence: 0,
                error: 'Input is empty or invalid',
                retryable: false
            };
        }

        const cleanInput = input.trim();

        // Edge case: very long input (>10KB)
        const maxLength = 10000;
        const truncatedInput = cleanInput.length > maxLength
            ? cleanInput.slice(0, maxLength) + '\n# ... (truncated)'
            : cleanInput;

        try {
            const response = await this._callLLM(truncatedInput, context);

            // Parse response
            const code = this._extractPythonCode(response);

            if (!code) {
                return {
                    success: false,
                    code: null,
                    language: 'python',
                    confidence: 0,
                    error: 'LLM did not return valid Python code',
                    retryable: true
                };
            }

            return {
                success: true,
                code: code,
                language: 'python',
                confidence: this._calculateConfidence(response),
                error: null,
                retryable: false
            };

        } catch (error) {
            const isRateLimited = error.status === 429 || (error.message && error.message.includes('rate'));
            const isTimeout = error.message && (error.message.includes('timeout') || error.message.includes('network') || error.message.includes('fetch'));

            // Internal Retry for transient network errors
            if (retries > 0 && (isTimeout || isRateLimited)) {
                console.warn(`[CodeGenerator] Retry attempt remaining: ${retries}. Error: ${error.message}`);
                // Simple backoff: 1s wait
                await new Promise(r => setTimeout(r, 1000));
                return this.generateCode(input, context, retries - 1);
            }

            return {
                success: false,
                code: null,
                language: 'python',
                confidence: 0,
                error: isTimeout ? 'Request timeout or network error' : (error.message || 'Unknown error'),
                retryable: isRateLimited || isTimeout
            };
        }
    },

    /**
     * Generate a pre-filled scaffold template with strategic blanks.
     * @param {object} options - { skillId, weakPattern, difficulty }
     * @returns {Promise<object>} { template, blanks }
     */
    async generateScaffold(options = {}) {
        const { skillId, weakPattern, difficulty } = options;

        // Get base template for the skill
        const baseTemplate = await this._getSkillTemplate(skillId, difficulty);

        if (!weakPattern) {
            // No weak pattern, return full template without blanks
            return {
                template: baseTemplate,
                blanks: []
            };
        }

        // Insert blanks at positions related to weak pattern
        const { template, blanks } = this._insertBlanks(baseTemplate, weakPattern);

        return {
            template,
            blanks
        };
    },

    // ============================================
    // Internal Methods
    // ============================================

    /**
     * Call LLM API to generate code.
     * @param {string} input 
     * @param {object} context 
     */
    async _callLLM(input, context) {
        // Check if LLMGateway is available (browser context)
        // Note: CodeGeneratorAgent might be used in context where LLMGateway is global
        const gateway = (typeof LLMGateway !== 'undefined') ? LLMGateway :
            (typeof self !== 'undefined' && self.LLMGateway) ? self.LLMGateway : null;

        if (gateway && gateway.generateContent) {
            const prompt = this._buildPrompt(input, context);
            return await gateway.generateContent(prompt);
        }

        // Fallback for testing or when no LLM available
        return {
            choices: [{
                message: {
                    content: `\`\`\`python\ndef solution():\n    pass\n\`\`\``
                }
            }]
        };
    },

    /**
     * Build prompt for LLM.
     */
    _buildPrompt(input, context) {
        const inputType = context.inputType || 'pseudo-code';
        const skill = context.skillId || 'algorithm';

        return `You are a Python code generator. Convert the following ${inputType} into clean, executable Python code.

Skill/Topic: ${skill}

User Input:
${input}

Requirements:
1. Output ONLY valid Python code
2. Use proper indentation
3. Include type hints where appropriate
4. Handle edge cases (empty input, None, etc.)
5. Wrap the code in \`\`\`python ... \`\`\` block

Generate the Python code:`;
    },

    /**
     * Extract Python code from LLM response.
     */
    _extractPythonCode(response) {
        if (!response) return null;

        // Handle different response formats
        let content = '';

        if (typeof response === 'string') {
            content = response;
        } else if (response.choices && response.choices[0]) {
            content = response.choices[0].message?.content || response.choices[0].text || '';
        } else if (response.text) {
            content = response.text;
        }

        // Extract code from markdown block
        const pythonMatch = content.match(/```python\s*([\s\S]*?)```/);
        if (pythonMatch) {
            return pythonMatch[1].trim();
        }

        // Try generic code block
        const genericMatch = content.match(/```\s*([\s\S]*?)```/);
        if (genericMatch) {
            return genericMatch[1].trim();
        }

        // If no code block, check if content looks like code
        if (content.includes('def ') || content.includes('class ')) {
            return content.trim();
        }

        return null;
    },

    /**
     * Calculate confidence score based on response quality.
     */
    _calculateConfidence(response) {
        if (!response) return 0;

        let score = 0.5; // Base score

        const code = this._extractPythonCode(response);
        if (code) {
            // Has valid Python syntax markers
            if (code.includes('def ')) score += 0.2;
            if (code.includes('return ')) score += 0.1;
            if (code.includes(':')) score += 0.1;
        }

        return Math.min(score, 1.0);
    },

    /**
     * Get base template for a skill.
     */
    async _getSkillTemplate(skillId, difficulty) {
        // Templates for common skills
        const templates = {
            binary_search: `def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1`,

            two_pointers: `def two_pointers(arr):
    left, right = 0, len(arr) - 1
    while left < right:
        # Process elements
        left += 1
        right -= 1
    return result`,

            sliding_window: `def sliding_window(arr, k):
    window_sum = sum(arr[:k])
    max_sum = window_sum
    for i in range(k, len(arr)):
        window_sum += arr[i] - arr[i - k]
        max_sum = max(max_sum, window_sum)
    return max_sum`
        };

        return templates[skillId] || templates.binary_search;
    },

    /**
     * Insert blanks at strategic positions based on weak pattern.
     */
    _insertBlanks(template, weakPattern) {
        const lines = template.split('\n');
        const blanks = [];

        // Pattern to line keyword mapping
        const patternKeywords = {
            'off-by-one': ['len(', '- 1', '+ 1'],
            'loop-boundary': ['while', 'for', '<=', '<'],
            'null-check': ['if ', 'None', 'not '],
            'index-error': ['[', ']', 'mid']
        };

        const keywords = patternKeywords[weakPattern] || patternKeywords['off-by-one'];

        // Find lines containing keywords and blank them
        lines.forEach((line, index) => {
            for (const keyword of keywords) {
                if (line.includes(keyword) && blanks.length < 2) {
                    // Replace the keyword with blank
                    const blankLine = line.replace(keyword, '___');
                    lines[index] = blankLine;
                    blanks.push({
                        lineNumber: index + 1,
                        original: keyword,
                        hint: `Fill in the ${weakPattern} related code`
                    });
                    break;
                }
            }
        });

        return {
            template: lines.join('\n'),
            blanks
        };
    }
};

// Export for both Node (Jest) and Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CodeGeneratorAgent;
} else {
    self.CodeGeneratorAgent = CodeGeneratorAgent;
}
