// LeetCode SRS Master - Popup Script
// This script runs when you click the extension icon in the Chrome toolbar.
// It manages the little "Checkout" window (popup).

// Wait for the HTML of the popup to fully load before running code.
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Fetch data from storage and show the list of problems due for review.
    await updateDashboard();
    // 2. Enable the tab switching logic (Due vs All).
    setupTabs();
    // 3. Enable the buttons like "Manual Scan" and "Clear Data".
    setupManualTools();
    // 4. Enable Test Mode logic
    await setupTestMode();
});

// --- Tab Switching Logic ---
// We have two views: "Due" (what I need to study today) and "All" (mostly for history).
// This function makes the buttons toggle between these two views.
function setupTabs() {
    const btnDue = document.getElementById('stat-due');
    const btnAll = document.getElementById('stat-all');
    const sectionDue = document.getElementById('section-due');
    const sectionAll = document.getElementById('section-all');

    // When "Due" is clicked:
    btnDue.onclick = () => {
        // Highlight the "Due" button
        btnDue.classList.add('active');
        btnAll.classList.remove('active');
        // Show the Due section, hide the All section
        sectionDue.classList.add('active');
        sectionAll.classList.remove('active');
    };

    // When "All" is clicked:
    btnAll.onclick = () => {
        // Highlight the "All" button
        btnAll.classList.add('active');
        btnDue.classList.remove('active');
        // Show the All section, hide the Due section
        sectionAll.classList.add('active');
        sectionDue.classList.remove('active');
    };
}

// --- Manual Tools Logic ---
// These are the buttons at the bottom of the popup.
function setupManualTools() {
    // "Clear Data" button
    document.getElementById('debug-clear').onclick = async () => {
        if (confirm("Clear all SRS data? This cannot be undone.")) {
            // Wipe everything from Chrome's local storage
            await chrome.storage.local.clear();
            // Refresh the popup to show empty state
            location.reload();
        }
    };

    // "Manual Scan" button
    // This talks to the content script we looked at earlier.
    document.getElementById('manual-scan').onclick = async () => {
        // Get the tab that is currently open and active
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Check if the user is actually on LeetCode
        if (tab && tab.url.includes('leetcode.com')) {
            // Send a message to the content script asking it to "scanPage"
            chrome.tabs.sendMessage(tab.id, { action: "scanPage" }, (response) => {
                // Check if there was an error communicating (e.g. extension reloaded)
                if (chrome.runtime.lastError) {
                    alert("Could not connect to page. Refresh the LeetCode tab and try again.");
                } else if (response && response.success) {
                    // If scan found something, close this popup so user can see the Toast notification on page
                    window.close();
                } else {
                    // Scan finished but found nothing
                    alert("No 'Accepted' status found on the page currently.");
                }
            });
        } else {
            alert("Please open a LeetCode problem page first.");
        }
    };
}

// --- Test Mode Logic ---
let isTestMode = false;
let testDate = null;

async function setupTestMode() {
    const toggle = document.getElementById('test-mode-toggle');
    const dateInput = document.getElementById('test-mode-date');

    // Load saved state
    const storage = await chrome.storage.local.get({ testMode: false, testDate: null });
    isTestMode = storage.testMode;
    testDate = storage.testDate;

    // Set initial UI state
    toggle.checked = isTestMode;
    dateInput.value = testDate || new Date().toISOString().split('T')[0];
    dateInput.disabled = !isTestMode;

    // Toggle Change Listener
    toggle.onchange = async () => {
        isTestMode = toggle.checked;
        dateInput.disabled = !isTestMode;

        // If enabling and no date set, default to today
        if (isTestMode && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
            testDate = dateInput.value;
        }

        await chrome.storage.local.set({ testMode: isTestMode, testDate: dateInput.value });
        await updateDashboard();
    };

    // Date Change Listener
    dateInput.onchange = async () => {
        testDate = dateInput.value;
        await chrome.storage.local.set({ testDate: testDate });
        // Only refresh if test mode is actually on
        if (isTestMode) {
            await updateDashboard();
        }
    };
}

