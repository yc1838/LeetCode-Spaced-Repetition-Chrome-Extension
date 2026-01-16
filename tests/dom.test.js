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

const contentScript = require('../content.js');
const { extractProblemDetails } = contentScript;

describe('DOM Extraction Logic', () => {
    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        Object.defineProperty(window, 'location', {
            value: {
                pathname: '/problems/two-sum/'
            },
            writable: true
        });
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
        diffEl.setAttribute('data-difficulty', 'Easy');
        diffEl.innerText = 'Easy';
        document.body.appendChild(diffEl);

        const details = extractProblemDetails();
        expect(details.difficulty).toBe('Easy');
    });

    test('should default difficulty to Medium if not found', () => {
        const details = extractProblemDetails();
        expect(details.difficulty).toBe('Medium');
    });
});
