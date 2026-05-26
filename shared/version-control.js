/**
 * PromptFlow Pro — Version Control System
 * =========================================
 * Git-like version tracking for prompt templates. Each version is an
 * immutable snapshot of the prompt content at a point in time.
 *
 * Stored under `pf_versions` in chrome.storage.local as a map of
 * `promptId → VersionEntry[]`.
 *
 * @module shared/version-control
 */

import { generateId, deepClone } from './utils.js';

/* ─── Storage key ──────────────────────────── */
const STORAGE_KEY = 'pf_versions';

/**
 * @typedef {Object} VersionEntry
 * @property {string} id               — Unique version ID.
 * @property {string} promptId         — Parent prompt ID.
 * @property {string} content          — Full content snapshot.
 * @property {string} message          — Commit-style message.
 * @property {number} timestamp        — Unix epoch ms.
 * @property {DiffLine[]|null} diffFromPrevious — Diff against the prior version (null for the first).
 */

/**
 * @typedef {Object} DiffLine
 * @property {'added'|'removed'|'unchanged'} type — Line status.
 * @property {string} content — The line content.
 * @property {number|null} oldLineNum — Line number in version A (null for added lines).
 * @property {number|null} newLineNum — Line number in version B (null for removed lines).
 */

/* ═══════════════════════════════════════════════
 *  VersionControl class
 * ═══════════════════════════════════════════════ */

export class VersionControl {
  /** @type {Map<string, VersionEntry[]>} promptId → versions */
  #store = new Map();

  /** @type {boolean} */
  #loaded = false;

  /* ────────── Private helpers ────────── */

