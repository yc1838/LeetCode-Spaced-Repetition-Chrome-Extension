/**
 * LeetCode EasyRepeat - API Interaction Layer
 * 
 * Handles interaction with LeetCode's internal APIs to check submission status.
 * This bypasses DOM scraping for more reliable "Accepted" detection.
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

    const API_BASE = '/api/submissions';
    const SUBMISSION_CHECK_BASE = '/submissions/detail';

    const getDep = (name) => {
        if (typeof global !== 'undefined' && global[name]) return global[name];
        if (typeof window !== 'undefined' && window[name]) return window[name];
        return undefined;
    };

    /**
     * Fetch question details (difficulty) directly from LeetCode GraphQL API.
     * This is the source of truth, bypassing DOM issues.
     * @param {string} slug 
     */
    async function fetchQuestionDetails(slug) {
        try {
            const query = `
                query questionTitle($titleSlug: String!) {
                  question(titleSlug: $titleSlug) {
                    difficulty
                    title
                    questionFrontendId
                  }
                }
            `;

            const response = await fetch('/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrftoken': document.cookie.match(/csrftoken=([^;]+)/)?.[1] || ''
                },
                body: JSON.stringify({
                    query: query,
                    variables: { titleSlug: slug }
                })
            });

            if (!response.ok) throw new Error("GraphQL request failed");

            const data = await response.json();
            if (data.data && data.data.question) {
                const q = data.data.question;
                console.log(`[LeetCode EasyRepeat] Fetched details from API: ${q.title} (${q.difficulty})`);
                return {
                    difficulty: q.difficulty,
                    title: q.title,
                    questionId: q.questionFrontendId
                };
            }
            return null;
        } catch (e) {
            console.warn("[LeetCode EasyRepeat] Error fetching question details via API:", e);
            return null;
        }
    }

    /**
     * Check the latest submission via API for the manual "Scan Now" feature.
     * 
     * @param {string} slug - The problem slug (e.g. "two-sum")
     * @returns {Promise<Object>} The result object for the popup
     */
    async function checkLatestSubmissionViaApi(slug) {
        try {
            // 1. Get recent submissions
            const response = await fetch(`${API_BASE}/${slug}/?offset=0&limit=1`);
            if (!response.ok) throw new Error("API request failed");

            const data = await response.json();
            const submissions = data.submission_list || data.submissions_dump;
            const latestInfo = submissions && submissions[0];

            if (!latestInfo) {
                return { success: false, error: "No submissions found." };
            }

            // 2. Check if it is Accepted
            if (latestInfo.status_display === "Accepted") {
                const extractProblemDetails = getDep('extractProblemDetails');
                const showRatingModal = getDep('showRatingModal');
                const saveSubmission = getDep('saveSubmission');

                if (!extractProblemDetails || !showRatingModal || !saveSubmission) {
                    console.error("[LeetCode EasyRepeat] Missing dependencies for manual scan.");
                    return { success: false, error: "Internal Error: Missing dependencies" };
                }

                const details = extractProblemDetails();

                // Enhance details with reliable API difficulty
                // Enhance details with reliable API data
                const apiData = await fetchQuestionDetails(slug);
                if (apiData) {
                    details.difficulty = apiData.difficulty;
                    // details.slug is already correct (input arg)
                    // Construct standard title "1. Two Sum"
                    if (apiData.title && apiData.questionId) {
                        details.title = `${apiData.questionId}. ${apiData.title}`;
                    }
                }

                // Prompt for rating manually too? Yes.
                const rating = await showRatingModal(details.title);
                const result = await saveSubmission(details.title, details.slug, details.difficulty, 'manual_api_scan', rating);
                return result || { success: true };
            }

            return { success: false, error: `Latest submission is ${latestInfo.status_display}`, status: latestInfo.status_display };

        } catch (e) {
            console.error("[LeetCode EasyRepeat] API check failed:", e);
            return { success: false, error: e.message };
        }
    }

    /**
     * Poll the LeetCode API to find the result of the submission.
     */
    async function pollSubmissionResult(slug, clickTime, title, difficulty) {
        try {
            console.log(`[LeetCode EasyRepeat] [LEETCODE-DEBUG] Polling for ${slug} since ${clickTime}`);
            let attempts = 0;
            // const maxAttempts = 20; // Unused

            // Step 1: Find the Submission ID
            let submissionId = null;

            const findSubmission = async () => {
                try {
                    const response = await fetch(`${API_BASE}/${slug}/?offset=0&limit=5`);
                    if (!response.ok) {
                        console.warn(`[LeetCode EasyRepeat] [LEETCODE-DEBUG] API error: ${response.status} ${response.statusText}`);
                        return null;
                    }
                    const data = await response.json();

                    const submissions = data.submission_list || data.submissions_dump;

                    if (!submissions) {
                        console.warn("[LeetCode EasyRepeat] [LEETCODE-DEBUG] Unexpected API response format (missing list):", JSON.stringify(data).substring(0, 200));
                        return null; // Retry
                    }

                    // Look for a submission that happened AFTER our click (with 5s buffer for clock skew)
                    const match = submissions.find(sub =>
                        sub.timestamp >= (clickTime - 5) &&
                        sub.status_display !== "Internal Error"
                    );

                    return match ? match.id : null;
                } catch (e) {
                    console.warn("[LeetCode EasyRepeat] [LEETCODE-DEBUG] Error fetching submission list:", e);
                    return null;
                }
            };

            // Retry loop to find the ID
            while (!submissionId && attempts < 10) {
                submissionId = await findSubmission();
                if (!submissionId) {
                    console.log(`[LeetCode EasyRepeat] [LEETCODE-DEBUG] Submission list check ${attempts + 1}/10...`);
                    attempts++;
                    await new Promise(r => setTimeout(r, 2000)); // Wait 2s
                }
            }

            if (!submissionId) {
                console.log("[LeetCode EasyRepeat] [LEETCODE-DEBUG] Timed out waiting for submission to appear in list.");
                return;
            }

            console.log(`[LeetCode EasyRepeat] [LEETCODE-DEBUG] Found submission ID: ${submissionId}. Polling status...`);

            // Step 2: Poll for Result (Accepted/Wrong Answer)
            await checkSubmissionStatus(submissionId, title, slug, difficulty);
        } catch (e) {
            console.error("[LeetCode EasyRepeat] [LEETCODE-DEBUG] Critical error in pollSubmissionResult:", e);
        }
    }

    /**
     * Check status of a specific submission ID until it finishes processing.
     */
    async function checkSubmissionStatus(submissionId, title, slug, difficulty) {
        let checks = 0;
        while (checks < 20) {
            try {
                const res = await fetch(`${SUBMISSION_CHECK_BASE}/${submissionId}/check/`);
                if (!res.ok) throw new Error("Check API failed");

                const data = await res.json();
                // data.state could be "PENDING", "STARTED", "SUCCESS"

                if (data.state === "SUCCESS") {
                    // DONE! Check if Accepted
                    if (data.status_code === 10 || data.status_msg === "Accepted") {
                        console.log(`[LeetCode EasyRepeat] Submission ${submissionId} ACCEPTED!`);

                        const showRatingModal = getDep('showRatingModal');
                        const saveSubmission = getDep('saveSubmission');

                        if (showRatingModal && saveSubmission) {
                            // Fetch authoritative data
                            const apiData = await fetchQuestionDetails(slug);

                            const finalDifficulty = apiData ? apiData.difficulty : difficulty;
                            let finalTitle = title;

                            if (apiData && apiData.title && apiData.questionId) {
                                finalTitle = `${apiData.questionId}. ${apiData.title}`;
                            }

                            const rating = await showRatingModal(finalTitle);
                            await saveSubmission(finalTitle, slug, finalDifficulty, 'api_poll', rating);
                            return true;
                        } else {
                            console.warn("[LeetCode EasyRepeat] Dependencies missing. Cannot save.");
                            return false;
                        }
                    } else {
                        console.log(`[LeetCode EasyRepeat] Submission ${submissionId} finished but NOT Accepted (${data.status_msg}).`);
                        return false;
                    }
                }

                // Still Pending
                checks++;
                await new Promise(r => setTimeout(r, 1000)); // Wait 1s

            } catch (e) {
                console.warn("[LeetCode EasyRepeat] Error polling check API:", e);
                checks++;
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        console.log("[LeetCode EasyRepeat] Timed out polling submission status.");
        return false;
    }

    /**
     * Monitor for clicks on the Submit button to trigger API polling.
     */
    function monitorSubmissionClicks() {
        if (typeof document === 'undefined') return;

        document.addEventListener('click', (e) => {
            try {
                const btn = e.target.closest('[data-e2e-locator="console-submit-button"]');
                if (btn) {
                    console.log('[LeetCode EasyRepeat] [LEETCODE-DEBUG] Submit button clicked. Starting API poll...');
                    const clickTime = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

                    const getCurrentProblemSlug = getDep('getCurrentProblemSlug');
                    const extractProblemDetails = getDep('extractProblemDetails');

                    if (getCurrentProblemSlug) {
                        const slug = getCurrentProblemSlug();
                        if (slug) {
                            if (extractProblemDetails) {
                                const details = extractProblemDetails();
                                pollSubmissionResult(slug, clickTime, details.title, details.difficulty)
                                    .catch(err => console.error("[LeetCode EasyRepeat] [LEETCODE-DEBUG] Polling failed:", err));
                            } else {
                                console.warn("[LeetCode EasyRepeat] extractProblemDetails not found.");
                            }
                        } else {
                            console.warn("[LeetCode EasyRepeat] [LEETCODE-DEBUG] Could not determine slug on click.");
                        }
                    } else {
                        console.warn("[LeetCode EasyRepeat] getCurrentProblemSlug not found.");
                    }
                }
            } catch (err) {
                console.error("[LeetCode EasyRepeat] [LEETCODE-DEBUG] Error in click listener:", err);
            }
        });
    }

    return {
        checkLatestSubmissionViaApi,
        pollSubmissionResult,
        checkSubmissionStatus,
        monitorSubmissionClicks,
        fetchQuestionDetails
    };
}));
