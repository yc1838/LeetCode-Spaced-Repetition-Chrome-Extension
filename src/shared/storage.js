/**
 * LeetCode EasyRepeat - Storage Layer
 * 
 * Handles saving submission data to Chrome's local storage.
 * Orchestrates SRS/FSRS calculations and updates history.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        // Node.js
        module.exports = factory();
    } else {
        // Browser
        const exported = factory();
        for (const key in exported) {
            root[key] = exported[key];
        }
    }
}(typeof self !== 'undefined' ? self : this, function () {

    /**
     * Save a submission record to Chrome Storage.
     * 
     * @param {string} problemTitle - Title of the problem
     * @param {string} problemSlug  - Unique ID (slug)
     * @param {string} difficulty   - "Easy", "Medium", "Hard"
     * @param {string} difficultySource - Debug info about where difficulty came from
     * @param {number|null} rating  - User rating (1-4) or null for legacy SM-2
     * @param {Array<string>} topics - List of topic names (e.g. ["Array", "DP"])
     */
    async function saveSubmission(problemTitle, problemSlug, difficulty, difficultySource = 'unknown', rating = null, topics = []) {
        if (!chrome.runtime?.id) {
            console.warn("[LeetCode EasyRepeat] Extension context invalidated. Please refresh the page.");
            return;
        }
        console.log(`[LeetCode EasyRepeat] Handling submission for: ${problemTitle}`);

        let result;
        try {
            result = await chrome.storage.local.get({ problems: {} });
        } catch (err) {
            if (err.message.includes("Extension context invalidated")) {
                console.warn("[LeetCode EasyRepeat] Context invalidated during storage access. Please refresh.");
                return;
            }
            throw err;
        }
        const problems = result.problems;
        const now = new Date();
        const nowISO = now.toISOString();
        const problemKey = problemSlug;

        const isSameLocalDay = (d1, d2) => {
            return d1.getFullYear() === d2.getFullYear() &&
                d1.getMonth() === d2.getMonth() &&
                d1.getDate() === d2.getDate();
        };

        let isDuplicateDay = false;
        if (problems[problemKey] && problems[problemKey].lastSolved) {
            const lastSolvedVal = problems[problemKey].lastSolved;
            let lastSolvedDate;
            if (lastSolvedVal.length === 10) {
                lastSolvedDate = new Date(lastSolvedVal);
            } else {
                lastSolvedDate = new Date(lastSolvedVal);
            }
            if (isSameLocalDay(lastSolvedDate, now)) {
                isDuplicateDay = true;
            }
        }

        if (isDuplicateDay) {
            if (problems[problemKey].difficulty === difficulty) {
                console.log("[LeetCode EasyRepeat] Already logged today. Skipping storage update to prevent dups.");
                return { duplicate: true, problemTitle: problemTitle };
            }
            if (difficultySource === 'fallback' && problems[problemKey].difficulty) {
                console.log(`[LeetCode EasyRepeat] Difficulty mismatch (${problems[problemKey].difficulty} vs ${difficulty}), but new value is a fallback. Keeping stored value.`);
                difficulty = problems[problemKey].difficulty;
            } else {
                console.log(`[LeetCode EasyRepeat] Already logged today, but difficulty mismatch detected. Updating: ${problems[problemKey].difficulty} -> ${difficulty} (Source: ${difficultySource})`);
            }
        }

        const currentProblem = problems[problemKey] || {
            title: problemTitle,
            slug: problemSlug,
            difficulty: difficulty,
            interval: 0,
            repetition: 0,
            easeFactor: 2.5,
            easeFactor: 2.5,
            topics: topics || [],
            history: []
        };

        if (currentProblem.difficulty !== difficulty) {
            if (difficultySource === 'fallback' && currentProblem.difficulty) {
                console.log(`[LeetCode EasyRepeat] Keeping existing difficulty ${currentProblem.difficulty} instead of fallback ${difficulty}`);
                difficulty = currentProblem.difficulty;
            } else {
                console.log(`[LeetCode EasyRepeat] Correcting difficulty: ${currentProblem.difficulty} → ${difficulty} (Source: ${difficultySource})`);
            }
        }

        let nextStep;
        if (rating && typeof fsrs !== 'undefined') {
            console.log(`[LeetCode EasyRepeat] Using FSRS algorithm with rating: ${rating}`);

            const card = {
                state: currentProblem.fsrs_state || (currentProblem.repetition > 0 ? 'Review' : 'New'),
                stability: currentProblem.fsrs_stability || 0,
                difficulty: currentProblem.fsrs_difficulty || 0,
                last_review: currentProblem.fsrs_last_review ? new Date(currentProblem.fsrs_last_review) : null
            };

            let elapsed_days = 0;
            if (card.last_review) {
                const diffTime = Math.abs(now - card.last_review);
                elapsed_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }

            const fsrsResult = fsrs.calculateFSRS(card, rating, elapsed_days);

            nextStep = {
                nextInterval: fsrsResult.nextInterval,
                nextRepetition: currentProblem.repetition + 1,
                nextEaseFactor: currentProblem.easeFactor,
                nextReviewDate: (() => {
                    const date = new Date(now);
                    date.setDate(date.getDate() + fsrsResult.nextInterval);
                    return date.toISOString();
                })(),
                fsrs_stability: fsrsResult.newStability,
                fsrs_difficulty: fsrsResult.newDifficulty,
                fsrs_state: fsrsResult.nextState,
                fsrs_last_review: nowISO
            };

        } else {
            console.log(`[LeetCode EasyRepeat] Using Legacy SM-2 algorithm.`);
            // Ensure calculateNextReview is available globally
            const calcFn = typeof calculateNextReview !== 'undefined' ? calculateNextReview : (global.calculateNextReview || (() => { throw new Error("SRS Logic not found"); })());
            nextStep = calcFn(currentProblem.interval, currentProblem.repetition, currentProblem.easeFactor);
        }

        problems[problemKey] = {
            ...currentProblem,
            difficulty: difficulty,
            lastSolved: nowISO,
            interval: nextStep.nextInterval,
            repetition: nextStep.nextRepetition,
            easeFactor: nextStep.nextEaseFactor,
            nextReviewDate: nextStep.nextReviewDate,
            fsrs_stability: nextStep.fsrs_stability !== undefined ? nextStep.fsrs_stability : currentProblem.fsrs_stability,
            fsrs_difficulty: nextStep.fsrs_difficulty !== undefined ? nextStep.fsrs_difficulty : currentProblem.fsrs_difficulty,
            fsrs_state: nextStep.fsrs_state !== undefined ? nextStep.fsrs_state : currentProblem.fsrs_state,
            fsrs_last_review: nextStep.fsrs_last_review !== undefined ? nextStep.fsrs_last_review : currentProblem.fsrs_last_review,
            fsrs_state: nextStep.fsrs_state !== undefined ? nextStep.fsrs_state : currentProblem.fsrs_state,
            fsrs_last_review: nextStep.fsrs_last_review !== undefined ? nextStep.fsrs_last_review : currentProblem.fsrs_last_review,
            topics: (topics && topics.length > 0) ? topics : (currentProblem.topics || []),
            history: [...currentProblem.history, { date: nowISO, status: 'Accepted', rating: rating }]
        };

        await chrome.storage.local.set({ problems });
        console.log(`[LeetCode EasyRepeat] ✅ Saved to Chrome Storage!`);

        if (typeof showCompletionToast === 'function') {
            showCompletionToast(problemTitle, nextStep.nextReviewDate);
        } else if (typeof global !== 'undefined' && global.showCompletionToast) {
            global.showCompletionToast(problemTitle, nextStep.nextReviewDate);
        }

        return { success: true };
    }

    /**
     * Save notes for a specific problem.
     * @param {string} slug 
     * @param {string} notes 
     */
    async function saveNotes(slug, notes) {
        if (!slug) return;
        const result = await chrome.storage.local.get({ problems: {} });
        const problems = result.problems;

        if (!problems[slug]) {
            // Create a hollow entry if note is saved before any submission
            problems[slug] = {
                slug: slug,
                title: slug, // Fallback title
                difficulty: 'Medium', // Fallback difficulty
                notes: notes,
                history: []
            };
        } else {
            problems[slug].notes = notes;
        }

        await chrome.storage.local.set({ problems });
        console.log(`[LeetCode EasyRepeat] Notes saved for ${slug}`);
        return { success: true };
    }

    /**
     * Get notes for a specific problem.
     * @param {string} slug 
     * @returns {string} The notes content
     */
    async function getNotes(slug) {
        if (!slug) return '';
        const result = await chrome.storage.local.get({ problems: {} });
        return (result.problems[slug] && result.problems[slug].notes) || '';
    }

    return {
        saveSubmission,
        saveNotes,
        getNotes
    };
}));
