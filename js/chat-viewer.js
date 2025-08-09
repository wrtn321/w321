// js/chat-viewer.js (채팅 추가/삭제 기능까지 모두 통합된 최종 완성본)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- 전역 변수 ---
    let currentPost = null;
    let currentChatData = {};
    let lastScrollY = 0;
    let activeEditingIndex = null;
    let longPressTimer;
    let currentRole = 'user'; // 채팅 추가 시 기본 역할

    // --- HTML 요소 가져오기 ---
    const header = document.querySelector('.main-header');
    const viewerTitle = document.getElementById('viewer-title');
    const chatLogContainer = document.getElementById('chat-log-container');
    const hamburgerMenuBtn = document.getElementById('hamburger-menu-btn');
    // 사이드 패널
    const infoPanelOverlay = document.getElementById('info-panel-overlay');
    const infoPanel = document.getElementById('info-panel');
    const infoPanelCloseBtn = document.getElementById('info-panel-close-btn');
    const infoPanelTabs = document.querySelector('.info-panel-tabs');
    // 페르소나
    const personaNameEl = document.getElementById('persona-name');
    const personaContent = document.getElementById('persona-content');
    const editPersonaBtn = document.getElementById('edit-persona-btn');
    const personaViewMode = document.getElementById('persona-view-mode');
    const personaEditMode = document.getElementById('persona-edit-mode');
    const personaInfoEl = document.getElementById('persona-info');
    const personaTextarea = document.getElementById('persona-textarea');
    // 유저노트
    const usernoteContent = document.getElementById('usernote-content');
    const editUsernoteBtn = document.getElementById('edit-usernote-btn');
    const usernoteViewMode = document.getElementById('usernote-view-mode');
    const usernoteEditMode = document.getElementById('usernote-edit-mode');
    const usernoteInfoEl = document.getElementById('usernote-info');
    const usernoteTextarea = document.getElementById('usernote-textarea');
    // 메모
    const memoTextarea = document.getElementById('memo-textarea');
    const memoCharCounter = document.getElementById('memo-char-counter');
    const memoSaveBtn = document.getElementById('memo-save-btn');
    // 파일/삭제
    const downloadJsonBtn = document.getElementById('download-json-btn');
    const downloadTxtBtn = document.getElementById('download-txt-btn');
    const dropdownDeleteBtn = document.getElementById('dropdown-delete-btn');
    // 채팅 추가 바
    const roleToggleBtn = document.getElementById('role-toggle-btn');
    const newMessageInput = document.getElementById('new-message-input');
    const addMessageBtn = document.getElementById('add-message-btn');
    // 기타 UI
    let toastTimer;

    // --- 초기화 ---
    auth.onAuthStateChanged(user => {
        if (!user) { window.location.href = 'index.html'; } 
        else {
            loadChatData();
            addPageEventListeners();
            window.addEventListener('scroll', handleHeaderVisibility);
        }
    });

    // --- 데이터 로드 및 파싱 ---
    function loadChatData() {
        const postDataString = localStorage.getItem('currentPost');
        if (!postDataString) { alert("채팅 기록을 찾을 수 없습니다."); window.location.href = 'main.html'; return; }

        currentPost = JSON.parse(postDataString);
        viewerTitle.textContent = currentPost.title;
        
        try {
            currentChatData = JSON.parse(currentPost.content);
            if (!Array.isArray(currentChatData.messages)) throw new Error("Invalid format");
            
            renderMessages();
            renderInfoPanel();

            const savedMemo = localStorage.getItem(`memo_${currentPost.id}`) || '';
            memoTextarea.value = savedMemo;
            memoCharCounter.textContent = `${savedMemo.length}자`;

        } catch (error) {
            console.error("채팅 데이터 파싱 오류:", error);
            chatLogContainer.innerHTML = `<p style="text-align: center; color: red;">채팅 기록을 불러올 수 없습니다.</p>`;
        }
    }
    
    // --- 렌더링 함수 ---
    function renderInfoPanel() {
        personaNameEl.textContent = currentChatData.userPersona?.name || '프로필';
        personaInfoEl.textContent = currentChatData.userPersona?.information || '정보 없음';
        personaTextarea.value = currentChatData.userPersona?.information || '';
        usernoteInfoEl.textContent = currentChatData.userNote || '유저노트가 없습니다.';
        usernoteTextarea.value = currentChatData.userNote || '';
    }

    function renderMessages() {
        chatLogContainer.innerHTML = '';
        currentChatData.messages.forEach((message, index) => {
            const bubble = createMessageBubble(message, index);
            chatLogContainer.appendChild(bubble);
        });
    }

    // --- 데이터 저장 함수 ---
    async function updateFirestoreContent() {
        try {
            const newContent = JSON.stringify(currentChatData, null, 2);
            await db.collection('posts').doc(currentPost.id).update({ content: newContent });
            currentPost.content = newContent;
            localStorage.setItem('currentPost', JSON.stringify(currentPost));
            return true;
        } catch (error) {
            console.error("Firestore 업데이트 실패:", error);
            showToast('저장에 실패했습니다.');
            return false;
        }
    }

    // --- 이벤트 리스너 설정 ---
    function addPageEventListeners() {
        // 패널 열고 닫기
        const openPanel = () => { infoPanelOverlay.classList.remove('hidden'); infoPanel.classList.remove('hidden'); };
        const closePanel = () => { infoPanelOverlay.classList.add('hidden'); infoPanel.classList.add('hidden'); };
        hamburgerMenuBtn.addEventListener('click', openPanel);
        infoPanelCloseBtn.addEventListener('click', closePanel);
        infoPanelOverlay.addEventListener('click', closePanel);

        // 탭 전환
        infoPanelTabs.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-link')) {
                const tabName = e.target.dataset.tab;
                infoPanelTabs.querySelectorAll('.tab-link').forEach(btn => btn.classList.remove('active'));
                infoPanel.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById(`${tabName}-content`).classList.add('active');
            }
        });
        
        // 메모장
        memoTextarea.addEventListener('input', () => { memoCharCounter.textContent = `${memoTextarea.value.length}자`; });
        memoSaveBtn.addEventListener('click', () => { localStorage.setItem(`memo_${currentPost.id}`, memoTextarea.value); showToast('메모가 저장되었습니다!'); });
        
        // 제목 수정
        viewerTitle.addEventListener('click', () => {
            if (document.querySelector('.title-edit-input')) return;
            const currentTitleText = viewerTitle.textContent;
            const input = document.createElement('input');
            input.type = 'text'; input.className = 'title-edit-input'; input.value = currentTitleText;
            viewerTitle.style.display = 'none'; viewerTitle.parentNode.insertBefore(input, viewerTitle);
            input.focus(); input.select();
            const saveNewTitle = async () => {
                const newTitle = input.value.trim();
                if (input.parentNode) input.parentNode.removeChild(input);
                viewerTitle.style.display = 'block';
                if (newTitle && newTitle !== currentTitleText) {
                    viewerTitle.textContent = newTitle;
                    try {
                        await db.collection('posts').doc(currentPost.id).update({ title: newTitle });
                        currentPost.title = newTitle;
                        localStorage.setItem('currentPost', JSON.stringify(currentPost));
                        showToast('제목이 변경되었습니다.');
                    } catch(err) { showToast('제목 변경에 실패했습니다.'); viewerTitle.textContent = currentTitleText; }
                }
            };
            input.addEventListener('blur', saveNewTitle);
            input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { if(input.parentNode) input.parentNode.removeChild(input); viewerTitle.style.display = 'block'; }});
        });

        // 패널 내부 수정 모드 토글
        const toggleEditMode = (mode, type) => {
            document.getElementById(`${type}-view-mode`).hidden = (mode === 'edit');
            document.getElementById(`${type}-edit-mode`).hidden = (mode !== 'edit');
        };

        // 프로필 수정
        editPersonaBtn.addEventListener('click', () => toggleEditMode('edit', 'persona'));
        personaContent.querySelector('#cancel-persona-btn').addEventListener('click', () => { renderInfoPanel(); toggleEditMode('view', 'persona'); });
        personaContent.querySelector('#save-persona-btn').addEventListener('click', async () => {
            if (!currentChatData.userPersona) { currentChatData.userPersona = { name: '프로필', information: '' }; }
            currentChatData.userPersona.information = personaTextarea.value;
            if (await updateFirestoreContent()) { renderInfoPanel(); toggleEditMode('view', 'persona'); showToast('프로필 정보가 저장되었습니다.'); }
        });

        // 유저노트 수정
        editUsernoteBtn.addEventListener('click', () => toggleEditMode('edit', 'usernote'));
        usernoteContent.querySelector('#cancel-usernote-btn').addEventListener('click', () => { renderInfoPanel(); toggleEditMode('view', 'usernote'); });
        usernoteContent.querySelector('#save-usernote-btn').addEventListener('click', async () => {
            currentChatData.userNote = usernoteTextarea.value;
            if (await updateFirestoreContent()) { renderInfoPanel(); toggleEditMode('view', 'usernote'); showToast('유저노트가 저장되었습니다.'); }
        });

        // 파일/삭제 버튼
        downloadJsonBtn.addEventListener('click', (e) => { e.preventDefault(); const title = (currentPost.title.trim() || 'chat').normalize('NFC'); downloadFile(currentPost.content, title + '.json', 'application/json'); closePanel(); });
        downloadTxtBtn.addEventListener('click', (e) => { e.preventDefault(); const title = (currentPost.title.trim() || 'chat').normalize('NFC'); downloadFile(generateTxtFromChat(), title + '.txt', 'text/plain'); closePanel(); });
        dropdownDeleteBtn.addEventListener('click', async (e) => {
            e.preventDefault(); closePanel();
            if (!currentPost.id) return;
            if (confirm('정말로 이 채팅 기록을 삭제하시겠습니까?')) {
                try {
                    await db.collection('posts').doc(currentPost.id).delete();
                    localStorage.removeItem('currentPost');
                    localStorage.removeItem(`memo_${currentPost.id}`);
                    history.back();
                } catch (error) { console.error("삭제 실패:", error); showToast('삭제에 실패했습니다.'); }
            }
        });

        // 새로운 채팅 추가 기능
        roleToggleBtn.addEventListener('click', () => {
            if (currentRole === 'user') { currentRole = 'assistant'; roleToggleBtn.textContent = '🤖'; roleToggleBtn.title = '역할 전환 (현재: 어시스턴트)'; } 
            else { currentRole = 'user'; roleToggleBtn.textContent = '👤'; roleToggleBtn.title = '역할 전환 (현재: 유저)'; }
        });
        addMessageBtn.addEventListener('click', async () => {
            const messageText = newMessageInput.value.trim();
            if (messageText === '') return;
            currentChatData.messages.push({ role: currentRole, content: messageText });
            if (await updateFirestoreContent()) {
                renderMessages();
                newMessageInput.value = '';
                autoResizeInput();
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                showToast('메시지가 추가되었습니다.');
            }
        });
        const autoResizeInput = () => { newMessageInput.style.height = 'auto'; newMessageInput.style.height = newMessageInput.scrollHeight + 'px'; };
        newMessageInput.addEventListener('input', autoResizeInput);
    }

    // --- 동적 UI 생성 및 이벤트 바인딩 ---
    function createMessageBubble(message, index) {
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${message.role}-message`;
        const viewContent = document.createElement('div');
        viewContent.className = 'message-content';
        viewContent.innerHTML = parseMarkdown(message.content || '');
        viewContent.title = '더블클릭하여 수정';
        const editContent = document.createElement('textarea');
        editContent.className = 'editable-textarea';
        editContent.value = message.content || '';
        const editActions = document.createElement('div');
        editActions.className = 'edit-actions';
        editActions.innerHTML = `<button class="save-edit-btn" title="저장">✓</button><button class="cancel-edit-btn" title="취소">✕</button>`;
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-bubble-btn';
        deleteBtn.textContent = '🗑️';
        deleteBtn.title = '메시지 삭제';
        
        bubble.appendChild(deleteBtn);
        bubble.appendChild(viewContent);
        bubble.appendChild(editContent);
        bubble.appendChild(editActions);

        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`이 메시지를 정말 삭제하시겠습니까?\n\n내용: "${message.content.substring(0, 30)}..."`)) {
                currentChatData.messages.splice(index, 1);
                if (await updateFirestoreContent()) {
                    renderMessages();
                    showToast('메시지가 삭제되었습니다.');
                }
            }
        });

        const startPress = (e) => {
            document.querySelectorAll('.message-bubble.show-delete').forEach(b => b.classList.remove('show-delete'));
            longPressTimer = setTimeout(() => { bubble.classList.add('show-delete'); }, 800);
        };
        const cancelPress = () => { clearTimeout(longPressTimer); };
        bubble.addEventListener('mousedown', startPress);
        bubble.addEventListener('mouseup', cancelPress);
        bubble.addEventListener('mouseleave', cancelPress);
        bubble.addEventListener('touchstart', startPress, { passive: true });
        bubble.addEventListener('touchend', cancelPress);

        viewContent.addEventListener('dblclick', () => {
            if (activeEditingIndex !== null) { showToast('먼저 다른 항목의 수정을 완료해주세요.'); return; }
            activeEditingIndex = index;
            bubble.classList.add('editing');
            editContent.style.height = viewContent.offsetHeight + 'px';
            viewContent.style.display = 'none';
            editContent.style.display = 'block';
            editActions.style.display = 'block';
            autoResizeTextarea({ target: editContent });
            editContent.focus();
        });

        editActions.querySelector('.save-edit-btn').addEventListener('click', async () => {
            currentChatData.messages[index].content = editContent.value;
            if (await updateFirestoreContent()) {
                viewContent.innerHTML = parseMarkdown(editContent.value);
                bubble.classList.remove('editing');
                viewContent.style.display = 'block';
                editContent.style.display = 'none';
                editActions.style.display = 'none';
                activeEditingIndex = null;
                showToast('메시지가 수정되었습니다.');
            }
        });
        editActions.querySelector('.cancel-edit-btn').addEventListener('click', () => {
            bubble.classList.remove('editing');
            editContent.value = currentChatData.messages[index].content;
            viewContent.style.display = 'block';
            editContent.style.display = 'none';
            editActions.style.display = 'none';
            activeEditingIndex = null;
        });
        editContent.addEventListener('input', autoResizeTextarea);
        return bubble;
    }
    
    // --- 헬퍼 함수 ---
    const showToast = message => { const toastNotification = document.getElementById('toast-notification'); const toastMessage = toastNotification ? toastNotification.querySelector('.toast-message') : null; if (!toastNotification || !toastMessage) return; clearTimeout(toastTimer); toastMessage.textContent = message; toastNotification.classList.add('show'); toastTimer = setTimeout(() => { toastNotification.classList.remove('show'); }, 3000); };
    function downloadFile(content, filename, contentType) { const blob = new Blob([content], { type: contentType }); const link = document.createElement("a"); const url = URL.createObjectURL(blob); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); }
    function generateTxtFromChat() { return currentChatData.messages.map(msg => `${msg.role === 'user' ? 'USER' : 'ASSISTANT'}:\n${msg.content}`).join('\n\n') || "채팅 기록이 없습니다."; }
    function autoResizeTextarea(event) { const textarea = event.target; textarea.style.height = 'auto'; textarea.style.height = (textarea.scrollHeight) + 'px'; }
    function handleHeaderVisibility() { if (header) { const currentScrollY = window.scrollY; header.style.transform = (currentScrollY > lastScrollY && currentScrollY > header.offsetHeight) ? 'translateY(-100%)' : 'translateY(0)'; lastScrollY = currentScrollY; } }
});
