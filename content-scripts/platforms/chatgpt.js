/**
 * @file content-scripts/platforms/chatgpt.js
 * @description Platform adapter for ChatGPT (chat.openai.com / chatgpt.com).
 *
 * ChatGPT uses a ProseMirror-based contenteditable div for its input.
 * The selector has changed multiple times; we maintain a list of fallbacks.
 * React controls the component, so we must dispatch proper synthetic events
 * to keep React's internal state in sync.
 */

/* global chrome */

'use strict';

/**
 * @typedef {Object} PlatformAdapter
 * @property {() => HTMLElement|null} getInputElement
 * @property {() => string} getInputValue
 * @property {(text: string) => void} setInputValue
 * @property {() => HTMLElement|null} getSubmitButton
 * @property {() => void} submit
 * @property {(callback: Function) => Function} onInputChange
 * @property {() => boolean} isReady
 * @property {() => string} getInputSelector
 */

class ChatGPTAdapter {
  /** @type {string} Platform identifier */
  static PLATFORM = 'chatgpt';

  /**
   * Ordered list of CSS selectors for the chat input element.
   * Checked top-to-bottom; the first match wins.
   * @type {string[]}
   */
  static INPUT_SELECTORS = [
    '#prompt-textarea',
    'div[id="prompt-textarea"]',
    'div.ProseMirror[contenteditable="true"]',
    'form textarea',
    'div[contenteditable="true"][data-placeholder]',
    'main textarea',
    '#__next textarea',
    '[data-testid="text-input"]',
  ];

  /**
   * Ordered list of CSS selectors for the send/submit button.
   * @type {string[]}
   */
  static SUBMIT_SELECTORS = [
    'button[data-testid="send-button"]',
    'form button[type="submit"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label="Send"]',
    'form button:last-of-type',
    'button.btn-primary[data-testid]',
    'main form button:not([disabled])',
  ];

  constructor() {
    /** @type {MutationObserver|null} */
    this._inputObserver = null;
  }

  /* ---------- Core Interface Methods ---------- */

  /**
   * Locate the chat input element on the page.
   * @returns {HTMLElement|null}
   */
  getInputElement() {
    for (const selector of ChatGPTAdapter.INPUT_SELECTORS) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  /**
   * Return a comma-joined CSS selector string covering all known input selectors.
   * @returns {string}
   */
  getInputSelector() {
    return ChatGPTAdapter.INPUT_SELECTORS.join(', ');
  }

  /**
   * Read the current text content from the input.
   * Handles both <textarea> and contenteditable div.
   * @returns {string}
   */
  getInputValue() {
    const el = this.getInputElement();
    if (!el) return '';

    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      return el.value ?? '';
    }
    // For contenteditable / ProseMirror: read innerText to preserve line breaks
    return el.innerText ?? '';
  }

