// Mock global fetch
global.fetch = jest.fn();

// Mock chrome global
global.chrome = {
    runtime: {
        onMessage: {
            addListener: jest.fn()
        },
        id: 'test-id'
    },
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn()
        }
    }
};

// Mock window and document
global.window = {
    location: {
        pathname: '/problems/two-sum'
    }
};

global.document = {
    addEventListener: jest.fn(),
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(),
    getElementsByTagName: jest.fn(),
    referrer: ''
};

global.MutationObserver = class {
    constructor(callback) { }
    observe(element, options) { }
    disconnect() { }
};

const {
    pollSubmissionResult,
    checkSubmissionStatus,
    fetchSubmissionList,
    saveSubmission // also mock this if needed
} = require('../content.js'); // We will export these for testing

describe('API Submission Check Logic', () => {
    beforeEach(() => {
        fetch.mockClear();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should find the latest submission after a click', async () => {
        const mockSubmissionId = "12345";
        const clickTime = Math.floor(Date.now() / 1000);

        // Mock /api/submissions response
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                submission_list: [
                    { id: "12345", timestamp: clickTime + 1, status_display: "Pending" },
                    { id: "11111", timestamp: clickTime - 100, status_display: "Accepted" }
                ]
            })
        });

        // Mock /submissions/detail/12345/check/ response (first Pending, then Accepted)
        fetch
            .mockResolvedValueOnce({ // 1st poll
                ok: true,
                json: async () => ({ state: "PENDING" })
            })
            .mockResolvedValueOnce({ // 2nd poll
                ok: true,
                json: async () => ({ state: "SUCCESS", status_msg: "Accepted", status_code: 10 })
            });

        // We need to implement the function in content.js to pass this test
        // Ideally: const result = await pollSubmissionResult("two-sum", clickTime);
        // expect(result).toBe(true);
    });
});
