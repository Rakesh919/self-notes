/**
 * editor.js
 * ---------------------------------------------------------------------------
 * Owns the note editor view: the six Interview-Mode section tabs, each with
 * a markdown textarea + live preview pane, plus the meta fields (title,
 * category, tags), the revision panel, and autosave.
 * ---------------------------------------------------------------------------
 */

const Editor = (() => {
  /** @type {Object|null} the note currently being edited (deep working copy) */
  let currentNote = null;
  /** @type {string} which of the NOTE_SECTIONS tabs is active */
  let activeSection = NOTE_SECTIONS[0].key;
  /** @type {boolean} split / edit-only / preview-only */
  let viewMode = 'split';

  const els = {};

  /** Grabs and caches the DOM nodes the editor needs. Called once on init. */
  function cacheEls() {
    els.root = document.getElementById('editorView');
    els.title = document.getElementById('noteTitleInput');
    els.category = document.getElementById('noteCategorySelect');
    els.tags = document.getElementById('noteTagsInput');
    els.tabs = document.getElementById('sectionTabs');
    els.textarea = document.getElementById('sectionTextarea');
    els.preview = document.getElementById('sectionPreview');
    els.wordCount = document.getElementById('wordCountStat');
    els.readingTime = document.getElementById('readingTimeStat');
    els.createdAt = document.getElementById('createdAtStat');
    els.updatedAt = document.getElementById('updatedAtStat');
    els.saveStatus = document.getElementById('saveStatus');
    els.viewModeButtons = document.querySelectorAll('.view-mode-btn');
    els.pinBtn = document.getElementById('pinNoteBtn');
    els.favBtn = document.getElementById('favNoteBtn');
    els.archiveBtn = document.getElementById('archiveNoteBtn');
    els.deleteBtn = document.getElementById('deleteNoteBtn');
    els.confidenceStars = document.getElementById('confidenceStars');
    els.lastRevision = document.getElementById('lastRevisionStat');
    els.nextRevision = document.getElementById('nextRevisionStat');
    els.revisionCount = document.getElementById('revisionCountStat');
    els.quickRevisionBtn = document.getElementById('quickRevisionBtn');
    els.toolbar = document.getElementById('editorToolbar');
  }

  /** Populates the category <select> once from the CATEGORIES constant. */
  function populateCategorySelect() {
    els.category.innerHTML = CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('');
  }

  /** Builds the six section tab buttons. */
  function renderTabs() {
    els.tabs.innerHTML = NOTE_SECTIONS.map(
      (s) => `<button class="section-tab ${s.key === activeSection ? 'active' : ''}" data-section="${s.key}" type="button">${s.label}</button>`
    ).join('');
  }

  /** Renders the confidence rating as five clickable stars/dial segments. */
  function renderConfidence() {
    const val = currentNote.confidence || 3;
    els.confidenceStars.innerHTML = [1, 2, 3, 4, 5]
      .map((n) => `<button class="conf-star ${n <= val ? 'filled' : ''}" data-conf="${n}" type="button" aria-label="Set confidence ${n}">★</button>`)
      .join('');
  }

  /** Updates the meta stat row (word count, reading time, dates, revision). */
  function renderStats() {
    const fullText = joinSections(currentNote.sections);
    const words = countWords(fullText);
    els.wordCount.textContent = `${words} word${words === 1 ? '' : 's'}`;
    els.readingTime.textContent = `${estimateReadingMinutes(words)} min read`;
    els.createdAt.textContent = formatDate(currentNote.createdAt);
    els.updatedAt.textContent = formatDate(currentNote.updatedAt);
    els.lastRevision.textContent = formatDate(currentNote.lastRevision);
    els.nextRevision.textContent = `${formatDate(currentNote.nextRevision)} (${formatRelativeDate(currentNote.nextRevision)})`;
    els.revisionCount.textContent = currentNote.revisionCount || 0;
  }

  /** Renders the markdown preview pane for the currently active section. */
  function renderPreview() {
    const md = currentNote.sections[activeSection] || '';
    els.preview.innerHTML = Markdown.render(md);
  }

  /** Applies the current viewMode ('split' | 'edit' | 'preview') to the DOM. */
  function applyViewMode() {
    els.root.querySelector('.editor-panes').setAttribute('data-mode', viewMode);
    els.viewModeButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === viewMode));
  }

  /** Loads the active section's markdown into the textarea + refreshes preview. */
  function loadActiveSectionIntoTextarea() {
    els.textarea.value = currentNote.sections[activeSection] || '';
    els.textarea.placeholder = NOTE_SECTIONS.find((s) => s.key === activeSection).placeholder;
    renderPreview();
  }

  /** Persists the note to IndexedDB and flashes a "Saved" status indicator. */
  const persist = debounce(async () => {
    els.saveStatus.textContent = 'Saving…';
    els.saveStatus.classList.add('saving');
    await DB.saveNote(currentNote);
    renderStats();
    els.saveStatus.textContent = 'Saved';
    els.saveStatus.classList.remove('saving');
    UI.refreshAfterNoteChange(currentNote);
  }, 500);

  /** Marks the note dirty, recalculates stats, and schedules a debounced save. */
  function scheduleSave() {
    currentNote.updatedAt = new Date().toISOString();
    renderStats();
    persist();
  }

  /** Wraps the current textarea selection with given markdown syntax. */
  function wrapSelection(before, after = before) {
    const ta = els.textarea;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.slice(start, end);
    const newValue = ta.value.slice(0, start) + before + selected + after + ta.value.slice(end);
    ta.value = newValue;
    ta.focus();
    ta.selectionStart = start + before.length;
    ta.selectionEnd = start + before.length + selected.length;
    onTextareaInput();
  }

  /** Inserts a block-level markdown snippet at the caret, on its own line. */
  function insertBlock(snippet) {
    const ta = els.textarea;
    const start = ta.selectionStart;
    const needsLeadingBreak = start > 0 && ta.value[start - 1] !== '\n';
    const insert = (needsLeadingBreak ? '\n' : '') + snippet + '\n';
    ta.value = ta.value.slice(0, start) + insert + ta.value.slice(start);
    ta.focus();
    const pos = start + insert.length;
    ta.selectionStart = ta.selectionEnd = pos;
    onTextareaInput();
  }

  /** Handles every keystroke in the textarea: syncs model + triggers save. */
  function onTextareaInput() {
    currentNote.sections[activeSection] = els.textarea.value;
    renderPreview();
    scheduleSave();
  }

  /** Wires up all editor event listeners. Called once on init. */
  function bindEvents() {
    els.title.addEventListener('input', () => {
      currentNote.title = els.title.value.trim() || 'Untitled Note';
      scheduleSave();
    });

    els.category.addEventListener('change', () => {
      currentNote.category = els.category.value;
      scheduleSave();
      UI.renderSidebarCounts();
    });

    els.tags.addEventListener('change', () => {
      currentNote.tags = els.tags.value
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      scheduleSave();
    });

    els.tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.section-tab');
      if (!btn) return;
      activeSection = btn.dataset.section;
      renderTabs();
      loadActiveSectionIntoTextarea();
    });

    els.textarea.addEventListener('input', onTextareaInput);

    els.viewModeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        viewMode = btn.dataset.mode;
        applyViewMode();
      });
    });

    els.pinBtn.addEventListener('click', () => {
      currentNote.pinned = !currentNote.pinned;
      els.pinBtn.classList.toggle('active', currentNote.pinned);
      scheduleSave();
    });

    els.favBtn.addEventListener('click', () => {
      currentNote.favorite = !currentNote.favorite;
      els.favBtn.classList.toggle('active', currentNote.favorite);
      scheduleSave();
    });

    els.archiveBtn.addEventListener('click', () => {
      currentNote.archived = !currentNote.archived;
      els.archiveBtn.classList.toggle('active', currentNote.archived);
      scheduleSave();
      UI.showToast(currentNote.archived ? 'Note archived' : 'Note restored from archive');
      UI.renderSidebarCounts();
    });

    els.deleteBtn.addEventListener('click', () => {
      UI.confirmDialog({
        title: 'Delete this note?',
        message: `"${currentNote.title}" will be permanently removed. This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
        onConfirm: async () => {
          await DB.deleteNote(currentNote.id);
          UI.showToast('Note deleted');
          UI.goToDashboard();
        }
      });
    });

    els.confidenceStars.addEventListener('click', (e) => {
      const btn = e.target.closest('.conf-star');
      if (!btn) return;
      currentNote.confidence = Number(btn.dataset.conf);
      renderConfidence();
      scheduleSave();
    });

    els.quickRevisionBtn.addEventListener('click', () => {
      UI.openRevisionModal(currentNote, (confidence) => {
        currentNote.confidence = confidence;
        currentNote.lastRevision = new Date().toISOString();
        currentNote.nextRevision = computeNextRevision(confidence);
        currentNote.revisionCount = (currentNote.revisionCount || 0) + 1;
        renderConfidence();
        renderStats();
        scheduleSave();
        UI.showToast('Revision logged — nicely done.');
      });
    });

    els.toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      switch (action) {
        case 'bold': wrapSelection('**'); break;
        case 'italic': wrapSelection('*'); break;
        case 'code': wrapSelection('`'); break;
        case 'strike': wrapSelection('~~'); break;
        case 'h2': insertBlock('## Heading'); break;
        case 'ul': insertBlock('- List item'); break;
        case 'ol': insertBlock('1. List item'); break;
        case 'check': insertBlock('- [ ] Task item'); break;
        case 'quote': insertBlock('> Quote'); break;
        case 'link': wrapSelection('[', '](https://)'); break;
        case 'image': insertBlock('![alt text](https://)'); break;
        case 'table':
          insertBlock('| Column A | Column B |\n| --- | --- |\n| value | value |');
          break;
        case 'codeblock':
          insertBlock('```java\n// your code here\n```');
          break;
        default: break;
      }
    });

    // Preview: copy-code buttons (delegated, since preview HTML is re-rendered often)
    els.preview.addEventListener('click', (e) => {
      const btn = e.target.closest('.copy-code-btn');
      if (!btn) return;
      const codeEl = document.getElementById(btn.dataset.copyTarget);
      if (!codeEl) return;
      navigator.clipboard.writeText(codeEl.textContent).then(() => {
        const original = btn.innerHTML;
        btn.innerHTML = '<span>Copied ✓</span>';
        setTimeout(() => (btn.innerHTML = original), 1400);
      });
    });
  }

  /**
   * Opens the editor with a given note object as the working copy.
   * @param {Object} note
   */
  function open(note) {
    currentNote = note;
    activeSection = NOTE_SECTIONS[0].key;
    viewMode = 'split';
    els.title.value = note.title;
    els.category.value = note.category;
    els.tags.value = (note.tags || []).join(', ');
    els.pinBtn.classList.toggle('active', !!note.pinned);
    els.favBtn.classList.toggle('active', !!note.favorite);
    els.archiveBtn.classList.toggle('active', !!note.archived);
    renderTabs();
    loadActiveSectionIntoTextarea();
    renderConfidence();
    renderStats();
    applyViewMode();
    els.saveStatus.textContent = 'Saved';
  }

  /** Initializes the editor module. Call once at app startup. */
  function init() {
    cacheEls();
    populateCategorySelect();
    bindEvents();
  }

  /** @returns {Object|null} the note currently open in the editor */
  function getCurrentNote() {
    return currentNote;
  }

  /** Forces an immediate (non-debounced) save — used by Ctrl+S. */
  async function saveNow() {
    if (!currentNote) return;
    await DB.saveNote(currentNote);
    els.saveStatus.textContent = 'Saved';
    renderStats();
    UI.refreshAfterNoteChange(currentNote);
    UI.showToast('Note saved');
  }

  return { init, open, getCurrentNote, saveNow };
})();