function getCurrentDate() {
    if (isTestMode && testDate) {
        // Return the test date but set to End of Day (23:59:59)
        // This ensures that problems due at any time on this date are considered "Due"
        // testDate is "YYYY-MM-DD"
        const [year, month, day] = testDate.split('-').map(Number);
        // Note: Month is 0-indexed in Date constructor
        return new Date(year, month - 1, day, 23, 59, 59);
    }
    return new Date();
}

// --- Dashboard Logic ---
// Reads the data and builds the UI.
async function updateDashboard() {
    // Fetch 'problems' object from storage
    const result = await chrome.storage.local.get({ problems: {} });
    // Convert object { "two-sum": {...}, "valid-anagram": {...} } into an array [ {...}, {...} ]
    const problems = Object.values(result.problems);



    const now = getCurrentDate();
    // Filter list: Which problems have a 'nextReviewDate' that is in the past (or now)?
    const dueProblems = problems.filter(p => new Date(p.nextReviewDate) <= now);

    // Sort Due Problems: Oldest due date first (Critical stuff top)
    dueProblems.sort((a, b) => new Date(a.nextReviewDate) - new Date(b.nextReviewDate));

    // Sort All Problems: Most recently solved first (History order)
    problems.sort((a, b) => {
        const lastA = a.history[a.history.length - 1]; // Get last item in history array
        const lastB = b.history[b.history.length - 1];
        return new Date(lastB.date) - new Date(lastA.date);
    });

    // Update the numbered badges (Current count)
    document.getElementById('due-count').innerText = dueProblems.length;
    document.getElementById('total-count').innerText = problems.length;

    // Actually create the HTML for the lists
    // 'true' means "interactive" (with Hard/Med/Easy buttons)
    renderList(dueProblems, 'list-due', true, 'due');
    // 'false' means "readonly" (just show info)
    renderList(problems, 'list-all', false, 'all');
}

// Helper to generate the HTML for a list of problems
function renderList(problemList, containerId, isInteractive, contextSuffix) {
    const container = document.getElementById(containerId);
    container.innerHTML = ''; // Clear previous content

    // Empty state check
    if (problemList.length === 0) {
        container.innerHTML = `<div class="empty-state">${isInteractive ? "No reviews due!" : "No problems tracked yet."}</div>`;
        return;
    }

    problemList.forEach(problem => {
        const nextReview = new Date(problem.nextReviewDate).toLocaleDateString();
        const interval = problem.interval;
        const uniqueId = `${problem.slug}-${contextSuffix}`;

        // Create a card div
        const card = document.createElement('div');
        // Add class 'readonly' if it's the history view (greyed out or simplified)
        card.className = `problem-card ${!isInteractive ? 'readonly' : ''}`;

        // Build the bottom part of the card (Buttons vs Info)
        let actionsHtml = '';
        if (isInteractive) {
            // If it's the Due list, show the rating buttons AND Calendar toggle
            actionsHtml = `
      <div class="card-actions">
        <button class="btn btn-hard" data-id="${problem.slug}" data-ease="1.3">Hard</button>
        <button class="btn btn-medium" data-id="${problem.slug}" data-ease="2.5">Med</button>
        <button class="btn btn-easy" data-id="${problem.slug}" data-ease="3.5">Easy</button>
        <button class="btn-calendar" data-id="${problem.slug}" title="Show 90-day projection">📅</button>
      </div>
      <div class="calendar-container" id="cal-${uniqueId}">
        <div class="calendar-header">
            <span>Projected Schedule (assuming Medium)</span>
        </div>
        <div class="calendar-grid" id="grid-${uniqueId}"></div>
      </div>`;
        } else {
            // If it's the All list, just show stats AND Calendar toggle
            actionsHtml = `
      <div class="problem-meta">
        <span>Interval: ${interval}d</span>
        <span>Review: ${nextReview}</span>
        <button class="btn-icon btn-calendar" data-id="${problem.slug}" title="Show 90-day projection" style="margin-left: auto;">📅</button>
      </div>
      <div class="calendar-container" id="cal-${uniqueId}">
        <div class="calendar-header">
            <span>Projected Schedule (assuming Medium)</span>
        </div>
        <div class="calendar-grid" id="grid-${uniqueId}"></div>
      </div>`;
        }

        // Fill the card's HTML
        card.innerHTML = `
      <div class="problem-info">
        <span class="problem-title" title="${problem.title}">${problem.title}</span>
        <span class="difficulty-badge ${problem.difficulty}">${problem.difficulty}</span>
      </div>
      ${actionsHtml}
    `;

        // Click title to open the problem in a new tab
        card.querySelector('.problem-title').onclick = () => {
            chrome.tabs.create({ url: `https://leetcode.com/problems/${problem.slug}/` });
        };

        // Click actions (Hard/Med/Easy) logic
        if (isInteractive) {
            // Rating Buttons
            card.querySelectorAll('.btn').forEach(btn => {
                if (btn.classList.contains('btn-calendar')) return; // Skip calendar btn
                btn.onclick = async (e) => {
                    e.stopPropagation(); // Don't trigger the card click
                    const slug = btn.getAttribute('data-id');
                    const ease = parseFloat(btn.getAttribute('data-ease'));
                    // Update the algorithm with new multiplier
                    await updateProblemSRS(slug, ease);
                };
            });
        }

        // Calendar Toggle (Global)
        const calBtn = card.querySelector('.btn-calendar');
        if (calBtn) {
            calBtn.onclick = (e) => {
                e.stopPropagation();
                const calContainer = card.querySelector(`#cal-${uniqueId}`);
                calContainer.classList.toggle('active');

                if (calContainer.classList.contains('active')) {
                    renderCalendar(problem, `grid-${uniqueId}`);
                }
            };
        }

        container.appendChild(card);
    });
}

