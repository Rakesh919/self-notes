/**
 * db.js
 * ---------------------------------------------------------------------------
 * All IndexedDB access for PrepVault lives here. Nothing outside this file
 * should touch `indexedDB` directly — every other module calls the async
 * functions exported on the `DB` namespace object below.
 *
 * Database: "PrepVaultDB"
 * Store:    "notes"   (keyPath: id)
 * Store:    "settings" (keyPath: key)  — small key/value store (theme, etc.)
 * ---------------------------------------------------------------------------
 */

const DB = (() => {
  const DB_NAME = 'PrepVaultDB';
  const DB_VERSION = 1;
  const NOTES_STORE = 'notes';
  const SETTINGS_STORE = 'settings';

  /** @type {IDBDatabase|null} */
  let dbInstance = null;

  /**
   * Opens (and if necessary creates/upgrades) the IndexedDB database.
   * Safe to call many times — subsequent calls reuse the open connection.
   * @returns {Promise<IDBDatabase>}
   */
  function open() {
    if (dbInstance) return Promise.resolve(dbInstance);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(NOTES_STORE)) {
          const store = db.createObjectStore(NOTES_STORE, { keyPath: 'id' });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('pinned', 'pinned', { unique: false });
          store.createIndex('favorite', 'favorite', { unique: false });
          store.createIndex('archived', 'archived', { unique: false });
          store.createIndex('nextRevision', 'nextRevision', { unique: false });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = (event) => {
        reject(event.target.error || new Error('Failed to open IndexedDB'));
      };
    });
  }

  /**
   * Runs a transaction against a store and wraps it in a Promise.
   * @param {string} storeName
   * @param {IDBTransactionMode} mode
   * @param {(store: IDBObjectStore) => IDBRequest} work
   * @returns {Promise<any>}
   */
  async function withStore(storeName, mode, work) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const req = work(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Builds a brand-new, empty note object with sensible defaults.
   * @param {Partial<Object>} overrides
   * @returns {Object}
   */
  function createEmptyNote(overrides = {}) {
    const now = new Date().toISOString();
    const emptySections = {};
    NOTE_SECTIONS.forEach((s) => (emptySections[s.key] = ''));
    return Object.assign(
      {
        id: generateId(),
        title: 'Untitled Note',
        category: CATEGORIES[0],
        tags: [],
        pinned: false,
        favorite: false,
        archived: false,
        confidence: 3,
        lastRevision: null,
        nextRevision: computeNextRevision(3, new Date()),
        revisionCount: 0,
        createdAt: now,
        updatedAt: now,
        sections: emptySections
      },
      overrides
    );
  }

  /**
   * Persists (creates or overwrites) a note.
   * @param {Object} note
   * @returns {Promise<Object>} the saved note
   */
  async function saveNote(note) {
    note.updatedAt = new Date().toISOString();
    await withStore(NOTES_STORE, 'readwrite', (store) => store.put(note));
    return note;
  }

  /**
   * Fetches every note in the database.
   * @returns {Promise<Object[]>}
   */
  async function getAllNotes() {
    const notes = await withStore(NOTES_STORE, 'readonly', (store) => store.getAll());
    return notes || [];
  }

  /**
   * Fetches a single note by id.
   * @param {string} id
   * @returns {Promise<Object|undefined>}
   */
  async function getNote(id) {
    return withStore(NOTES_STORE, 'readonly', (store) => store.get(id));
  }

  /**
   * Deletes a note by id.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async function deleteNote(id) {
    return withStore(NOTES_STORE, 'readwrite', (store) => store.delete(id));
  }

  /**
   * Wipes every note (used only by the "Restore Database" overwrite flow).
   * @returns {Promise<void>}
   */
  async function clearNotes() {
    return withStore(NOTES_STORE, 'readwrite', (store) => store.clear());
  }

  /**
   * Reads a single setting value.
   * @param {string} key
   * @returns {Promise<any>}
   */
  async function getSetting(key) {
    const row = await withStore(SETTINGS_STORE, 'readonly', (store) => store.get(key));
    return row ? row.value : undefined;
  }

  /**
   * Writes a single setting value.
   * @param {string} key
   * @param {any} value
   * @returns {Promise<void>}
   */
  async function setSetting(key, value) {
    return withStore(SETTINGS_STORE, 'readwrite', (store) => store.put({ key, value }));
  }

  return {
    open,
    createEmptyNote,
    saveNote,
    getAllNotes,
    getNote,
    deleteNote,
    clearNotes,
    getSetting,
    setSetting
  };
})();