  /** Hydrate from chrome.storage.local */
  async #ensureLoaded() {
    if (this.#loaded) return;

    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const raw = result[STORAGE_KEY] || {};
      this.#store = new Map(Object.entries(raw));
      this.#loaded = true;
    } catch (err) {
      console.error('[VersionControl] Failed to load:', err);
      this.#store = new Map();
      this.#loaded = true;
    }
  }

  /** Persist the full version store. */
  async #save() {
    const obj = Object.fromEntries(this.#store);
    await chrome.storage.local.set({ [STORAGE_KEY]: obj });
  }

  /* ────────────────────────────────────────────
   *  Public API
   * ──────────────────────────────────────────── */

  /**
   * Create a new version snapshot for a prompt.
   *
   * @param {string} promptId — The prompt this version belongs to.
   * @param {string} content  — Full content snapshot.
   * @param {string} [message=''] — Descriptive commit message.
   * @returns {Promise<VersionEntry>} The created version entry.
   */
  async createVersion(promptId, content, message = '') {
    await this.#ensureLoaded();

    const versions = this.#store.get(promptId) || [];

    // Compute diff against the previous version (if any)
    const prev = versions.length > 0 ? versions[versions.length - 1] : null;
    const diffFromPrevious = prev ? this.#computeDiff(prev.content, content) : null;

    /** @type {VersionEntry} */
    const entry = {
      id: generateId(),
      promptId,
      content,
      message: message || `Version ${versions.length + 1}`,
      timestamp: Date.now(),
      diffFromPrevious,
    };

    versions.push(entry);
    this.#store.set(promptId, versions);
    await this.#save();

    return deepClone(entry);
  }

  /**
   * Get all versions for a prompt, ordered oldest → newest.
   *
   * @param {string} promptId
   * @returns {Promise<VersionEntry[]>}
   */
  async getVersions(promptId) {
    await this.#ensureLoaded();
    const versions = this.#store.get(promptId) || [];
    return deepClone(versions);
  }

  /**
   * Get a specific version by its ID.
   *
   * @param {string} promptId
   * @param {string} versionId
   * @returns {Promise<VersionEntry|null>}
   */
  async getVersion(promptId, versionId) {
    await this.#ensureLoaded();
    const versions = this.#store.get(promptId) || [];
    const found = versions.find((v) => v.id === versionId);
    return found ? deepClone(found) : null;
  }

  /**
   * Get the latest (most recent) version for a prompt.
   *
   * @param {string} promptId
   * @returns {Promise<VersionEntry|null>}
   */
  async getLatestVersion(promptId) {
    await this.#ensureLoaded();
    const versions = this.#store.get(promptId) || [];
    if (versions.length === 0) return null;
    return deepClone(versions[versions.length - 1]);
  }

  /**
   * Rollback a prompt to a specific version.
   * Creates a NEW version entry with the rolled-back content.
   * Does NOT delete later versions — the history is preserved.
   *
   * @param {string} promptId
   * @param {string} versionId — The version to roll back to.
   * @returns {Promise<VersionEntry>} The new "rollback" version entry.
   * @throws {Error} If the version is not found.
   */
  async rollback(promptId, versionId) {
    await this.#ensureLoaded();

    const versions = this.#store.get(promptId) || [];
    const target = versions.find((v) => v.id === versionId);
    if (!target) throw new Error(`Version not found: ${versionId}`);

    // Create a new version with the rolled-back content
    return this.createVersion(
      promptId,
      target.content,
      `Rolled back to version from ${new Date(target.timestamp).toLocaleString()}`
    );
  }

  /**
   * Compute a line-by-line diff between two versions.
   *
   * @param {string} versionIdA — "Before" version ID.
   * @param {string} versionIdB — "After" version ID.
   * @param {string} [promptId] — Prompt ID (scans all prompts if omitted).
   * @returns {Promise<DiffLine[]>} Array of diff lines.
   */
  async diff(versionIdA, versionIdB, promptId) {
    await this.#ensureLoaded();

    let versionA = null;
    let versionB = null;

    if (promptId) {
      const versions = this.#store.get(promptId) || [];
      versionA = versions.find((v) => v.id === versionIdA);
      versionB = versions.find((v) => v.id === versionIdB);
    } else {
      // Scan all prompts
      for (const versions of this.#store.values()) {
        if (!versionA) versionA = versions.find((v) => v.id === versionIdA);
        if (!versionB) versionB = versions.find((v) => v.id === versionIdB);
        if (versionA && versionB) break;
      }
    }

    if (!versionA) throw new Error(`Version A not found: ${versionIdA}`);
    if (!versionB) throw new Error(`Version B not found: ${versionIdB}`);

    return this.#computeDiff(versionA.content, versionB.content);
  }

  /**
   * Delete a specific version.
   *
   * @param {string} promptId
   * @param {string} versionId
   * @returns {Promise<boolean>}
   */
  async deleteVersion(promptId, versionId) {
    await this.#ensureLoaded();

    const versions = this.#store.get(promptId);
    if (!versions) return false;

    const idx = versions.findIndex((v) => v.id === versionId);
    if (idx === -1) return false;

    versions.splice(idx, 1);

    if (versions.length === 0) {
      this.#store.delete(promptId);
    } else {
      this.#store.set(promptId, versions);
    }

    await this.#save();
    return true;
  }

  /**
   * Get the total number of versions stored for a prompt.
   *
   * @param {string} promptId
   * @returns {Promise<number>}
   */
  async getVersionCount(promptId) {
    await this.#ensureLoaded();
    const versions = this.#store.get(promptId) || [];
    return versions.length;
  }

  /**
   * Force-reload from storage.
   */
  invalidateCache() {
    this.#loaded = false;
  }

  /* ────────────────────────────────────────────
   *  Diff Algorithm (Myers-like LCS diff)
   * ──────────────────────────────────────────── */

  /**
   * Compute a line-by-line diff between two text blocks.
   * Uses an LCS (Longest Common Subsequence) approach.
   *
   * @param {string} oldText — Previous content.
   * @param {string} newText — Current content.
   * @returns {DiffLine[]}
   */
  #computeDiff(oldText, newText) {
    const oldLines = (oldText || '').split('\n');
    const newLines = (newText || '').split('\n');

    // Build LCS table
    const m = oldLines.length;
    const n = newLines.length;
    const lcs = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          lcs[i][j] = lcs[i - 1][j - 1] + 1;
        } else {
          lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
        }
      }
    }

    // Back-trace to produce diff
    /** @type {DiffLine[]} */
    const result = [];
    let i = m;
    let j = n;

    // Collect in reverse, then flip
    /** @type {DiffLine[]} */
    const stack = [];

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
        stack.push({
          type: 'unchanged',
          content: oldLines[i - 1],
          oldLineNum: i,
          newLineNum: j,
        });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
        stack.push({
          type: 'added',
          content: newLines[j - 1],
          oldLineNum: null,
          newLineNum: j,
        });
        j--;
      } else {
        stack.push({
          type: 'removed',
          content: oldLines[i - 1],
          oldLineNum: i,
          newLineNum: null,
        });
        i--;
      }
    }

    // Reverse to get correct order
    for (let k = stack.length - 1; k >= 0; k--) {
      result.push(stack[k]);
    }

    return result;
  }
}
