/**
 * @jest-environment jsdom
 */

const contentUI = require('../src/content/content_ui');

describe('Notes UI', () => {
    test('createNotesButton should return a button element with correct class', () => {
        const onClick = jest.fn();
        const btn = contentUI.createNotesButton('test-slug', onClick);

        expect(btn.tagName).toBe('BUTTON');
        expect(btn.className).toBe('lc-notes-btn');
        expect(btn.textContent).toContain('Notes');

        // Test click
        btn.click();
        expect(onClick).toHaveBeenCalled();
    });

    test('showNotesModal should inject modal into document body', () => {
        // Mock setTimeout to run immediately
        jest.useFakeTimers();

        const onSave = jest.fn();
        contentUI.showNotesModal('Test Problem', 'Initial Content', onSave);

        // Check if backdrop exists
        const backdrop = document.querySelector('.lc-notes-backdrop');
        expect(backdrop).not.toBeNull();

        // Check if modal exists
        const modal = document.querySelector('.lc-notes-modal');
        expect(modal).not.toBeNull();

        // Check title
        const title = modal.querySelector('.lc-notes-title');
        expect(title.textContent).toContain('Test Problem');

        // Check textarea content
        const textarea = modal.querySelector('textarea');
        expect(textarea.value).toBe('Initial Content');

        // Test Save
        textarea.value = 'Updated Content';
        const saveBtn = modal.querySelector('.lc-btn-save');
        saveBtn.click();

        expect(onSave).toHaveBeenCalledWith('Updated Content');

        // Modal should be removed after save
        expect(document.querySelector('.lc-notes-backdrop')).toBeNull();

        jest.useRealTimers();
    });

    describe('insertNotesButton', () => {
        let deps;

        beforeEach(() => {
            document.body.innerHTML = ''; // Reset DOM
            deps = {
                getCurrentProblemSlug: jest.fn(),
                getNotes: jest.fn(),
                saveNotes: jest.fn(),
                extractProblemDetails: jest.fn()
            };
        });

        test('should do nothing if dependencies missing', () => {
            contentUI.insertNotesButton({});
            expect(document.querySelector('.lc-notes-btn')).toBeNull();
        });

        test('should insert button if none exists', () => {
            deps.getCurrentProblemSlug.mockReturnValue('two-sum');
            contentUI.insertNotesButton(deps);

            const btn = document.querySelector('.lc-notes-btn');
            expect(btn).not.toBeNull();
            expect(btn.dataset.slug).toBe('two-sum');
        });

        test('should not replace button if slug is same', () => {
            deps.getCurrentProblemSlug.mockReturnValue('two-sum');

            // First call
            contentUI.insertNotesButton(deps);
            const btn1 = document.querySelector('.lc-notes-btn');

            // Second call
            contentUI.insertNotesButton(deps);
            const btn2 = document.querySelector('.lc-notes-btn');

            expect(btn1).toBe(btn2); // Should be same element reference
        });

        test('should replace button if slug changed', () => {
            deps.getCurrentProblemSlug.mockReturnValue('two-sum');
            contentUI.insertNotesButton(deps);
            const btn1 = document.querySelector('.lc-notes-btn');
            expect(btn1.dataset.slug).toBe('two-sum');

            // Change slug
            deps.getCurrentProblemSlug.mockReturnValue('three-sum');
            contentUI.insertNotesButton(deps);
            const btn2 = document.querySelector('.lc-notes-btn');

            expect(btn2.dataset.slug).toBe('three-sum');
            expect(btn2).not.toBe(btn1); // Should be new element
            expect(document.querySelectorAll('.lc-notes-btn').length).toBe(1);
        });

        test('click handler should use current slug dependencies', async () => {
            deps.getCurrentProblemSlug.mockReturnValue('two-sum');
            deps.getNotes.mockResolvedValue('My notes');
            deps.extractProblemDetails.mockReturnValue({ title: 'Two Sum' });

            contentUI.insertNotesButton(deps);

            const btn = document.querySelector('.lc-notes-btn');
            btn.click();

            // Wait for async handler
            await Promise.resolve();

            // Verify getNotes called with correct slug
            expect(deps.getNotes).toHaveBeenCalledWith('two-sum');

            // Verify modal shown (by checking DOM or spying showNotesModal)
            // Since showNotesModal is internal to the module we can't easily spy on it 
            // without rewiring, but we can check side effects (modal in DOM).
            // NOTE: showNotesModal is exported, but the internal call uses the internal reference.
            // We can check if modal appeared in DOM.
            expect(document.querySelector('.lc-notes-modal')).not.toBeNull();
        });
    });
});
