// js/chat-viewer.js (햄버거 메뉴 및 인터랙티브 헤더 적용 최종본)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    let currentPost = null;
    let originalMessages = [];
    let activeEditingIndex = null;
    let chatExtraData = { memo: '' };

    // --- HTML 요소 가져오기 ---
    const header = document.querySelector('.main-header');
    const backToListBtn = document.getElementById('back-to-list-btn');
    const viewerTitle = document.getElementById('viewer-title');
    const chatLogContainer = document.getElementById('chat-log-container');
    const hamburgerMenuBtn = document.getElementById('hamburger-menu-btn');
    
    // 정보 패널 UI 요소
    const infoPanelOverlay = document.getElementById('info-panel-overlay');
    const infoPanel = document.getElementById('info-panel');
    const infoPanelCloseBtn = document.getElementById('info-panel-close-btn');
    const infoPanelTabs = document.querySelector('.info-panel-tabs');
    
    // 페르소나, 유저노트, 메모 관련 요소
    const personaNameEl = document.getElementById('persona-name');
    const personaInfoEl = document.getElementById('persona-info');
    const usernoteInfoEl = document.getElementById('usernote-info');
    const memoTextarea = document.getElementById('memo-textarea');
    const memoCharCounter = document.getElementById('memo-char-counter');
    const memoSaveBtn = document.getElementById('memo-save-btn');
    
    // 패널 내부 파일/삭제 버튼
    const downloadJsonBtn = document.getElementById('download-json-btn');
    const downloadTxtBtn = document.getElementById('download-txt-btn');
    const dropdownDeleteBtn = document.getElementById('dropdown-delete-btn');

    // 토스트 알림
    const toastNotification = document.getElementById('toast-notification');
    const toastMessage = toastNotification ? toastNotification.querySelector('.toast-message') : null;
    let toastTimer;

    // 인터랙티브 헤더용 변수
    let lastScrollY = 0;

    // --- 초기화 및 데이터 로드 ---
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            loadChatData();
            addPageEventListeners();
            window.addEventListener('scroll', handleHeaderVisibility);
        }
    });

    function loadChatData() {
        const postDataString = localStorage.getItem('currentPost');
        if (!postDataString) {
            alert("채팅 기록을 찾을 수 없습니다.");
            window.location.href = 'main.html';
            return;
        }

        currentPost = JSON.parse(postDataString);
        viewerTitle.textContent = currentPost.title;

        // 뒤로가기 버튼 링크 설정
        const category = localStorage.getItem('currentCategory');
        if (category) {
            backToListBtn.href = category === 'chat' ? 'chat-list.html' : `list.html?category=${category}`;
        }
        
        try {
            const chatData = JSON.parse(currentPost.content);
            if (!Array.isArray(chatData.messages)) throw new Error("Invalid format");
            
            originalMessages = chatData.messages;
            renderMessages();
            renderInfoPanel(chatData);

            chatExtraData.memo = localStorage.getItem(`memo_${currentPost.id}`) || '';
            memoTextarea.value = chatExtraData.memo;
            memoCharCounter.textContent = `${chatExtraData.memo.length}자`;

        } catch (error) {
            console.error("채팅 데이터 파싱 오류:", error);
            chatLogContainer.innerHTML = `<p style="text-align: center; color: red;">채팅 기록을 불러올 수 없습니다.</p>`;
        }
    }

    function renderInfoPanel(data) {
        if (data.userPersona) {
            personaNameEl.textContent = data.userPersona.name || '이름 없음';
            personaInfoEl.textContent = data.userPersona.information || '정보 없음';
        } else {
            personaNameEl.textContent = '페르소나 정보 없음';
            personaInfoEl.textContent = '';
        }
        usernoteInfoEl.textContent = data.userNote || '유저노트가 없습니다.';
    }
    
    function renderMessages() {
        chatLogContainer.innerHTML = '';
        originalMessages.forEach((message, index) => {
            const bubble = createMessageBubble(message, index);
            chatLogContainer.appendChild(bubble);
        });
    }

    function createMessageBubble(message, index) {
        // 이 함수는 이전과 동일 (수정 없음)
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${message.role}-message`;
        const viewContent = document.createElement('div');
        viewContent.className = 'message-content';
        viewContent.innerHTML = marked.parse(message.content || '');
        viewContent.title = '더블클릭하여 수정';
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
        viewContent.addEventListener('dblclick', () => {
            if (activeEditingIndex !== null && activeEditingIndex !== index) { showToast('먼저 다른 항목의 수정을 완료해주세요.'); return; }
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
            bubble.classList.remove('editing');
            originalMessages[index].content = editContent.value;
            showToast('저장 중...');
            const success = await saveChanges();
            if (success) { viewContent.innerHTML = marked.parse(editContent.value); showToast('성공적으로 저장되었습니다!'); } 
            else { showToast('저장에 실패했습니다.'); }
            viewContent.style.display = 'block'; editContent.style.display = 'none'; editActions.style.display = 'none'; activeEditingIndex = null;
        });
        editActions.querySelector('.cancel-edit-btn').addEventListener('click', () => {
            bubble.classList.remove('editing');
            editContent.value = originalMessages[index].content;
            viewContent.style.display = 'block'; editContent.style.display = 'none'; editActions.style.display = 'none'; activeEditingIndex = null;
        });
        editContent.addEventListener('input', autoResizeTextarea);
        return bubble;
    }

    async function saveChanges() {
        try {
            const newContent = JSON.stringify({
                // 저장 시점에 현재 데이터를 다시 한 번 읽어서 합침
                title: currentPost.title,
                userPersona: JSON.parse(currentPost.content).userPersona,
                userNote: JSON.parse(currentPost.content).userNote,
                messages: originalMessages
            }, null, 2);
            await db.collection('posts').doc(currentPost.id).update({ content: newContent });
            currentPost.content = newContent;
            localStorage.setItem('currentPost', JSON.stringify(currentPost));
            return true;
        } catch (error) {
            console.error("저장 실패:", error);
            return false;
        }
    }

    // --- 페이지 전체 이벤트 리스너 ---
    function addPageEventListeners() {
        backToListBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.replace(backToListBtn.href);
        });
        
        // 패널 열고 닫기 로직
        const openPanel = () => {
            infoPanelOverlay.classList.remove('hidden');
            infoPanel.classList.remove('hidden');
        };
        const closePanel = () => {
            infoPanelOverlay.classList.add('hidden');
            infoPanel.classList.add('hidden');
        };

        hamburgerMenuBtn.addEventListener('click', openPanel);
        infoPanelCloseBtn.addEventListener('click', closePanel);
        infoPanelOverlay.addEventListener('click', closePanel);

        // 탭 전환 로직
        infoPanelTabs.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-link')) {
                const tabName = e.target.dataset.tab;
                infoPanelTabs.querySelectorAll('.tab-link').forEach(btn => btn.classList.remove('active'));
                infoPanel.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById(`${tabName}-content`).classList.add('active');
            }
        });

        // 메모장 기능
        memoTextarea.addEventListener('input', () => {
            memoCharCounter.textContent = `${memoTextarea.value.length}자`;
        });
        memoSaveBtn.addEventListener('click', () => {
            chatExtraData.memo = memoTextarea.value;
            localStorage.setItem(`memo_${currentPost.id}`, chatExtraData.memo);
            showToast('메모가 저장되었습니다!');
        });
        
        // 제목 수정 로직
        viewerTitle.addEventListener('click', () => {
            if (document.querySelector('.title-edit-input')) return;
            const currentTitleText = viewerTitle.textContent;
            const input = document.createElement('input');
            input.type = 'text'; input.className = 'title-edit-input'; input.value = currentTitleText;
            viewerTitle.style.display = 'none';
            viewerTitle.parentNode.insertBefore(input, viewerTitle);
            input.focus(); input.select();
            const saveNewTitle = async () => {
                const newTitle = input.value.trim();
                if(input.parentNode) input.parentNode.removeChild(input);
                viewerTitle.style.display = 'block';
                if (newTitle && newTitle !== currentTitleText) {
                    viewerTitle.textContent = newTitle;
                    try {
                        await db.collection('posts').doc(currentPost.id).update({ title: newTitle });
                        currentPost.title = newTitle;
                        localStorage.setItem('currentPost', JSON.stringify(currentPost));
                        showToast('제목이 변경되었습니다.');
                    } catch(err) {
                        showToast('제목 변경에 실패했습니다.');
                        viewerTitle.textContent = currentTitleText;
                    }
                }
            };
            input.addEventListener('blur', saveNewTitle);
            input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { if(input.parentNode) input.parentNode.removeChild(input); viewerTitle.style.display = 'block'; }});
        });

        // 파일 다운로드 및 삭제 이벤트 리스너
        downloadJsonBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const title = (currentPost.title.trim() || 'chat').normalize('NFC');
            downloadFile(currentPost.content, title + '.json', 'application/json');
            closePanel();
        });

        downloadTxtBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const title = (currentPost.title.trim() || 'chat').normalize('NFC');
            downloadFile(generateTxtFromChat(), title + '.txt', 'text/plain');
            closePanel();
        });
        
        dropdownDeleteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            closePanel();
            if (!currentPost.id) return;
            if (confirm('정말로 이 채팅 기록을 삭제하시겠습니까?')) {
                try {
                    await db.collection('posts').doc(currentPost.id).delete();
                    localStorage.removeItem('currentPost');
                    localStorage.removeItem(`memo_${currentPost.id}`);
                    window.location.replace(backToListBtn.href);
                } catch (error) {
                    console.error("삭제 실패:", error);
                    showToast('삭제에 실패했습니다.');
                }
            }
        });
    }

    // --- 헬퍼 함수들 ---
    const showToast = message => {
        if (!toastNotification || !toastMessage) return;
        clearTimeout(toastTimer);
        toastMessage.textContent = message;
        toastNotification.classList.add('show');
        toastTimer = setTimeout(() => { toastNotification.classList.remove('show'); }, 3000);
    };

    function downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.href = url; link.download = filename;
        document.body.appendChild(link); link.click();
        document.body.removeChild(link); URL.revokeObjectURL(url);
    }

    function generateTxtFromChat() {
        if (!originalMessages || originalMessages.length === 0) return "채팅 기록이 없습니다.";
        return originalMessages.map(msg => {
            const roleName = msg.role === 'user' ? 'USER' : 'ASSISTANT';
            return `${roleName}:\n${msg.content}`;
        }).join('\n\n');
    }

    function autoResizeTextarea(event) {
        const textarea = event.target;
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    }
    
    // 인터랙티브 헤더 함수
    function handleHeaderVisibility() {
        const currentScrollY = window.scrollY;
        if (currentScrollY > lastScrollY && currentScrollY > header.offsetHeight) {
            header.style.transform = 'translateY(-100%)';
        } else {
            header.style.transform = 'translateY(0)';
        }
        lastScrollY = currentScrollY;
    }
});