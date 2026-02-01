/**
 * Drill Page Initialization
 * 
 * Entry point for the drill practice page.
 */

(async function () {
    const drillId = DrillPage.getDrillFromURL(window.location.search);
    let sessionDrills = []; // Store all drills for navigation

    if (!drillId) {
        document.getElementById('drill-content').innerHTML = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <div class="error-message">No drill specified</div>
                <a href="#" onclick="window.close()">Return to Extension</a>
            </div>
        `;
        return;
    }

    // Session timer
    let seconds = 0;
    const timerEl = document.getElementById('session-time');
    setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        timerEl.textContent = `${mins}:${secs}`;
    }, 1000);

    /**
     * Navigate to the next drill in the session.
     * If no more drills, show completion screen.
     */
    function goToNextDrill(currentDrillId) {
        const currentIndex = sessionDrills.findIndex(d => d.id === currentDrillId);
        const nextDrill = sessionDrills[currentIndex + 1];

        if (nextDrill) {
            // Navigate to next drill (same tab)
            const nextUrl = DrillPage.getDrillPageURL(nextDrill.id);
            window.location.href = nextUrl;
        } else {
            // No more drills - show completion
            showCompletionScreen();
        }
    }

    /**
     * Show session completion screen.
     */
    function showCompletionScreen() {
        document.getElementById('drill-content').innerHTML = `
            <div class="completion-state" style="text-align: center; padding: 40px;">
                <div style="font-size: 48px; margin-bottom: 20px;">🎉</div>
                <div style="font-size: 24px; margin-bottom: 10px; color: var(--electric, #00ff88);">Session Complete!</div>
                <div style="opacity: 0.7; margin-bottom: 30px;">You've finished all drills in this session.</div>
                <button onclick="window.close()" class="btn-primary" style="padding: 12px 24px; font-size: 16px;">Close</button>
            </div>
        `;
        document.getElementById('drill-result').style.display = 'none';
    }

    // Load drill from storage
    try {
        const result = await chrome.storage.local.get('currentDrillSession');
        const session = result.currentDrillSession || {};
        sessionDrills = session.drills || [];

        let drill = null;

        // 1. Try to find requested drill in existing session
        if (drillId && sessionDrills.length > 0) {
            drill = sessionDrills.find(d => d.id === drillId);
        }

        // 2. If no drill found (invalid ID or empty session), handle fallback
        if (!drill) {
            // If we have a session but ID is invalid, default to first drill
            if (sessionDrills.length > 0) {
                console.warn(`Drill ID ${drillId} not found in session, resetting to first drill.`);
                drill = sessionDrills[0];
                // Update URL to match
                // window.history.replaceState(null, '', DrillPage.getDrillPageURL(drill.id));
            }
            // 3. If NO session exists at all, create Demo Session
            else {
                console.log('No active session found. Creating Demo Session.');
                // Demo drills for testing - use fixed IDs
                sessionDrills = [
                    {
                        id: 'demo1',
                        type: 'fill-in-blank',
                        content: 'def binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    while left <= right:\n        mid = (left + right) // ___\n        if arr[mid] == target:\n            return mid\n    return -1',
                        answer: '2',
                        skillId: 'binary_search',
                        difficulty: 'medium'
                    },
                    {
                        id: 'demo2',
                        type: 'spot-bug',
                        skillId: 'two_pointers',
                        content: 'def reverse_string(s):\n    left, right = 0, len(s)\n    while left < right:\n        s[left], s[right] = s[right], s[left]\n        left += 1\n        right -= 1\n    return s',
                        answer: 'Line 2: off-by-one: right should be len(s) - 1'
                    },
                    {
                        id: 'demo3',
                        type: 'muscle-memory',
                        skillId: 'sliding_window',
                        content: 'Write the sliding window template for finding max sum of k consecutive elements',
                        answer: 'window sum pattern'
                    }
                ];

                // Save new demo session
                await chrome.storage.local.set({
                    currentDrillSession: {
                        drills: sessionDrills,
                        currentDrill: sessionDrills[0],
                        startTime: Date.now()
                    }
                });

                // Set drill to first one
                drill = sessionDrills[0];
            }
        }

        // Render whatever we found or created
        renderDrill(drill);

    } catch (e) {
        console.error('Failed to load drill:', e);
        document.getElementById('drill-content').innerHTML = `
            <div class="error-state">
                <div class="error-icon">❌</div>
                <div class="error-message">Failed to load drill</div>
                <p>${e.message}</p>
            </div>
        `;
    }

    function renderDrill(drill) {
        const contentEl = document.getElementById('drill-content');
        const skillBadge = document.getElementById('current-skill');

        contentEl.innerHTML = DrillPage.renderDrillContent(drill);
        skillBadge.textContent = DrillPage.getSkillDisplayName(drill.skillId);

        // Update Progress
        const total = sessionDrills.length;
        const index = sessionDrills.findIndex(d => d.id === drill.id);
        const current = index + 1;

        const progressText = document.getElementById('drill-progress');
        const progressFill = document.getElementById('progress-fill');

        if (progressText) progressText.textContent = `Drill ${current} of ${total}`;
        if (progressFill) progressFill.style.width = `${(current / total) * 100}%`;

        // Spot-Bug Interactive Handler
        if (drill.type === 'spot-bug') {
            const tokens = contentEl.querySelectorAll('.code-token');
            const hiddenInput = document.getElementById('drill-answer');

            tokens.forEach(token => {
                token.addEventListener('click', (e) => {
                    // Remove active class from all tokens
                    tokens.forEach(t => t.classList.remove('selected'));

                    // Add to clicked
                    token.classList.add('selected');

                    // Find parent line for line number
                    const lineEl = token.closest('.code-line');
                    const lineNum = lineEl ? lineEl.dataset.line : null;

                    if (lineNum) {
                        // Set value to line number for compatibility with existing verification logic
                        hiddenInput.value = lineNum;
                    }

                    // Prevent propagation so we don't trigger any potential line click handlers
                    e.stopPropagation();
                });
            });
        }

        // Submit handler
        document.getElementById('btn-submit').onclick = async () => {
            const answer = DrillPage.getUserAnswer(drill.type);

            if (!answer.trim()) {
                alert('Please enter an answer');
                return;
            }

            // Verify answer
            let result;

            // For muscle-memory drills, use CodeGeneratorAgent for AI evaluation
            if (drill.type === 'muscle-memory' && typeof CodeGeneratorAgent !== 'undefined') {
                // Show processing indicator (Spinner)
                const submitBtn = document.getElementById('btn-submit');
                const originalText = submitBtn.textContent;

                // Disable button and show spinner in a modal/overlay style or inline
                submitBtn.disabled = true;

                // Create loading overlay
                const loadingOverlay = document.createElement('div');
                loadingOverlay.id = 'loading-overlay';
                loadingOverlay.style.cssText = `
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(10, 10, 15, 0.85);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                    border-radius: 16px;
                `;
                loadingOverlay.innerHTML = `
                    <div class="loading-spinner"></div>
                    <div class="loading-text">AI Evaluating Solution...</div>
                `;
                document.querySelector('.drill-container').style.position = 'relative';
                document.querySelector('.drill-container').appendChild(loadingOverlay);

                try {
                    // Parse input type
                    const inputInfo = typeof DrillInputHandler !== 'undefined'
                        ? DrillInputHandler.parseInput(answer)
                        : { type: 'pseudo-code', content: answer };

                    // Generate code from pseudo-code/natural language
                    const genResult = await CodeGeneratorAgent.generateCode(answer, {
                        skillId: drill.skillId,
                        drillType: drill.type,
                        inputType: inputInfo.type
                    });

                    loadingOverlay.remove(); // Remove loading state

                    if (genResult.success && genResult.code) {
                        // Run hallucination check if available
                        let hallucinationWarning = null;
                        if (typeof HallucinationChecker !== 'undefined') {
                            const halluCheck = await HallucinationChecker.check(answer, genResult.code, {
                                skillId: drill.skillId,
                                drillType: drill.type
                            });
                            if (halluCheck.isHallucination) {
                                hallucinationWarning = `⚠️ Warning: ${halluCheck.reason}`;
                            }
                        }

                        // AI successfully generated code
                        result = {
                            correct: !hallucinationWarning,  // Only correct if no hallucination detected
                            feedback: hallucinationWarning
                                ? `${hallucinationWarning}\n\n✨ Generated Code:\n\n${genResult.code}`
                                : `✨ AI Generated Code (Confidence: ${Math.round(genResult.confidence * 100)}%):\n\n${genResult.code}`,
                            generatedCode: genResult.code
                        };

                        // Send async notification if available
                        if (typeof AsyncNotifier !== 'undefined') {
                            AsyncNotifier.notify(drill.id, {
                                success: result.correct,
                                skillId: drill.skillId,
                                passedCount: result.correct ? 1 : 0,
                                totalCount: 1
                            });
                        }
                    } else {
                        // AI couldn't generate valid code
                        const errorMsg = genResult.error || 'Unknown error';

                        if (genResult.retryable) {
                            result = {
                                correct: false,
                                feedback: `⚠️ Evaluation Failed: ${errorMsg}\n\nThis seems to be a temporary issue.`,
                                retryable: true // Custom flag for UI
                            };
                        } else {
                            result = {
                                correct: false,
                                feedback: `⚠️ Could not evaluate: ${errorMsg}\n\nTry being more specific or use clearer pseudo-code.`
                            };
                        }
                    }
                } catch (e) {
                    console.error('[DrillInit] AI evaluation failed:', e);
                    if (document.getElementById('loading-overlay')) document.getElementById('loading-overlay').remove();

                    result = {
                        correct: false,
                        feedback: `AI evaluation error: ${e.message}`
                    };
                } finally {
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                }
            } else if (typeof DrillVerifier !== 'undefined' && DrillVerifier.verifyAnswer) {
                result = await DrillVerifier.verifyAnswer(drill, answer);
            } else {
                // Simple fallback
                result = {
                    correct: drill.answer && answer.toLowerCase().includes(drill.answer.toLowerCase()),
                    feedback: drill.answer ? `Expected: ${drill.answer}` : 'Answer recorded'
                };
            }

            // Show result
            document.getElementById('drill-content').style.display = 'none';
            const resultEl = document.getElementById('drill-result');
            resultEl.style.display = 'block';
            resultEl.style.display = 'block';
            resultEl.innerHTML = DrillPage.renderResult(result);

            // Add Retry Button if applicable
            if (result.retryable) {
                const actionsContainer = resultEl.querySelector('.result-actions');
                const retryBtn = document.createElement('button');
                retryBtn.className = 'btn-retry';
                retryBtn.textContent = '↻ Retry';
                retryBtn.onclick = () => {
                    document.getElementById('btn-submit').click();
                };
                actionsContainer.insertBefore(retryBtn, actionsContainer.firstChild);
            }

            // Track result (don't let tracking errors block navigation)
            try {
                if (typeof DrillTracker !== 'undefined' && DrillTracker.recordAttempt) {
                    await DrillTracker.recordAttempt(drill.id, {
                        correct: result.correct,
                        answer: answer,
                        timeSpent: seconds
                    });
                }
            } catch (e) {
                console.warn('[DrillInit] Tracking failed, continuing:', e.message);
            }

            // Wire buttons - navigate to next drill instead of closing
            document.getElementById('btn-next')?.addEventListener('click', () => {
                goToNextDrill(drill.id);
            });
            document.getElementById('btn-finish')?.addEventListener('click', () => {
                window.close();
            });
        };

        // Skip handler - navigate to next drill instead of closing
        document.getElementById('btn-skip')?.addEventListener('click', async () => {
            if (confirm('Skip this drill?')) {
                // Track skip (don't let tracking errors block navigation)
                try {
                    if (typeof DrillTracker !== 'undefined' && DrillTracker.recordAttempt) {
                        await DrillTracker.recordAttempt(drill.id, {
                            correct: false,
                            answer: '[SKIPPED]',
                            timeSpent: seconds,
                            skipped: true
                        });
                    }
                } catch (e) {
                    console.warn('[DrillInit] Skip tracking failed, continuing:', e.message);
                }
                goToNextDrill(drill.id);
            }
        });
    }
})();
