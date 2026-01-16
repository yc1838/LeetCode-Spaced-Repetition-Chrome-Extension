const { calculateNextReview } = require('../srs_logic');

describe('SRS Logic - calculateNextReview', () => {
    test('should return interval 1 for first repetition (repetition 0)', () => {
        const result = calculateNextReview(0, 0, 2.5);
        expect(result.nextInterval).toBe(1);
        expect(result.nextRepetition).toBe(1);
        expect(result.nextEaseFactor).toBe(2.5);
    });

    test('should return interval 6 for second repetition (repetition 1)', () => {
        const result = calculateNextReview(1, 1, 2.5);
        expect(result.nextInterval).toBe(6);
        expect(result.nextRepetition).toBe(2);
    });

    test('should multiply interval by easeFactor for subsequent repetitions', () => {
        const result = calculateNextReview(6, 2, 2.5);
        // 6 * 2.5 = 15
        expect(result.nextInterval).toBe(15);
        expect(result.nextRepetition).toBe(3);
    });

    test('should handle floating point intervals correctly (rounding)', () => {
        // 15 * 2.5 = 37.5 -> round to 38
        const result = calculateNextReview(15, 3, 2.5);
        expect(result.nextInterval).toBe(38);
    });

    test('should calculate correct nextReviewDate', () => {
        const result = calculateNextReview(0, 0, 2.5);
        const now = new Date();
        const reviewDate = new Date(result.nextReviewDate);

        // Should be approximately tomorrow
        const diffInHours = (reviewDate - now) / (1000 * 60 * 60);
        expect(diffInHours).toBeCloseTo(24, 0.1);
    });
});