function renderCalendar(problem, gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return; // Safety check
    grid.innerHTML = '';

    // Get projected dates
    const today = getCurrentDate(); // Use mock date if in test mode
    const projectedDates = projectSchedule(problem.interval, problem.repetition, problem.easeFactor, today);
    const dateSet = new Set(projectedDates); // For O(1) lookup

    // Generate ~90 days grid (simple view: just list days or mini boxes)
    const startDate = new Date(today);
    // Nearest past Sunday for proper grid alignment
    const calendarStart = new Date(startDate);
    calendarStart.setDate(startDate.getDate() - startDate.getDay());

    // Show 13 weeks (~91 days)
    for (let i = 0; i < 13 * 7; i++) {
        const dayDate = new Date(calendarStart);
        dayDate.setDate(calendarStart.getDate() + i);

        const dayStr = dayDate.toISOString().split('T')[0];
        const isToday = dayStr === today.toISOString().split('T')[0];
        const isDue = dateSet.has(dayStr);

        const cell = document.createElement('div');
        cell.className = `calendar-day ${isToday ? 'today' : ''} ${isDue ? 'due-future' : ''}`;
        cell.title = dayStr + (isDue ? " (Projected Review)" : "");

        // Show day number (hidden by CSS font-size:0, but usually helpful for debugging)
        cell.innerText = dayDate.getDate();

        grid.appendChild(cell);
    }
}

// Re-using the same math logic as content script (ideally this should be shared, but simple enough to copy)


// Function called when you click Hard/Med/Easy
async function updateProblemSRS(slug, ease) {
    const result = await chrome.storage.local.get({ problems: {} });
    const problems = result.problems;
    const p = problems[slug];

    if (!p) return;

    // Calculate next review based on the button clicked (ease)
    // Pass getCurrentDate() to handle Test Mode
    const nextStep = calculateNextReview(p.interval, p.repetition, ease, getCurrentDate());

    // Save update
    problems[slug] = {
        ...p,
        interval: nextStep.nextInterval,
        repetition: nextStep.nextRepetition,
        easeFactor: nextStep.nextEaseFactor,
        nextReviewDate: nextStep.nextReviewDate,
        // Log this review in history, using the (potentially mocked) current date
        history: [...p.history, { date: getCurrentDate().toISOString(), status: 'Reviewed' }]
    };

    await chrome.storage.local.set({ problems });
    // Re-render the dashboard to remove the item from the "Due" list
    await updateDashboard();
}
