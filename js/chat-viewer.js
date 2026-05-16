// js/chat-viewer.js (留??꾨옒濡?媛湲?踰꾪듉 湲곕뒫源뚯? 紐⑤몢 ?듯빀??理쒖쥌 ?꾩꽦蹂?

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- ?꾩뿭 蹂??---
    let currentPost = null;
    let currentChatData = {};
    let lastScrollY = 0;
    let activeEditingIndex = null;
    let longPressTimer;
    let currentRole = 'user';

    // --- HTML ?붿냼 媛?몄삤湲?---
    const header = document.querySelector('.main-header');
    const viewerTitle = document.getElementById('viewer-title');
    const chatLogContainer = document.getElementById('chat-log-container');
    const hamburgerMenuBtn = document.getElementById('hamburger-menu-btn');
    const scrollToBottomBtn = document.getElementById('scroll-to-bottom-btn');
    const infoPanelOverlay = document.getElementById('info-panel-overlay');
    const infoPanel = document.getElementById('info-panel');
    const infoPanelCloseBtn = document.getElementById('info-panel-close-btn');
    const infoPanelTabs = document.querySelector('.info-panel-tabs');
    const personaNameEl = document.getElementById('persona-name');
    const personaContent = document.getElementById('persona-content');
    const editPersonaBtn = document.getElementById('edit-persona-btn');
    const personaViewMode = document.getElementById('persona-view-mode');
    const personaEditMode = document.getElementById('persona-edit-mode');
    const personaInfoEl = document.getElementById('persona-info');
    const personaTextarea = document.getElementById('persona-textarea');
    const usernoteContent = document.getElementById('usernote-content');
    const editUsernoteBtn = document.getElementById('edit-usernote-btn');
    const usernoteViewMode = document.getElementById('usernote-view-mode');
    const usernoteEditMode = document.getElementById('usernote-edit-mode');
    const usernoteInfoEl = document.getElementById('usernote-info');
    const usernoteTextarea = document.getElementById('usernote-textarea');
    const memoTextarea = document.getElementById('memo-textarea');
    const memoCharCounter = document.getElementById('memo-char-counter');
    const memoSaveBtn = document.getElementById('memo-save-btn');
    const downloadJsonBtn = document.getElementById('download-json-btn');
    const downloadTxtBtn = document.getElementById('download-txt-btn');
    const dropdownDeleteBtn = document.getElementById('dropdown-delete-btn');
    const roleToggleBtn = document.getElementById('role-toggle-btn');
    const newMessageInput = document.getElementById('new-message-input');
    const addMessageBtn = document.getElementById('add-message-btn');
    let toastTimer;

    // --- 珥덇린??---
    auth.onAuthStateChanged(user => {
        if (!user) { window.location.href = 'index.html'; } 
        else {
            loadChatData(user);
            addPageEventListeners();
            window.addEventListener('scroll', () => {
                handleHeaderVisibility();
                handleScrollToBottomVisibility();
            });
            handleScrollToBottomVisibility();
        }
    });

    // --- ?곗씠??濡쒕뱶 諛??뚯떛 ---
    async function loadChatData(user) {
        const params = new URLSearchParams(window.location.search);
        const postId = params.get('id') || params.get('postId');
        if (postId) {
            try {
                const doc = await db.collection('posts').doc(postId).get();
                if (!doc.exists || doc.data().userId !== user.uid) {
                    alert("梨꾪똿 湲곕줉??李얠쓣 ???놁뒿?덈떎.");
                    window.appNavigate('main.html', { replace: true });
                    return;
                }
                currentPost = { id: doc.id, ...doc.data() };
                localStorage.setItem('currentCategory', currentPost.category || 'chat');
            } catch (error) {
                console.error("梨꾪똿 湲곕줉 濡쒕뵫 ?ㅽ뙣:", error);
                showToast('梨꾪똿 湲곕줉??遺덈윭?ㅼ? 紐삵뻽?듬땲??');
                return;
            }
        } else {
        const postDataString = localStorage.getItem('currentPost');
        if (!postDataString) { alert("梨꾪똿 湲곕줉??李얠쓣 ???놁뒿?덈떎."); window.appNavigate('main.html', { replace: true }); return; }

        currentPost = JSON.parse(postDataString);
            if (currentPost.id) {
                window.appNavigate(`chat-viewer.html?id=${currentPost.id}`, { replace: true });
                return;
            }
        }
        viewerTitle.textContent = currentPost.title;
        
        try {
            currentChatData = JSON.parse(currentPost.content);
            if (!Array.isArray(currentChatData.messages)) throw new Error("Invalid format");
            
            renderMessages();
            renderInfoPanel();

            const savedMemo = localStorage.getItem(`memo_${currentPost.id}`) || '';
            if (memoTextarea && memoCharCounter) {
                memoTextarea.value = savedMemo;
                memoCharCounter.textContent = `${savedMemo.length}자`;
            }

        } catch (error) {
            console.error("梨꾪똿 ?곗씠???뚯떛 ?ㅻ쪟:", error);
            chatLogContainer.innerHTML = `<p style="text-align: center; color: red;">梨꾪똿 湲곕줉??遺덈윭?????놁뒿?덈떎.</p>`;
        }
    }
    
    // --- ?뚮뜑留??⑥닔 ---
    function renderInfoPanel() {
        personaNameEl.textContent = currentChatData.userPersona?.name || '프로필';
        personaInfoEl.textContent = currentChatData.userPersona?.information || '정보 없음';
        personaTextarea.value = currentChatData.userPersona?.information || '';
        usernoteInfoEl.textContent = currentChatData.userNote || '유저 노트가 없습니다.';
        usernoteTextarea.value = currentChatData.userNote || '';
    }

    function renderMessages() {
        chatLogContainer.innerHTML = '';
        currentChatData.messages.forEach((message, index) => {
            const bubble = createMessageBubble(message, index);
            chatLogContainer.appendChild(bubble);
        });
    }

    // --- ?곗씠??????⑥닔 ---
    async function updateFirestoreContent() {
        try {
            const newContent = JSON.stringify(currentChatData, null, 2);
            await db.collection('posts').doc(currentPost.id).update({ content: newContent });
            currentPost.content = newContent;
            return true;
        } catch (error) {
            console.error("Firestore ?낅뜲?댄듃 ?ㅽ뙣:", error);
            showToast('??μ뿉 ?ㅽ뙣?덉뒿?덈떎.');
            return false;
        }
    }

    // --- ?대깽??由ъ뒪???ㅼ젙 ---
    function addPageEventListeners() {
        const openPanel = () => { infoPanelOverlay.classList.remove('hidden'); infoPanel.classList.remove('hidden'); };
        const closePanel = () => { infoPanelOverlay.classList.add('hidden'); infoPanel.classList.add('hidden'); };
        hamburgerMenuBtn.addEventListener('click', openPanel);
        infoPanelCloseBtn.addEventListener('click', closePanel);
        infoPanelOverlay.addEventListener('click', closePanel);

        infoPanelTabs.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-link')) {
                const tabName = e.target.dataset.tab;
                infoPanelTabs.querySelectorAll('.tab-link').forEach(btn => btn.classList.remove('active'));
                infoPanel.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById(`${tabName}-content`).classList.add('active');
            }
        });
        
        if (memoTextarea && memoCharCounter && memoSaveBtn) {
            memoTextarea.addEventListener('input', () => { memoCharCounter.textContent = `${memoTextarea.value.length}자`; });
            memoSaveBtn.addEventListener('click', () => { localStorage.setItem(`memo_${currentPost.id}`, memoTextarea.value); showToast('메모가 저장되었습니다!'); });
        }
        
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
                        showToast('?쒕ぉ??蹂寃쎈릺?덉뒿?덈떎.');
                    } catch(err) { showToast('?쒕ぉ 蹂寃쎌뿉 ?ㅽ뙣?덉뒿?덈떎.'); viewerTitle.textContent = currentTitleText; }
                }
            };
            input.addEventListener('blur', saveNewTitle);
            input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { if(input.parentNode) input.parentNode.removeChild(input); viewerTitle.style.display = 'block'; }});
        });

        const toggleEditMode = (mode, type) => {
            document.getElementById(`${type}-view-mode`).hidden = (mode === 'edit');
            document.getElementById(`${type}-edit-mode`).hidden = (mode !== 'edit');
        };

        editPersonaBtn.addEventListener('click', () => toggleEditMode('edit', 'persona'));
        personaContent.querySelector('#cancel-persona-btn').addEventListener('click', () => { renderInfoPanel(); toggleEditMode('view', 'persona'); });
        personaContent.querySelector('#save-persona-btn').addEventListener('click', async () => {
            if (!currentChatData.userPersona) { currentChatData.userPersona = { name: '프로필', information: '' }; }
            currentChatData.userPersona.information = personaTextarea.value;
            if (await updateFirestoreContent()) { renderInfoPanel(); toggleEditMode('view', 'persona'); showToast('?꾨줈???뺣낫媛 ??λ릺?덉뒿?덈떎.'); }
        });

        editUsernoteBtn.addEventListener('click', () => toggleEditMode('edit', 'usernote'));
        usernoteContent.querySelector('#cancel-usernote-btn').addEventListener('click', () => { renderInfoPanel(); toggleEditMode('view', 'usernote'); });
        usernoteContent.querySelector('#save-usernote-btn').addEventListener('click', async () => {
            currentChatData.userNote = usernoteTextarea.value;
            if (await updateFirestoreContent()) { renderInfoPanel(); toggleEditMode('view', 'usernote'); showToast('?좎??명듃媛 ??λ릺?덉뒿?덈떎.'); }
        });

        downloadJsonBtn.addEventListener('click', (e) => { e.preventDefault(); const title = (currentPost.title.trim() || 'chat').normalize('NFC'); downloadFile(currentPost.content, title + '.json', 'application/json'); closePanel(); });
        downloadTxtBtn.addEventListener('click', (e) => { e.preventDefault(); const title = (currentPost.title.trim() || 'chat').normalize('NFC'); downloadFile(generateTxtFromChat(), title + '.txt', 'text/plain'); closePanel(); });
        
        dropdownDeleteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            closePanel();
            if (!currentPost.id) return;
            if (confirm('?뺣쭚濡???梨꾪똿 湲곕줉????젣?섏떆寃좎뒿?덇퉴?')) {
                try {
                    // 1. Firestore?먯꽌 ??젣瑜?湲곕떎由쎈땲??
                    await db.collection('posts').doc(currentPost.id).delete();
                    
                    // 2. 愿??濡쒖뺄 ?곗씠?곕? 吏?곷땲??
                    localStorage.removeItem('currentPost');
                    localStorage.removeItem(`memo_${currentPost.id}`);
                    
                    // 3. ??젣 ?꾨즺 ?? 梨꾪똿 紐⑸줉 ?섏씠吏濡?吏곸젒 ?대룞?⑸땲??
                    window.location.href = 'chat-list.html';

                } catch (error) { 
                    console.error("??젣 ?ㅽ뙣:", error); 
                    showToast('??젣???ㅽ뙣?덉뒿?덈떎.'); 
                }
            }
        });

        if (roleToggleBtn && addMessageBtn && newMessageInput) {
        roleToggleBtn.addEventListener('click', () => {
            if (currentRole === 'user') { currentRole = 'assistant'; roleToggleBtn.textContent = '?쨼'; roleToggleBtn.title = '??븷 ?꾪솚 (?꾩옱: ?댁떆?ㅽ꽩??'; } 
            else { currentRole = 'user'; roleToggleBtn.textContent = '?뫀'; roleToggleBtn.title = '??븷 ?꾪솚 (?꾩옱: ?좎?)'; }
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
                showToast('硫붿떆吏媛 異붽??섏뿀?듬땲??');
            }
        });
        const autoResizeInput = () => { newMessageInput.style.height = 'auto'; newMessageInput.style.height = newMessageInput.scrollHeight + 'px'; };
        newMessageInput.addEventListener('input', autoResizeInput);
        }

        scrollToBottomBtn.addEventListener('click', () => {
            window.scrollTo({
                top: document.body.scrollHeight,
                behavior: 'smooth'
            });
        });
    }

    // --- ?숈쟻 UI ?앹꽦 諛??대깽??諛붿씤??---
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
        editActions.innerHTML = `<button class="save-edit-btn" title="저장">✓</button><button class="cancel-edit-btn" title="취소">×</button>`;
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-bubble-btn';
        deleteBtn.textContent = '×';
        deleteBtn.title = '메시지 삭제';
        
        bubble.appendChild(deleteBtn);
        bubble.appendChild(viewContent);
        bubble.appendChild(editContent);
        bubble.appendChild(editActions);

        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`??硫붿떆吏瑜??뺣쭚 ??젣?섏떆寃좎뒿?덇퉴?\n\n?댁슜: "${message.content.substring(0, 30)}..."`)) {
                currentChatData.messages.splice(index, 1);
                if (await updateFirestoreContent()) { renderMessages(); showToast('硫붿떆吏媛 ??젣?섏뿀?듬땲??'); }
            }
        });

        const startPress = (e) => { document.querySelectorAll('.message-bubble.show-delete').forEach(b => b.classList.remove('show-delete')); longPressTimer = setTimeout(() => { bubble.classList.add('show-delete'); }, 800); };
        const cancelPress = () => { clearTimeout(longPressTimer); };
        bubble.addEventListener('mousedown', startPress);
        bubble.addEventListener('mouseup', cancelPress);
        bubble.addEventListener('mouseleave', cancelPress);
        bubble.addEventListener('touchstart', startPress, { passive: true });
        bubble.addEventListener('touchend', cancelPress);

        viewContent.addEventListener('dblclick', () => {
            if (activeEditingIndex !== null) { showToast('癒쇱? ?ㅻⅨ ??ぉ???섏젙???꾨즺?댁＜?몄슂.'); return; }
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
                showToast('硫붿떆吏媛 ?섏젙?섏뿀?듬땲??');
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
    
    // --- ?ы띁 ?⑥닔 ---
    const showToast = message => { const toastNotification = document.getElementById('toast-notification'); const toastMessage = toastNotification ? toastNotification.querySelector('.toast-message') : null; if (!toastNotification || !toastMessage) return; clearTimeout(toastTimer); toastMessage.textContent = message; toastNotification.classList.add('show'); toastTimer = setTimeout(() => { toastNotification.classList.remove('show'); }, 3000); };
    function downloadFile(content, filename, contentType) { const blob = new Blob([content], { type: contentType }); const link = document.createElement("a"); const url = URL.createObjectURL(blob); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); }
    function generateTxtFromChat() { return currentChatData.messages.map(msg => `${msg.role === 'user' ? 'USER' : 'ASSISTANT'}:\n${msg.content}`).join('\n\n') || "梨꾪똿 湲곕줉???놁뒿?덈떎."; }
    function autoResizeTextarea(event) { const textarea = event.target; textarea.style.height = 'auto'; textarea.style.height = (textarea.scrollHeight) + 'px'; }
    function handleHeaderVisibility() { if (header) { const currentScrollY = window.scrollY; header.style.transform = (currentScrollY > lastScrollY && currentScrollY > header.offsetHeight) ? 'translateY(-100%)' : 'translateY(0)'; lastScrollY = currentScrollY; } }
    
    function handleScrollToBottomVisibility() {
        if (!scrollToBottomBtn) return;
        if (window.scrollY + window.innerHeight >= document.body.scrollHeight - 20) {
            scrollToBottomBtn.classList.add('hide');
        } else {
            scrollToBottomBtn.classList.remove('hide');
        }
    }
});

