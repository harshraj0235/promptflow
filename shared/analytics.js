/**
 * PromptFlow Pro — Usage Analytics
 * ==================================
 * Lightweight, privacy-first analytics that stay entirely local
 * inside `chrome.storage.local`. Data is bucketed by calendar day
 * (YYYY-MM-DD) for efficient aggregation.
 *
 * Storage key: `pf_analytics`
 * Structure:
 *   {
 *     dailyBuckets: { "2026-05-26": DayBucket, … },
 *     promptUsage:  { promptId: number, … },
 *     platforms:    { platformName: number, … },
 *     enhancements: { count, totalOrigLen, totalEnhancedLen },
 *     totalUsage:   number
 *   }
 *
 * @module shared/analytics
 */

import { deepClone } from './utils.js';

/* ─── Storage key ──────────────────────────── */
const STORAGE_KEY = 'pf_analytics';

/** Assumed seconds saved per prompt reuse */
const SECONDS_PER_REUSE = 30;

/**
 * @typedef {Object} DayBucket
 * @property {number} promptUses      — Number of prompt uses that day.
 * @property {number} enhancements    — Number of enhancement events.
 * @property {Record<string,number>} platforms — Platform usage counts.
 */

/**
 * @typedef {Object} AnalyticsStore
 * @property {Record<string,DayBucket>} dailyBuckets
 * @property {Record<string,number>}    promptUsage — promptId → total uses.
 * @property {Record<string,number>}    platforms   — platform → total uses.
 * @property {{ count:number, totalOrigLen:number, totalEnhancedLen:number }} enhancements
 * @property {number}                   totalUsage
 */

/* ═══════════════════════════════════════════════
 *  Analytics class
 * ═══════════════════════════════════════════════ */

export class Analytics {
  /** @type {AnalyticsStore|null} */
  #data = null;

  /** @type {boolean} */
  #loaded = false;

  /* ────────── Internals ────────── */

