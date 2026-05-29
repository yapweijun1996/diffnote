/**
 * DiffNote — mock AI change-note generator (Stories 6 & 7).
 *
 * Produces a structured, deterministic "explanation" from local diff stats
 * only. No network, no real model. This is a placeholder that Epic 2 will
 * replace with a real local/remote LLM call.
 *
 * Exposes `DiffNoteAI.generate(diffResult, fileName)`.
 */
(function (global) {
  'use strict';

  const TYPE_KEYWORDS = [
    { type: 'fix', words: ['fix', 'bug', 'patch', 'error', 'null', 'catch', 'guard'] },
    { type: 'feat', words: ['add', 'feature', 'new', 'create', 'introduce', 'support'] },
    { type: 'refactor', words: ['refactor', 'rename', 'move', 'extract', 'cleanup', 'simplify'] },
    { type: 'docs', words: ['comment', 'readme', 'doc', 'license'] },
    { type: 'test', words: ['test', 'spec', 'assert', 'expect'] },
  ];

  /** Guess a conventional-commit type from the changed (added) lines. */
  function guessType(rows) {
    const addedText = rows
      .filter((r) => r.type === 'added')
      .map((r) => r.text.toLowerCase())
      .join(' ');
    for (const { type, words } of TYPE_KEYWORDS) {
      if (words.some((w) => addedText.includes(w))) return type;
    }
    return 'chore';
  }

  /** Build a conventional commit message capped at `maxLen` characters. */
  function buildCommitMessage(stats, fileName, rows, maxLen) {
    const limit = maxLen || 70;
    const type = guessType(rows);
    const scope = fileName ? fileName.replace(/\.[^.]+$/, '') : '';
    const head = scope ? `${type}(${scope})` : type;

    let summary;
    if (stats.added && stats.deleted) summary = `update ${stats.blocks} block(s)`;
    else if (stats.added) summary = `add ${stats.added} line(s)`;
    else if (stats.deleted) summary = `remove ${stats.deleted} line(s)`;
    else summary = 'no functional change';

    let msg = `${head}: ${summary}`;
    if (msg.length > limit) msg = msg.slice(0, Math.max(1, limit - 3)).trimEnd() + '...';
    return msg;
  }

  function riskNotes(stats) {
    const notes = [];
    if (stats.deleted > 0) notes.push(`${stats.deleted} line(s) removed — confirm nothing downstream relied on them.`);
    if (stats.blocks >= 3) notes.push(`${stats.blocks} separate change blocks — review each independently.`);
    if (stats.added === 0 && stats.deleted === 0) notes.push('No changes detected — files are identical.');
    if (notes.length === 0) notes.push('Low risk: small, localized change.');
    return notes;
  }

  function testSuggestions(stats, fileName) {
    const target = fileName || 'the changed file';
    const out = [];
    if (stats.added) out.push(`Add a test covering the new behavior in ${target}.`);
    if (stats.deleted) out.push(`Verify existing tests for ${target} still pass after the removal.`);
    out.push('Run the full test suite and check for regressions in dependent modules.');
    return out;
  }

  /**
   * @returns {{overview:string, breakdown:string[], commit:string,
   *            risks:string[], tests:string[]}}
   */
  function generate(diffResult, fileName, maxLen) {
    const { stats, rows } = diffResult;

    const overview =
      stats.added === 0 && stats.deleted === 0
        ? 'The two files are identical — no changes to describe.'
        : `This change touches ${stats.blocks} block(s): ${stats.added} line(s) added and ` +
          `${stats.deleted} line(s) removed, with ${stats.unchanged} line(s) unchanged.`;

    const breakdown = [];
    if (stats.added) breakdown.push(`Added ${stats.added} line(s).`);
    if (stats.deleted) breakdown.push(`Deleted ${stats.deleted} line(s).`);
    if (stats.blocks) breakdown.push(`Spread across ${stats.blocks} contiguous change block(s).`);
    if (breakdown.length === 0) breakdown.push('No line-level differences.');

    return {
      overview,
      breakdown,
      commit: buildCommitMessage(stats, fileName, rows, maxLen),
      risks: riskNotes(stats),
      tests: testSuggestions(stats, fileName),
    };
  }

  global.DiffNoteAI = { generate, buildCommitMessage };
})(typeof self !== 'undefined' ? self : this);
