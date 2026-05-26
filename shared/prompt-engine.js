/**
 * PromptFlow Pro — Prompt Template Engine
 * ========================================
 * Core data-management layer for prompts and folders.
 * Handles CRUD, search, ratings, favourites, usage tracking,
 * import / export, and statistics.
 *
 * Persistence is delegated to `StorageManager` (background/storage-manager.js).
 * When running inside a content-script or popup that cannot directly import
 * the StorageManager class, messages are sent to the service-worker instead.
 *
 * @module shared/prompt-engine
 */

import { generateId, deepClone, fuzzySearch, parseVariables } from './utils.js';

/* ─── Storage keys ─────────────────────────── */
const STORAGE_KEY_PROMPTS = 'pf_prompts';
const STORAGE_KEY_FOLDERS = 'pf_folders';

/**
 * @typedef {Object} PromptVersion
 * @property {string} id        — Unique version ID.
 * @property {string} content   — Snapshot of the prompt content at this version.
 * @property {string} message   — Commit-style message describing the change.
 * @property {number} timestamp — Unix epoch ms when the version was created.
 */

/**
 * @typedef {Object} Prompt
 * @property {string}   id          — Unique prompt ID (UUID v4).
 * @property {string}   title       — Human-readable title.
 * @property {string}   content     — The prompt template body.
 * @property {string[]} tags        — Freeform tags for categorisation.
 * @property {string|null} folderId — Parent folder ID, or null for root.
 * @property {number}   rating      — User rating 1-5, 0 if unrated.
 * @property {boolean}  isFavorite  — Starred / bookmarked flag.
 * @property {number}   usageCount  — How many times the prompt has been used.
 * @property {string[]} variables   — Extracted `{{var}}` names.
 * @property {string}   category    — Intent category (creative, technical, …).
 * @property {string}   createdAt   — ISO 8601 creation timestamp.
 * @property {string}   updatedAt   — ISO 8601 last-updated timestamp.
 * @property {PromptVersion[]} versions — Version history snapshots.
 */

/**
 * @typedef {Object} Folder
 * @property {string}      id        — Unique folder ID.
 * @property {string}      name      — Display name.
 * @property {string|null} parentId  — Parent folder ID (null = root).
 * @property {string}      icon      — Emoji or icon identifier.
 * @property {string}      color     — CSS colour for the folder badge.
 * @property {string}      createdAt — ISO 8601 creation timestamp.
 */

/* ═══════════════════════════════════════════════
 *  PromptEngine class
 * ═══════════════════════════════════════════════ */

export class PromptEngine {
  /** @type {Map<string, Prompt>} In-memory prompt cache */
  #prompts = new Map();

  /** @type {Map<string, Folder>} In-memory folder cache */
  #folders = new Map();

  /** @type {boolean} Whether the cache has been hydrated from storage */
  #loaded = false;

  /* ────────── Private helpers ────────── */

  /**
   * Ensure the in-memory cache is hydrated from chrome.storage.
   * This is called lazily before any read / write operation.
   */
  async #ensureLoaded() {
    if (this.#loaded) return;

    try {
      const result = await chrome.storage.local.get([STORAGE_KEY_PROMPTS, STORAGE_KEY_FOLDERS]);

      const rawPrompts = result[STORAGE_KEY_PROMPTS] || {};
      const rawFolders = result[STORAGE_KEY_FOLDERS] || {};

      this.#prompts = new Map(Object.entries(rawPrompts));
      this.#folders = new Map(Object.entries(rawFolders));
      this.#loaded = true;
    } catch (err) {
      console.error('[PromptEngine] Failed to load storage:', err);
      // Initialise with empty maps so operations don't stall
      this.#prompts = new Map();
      this.#folders = new Map();
      this.#loaded = true;
    }
  }

  /**
   * Persist the current prompts map to chrome.storage.local.
   */
  async #savePrompts() {
    const obj = Object.fromEntries(this.#prompts);
    await chrome.storage.local.set({ [STORAGE_KEY_PROMPTS]: obj });
  }