  /** @returns {string} Today's key, e.g. "2026-05-26" */
  #today() {
    return new Date().toISOString().slice(0, 10);
  }

  /** Hydrate from storage. */
  async #ensureLoaded() {
    if (this.#loaded) return;

    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      this.#data = result[STORAGE_KEY] || this.#emptyStore();
      this.#loaded = true;
    } catch (err) {
      console.error('[Analytics] Load failed:', err);
      this.#data = this.#emptyStore();
      this.#loaded = true;
    }
  }

  /** @returns {AnalyticsStore} Fresh, empty store. */
  #emptyStore() {
    return {
      dailyBuckets: {},
      promptUsage: {},
      platforms: {},
      enhancements: { count: 0, totalOrigLen: 0, totalEnhancedLen: 0 },
      totalUsage: 0,
    };
  }

  /** Get (or create) today's bucket. @returns {DayBucket} */
  #bucket() {
    const key = this.#today();
    if (!this.#data.dailyBuckets[key]) {
      this.#data.dailyBuckets[key] = { promptUses: 0, enhancements: 0, platforms: {} };
    }
    return this.#data.dailyBuckets[key];
  }

  /** Persist to chrome.storage.local. */
  async #save() {
    await chrome.storage.local.set({ [STORAGE_KEY]: this.#data });
  }

  /* ────────────────────────────────────────────
   *  Tracking Methods
   * ──────────────────────────────────────────── */

  /**
   * Log a prompt usage event.
   *
   * @param {string} promptId — The prompt that was used.
   * @returns {Promise<void>}
   */
  async trackPromptUsage(promptId) {
    await this.#ensureLoaded();

    this.#data.totalUsage++;
    this.#data.promptUsage[promptId] = (this.#data.promptUsage[promptId] || 0) + 1;
    this.#bucket().promptUses++;

    await this.#save();
  }

  /**
   * Log a prompt enhancement event.
   *
   * @param {number} originalLength  — Character length of the original prompt.
   * @param {number} enhancedLength  — Character length after enhancement.
   * @returns {Promise<void>}
   */
  async trackEnhancement(originalLength, enhancedLength) {
    await this.#ensureLoaded();

    this.#data.enhancements.count++;
    this.#data.enhancements.totalOrigLen += originalLength;
    this.#data.enhancements.totalEnhancedLen += enhancedLength;
    this.#bucket().enhancements++;

    await this.#save();
  }

  /**
   * Log usage of a specific AI platform.
   *
   * @param {string} platformName — e.g. "ChatGPT", "Claude", "Gemini".
   * @returns {Promise<void>}
   */
  async trackPlatform(platformName) {
    await this.#ensureLoaded();

    const name = platformName.trim();
    this.#data.platforms[name] = (this.#data.platforms[name] || 0) + 1;

    const bucket = this.#bucket();
    bucket.platforms[name] = (bucket.platforms[name] || 0) + 1;

    await this.#save();
  }

  /* ────────────────────────────────────────────
   *  Query Methods
   * ──────────────────────────────────────────── */

  /**
   * Get usage counts segmented by time period.
   *
   * @returns {Promise<{ today: number, thisWeek: number, thisMonth: number, total: number }>}
   */
  async getUsageStats() {
    await this.#ensureLoaded();

    const now = new Date();
    const todayKey = this.#today();

    // Build date sets for this week and this month
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let today = 0;
    let thisWeek = 0;
    let thisMonth = 0;

    for (const [dateStr, bucket] of Object.entries(this.#data.dailyBuckets)) {
      const d = new Date(dateStr + 'T00:00:00');
      const uses = bucket.promptUses || 0;

      if (dateStr === todayKey) today += uses;
      if (d >= startOfWeek) thisWeek += uses;
      if (d >= startOfMonth) thisMonth += uses;
    }

    return {
      today,
      thisWeek,
      thisMonth,
      total: this.#data.totalUsage,
    };
  }

  /**
   * Get the most frequently used prompts.
   *
   * @param {number} [limit=10] — Max results.
   * @returns {Promise<Array<{ promptId: string, uses: number }>>}
   */
  async getMostUsedPrompts(limit = 10) {
    await this.#ensureLoaded();

    return Object.entries(this.#data.promptUsage)
      .map(([promptId, uses]) => ({ promptId, uses }))
      .sort((a, b) => b.uses - a.uses)
      .slice(0, limit);
  }

  /**
   * Get usage breakdown by AI platform.
   *
   * @returns {Promise<Record<string, number>>} Platform → total uses.
   */
  async getPlatformBreakdown() {
    await this.#ensureLoaded();
    return deepClone(this.#data.platforms);
  }

  /**
   * Get enhancement usage statistics.
   *
   * @returns {Promise<{
   *   totalEnhancements: number,
   *   avgOriginalLength: number,
   *   avgEnhancedLength: number,
   *   avgExpansionRatio: number
   * }>}
   */
  async getEnhancementStats() {
    await this.#ensureLoaded();

    const { count, totalOrigLen, totalEnhancedLen } = this.#data.enhancements;

    if (count === 0) {
      return {
        totalEnhancements: 0,
        avgOriginalLength: 0,
        avgEnhancedLength: 0,
        avgExpansionRatio: 0,
      };
    }

    const avgOrig = Math.round(totalOrigLen / count);
    const avgEnhanced = Math.round(totalEnhancedLen / count);

    return {
      totalEnhancements: count,
      avgOriginalLength: avgOrig,
      avgEnhancedLength: avgEnhanced,
      avgExpansionRatio: totalOrigLen > 0 ? +(totalEnhancedLen / totalOrigLen).toFixed(2) : 0,
    };
  }

  /**
   * Get daily usage data for the last N days (suitable for chart rendering).
   *
   * @param {number} [days=30] — Number of days to include.
   * @returns {Promise<Array<{ date: string, uses: number, enhancements: number }>>}
   */
  async getDailyUsage(days = 30) {
    await this.#ensureLoaded();

    const result = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const bucket = this.#data.dailyBuckets[key];

      result.push({
        date: key,
        uses: bucket?.promptUses || 0,
        enhancements: bucket?.enhancements || 0,
      });
    }

    return result;
  }

  /**
   * Estimate total time saved by reusing prompts.
   * Assumes ~30 seconds saved per prompt reuse.
   *
   * @returns {Promise<{ totalSeconds: number, totalMinutes: number, display: string }>}
   */
  async getTimeSaved() {
    await this.#ensureLoaded();

    const totalSeconds = this.#data.totalUsage * SECONDS_PER_REUSE;
    const totalMinutes = Math.round(totalSeconds / 60);

    let display;
    if (totalMinutes < 1) {
      display = `${totalSeconds} seconds`;
    } else if (totalMinutes < 60) {
      display = `${totalMinutes} minute${totalMinutes !== 1 ? 's' : ''}`;
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      display = `${hours} hour${hours !== 1 ? 's' : ''}${mins > 0 ? ` ${mins} min` : ''}`;
    }

    return { totalSeconds, totalMinutes, display };
  }

  /**
   * Reset all analytics data.
   *
   * @returns {Promise<void>}
   */
  async resetStats() {
    this.#data = this.#emptyStore();
    this.#loaded = true;
    await this.#save();
  }

  /**
   * Force-reload from storage.
   */
  invalidateCache() {
    this.#loaded = false;
  }
}
