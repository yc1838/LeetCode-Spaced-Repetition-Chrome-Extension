/**
 * @jest-environment jsdom
 */

const contentUI = require('../content_ui');

describe('Notes UI', () => {
    test('createNotesButton should return a button element with correct class', () => {
        const onClick = jest.fn();
        const btn = contentUI.createNotesButton(onClick);

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
});
