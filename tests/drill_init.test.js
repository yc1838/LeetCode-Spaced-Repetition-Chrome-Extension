/**
 * Drill Page Initialization Tests (TDD)
 * 
 * Verifying navigation logic, especially Skip/Next functionality.
 */

const { JSDOM } = require('jsdom');

describe('Drill Init Logic', () => {
    let mockWindow, mockDocument;

    beforeEach(() => {
        const dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="drill-content"></div>
                <div id="session-time"></div>
                <div id="current-skill"></div>
                <div id="drill-progress"></div>
                <div id="progress-fill"></div>
                <div id="drill-result" style="display:none;"></div>
            </body>
            </html>
        `, {
            url: 'chrome-extension://abc123/src/drills/drills.html?drillId=drill1'
        });

        mockWindow = dom.window;
        mockDocument = mockWindow.document;

        // Mock global objects
        global.window = mockWindow;
        global.document = mockDocument;
        global.chrome = {
            storage: {
                local: {
                    get: jest.fn(),
                    set: jest.fn()
                }
            },
            runtime: {
                getURL: jest.fn(path => `chrome-extension://abc/${path}`)
            }
        };

        // Mock DrillPage helper
        global.DrillPage = {
            getDrillFromURL: jest.fn(() => 'drill1'),
            getDrillPageURL: jest.fn(id => `chrome-extension://abc/src/drills/drills.html?drillId=${id}`),
            getSkillDisplayName: jest.fn(id => id),
            renderDrillContent: jest.fn(() => '<button id="btn-skip">Skip</button>'),
            getUserAnswer: jest.fn(),
            renderResult: jest.fn()
        };

        // Mock DrillTracker
        global.DrillTracker = {
            recordAttempt: jest.fn().mockResolvedValue(true)
        };
    });

    test('Skip Button - should navigate to next drill URL', async () => {
        // Setup session with 2 drills
        const sessionDrills = [
            { id: 'drill1', type: 'fill-in-blank' },
            { id: 'drill2', type: 'fill-in-blank' }
        ];

        global.chrome.storage.local.get.mockResolvedValue({
            currentDrillSession: { drills: sessionDrills, currentDrill: sessionDrills[0] }
        });

        // Mock window.location assignment
        delete mockWindow.location;
        mockWindow.location = { search: '?drillId=drill1', href: '' };

        // Mock confirm to always return true for skip
        mockWindow.confirm = jest.fn(() => true);

        // Load script (we need to eval/require carefully or mock the logic)
        // Since logic is in an IIFE in drill_init.js, we can't easily require it directly in Jest without exporting.
        // For TDD, we'll extract the navigation logic to a testable class/module in the fix.
        // BUT FIRST, let's verify if we can spot the bug via logic inspection or a targeted test if we expose it.

        // Simulating the logic found in drill_init.js:
        const drillId = 'drill1';
        let currentIndex = sessionDrills.findIndex(d => d.id === drillId);
        let nextDrill = sessionDrills[currentIndex + 1];

        // The suspected bug:
        // In drill_init.js, goToNextDrill finds index from `sessionDrills`.
        // If sessionDrills is loaded from storage, it should work.
        // However, if the user skips multiple times, maybe the URL param update isn't enough?

        // Let's manually trigger the "Skip" logic as implemented in drill_init.js:
        // document.getElementById('btn-skip')?.addEventListener('click', ...)

        // PROBLEM: We can't run drill_init.js directly in Jest because it's an IIFE that runs immediately.
        // HYPOTHESIS: The bug is likely that `window.location.href` change doesn't reload the extension page state in a test environment,
        // but in real browser it does. 
        // WAIT, the user says "按 highlight 几下 skip 却右上角还是一直显示 1 out of 5". 
        // This implies the page IS NOT reloading or the state isn't updating.
        // If it's an SPA (Single Page App) navigation, we shouldn't use window.location.href = ...?
        // Ah, `window.location.href = nextUrl` causes a full page reload.

        // If the user says "press skip multiple times", it means the page might NOT be reloading, OR
        // it reloads but fails to read the NEW drillId from URL?
        // OR, `sessionDrills` is re-initialized every time from storage, but maybe storage isn't updated?

        // Let's try to repro logic:
        // 1. Load page ?drillId=drill1
        // 2. Load session from storage (drills: [1,2,3])
        // 3. Render drill 1
        // 4. Click skip -> goToNextDrill('drill1')
        // 5. Find index of drill1 -> 0
        // 6. Next is drill2
        // 7. window.location.href = ...?drillId=drill2

        // If the page reloads:
        // 1. Load page ?drillId=drill2
        // 2. Load session (drills: [1,2,3])
        // 3. Render drill 2.
        // 4. Index of drill2 -> 1.
        // 5. Progress: Drill 2 of 3.

        // User says: "Show 1 out of 5 drills".
        // This means it thinks it's still on Drill 1.
        // Maybe `getDrillFromURL` is failing or getting the OLD url?

        // Another possibility: `drill_init.js` logic for `currentDrillSession` storage loading.
        // Maybe it falls back to "Demo Drills" every time because it fails to match ID?

    });
});