  /**
   * Set text in the chat input, correctly triggering React's change detection.
   *
   * Strategy:
   *  1. Focus the element
   *  2. Clear existing content
   *  3. For contenteditable: use `document.execCommand('insertText')` which
   *     fires an `input` event recognized by ProseMirror / React.
   *     For textarea: use the native value setter + dispatch InputEvent.
   *  4. Fire additional change/input events for any framework listeners.
   *
   * @param {string} text — The text to insert
   */
  setInputValue(text) {
    const el = this.getInputElement();
    if (!el) return;

    el.focus();

    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      this._setNativeTextareaValue(el, text);
    } else {
      // contenteditable div (ProseMirror)
      this._setContentEditableValue(el, text);
    }
  }

  /**
   * Find the submit / send button.
   * @returns {HTMLElement|null}
   */
  getSubmitButton() {
    for (const selector of ChatGPTAdapter.SUBMIT_SELECTORS) {
      const btn = document.querySelector(selector);
      if (btn && !btn.disabled) return btn;
    }
    // Fallback: look for an enabled button inside the form that wraps the input
    const input = this.getInputElement();
    if (input) {
      const form = input.closest('form');
      if (form) {
        const buttons = form.querySelectorAll('button');
        for (const btn of buttons) {
          if (!btn.disabled) return btn;
        }
      }
    }
    return null;
  }

  /**
   * Submit the current input (click the send button).
   */
  submit() {
    const btn = this.getSubmitButton();
    if (btn) {
      btn.click();
      return;
    }
    // Fallback: dispatch Enter keydown on the input
    const input = this.getInputElement();
    if (input) {
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(enterEvent);
    }
  }

  /**
   * Register a callback that fires when the input text changes.
   * Returns a cleanup function to unsubscribe.
   * @param {(value: string) => void} callback
   * @returns {() => void} unsubscribe function
   */
  onInputChange(callback) {
    const el = this.getInputElement();
    if (!el) return () => {};

    // For contenteditable we observe childList + characterData
    if (el.isContentEditable) {
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

    // For <textarea>
    const handler = () => callback(el.value ?? '');
    el.addEventListener('input', handler);
    return () => el.removeEventListener('input', handler);
  }

  /**
   * Check whether the chat UI is fully loaded and the input is available.
   * @returns {boolean}
   */
  isReady() {
    const el = this.getInputElement();
    if (!el) return false;
    // Make sure the element is visible
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Attempt to read the current conversation title from the page.
   * @returns {string}
   */
  getConversationTitle() {
    // The active nav item usually has the conversation title
    const selectors = [
      'nav a.bg-token-sidebar-surface-secondary',
      'nav li.relative a.flex',
      'nav ol li a[href^="/c/"]',
      'h1',
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
   * Set value on a <textarea> element, working around React's synthetic event system.
   * React overrides the value setter; we need to use the native HTMLTextAreaElement
   * prototype setter so that React recognises the change.
   *
   * @param {HTMLTextAreaElement} el
   * @param {string} text
   * @private
   */
  _setNativeTextareaValue(el, text) {
    // Use the native setter to bypass React's override
    const nativeSetter =
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set ??
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

    if (nativeSetter) {
      nativeSetter.call(el, text);
    } else {
      el.value = text;
    }

    // Dispatch events React listens for
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));

    // Also fire React 17+ compatible InputEvent
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
      // InputEvent constructor not supported in all envs — non-critical
    }
  }

  /**
   * Set value on a contenteditable div (ProseMirror editor).
   *
   * ProseMirror listens for `beforeinput` and `input` events from the browser's
   * built-in editing commands. Using `document.execCommand('insertText')` is the
   * most reliable cross-browser approach to trigger these listeners.
   *
   * @param {HTMLElement} el
   * @param {string} text
   * @private
   */
  _setContentEditableValue(el, text) {
    el.focus();

    // Select all existing content
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection?.removeAllRanges();
    selection?.addRange(range);

    // Delete existing content first
    document.execCommand('delete', false, null);

    // Insert new text — this fires the events ProseMirror expects
    if (text) {
      // Split by newlines to handle multi-line content.
      // insertText does not support \n directly in all browsers,
      // so we insert paragraphs via insertParagraph for line breaks.
      const lines = text.split('\n');
      lines.forEach((line, index) => {
        if (index > 0) {
          document.execCommand('insertParagraph', false, null);
        }
        if (line) {
          document.execCommand('insertText', false, line);
        }
      });
    }

    // Belt-and-suspenders: fire input event
    el.dispatchEvent(new Event('input', { bubbles: true }));

    // Move cursor to end
    try {
      const endRange = document.createRange();
      endRange.selectNodeContents(el);
      endRange.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(endRange);
    } catch {
      // Non-critical cursor positioning
    }
  }

  /**
   * Trigger a React-compatible update on any element.
   * Uses React's internal fiber/props to call onChange if available.
   *
   * @param {HTMLElement} element
   * @param {string} value
   */
  triggerReactUpdate(element, value) {
    // Attempt to find React's internal instance
    const reactInternalKey = Object.keys(element).find(
      (key) => key.startsWith('__reactInternalInstance$') || key.startsWith('__reactFiber$')
    );

    if (reactInternalKey) {
      const fiber = element[reactInternalKey];
      // Walk up the fiber tree to find the onChange handler
      let current = fiber;
      let maxDepth = 20;
      while (current && maxDepth-- > 0) {
        const props = current.memoizedProps || current.pendingProps;
        if (props?.onChange) {
          props.onChange({ target: { value } });
          return;
        }
        current = current.return;
      }
    }

    // Final fallback: use native setter + events
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      this._setNativeTextareaValue(element, value);
    } else {
      this._setContentEditableValue(element, value);
    }
  }

  /**
   * Cleanup any observers / listeners.
   */
  destroy() {
    this._inputObserver?.disconnect();
    this._inputObserver = null;
  }
}

// Export for use by universal-injector (supports both module and script contexts)
if (typeof globalThis !== 'undefined') {
  globalThis.ChatGPTAdapter = ChatGPTAdapter;
}
