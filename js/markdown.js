// js/markdown.js

const ALLOWED_MARKDOWN_TAGS = new Set([
    'A', 'BLOCKQUOTE', 'BR', 'CODE', 'DEL', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'HR', 'IMG', 'MARK', 'P', 'PRE', 'SPAN', 'STRONG', 'TABLE', 'TBODY', 'TD', 'TH',
    'THEAD', 'TR'
]);

const ALLOWED_MARKDOWN_ATTRS = {
    A: new Set(['href', 'target', 'rel']),
    IMG: new Set(['src', 'alt']),
    '*': new Set(['style'])
};

function escapeMarkdownText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function isSafeUrl(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return false;
    return /^(https?:|mailto:|data:image\/(?:png|gif|jpe?g|webp);base64,|\/|\.\/|\.\.\/|#)/i.test(trimmed);
}

function sanitizeRenderedMarkdown(html) {
    const template = document.createElement('template');
    template.innerHTML = html;

    const walk = (node) => {
        Array.from(node.children).forEach((child) => {
            if (!ALLOWED_MARKDOWN_TAGS.has(child.tagName)) {
                child.replaceWith(document.createTextNode(child.textContent || ''));
                return;
            }

            Array.from(child.attributes).forEach((attr) => {
                const allowed = ALLOWED_MARKDOWN_ATTRS[child.tagName]?.has(attr.name)
                    || ALLOWED_MARKDOWN_ATTRS['*'].has(attr.name);
                const isEventHandler = attr.name.toLowerCase().startsWith('on');
                if (!allowed || isEventHandler) {
                    child.removeAttribute(attr.name);
                    return;
                }
                if ((attr.name === 'href' || attr.name === 'src') && !isSafeUrl(attr.value)) {
                    child.removeAttribute(attr.name);
                }
            });

            if (child.tagName === 'A') {
                child.setAttribute('target', '_blank');
                child.setAttribute('rel', 'noopener noreferrer');
            }

            walk(child);
        });
    };

    walk(template.content);
    return template.innerHTML;
}

function parseInlineMarkdown(text) {
    let htmlLine = escapeMarkdownText(text);

    htmlLine = htmlLine.replace(/!\[(.*?)\]\((.*?)\)/g, (_match, alt, src) => {
        const safeSrc = escapeMarkdownText(src);
        const safeAlt = escapeMarkdownText(alt);
        return `<img src="${safeSrc}" alt="${safeAlt}">`;
    });
    htmlLine = htmlLine.replace(/\[(.*?)\]\((.*?)\)/g, (_match, label, href) => {
        const safeHref = escapeMarkdownText(href);
        return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });

    htmlLine = htmlLine.replace(/(\*\*\*|__)(.+?)\1/g, '<strong style="font-weight: bold;">$2</strong>');
    htmlLine = htmlLine.replace(/(\*\*)(.+?)\1/g, '<strong style="font-weight: bold;">$2</strong>');
    htmlLine = htmlLine.replace(/(\*|_)(.+?)\1/g, '<span style="color: #85837D;">$2</span>');
    htmlLine = htmlLine.replace(/~~(.+?)~~/g, '<del>$1</del>');
    htmlLine = htmlLine.replace(/\^\^(.+?)\^\^/g, '<mark>$1</mark>');
    htmlLine = htmlLine.replace(/`(.+?)`/g, '<code style="font-weight: bold;">$1</code>');
    return htmlLine;
}

function parseMarkdown(text) {
    if (!text) return '';

    const lines = String(text).split('\n');
    const htmlBlocks = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('```')) {
            const lang = escapeMarkdownText(trimmed.substring(3).trim());
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                codeLines.push(escapeMarkdownText(lines[i]));
                i++;
            }
            const langHeader = lang ? `<div style="background-color: #4a4a4a; color: #e0e0e0; padding: 5px 10px; border-top-left-radius: 6px; border-top-right-radius: 6px;">${lang}</div>` : '';
            htmlBlocks.push(`<div style="background-color: #2d2d2d; border-radius: 6px; margin: 1em 0;">${langHeader}<pre style="margin: 0;"><code style="color:#f1f1f1; padding: 10px; display: block; white-space: pre-wrap; word-wrap: break-word;">${codeLines.join('\n')}</code></pre></div>`);
            continue;
        }

        if (trimmed.startsWith('>')) {
            const quoteLines = [];
            while (i < lines.length && lines[i].trim() !== '') {
                const currentLine = lines[i];
                quoteLines.push(currentLine.trim().startsWith('> ') ? currentLine.trim().substring(2) : currentLine.trim().replace(/^>/, ''));
                i++;
            }
            i--;
            const parsedContent = parseInlineMarkdown(quoteLines.join('\n')).replace(/\n/g, '<br>');
            htmlBlocks.push(`<blockquote style="background-color:rgba(0, 0, 0, 0.2); color: #fff; border-left: 5px solid #999; padding: 10px; margin: 1em 0;">${parsedContent}</blockquote>`);
            continue;
        }

        if (i + 1 < lines.length && line.includes('|') && lines[i + 1].includes('|') && lines[i + 1].includes('-')) {
            if (lines[i + 1].trim().replace(/\|/g, '').replace(/-/g, '').replace(/:/g, '').replace(/ /g, '') === '') {
                const headerLine = line;
                const bodyLines = [];
                i += 2;
                while (i < lines.length && lines[i].includes('|')) {
                    bodyLines.push(lines[i]);
                    i++;
                }
                i--;
                const headers = headerLine.split('|').slice(1, -1).map(h => `<th>${parseInlineMarkdown(h.trim())}</th>`).join('');
                const rows = bodyLines.map(rowLine => {
                    const cells = rowLine.split('|').slice(1, -1).map(c => `<td>${parseInlineMarkdown(c.trim())}</td>`).join('');
                    return `<tr>${cells}</tr>`;
                }).join('');
                htmlBlocks.push(`<table style="border-collapse: collapse; width: 100%; margin: 1em 0;"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`);
                continue;
            }
        }

        const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            const level = headingMatch[1].length;
            htmlBlocks.push(`<h${level} style="font-weight: bold; font-size: ${2.0 - level * 0.2}em; margin: 0;">${parseInlineMarkdown(headingMatch[2])}</h${level}>`);
            continue;
        }

        if (/^(---|___|\*\*\*)$/.test(trimmed)) {
            htmlBlocks.push('<hr>');
            continue;
        }

        if (trimmed !== '') {
            htmlBlocks.push(`<p style="margin: 0;">${parseInlineMarkdown(line)}</p>`);
        } else if (htmlBlocks.length > 0 && htmlBlocks[htmlBlocks.length - 1] !== '<br>') {
            htmlBlocks.push('<br>');
        }
    }

    return sanitizeRenderedMarkdown(htmlBlocks.join('').replace(/<br>(<br>)+/g, '<br>'));
}
