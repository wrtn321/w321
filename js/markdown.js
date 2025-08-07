// js/markdown.js (프로젝트에 사용할 최종 파서)

/**
 * 인라인 마크다운(굵게, 링크 등)을 처리하는 헬퍼 함수
 * @param {string} text - 처리할 텍스트 라인
 * @returns {string} - 인라인 마크다운이 변환된 HTML
 */
function parseInlineMarkdown(text) {
    // 보안 처리
    let htmlLine = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    htmlLine = htmlLine.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">');
    htmlLine = htmlLine.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    htmlLine = htmlLine.replace(/(\*\*\*|__)(.+?)\1/g, '<strong style="font-weight: bold;">$2</strong>');
    htmlLine = htmlLine.replace(/(\*\*)(.+?)\1/g, '<strong style="font-weight: bold;">$2</strong>');
    htmlLine = htmlLine.replace(/(\*|_)(.+?)\1/g, '<span style="color: #85837D;">$2</span>');
    htmlLine = htmlLine.replace(/~~(.+?)~~/g, '<del>$1</del>');
    htmlLine = htmlLine.replace(/\^\^(.+?)\^\^/g, '<mark>$1</mark>');
    htmlLine = htmlLine.replace(/`(.+?)`/g, '<code style="font-weight: bold;">$1</code>');
    return htmlLine;
}

/**
 * 메인 마크다운 파서 함수
 * @param {string} text - 변환할 전체 마크다운 텍스트
 * @returns {string} - 변환된 최종 HTML
 */
function parseMarkdown(text) {
    if (!text) return ''; // 입력값이 없으면 빈 문자열 반환
    const lines = text.split('\n');
    const htmlBlocks = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 인용문 처리
        if (line.trim().startsWith('>')) {
            const quoteLines = [];
            while (i < lines.length && lines[i].trim().startsWith('>')) {
                let currentLine = lines[i].trim();
                let level = 0;
                while(currentLine.startsWith('> ')) { level++; currentLine = currentLine.substring(2).trim(); }
                while(currentLine.startsWith('>')) { level++; currentLine = currentLine.substring(1).trim(); }
                quoteLines.push({level: level, text: currentLine});
                i++;
            }
            i--;

            const buildQuotes = (items) => {
                if (!items.length) return '';
                const baseLevel = items[0].level;
                const innerItems = [];
                const outerLines = [];
                for(const item of items) {
                    if (item.level === baseLevel) {
                        if (innerItems.length) { outerLines.push(buildQuotes(innerItems)); innerItems.length = 0; }
                        outerLines.push(parseInlineMarkdown(item.text));
                    } else if (item.level > baseLevel) {
                        innerItems.push({ level: item.level - 1, text: item.text });
                    }
                }
                if (innerItems.length) { outerLines.push(buildQuotes(innerItems)); }
                return `<blockquote style="background-color:rgba(0, 0, 0, 0.2); color: #fff; border-left: 5px solid #999; padding: 10px; margin: 1em 0;">${outerLines.map(l => `<p style="margin:0;">${l}</p>`).join('')}</blockquote>`;
            };
            htmlBlocks.push(buildQuotes(quoteLines));
            continue;
        }
        
        // 보안을 위한 이스케이프 처리
        const sanitizedLine = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // 코드 블록
        if (sanitizedLine.trim().startsWith('```')) {
            const lang = sanitizedLine.trim().substring(3).trim();
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                codeLines.push(lines[i].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
                i++;
            }
            const langHeader = lang ? `<div style="background-color: #4a4a4a; color: #e0e0e0; padding: 5px 10px; border-top-left-radius: 6px; border-top-right-radius: 6px;">${lang}</div>` : '';
            htmlBlocks.push(`<div style="background-color: #2d2d2d; border-radius: 6px; margin: 1em 0;">${langHeader}<pre style="margin: 0;"><code style="color:#f1f1f1; padding: 10px; display: block; white-space: pre-wrap; word-wrap: break-word;">${codeLines.join('\n')}</code></pre></div>`);
            continue;
        }
        
        // 표
        if (i + 1 < lines.length && line.includes('|') && lines[i+1].includes('|') && lines[i+1].includes('-')) {
             if (lines[i+1].trim().replace(/\|/g, '').replace(/-/g, '').replace(/:/g, '').replace(/ /g, '') === '') {
                const headerLine = line;
                const bodyLines = [];
                i += 2;
                while (i < lines.length && lines[i].includes('|')) { bodyLines.push(lines[i]); i++; }
                i--;
                const headers = headerLine.split('|').slice(1, -1).map(h => `<th>${parseInlineMarkdown(h.trim())}</th>`).join('');
                const rows = bodyLines.map(rowLine => { const cells = rowLine.split('|').slice(1, -1).map(c => `<td>${parseInlineMarkdown(c.trim())}</td>`).join(''); return `<tr>${cells}</tr>`; }).join('');
                htmlBlocks.push(`<table style="border-collapse: collapse; width: 100%; margin: 1em 0;"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`);
                continue;
            }
        }
        
        // 제목
        const hMatch = sanitizedLine.match(/^(#+) (.*)$/);
        if (hMatch) {
            const level = hMatch[1].length;
            if (level <= 6) {
                htmlBlocks.push(`<h${level} style="font-weight: bold; font-size: ${2.0 - level * 0.2}em; margin: 0;">${parseInlineMarkdown(hMatch[2])}</h${level}>`);
                continue;
            }
        }
        
        // 수평선
        if (/^(---|___|\*\*\*)$/.test(sanitizedLine.trim())) {
            htmlBlocks.push('<hr>');
            continue;
        }

        // 일반 문단
        if (sanitizedLine.trim() !== '') {
            htmlBlocks.push(`<p style="margin: 0;">${parseInlineMarkdown(sanitizedLine)}</p>`);
        } else {
             if (htmlBlocks.length > 0 && htmlBlocks[htmlBlocks.length-1] !== '<br>') {
                htmlBlocks.push('<br>');
            }
        }
    }
    
    return htmlBlocks.join('').replace(/<br>(<br>)+/g, '<br>');
}