/**
 * Drill Generator
 * 
 * Generates personalized drills using the active user-selected model based on weak skills.
 */

(function (root, factory) {
    console.log('[DrillGenerator] UMD wrapper executing');

    const exports = factory();

    // Always attach to self in browser contexts (including ES modules)
    if (typeof self !== 'undefined') {
        self.DrillGenerator = exports;
        console.log('[DrillGenerator] Attached to self.DrillGenerator');
    }

    // Also support CommonJS for tests
    if (typeof module === 'object' && module.exports) {
        module.exports = exports;
    }
}(typeof self !== 'undefined' ? self : this, function () {

    // Import dependencies
    let LLMGateway, DrillStore;
    const globalRoot = typeof self !== 'undefined'
        ? self
        : (typeof globalThis !== 'undefined' ? globalThis : this);
    const DebugLog = globalRoot?.NeuralDebug || {
        log: () => { },
        warn: () => { },
        groupCollapsed: () => { },
        groupEnd: () => { }
    };

    if (typeof require !== 'undefined') {
        LLMGateway = require('./llm_gateway');
        DrillStore = require('./drill_store');
    }
    // Browser/service-worker fallback to globals loaded via importScripts
    if (!LLMGateway && globalRoot && globalRoot.LLMGateway) {
        LLMGateway = globalRoot.LLMGateway;
    }
    if (!DrillStore && globalRoot && globalRoot.DrillStore) {
        DrillStore = globalRoot.DrillStore;
    }
    if (!LLMGateway) {
        DebugLog.warn('[DrillGenerator] LLMGateway not found on global scope.');
    }
    if (!DrillStore) {
        DebugLog.warn('[DrillGenerator] DrillStore not found on global scope.');
    }

    const DRILL_TYPES = ['fill-in-blank', 'spot-bug', 'critique', 'muscle-memory'];
    const DEFAULT_DRILLS_PER_SKILL = 3;
    const DEFAULT_MIN_TOTAL_DRILLS = 6;
    const DEFAULT_SKILL_ATTEMPTS = 3;
    const DEFAULT_MAX_RETRIES_PER_ATTEMPT = 2;
    const DEFAULT_DRILL_TEMPERATURE = 1.0;
    const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

    function toPositiveInt(value, fallback) {
        const num = Number(value);
        if (!Number.isFinite(num) || num <= 0) return fallback;
        return Math.floor(num);
    }

    function dedupeWeakSkills(weakSkills) {
        const map = new Map();
        for (const item of weakSkills || []) {
            const skillId = typeof item?.skillId === 'string' ? item.skillId.trim() : '';
            if (!skillId) continue;
            const insight = typeof item?.insight === 'string' ? item.insight.trim() : '';
            if (!map.has(skillId)) {
                map.set(skillId, { skillId, insight });
                continue;
            }

            if (!insight) continue;
            const existing = map.get(skillId);
            if (!existing.insight) {
                existing.insight = insight;
            } else if (!existing.insight.includes(insight)) {
                existing.insight = `${existing.insight}; ${insight}`;
            }
        }
        return Array.from(map.values());
    }

    function buildRepairHint({ count, attempt }) {
        return `\nPrevious response was invalid or incomplete (attempt ${attempt - 1}). Retry and output STRICT JSON with EXACTLY ${count} drill objects. No markdown, no prose, no comments.`;
    }

    function buildTemplateDrills(weakSkills, neededCount = 0) {
        const needed = toPositiveInt(neededCount, 0);
        if (needed <= 0 || !Array.isArray(weakSkills) || weakSkills.length === 0) {
            return [];
        }

        const drills = [];
        for (let i = 0; i < needed; i++) {
            const skill = weakSkills[i % weakSkills.length];
            const skillId = skill.skillId || 'general';
            const insight = skill.insight ? `Weakness: ${skill.insight}` : 'Weakness: recurring mistakes.';
            const variant = i % 4;

            if (variant === 0) {
                drills.push({
                    type: 'fill-in-blank',
                    skillId,
                    content: `Skill: ${skillId}\n${insight}\nComplete the blank:\ndef solve(nums):\n    if not nums:\n        return ___\n    return len(nums)`,
                    answer: '0',
                    explanation: 'Return 0 for an empty list to avoid boundary bugs.',
                    difficulty: 'easy'
                });
                continue;
            }

            if (variant === 1) {
                drills.push({
                    type: 'spot-bug',
                    skillId,
                    content: `Skill: ${skillId}\n${insight}\n1 def solve(nums):\n2     return nums[len(nums)]\n3 # identify the buggy line`,
                    answer: 'line 2',
                    explanation: 'Valid indices end at len(nums) - 1.',
                    difficulty: 'easy'
                });
                continue;
            }

            if (variant === 2) {
                drills.push({
                    type: 'muscle-memory',
                    skillId,
                    content: `Skill: ${skillId}\n${insight}\nWrite a minimal template for this skill from memory, including boundary checks.`,
                    answer: null,
                    explanation: 'Focus on a reusable skeleton and edge-case guard clauses.',
                    difficulty: 'medium'
                });
                continue;
            }

            drills.push({
                type: 'critique',
                skillId,
                content: `Skill: ${skillId}\n${insight}\nCritique this code and suggest one improvement:\ndef solve(nums):\n    out = []\n    for i in range(len(nums)):\n        out.append(nums[i])\n    return out`,
                answer: null,
                explanation: 'Look for unnecessary work and missing edge-case handling.',
                difficulty: 'medium'
            });
        }
        return drills;
    }

    /**
     * Build the drill generation prompt.
     */
    function buildGenerationPrompt(skillId, options = {}) {
        const insight = options.insight || '';
        const count = toPositiveInt(options.count, DEFAULT_DRILLS_PER_SKILL);
        const types = options.types || DRILL_TYPES;
        const repairHint = options.repairHint || '';

        return `You are a coding drill generator for a LeetCode study extension.

Generate EXACTLY ${count} micro-drill(s) for the skill: "${skillId}".
${insight ? `\nUser's weakness: ${insight}` : ''}
${repairHint}

Preferred drill types: ${types.join(', ')}

Type definitions:
- fill-in-blank: snippet with ___ to fill in (answer required)
- spot-bug: buggy snippet (answer required: line number or bug description)
- critique: improvement feedback (answer must be null)
- muscle-memory: write code from memory (answer must be null)

Respond with JSON ONLY:
{
  "drills": [
    {
      "type": "fill-in-blank|spot-bug|critique|muscle-memory",
      "content": "The drill question or code snippet",
      "answer": "The correct answer (or null for critique/muscle-memory)",
      "test_cases": ["List of strings", "inputs for verification"],
      "explanation": "Brief explanation of why the answer is correct",
      "difficulty": "easy|medium|hard"
    }
  ]
}

Rules:
- Return EXACTLY ${count} entries in drills array
- Do not include markdown code fences
- Do not include explanatory prose outside JSON
- Keep content concise (max 15 lines of code)
- The code MUST be self-contained
- Focus on the identified weakness
- Make answers unambiguous for fill-in-blank and spot-bug`;
    }

    /**
     * Validate a drill has required fields.
     */
    function validateDrill(drill) {
        if (!drill) return false;
        if (!drill.type || !DRILL_TYPES.includes(drill.type)) return false;
        if (!drill.content) return false;
        // fill-in-blank and spot-bug require an answer
        if ((drill.type === 'fill-in-blank' || drill.type === 'spot-bug')
            && (drill.answer === undefined || drill.answer === null || String(drill.answer).trim() === '')) {
            return false;
        }
        return true;
    }

    /**
     * Generate drills for a specific skill using the active model.
     */
    async function generateDrillsForSkill(skillId, options = {}) {
        if (!LLMGateway || typeof LLMGateway.analyzeSubmissions !== 'function') {
            console.error('[DrillGenerator] LLMGateway unavailable; cannot generate drills.');
            return [];
        }

        const count = toPositiveInt(options.count, DEFAULT_DRILLS_PER_SKILL);
        const maxAttempts = toPositiveInt(options.attempts, DEFAULT_SKILL_ATTEMPTS);
        const maxRetriesPerAttempt = toPositiveInt(options.maxRetriesPerAttempt, DEFAULT_MAX_RETRIES_PER_ATTEMPT);
        const maxOutputTokens = toPositiveInt(options.maxOutputTokens, DEFAULT_MAX_OUTPUT_TOKENS);
        const temperature = typeof options.temperature === 'number'
            ? options.temperature
            : DEFAULT_DRILL_TEMPERATURE;

        let bestDrills = [];
        let lastError = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            DebugLog.log('[DrillGenerator] Generating drills:', {
                skillId,
                count,
                attempt,
                maxAttempts,
                insight: options.insight || null
            });

            const prompt = buildGenerationPrompt(skillId, {
                ...options,
                count,
                repairHint: attempt > 1 ? buildRepairHint({ count, attempt }) : ''
            });

            try {
                const response = await LLMGateway.analyzeSubmissions(prompt, {
                    maxRetries: maxRetriesPerAttempt,
                    temperature,
                    maxOutputTokens,
                    responseMimeType: 'application/json'
                });

                if (!response || response.error || !response.drills) {
                    lastError = response?.error || 'Missing drills in response';
                    DebugLog.warn('[DrillGenerator] Generation attempt failed:', {
                        skillId,
                        attempt,
                        error: lastError
                    });
                    continue;
                }

                const rawDrills = Array.isArray(response.drills) ? response.drills : [];
                const validDrills = rawDrills
                    .filter(d => validateDrill(d))
                    .map(d => ({
                        ...d,
                        skillId
                    }));

                const limited = validDrills.slice(0, count);
                const invalidCount = rawDrills.length - validDrills.length;
                DebugLog.log('[DrillGenerator] Response summary:', {
                    skillId,
                    attempt,
                    total: rawDrills.length,
                    valid: validDrills.length,
                    used: limited.length,
                    invalid: invalidCount
                });

                if (invalidCount > 0) {
                    const invalidSample = rawDrills
                        .filter(d => !validateDrill(d))
                        .slice(0, 2)
                        .map(d => ({
                            type: d?.type || null,
                            hasContent: Boolean(d?.content),
                            hasAnswer: d?.answer !== undefined && d?.answer !== null
                        }));
                    DebugLog.warn('[DrillGenerator] Invalid drill sample:', invalidSample);
                }

                if (limited.length > bestDrills.length) {
                    bestDrills = limited;
                }
                if (bestDrills.length >= count) {
                    break;
                }
            } catch (e) {
                lastError = e.message;
                DebugLog.warn('[DrillGenerator] Generation attempt threw:', {
                    skillId,
                    attempt,
                    error: e.message
                });
            }
        }

        if (bestDrills.length < count) {
            DebugLog.warn('[DrillGenerator] Returning partial drill set:', {
                skillId,
                requested: count,
                returned: bestDrills.length,
                error: lastError
            });
        }
        if (bestDrills.length === 0 && lastError) {
            console.error('[DrillGenerator] Generation failed:', lastError);
        }
        return bestDrills;
    }

    /**
     * Save generated drills to the store.
     */
    async function saveDrills(drills) {
        DebugLog.log('[DrillGenerator] Saving drills:', {
            count: Array.isArray(drills) ? drills.length : 0,
            sample: (Array.isArray(drills) ? drills : []).slice(0, 3).map(d => ({
                type: d.type,
                skillId: d.skillId,
                difficulty: d.difficulty || 'medium'
            }))
        });

        if (!DrillStore || !DrillStore.DrillStore || typeof DrillStore.createDrill !== 'function') {
            console.error('[DrillGenerator] DrillStore unavailable; cannot persist drills.');
            return { saved: 0, error: 'DrillStore unavailable' };
        }

        const store = new DrillStore.DrillStore();
        await store.init();

        let saved = 0;
        for (const drill of drills) {
            const entity = DrillStore.createDrill({
                type: drill.type,
                skillId: drill.skillId,
                content: drill.content,
                answer: drill.answer,
                explanation: drill.explanation,
                difficulty: drill.difficulty || 'medium'
            });
            await store.add(entity);
            saved++;
        }

        DebugLog.log(`[DrillGenerator] Saved ${saved} drills.`);
        return { saved };
    }

    /**
     * Generate drills for multiple weak skills.
     * If weakSkills not provided, fetches from SkillMatrix storage.
     */
    async function generateFromWeakSkills(weakSkills, options = {}) {
        const drillsPerSkill = toPositiveInt(options.drillsPerSkill, DEFAULT_DRILLS_PER_SKILL);
        const skillAttempts = toPositiveInt(options.skillAttempts, DEFAULT_SKILL_ATTEMPTS);
        const maxRetriesPerAttempt = toPositiveInt(options.maxRetriesPerAttempt, DEFAULT_MAX_RETRIES_PER_ATTEMPT);
        const defaultMinTotalDrills = Math.max(
            drillsPerSkill,
            Math.min((Array.isArray(weakSkills) ? weakSkills.length : 2) * drillsPerSkill, DEFAULT_MIN_TOTAL_DRILLS)
        );
        const minTotalDrills = toPositiveInt(options.minTotalDrills, defaultMinTotalDrills);
        let totalGenerated = 0;
        const allDrills = [];
        const generatedBySkill = {};

        DebugLog.log('[DrillGenerator] generateFromWeakSkills called:', {
            providedWeakSkills: Array.isArray(weakSkills) ? weakSkills.length : 0,
            drillsPerSkill,
            minTotalDrills,
            skillAttempts
        });

        // If no weakSkills provided, fetch from storage
        if (!weakSkills || !Array.isArray(weakSkills) || weakSkills.length === 0) {
            try {
                // Try to load from SkillMatrix storage
                const result = await chrome.storage.local.get({ skillDNA: null });

                if (result.skillDNA) {
                    // Combine Layer 1 (skills) and Layer 2 (patterns) weak areas
                    const skills = result.skillDNA.skills || {};
                    const patterns = result.skillDNA.patterns || {};

                    const weakLayer1 = Object.values(skills)
                        .filter(s => s.mistakes >= 1)
                        .sort((a, b) => a.score - b.score)
                        .slice(0, 3)
                        .map(s => ({ skillId: s.id, insight: `${s.mistakes} mistakes` }));

                    const weakLayer2 = Object.values(patterns)
                        .filter(p => p.mistakes >= 1)
                        .sort((a, b) => a.score - b.score)
                        .slice(0, 3)
                        .map(p => ({ skillId: p.patternId, insight: `${p.mistakes} ${p.patternId.replace(/-/g, ' ')} errors` }));

                    weakSkills = [...weakLayer1, ...weakLayer2];
                    DebugLog.log('[DrillGenerator] Loaded weak skills from storage:', {
                        skills: Object.keys(skills).length,
                        patterns: Object.keys(patterns).length,
                        weakLayer1: weakLayer1.length,
                        weakLayer2: weakLayer2.length,
                        totalWeakSkills: weakSkills.length,
                        sample: weakSkills.slice(0, 5)
                    });
                }
            } catch (e) {
                DebugLog.warn('[DrillGenerator] Could not load weak skills from storage:', e);
            }
        }

        // Still no skills? Return empty
        if (!weakSkills || weakSkills.length === 0) {
            DebugLog.log('[DrillGenerator] No weak skills to generate drills for');
            return [];
        }

        weakSkills = dedupeWeakSkills(weakSkills);
        if (weakSkills.length === 0) {
            DebugLog.log('[DrillGenerator] Weak skill list empty after dedupe');
            return [];
        }

        for (const skill of weakSkills) {
            DebugLog.log('[DrillGenerator] Generating for skill:', {
                skillId: skill.skillId,
                insight: skill.insight || null
            });
            const drills = await generateDrillsForSkill(skill.skillId, {
                count: drillsPerSkill,
                insight: skill.insight,
                attempts: skillAttempts,
                maxRetriesPerAttempt
            });

            if (drills.length > 0) {
                await saveDrills(drills);
                totalGenerated += drills.length;
                allDrills.push(...drills);
                generatedBySkill[skill.skillId] = (generatedBySkill[skill.skillId] || 0) + drills.length;
                DebugLog.log('[DrillGenerator] Generated drills for skill:', {
                    skillId: skill.skillId,
                    count: drills.length
                });
            } else {
                DebugLog.warn('[DrillGenerator] No drills generated for skill:', {
                    skillId: skill.skillId
                });
            }
        }

        let remaining = minTotalDrills - allDrills.length;
        if (remaining > 0) {
            DebugLog.warn('[DrillGenerator] Total drills below target; running supplement pass:', {
                current: allDrills.length,
                target: minTotalDrills,
                remaining
            });

            const prioritizedSkills = [...weakSkills]
                .sort((a, b) => (generatedBySkill[a.skillId] || 0) - (generatedBySkill[b.skillId] || 0));

            for (const skill of prioritizedSkills) {
                if (remaining <= 0) break;

                const supplementCount = Math.min(drillsPerSkill, remaining);
                const supplemental = await generateDrillsForSkill(skill.skillId, {
                    count: supplementCount,
                    insight: skill.insight,
                    attempts: Math.max(1, skillAttempts - 1),
                    maxRetriesPerAttempt
                });

                if (supplemental.length > 0) {
                    await saveDrills(supplemental);
                    totalGenerated += supplemental.length;
                    allDrills.push(...supplemental);
                    generatedBySkill[skill.skillId] = (generatedBySkill[skill.skillId] || 0) + supplemental.length;
                    remaining -= supplemental.length;
                }
            }
        }

        remaining = minTotalDrills - allDrills.length;
        if (remaining > 0) {
            const templateDrills = buildTemplateDrills(weakSkills, remaining);
            if (templateDrills.length > 0) {
                await saveDrills(templateDrills);
                totalGenerated += templateDrills.length;
                allDrills.push(...templateDrills);
                DebugLog.warn('[DrillGenerator] Added template fallback drills to hit minimum target:', {
                    added: templateDrills.length,
                    target: minTotalDrills,
                    final: allDrills.length
                });
            }
        }

        DebugLog.log(`[DrillGenerator] Generated ${totalGenerated} drills for ${weakSkills.length} skills.`);
        return allDrills;
    }

    return {
        generateDrillsForSkill,
        buildGenerationPrompt,
        validateDrill,
        saveDrills,
        generateFromWeakSkills,
        DRILL_TYPES
    };
}));
