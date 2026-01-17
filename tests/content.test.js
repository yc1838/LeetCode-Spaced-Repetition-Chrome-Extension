/**
 * checkForAcceptedState() Tests
 * 
 * This file tests the core "Accepted" detection logic in content.js.
 * 
 * THE FUNCTION BEING TESTED:
 * checkForAcceptedState() scans the DOM to detect if a LeetCode submission
 * was successful. It looks for:
 * 1. Specific data attributes (e.g., data-e2e-locator="submission-result-accepted")
 * 2. CSS classes containing "green" (e.g., .text-green-s)
 * 3. Any span with "Accepted" text that has a green computed color
 * 
 * @jest-environment jsdom
 */

/**
 * MOCKING CHROME APIs
 * Chrome extension APIs don't exist in jsdom, so we create fake versions.
 */
global.chrome = {
    runtime: {
        id: 'mock-id',
        onMessage: {
            addListener: jest.fn()
        }
    },
    storage: {
        local: {
            get: jest.fn().mockResolvedValue({ problems: {} }),
            set: jest.fn().mockResolvedValue(undefined)
        }
    }
};

/**
 * MOCKING MutationObserver
 * content.js uses MutationObserver to watch for DOM changes.
 * We provide a minimal mock that does nothing.
 */
global.MutationObserver = class {
    constructor(callback) { }
    observe(element, options) { }
    disconnect() { }
};

/**
 * MOCKING calculateNextReview
 * content.js calls saveSubmission() which depends on calculateNextReview from srs_logic.js.
 * In the browser, this is loaded via manifest.json, but in tests we need to mock it.
 */
global.calculateNextReview = jest.fn().mockReturnValue({
    nextInterval: 1,
    nextRepetition: 1,
    nextEaseFactor: 2.5,
    nextReviewDate: '2025-01-01'
});

describe('checkForAcceptedState', () => {
    let checkForAcceptedState;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';

        // Mock window.location
        Object.defineProperty(window, 'location', {
            value: { pathname: '/problems/two-sum/' },
            writable: true
        });

        // Reset module cache so each test gets fresh state
        jest.resetModules();

        // Import fresh copy of the module
        const contentScript = require('../content.js');
        checkForAcceptedState = contentScript.checkForAcceptedState;
    });

    // Helper to create the submission table required for freshness check
    function setupFreshSubmissionTable() {
        const table = document.createElement('table');
        const tbody = document.createElement('tbody');
        tbody.className = 'ant-table-tbody';
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        // We need text that passes the verifyLatestSubmissionFreshness check
        td.textContent = "Accepted just now";
        tr.appendChild(td);
        tbody.appendChild(tr);
        table.appendChild(tbody);
        document.body.appendChild(table);
    }

    /**
     * TEST: No Accepted element exists
     * When there's no success indicator on the page, should return false.
     */
    test('returns false when no Accepted element exists', () => {
        // DOM is empty - no Accepted text anywhere
        const result = checkForAcceptedState();
        expect(result).toBe(false);
    });

    /**
     * TEST: Detection via data-e2e-locator attribute
     * LeetCode uses data attributes for E2E testing - this is the most reliable selector.
     */
    test('returns true when data-e2e-locator="submission-result-accepted" exists', () => {
        const acceptedEl = document.createElement('div');
        acceptedEl.setAttribute('data-e2e-locator', 'submission-result-accepted');
        acceptedEl.innerText = 'Accepted';
        acceptedEl.innerText = 'Accepted';
        document.body.appendChild(acceptedEl);
        setupFreshSubmissionTable(); // Add required table

        const result = checkForAcceptedState();
        expect(result).toBe(true);
    });

    /**
     * TEST: Detection via .text-green-s class
     * LeetCode often uses Tailwind-style classes for success states.
     */
    test('returns true when .text-green-s element contains Accepted', () => {
        const acceptedEl = document.createElement('span');
        acceptedEl.className = 'text-green-s';
        acceptedEl.innerText = 'Accepted';
        acceptedEl.innerText = 'Accepted';
        document.body.appendChild(acceptedEl);
        setupFreshSubmissionTable();

        const result = checkForAcceptedState();
        expect(result).toBe(true);
    });

    /**
     * TEST: Detection via .text-success class
     * Another common class for success states.
     */
    test('returns true when .text-success element contains Accepted', () => {
        const acceptedEl = document.createElement('div');
        acceptedEl.className = 'text-success';
        acceptedEl.innerText = 'Accepted';
        acceptedEl.innerText = 'Accepted';
        document.body.appendChild(acceptedEl);
        setupFreshSubmissionTable();

        const result = checkForAcceptedState();
        expect(result).toBe(true);
    });

    /**
     * TEST: Detection via class containing "text-green"
     * Catch-all for Tailwind-style green classes like text-green-500.
     */
    test('returns true when element has class containing text-green', () => {
        const acceptedEl = document.createElement('span');
        acceptedEl.className = 'some-class text-green-500 another-class';
        acceptedEl.innerText = 'Accepted';
        acceptedEl.innerText = 'Accepted';
        document.body.appendChild(acceptedEl);
        setupFreshSubmissionTable();

        const result = checkForAcceptedState();
        expect(result).toBe(true);
    });

    /**
     * TEST: "Accepted" text exists but NOT with known green class
     * This tests the fallback color detection via getComputedStyle.
     * 
     * NOTE: jsdom's getComputedStyle returns empty strings for most styles,
     * so this tests that we correctly return false when color can't be verified.
     */
    test('returns false when Accepted text exists but has no green indicators', () => {
        const acceptedEl = document.createElement('span');
        acceptedEl.className = 'random-class';
        acceptedEl.innerText = 'Accepted';
        document.body.appendChild(acceptedEl);

        const result = checkForAcceptedState();
        // Should be false because there's no green class and jsdom can't compute green color
        expect(result).toBe(false);
    });

    /**
     * TEST: "Accepted" appears in text but not as exact match
     * Should not trigger on partial matches like "Not Accepted Yet"
     */
    test('returns true when Accepted is substring (includes check)', () => {
        // The function uses .includes('Accepted'), so this WILL match
        const el = document.createElement('div');
        el.setAttribute('data-e2e-locator', 'submission-result-accepted');
        el.innerText = 'Solution Accepted Successfully';
        el.innerText = 'Solution Accepted Successfully';
        document.body.appendChild(el);
        setupFreshSubmissionTable();

        const result = checkForAcceptedState();
        expect(result).toBe(true);
    });

    /**
     * TEST: Wrong kind of "Accepted" - like in a table header
     * Elements with "Accepted" text but no green styling should not match
     * (unless they have a known class)
     */
    test('ignores non-green Accepted text', () => {
        // A table header that says "Accepted" but isn't green
        const headerEl = document.createElement('th');
        headerEl.innerText = 'Accepted';
        document.body.appendChild(headerEl);

        const result = checkForAcceptedState();
        expect(result).toBe(false);
    });
});
