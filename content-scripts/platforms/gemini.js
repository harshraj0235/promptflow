/**
 * @file content-scripts/platforms/gemini.js
 * @description Platform adapter for Google Gemini (gemini.google.com).
 *
 * Gemini uses a rich-text editor (historically Quill-based `.ql-editor`,
 * now sometimes a plain contenteditable div or a custom Angular component).
 * The UI is built with Angular / Lit — we dispatch native events so the
 * framework picks up our programmatic changes.
 */

/* global chrome */

'use strict';

class GeminiAdapter {
  /** @type {string} Platform identifier */
  static PLATFORM = 'gemini';

  /**
   * Ordered CSS selectors for the chat input.
   * @type {string[]}
   */
  static INPUT_SELECTORS = [
    '.ql-editor[contenteditable="true"]',
    'div.ql-editor',
    'rich-textarea div[contenteditable="true"]',
    '.text-input-field div[contenteditable="true"]',
    'div[contenteditable="true"][aria-label*="prompt"]',
    'div[contenteditable="true"][aria-label*="Enter"]',
    'div[contenteditable="true"][role="textbox"]',
    '.input-area div[contenteditable="true"]',
    'textarea[aria-label*="prompt"]',
    'textarea[aria-label*="Enter"]',
    'input-area-v2 div[contenteditable="true"]',
  ];

  /**
   * Ordered CSS selectors for the send/submit button.
   * @type {string[]}
   */
  static SUBMIT_SELECTORS = [
    'button[aria-label="Send message"]',
    'button[aria-label="Send"]',
    'button.send-button',
    '.input-area button[mat-icon-button]',
    'button[data-test-id="send-button"]',
    'mat-icon-button[aria-label*="Send"]',
    '.input-area-v2 button:last-of-type',
    'button.mdc-icon-button[aria-label*="Send"]',
  ];

  constructor() {
    /** @type {MutationObserver|null} */
    this._inputObserver = null;
  }

  /* ---------- Core Interface Methods ---------- */

  /**
   * Locate the chat input element.
   * @returns {HTMLElement|null}
   */
  getInputElement() {
    for (const selector of GeminiAdapter.INPUT_SELECTORS) {
      const el = document.querySelector(selector);
      if (el && this._isVisible(el)) return el;
    }
    return null;
  }

  /**
   * Return the combined CSS selector string.
   * @returns {string}
   */
  getInputSelector() {
    return GeminiAdapter.INPUT_SELECTORS.join(', ');
  }

  /**
   * Read the current text from the input.
   * @returns {string}
   */
  getInputValue() {
    const el = this.getInputElement();
    if (!el) return '';

    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      return el.value ?? '';
    }

    // Quill / contenteditable — innerText preserves line breaks
    // Quill adds a trailing \n inside its editor; strip it
    return (el.innerText ?? '').replace(/\n$/, '');
  }

  /**
   * Set text in the Gemini chat input.
   *
   * For Quill-based editors we use `document.execCommand` to trigger
   * the correct input events. For plain textareas we use the native setter
   * pattern to bypass Angular's value accessor.
   *
   * @param {string} text
   */
  setInputValue(text) {
    const el = this.getInputElement();
    if (!el) return;

    el.focus();

    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      this._setTextareaValue(el, text);
    } else {
      this._setContentEditableValue(el, text);
    }
  }

  /**
   * Find the submit / send button.
   * @returns {HTMLElement|null}
   */
  getSubmitButton() {
    for (const selector of GeminiAdapter.SUBMIT_SELECTORS) {
      const btn = document.querySelector(selector);
      if (btn && !btn.disabled && !btn.getAttribute('aria-disabled')) return btn;
    }
    // Fallback: look near the input
    const input = this.getInputElement();
    if (input) {
      const container =
        input.closest('rich-textarea')?.parentElement ||
        input.closest('.input-area') ||
        input.closest('.input-area-v2') ||
        input.parentElement;
      if (container) {
        const buttons = container.querySelectorAll('button');
        for (const btn of [...buttons].reverse()) {
          if (!btn.disabled) return btn;
        }
      }
    }
    return null;
  }

  /**
   * Submit the current input.
   */
  submit() {
    const btn = this.getSubmitButton();
    if (btn) {
      btn.click();
      return;
    }
    const input = this.getInputElement();
    if (input) {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true,
        })
      );
    }
  }

  /**
   * Watch for input changes.
   * @param {(value: string) => void} callback
   * @returns {() => void} cleanup function
   */
  onInputChange(callback) {
    const el = this.getInputElement();
    if (!el) return () => {};

    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const handler = () => callback(el.value ?? '');
      el.addEventListener('input', handler);
      return () => el.removeEventListener('input', handler);
    }

    // contenteditable / Quill
    this._inputObserver?.disconnect();
    let debounceTimer = null;

    this._inputObserver = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        callback(this.getInputValue());
      }, 80);
    });

    this._inputObserver.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      clearTimeout(debounceTimer);
      this._inputObserver?.disconnect();
      this._inputObserver = null;
    };
  }

  /**
   * Check if the Gemini chat UI is loaded and ready.
   * @returns {boolean}
   */
  isReady() {
    const el = this.getInputElement();
    return el !== null && this._isVisible(el);
  }

  /**
   * Get the current conversation title.
   * @returns {string}
   */
  getConversationTitle() {
    const selectors = [
      '.conversation-title',
      'h1.title',
      'header h1',
      'mat-toolbar h1',
      'title',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = (el.textContent ?? '').trim();
        if (text && text.length > 1 && text.length < 200) return text;
      }
    }
    return document.title || '';
  }

  /**
   * Get the currently selected model, if visible.
   * @returns {string}
   */
  getSelectedModel() {
    const selectors = [
      'model-selector button span',
      '.model-selector-container',
      'button[data-test-id="model-selector"]',
      '.model-picker span',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = (el.textContent ?? '').trim();
        if (text) return text;
      }
    }
    return '';
  }

  /* ---------- Private Helpers ---------- */

  /**
   * Set value on a <textarea>, dispatching events Angular's NgModel listens for.
   * @param {HTMLTextAreaElement} el
   * @param {string} text
   * @private
   */
  _setTextareaValue(el, text) {
    const nativeSetter =
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(el, text);
    } else {
      el.value = text;
    }
    // Angular listens for 'input' events (NgModel default update trigger)
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Set value on a contenteditable div (Quill / custom rich-text).
   * @param {HTMLElement} el
   * @param {string} text
   * @private
   */
  _setContentEditableValue(el, text) {
    el.focus();

    // Select all and delete
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.execCommand('delete', false, null);

    // Insert new text
    if (text) {
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        if (i > 0) {
          document.execCommand('insertParagraph', false, null);
        }
        if (line) {
          document.execCommand('insertText', false, line);
        }
      });
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));

    // Move cursor to end
    try {
      const endRange = document.createRange();
      endRange.selectNodeContents(el);
      endRange.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(endRange);
    } catch {
      // Non-critical
    }
  }

  /**
   * Check visibility.
   * @param {HTMLElement} el
   * @returns {boolean}
   * @private
   */
  _isVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Cleanup.
   */
  destroy() {
    this._inputObserver?.disconnect();
    this._inputObserver = null;
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.GeminiAdapter = GeminiAdapter;
}
