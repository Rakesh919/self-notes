/**
 * utils.js
 * ---------------------------------------------------------------------------
 * Small, dependency-free helper functions shared across PrepVault.
 * Nothing in here touches the DOM or IndexedDB directly — pure utilities only.
 * ---------------------------------------------------------------------------
 */

/** Ordered list of subject categories shown in the sidebar. */
const CATEGORIES = [
  'Java',
  'Spring Boot',
  'Spring Security',
  'Hibernate',
  'SQL',
  'Docker',
  'Kubernetes',
  'Redis',
  'Kafka',
  'Microservices',
  'System Design',
  'DSA'
];

/** The six fixed "Interview Mode" sections every note is built from. */
const NOTE_SECTIONS = [
  { key: 'summary', label: 'Summary', icon: 'file-text', placeholder: 'A short, plain-language summary of the topic...' },
  { key: 'importantPoints', label: 'Important Points', icon: 'list', placeholder: '- Key fact one\n- Key fact two' },
  { key: 'interviewQuestions', label: 'Interview Questions', icon: 'help-circle', placeholder: '**Q: Sample question?**\nA: Sample answer.' },
  { key: 'commonMistakes', label: 'Common Mistakes', icon: 'alert-triangle', placeholder: '- Mistake candidates often make...' },
  { key: 'codeExample', label: 'Code Example', icon: 'code', placeholder: '```java\npublic class Example {}\n```' },
  { key: 'resources', label: 'Resources', icon: 'link', placeholder: '- [Docs](https://example.com)' }
];

/**
 * Generates a reasonably unique id (UUID v4-ish) without any external library.
 * @returns {string}
 */
function generateId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Debounces a function so it only runs after `wait` ms of silence.
 * @param {Function} fn
 * @param {number} wait
 * @returns {Function}
 */
function debounce(fn, wait = 400) {
  let t = null;
  return function debounced(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

/**
 * Escapes HTML-significant characters so raw user text is never interpreted
 * as markup (used before markdown rendering re-introduces safe tags).
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats an ISO date string into a short, readable form, e.g. "23 Jul 2026".
 * @param {string|null} iso
 * @returns {string}
 */
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Formats an ISO date into a relative-feeling label ("Today", "Tomorrow",
 * "in 3 days", "3 days ago") for revision scheduling UI.
 * @param {string|null} iso
 * @returns {string}
 */
function formatRelativeDate(iso) {
  if (!iso) return '—';
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target - today) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1) return `in ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}

/**
 * Counts words in a blob of markdown text (strips code fences/markup lightly).
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
  if (!text) return 0;
  const stripped = text.replace(/```[\s\S]*?```/g, ' ').replace(/[`*_#>\-\[\]()]/g, ' ');
  const words = stripped.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

/**
 * Estimates reading time in minutes from a word count (200 wpm average).
 * @param {number} words
 * @returns {number}
 */
function estimateReadingMinutes(words) {
  return Math.max(1, Math.ceil(words / 200));
}

/**
 * Concatenates every markdown section of a note into one string, for
 * word-count / search-indexing purposes.
 * @param {Object} sections
 * @returns {string}
 */
function joinSections(sections) {
  if (!sections) return '';
  return NOTE_SECTIONS.map((s) => sections[s.key] || '').join('\n\n');
}

/**
 * Triggers a client-side download of a text blob as a file.
 * @param {string} filename
 * @param {string} content
 * @param {string} mime
 */
function downloadFile(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Reads a File object as text (Promise wrapper around FileReader).
 * @param {File} file
 * @returns {Promise<string>}
 */
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Computes the next revision date given a confidence rating (1-5), using a
 * lightweight spaced-repetition curve: lower confidence = sooner review.
 * @param {number} confidence
 * @param {Date} [from]
 * @returns {string} ISO date string
 */
function computeNextRevision(confidence, from = new Date()) {
  const daysByConfidence = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 };
  const days = daysByConfidence[confidence] || 3;
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  next.setHours(9, 0, 0, 0);
  return next.toISOString();
}

/**
 * Returns true if the given ISO date is today or earlier (i.e. due).
 * @param {string|null} iso
 * @returns {boolean}
 */
function isDueOrOverdue(iso) {
  if (!iso) return false;
  const target = new Date(iso);
  target.setHours(23, 59, 59, 999);
  return target.getTime() <= Date.now();
}

/**
 * Simple slugify, used for anchor-ish ids when needed.
 * @param {string} str
 */
function slugify(str) {
  return String(str).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * Clamp a number between min and max.
 */
function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
