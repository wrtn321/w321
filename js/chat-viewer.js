// js/chat-viewer.js (파일명 깨짐 문제 해결 최종본)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    let currentPost = null;
    let originalMessages = [];
    let activeEditingIndex = null;

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

    // --- 정보 패널 UI 요소 가져오기 ---
    const infoPanelBtn = document.getElementById('info-panel-btn');
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
    
    let chatExtraData = { // 메모 등을 저장할 객체
        memo: ''
    };

    // --- 초기화 및 데이터 로드 ---
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            loadChatData();
            addPageEventListeners();
        }
    });

    function loadChatData() {
        const postDataString = localStorage.getItem('currentPost');
        const category = localStorage.getItem('currentCategory');

        if (category) {
            const listPage = category === 'chat' ? 'chat-list.html' : `list.html?category=${category}`;
            backToListBtn.href = listPage;
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
        // ▼▼▼ 여기서 새 데이터를 파싱합니다. ▼▼▼
        if (!Array.isArray(chatData.messages)) throw new Error("Invalid format");
        
        originalMessages = chatData.messages;
        renderMessages();

        // 파싱한 페르소나, 유저노트 정보를 패널에 채워넣는 함수 호출
        renderInfoPanel(chatData);

        // 저장된 메모 로드 (localStorage 사용 예시)
        chatExtraData.memo = localStorage.getItem(`memo_${currentPost.id}`) || '';
        memoTextarea.value = chatExtraData.memo;
        memoCharCounter.textContent = `${chatExtraData.memo.length}자`;

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

    function addPageEventListeners() {
        backToListBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const listPage = (localStorage.getItem('currentCategory') === 'chat') ? 'chat-list.html' : 'list.html';
            window.location.replace(listPage);
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
            // ▼▼▼ 핵심 수정 부분 ▼▼▼
            const title = (currentPost.title.trim() || 'chat').normalize('NFC');
            const filename = title + '.json';
            const formattedJson = JSON.stringify(JSON.parse(currentPost.content), null, 2);
            downloadFile(formattedJson, filename, 'application/json');
            dropdownMenu.hidden = true;
        });

        downloadTxtBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // ▼▼▼ 핵심 수정 부분 ▼▼▼
            const title = (currentPost.title.trim() || 'chat').normalize('NFC');
            const filename = title + '.txt';
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
                    const category = localStorage.getItem('currentCategory');
                    const listPage = category === 'chat' ? 'chat-list.html' : 'list.html';
                    localStorage.removeItem('currentCategory');
                    window.location.replace(listPage);
                } catch (error) {
                    console.error("삭제 실패:", error);
                    showToast('삭제에 실패했습니다.');
                }
            }
        });

        const openPanel = () => {
        infoPanelOverlay.classList.remove('hidden');
        infoPanel.classList.remove('hidden');
        infoPanelOverlay.style.display = 'block'; // плавный переход을 위해
        infoPanel.style.display = 'flex';
    };
    const closePanel = () => {
        infoPanelOverlay.classList.add('hidden');
        infoPanel.classList.add('hidden');
        setTimeout(() => { // transition 끝난 후 display: none 처리
            infoPanelOverlay.style.display = 'none';
            infoPanel.style.display = 'none';
        }, 300);
    };

    infoPanelBtn.addEventListener('click', openPanel);
    infoPanelCloseBtn.addEventListener('click', closePanel);
    infoPanelOverlay.addEventListener('click', closePanel);

    // 탭 전환 로직
    infoPanelTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-link')) {
            const tabName = e.target.dataset.tab;
            
            // 모든 탭 버튼과 콘텐츠에서 active 클래스 제거
            infoPanelTabs.querySelectorAll('.tab-link').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            // 클릭된 탭 버튼과 해당 콘텐츠에 active 클래스 추가
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
        // 각 채팅마다 고유한 키로 메모를 저장
        localStorage.setItem(`memo_${currentPost.id}`, chatExtraData.memo);
        showToast('메모가 저장되었습니다!');
    });

    }

    function renderInfoPanel(data) {
    // 페르소나 탭 채우기
    if (data.userPersona) {
        personaNameEl.textContent = data.userPersona.name || '이름 없음';
        personaInfoEl.textContent = data.userPersona.information || '정보 없음';
    } else {
        personaNameEl.textContent = '페르소나 정보 없음';
        personaInfoEl.textContent = '';
    }

    // 유저노트 탭 채우기
    usernoteInfoEl.textContent = data.userNote || '유저노트가 없습니다.';
}

});
