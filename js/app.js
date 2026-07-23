/**
 * app.js
 * ---------------------------------------------------------------------------
 * Application entry point. Boots the database, seeds sample content on a
 * first run, initializes UI + Editor modules, and wires up the top bar
 * (create / import / export / backup / restore / theme) plus global
 * keyboard shortcuts.
 * ---------------------------------------------------------------------------
 */

(function App() {
  const els = {};

  /** Caches top-bar / global DOM references. */
  function cacheEls() {
    els.createNoteBtn = document.getElementById('createNoteBtn');
    els.importBtn = document.getElementById('importBtn');
    els.importFileInput = document.getElementById('importFileInput');
    els.exportBtn = document.getElementById('exportBtn');
    els.backupBtn = document.getElementById('backupBtn');
    els.restoreBtn = document.getElementById('restoreBtn');
    els.restoreFileInput = document.getElementById('restoreFileInput');
    els.themeToggleBtn = document.getElementById('themeToggleBtn');
    els.shortcutsBtn = document.getElementById('shortcutsBtn');
    els.searchTrigger = document.getElementById('searchTrigger');
    els.commandInput = document.getElementById('commandInput');
    els.commandPalette = document.getElementById('commandPalette');
    els.sidebarToggle = document.getElementById('sidebarToggle');
    els.sidebar = document.getElementById('sidebar');
    els.sidebarScrim = document.getElementById('sidebarScrim');
  }

  /**
   * Builds a handful of realistic sample notes so the app isn't empty on
   * first launch. Only runs once, when the notes store is completely empty.
   */
  async function seedIfEmpty() {
    const existing = await DB.getAllNotes();
    if (existing.length > 0) return;

    const samples = [
      {
        title: 'HashMap Internals',
        category: 'Java',
        tags: ['collections', 'core-java', 'hashing'],
        confidence: 3,
        pinned: true,
        sections: {
          summary: 'HashMap stores key-value pairs using an array of buckets, where each bucket is a linked list (or a red-black tree once a bucket gets large in Java 8+).',
          importantPoints:
            '- Backed by `Node<K,V>[] table`\n- Default capacity is 16, default load factor is 0.75\n- Resizes (rehashes) when size exceeds capacity * loadFactor\n- Since Java 8, long buckets (>=8 entries) convert to a red-black tree for O(log n) worst case\n- Not thread-safe — use `ConcurrentHashMap` for concurrent access',
          interviewQuestions:
            '**Q: What happens on a hash collision?**\nA: The new entry is appended to the bucket\'s linked list (or inserted into its tree form).\n\n**Q: Why should hashCode() and equals() be consistent?**\nA: HashMap relies on hashCode() to find the bucket and equals() to confirm key identity within that bucket.',
          commonMistakes:
            '- Using a mutable object as a key and then changing it after insertion\n- Assuming HashMap preserves insertion order (use `LinkedHashMap` instead)\n- Forgetting HashMap allows one null key',
          codeExample:
            '```java\nMap<String, Integer> scores = new HashMap<>();\nscores.put("Rakesh", 95);\nscores.put("Aditi", 88);\n\nfor (Map.Entry<String, Integer> entry : scores.entrySet()) {\n    System.out.println(entry.getKey() + " -> " + entry.getValue());\n}\n```',
          resources: '- [Java HashMap source (OpenJDK)](https://github.com/openjdk/jdk)\n- [Baeldung: HashMap Guide](https://www.baeldung.com/java-hashmap)'
        }
      },
      {
        title: 'Spring Boot Auto-Configuration',
        category: 'Spring Boot',
        tags: ['spring-boot', 'core-concepts'],
        confidence: 4,
        pinned: true,
        sections: {
          summary: 'Auto-configuration attempts to automatically configure your Spring application based on the jar dependencies present on the classpath.',
          importantPoints:
            '- Enabled via `@EnableAutoConfiguration` (bundled inside `@SpringBootApplication`)\n- Driven by `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`\n- Each `@Configuration` class is conditional — `@ConditionalOnClass`, `@ConditionalOnMissingBean`, etc.\n- You can exclude specific auto-configurations with `exclude = {...}`',
          interviewQuestions:
            '**Q: How does Spring Boot decide which beans to auto-configure?**\nA: It inspects the classpath and existing bean definitions, applying `@Conditional*` annotations to decide whether each configuration class should activate.\n\n**Q: How would you override an auto-configured bean?**\nA: Define your own bean of the same type — `@ConditionalOnMissingBean` backs off automatically.',
          commonMistakes: '- Fighting auto-configuration instead of overriding a single bean\n- Not knowing how to debug it with `--debug` (prints the auto-configuration report)',
          codeExample:
            '```java\n@SpringBootApplication\npublic class LogipodApplication {\n    public static void main(String[] args) {\n        SpringApplication.run(LogipodApplication.class, args);\n    }\n}\n```',
          resources: '- [Spring Boot Reference Docs — Auto-configuration](https://docs.spring.io/spring-boot/reference/using/auto-configuration.html)'
        }
      },
      {
        title: 'JWT Auth Flow',
        category: 'Spring Security',
        tags: ['jwt', 'security', 'authentication'],
        confidence: 2,
        sections: {
          summary: 'A stateless authentication flow where the server issues a signed JSON Web Token after login, and the client sends it on every request via the Authorization header.',
          importantPoints:
            '- Structure: `header.payload.signature`, base64url encoded\n- Signature verifies integrity (HMAC or RSA) — payload itself is NOT encrypted, just signed\n- Store access tokens short-lived (e.g. 15 min); use refresh tokens for renewal\n- A custom `OncePerRequestFilter` typically validates the token and populates `SecurityContextHolder`',
          interviewQuestions:
            '**Q: Where should you store a JWT on the client?**\nA: Depends on threat model — httpOnly cookies avoid XSS token theft but need CSRF protection; localStorage is simpler but vulnerable to XSS.\n\n**Q: How do you invalidate a JWT before expiry?**\nA: JWTs are stateless by design; common approaches are short expiry + refresh tokens, or maintaining a server-side blocklist.',
          commonMistakes: '- Putting sensitive data in the payload assuming it\'s encrypted\n- Using a weak or hardcoded signing secret\n- Never rotating or expiring refresh tokens',
          codeExample:
            '```java\npublic class JwtAuthFilter extends OncePerRequestFilter {\n    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)\n            throws ServletException, IOException {\n        String token = extractToken(req);\n        if (token != null && jwtService.isValid(token)) {\n            var auth = jwtService.getAuthentication(token);\n            SecurityContextHolder.getContext().setAuthentication(auth);\n        }\n        chain.doFilter(req, res);\n    }\n}\n```',
          resources: '- [JWT.io Introduction](https://jwt.io/introduction)'
        }
      },
      {
        title: 'Kafka vs RabbitMQ',
        category: 'Kafka',
        tags: ['messaging', 'system-design'],
        confidence: 3,
        sections: {
          summary: 'Kafka is a distributed append-only log built for high-throughput event streaming; RabbitMQ is a traditional message broker built around flexible routing and per-message delivery guarantees.',
          importantPoints:
            '- Kafka retains messages for a configurable period regardless of consumption; RabbitMQ removes messages once acknowledged\n- Kafka scales via partitions and consumer groups; RabbitMQ scales via exchanges/queues and clustering\n- RabbitMQ supports complex routing (topic, fanout, direct exchanges) natively\n- Kafka is generally preferred for event sourcing, log aggregation, and stream processing',
          interviewQuestions:
            '**Q: When would you pick RabbitMQ over Kafka?**\nA: When you need complex routing logic, lower operational overhead, or classic task-queue semantics rather than a durable event log.',
          commonMistakes: '- Treating Kafka like a traditional queue (deleting messages after "consuming")\n- Ignoring partition key design, which controls ordering guarantees',
          codeExample: '```yaml\nspring:\n  kafka:\n    bootstrap-servers: localhost:9092\n    consumer:\n      group-id: logipod-service\n      auto-offset-reset: earliest\n```',
          resources: '- [Kafka vs RabbitMQ — Confluent](https://www.confluent.io/)'
        }
      },
      {
        title: 'Two Pointers Pattern',
        category: 'DSA',
        tags: ['leetcode', 'patterns', 'arrays'],
        confidence: 4,
        favorite: true,
        sections: {
          summary: 'A technique using two indices moving through a data structure (often from both ends, or one ahead of the other) to avoid nested loops.',
          importantPoints:
            '- Common on sorted arrays: shrink the search space by moving left/right pointers\n- Fast/slow pointer variant detects cycles (Floyd\'s algorithm) or finds the middle of a linked list\n- Reduces many O(n²) brute-force solutions to O(n)',
          interviewQuestions: '**Q: How would you find a pair summing to a target in a sorted array?**\nA: Start pointers at both ends; move the low pointer up if the sum is too small, the high pointer down if too large.',
          commonMistakes: '- Forgetting the array must be sorted for the classic two-sum variant\n- Off-by-one errors when pointers cross',
          codeExample:
            '```java\npublic boolean hasPairWithSum(int[] arr, int target) {\n    int lo = 0, hi = arr.length - 1;\n    while (lo < hi) {\n        int sum = arr[lo] + arr[hi];\n        if (sum == target) return true;\n        if (sum < target) lo++; else hi--;\n    }\n    return false;\n}\n```',
          resources: '- [NeetCode — Two Pointers](https://neetcode.io/)'
        }
      }
    ];

    for (const sample of samples) {
      const note = DB.createEmptyNote({
        title: sample.title,
        category: sample.category,
        tags: sample.tags,
        confidence: sample.confidence,
        pinned: !!sample.pinned,
        favorite: !!sample.favorite,
        sections: Object.assign({}, sample.sections)
      });
      note.nextRevision = computeNextRevision(sample.confidence);
      await DB.saveNote(note);
    }
  }

  // -------------------------------------------------------------------
  // Import / Export / Backup / Restore
  // -------------------------------------------------------------------

  /** Exports every note as a downloadable JSON file. */
  async function exportAllNotes() {
    const notes = await DB.getAllNotes();
    const payload = { exportedAt: new Date().toISOString(), type: 'prepvault-notes', notes };
    downloadFile(`prepvault-notes-${slugify(new Date().toISOString().slice(0, 10))}.json`, JSON.stringify(payload, null, 2));
    UI.showToast(`Exported ${notes.length} notes`);
  }

  /** Imports notes from a user-selected JSON file, merging by id. */
  async function importNotesFromFile(file) {
    try {
      const text = await readFileAsText(file);
      const parsed = JSON.parse(text);
      const notes = Array.isArray(parsed) ? parsed : parsed.notes;
      if (!Array.isArray(notes)) throw new Error('Unrecognized file format');
      let imported = 0;
      for (const raw of notes) {
        if (!raw || !raw.title) continue;
        const note = DB.createEmptyNote(Object.assign({}, raw, { id: raw.id || generateId() }));
        await DB.saveNote(note);
        imported++;
      }
      await UI.reloadAllNotes();
      UI.renderSidebarCounts();
      UI.goToDashboard();
      UI.showToast(`Imported ${imported} notes`);
    } catch (err) {
      console.error(err);
      UI.showToast('Import failed — file was not valid PrepVault JSON', 'error');
    }
  }

  /** Full database backup: identical to export, kept as a distinct action/label. */
  async function backupDatabase() {
    const notes = await DB.getAllNotes();
    const theme = (await DB.getSetting('theme')) || 'dark';
    const payload = { backedUpAt: new Date().toISOString(), type: 'prepvault-full-backup', settings: { theme }, notes };
    downloadFile(`prepvault-backup-${slugify(new Date().toISOString().slice(0, 10))}.json`, JSON.stringify(payload, null, 2));
    UI.showToast('Backup downloaded');
  }

  /** Restores a full database backup, overwriting all existing notes. */
  async function restoreDatabase(file) {
    UI.confirmDialog({
      title: 'Restore from backup?',
      message: 'This will replace every note currently in PrepVault with the contents of the backup file. This cannot be undone.',
      confirmLabel: 'Restore & Overwrite',
      danger: true,
      onConfirm: async () => {
        try {
          const text = await readFileAsText(file);
          const parsed = JSON.parse(text);
          const notes = Array.isArray(parsed) ? parsed : parsed.notes;
          if (!Array.isArray(notes)) throw new Error('Unrecognized file format');
          await DB.clearNotes();
          for (const raw of notes) {
            const note = DB.createEmptyNote(Object.assign({}, raw, { id: raw.id || generateId() }));
            await DB.saveNote(note);
          }
          if (parsed.settings && parsed.settings.theme) {
            await UI.applyTheme(parsed.settings.theme);
          }
          await UI.reloadAllNotes();
          UI.renderSidebarCounts();
          UI.goToDashboard();
          UI.showToast(`Restored ${notes.length} notes from backup`);
        } catch (err) {
          console.error(err);
          UI.showToast('Restore failed — file was not a valid backup', 'error');
        }
      }
    });
  }

  // -------------------------------------------------------------------
  // Keyboard shortcuts
  // -------------------------------------------------------------------

  /** Global keydown handler implementing Ctrl+N / Ctrl+S / Ctrl+F / Ctrl+/. */
  function onGlobalKeydown(e) {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) {
      if (e.key === 'Escape') {
        UI.closeCommandPalette();
        document.getElementById('confirmDialog').classList.add('hidden');
        document.getElementById('revisionModal').classList.add('hidden');
        document.getElementById('shortcutsModal').classList.add('hidden');
      }
      return;
    }
    switch (e.key.toLowerCase()) {
      case 'n':
        e.preventDefault();
        UI.createNewNote();
        break;
      case 's':
        e.preventDefault();
        Editor.saveNow();
        break;
      case 'f':
        e.preventDefault();
        UI.openCommandPalette();
        break;
      case '/':
        e.preventDefault();
        UI.toggleShortcutsModal();
        break;
      default:
        break;
    }
  }

  // -------------------------------------------------------------------
  // Wiring
  // -------------------------------------------------------------------

  function bindTopbarEvents() {
    els.createNoteBtn.addEventListener('click', () => UI.createNewNote());

    els.importBtn.addEventListener('click', () => els.importFileInput.click());
    els.importFileInput.addEventListener('change', () => {
      const file = els.importFileInput.files[0];
      if (file) importNotesFromFile(file);
      els.importFileInput.value = '';
    });

    els.exportBtn.addEventListener('click', exportAllNotes);

    els.backupBtn.addEventListener('click', backupDatabase);
    els.restoreBtn.addEventListener('click', () => els.restoreFileInput.click());
    els.restoreFileInput.addEventListener('change', () => {
      const file = els.restoreFileInput.files[0];
      if (file) restoreDatabase(file);
      els.restoreFileInput.value = '';
    });

    els.themeToggleBtn.addEventListener('click', async () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      await UI.applyTheme(next);
      els.themeToggleBtn.textContent = next === 'dark' ? '🌙' : '☀️';
    });

    els.shortcutsBtn.addEventListener('click', () => UI.toggleShortcutsModal());

    els.searchTrigger.addEventListener('click', () => UI.openCommandPalette());
    els.commandInput.addEventListener('input', () => UI.renderCommandResults(els.commandInput.value));
    els.commandPalette.addEventListener('click', (e) => {
      if (e.target === els.commandPalette) UI.closeCommandPalette();
    });
    document.querySelectorAll('[data-close-command]').forEach((btn) =>
      btn.addEventListener('click', () => UI.closeCommandPalette())
    );

    document.querySelectorAll('.overlay').forEach((overlay) => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.add('hidden');
      });
    });

    els.sidebarToggle?.addEventListener('click', () => {
      els.sidebar.classList.toggle('open');
      els.sidebarScrim.classList.toggle('hidden');
    });
    els.sidebarScrim?.addEventListener('click', () => {
      els.sidebar.classList.remove('open');
      els.sidebarScrim.classList.add('hidden');
    });

    document.addEventListener('keydown', onGlobalKeydown);
  }

  /** Application bootstrap sequence. */
  async function boot() {
    cacheEls();
    await DB.open();
    await seedIfEmpty();

    const savedTheme = (await DB.getSetting('theme')) || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    els.themeToggleBtn.textContent = savedTheme === 'dark' ? '🌙' : '☀️';

    const notes = await DB.getAllNotes();
    Editor.init();
    await UI.init(notes);
    bindTopbarEvents();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
