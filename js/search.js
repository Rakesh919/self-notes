/**
 * search.js
 * ---------------------------------------------------------------------------
 * Pure search/filter logic over an in-memory array of notes. No DOM access —
 * ui.js calls into this module and renders whatever it returns.
 * ---------------------------------------------------------------------------
 */

const Search = (() => {
  /**
   * Scores & filters notes against a free-text query across title, tags,
   * content (all six sections) and category. Returns matches sorted by a
   * simple relevance score (title matches rank highest).
   * @param {Object[]} notes
   * @param {string} query
   * @returns {Object[]}
   */
  function query(notes, query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];

    const scored = [];
    for (const note of notes) {
      let score = 0;
      const title = (note.title || '').toLowerCase();
      const category = (note.category || '').toLowerCase();
      const tags = (note.tags || []).join(' ').toLowerCase();
      const content = joinSections(note.sections).toLowerCase();

      if (title.includes(q)) score += 10;
      if (title.startsWith(q)) score += 5;
      if (tags.includes(q)) score += 6;
      if (category.includes(q)) score += 4;
      if (content.includes(q)) score += 2;

      if (score > 0) scored.push({ note, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.note);
  }

  /**
   * Builds a short, query-highlighted snippet of matching content for
   * search-result previews.
   * @param {Object} note
   * @param {string} q
   * @returns {string} plain text snippet (HTML-escaped by caller)
   */
  function buildSnippet(note, q) {
    const content = joinSections(note.sections);
    const lower = content.toLowerCase();
    const idx = lower.indexOf((q || '').toLowerCase());
    if (idx === -1) return content.slice(0, 120).trim();
    const start = Math.max(0, idx - 40);
    const end = Math.min(content.length, idx + q.length + 60);
    return (start > 0 ? '…' : '') + content.slice(start, end).trim() + (end < content.length ? '…' : '');
  }

  /**
   * Applies sidebar/category + tab filters (all / pinned / favorites /
   * archived) to a note list. Does not handle free-text search.
   * @param {Object[]} notes
   * @param {{category?: string, view?: string}} filters
   * @returns {Object[]}
   */
  function applyFilters(notes, filters = {}) {
    let result = notes;
    if (!filters.includeArchived) {
      result = result.filter((n) => !n.archived);
    }
    if (filters.category) {
      result = result.filter((n) => n.category === filters.category);
    }
    if (filters.view === 'pinned') result = result.filter((n) => n.pinned);
    if (filters.view === 'favorites') result = result.filter((n) => n.favorite);
    if (filters.view === 'archived') result = notes.filter((n) => n.archived);
    if (filters.view === 'due') result = result.filter((n) => isDueOrOverdue(n.nextRevision));
    return result;
  }

  return { query, buildSnippet, applyFilters };
})();
