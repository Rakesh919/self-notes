/**
 * markdown.js
 * ---------------------------------------------------------------------------
 * A small, self-contained Markdown -> HTML renderer plus a regex-based
 * syntax highlighter for common backend languages. No external libraries —
 * this is intentionally simple (a subset of CommonMark) but covers every
 * element PrepVault's notes actually use: headings, bold/italic, inline
 * code, fenced code blocks, links, images, tables, checklists, blockquotes,
 * ordered/unordered lists and horizontal rules.
 * ---------------------------------------------------------------------------
 */

const Markdown = (() => {
  /** Keyword lists used by the tiny syntax highlighter, per language. */
  const KEYWORDS = {
    java: ['public', 'private', 'protected', 'class', 'interface', 'extends', 'implements', 'static', 'final', 'void', 'new', 'return', 'if', 'else', 'for', 'while', 'try', 'catch', 'finally', 'throw', 'throws', 'import', 'package', 'this', 'super', 'enum', 'abstract', 'synchronized', 'volatile', 'transient', 'default', 'break', 'continue', 'switch', 'case', 'instanceof', 'null', 'true', 'false'],
    sql: ['SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'ON', 'GROUP', 'BY', 'ORDER', 'HAVING', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'INDEX', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'NOT', 'NULL', 'AND', 'OR', 'AS', 'DISTINCT', 'LIMIT', 'ALTER', 'DROP'],
    javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'extends', 'new', 'try', 'catch', 'finally', 'throw', 'import', 'export', 'default', 'async', 'await', 'this', 'typeof', 'instanceof', 'null', 'undefined', 'true', 'false'],
    bash: ['if', 'then', 'else', 'fi', 'for', 'do', 'done', 'while', 'echo', 'export', 'function', 'return'],
    yaml: [],
    json: [],
    xml: [],
    properties: []
  };

  /**
   * Escapes HTML, then wraps recognizable tokens (strings, comments,
   * numbers, keywords) in <span> classes for CSS-driven syntax coloring.
   * @param {string} code
   * @param {string} lang
   * @returns {string} highlighted HTML
   */
  function highlight(code, lang) {
    const language = (lang || '').toLowerCase();
    let escaped = escapeHtml(code);

    // Comments (// ... and # ... and /* ... */) — done first so later
    // passes don't reach inside them.
    const commentTokens = [];
    escaped = escaped.replace(/(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)/g, (m) => {
      commentTokens.push(m);
      return `\u0000C${commentTokens.length - 1}\u0000`;
    });

    // Strings
    const stringTokens = [];
    escaped = escaped.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, (m) => {
      stringTokens.push(m);
      return `\u0000S${stringTokens.length - 1}\u0000`;
    });

    // Numbers
    escaped = escaped.replace(/\b(\d+\.?\d*)\b/g, '<span class="tok-num">$1</span>');

    // Keywords
    const keywords = KEYWORDS[language] || [];
    if (keywords.length) {
      const pattern = new RegExp(`\\b(${keywords.join('|')})\\b`, language === 'sql' ? 'g' : 'g');
      escaped = escaped.replace(pattern, '<span class="tok-kw">$1</span>');
    }

    // Restore strings/comments with span wrappers
    escaped = escaped.replace(/\u0000S(\d+)\u0000/g, (_, i) => `<span class="tok-str">${stringTokens[i]}</span>`);
    escaped = escaped.replace(/\u0000C(\d+)\u0000/g, (_, i) => `<span class="tok-cmt">${commentTokens[i]}</span>`);

    return escaped;
  }

  /**
   * Renders inline markdown (bold, italic, inline code, links, images)
   * within a single line/string. Assumes input is already HTML-escaped.
   * @param {string} text
   * @returns {string}
   */
  function renderInline(text) {
    let out = text;
    // Images ![alt](src)
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, alt, src, title) => {
      return `<img src="${src}" alt="${alt}" title="${title || alt}" loading="lazy" class="md-img">`;
    });
    // Links [text](href)
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, label, href, title) => {
      const safeHref = href.replace(/"/g, '&quot;');
      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" title="${title || ''}">${label}</a>`;
    });
    // Inline code
    out = out.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    // Bold
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    // Italic
    out = out.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    out = out.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<em>$1</em>');
    // Strikethrough
    out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    return out;
  }

  /**
   * Renders a GitHub-flavored-ish markdown table given its header/separator/
   * body lines.
   * @param {string[]} lines
   * @returns {string}
   */
  function renderTable(lines) {
    const parseRow = (line) =>
      line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const header = parseRow(lines[0]);
    const aligns = parseRow(lines[1]).map((cell) => {
      const left = cell.startsWith(':');
      const right = cell.endsWith(':');
      if (left && right) return 'center';
      if (right) return 'right';
      if (left) return 'left';
      return '';
    });
    const bodyRows = lines.slice(2).map(parseRow);

    let html = '<div class="md-table-wrap"><table class="md-table"><thead><tr>';
    header.forEach((cell, i) => {
      html += `<th${aligns[i] ? ` style="text-align:${aligns[i]}"` : ''}>${renderInline(escapeHtml(cell))}</th>`;
    });
    html += '</tr></thead><tbody>';
    bodyRows.forEach((row) => {
      html += '<tr>';
      row.forEach((cell, i) => {
        html += `<td${aligns[i] ? ` style="text-align:${aligns[i]}"` : ''}>${renderInline(escapeHtml(cell || ''))}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  /**
   * Converts a full markdown string into safe HTML.
   * @param {string} markdown
   * @returns {string}
   */
  function render(markdown) {
    if (!markdown) return '<p class="md-empty">Nothing here yet.</p>';
    const rawLines = markdown.replace(/\r\n/g, '\n').split('\n');
    let html = '';
    let i = 0;
    let listStack = []; // { type: 'ul'|'ol' }

    function closeLists() {
      while (listStack.length) {
        html += listStack.pop().type === 'ul' ? '</ul>' : '</ol>';
      }
    }

    while (i < rawLines.length) {
      const line = rawLines[i];

      // Fenced code block
      const fenceMatch = line.match(/^\s*```(\S*)\s*$/);
      if (fenceMatch) {
        closeLists();
        const lang = fenceMatch[1] || 'text';
        const codeLines = [];
        i++;
        while (i < rawLines.length && !/^\s*```\s*$/.test(rawLines[i])) {
          codeLines.push(rawLines[i]);
          i++;
        }
        i++; // skip closing fence
        const rawCode = codeLines.join('\n');
        const highlighted = highlight(rawCode, lang);
        const codeId = 'code-' + Math.random().toString(36).slice(2, 9);
        html += `<div class="code-block">
          <div class="code-block-header">
            <span class="code-lang">${escapeHtml(lang)}</span>
            <button class="copy-code-btn" data-copy-target="${codeId}" type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <span>Copy</span>
            </button>
          </div>
          <pre><code id="${codeId}" class="lang-${escapeHtml(lang)}">${highlighted}</code></pre>
        </div>`;
        continue;
      }

      // Table
      if (/^\s*\|.*\|\s*$/.test(line) && rawLines[i + 1] && /^\s*\|?[\s:|-]+\|?\s*$/.test(rawLines[i + 1])) {
        closeLists();
        const tableLines = [line, rawLines[i + 1]];
        i += 2;
        while (i < rawLines.length && /^\s*\|.*\|\s*$/.test(rawLines[i])) {
          tableLines.push(rawLines[i]);
          i++;
        }
        html += renderTable(tableLines);
        continue;
      }

      // Headings
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        closeLists();
        const level = headingMatch[1].length;
        html += `<h${level} class="md-h${level}">${renderInline(escapeHtml(headingMatch[2]))}</h${level}>`;
        i++;
        continue;
      }

      // Horizontal rule
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        closeLists();
        html += '<hr class="md-hr">';
        i++;
        continue;
      }

      // Blockquote
      if (/^\s*>\s?/.test(line)) {
        closeLists();
        const quoteLines = [];
        while (i < rawLines.length && /^\s*>\s?/.test(rawLines[i])) {
          quoteLines.push(rawLines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        html += `<blockquote class="md-quote">${renderInline(escapeHtml(quoteLines.join(' ')))}</blockquote>`;
        continue;
      }

      // Checklist item
      const checkMatch = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
      if (checkMatch) {
        if (!listStack.length || listStack[listStack.length - 1].type !== 'ul-check') {
          closeLists();
          html += '<ul class="md-checklist">';
          listStack.push({ type: 'ul-check' });
        }
        const checked = checkMatch[1].toLowerCase() === 'x';
        html += `<li class="md-check-item ${checked ? 'checked' : ''}"><span class="check-box">${checked ? '✓' : ''}</span><span>${renderInline(escapeHtml(checkMatch[2]))}</span></li>`;
        i++;
        continue;
      }

      // Unordered list item
      const ulMatch = line.match(/^\s*[-*+]\s+(.*)$/);
      if (ulMatch) {
        if (!listStack.length || listStack[listStack.length - 1].type !== 'ul') {
          closeLists();
          html += '<ul class="md-list">';
          listStack.push({ type: 'ul' });
        }
        html += `<li>${renderInline(escapeHtml(ulMatch[1]))}</li>`;
        i++;
        continue;
      }

      // Ordered list item
      const olMatch = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (olMatch) {
        if (!listStack.length || listStack[listStack.length - 1].type !== 'ol') {
          closeLists();
          html += '<ol class="md-list">';
          listStack.push({ type: 'ol' });
        }
        html += `<li>${renderInline(escapeHtml(olMatch[1]))}</li>`;
        i++;
        continue;
      }

      // Blank line
      if (/^\s*$/.test(line)) {
        closeLists();
        i++;
        continue;
      }

      // Paragraph (collect contiguous non-blank plain lines)
      closeLists();
      const paraLines = [line];
      i++;
      while (
        i < rawLines.length &&
        !/^\s*$/.test(rawLines[i]) &&
        !/^(#{1,6})\s+/.test(rawLines[i]) &&
        !/^\s*```/.test(rawLines[i]) &&
        !/^\s*[-*+]\s+/.test(rawLines[i]) &&
        !/^\s*\d+[.)]\s+/.test(rawLines[i]) &&
        !/^\s*>\s?/.test(rawLines[i])
      ) {
        paraLines.push(rawLines[i]);
        i++;
      }
      html += `<p>${renderInline(escapeHtml(paraLines.join(' ')))}</p>`;
    }
    closeLists();
    return html;
  }

  return { render, highlight };
})();
