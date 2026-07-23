# PrepVault

A fully offline, single-user interview-preparation knowledge base for Java backend development — built with plain HTML, CSS, and vanilla JavaScript. No frameworks, no backend, no build step, no login. Everything is stored locally in your browser via IndexedDB.

## Running it

Just open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari), or host the folder as-is on GitHub Pages / any static host. There is nothing to install or build.

On first launch, PrepVault seeds itself with five sample notes across different subjects so the UI isn't empty — feel free to delete them.

## Project structure

```
prepvault/
├── index.html        Markup / app shell
├── style.css          All styling (dark + light themes, fully responsive)
├── js/
│   ├── utils.js       Small pure helper functions (dates, ids, word counts...)
│   ├── db.js          IndexedDB wrapper (notes + settings stores)
│   ├── markdown.js     Self-contained Markdown renderer + syntax highlighter
│   ├── editor.js      Note editor: sections, toolbar, autosave, revisions
│   ├── search.js      Free-text search + filter logic
│   ├── ui.js          Sidebar, dashboard, note grid, modals, toasts
│   └── app.js          Boot sequence, import/export/backup/restore, shortcuts
└── README.md
```

## Features

- **Notes** organized by 12 subjects (Java, Spring Boot, Spring Security, Hibernate, SQL, Docker, Kubernetes, Redis, Kafka, Microservices, System Design, DSA)
- **Interview Mode**: every note has six fixed sections — Summary, Important Points, Interview Questions, Common Mistakes, Code Example, Resources — each with its own Markdown editor + live preview
- **Revision system**: 1–5 confidence rating, last/next revision dates, revision counter, and a one-click "Quick Revision" flow that recalculates the next review date using a simple spaced-repetition curve (1★ → tomorrow, 5★ → in a month)
- **Pin, favorite, and archive** notes independently
- **Search** by title, tag, category, or content via the command palette (`Ctrl+F`)
- **Markdown**: headings, bold/italic/strikethrough, inline code, fenced code blocks with copy-to-clipboard and basic syntax highlighting (Java/SQL/JS/Bash), tables, checklists, blockquotes, links, images
- **Word count & reading time**, created/updated timestamps
- **Import / Export** notes as JSON; separate **Backup / Restore** for a full database snapshot including theme
- **Dark / light theme** toggle, persisted across sessions
- **Keyboard shortcuts**: `Ctrl+N` new note, `Ctrl+S` save, `Ctrl+F` search, `Ctrl+/` shortcut help, `Esc` closes any dialog
- Mobile-first, fully responsive, off-canvas sidebar on small screens

## Data & privacy

Nothing is sent anywhere. All notes live in your browser's IndexedDB (`PrepVaultDB`). Clearing your browser's site data for this page will delete everything — use **Backup** regularly if that matters to you.

## Notes on the Markdown engine

To avoid pulling in any external library, PrepVault ships its own small Markdown → HTML renderer and a regex-based syntax highlighter (`js/markdown.js`). It covers everything the note format uses, but it is intentionally a subset of full CommonMark, not a complete spec implementation.

## Run this project using this command
- python3 -m http.server 8080