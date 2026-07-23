/**
 * ui.js
 * ---------------------------------------------------------------------------
 * Everything that touches the DOM outside of the editor itself: sidebar,
 * dashboard, note-list grid, modals (confirm / revision / shortcuts),
 * toasts, and the command-palette search overlay. app.js wires this module
 * together with db.js / editor.js / search.js.
 * ---------------------------------------------------------------------------
 */

const UI = (() => {
  /** @type {Object[]} in-memory cache of every note, kept in sync with IndexedDB */
  let allNotes = [];
  /** @type {{category: string|null, view: string|null}} current list filters */
  let currentFilter = { category: null, view: null };
  /** currently active top-level view: 'dashboard' | 'list' | 'editor' */
  let activeView = 'dashboard';

  const els = {};

  /** Caches DOM references used throughout the UI module. */
  function cacheEls() {
    els.sidebar = document.getElementById('sidebar');
    els.categoryList = document.getElementById('categoryList');
    els.navItems = document.querySelectorAll('.nav-item[data-view]');
    els.dashboardView = document.getElementById('dashboardView');
    els.listView = document.getElementById('listView');
    els.editorView = document.getElementById('editorView');
    els.listTitle = document.getElementById('listViewTitle');
    els.listGrid = document.getElementById('noteListGrid');
    els.listEmpty = document.getElementById('noteListEmpty');
    els.toastContainer = document.getElementById('toastContainer');
    els.confirmOverlay = document.getElementById('confirmDialog');
    els.revisionOverlay = document.getElementById('revisionModal');
    els.shortcutsOverlay = document.getElementById('shortcutsModal');
    els.commandPalette = document.getElementById('commandPalette');
    els.commandInput = document.getElementById('commandInput');
    els.commandResults = document.getElementById('commandResults');
    els.searchTrigger = document.getElementById('searchTrigger');
    els.statTotal = document.getElementById('statTotalNotes');
    els.statDueToday = document.getElementById('statDueToday');
    els.statPending = document.getElementById('statPendingRevision');
    els.statCategories = document.getElementById('categoryStats');
    els.recentList = document.getElementById('recentNotesList');
    els.pinnedList = document.getElementById('pinnedNotesList');
  }

  // ---------------------------------------------------------------------
  // Toasts
  // ---------------------------------------------------------------------

  /**
   * Shows a small transient toast notification.
   * @param {string} message
   * @param {'info'|'success'|'error'} type
   */
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    els.toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // ---------------------------------------------------------------------
  // Modals
  // ---------------------------------------------------------------------

  /**
   * Opens a generic confirm/cancel dialog.
   * @param {{title:string, message:string, confirmLabel?:string, danger?:boolean, onConfirm:Function}} opts
   */
  function confirmDialog(opts) {
    const overlay = els.confirmOverlay;
    overlay.querySelector('.modal-title').textContent = opts.title;
    overlay.querySelector('.modal-message').textContent = opts.message;
    const confirmBtn = overlay.querySelector('.modal-confirm-btn');
    confirmBtn.textContent = opts.confirmLabel || 'Confirm';
    confirmBtn.classList.toggle('btn-danger', !!opts.danger);
    confirmBtn.classList.toggle('btn-accent', !opts.danger);
    overlay.classList.remove('hidden');

    function cleanup() {
      overlay.classList.add('hidden');
      confirmBtn.removeEventListener('click', onConfirmClick);
    }
    function onConfirmClick() {
      cleanup();
      opts.onConfirm && opts.onConfirm();
    }
    confirmBtn.addEventListener('click', onConfirmClick);
    overlay.querySelectorAll('[data-close-modal]').forEach((btn) =>
      btn.addEventListener('click', cleanup, { once: true })
    );
  }

  /**
   * Opens the "Quick Revision" modal, letting the user rate confidence 1-5.
   * @param {Object} note
   * @param {(confidence:number)=>void} onSubmit
   */
  function openRevisionModal(note, onSubmit) {
    const overlay = els.revisionOverlay;
    overlay.classList.remove('hidden');
    const starsWrap = overlay.querySelector('.revision-modal-stars');
    let picked = note.confidence || 3;

    function draw() {
      starsWrap.innerHTML = [1, 2, 3, 4, 5]
        .map((n) => `<button class="conf-star-lg ${n <= picked ? 'filled' : ''}" data-conf="${n}" type="button">★</button>`)
        .join('');
    }
    draw();

    function onStarClick(e) {
      const btn = e.target.closest('.conf-star-lg');
      if (!btn) return;
      picked = Number(btn.dataset.conf);
      draw();
    }
    starsWrap.addEventListener('click', onStarClick);

    const submitBtn = overlay.querySelector('.revision-submit-btn');
    function cleanup() {
      overlay.classList.add('hidden');
      starsWrap.removeEventListener('click', onStarClick);
      submitBtn.removeEventListener('click', onSubmitClick);
    }
    function onSubmitClick() {
      cleanup();
      onSubmit(picked);
    }
    submitBtn.addEventListener('click', onSubmitClick);
    overlay.querySelectorAll('[data-close-modal]').forEach((btn) =>
      btn.addEventListener('click', cleanup, { once: true })
    );
  }

  /** Toggles the keyboard-shortcuts help modal. */
  function toggleShortcutsModal() {
    els.shortcutsOverlay.classList.toggle('hidden');
  }

  // ---------------------------------------------------------------------
  // Sidebar
  // ---------------------------------------------------------------------

  /** Renders the category list in the sidebar with live note counts. */
  function renderSidebarCounts() {
    els.categoryList.innerHTML = CATEGORIES.map((cat) => {
      const count = allNotes.filter((n) => n.category === cat && !n.archived).length;
      const isActive = activeView === 'list' && currentFilter.category === cat;
      return `<button class="nav-item category-item ${isActive ? 'active' : ''}" data-category="${cat}">
        <span class="cat-dot"></span>${cat}<span class="count-badge">${count}</span>
      </button>`;
    }).join('');
  }

  /** Highlights the correct sidebar nav item for special views (pinned, etc). */
  function highlightSidebar() {
    els.navItems.forEach((btn) => {
      const isDashboard = btn.dataset.view === 'dashboard' && activeView === 'dashboard';
      const isSpecial = btn.dataset.view === currentFilter.view && activeView === 'list';
      btn.classList.toggle('active', isDashboard || isSpecial);
    });
    renderSidebarCounts();
  }

  // ---------------------------------------------------------------------
  // Note card (shared by list view + dashboard "recent/pinned" widgets)
  // ---------------------------------------------------------------------

  /**
   * Builds the HTML for a single note card.
   * @param {Object} note
   * @returns {string}
   */
  function noteCardHtml(note) {
    const words = countWords(joinSections(note.sections));
    const overdue = isDueOrOverdue(note.nextRevision);
    const tagHtml = (note.tags || [])
      .slice(0, 4)
      .map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`)
      .join('');
    return `<article class="note-card" data-id="${note.id}" tabindex="0">
      <div class="note-card-top">
        <span class="category-pill">${escapeHtml(note.category)}</span>
        <div class="note-card-flags">
          ${note.pinned ? '<span title="Pinned">📌</span>' : ''}
          ${note.favorite ? '<span title="Favorite">⭐</span>' : ''}
          ${note.archived ? '<span title="Archived">🗄</span>' : ''}
        </div>
      </div>
      <h3 class="note-card-title">${escapeHtml(note.title)}</h3>
      <p class="note-card-snippet">${escapeHtml((note.sections.summary || 'No summary yet.').slice(0, 110))}</p>
      <div class="note-card-tags">${tagHtml}</div>
      <div class="note-card-footer">
        <div class="mini-dial" data-conf="${note.confidence}" title="Confidence ${note.confidence}/5">
          <svg viewBox="0 0 36 36" width="26" height="26">
            <circle cx="18" cy="18" r="15.5" class="dial-track"></circle>
            <circle cx="18" cy="18" r="15.5" class="dial-fill" style="stroke-dasharray:${(note.confidence / 5) * 97.4} 97.4"></circle>
          </svg>
          <span>${note.confidence}</span>
        </div>
        <span class="note-card-meta">${words}w · ${estimateReadingMinutes(words)}m</span>
        <span class="note-card-revision ${overdue ? 'overdue' : ''}">${overdue ? 'Due ' : 'Next '}${formatRelativeDate(note.nextRevision)}</span>
      </div>
    </article>`;
  }

  /** Delegated click handler shared by any container of `.note-card` elements. */
  function bindNoteCardClicks(container) {
    container.addEventListener('click', (e) => {
      const card = e.target.closest('.note-card');
      if (!card) return;
      openNoteById(card.dataset.id);
    });
    container.addEventListener('keypress', (e) => {
      if (e.key !== 'Enter') return;
      const card = e.target.closest('.note-card');
      if (!card) return;
      openNoteById(card.dataset.id);
    });
  }

  // ---------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------

  /** Renders the entire dashboard view from `allNotes`. */
  function renderDashboard() {
    const active = allNotes.filter((n) => !n.archived);
    els.statTotal.textContent = active.length;

    const dueToday = active.filter((n) => {
      if (!n.nextRevision) return false;
      const d = new Date(n.nextRevision);
      const today = new Date();
      return d.toDateString() === today.toDateString();
    });
    els.statDueToday.textContent = dueToday.length;

    const overdue = active.filter((n) => isDueOrOverdue(n.nextRevision));
    els.statPending.textContent = overdue.length;

    els.statCategories.innerHTML = CATEGORIES.map((cat) => {
      const count = active.filter((n) => n.category === cat).length;
      const max = Math.max(1, ...CATEGORIES.map((c) => active.filter((n) => n.category === c).length));
      const pct = Math.round((count / max) * 100);
      return `<button class="cat-stat-row" data-category="${cat}">
        <span class="cat-stat-label">${cat}</span>
        <span class="cat-stat-bar-track"><span class="cat-stat-bar-fill" style="width:${pct}%"></span></span>
        <span class="cat-stat-count">${count}</span>
      </button>`;
    }).join('');
    els.statCategories.querySelectorAll('.cat-stat-row').forEach((btn) =>
      btn.addEventListener('click', () => showListView({ category: btn.dataset.category, view: null }))
    );

    const recent = [...active].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 6);
    els.recentList.innerHTML = recent.length
      ? recent.map(noteCardHtml).join('')
      : '<p class="empty-hint">No notes yet — create your first one to get started.</p>';
    bindNoteCardClicks(els.recentList);

    const pinned = active.filter((n) => n.pinned).slice(0, 6);
    els.pinnedList.innerHTML = pinned.length
      ? pinned.map(noteCardHtml).join('')
      : '<p class="empty-hint">Pin important notes to see them here.</p>';
    bindNoteCardClicks(els.pinnedList);
  }

  // ---------------------------------------------------------------------
  // List view
  // ---------------------------------------------------------------------

  /** Titles shown above the note grid for each special view. */
  const VIEW_TITLES = {
    pinned: 'Pinned Notes',
    favorites: 'Favorite Notes',
    archived: 'Archived Notes',
    due: 'Due for Revision'
  };

  /**
   * Switches to the filtered note-list view.
   * @param {{category?:string|null, view?:string|null}} filter
   */
  function showListView(filter) {
    currentFilter = { category: filter.category || null, view: filter.view || null };
    switchView('list');
    els.listTitle.textContent = currentFilter.category || VIEW_TITLES[currentFilter.view] || 'All Notes';
    renderListView();
    highlightSidebar();
  }

  /** Re-renders the note grid using the current filter state. */
  function renderListView() {
    const filtered = Search.applyFilters(allNotes, {
      category: currentFilter.category,
      view: currentFilter.view,
      includeArchived: currentFilter.view === 'archived'
    });
    const sorted = [...filtered].sort((a, b) => {
      if (!!b.pinned !== !!a.pinned) return b.pinned - a.pinned;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    els.listGrid.innerHTML = sorted.map(noteCardHtml).join('');
    els.listEmpty.classList.toggle('hidden', sorted.length > 0);
    bindNoteCardClicks(els.listGrid);
  }

  // ---------------------------------------------------------------------
  // View switching
  // ---------------------------------------------------------------------

  /** Shows exactly one of dashboard/list/editor and hides the others. */
  function switchView(view) {
    activeView = view;
    els.dashboardView.classList.toggle('hidden', view !== 'dashboard');
    els.listView.classList.toggle('hidden', view !== 'list');
    els.editorView.classList.toggle('hidden', view !== 'editor');
    document.getElementById('mainContent').scrollTo({ top: 0 });
  }

  /** Navigates to the dashboard and refreshes its data. */
  function goToDashboard() {
    currentFilter = { category: null, view: null };
    switchView('dashboard');
    renderDashboard();
    highlightSidebar();
  }

  /**
   * Opens a note (by id) in the editor, refreshing the in-memory cache first.
   * @param {string} id
   */
  async function openNoteById(id) {
    const note = await DB.getNote(id);
    if (!note) {
      showToast('That note could not be found — it may have been deleted.', 'error');
      return;
    }
    Editor.open(note);
    switchView('editor');
  }

  /** Creates a brand new note, saves it, and opens it in the editor. */
  async function createNewNote() {
    const note = DB.createEmptyNote({ category: currentFilter.category || CATEGORIES[0] });
    await DB.saveNote(note);
    allNotes.push(note);
    Editor.open(note);
    switchView('editor');
    showToast('New note created');
  }

  /**
   * Called by editor.js after any save — keeps the in-memory cache and any
   * currently visible list/dashboard in sync without a full DB re-read.
   * @param {Object} note
   */
  function refreshAfterNoteChange(note) {
    const idx = allNotes.findIndex((n) => n.id === note.id);
    if (idx >= 0) allNotes[idx] = note;
    else allNotes.push(note);
    renderSidebarCounts();
    if (activeView === 'dashboard') renderDashboard();
    if (activeView === 'list') renderListView();
  }

  /** Reloads every note fresh from IndexedDB into the in-memory cache. */
  async function reloadAllNotes() {
    allNotes = await DB.getAllNotes();
  }

  // ---------------------------------------------------------------------
  // Command palette (search overlay)
  // ---------------------------------------------------------------------

  /** Opens the command-palette search overlay and focuses its input. */
  function openCommandPalette() {
    els.commandPalette.classList.remove('hidden');
    els.commandInput.value = '';
    els.commandResults.innerHTML = '<p class="empty-hint">Start typing to search titles, tags, categories and note content.</p>';
    setTimeout(() => els.commandInput.focus(), 30);
  }

  /** Closes the command-palette overlay. */
  function closeCommandPalette() {
    els.commandPalette.classList.add('hidden');
  }

  /** Renders live search results inside the command palette. */
  function renderCommandResults(q) {
    if (!q.trim()) {
      els.commandResults.innerHTML = '<p class="empty-hint">Start typing to search titles, tags, categories and note content.</p>';
      return;
    }
    const results = Search.query(allNotes.filter((n) => !n.archived), q).slice(0, 20);
    if (!results.length) {
      els.commandResults.innerHTML = `<p class="empty-hint">No notes match "${escapeHtml(q)}".</p>`;
      return;
    }
    els.commandResults.innerHTML = results
      .map((note) => {
        const snippet = Search.buildSnippet(note, q);
        return `<button class="command-result" data-id="${note.id}">
          <span class="command-result-title">${escapeHtml(note.title)}</span>
          <span class="command-result-cat">${escapeHtml(note.category)}</span>
          <span class="command-result-snippet">${escapeHtml(snippet)}</span>
        </button>`;
      })
      .join('');
    els.commandResults.querySelectorAll('.command-result').forEach((btn) =>
      btn.addEventListener('click', () => {
        closeCommandPalette();
        openNoteById(btn.dataset.id);
      })
    );
  }

  // ---------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------

  /**
   * Applies and persists a theme ('dark' | 'light').
   * @param {string} theme
   */
  async function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    await DB.setSetting('theme', theme);
  }

  // ---------------------------------------------------------------------
  // Wiring for things that live inside ui.js's own DOM (sidebar clicks etc.)
  // ---------------------------------------------------------------------

  function bindStaticEvents() {
    els.navItems.forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view === 'dashboard') goToDashboard();
        else showListView({ view, category: null });
      });
    });

    els.categoryList.addEventListener('click', (e) => {
      const btn = e.target.closest('.category-item');
      if (!btn) return;
      showListView({ category: btn.dataset.category, view: null });
    });

    document.getElementById('createNoteBtnList').addEventListener('click', createNewNote);
  }

  /** Public init — called once from app.js after DB + notes are ready. */
  async function init(notes) {
    allNotes = notes;
    cacheEls();
    bindStaticEvents();
    renderSidebarCounts();
    goToDashboard();
  }

  return {
    init,
    showToast,
    confirmDialog,
    openRevisionModal,
    toggleShortcutsModal,
    renderSidebarCounts,
    goToDashboard,
    showListView,
    openNoteById,
    createNewNote,
    refreshAfterNoteChange,
    reloadAllNotes,
    openCommandPalette,
    closeCommandPalette,
    renderCommandResults,
    applyTheme,
    getAllNotesCache: () => allNotes
  };
})();
