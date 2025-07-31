// js/chat-viewer.js (다운로드 기능 추가 및 버그 수정 최종 버전)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    let currentPost = null;
    let originalMessages = [];

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

    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            loadChatData();
        }
    });

    function loadChatData() {
        const postDataString = localStorage.getItem('currentPost');
        const category = localStorage.getItem('currentCategory');
        if (category) backToListBtn.href = `list.html?category=${category}`;
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

    function createMessageBubble(message, index) {
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${message.role}-message`;
        const viewContent = document.createElement('div');
        viewContent.className = 'message-content';
        viewContent.innerHTML = marked.parse(message.content || '');
        const editContent = document.createElement('textarea');
        editContent.className = 'editable-textarea';
        editContent.value = message.content || '';
        bubble.appendChild(viewContent);
        bubble.appendChild(editContent);
        viewContent.addEventListener('click', () => {
            viewContent.style.display = 'none';
            editContent.style.display = 'block';
            autoResizeTextarea({ target: editContent });
            editContent.focus();
        });
        editContent.addEventListener('blur', async () => {
            const newText = editContent.value;
            viewContent.style.display = 'block';
            editContent.style.display = 'none';
            if (newText !== originalMessages[index].content) {
                showToast('수정 중...');
                originalMessages[index].content = newText;
                const success = await saveChanges();
                if (success) {
                    renderMessages();
                    showToast('성공적으로 수정되었습니다!');
                } else {
                    showToast('저장에 실패했습니다.');
                }
            }
        });
        editContent.addEventListener('input', autoResizeTextarea);
        return bubble;
    }

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

    // ★★★ 스크롤 버그 수정된 함수 ★★★
    function autoResizeTextarea(event) {
        const textarea = event.target;
        const scrollPosition = window.scrollY; // 현재 스크롤 위치 저장
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
        window.scrollTo(0, scrollPosition); // 저장했던 위치로 스크롤 복원
    }

    const showToast = message => {
        clearTimeout(toastTimer);
        toastMessage.textContent = message;
        toastNotification.classList.add('show');
        toastTimer = setTimeout(() => { toastNotification.classList.remove('show'); }, 3000);
    };

    // --- 이벤트 리스너 연결 ---
    backToListBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.replace(backToListBtn.href);
    });
    
    toggleMenuBtn.addEventListener('click', () => {
        dropdownMenu.hidden = !dropdownMenu.hidden;
    });

    window.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-menu-container')) {
            dropdownMenu.hidden = true;
        }
    });

    // ★★★ 새로 추가된 다운로드 버튼 이벤트 리스너 ★★★
    downloadJsonBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const filename = (currentPost.title.trim() || 'chat') + '.json';
        downloadFile(currentPost.content, filename, 'application/json');
        dropdownMenu.hidden = true;
    });

    downloadTxtBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const filename = (currentPost.title.trim() || 'chat') + '.txt';
        const txtContent = generateTxtFromChat();
        downloadFile(txtContent, filename, 'text/plain');
        dropdownMenu.hidden = true;
    });

    // ★★★ 추가된 다운로드 헬퍼 함수들 ★★★
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
    
    dropdownDeleteBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        dropdownMenu.hidden = true;
        if (!currentPost.id) return;
        if (confirm('정말로 이 채팅 기록을 삭제하시겠습니까?')) {
            try {
                await db.collection('posts').doc(currentPost.id).delete();
                localStorage.removeItem('currentPost');
                localStorage.removeItem('currentCategory');
                window.location.replace(backToListBtn.href);
            } catch (error) {
                console.error("삭제 실패:", error);
                showToast('삭제에 실패했습니다.');
            }
        }
    });
});
