// js/chat-viewer.js (인라인 편집 V/X 버튼 적용 및 버그 수정 최종 버전)

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

    auth.onAuthStateChanged(user => {
        if (!user) window.location.href = 'index.html';
        else loadChatData();
    });

    function loadChatData() {
        // ... (이 함수는 기존과 동일)
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

    // 1. 읽기 모드 div 클릭 시 -> 수정 모드로 전환
    viewContent.addEventListener('click', () => {
        if (activeEditingIndex !== null && activeEditingIndex !== index) {
            showToast('먼저 다른 항목의 수정을 완료해주세요.');
            return;
        }
        activeEditingIndex = index;
        
        // ★★★ 핵심: 수정 시작 시 editing 클래스 추가 ★★★
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

    // 2. 저장(V) 버튼 클릭
    editActions.querySelector('.save-edit-btn').addEventListener('click', async () => {
        // ★★★ 핵심: 수정 완료 시 editing 클래스 제거 ★★★
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

    // 3. 취소(X) 버튼 클릭
    editActions.querySelector('.cancel-edit-btn').addEventListener('click', () => {
        // ★★★ 핵심: 수정 취소 시 editing 클래스 제거 ★★★
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

    async function saveChanges() { /* ... 기존과 동일 ... */ }
    function autoResizeTextarea(event) { /* ... 기존과 동일 (스크롤 위치 저장하는 버전) ... */ }
    const showToast = message => { /* ... 기존과 동일 ... */ };
    
    // --- 페이지 전체 이벤트 리스너 ---
    backToListBtn.addEventListener('click', (e) => { /* ... */ });
    toggleMenuBtn.addEventListener('click', () => { /* ... */ });
    window.addEventListener('click', (e) => { /* ... */ });
    dropdownDeleteBtn.addEventListener('click', async (e) => { /* ... */ });

    // 다운로드 버튼 이벤트 리스너
    function downloadFile(content, filename, contentType) { /* ... 기존과 동일 ... */ }
    function generateTxtFromChat() { /* ... 기존과 동일 ... */ }
    downloadJsonBtn.addEventListener('click', (e) => { /* ... */ });
    downloadTxtBtn.addEventListener('click', (e) => { /* ... */ });
});
