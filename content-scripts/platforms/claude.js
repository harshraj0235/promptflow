/**
 * @file content-scripts/platforms/claude.js
 * @description Platform adapter for Claude (claude.ai).
 *
 * Claude uses a ProseMirror-based contenteditable div for its chat input.
 * The UI is built with a component framework (currently appears to use
 * a mix of React / custom components). We must carefully dispatch events
 * so the framework detects our changes.
 */

/* global chrome */

'use strict';

class ClaudeAdapter {
  /** @type {string} Platform identifier */
  static PLATFORM = 'claude';

  /**
   * Ordered CSS selectors for the chat input.
   * Claude's DOM structure changes across versions; fallback generously.
   * @type {string[]}
   */
  static INPUT_SELECTORS = [
    'div.ProseMirror[contenteditable="true"]',
    'div[contenteditable="true"][data-placeholder]',
    'fieldset div[contenteditable="true"]',
    'div[contenteditable="true"].is-editor-empty',
    'div[contenteditable="true"][translate="no"]',
    '.chat-input div[contenteditable="true"]',
    'div[enterkeyhint="send"][contenteditable="true"]',
    'div[role="textbox"][contenteditable="true"]',
    'footer div[contenteditable="true"]',
  ];

  /**
   * Ordered CSS selectors for the send button.
   * @type {string[]}
   */
  static SUBMIT_SELECTORS = [
    'button[aria-label="Send Message"]',
    'button[aria-label="Send message"]',
    'button[aria-label="Send"]',
    'fieldset button[type="button"]:last-of-type',
    'button[data-testid="send-message"]',
    'footer button:last-of-type',
    'button svg polyline', // send-arrow icon — we'll get the parent button
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
    for (const selector of ClaudeAdapter.INPUT_SELECTORS) {
      const el = document.querySelector(selector);
      if (el && this._isVisible(el)) return el;
    }
    return null;
  }

  /**
   * Return the combined CSS selector for all known input selectors.
   * @returns {string}
   */
  getInputSelector() {
    return ClaudeAdapter.INPUT_SELECTORS.join(', ');
  }

  /**
   * Read the current text from the input.
   * @returns {string}
   */
  getInputValue() {
    const el = this.getInputElement();
    if (!el) return '';

    // For contenteditable, innerText preserves line breaks
    return (el.innerText ?? '').replace(/^\n+|\n+$/g, '');
  }

  /**
   * Set text into the Claude chat input.
   *
   * Claude's ProseMirror expects input via native editing commands so that
   * the editor's internal state stays in sync. We use `document.execCommand`
   * which fires the correct `beforeinput`/`input` event chain.
   *
   * @param {string} text
   */
  setInputValue(text) {
    const el = this.getInputElement();
    if (!el) return;

    el.focus();

    // Select all existing content and delete it
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.execCommand('delete', false, null);

    // Insert text line by line to handle newlines correctly
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

    // Dispatch input event for any additional listeners
    el.dispatchEvent(new Event('input', { bubbles: true }));

    // Place cursor at end
    this._moveCursorToEnd(el);
  }

  /**
   * Find the send / submit button.
   * @returns {HTMLElement|null}
   */
  getSubmitButton() {
    for (const selector of ClaudeAdapter.SUBMIT_SELECTORS) {
      let el = document.querySelector(selector);
      if (!el) continue;
      // If we matched an SVG child, walk up to the button
      if (el.tagName !== 'BUTTON') {
        el = el.closest('button');
      }
      if (el && !el.disabled) return el;
    }
    // Fallback: find the input's closest form ancestor and pick the last button
    const input = this.getInputElement();
    if (input) {
      const fieldset = input.closest('fieldset') || input.closest('form') || input.parentElement;
      if (fieldset) {
        const buttons = fieldset.querySelectorAll('button');
        for (const btn of [...buttons].reverse()) {
          if (!btn.disabled) return btn;
        }
      }
    }
    return null;
  }

  /**
   * Click the send button to submit the message.
   */
  submit() {
    const btn = this.getSubmitButton();
    if (btn) {
      btn.click();
      return;
    }
    // Fallback: simulate Enter key on the input
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
   * Check if the Claude chat UI is loaded and the input is available.
   * @returns {boolean}
   */
  isReady() {
    const el = this.getInputElement();
    return el !== null && this._isVisible(el);
  }

  /**
   * Get the current conversation title from the page.
   * @returns {string}
   */
  getConversationTitle() {
    const selectors = [
      'header h1',
      'button[data-testid="conversation-title"]',
      'nav a[href*="/chat/"].bg-',
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
   * Check if an element is visible in the viewport.
   * @param {HTMLElement} el
   * @returns {boolean}
   * @private
   */
  _isVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Move caret to the end of a contenteditable element.
   * @param {HTMLElement} el
   * @private
   */
  _moveCursorToEnd(el) {
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    } catch {
      // Non-critical
    }
  }

  /**
   * Cleanup observers.
   */
  destroy() {
    this._inputObserver?.disconnect();
    this._inputObserver = null;
  }
}

// Export for universal-injector
if (typeof globalThis !== 'undefined') {
  globalThis.ClaudeAdapter = ClaudeAdapter;
}
