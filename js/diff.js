/**
 * DiffNote — line-level diff engine (Story 4).
 *
 * Uses an LCS (Longest Common Subsequence) dynamic-programming table to
 * align two sequences of lines, then walks the table backwards to emit a
 * unified list of operations.
 *
 * NOTE: LCS DP is O(n*m) in time and memory, which is fine for typical
 * source files but not intended for very large inputs.
 *
 * Exposes `DiffNoteDiff.compute(beforeText, afterText)` on the global object.
 */
(function (global) {
  'use strict';

  /**
   * Split text into lines without inventing a trailing empty line.
   * Normalises CRLF/CR to LF first so line endings don't show as changes.
   */
  function splitLines(text) {
    if (text === '') return [];
    return text.replace(/\r\n?/g, '\n').split('\n');
  }

  /**
   * Build the LCS length table for two line arrays.
   * dp[i][j] = length of LCS of a[i:] and b[j:].
   */
  function buildLcsTable(a, b) {
    const n = a.length;
    const m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        if (a[i] === b[j]) {
          dp[i][j] = dp[i + 1][j + 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }
    return dp;
  }

  /**
   * Compute the diff between two text blobs.
   *
   * @returns {{
   *   rows: Array<{type:'unchanged'|'added'|'deleted', text:string,
   *                beforeLine:number|null, afterLine:number|null}>,
   *   stats: {added:number, deleted:number, unchanged:number, blocks:number}
   * }}
   */
  function compute(beforeText, afterText) {
    const a = splitLines(beforeText);
    const b = splitLines(afterText);
    const dp = buildLcsTable(a, b);

    const rows = [];
    let i = 0;
    let j = 0;
    let beforeLine = 1;
    let afterLine = 1;

    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        rows.push({ type: 'unchanged', text: a[i], beforeLine: beforeLine++, afterLine: afterLine++ });
        i++; j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        rows.push({ type: 'deleted', text: a[i], beforeLine: beforeLine++, afterLine: null });
        i++;
      } else {
        rows.push({ type: 'added', text: b[j], beforeLine: null, afterLine: afterLine++ });
        j++;
      }
    }
    while (i < a.length) {
      rows.push({ type: 'deleted', text: a[i], beforeLine: beforeLine++, afterLine: null });
      i++;
    }
    while (j < b.length) {
      rows.push({ type: 'added', text: b[j], beforeLine: null, afterLine: afterLine++ });
      j++;
    }

    // Stats
    let added = 0;
    let deleted = 0;
    let unchanged = 0;
    let blocks = 0;
    let inBlock = false;
    for (const row of rows) {
      if (row.type === 'unchanged') {
        unchanged++;
        inBlock = false;
      } else {
        if (row.type === 'added') added++;
        else deleted++;
        if (!inBlock) {
          blocks++;
          inBlock = true;
        }
      }
    }

    return { rows, stats: { added, deleted, unchanged, blocks } };
  }

  global.DiffNoteDiff = { compute, splitLines };
})(typeof self !== 'undefined' ? self : this);
