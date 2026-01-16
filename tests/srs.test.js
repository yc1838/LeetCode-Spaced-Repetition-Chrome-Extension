const { calculateNextReview, projectSchedule } = require('../srs_logic');

describe('SRS Logic Extended Coverage', () => {

    describe('calculateNextReview', () => {
        test('initial repetition (0 -> 1)', () => {
            const res = calculateNextReview(0, 0, 2.5);
            expect(res.nextInterval).toBe(1);
            expect(res.nextRepetition).toBe(1);
            expect(res.nextEaseFactor).toBe(2.5);
        });

        test('second repetition (1 -> 6)', () => {
            const res = calculateNextReview(1, 1, 2.5);
            expect(res.nextInterval).toBe(6);
            expect(res.nextRepetition).toBe(2);
        });

        test('third repetition uses ease factor (6 * 2.5 = 15)', () => {
            const res = calculateNextReview(6, 2, 2.5);
            expect(res.nextInterval).toBe(15);
            expect(res.nextRepetition).toBe(3);
        });

        test('rounding intervals (15 * 2.5 = 37.5 -> 38)', () => {
            const res = calculateNextReview(15, 3, 2.5);
            expect(res.nextInterval).toBe(38); // Math.round coverage
        });

        test('ease factor reduction handled by caller, logic just passes through', () => {
            // NOTE: The reduction logic is typically in the caller or specific algorithm variants.
            // srs_logic.js currently takes easeFactor as INPUT and returns it as nextEaseFactor unchanged
            // unless we modify the function to calculate dynamic ease.
            // Looking at the code: "nextEaseFactor: easeFactor"
            // So this test confirms it preserves the factor passed in.
            const res = calculateNextReview(10, 2, 1.3);
            expect(res.nextEaseFactor).toBe(1.3);
            expect(res.nextInterval).toBe(13); // 10 * 1.3 = 13
        });

        test('handles currentDate override correctly', () => {
            const mockDate = "2025-12-25T12:00:00.000Z";
            const res = calculateNextReview(0, 0, 2.5, mockDate);

            const nextDate = new Date(res.nextReviewDate);
            const baseDate = new Date(mockDate);

            // Should be 1 day ahead
            const diffTime = Math.abs(nextDate - baseDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            expect(diffDays).toBe(1);
        });

        test('handles leap years in date calculation', () => {
            // Feb 28 2024 is a leap year. +1 day should be Feb 29.
            const mockDate = "2024-02-28T12:00:00.000Z";
            const res = calculateNextReview(0, 0, 2.5, mockDate);
            const nextDate = new Date(res.nextReviewDate);
            expect(nextDate.toISOString().startsWith("2024-02-29")).toBe(true);
        });
    });

    describe('projectSchedule', () => {
        test('returns array of dates', () => {
            const schedule = projectSchedule(0, 0, 2.5);
            expect(Array.isArray(schedule)).toBe(true);
            expect(schedule.length).toBeGreaterThan(0);
        });

        test('caps projection at ~90 days', () => {
            const mockDate = "2023-01-01";
            const schedule = projectSchedule(0, 0, 2.5, mockDate);

            const lastReview = new Date(schedule[schedule.length - 1]);
            const start = new Date(mockDate);
            const diffDays = (lastReview - start) / (1000 * 3600 * 24);

            expect(diffDays).toBeLessThanOrEqual(120); // Allow some buffer but ensuring loop terminates
        });

        test('handles long intervals immediately', () => {
            // If interval is already 100 days, next review is > 90 days. Schedule should be empty.
            const schedule = projectSchedule(100, 5, 2.5, "2023-01-01");
            expect(schedule.length).toBe(0);
        });

        test('handles intervals that project within 90 days', () => {
            // Interval 30 days. Ease 2.5. Next interval 30 * 2.5 = 75 days.
            // 75 < 90, so it should appear.
            // The one after that (75*2.5 = 187) will handle outside.
            const schedule = projectSchedule(30, 5, 2.5, "2023-01-01");
            expect(schedule.length).toBe(1);
        });

        test('handles custom start date correctly', () => {
            const mockDate = "2030-01-01T00:00:00.000Z";
            const schedule = projectSchedule(0, 0, 2.5, mockDate);
            expect(schedule[0]).toBe("2030-01-02");
        });

        test('projects correctly with low ease factor', () => {
            // Interval growth is slower
            const schedule = projectSchedule(0, 0, 1.3, "2023-01-01");
            // 1, 6, 8, 10, 13...
            expect(schedule).toContain("2023-01-02");
            expect(schedule).toContain("2023-01-08"); // 1+1+6
        });
    });
});
