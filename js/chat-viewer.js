// js/chat-viewer.js (제목 인라인 편집, 더블클릭 수정 적용 최종 버전 - 생략 없음)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    let currentPost = null;
    let originalMessages = [];
    let activeEditingIndex = null; // 현재 수정 중인 말풍선의 인덱스 저장

    // --- HTML 요소 가져오기 ---
    const backToListBtn = document.getElementById('back-to-list-btn');
    const viewerTitle = document.getElementById('viewer-title');
    const chatLogContainer = document.getElementById('chat-log-container');
    const toastNotification = document.getElementById('toast-notification');
    const toastMessage = toastNotification.querySelector('.toast-message');
    let toastTimer;

    const toggleMenuBtn = document.getElementById('toggle-menu-btn');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const downloadJsonBtn = document.getElementById('download-json-btn');
    const downloadTxtBtn = document.getElementById('download-txt-btn');
    const dropdownDeleteBtn = document.getElementById('dropdown-delete-btn');

    // --- 초기화 및 데이터 로드 ---
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            loadChatData();
            addPageEventListeners(); // 페이지 레벨 이벤트 리스너 연결
        }
    });

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
    
    function renderMessages() {
        chatLogContainer.innerHTML = '';
        originalMessages.forEach((message, index) => {
            const bubble = createMessageBubble(message, index);
            chatLogContainer.appendChild(bubble);
        });
    }

    // --- 핵심 로직: 말풍선 생성 및 이벤트 ---
    function createMessageBubble(message, index) {
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${message.role}-message`;
        const viewContent = document.createElement('div');
        viewContent.className = 'message-content';

        // ★★★ 1. 보여주기 전에 끝 공백 제거 ★★★
        const cleanContent = (message.content || '').trimEnd();
        viewContent.innerHTML = marked.parse(cleanContent);
        viewContent.title = '더블클릭하여 수정';

        const editContent = document.createElement('textarea');
        editContent.className = 'editable-textarea';
        editContent.value = message.content || ''; // 수정창에는 원본 그대로

        const editActions = document.createElement('div');
        editActions.className = 'edit-actions';
        editActions.innerHTML = `
            <button class="save-edit-btn" title="저장">✓</button>
            <button class="cancel-edit-btn" title="취소">✕</button>
        `;

        bubble.appendChild(viewContent);
        bubble.appendChild(editContent);
        bubble.appendChild(editActions);

        viewContent.addEventListener('dblclick', () => {
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

            // ★★★ 2. 저장하기 전에 끝 공백 제거 ★★★
            const newText = editContent.value.trimEnd();
            showToast('저장 중...');
            
            originalMessages[index].content = newText; // 깨끗한 데이터로 교체
            
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

    // --- 헬퍼 함수들 (저장, 리사이즈, 토스트, 다운로드 등) ---

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

    function autoResizeTextarea(event) {
        const textarea = event.target;
        const scrollPosition = window.scrollY;
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
        window.scrollTo(0, scrollPosition);
    }

    const showToast = message => {
        clearTimeout(toastTimer);
        toastMessage.textContent = message;
        toastNotification.classList.add('show');
        toastTimer = setTimeout(() => { toastNotification.classList.remove('show'); }, 3000);
    };

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

    function generateTxtFromChat() {
        if (!originalMessages || originalMessages.length === 0) return "채팅 기록이 없습니다.";
        return originalMessages.map(msg => {
            const roleName = msg.role === 'user' ? 'USER' : 'ASSISTANT';
            return `${roleName}:\n${msg.content}`;
        }).join('\n\n');
    }

    // --- 페이지 전체 이벤트 리스너 ---
    function addPageEventListeners() {
        backToListBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.replace('chat-list.html');
        });
        
        toggleMenuBtn.addEventListener('click', () => {
            dropdownMenu.hidden = !dropdownMenu.hidden;
        });

        window.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown-menu-container') && !e.target.closest('#viewer-title') && !e.target.closest('.title-edit-input')) {
                dropdownMenu.hidden = true;
            }
        });

        viewerTitle.addEventListener('click', () => {
            if (document.querySelector('.title-edit-input')) return;

            const currentTitle = viewerTitle.textContent;
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'title-edit-input';
            input.value = currentTitle;

            viewerTitle.style.display = 'none';
            // h1의 부모(header)에 input을 h1 대신 삽입
            viewerTitle.parentNode.insertBefore(input, viewerTitle);
            input.focus();
            input.select();

            const saveNewTitle = async () => {
                const newTitle = input.value.trim();
                if(input.parentNode) {
                    input.parentNode.removeChild(input);
                }
                viewerTitle.style.display = 'block';

                if (newTitle && newTitle !== currentTitle) {
                    viewerTitle.textContent = newTitle;
                    try {
                        await db.collection('posts').doc(currentPost.id).update({ title: newTitle });
                        currentPost.title = newTitle;
                        localStorage.setItem('currentPost', JSON.stringify(currentPost));
                        showToast('제목이 변경되었습니다.');
                    } catch(err) {
                        showToast('제목 변경에 실패했습니다.');
                        viewerTitle.textContent = currentTitle;
                    }
                }
            };

            input.addEventListener('blur', saveNewTitle);
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') input.blur();
                if (e.key === 'Escape') {
                    if(input.parentNode) {
                        input.parentNode.removeChild(input);
                    }
                    viewerTitle.style.display = 'block';
                }
            });
        });

        // --- 드롭다운 메뉴 버튼 이벤트 리스너 ---
        downloadJsonBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const filename = (currentPost.title.trim() || 'chat') + '.json';
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
    }
});
