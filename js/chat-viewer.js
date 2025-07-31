// js/chat-viewer.js (인라인 편집 기능이 추가된 최종 버전)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    let currentPost = null;
    let originalMessages = []; // 원본 메시지 데이터 저장

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
    const dropdownEditBtn = document.getElementById('dropdown-edit-btn');
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
            
            originalMessages = chatData.messages; // 원본 데이터 저장
            renderMessages(); // 화면 렌더링 함수 호출

        } catch (error) {
            chatLogContainer.innerHTML = `<p style="text-align: center; color: red;">채팅 기록을 불러올 수 없습니다.</p>`;
        }
    }
    
    // 메시지 배열을 기반으로 화면을 렌더링하는 함수
    function renderMessages() {
        chatLogContainer.innerHTML = ''; // 컨테이너 비우기
        originalMessages.forEach((message, index) => {
            const bubble = createMessageBubble(message, index);
            chatLogContainer.appendChild(bubble);
        });
    }

    /**
     * 채팅 말풍선 한 개를 생성하는 함수
     * @param {object} message - { role: 'user', content: '...' }
     * @param {number} index - 메시지의 배열 인덱스
     * @returns {HTMLElement} 생성된 div 엘리먼트
     */
    function createMessageBubble(message, index) {
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${message.role}-message`;

        // 1. 읽기 모드용 컨텐츠 div (마크다운 적용)
        const viewContent = document.createElement('div');
        viewContent.className = 'message-content';
        viewContent.innerHTML = marked.parse(message.content || '');

        // 2. 수정 모드용 textarea
        const editContent = document.createElement('textarea');
        editContent.className = 'editable-textarea';
        editContent.value = message.content || '';

        bubble.appendChild(viewContent);
        bubble.appendChild(editContent);

        // ★★★ 핵심 로직: 클릭 시 읽기/수정 모드 전환 ★★★
        viewContent.addEventListener('click', () => {
            viewContent.style.display = 'none';
            editContent.style.display = 'block';
            autoResizeTextarea({ target: editContent }); // 높이 조절
            editContent.focus(); // 바로 입력할 수 있도록 포커스
        });

        // textarea에서 포커스가 벗어났을 때 (수정 완료)
        editContent.addEventListener('blur', async () => {
            const newText = editContent.value;
            viewContent.style.display = 'block';
            editContent.style.display = 'none';

            // 내용이 변경되었는지 확인
            if (newText !== originalMessages[index].content) {
                showToast('수정 중...');
                originalMessages[index].content = newText; // 원본 데이터 업데이트
                
                // Firestore에 저장
                const success = await saveChanges();
                if (success) {
                    // 화면 다시 렌더링
                    renderMessages();
                    showToast('성공적으로 수정되었습니다!');
                } else {
                    showToast('저장에 실패했습니다.');
                    // 실패 시 원본 복구 (선택적)
                    originalMessages[index].content = message.content;
                }
            }
        });

        // 입력 중 높이 자동 조절
        editContent.addEventListener('input', autoResizeTextarea);

        return bubble;
    }

    // 변경된 내용을 Firestore에 저장하는 함수
    async function saveChanges() {
        try {
            const newContent = JSON.stringify({ messages: originalMessages }, null, 2);
            await db.collection('posts').doc(currentPost.id).update({ content: newContent });
            
            // 로컬 스토리지도 업데이트
            currentPost.content = newContent;
            localStorage.setItem('currentPost', JSON.stringify(currentPost));
            return true;
        } catch (error) {
            console.error("저장 실패:", error);
            return false;
        }
    }

    // Textarea 높이 자동 조절 함수
    function autoResizeTextarea(event) {
        const textarea = event.target;
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    }

    // 토스트 알림 함수
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

    
   주어진 내용을 파일로 다운로드하는 범용 함수
   @param {string} content - 파일 내용
   @param {string} filename - 저장될 파일 이름 (예: "chat.txt")
   @param {string} contentType - 파일 타입 (예: "text/plain")
 
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
    if (!originalMessages || originalMessages.length === 0) {
        return "채팅 기록이 없습니다.";
    }
    // 각 메시지를 "역할: 내용" 형태로 변환하고 두 줄씩 띄워서 합칩니다.
    return originalMessages.map(msg => {
        const roleName = msg.role === 'user' ? 'USER' : 'ASSISTANT';
        return `${roleName}:\n${msg.content}`;
    }).join('\n\n');
}
});
