/**
 * @file content-scripts/platforms/perplexity.js
 * @description Platform adapter for Perplexity AI (perplexity.ai).
 *
 * Perplexity uses a React-based UI with a <textarea> for its search/chat
 * input. The UI has both a search bar and follow-up input inside threads.
 * We handle both contexts.
 */

/* global chrome */

'use strict';

class PerplexityAdapter {
  /** @type {string} Platform identifier */
  static PLATFORM = 'perplexity';

  /**
   * Ordered CSS selectors for the input element.
   * Perplexity uses <textarea> in both the main search and follow-up.
   * @type {string[]}
   */
  static INPUT_SELECTORS = [
    'textarea[placeholder*="Ask"]',
    'textarea[placeholder*="follow-up"]',
    'textarea[placeholder*="Search"]',
    'textarea[placeholder*="ask"]',
    'div[contenteditable="true"][role="textbox"]',
    '.relative textarea',
    'form textarea',
    '#ppl-search-input',
    '#search-input',
    'main textarea',
    'textarea',
  ];

  /**
   * Ordered CSS selectors for the submit button.
   * @type {string[]}
   */
  static SUBMIT_SELECTORS = [
    'button[aria-label="Submit"]',
    'button[aria-label="Send"]',
    'button[aria-label="Search"]',
    'button[type="submit"]',
    'form button:last-of-type',
    'button svg[data-testid="send-icon"]',
    'button.bg-super',
    'button[class*="submit"]',
  ];

  constructor() {
    /** @type {MutationObserver|null} */
    this._inputObserver = null;
  }

  /* ---------- Core Interface Methods ---------- */

  /**
   * Locate the active chat/search input.
   * Prefers the follow-up textarea if on a thread page.
   * @returns {HTMLElement|null}
   */
  getInputElement() {
    // Check if we're in a thread (URL contains /search/ or has follow-up input)
    const isThread = window.location.pathname.includes('/search/');

    if (isThread) {
      // In thread, prefer the follow-up textarea (usually at the bottom)
      const followUp =
        document.querySelector('textarea[placeholder*="follow-up"]') ||
        document.querySelector('textarea[placeholder*="Ask"]');
      if (followUp && this._isVisible(followUp)) return followUp;
    }

    for (const selector of PerplexityAdapter.INPUT_SELECTORS) {
      const el = document.querySelector(selector);
      if (el && this._isVisible(el)) return el;
    }
    return null;
  }

  /**
   * @returns {string}
   */
  getInputSelector() {
    return PerplexityAdapter.INPUT_SELECTORS.join(', ');
  }

  /**
   * Read the current input value.
   * @returns {string}
   */
  getInputValue() {
    const el = this.getInputElement();
    if (!el) return '';

    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      return el.value ?? '';
    }
    return (el.innerText ?? '').trim();
  }

  /**
   * Set text in the Perplexity input.
   * Uses the React-compatible native setter approach.
   * @param {string} text
   */
  setInputValue(text) {
    const el = this.getInputElement();
    if (!el) return;

    el.focus();

    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      this._setNativeTextareaValue(el, text);
    } else {
      this._setContentEditableValue(el, text);
    }
  }

  /**
   * Find the submit button.
   * @returns {HTMLElement|null}
   */
  getSubmitButton() {
    for (const selector of PerplexityAdapter.SUBMIT_SELECTORS) {
      let el = document.querySelector(selector);
      if (!el) continue;
      if (el.tagName !== 'BUTTON') el = el.closest('button');
      if (el && !el.disabled) return el;
    }
    // Fallback: find button near the textarea
    const input = this.getInputElement();
    if (input) {
      const form = input.closest('form') || input.closest('.relative') || input.parentElement;
      if (form) {
        const buttons = form.querySelectorAll('button');
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

    // contenteditable
    this._inputObserver?.disconnect();
    let debounceTimer = null;

    this._inputObserver = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => callback(this.getInputValue()), 80);
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
   * Check if the UI is loaded and the input is available.
   * @returns {boolean}
   */
  isReady() {
    const el = this.getInputElement();
    return el !== null && this._isVisible(el);
  }

  /**
   * Get the current conversation/search title.
   * @returns {string}
   */
  getConversationTitle() {
    const selectors = [
      'h1',
      '.thread-title',
      'main h1',
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

  /* ---------- Private Helpers ---------- */

  /**
   * @param {HTMLTextAreaElement} el
   * @param {string} text
   * @private
   */
  _setNativeTextareaValue(el, text) {
    const nativeSetter =
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set ??
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

    if (nativeSetter) {
      nativeSetter.call(el, text);
    } else {
      el.value = text;
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));

    try {
      el.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text,
        })
      );
    } catch {
      // InputEvent constructor fallback
    }
  }

  /**
   * @param {HTMLElement} el
   * @param {string} text
   * @private
   */
  _setContentEditableValue(el, text) {
    el.focus();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.execCommand('delete', false, null);

    if (text) {
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        if (i > 0) document.execCommand('insertParagraph', false, null);
        if (line) document.execCommand('insertText', false, line);
      });
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));

    try {
      const endRange = document.createRange();
      endRange.selectNodeContents(el);
      endRange.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(endRange);
    } catch { /* non-critical */ }
  }

  /**
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
  globalThis.PerplexityAdapter = PerplexityAdapter;
}
