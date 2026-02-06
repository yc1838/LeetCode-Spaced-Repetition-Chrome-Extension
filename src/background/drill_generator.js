/**
 * Drill Generator
 * 
 * Generates personalized drills using Gemini based on weak skills.
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

    /**
     * Build the drill generation prompt for Gemini.
     */
    function buildGenerationPrompt(skillId, options = {}) {
        const insight = options.insight || '';
        const count = options.count || 1;
        const types = options.types || DRILL_TYPES;

        return `You are a coding drill generator for a LeetCode study extension.

Generate ${count} micro-drill(s) for the skill: "${skillId}"
${insight ? `\nUser's weakness: ${insight}` : ''}

Drill types to use: ${types.join(', ')}

For each drill type:
- **fill-in-blank**: Code snippet with a blank (___) to fill in. Answer is the missing code.
- **spot-bug**: Buggy code snippet. Answer is the line number or description of the bug.
- **critique**: Code that works but could be improved. Answer is null (graded by AI).
- **muscle-memory**: Prompt to write code from memory. Answer is null (graded by AI).

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
- Keep content concise (max 15 lines of code)
- **CRITICAL**: The code MUST be self-contained. Do not use undefined variables like '#' or 'root' without defining them or explaining them in comments.
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
        if ((drill.type === 'fill-in-blank' || drill.type === 'spot-bug') && drill.answer === undefined) {
            return false;
        }
        return true;
    }

    /**
     * Generate drills for a specific skill using Gemini.
     */
    async function generateDrillsForSkill(skillId, options = {}) {
        if (!LLMGateway || typeof LLMGateway.analyzeSubmissions !== 'function') {
            console.error('[DrillGenerator] LLMGateway unavailable; cannot generate drills.');
            return [];
        }

        DebugLog.log('[DrillGenerator] Generating drills:', {
            skillId,
            count: options.count || 1,
            insight: options.insight || null
        });

        const prompt = buildGenerationPrompt(skillId, options);

        try {
            const response = await LLMGateway.analyzeSubmissions(prompt);

            if (response.error || !response.drills) {
                console.error('[DrillGenerator] Generation failed:', response.error);
                return [];
            }

            // Validate and attach skillId
            const rawDrills = Array.isArray(response.drills) ? response.drills : [];
            const validDrills = rawDrills
                .filter(d => validateDrill(d))
                .map(d => ({
                    ...d,
                    skillId
                }));

            const invalidCount = rawDrills.length - validDrills.length;
            DebugLog.log('[DrillGenerator] Response summary:', {
                skillId,
                total: rawDrills.length,
                valid: validDrills.length,
                invalid: invalidCount
            });

            if (invalidCount > 0) {
                const invalidSample = rawDrills
                    .filter(d => !validateDrill(d))
                    .slice(0, 2)
                    .map(d => ({
                        type: d?.type || null,
                        hasContent: Boolean(d?.content),
                        hasAnswer: d?.answer !== undefined
                    }));
                DebugLog.warn('[DrillGenerator] Invalid drill sample:', invalidSample);
            }

            return validDrills;
        } catch (e) {
            console.error('[DrillGenerator] Error:', e);
            return [];
        }
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
        const drillsPerSkill = options.drillsPerSkill || 1;
        let totalGenerated = 0;
        let allDrills = [];

        DebugLog.log('[DrillGenerator] generateFromWeakSkills called:', {
            providedWeakSkills: Array.isArray(weakSkills) ? weakSkills.length : 0,
            drillsPerSkill
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

        for (const skill of weakSkills) {
            DebugLog.log('[DrillGenerator] Generating for skill:', {
                skillId: skill.skillId,
                insight: skill.insight || null
            });
            const drills = await generateDrillsForSkill(skill.skillId, {
                count: drillsPerSkill,
                insight: skill.insight
            });

            if (drills.length > 0) {
                await saveDrills(drills);
                totalGenerated += drills.length;
                allDrills = allDrills.concat(drills);
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
