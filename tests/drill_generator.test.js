/**
 * Drill Generator Tests (TDD)
 * 
 * Tests for generating personalized drills from weak skills.
 */

// Mock chrome APIs
global.chrome = {
    storage: {
        local: {
            get: jest.fn(() => Promise.resolve({ geminiApiKey: 'test-key' })),
            set: jest.fn(() => Promise.resolve())
        }
    }
};

jest.mock('../src/background/llm_gateway', () => ({
    analyzeSubmissions: jest.fn()
}));

// Setup fake IndexedDB
require('fake-indexeddb/auto');
const Dexie = require('dexie');
global.Dexie = Dexie;

describe('Drill Generator', () => {
    let DrillGenerator;
    let DrillStore;
    let LLMGateway;

    beforeAll(() => {
        DrillStore = require('../src/background/drill_store');
        DrillGenerator = require('../src/background/drill_generator');
        LLMGateway = require('../src/background/llm_gateway');
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        LLMGateway.analyzeSubmissions.mockReset();

        const store = new DrillStore.DrillStore();
        await store.init();
        await store.clear();
    });

    describe('generateDrillsForSkill', () => {
        it('should generate drills for a weak skill', async () => {
            LLMGateway.analyzeSubmissions.mockResolvedValueOnce({
                drills: [{
                    type: 'fill-in-blank',
                    content: 'In binary search, the condition should be left ___ right',
                    answer: '<=',
                    difficulty: 'easy'
                }]
            });

            const drills = await DrillGenerator.generateDrillsForSkill('binary_search_basic', {
                insight: 'Off-by-one errors in loop bounds',
                count: 1
            });

            expect(drills.length).toBe(1);
            expect(drills[0].type).toBe('fill-in-blank');
            expect(drills[0].skillId).toBe('binary_search_basic');
        });

        it('should handle multiple drill generation', async () => {
            LLMGateway.analyzeSubmissions.mockResolvedValueOnce({
                drills: [
                    { type: 'fill-in-blank', content: 'Q1', answer: 'A1', difficulty: 'easy' },
                    { type: 'spot-bug', content: 'Q2', answer: 'line 5', difficulty: 'medium' }
                ]
            });

            const drills = await DrillGenerator.generateDrillsForSkill('off_by_one', { count: 2 });

            expect(drills.length).toBe(2);
        });

        it('should handle API failure gracefully', async () => {
            LLMGateway.analyzeSubmissions.mockResolvedValueOnce({ error: 'HTTP 500' });

            const drills = await DrillGenerator.generateDrillsForSkill('bfs');

            expect(drills).toEqual([]);
        });
    });

    describe('buildGenerationPrompt', () => {
        it('should include skill context in prompt', () => {
            const prompt = DrillGenerator.buildGenerationPrompt('binary_search_basic', {
                insight: 'Often forgets to handle mid calculation overflow'
            });

            expect(prompt).toContain('binary_search_basic');
            expect(prompt).toContain('overflow');
        });

        it('should request specific drill types', () => {
            const prompt = DrillGenerator.buildGenerationPrompt('dfs', {
                types: ['fill-in-blank', 'spot-bug']
            });

            expect(prompt).toContain('fill-in-blank');
            expect(prompt).toContain('spot-bug');
        });

        it('should specify output format', () => {
            const prompt = DrillGenerator.buildGenerationPrompt('bfs');

            expect(prompt).toContain('drills');
            expect(prompt).toContain('type');
            expect(prompt).toContain('content');
            expect(prompt).toContain('answer');
        });
    });

    describe('validateDrill', () => {
        it('should accept valid drill structure', () => {
            const valid = {
                type: 'fill-in-blank',
                content: 'What is the time complexity of binary search?',
                answer: 'O(log n)',
                difficulty: 'easy'
            };

            expect(DrillGenerator.validateDrill(valid)).toBe(true);
        });

        it('should reject drill with missing fields', () => {
            const invalid = {
                type: 'fill-in-blank',
                content: 'Test question'
                // missing answer
            };

            expect(DrillGenerator.validateDrill(invalid)).toBe(false);
        });

        it('should reject invalid drill type', () => {
            const invalid = {
                type: 'invalid-type',
                content: 'Test',
                answer: 'Test'
            };

            expect(DrillGenerator.validateDrill(invalid)).toBe(false);
        });
    });

    describe('saveDrills', () => {
        it('should save generated drills to store', async () => {
            const drills = [
                { type: 'fill-in-blank', skillId: 'bfs', content: 'Q1', answer: 'A1' },
                { type: 'spot-bug', skillId: 'bfs', content: 'Q2', answer: 'A2' }
            ];

            await DrillGenerator.saveDrills(drills);

            const store = new DrillStore.DrillStore();
            await store.init();
            const all = await store.getAll();

            expect(all.length).toBe(2);
        });
    });

    describe('generateFromWeakSkills', () => {
        it('should generate drills for multiple weak skills', async () => {
            LLMGateway.analyzeSubmissions
                .mockResolvedValueOnce({
                    drills: [{ type: 'fill-in-blank', content: 'Q1', answer: 'A1', difficulty: 'easy' }]
                })
                .mockResolvedValueOnce({
                    drills: [{ type: 'spot-bug', content: 'Q2', answer: 'A2', difficulty: 'medium' }]
                });

            const weakSkills = [
                { skillId: 'binary_search_basic', confidence: 0.3 },
                { skillId: 'off_by_one', confidence: 0.4 }
            ];

            const result = await DrillGenerator.generateFromWeakSkills(weakSkills, {
                drillsPerSkill: 1,
                minTotalDrills: 2,
                skillAttempts: 1
            });

            // Result is now an array of drills, not { generated: N }
            expect(result.length).toBe(2);
        });

        it('should default to generating 3 drills per skill', async () => {
            LLMGateway.analyzeSubmissions.mockResolvedValueOnce({
                drills: [
                    { type: 'fill-in-blank', content: 'Q1', answer: 'A1', difficulty: 'easy' },
                    { type: 'spot-bug', content: 'Q2', answer: 'line 2', difficulty: 'easy' },
                    { type: 'critique', content: 'Q3', answer: null, difficulty: 'medium' }
                ]
            });

            const weakSkills = [{ skillId: 'binary_search_basic', confidence: 0.3 }];
            const result = await DrillGenerator.generateFromWeakSkills(weakSkills, {
                minTotalDrills: 3,
                skillAttempts: 1
            });

            expect(result.length).toBe(3);
            expect(LLMGateway.analyzeSubmissions).toHaveBeenCalled();
            const firstPrompt = LLMGateway.analyzeSubmissions.mock.calls[0][0];
            expect(firstPrompt).toContain('EXACTLY 3');
        });

        it('should backfill with template drills when model keeps failing', async () => {
            LLMGateway.analyzeSubmissions.mockResolvedValue({ error: 'Failed to parse JSON from response' });

            const weakSkills = [{ skillId: 'off_by_one', insight: 'boundary mistakes' }];
            const result = await DrillGenerator.generateFromWeakSkills(weakSkills, {
                drillsPerSkill: 3,
                minTotalDrills: 3,
                skillAttempts: 1
            });

            expect(result.length).toBe(3);
            expect(result.every(d => d.skillId === 'off_by_one')).toBe(true);
        });
    });
});
