/**
 * @jest-environment jsdom
 */

// Mock chrome API
global.chrome = {
    runtime: {
        id: 'mock-id',
        onMessage: {
            addListener: jest.fn()
        }
    },
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn()
        }
    }
};

// Mock MutationObserver
global.MutationObserver = class {
    constructor(callback) { }
    observe(element, options) { }
    disconnect() { }
};

describe('DOM Extraction Logic', () => {
    let extractProblemDetails;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        Object.defineProperty(window, 'location', {
            value: {
                pathname: '/problems/two-sum/'
            },
            writable: true
        });

        // Reset Modules to clear cachedDifficulty in content.js
        jest.resetModules();
        const contentScript = require('../content.js');
        extractProblemDetails = contentScript.extractProblemDetails;
    });

    test('should extract problem slug from URL', () => {
        const details = extractProblemDetails();
        expect(details.slug).toBe('two-sum');
    });

    test('should extract title from page element', () => {
        const titleEl = document.createElement('span');
        titleEl.className = 'text-lg font-medium text-label-1';
        titleEl.innerText = '1. Two Sum';
        document.body.appendChild(titleEl);

        const details = extractProblemDetails();
        expect(details.title).toBe('1. Two Sum');
    });

    test('should fallback title from slug if element missing', () => {
        const details = extractProblemDetails();
        expect(details.title).toBe('two sum'); // spaces replaced
    });

    test('should extract difficulty', () => {
        const diffEl = document.createElement('div');
        diffEl.className = 'text-difficulty-easy';
        diffEl.innerText = 'Easy';
        document.body.appendChild(diffEl);

        const details = extractProblemDetails();
        expect(details.difficulty).toBe('Easy');
    });

    test('should extract difficulty with leading/trailing whitespace', () => {
        const diffEl = document.createElement('div');
        diffEl.className = 'text-difficulty-easy';
        diffEl.innerText = '  Easy  '; // Whitespace edge case
        document.body.appendChild(diffEl);

        const details = extractProblemDetails();
        expect(details.difficulty).toBe('Easy');
    });

    test('should extract difficulty with newlines', () => {
        const diffEl = document.createElement('div');
        diffEl.className = 'text-difficulty-medium';
        diffEl.innerText = '\nMedium\n'; // Newline edge case
        document.body.appendChild(diffEl);

        const details = extractProblemDetails();
        expect(details.difficulty).toBe('Medium');
    });

    test('should extract Hard difficulty', () => {
        const diffEl = document.createElement('div');
        diffEl.className = 'text-difficulty-hard';
        diffEl.innerText = 'Hard';
        document.body.appendChild(diffEl);

        const details = extractProblemDetails();
        expect(details.difficulty).toBe('Hard');
    });

    test('should default difficulty to Medium if not found', () => {
        const details = extractProblemDetails();
        expect(details.difficulty).toBe('Medium');
    });

    test('should default difficulty to Medium if element has unexpected text', () => {
        const diffEl = document.createElement('div');
        diffEl.className = 'text-difficulty-unknown';
        diffEl.innerText = 'Unknown'; // Not Easy/Medium/Hard
        document.body.appendChild(diffEl);

        const details = extractProblemDetails();
        expect(details.difficulty).toBe('Medium');
    });
});