  /**
   * Persist the current folders map to chrome.storage.local.
   */
  async #saveFolders() {
    const obj = Object.fromEntries(this.#folders);
    await chrome.storage.local.set({ [STORAGE_KEY_FOLDERS]: obj });
  }

  /* ────────────────────────────────────────────
   *  Prompt CRUD
   * ──────────────────────────────────────────── */

  /**
   * Create a new prompt and persist it.
   *
   * @param {Object} data
   * @param {string}   data.title      — Prompt title.
   * @param {string}   data.content    — Template body.
   * @param {string[]} [data.tags=[]]  — Tags.
   * @param {string|null} [data.folderId=null] — Folder.
   * @param {string[]} [data.variables]  — Explicit variable list (auto-detected if omitted).
   * @param {string}   [data.category='general'] — Category label.
   * @returns {Promise<Prompt>} The newly created prompt object.
   */
  async createPrompt({ title, content, tags = [], folderId = null, variables, category = 'general' }) {
    await this.#ensureLoaded();

    const now = new Date().toISOString();
    const detectedVars = variables ?? parseVariables(content);

    /** @type {Prompt} */
    const prompt = {
      id: generateId(),
      title: title?.trim() || 'Untitled Prompt',
      content: content || '',
      tags: Array.isArray(tags) ? tags.map((t) => t.trim().toLowerCase()) : [],
      folderId,
      rating: 0,
      isFavorite: false,
      usageCount: 0,
      variables: detectedVars,
      category: category || 'general',
      createdAt: now,
      updatedAt: now,
      versions: [
        {
          id: generateId(),
          content,
          message: 'Initial version',
          timestamp: Date.now(),
        },
      ],
    };

    this.#prompts.set(prompt.id, prompt);
    await this.#savePrompts();
    return deepClone(prompt);
  }

  /**
   * Update an existing prompt with partial data.
   *
   * @param {string} id      — Prompt ID.
   * @param {Partial<Prompt>} updates — Fields to update.
   * @returns {Promise<Prompt>} The updated prompt.
   * @throws {Error} If prompt not found.
   */
  async updatePrompt(id, updates) {
    await this.#ensureLoaded();

    const prompt = this.#prompts.get(id);
    if (!prompt) throw new Error(`Prompt not found: ${id}`);

    // Merge updates (excluding immutable fields)
    const immutable = new Set(['id', 'createdAt', 'versions']);
    for (const [key, value] of Object.entries(updates)) {
      if (!immutable.has(key)) {
        prompt[key] = value;
      }
    }

    // Re-detect variables when content changes
    if (updates.content !== undefined) {
      prompt.variables = parseVariables(updates.content);
    }

    prompt.updatedAt = new Date().toISOString();
    this.#prompts.set(id, prompt);
    await this.#savePrompts();
    return deepClone(prompt);
  }

  /**
   * Delete a prompt by ID.
   *
   * @param {string} id — Prompt ID.
   * @returns {Promise<boolean>} `true` if deleted, `false` if not found.
   */
  async deletePrompt(id) {
    await this.#ensureLoaded();

    const existed = this.#prompts.delete(id);
    if (existed) await this.#savePrompts();
    return existed;
  }

  /**
   * Retrieve a single prompt by ID.
   *
   * @param {string} id — Prompt ID.
   * @returns {Promise<Prompt|null>} The prompt, or null.
   */
  async getPrompt(id) {
    await this.#ensureLoaded();
    const p = this.#prompts.get(id);
    return p ? deepClone(p) : null;
  }

