/**
 * Digest Orchestrator
 * 
 * Coordinates the nightly digest pipeline:
 * 1. Check if already run today
 * 2. Harvest today's submissions
 * 3. Send to Gemini for analysis
 * 4. Apply skill updates to Skill DNA
 * 5. Mark as completed
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        // Node.js (for testing)
        module.exports = factory();
    } else {
        // Browser
        root.DigestOrchestrator = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    // Import dependencies (handle both browser and Node.js)
    let DayLogHarvester, GeminiClient, SkillMatrix;

    if (typeof require !== 'undefined') {
        DayLogHarvester = require('./day_log_harvester');
        GeminiClient = require('./gemini_client');
        SkillMatrix = require('./skill_matrix').SkillMatrix;
    }

    /**
     * Check if digest has already run today.
     */
    async function hasRunToday() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
            const result = await chrome.storage.session.get('digestRanToday');
            const today = new Date().toISOString().split('T')[0];
            return result.digestRanToday === today;
        }
        return false;
    }

    /**
     * Mark digest as having run today.
     */
    async function markAsRunToday() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
            const today = new Date().toISOString().split('T')[0];
            await chrome.storage.session.set({ digestRanToday: today });
        }
    }

    /**
     * Apply skill updates from Gemini analysis to Skill DNA.
     */
    async function applySkillUpdates(updates) {
        const matrix = new SkillMatrix();
        await matrix.init();

        let applied = 0;
        let skipped = 0;

        for (const update of updates) {
            const skill = matrix.dna.skills[update.skillId];
            if (!skill) {
                console.warn(`[DigestOrchestrator] Unknown skill: ${update.skillId}`);
                skipped++;
                continue;
            }

            // Apply delta
            if (update.delta > 0) {
                // Positive delta = success
                for (let i = 0; i < Math.abs(update.delta) / 3; i++) {
                    await matrix.recordCorrect(update.skillId);
                }
            } else {
                // Negative delta = mistake
                for (let i = 0; i < Math.abs(update.delta) / 4; i++) {
                    await matrix.recordMistake(update.skillId);
                }
            }
            applied++;
        }

        // Take daily snapshot
        await matrix.takeSnapshot();

        return { applied, skipped };
    }

    /**
     * Generate a human-readable summary of the digest.
     */
    function generateDailySummary(result) {
        if (!result.success) {
            return `Digest failed: ${result.error}`;
        }

        let summary = `📊 Daily Digest Complete\n`;
        summary += `• Processed ${result.submissionsProcessed} submissions\n`;
        summary += `• Updated ${result.skillsUpdated} skills\n`;

        if (result.insights && result.insights.length > 0) {
            summary += `\n💡 Insights:\n`;
            for (const insight of result.insights) {
                summary += `  - ${insight}\n`;
            }
        }

        if (result.recommendedDrills && result.recommendedDrills.length > 0) {
            summary += `\n🎯 Recommended Drills:\n`;
            for (const drill of result.recommendedDrills) {
                summary += `  - ${drill.skillId} (${drill.type})\n`;
            }
        }

        return summary;
    }

    /**
     * Run the complete nightly digest pipeline.
     */
    async function runNightlyDigest() {
        console.log('[DigestOrchestrator] Starting nightly digest...');

        // Step 1: Check if already run
        if (await hasRunToday()) {
            console.log('[DigestOrchestrator] Digest already ran today, skipping.');
            return { skipped: true, reason: 'Digest already ran today' };
        }

        // Step 2: Harvest today's submissions
        const submissions = await DayLogHarvester.harvestToday();

        if (!submissions || submissions.length === 0) {
            console.log('[DigestOrchestrator] No submissions today, skipping.');
            await markAsRunToday(); // Still mark as run to avoid repeated checks
            return { skipped: true, reason: 'No submissions today' };
        }

        console.log(`[DigestOrchestrator] Harvested ${submissions.length} submissions.`);

        // Step 3: Format for Gemini
        const prompt = DayLogHarvester.formatForGemini(submissions);

        // Step 4: Analyze with Gemini
        const analysis = await GeminiClient.analyzeSubmissions(
            GeminiClient.buildAnalysisPrompt(prompt)
        );

        if (analysis.error) {
            console.error('[DigestOrchestrator] Gemini analysis failed:', analysis.error);
            return { success: false, error: analysis.error };
        }

        console.log('[DigestOrchestrator] Received analysis from Gemini.');

        // Step 5: Apply skill updates
        const updateResult = await applySkillUpdates(analysis.skillUpdates || []);

        // Step 6: Mark as completed
        await markAsRunToday();

        const result = {
            success: true,
            submissionsProcessed: submissions.length,
            skillsUpdated: updateResult.applied,
            insights: analysis.insights || [],
            recommendedDrills: analysis.recommendedDrills || [],
            timestamp: new Date().toISOString()
        };

        // Persist the result for user verification
        await chrome.storage.local.set({ lastDigestResult: result });

        console.log('[DigestOrchestrator] Digest complete:', result);
        return result;
    }

    return {
        runDigest: runNightlyDigest,
        runNightlyDigest,
        applySkillUpdates,
        generateDailySummary,
        hasRunToday,
        markAsRunToday
    };
}));
