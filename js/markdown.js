// js/markdown.js (인용문 처리 로직 개선 및 최종 완성본)

/**
 * 인라인 마크다운(굵게, 링크 등)을 처리하는 헬퍼 함수
 * @param {string} text - 처리할 텍스트 라인
 * @returns {string} - 인라인 마크다운이 변환된 HTML
 */
function parseInlineMarkdown(text) {
    // 보안 처리
    let htmlLine = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // 순서가 중요합니다: 더 구체적인 규칙(이미지)을 먼저 처리해야 합니다.
    htmlLine = htmlLine.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">');
    htmlLine = htmlLine.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // 굵게와 이탤릭을 구분하기 위해 더 긴 규칙을 먼저 처리합니다.
    htmlLine = htmlLine.replace(/(\*\*\*|___)(.+?)\1/g, '<strong><em>$2</em></strong>'); // 3개짜리 이탤릭+굵게
    htmlLine = htmlLine.replace(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>'); // 2개짜리 굵게
    htmlLine = htmlLine.replace(/(\*|_)(.+?)\1/g, '<span style="color: #85837D;">$2</span>'); // 1개짜리 이탤릭 (스타일 유지)
    
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
    let inBlock = false; // 현재 블록(인용, 코드 등) 안에 있는지 여부

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // ▼▼▼ 인용문 처리 (로직 전체 개선) ▼▼▼
        if (line.trim().startsWith('>')) {
            const quoteLines = [];
            // 인용문이 시작되면, 빈 줄이 나올 때까지 계속 읽습니다.
            while (i < lines.length && lines[i].trim() !== '') {
                const currentLine = lines[i].trim();
                if (currentLine.startsWith('>')) {
                    // ">" 또는 "> " 로 시작하는 경우 모두 처리
                    let quoteText = currentLine.startsWith('> ') ? currentLine.substring(2) : currentLine.substring(1);
                    quoteLines.push(quoteText);
                } else {
                    // 인용문 블록 안에 있지만 '>'로 시작하지 않는 줄도 내용으로 포함
                    quoteLines.push(lines[i]);
                }
                i++;
            }
            // while 루프가 끝나면 i는 빈 줄 다음 인덱스를 가리키므로, for 루프가 정상적으로 이어가도록 1을 빼줍니다.
            i--; 

            // 인용문 내용을 하나의 문단으로 합치고 인라인 파싱 적용
            const parsedQuoteContent = parseInlineMarkdown(quoteLines.join('\n'));
            htmlBlocks.push(`<blockquote style="background-color:rgba(0, 0, 0, 0.2); color: #fff; border-left: 5px solid #999; padding: 10px; margin: 1em 0;">${parsedQuoteContent.replace(/\n/g, '<br>')}</blockquote>`);
            continue;
        }
        
        // 보안을 위한 이스케이프 처리 (인라인 파서에서 이미 처리하므로 여기선 생략 가능)
        // const sanitizedLine = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // 코드 블록
        if (line.trim().startsWith('```')) {
            const lang = line.trim().substring(3).trim();
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                // 코드 블록 내부는 마크다운 파싱을 하면 안되므로, HTML 특수문자만 처리합니다.
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
                i += 2; // 구분선 다음 줄부터 본문 시작
                // 표가 끝날 때까지 (빈 줄이나 다른 마크다운이 나올 때까지) 읽음
                while (i < lines.length && lines[i].includes('|')) {
                    bodyLines.push(lines[i]);
                    i++;
                }
                i--; // for 루프를 위해 인덱스 보정
                const headers = headerLine.split('|').slice(1, -1).map(h => `<th>${parseInlineMarkdown(h.trim())}</th>`).join('');
                const rows = bodyLines.map(rowLine => {
                    const cells = rowLine.split('|').slice(1, -1).map(c => `<td>${parseInlineMarkdown(c.trim())}</td>`).join('');
                    return `<tr>${cells}</tr>`;
                }).join('');
                htmlBlocks.push(`<table style="border-collapse: collapse; width: 100%; margin: 1em 0;"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`);
                continue;
            }
        }
        
        // 제목
        const hMatch = line.match(/^(#+) (.*)$/);
        if (hMatch) {
            const level = hMatch[1].length;
            if (level <= 6) {
                htmlBlocks.push(`<h${level} style="font-weight: bold; font-size: ${2.0 - level * 0.2}em; margin: 0;">${parseInlineMarkdown(hMatch[2])}</h${level}>`);
                continue;
            }
        }
        
        // 수평선
        if (/^((-{3,})|(_){3,}|(\*){3,})$/.test(line.trim())) { // 3개 이상일 때로 규칙 강화
            htmlBlocks.push('<hr>');
            continue;
        }

        // 일반 문단 처리 (연속된 텍스트 라인을 하나의 문단으로 묶음)
        if (line.trim() !== '') {
            const paragraphLines = [line];
            while (i + 1 < lines.length && lines[i + 1].trim() !== '' && !/^(#|>|```|-{3,}|_{3,}|\*{3,})/.test(lines[i+1].trim())) {
                i++;
                paragraphLines.push(lines[i]);
            }
            htmlBlocks.push(`<p style="margin: 0;">${parseInlineMarkdown(paragraphLines.join('\n'))}</p>`);
        } else {
             // 연속된 빈 줄이 여러 개의 <br>로 변환되는 것을 방지
             if (htmlBlocks.length > 0 && !htmlBlocks[htmlBlocks.length-1].endsWith('<br>')) {
                htmlBlocks.push('<br>');
            }
        }
    }
    
    // 최종 결과물에서 맨 앞이나 맨 뒤의 불필요한 <br> 제거 및 중복 <br> 정리
    return htmlBlocks.join('\n').replace(/^\s*<br>/, '').replace(/<br>\s*$/, '').replace(/(<br>\s*){2,}/g, '<br><br>');
}