  /**
   * Retrieve all prompts.
   *
   * @returns {Promise<Prompt[]>}
   */
  async getAllPrompts() {
    await this.#ensureLoaded();
    return [...this.#prompts.values()].map(deepClone);
  }

  /* ────────────────────────────────────────────
   *  Search & Filtering
   * ──────────────────────────────────────────── */

  /**
   * Search prompts with fuzzy matching and optional filters.
   *
   * @param {string} query — Text query (fuzzy-matched against title & content).
   * @param {Object}  [filters]
   * @param {string}  [filters.tag]      — Filter by tag.
   * @param {string}  [filters.folderId] — Filter by folder.
   * @param {number}  [filters.minRating] — Minimum star rating (1-5).
   * @param {string}  [filters.category] — Category filter.
   * @param {boolean} [filters.favoritesOnly] — Only favourites.
   * @returns {Promise<Prompt[]>} Matching prompts sorted by relevance.
   */
  async searchPrompts(query, filters = {}) {
    await this.#ensureLoaded();

    let results = [...this.#prompts.values()];

    // Apply hard filters first
    if (filters.tag) {
      const tag = filters.tag.toLowerCase();
      results = results.filter((p) => p.tags.includes(tag));
    }
    if (filters.folderId) {
      results = results.filter((p) => p.folderId === filters.folderId);
    }
    if (filters.minRating && filters.minRating > 0) {
      results = results.filter((p) => p.rating >= filters.minRating);
    }
    if (filters.category) {
      results = results.filter((p) => p.category === filters.category);
    }
    if (filters.favoritesOnly) {
      results = results.filter((p) => p.isFavorite);
    }

    // Apply fuzzy search if a query is provided
    if (query && query.trim().length > 0) {
      // Search against a combined title + content string for broader matching
      const enriched = results.map((p) => ({
        ...p,
        _searchText: `${p.title} ${p.content} ${p.tags.join(' ')}`,
      }));
      results = fuzzySearch(query, enriched, '_searchText').map((r) => {
        const { _searchText, ...clean } = r;
        return clean;
      });
    }

    return results.map(deepClone);
  }

  /**
   * Get all prompts in a given folder.
   *
   * @param {string} folderId — Folder ID.
   * @returns {Promise<Prompt[]>}
   */
  async getPromptsByFolder(folderId) {
    await this.#ensureLoaded();
    return [...this.#prompts.values()]
      .filter((p) => p.folderId === folderId)
      .map(deepClone);
  }

  /**
   * Get all prompts with a given tag.
   *
   * @param {string} tag — Tag string.
   * @returns {Promise<Prompt[]>}
   */
  async getPromptsByTag(tag) {
    await this.#ensureLoaded();
    const lowerTag = tag.toLowerCase();
    return [...this.#prompts.values()]
      .filter((p) => p.tags.includes(lowerTag))
      .map(deepClone);
  }

  /* ────────────────────────────────────────────
   *  Ratings & Favourites
   * ──────────────────────────────────────────── */

  /**
   * Set a star rating (1-5) for a prompt.
   *
   * @param {string} id     — Prompt ID.
   * @param {number} rating — Rating 1-5.
   * @returns {Promise<Prompt>}
   */
  async ratePrompt(id, rating) {
    const clamped = Math.max(0, Math.min(5, Math.round(rating)));
    return this.updatePrompt(id, { rating: clamped });
  }

  /**
   * Toggle the favourite/starred status of a prompt.
   *
   * @param {string} id — Prompt ID.
   * @returns {Promise<Prompt>}
   */
  async toggleFavorite(id) {
    await this.#ensureLoaded();
    const prompt = this.#prompts.get(id);
    if (!prompt) throw new Error(`Prompt not found: ${id}`);
    return this.updatePrompt(id, { isFavorite: !prompt.isFavorite });
  }

  /**
   * Retrieve all favourited prompts.
   *
   * @returns {Promise<Prompt[]>}
   */
  async getFavoritePrompts() {
    await this.#ensureLoaded();
    return [...this.#prompts.values()]
      .filter((p) => p.isFavorite)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map(deepClone);
  }

  /* ────────────────────────────────────────────
   *  Prompt Actions
   * ──────────────────────────────────────────── */

  /**
   * Duplicate an existing prompt (new ID, reset counters).
   *
   * @param {string} id — Prompt ID to duplicate.
   * @returns {Promise<Prompt>} The new duplicate prompt.
   */
  async duplicatePrompt(id) {
    await this.#ensureLoaded();
    const original = this.#prompts.get(id);
    if (!original) throw new Error(`Prompt not found: ${id}`);

    return this.createPrompt({
      title: `${original.title} (Copy)`,
      content: original.content,
      tags: [...original.tags],
      folderId: original.folderId,
      variables: [...original.variables],
      category: original.category,
    });
  }

  /**
   * Move a prompt to a different folder.
   *
   * @param {string}      id       — Prompt ID.
   * @param {string|null} folderId — Target folder ID (null = root).
   * @returns {Promise<Prompt>}
   */
  async movePrompt(id, folderId) {
    return this.updatePrompt(id, { folderId });
  }

  /**
   * Get the N most recently used or updated prompts.
   *
   * @param {number} [limit=10] — Max number of prompts to return.
   * @returns {Promise<Prompt[]>}
   */
  async getRecentPrompts(limit = 10) {
    await this.#ensureLoaded();
    return [...this.#prompts.values()]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit)
      .map(deepClone);
  }

  /* ────────────────────────────────────────────
   *  Folder CRUD
   * ──────────────────────────────────────────── */

  /**
   * Create a new folder.
   *
   * @param {Object} data
   * @param {string}      data.name     — Folder display name.
   * @param {string|null} [data.parentId=null] — Parent folder ID for nesting.
   * @param {string}      [data.icon='📁']    — Emoji or icon.
   * @param {string}      [data.color='#6C5CE7'] — CSS colour.
   * @returns {Promise<Folder>}
   */
  async createFolder({ name, parentId = null, icon = '📁', color = '#6C5CE7' }) {
    await this.#ensureLoaded();

    /** @type {Folder} */
    const folder = {
      id: generateId(),
      name: name?.trim() || 'Untitled Folder',
      parentId,
      icon: icon || '📁',
      color: color || '#6C5CE7',
      createdAt: new Date().toISOString(),
    };

    this.#folders.set(folder.id, folder);
    await this.#saveFolders();
    return deepClone(folder);
  }

  /**
   * Update an existing folder.
   *
   * @param {string} id      — Folder ID.
   * @param {Partial<Folder>} updates — Fields to update.
   * @returns {Promise<Folder>}
   */
  async updateFolder(id, updates) {
    await this.#ensureLoaded();

    const folder = this.#folders.get(id);
    if (!folder) throw new Error(`Folder not found: ${id}`);

    const immutable = new Set(['id', 'createdAt']);
    for (const [key, value] of Object.entries(updates)) {
      if (!immutable.has(key)) {
        folder[key] = value;
      }
    }

    this.#folders.set(id, folder);
    await this.#saveFolders();
    return deepClone(folder);
  }

  /**
   * Delete a folder. Prompts inside are moved to root (folderId = null).
   *
   * @param {string} id — Folder ID.
   * @returns {Promise<boolean>}
   */
  async deleteFolder(id) {
    await this.#ensureLoaded();

    const existed = this.#folders.delete(id);
    if (!existed) return false;

    // Orphan prompts inside the deleted folder → move to root
    let promptsModified = false;
    for (const prompt of this.#prompts.values()) {
      if (prompt.folderId === id) {
        prompt.folderId = null;
        promptsModified = true;
      }
    }

    // Also orphan any child folders → move to root
    for (const folder of this.#folders.values()) {
      if (folder.parentId === id) {
        folder.parentId = null;
      }
    }

    await this.#saveFolders();
    if (promptsModified) await this.#savePrompts();
    return true;
  }

  /**
   * Retrieve all folders.
   *
   * @returns {Promise<Folder[]>}
   */
  async getAllFolders() {
    await this.#ensureLoaded();
    return [...this.#folders.values()].map(deepClone);
  }

  /* ────────────────────────────────────────────
   *  Statistics
   * ──────────────────────────────────────────── */

  /**
   * Compute aggregate statistics about the user's prompt library.
   *
   * @returns {Promise<Object>} Stats object.
   */
  async getPromptStats() {
    await this.#ensureLoaded();

    const prompts = [...this.#prompts.values()];
    const total = prompts.length;

    if (total === 0) {
      return {
        totalPrompts: 0,
        totalFolders: this.#folders.size,
        averageRating: 0,
        totalUsage: 0,
        mostUsed: null,
        topRated: null,
        favoriteCount: 0,
        categoryCounts: {},
        tagCounts: {},
      };
    }

    // Most used prompt
    const sorted = [...prompts].sort((a, b) => b.usageCount - a.usageCount);
    const mostUsed = sorted[0];

    // Top rated
    const rated = prompts.filter((p) => p.rating > 0);
    const topRated = rated.length
      ? rated.sort((a, b) => b.rating - a.rating)[0]
      : null;

    // Average rating (only rated prompts)
    const avgRating = rated.length
      ? +(rated.reduce((s, p) => s + p.rating, 0) / rated.length).toFixed(1)
      : 0;

    // Totals
    const totalUsage = prompts.reduce((s, p) => s + p.usageCount, 0);
    const favoriteCount = prompts.filter((p) => p.isFavorite).length;

    // Category breakdown
    const categoryCounts = {};
    for (const p of prompts) {
      categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
    }

    // Tag breakdown
    const tagCounts = {};
    for (const p of prompts) {
      for (const t of p.tags) {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      }
    }

    return {
      totalPrompts: total,
      totalFolders: this.#folders.size,
      averageRating: avgRating,
      totalUsage,
      mostUsed: mostUsed ? { id: mostUsed.id, title: mostUsed.title, usageCount: mostUsed.usageCount } : null,
      topRated: topRated ? { id: topRated.id, title: topRated.title, rating: topRated.rating } : null,
      favoriteCount,
      categoryCounts,
      tagCounts,
    };
  }

  /* ────────────────────────────────────────────
   *  Import / Export
   * ──────────────────────────────────────────── */

  /**
   * Export selected prompts as a serialisable array.
   *
   * @param {string[]} [promptIds] — IDs to export. If omitted, exports all.
   * @returns {Promise<Object>} Export payload with version metadata.
   */
  async exportPrompts(promptIds) {
    await this.#ensureLoaded();

    let prompts;
    if (promptIds && promptIds.length > 0) {
      prompts = promptIds
        .map((id) => this.#prompts.get(id))
        .filter(Boolean)
        .map(deepClone);
    } else {
      prompts = [...this.#prompts.values()].map(deepClone);
    }

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      promptCount: prompts.length,
      prompts,
      folders: [...this.#folders.values()].map(deepClone),
    };
  }

  /**
   * Import prompts from a JSON payload with conflict resolution.
   *
   * @param {Object} jsonData — Previously exported payload.
   * @param {'skip'|'overwrite'|'duplicate'} [conflictStrategy='duplicate']
   *   How to handle prompts whose ID already exists.
   * @returns {Promise<{ imported: number, skipped: number, overwritten: number }>}
   */
  async importPrompts(jsonData, conflictStrategy = 'duplicate') {
    await this.#ensureLoaded();

    if (!jsonData?.prompts || !Array.isArray(jsonData.prompts)) {
      throw new Error('Invalid import data: missing "prompts" array');
    }

    const stats = { imported: 0, skipped: 0, overwritten: 0 };

    // Import folders first
    if (Array.isArray(jsonData.folders)) {
      for (const folder of jsonData.folders) {
        if (!this.#folders.has(folder.id)) {
          this.#folders.set(folder.id, deepClone(folder));
        }
      }
      await this.#saveFolders();
    }

    // Import prompts
    for (const prompt of jsonData.prompts) {
      const exists = this.#prompts.has(prompt.id);

      if (exists) {
        switch (conflictStrategy) {
          case 'skip':
            stats.skipped++;
            continue;

          case 'overwrite':
            this.#prompts.set(prompt.id, deepClone(prompt));
            stats.overwritten++;
            break;

          case 'duplicate':
          default: {
            const dup = deepClone(prompt);
            dup.id = generateId();
            dup.title = `${dup.title} (Imported)`;
            dup.createdAt = new Date().toISOString();
            dup.updatedAt = new Date().toISOString();
            this.#prompts.set(dup.id, dup);
            stats.imported++;
            break;
          }
        }
      } else {
        this.#prompts.set(prompt.id, deepClone(prompt));
        stats.imported++;
      }
    }

    await this.#savePrompts();
    return stats;
  }

  /* ────────────────────────────────────────────
   *  Cache Invalidation (for external listeners)
   * ──────────────────────────────────────────── */

  /**
   * Force-reload data from storage on the next operation.
   * Useful when another component has written directly to storage.
   */
  invalidateCache() {
    this.#loaded = false;
  }
}
