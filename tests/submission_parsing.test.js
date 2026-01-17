
/**
 * @jest-environment jsdom
 */

// Mock chrome global
global.chrome = {
    runtime: {
        id: 'mock-id',
        onMessage: { addListener: jest.fn() }
    },
    storage: {
        local: { get: jest.fn(), set: jest.fn() }
    }
};

describe('Submission Parsing Logic', () => {
    let verifyFreshness;

    // Mock Date to control "now"
    // Let's set "now" to 2026-01-16T22:45:00
    // The screenshot time is 22:42, so this is 3 minutes later -> Should be FRESH.
    const MOCK_NOW = new Date('2026-01-16T22:45:00');

    beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(MOCK_NOW);
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    beforeEach(() => {
        document.body.innerHTML = '';
        jest.resetModules();
        // We will need to verify if we can export this function or if we need to mock it
        // For now, let's assume we can test the logic by importing or pasting the helper.
        // Since content.js is not a module, we might need to simulate the function logic here 
        // OR modify content.js to export it for testing (using CommonJS check).

        // Setup: We'll inject the function directly into the test context if we can't import it easily
        // because content.js is designed as a script, not a module. 
        // However, looking at srs_logic.js, it uses UMD. content.js does not.
        // To properly test the function inside content.js, we should probably refactor content.js 
        // to be testable or copy the logic here. Given the constraints, I will 
        // implement the SAME logic here that I plan to put in content.js to verify it passes,
        // then I will paste it into content.js.

        // Actually, best practice: modifying content.js to export for tests is better.
        // But let's write the test assuming we can access `verifyLatestSubmissionFreshness`
        // We will add the export to content.js in the next step.
        const contentScript = require('../content.js');
        verifyFreshness = contentScript.verifyLatestSubmissionFreshness;
    });

    function createSubmissionRow(status, timeText) {
        // Create a structure mimicking LeetCode's submission table
        // Based on the screenshot, it looks like a standard table or div grid.
        // Usually it's an Ant Design table: .ant-table-tbody > tr

        const table = document.createElement('table');
        const tbody = document.createElement('tbody');
        tbody.className = 'ant-table-tbody';

        const tr = document.createElement('tr');

        // Status Column
        const statusTd = document.createElement('td');
        const statusSpan = document.createElement('span');
        // LeetCode uses classes like 'text-green-s' or specific text
        statusSpan.textContent = status;
        statusTd.appendChild(statusSpan);

        // Time Column - usually the second column or near it
        // In the screenshot: Status | Language | Runtime | Memory | Notes
        // The time is actually UNDER the status or near it?
        // Looking closely at screenshot:
        // Status column has: "Accepted" (green) AND "an hour ago" (gray text below it).
        // So they are likely in the SAME cell or adjacent blocks.

        const timeDiv = document.createElement('div');
        timeDiv.textContent = timeText; // e.g. "an hour ago"
        timeDiv.className = 'text-label-3'; // Common LC class for secondary text
        statusTd.appendChild(timeDiv); // Appending to same cell based on visual proximity

        tr.appendChild(statusTd);
        tbody.appendChild(tr);
        table.appendChild(tbody);

        // Also add a "Submissions" tab container to ensure we find the right context
        const container = document.createElement('div');
        container.appendChild(table);
        document.body.appendChild(container);
    }

    function createDetailView(status, dateStr) {
        // Simulation of the Detail View (from screenshot)
        const container = document.createElement('div');
        // "void cub submitted at Jan 16, 2026 22:42"
        container.textContent = `Accepted  11511 / 11511 testcases passed ... submitted at ${dateStr}`;
        // Add a class that might be common, or just body
        document.body.appendChild(container);
    }

    test('should return true for "Accepted" and "just now"', () => {
        createSubmissionRow("Accepted", "just now");
        expect(verifyFreshness()).toBe(true);
    });

    test('should return true for "Accepted" and "seconds ago"', () => {
        createSubmissionRow("Accepted", "10 seconds ago");
        expect(verifyFreshness()).toBe(true);
    });

    test('should return true for "Accepted" and "a few seconds ago"', () => {
        createSubmissionRow("Accepted", "a few seconds ago");
        expect(verifyFreshness()).toBe(true);
    });

    test('should return false for "Accepted" and "an hour ago"', () => {
        createSubmissionRow("Accepted", "an hour ago");
        expect(verifyFreshness()).toBe(false);
    });

    test('should return false for "Wrong Answer" even if "just now"', () => {
        createSubmissionRow("Wrong Answer", "just now");
        expect(verifyFreshness()).toBe(false);
    });

    test('should return true for absolute timestamp within 5 mins', () => {
        // Mock Now is 2026-01-16T22:45:00
        // Submission is 2026-01-16 22:42 (3 mins ago)
        createDetailView("Accepted", "Jan 16, 2026 22:42");
        expect(verifyFreshness()).toBe(true);
    });

    test('should return false for absolute timestamp older than 10 mins', () => {
        // Mock Now is 2026-01-16T22:45:00
        // Submission is 2026-01-16 22:30 (15 mins ago)
        createDetailView("Accepted", "Jan 16, 2026 22:30");
        expect(verifyFreshness()).toBe(false);
    });
});
