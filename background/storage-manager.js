/**
 * PromptFlow Pro — Storage Manager
 * ==================================
 * Centralised storage abstraction over chrome.storage.local / sync.
 * Features:
 *   • In-memory LRU cache for hot-path reads
 *   • Transparent get / set / remove with error handling
 *   • Quota-aware writes with warnings
 *   • Full backup & restore
 *   • Schema migration system for version upgrades
 *
 * @module background/storage-manager
 */

/* ─── Constants ────────────────────────────── */

/** Max items to keep in the in-memory cache */
const CACHE_MAX_SIZE = 200;

/** Warn when local storage exceeds this ratio (0-1) */
const QUOTA_WARNING_THRESHOLD = 0.85;

/** Key that tracks the current data schema version */
const SCHEMA_VERSION_KEY = 'pf_schema_version';

/** Current schema version — bump this when making breaking storage changes */
const CURRENT_SCHEMA_VERSION = 1;

/** Keys considered "important" enough to be synced to chrome.storage.sync */
const SYNCABLE_KEYS = ['pf_settings', 'pf_folders'];

/* ═══════════════════════════════════════════════
 *  StorageManager class
 * ═══════════════════════════════════════════════ */

export class StorageManager {
  /**
   * In-memory LRU cache.
   * We use a Map because its insertion order is preserved, making
   * it easy to evict the oldest entry when we exceed CACHE_MAX_SIZE.
   *
   * @type {Map<string, *>}
   */
  #cache = new Map();

  /* ────────── Cache helpers ────────── */

  /**
   * Read a value from cache, promoting it to "most-recently-used".
   *
   * @param {string} key
   * @returns {*|undefined}
   */
  #cacheGet(key) {
    if (!this.#cache.has(key)) return undefined;
    const value = this.#cache.get(key);
    // Promote by re-inserting
    this.#cache.delete(key);
    this.#cache.set(key, value);
    return value;
  }

  /**
   * Write a value into the cache, evicting the oldest if necessary.
   *
   * @param {string} key
   * @param {*} value
   */
  #cacheSet(key, value) {
    // Delete first to reset insertion order
    this.#cache.delete(key);
    this.#cache.set(key, value);

