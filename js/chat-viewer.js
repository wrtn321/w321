// js/chat-viewer.js (인라인 편집 V/X 버튼, 다운로드, 토글 메뉴 버그 수정 최종 버전)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    let currentPost = null;
    let originalMessages = [];
    let activeEditingIndex = null; // 현재 수정 중인 말풍선의 인덱스를 저장

    // HTML 요소
    const backToListBtn = document.getElementById('back-to-list-btn');
    const viewerTitle = document.getElementById('viewer-title');
    const chatLogContainer = document.getElementById('chat-log-container');
    const toastNotification = document.getElementById('toast-notification');
    const toastMessage = toastNotification.querySelector('.toast-message');
    let toastTimer;

    // 드롭다운 메뉴 요소
    const toggleMenuBtn = document.getElementById('toggle-menu-btn');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const downloadJsonBtn = document.getElementById('download-json-btn');
    const downloadTxtBtn = document.getElementById('download-txt-btn');
    const dropdownDeleteBtn = document.getElementById('dropdown-delete-btn');

    // Firebase 인증 상태 확인
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            loadChatData();
        }
    });

    // 채팅 데이터를 불러와 화면에 그리는 메인 함수
    function loadChatData() {
        const postDataString = localStorage.getItem('currentPost');
        const category = localStorage.getItem('currentCategory');

        if (category) {
            backToListBtn.href = `chat-list.html?category=${category}`;
        }

        if (!postDataString) {
            alert("채팅 기록을 찾을 수 없습니다.");
            window.location.href = 'main.html';
            return;
        }

        currentPost = JSON.parse(postDataString);
        viewerTitle.textContent = currentPost.title;

        try {
            const chatData = JSON.parse(currentPost.content);
            if (!Array.isArray(chatData.messages)) throw new Error("Invalid format");
            
            originalMessages = chatData.messages;
            renderMessages();

        } catch (error) {
            chatLogContainer.innerHTML = `<p style="text-align: center; color: red;">채팅 기록을 불러올 수 없습니다.</p>`;
        }
    }
    
    // 메시지 배열을 기반으로 화면을 렌더링하는 함수
    function renderMessages() {
        chatLogContainer.innerHTML = '';
        originalMessages.forEach((message, index) => {
            const bubble = createMessageBubble(message, index);
            chatLogContainer.appendChild(bubble);
        });
    }

    /**
     * 채팅 말풍선 한 개를 생성하고 이벤트 리스너를 연결하는 함수
     * @param {object} message - { role: 'user', content: '...' }
     * @param {number} index - 메시지의 배열 인덱스
     * @returns {HTMLElement} 생성된 div 엘리먼트
     */
    function createMessageBubble(message, index) {
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${message.role}-message`;

        const viewContent = document.createElement('div');
        viewContent.className = 'message-content';
        viewContent.innerHTML = marked.parse(message.content || '');

        const editContent = document.createElement('textarea');
        editContent.className = 'editable-textarea';
        editContent.value = message.content || '';

        const editActions = document.createElement('div');
        editActions.className = 'edit-actions';
        editActions.innerHTML = `
            <button class="save-edit-btn" title="저장">✓</button>
            <button class="cancel-edit-btn" title="취소">✕</button>
        `;

        bubble.appendChild(viewContent);
        bubble.appendChild(editContent);
        bubble.appendChild(editActions);

        // --- 이벤트 리스너 ---

        viewContent.addEventListener('click', () => {
            if (activeEditingIndex !== null && activeEditingIndex !== index) {
                showToast('먼저 다른 항목의 수정을 완료해주세요.');
                return;
            }
            activeEditingIndex = index;
            
            bubble.classList.add('editing'); 

            const originalHeight = viewContent.offsetHeight;
            editContent.style.height = originalHeight + 'px';
            
            viewContent.style.display = 'none';
            editContent.style.display = 'block';
            editActions.style.display = 'block';
            
            autoResizeTextarea({ target: editContent });
            editContent.focus();
            editContent.setSelectionRange(editContent.value.length, editContent.value.length);
        });

        editActions.querySelector('.save-edit-btn').addEventListener('click', async () => {
            bubble.classList.remove('editing'); 

            const newText = editContent.value;
            showToast('저장 중...');
            originalMessages[index].content = newText;
            
            const success = await saveChanges();
            if (success) {
                viewContent.innerHTML = marked.parse(newText);
                showToast('성공적으로 저장되었습니다!');
            } else {
                showToast('저장에 실패했습니다.');
            }

            viewContent.style.display = 'block';
            editContent.style.display = 'none';
            editActions.style.display = 'none';
            activeEditingIndex = null;
        });

        editActions.querySelector('.cancel-edit-btn').addEventListener('click', () => {
            bubble.classList.remove('editing');

            editContent.value = originalMessages[index].content;
            viewContent.style.display = 'block';
            editContent.style.display = 'none';
            editActions.style.display = 'none';
            activeEditingIndex = null;
        });

        editContent.addEventListener('input', autoResizeTextarea);
        return bubble;
    }

    // 변경된 내용을 Firestore에 저장하는 함수
    async function saveChanges() {
        try {
            const newContent = JSON.stringify({ messages: originalMessages }, null, 2);
            await db.collection('posts').doc(currentPost.id).update({ content: newContent });
            
            currentPost.content = newContent;
            localStorage.setItem('currentPost', JSON.stringify(currentPost));
            return true;
        } catch (error) {
            console.error("저장 실패:", error);
            return false;
        }
    }

    // Textarea 높이 자동 조절 함수 (스크롤 버그 수정된 버전)
    function autoResizeTextarea(event) {
        const textarea = event.target;
        const scrollPosition = window.scrollY;
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
        window.scrollTo(0, scrollPosition);
    }

    // 토스트 알림 함수
    const showToast = message => {
        clearTimeout(toastTimer);
        toastMessage.textContent = message;
        toastNotification.classList.add('show');
        toastTimer = setTimeout(() => { toastNotification.classList.remove('show'); }, 3000);
    };

    /**
     * 주어진 내용을 파일로 다운로드하는 범용 함수
     * @param {string} content - 파일 내용
     * @param {string} filename - 저장될 파일 이름
     * @param {string} contentType - 파일 타입
     */
    function downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * 현재 채팅 데이터를 인간이 읽기 좋은 TXT 형식으로 변환하는 함수
     * @returns {string} 변환된 텍스트
     */
    function generateTxtFromChat() {
        if (!originalMessages || originalMessages.length === 0) return "채팅 기록이 없습니다.";
        return originalMessages.map(msg => {
            const roleName = msg.role === 'user' ? 'USER' : 'ASSISTANT';
            return `${roleName}:\n${msg.content}`;
        }).join('\n\n');
    }

    // --- 페이지 전체 이벤트 리스너 ---
    backToListBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.replace('chat-list.html');
    });
    
    toggleMenuBtn.addEventListener('click', () => {
        dropdownMenu.hidden = !dropdownMenu.hidden;
    });

    window.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-menu-container')) {
            dropdownMenu.hidden = true;
        }
    });

    // --- 드롭다운 메뉴 버튼 이벤트 리스너 ---
    downloadJsonBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const filename = (currentPost.title.trim() || 'chat') + '.json';
        // 저장 시에는 보기 좋게 포맷팅된 JSON을 사용
        const formattedJson = JSON.stringify(JSON.parse(currentPost.content), null, 2);
        downloadFile(formattedJson, filename, 'application/json');
        dropdownMenu.hidden = true;
    });

    downloadTxtBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const filename = (currentPost.title.trim() || 'chat') + '.txt';
        const txtContent = generateTxtFromChat();
        downloadFile(txtContent, filename, 'text/plain');
        dropdownMenu.hidden = true;
    });
    
    dropdownDeleteBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        dropdownMenu.hidden = true;
        if (!currentPost.id) return;
        if (confirm('정말로 이 채팅 기록을 삭제하시겠습니까?')) {
            try {
                await db.collection('posts').doc(currentPost.id).delete();
                localStorage.removeItem('currentPost');
                localStorage.removeItem('currentCategory');
                window.location.replace('chat-list.html');
            } catch (error) {
                console.error("삭제 실패:", error);
                showToast('삭제에 실패했습니다.');
            }
        }
    });
});
