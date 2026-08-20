/**
 * predictionEngine.js
 * ===================
 * Single source of truth for MH private MBBS admission probability and fee
 * calculations. Imported by BOTH the React frontend and the Express backend.
 *
 * Rules:
 *  - No browser-only APIs (no window, no document, no React).
 *  - No Node-only APIs (no fs, no path).
 *  - Pure functions only — no side effects, no external calls.
 *
 * This file is ESM (import/export). The project root has "type": "module" in
 * package.json, so server.js can import it at ./src/lib/predictionEngine.js.
 */

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * Safety margin below the state-quota cutoff that is still considered within
 * reach of a management-quota or boarderline prediction.
 * 0.08 = 8%, i.e. a student scoring ≥ 92% of the cutoff is "borderline".
 * Matches the previous frontend constant SAFETY_MARGIN = 0.08.
 */
export const SAFETY_MARGIN = 0.08;

/**
 * Maximum number of marks below the state-quota cutoff at which management
 * quota seats are still historically accessible.
 * Matches the previous frontend constant MGMT_MARGIN = 100.
 */
export const MGMT_MARGIN = 100;

/**
 * Fixed annual fee ceiling (in rupees) used to flag a college as "budget-
 * friendly" in the UI.  This is a display constant only — it does NOT affect
 * probability classification.
 */
export const BUDGET_CAP = 1_000_000;

// ── calcFee ───────────────────────────────────────────────────────────────────

/**
 * Return the applicable annual fee (in rupees) for a student given the
 * college's fee schedule, their reservation category, and gender.
 *
 * Fee-schedule key names must match what is stored in the database table
 * `college_fees`.category column:
 *   open | obc_ebc_sebc_male | obc_ebc_sebc_female | vjnt_sbc | sc_st | institutional
 *
 * @param {Record<string,number>} fees     - College fee object keyed by category string.
 * @param {string}                category - Admission category (open|obc|sebc|vjnt|sc|st|ews|nri).
 * @param {string}                gender   - 'male' | 'female' | 'any'.
 * @returns {number|null}  Annual fee in rupees, or null if unavailable.
 */
export function calcFee(fees, category, gender) {
  if (!fees) return null;

  // SC / ST share one fee slab
  if (category === 'sc' || category === 'st') return fees.sc_st ?? null;

  // VJNT / NT / SBC
  if (category === 'vjnt') return fees.vjnt_sbc ?? null;

  // OBC / SEBC — female concession applies
  if (category === 'obc' || category === 'sebc') {
    return gender === 'female'
      ? (fees.obc_ebc_sebc_female ?? null)
      : (fees.obc_ebc_sebc_male   ?? null);
  }

  // EWS and Open share the open fee slab
  return fees.open ?? null;
}

// ── calcProb ──────────────────────────────────────────────────────────────────

/**
 * Classify a student's probability of admission at a given college.
 *
 * Algorithm tiers (evaluated top-to-bottom, first match wins):
 *
 *  1. NO DATA — cutoff is null/0 → { prob: 'low', viaMgmt: false }
 *     Cannot predict without historical data.
 *
 *  2. HIGH (state quota) — score ≥ cutoff → { prob: 'high', viaMgmt: false }
 *     Student qualifies directly for a state-quota seat.
 *
 *  3. HIGH (management quota) — score is within SAFETY_MARGIN of cutoff AND canAfford
 *     → { prob: 'high', viaMgmt: true }
 *     Student is within 8% of the cutoff.  If they can afford management-quota
 *     fees, this tier becomes attainable because management-quota closing scores
 *     historically track the state-quota cutoff closely.
 *
 *  4. BORDERLINE (safety margin, no budget) — score within SAFETY_MARGIN but
 *     canAfford is false → { prob: 'borderline', viaMgmt: false }
 *     Student is close but cannot afford the management route.
 *
 *  5. BORDERLINE (management quota) — score is within MGMT_MARGIN marks below
 *     the cutoff AND canAfford → { prob: 'borderline', viaMgmt: true }
 *     Management quota seats typically close 60–100 marks below the state-quota
 *     cutoff.  Student is within reach but below the safety margin.
 *
 *  6. LOW — all other cases → { prob: 'low', viaMgmt: false }
 *
 * @param {number}       score             - Student's NEET score (integer, 0–720).
 * @param {number|null}  cutoff            - Historical closing score for this college+category.
 * @param {object}       [options]
 * @param {boolean}      [options.canAfford=false]
 *   Whether the student's annual budget covers this college's applicable fee.
 *   When false the management-quota upgrade paths are suppressed.
 *
 * @returns {{ prob: 'high'|'borderline'|'low', viaMgmt: boolean }}
 *   prob     — primary probability bucket (safe to compare as a string).
 *   viaMgmt  — true when the result depends on the management-quota route.
 *              Useful for UI badges; ignored by API consumers who only need prob.
 */
export function calcProb(score, cutoff, { canAfford = false } = {}) {
  // Tier 1 — no data
  if (!cutoff) return { prob: 'low', viaMgmt: false };

  // Tier 2 — direct state-quota seat
  if (score >= cutoff) return { prob: 'high', viaMgmt: false };

  // Safety-margin boundary: SAFETY_MARGIN below the cutoff
  const safetyFloor = Math.round(cutoff * (1 - SAFETY_MARGIN));

  // Tier 3 & 4 — within SAFETY_MARGIN of cutoff
  if (score >= safetyFloor) {
    return canAfford
      ? { prob: 'high',       viaMgmt: true  }  // Tier 3: upgrade via management
      : { prob: 'borderline', viaMgmt: false };  // Tier 4: borderline, no management budget
  }

  // Tier 5 — within MGMT_MARGIN marks, management budget available
  if (canAfford && score >= cutoff - MGMT_MARGIN) {
    return { prob: 'borderline', viaMgmt: true };
  }

  // Tier 6 — too far below cutoff
  return { prob: 'low', viaMgmt: false };
}