    // Evict oldest entries if over limit
    while (this.#cache.size > CACHE_MAX_SIZE) {
      const oldest = this.#cache.keys().next().value;
      this.#cache.delete(oldest);
    }
  }

  /**
   * Remove a key from the cache.
   *
   * @param {string} key
   */
  #cacheRemove(key) {
    this.#cache.delete(key);
  }

  /* ────────────────────────────────────────────
   *  Core CRUD
   * ──────────────────────────────────────────── */

  /**
   * Retrieve a value from storage.
   * Cache is checked first; on miss the value is fetched from
   * chrome.storage.local and cached.
   *
   * @param {string} key — Storage key.
   * @returns {Promise<*>} The stored value, or `undefined`.
   */
  async get(key) {
    // 1. Check cache
    const cached = this.#cacheGet(key);
    if (cached !== undefined) return cached;

    // 2. Fetch from chrome.storage.local
    try {
      const result = await chrome.storage.local.get(key);
      const value = result[key];

      if (value !== undefined) {
        this.#cacheSet(key, value);
      }

      return value;
    } catch (err) {
      console.error(`[StorageManager] get("${key}") failed:`, err);
      return undefined;
    }
  }

  /**
   * Store a value in chrome.storage.local and update the cache.
   *
   * @param {string} key   — Storage key.
   * @param {*}      value — Any JSON-serialisable value.
   * @returns {Promise<void>}
   */
  async set(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
      this.#cacheSet(key, value);

      // Check quota after write
      this.#checkQuota();
    } catch (err) {
      console.error(`[StorageManager] set("${key}") failed:`, err);
      throw new Error(`Storage write failed for "${key}": ${err.message}`);
    }
  }

  /**
   * Remove a key from storage and cache.
   *
   * @param {string} key
   * @returns {Promise<void>}
   */
  async remove(key) {
    try {
      await chrome.storage.local.remove(key);
      this.#cacheRemove(key);
    } catch (err) {
      console.error(`[StorageManager] remove("${key}") failed:`, err);
    }
  }

  /**
   * Get ALL data from chrome.storage.local.
   *
   * @returns {Promise<Record<string, *>>}
   */
  async getAll() {
    try {
      return await chrome.storage.local.get(null);
    } catch (err) {
      console.error('[StorageManager] getAll() failed:', err);
      return {};
    }
  }

  /**
   * Clear all data from chrome.storage.local and flush the cache.
   *
   * @returns {Promise<void>}
   */
  async clear() {
    try {
      await chrome.storage.local.clear();
      this.#cache.clear();
    } catch (err) {
      console.error('[StorageManager] clear() failed:', err);
    }
  }

  /* ────────────────────────────────────────────
   *  Sync
   * ──────────────────────────────────────────── */

  /**
   * Sync important keys to chrome.storage.sync so they survive
   * browser re-installs (subject to sync storage limits).
   *
   * @returns {Promise<{ synced: string[], errors: string[] }>}
   */
  async sync() {
    const synced = [];
    const errors = [];

    for (const key of SYNCABLE_KEYS) {
      try {
        const value = await this.get(key);
        if (value !== undefined) {
          // chrome.storage.sync has a per-item 8 KB limit
          const json = JSON.stringify(value);
          if (json.length > 8192) {
            console.warn(`[StorageManager] Skipping sync for "${key}": exceeds 8KB limit`);
            errors.push(`${key}: exceeds 8KB sync limit`);
            continue;
          }
          await chrome.storage.sync.set({ [key]: value });
          synced.push(key);
        }
      } catch (err) {
        console.error(`[StorageManager] sync("${key}") failed:`, err);
        errors.push(`${key}: ${err.message}`);
      }
    }

    return { synced, errors };
  }

  /* ────────────────────────────────────────────
   *  Storage Usage / Quota
   * ──────────────────────────────────────────── */

  /**
   * Get current storage usage information.
   *
   * @returns {Promise<{
   *   bytesUsed: number,
   *   quota: number,
   *   percentUsed: number,
   *   isNearQuota: boolean,
   *   cacheSize: number,
   *   display: string
   * }>}
   */
  async getUsage() {
    try {
      const bytesUsed = await new Promise((resolve) => {
        chrome.storage.local.getBytesInUse(null, resolve);
      });

      // chrome.storage.local default quota ≈ 10 MB (10,485,760 bytes)
      const quota = chrome.storage.local.QUOTA_BYTES || 10_485_760;
      const percentUsed = +((bytesUsed / quota) * 100).toFixed(2);
      const isNearQuota = percentUsed / 100 >= QUOTA_WARNING_THRESHOLD;

      const formatBytes = (b) => {
        if (b < 1024) return `${b} B`;
        if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
        return `${(b / 1_048_576).toFixed(2)} MB`;
      };

      return {
        bytesUsed,
        quota,
        percentUsed,
        isNearQuota,
        cacheSize: this.#cache.size,
        display: `${formatBytes(bytesUsed)} / ${formatBytes(quota)} (${percentUsed}%)`,
      };
    } catch (err) {
      console.error('[StorageManager] getUsage() failed:', err);
      return {
        bytesUsed: 0,
        quota: 10_485_760,
        percentUsed: 0,
        isNearQuota: false,
        cacheSize: this.#cache.size,
        display: 'Unknown',
      };
    }
  }

  /**
   * Internal: check quota and log a warning if near limit.
   */
  async #checkQuota() {
    try {
      const { isNearQuota, display } = await this.getUsage();
      if (isNearQuota) {
        console.warn(`[StorageManager] ⚠ Storage nearing quota: ${display}`);
      }
    } catch {
      // Non-critical — silently ignore
    }
  }

  /* ────────────────────────────────────────────
   *  Backup & Restore
   * ──────────────────────────────────────────── */

  /**
   * Create a full backup of all stored data.
   *
   * @returns {Promise<Object>} Backup payload with metadata.
   */
  async backup() {
    try {
      const allData = await this.getAll();

      return {
        _meta: {
          type: 'promptflow-pro-backup',
          version: CURRENT_SCHEMA_VERSION,
          createdAt: new Date().toISOString(),
          itemCount: Object.keys(allData).length,
        },
        data: allData,
      };
    } catch (err) {
      console.error('[StorageManager] backup() failed:', err);
      throw new Error(`Backup failed: ${err.message}`);
    }
  }

  /**
   * Restore data from a backup payload.
   * This REPLACES all current data.
   *
   * @param {Object} backupData — Previously created backup object.
   * @returns {Promise<{ restored: boolean, itemCount: number }>}
   */
  async restore(backupData) {
    if (!backupData?._meta?.type || backupData._meta.type !== 'promptflow-pro-backup') {
      throw new Error('Invalid backup file: missing or incorrect metadata');
    }

    if (!backupData.data || typeof backupData.data !== 'object') {
      throw new Error('Invalid backup file: missing data payload');
    }

    try {
      // Clear everything first
      await this.clear();

      // Write all backup data
      await chrome.storage.local.set(backupData.data);

      // Repopulate cache with frequently used keys
      for (const [key, value] of Object.entries(backupData.data)) {
        this.#cacheSet(key, value);
      }

      const itemCount = Object.keys(backupData.data).length;
      console.log(`[StorageManager] Restored ${itemCount} items from backup`);

      return { restored: true, itemCount };
    } catch (err) {
      console.error('[StorageManager] restore() failed:', err);
      throw new Error(`Restore failed: ${err.message}`);
    }
  }

  /* ────────────────────────────────────────────
   *  Schema Migration
   * ──────────────────────────────────────────── */

  /**
   * Run data-schema migrations between versions.
   * Each migration is a function that transforms the stored data.
   *
   * @param {number} fromVersion — The version stored on disk.
   * @param {number} toVersion   — The target version (usually CURRENT_SCHEMA_VERSION).
   * @returns {Promise<{ migrated: boolean, from: number, to: number }>}
   */
  async migrate(fromVersion, toVersion) {
    if (fromVersion >= toVersion) {
      return { migrated: false, from: fromVersion, to: toVersion };
    }

    console.log(`[StorageManager] Migrating schema v${fromVersion} → v${toVersion}`);

    /**
     * Registry of migration functions.
     * Each key is the version it migrates FROM.
     * The function receives the full data object and returns the transformed object.
     *
     * @type {Record<number, (data: Record<string,*>) => Record<string,*>>}
     */
    const migrations = {
      // Example: migration from v0 → v1
      0: (data) => {
        // v1: ensure all prompts have `variables` and `versions` arrays
        const prompts = data.pf_prompts || {};
        for (const id of Object.keys(prompts)) {
          const p = prompts[id];
          if (!Array.isArray(p.variables)) p.variables = [];
          if (!Array.isArray(p.versions)) p.versions = [];
          if (p.category === undefined) p.category = 'general';
          if (p.isFavorite === undefined) p.isFavorite = false;
          if (p.usageCount === undefined) p.usageCount = 0;
          if (p.rating === undefined) p.rating = 0;
        }
        data.pf_prompts = prompts;
        return data;
      },
      // Future migrations go here:
      // 1: (data) => { /* v1 → v2 */ return data; },
    };

    try {
      let data = await this.getAll();
      let currentVersion = fromVersion;

      while (currentVersion < toVersion) {
        const migrationFn = migrations[currentVersion];
        if (migrationFn) {
          data = migrationFn(data);
          console.log(`[StorageManager] Applied migration v${currentVersion} → v${currentVersion + 1}`);
        }
        currentVersion++;
      }

      // Save migrated data
      await chrome.storage.local.clear();
      await chrome.storage.local.set(data);
      await chrome.storage.local.set({ [SCHEMA_VERSION_KEY]: toVersion });

      // Flush cache
      this.#cache.clear();

      console.log(`[StorageManager] Migration complete: v${fromVersion} → v${toVersion}`);
      return { migrated: true, from: fromVersion, to: toVersion };
    } catch (err) {
      console.error('[StorageManager] Migration failed:', err);
      throw new Error(`Migration failed: ${err.message}`);
    }
  }

  /**
   * Check if migration is needed and run it if so.
   * Should be called once during extension startup.
   *
   * @returns {Promise<void>}
   */
  async ensureSchema() {
    const storedVersion = (await this.get(SCHEMA_VERSION_KEY)) ?? 0;

    if (storedVersion < CURRENT_SCHEMA_VERSION) {
      await this.migrate(storedVersion, CURRENT_SCHEMA_VERSION);
    }
  }
}
