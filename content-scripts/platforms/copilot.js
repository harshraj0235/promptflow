/**
 * @file content-scripts/platforms/copilot.js
 * @description Platform adapter for Microsoft Copilot (copilot.microsoft.com).
 *
 * Copilot (formerly Bing Chat) uses a mix of React and web-component
 * patterns. The input is typically a <textarea> inside the main UI or
 * within a shadow DOM component. We attempt to pierce shadow roots when
 * necessary.
 */

/* global chrome */

'use strict';

class CopilotAdapter {
  /** @type {string} Platform identifier */
  static PLATFORM = 'copilot';

  /**
   * Ordered CSS selectors for the chat input.
   * Some selectors target elements that may be inside shadow roots.
   * @type {string[]}
   */
  static INPUT_SELECTORS = [
    'textarea#userInput',
    'textarea[id="userInput"]',
    '#searchbox textarea',
    'textarea[name="searchbox"]',
    'textarea[aria-label*="message"]',
    'textarea[aria-label*="Ask"]',
    'textarea[placeholder*="Message"]',
    'textarea[placeholder*="Ask"]',
    'div[contenteditable="true"][role="textbox"]',
    '#search-input textarea',
    'cib-serp textarea', // older Bing Chat component
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
    'button[aria-label="Send message"]',
    'button[type="submit"]',
    'button#submit-button',
    'button[data-testid="send-button"]',
    'button.submit-button',
    'form button:last-of-type',
  ];

  /**
   * Shadow root host selectors to try piercing.
   * @type {string[]}
   */
  static SHADOW_HOST_SELECTORS = [
    'cib-serp',
    'cib-action-bar',
    'cib-text-input',
  ];

  constructor() {
    /** @type {MutationObserver|null} */
    this._inputObserver = null;
  }

  /* ---------- Core Interface Methods ---------- */

  /**
   * Locate the chat input element, including shadow DOM traversal.
   * @returns {HTMLElement|null}
   */
  getInputElement() {
    // First try light DOM selectors
    for (const selector of CopilotAdapter.INPUT_SELECTORS) {
      const el = document.querySelector(selector);
      if (el && this._isVisible(el)) return el;
    }

    // Try piercing shadow DOM (older Bing Chat web components)
    const shadowEl = this._findInShadowDom('textarea, div[contenteditable="true"]');
    if (shadowEl && this._isVisible(shadowEl)) return shadowEl;

    return null;
  }

  /**
   * @returns {string}
   */
  getInputSelector() {
    return CopilotAdapter.INPUT_SELECTORS.join(', ');
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
   * Set text in the Copilot chat input.
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
   * Find the submit button, including shadow DOM.
   * @returns {HTMLElement|null}
   */
  getSubmitButton() {
    for (const selector of CopilotAdapter.SUBMIT_SELECTORS) {
      const btn = document.querySelector(selector);
      if (btn && !btn.disabled) return btn;
    }

    // Try shadow DOM
    const shadowBtn = this._findInShadowDom('button[aria-label*="Send"], button[type="submit"]');
    if (shadowBtn && !shadowBtn.disabled) return shadowBtn;

    // Fallback: find near the input
    const input = this.getInputElement();
    if (input) {
      const form = input.closest('form') || input.parentElement;
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
   * Check if the Copilot UI is loaded.
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
      'h1',
      '.conversation-title',
      'header h2',
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
   * Traverse shadow roots of known Copilot web components to find elements.
   * @param {string} selector
   * @returns {HTMLElement|null}
   * @private
   */
  _findInShadowDom(selector) {
    for (const hostSelector of CopilotAdapter.SHADOW_HOST_SELECTORS) {
      const host = document.querySelector(hostSelector);
      if (!host?.shadowRoot) continue;

      const found = this._deepShadowQuery(host.shadowRoot, selector);
      if (found) return found;
    }
    return null;
  }

  /**
   * Recursively search inside shadow roots.
   * @param {ShadowRoot|Element} root
   * @param {string} selector
   * @param {number} depth
   * @returns {HTMLElement|null}
   * @private
   */
  _deepShadowQuery(root, selector, depth = 5) {
    if (depth <= 0) return null;

    const el = root.querySelector(selector);
    if (el) return el;

    // Check children with shadow roots
    const allElements = root.querySelectorAll('*');
    for (const child of allElements) {
      if (child.shadowRoot) {
        const found = this._deepShadowQuery(child.shadowRoot, selector, depth - 1);
        if (found) return found;
      }
    }
    return null;
  }

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
      // InputEvent not fully supported — non-critical
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
  globalThis.CopilotAdapter = CopilotAdapter;
}
