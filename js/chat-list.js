// js/chat-list.js (핀 편집 모드, 폴더, 아이콘 제거 등 모든 기능 적용 최종본)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const postsCollection = db.collection('posts');
    const currentCategory = 'chat'; // 이 스크립트는 항상 'chat' 카테고리만 다룹니다.
    let posts = [];
    let hasRestoredListState = false;

    // --- HTML 요소 가져오기 ---
    const listContainer = document.querySelector('.list-container');
    const listTitle = document.getElementById('list-title');
    const pinEditBtn = document.querySelector('.pin-edit-btn');
    const newPostBtn = document.querySelector('.new-post-btn');
    const newFolderBtn = document.querySelector('.new-folder-btn');
    const normalItemList = document.querySelector('.normal-list .item-list');
    const logoutButton = document.querySelector('.logout-button');
    let folderSection = null;
    let memoGrid = null;

    // --- Firebase 인증 및 데이터 로드 ---
    auth.onAuthStateChanged(async user => {
        if (user) {
            initializePage();
            await fetchPosts(user.uid);
            renderList();
            addEventListeners(user);
        } else {
            window.location.href = 'index.html';
        }
    });

    window.addEventListener('app:beforeNavigate', saveListState);
    window.addEventListener('pagehide', saveListState);

    function initializePage() {
        // localStorage에 저장된 제목이 있으면 사용하고, 없으면 기본 제목을 사용합니다.
        listTitle.textContent = localStorage.getItem('currentListTitle') || '채팅 목록';
    }

    async function fetchPosts(userId) {
        try {
            const snapshot = await postsCollection
                .where('userId', '==', userId)
                .where('category', '==', currentCategory)
                .orderBy('isPinned', 'desc')
                .orderBy('order', 'asc')
                .get();
            posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("데이터 불러오기 실패:", error);
            if (error.code === 'failed-precondition') {
                alert("Firestore 색인이 필요합니다. 개발자 콘솔(F12)의 에러 메시지에 있는 링크를 클릭하여 색인을 생성해주세요.");
            }
        }
    }

    function addEventListeners(user) {
        logoutButton.addEventListener('click', e => {
            e.preventDefault();
            auth.signOut().then(() => window.location.href = 'index.html');
        });

        newFolderBtn.addEventListener('click', () => handleNewFolder(user.uid));
        newPostBtn.addEventListener('click', handleJsonUpload);
        
        pinEditBtn.addEventListener('click', () => {
            const isEditing = listContainer.classList.contains('pin-edit-mode');
            if (isEditing) {
                savePinChanges(user.uid);
                listContainer.classList.remove('pin-edit-mode');
                pinEditBtn.textContent = '📌 고정 편집';
                pinEditBtn.classList.remove('editing');
            } else {
                listContainer.classList.add('pin-edit-mode');
                pinEditBtn.textContent = '✓ 편집 완료';
                pinEditBtn.classList.add('editing');
            }
        });
        
        document.querySelector('.normal-list').addEventListener('click', e => {
            const li = e.target.closest('.list-item');
            if (!li) return;
            const itemId = li.dataset.id;
            
            if (listContainer.classList.contains('pin-edit-mode')) {
                if (!li.classList.contains('item-folder')) {
                    const checkbox = li.querySelector('.pin-checkbox');
                    if (checkbox && e.target !== checkbox) {
                        checkbox.checked = !checkbox.checked;
                    }
                }
                return; // 편집 모드에서는 페이지 이동 방지
            }

            if (e.target.classList.contains('edit-folder-btn')) {
                e.stopPropagation();
                editFolderName(user.uid, itemId);
                return;
            }
            if (e.target.classList.contains('delete-folder-btn')) {
                e.stopPropagation();
                if (confirm('폴더를 삭제하시겠습니까?\n(안에 있는 파일은 밖으로 이동됩니다)')) {
                    deleteFolder(user.uid, itemId);
                }
                return;
            }

            const wrapper = e.target.closest('.item-content-wrapper');
            if(wrapper) {
                if (li.classList.contains('item-folder')) {
                    handleFolderClick(li);
                } else {
                    handleFileClick(li);
                }
            }
        });
    }

    function handleFileClick(liElement) {
        const post = posts.find(p => p.id === liElement.dataset.id);
        if (post) {
            localStorage.setItem('currentCategory', currentCategory);
            window.appNavigate(`chat-viewer.html?id=${post.id}`);
        }
    }

    function getListStateKey() {
        return `listState_${currentCategory}`;
    }

    function getOpenFolderIds() {
        return Array.from(document.querySelectorAll('.list-item.item-folder.open')).map(li => li.dataset.id);
    }

    function getSavedListState() {
        try {
            return JSON.parse(localStorage.getItem(getListStateKey()) || '{}');
        } catch (error) {
            return {};
        }
    }

    function saveListState() {
        localStorage.setItem(getListStateKey(), JSON.stringify({
            scrollY: window.scrollY,
            openFolderIds: getOpenFolderIds()
        }));
    }

    function restoreListScroll() {
        if (hasRestoredListState) return;
        hasRestoredListState = true;
        const state = getSavedListState();
        if (typeof state.scrollY !== 'number') return;
        requestAnimationFrame(() => window.scrollTo(0, state.scrollY));
    }
    
    function handleJsonUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                const fileContent = event.target.result;
                const title = file.name.replace(/\.json$/, ''); 
                createPostFromJson(title, fileContent);
            };
            reader.onerror = () => showToast('파일을 읽는 데 실패했습니다.');
            reader.readAsText(file);
        };
        input.click();
    }

    async function createPostFromJson(title, content) {
        const user = auth.currentUser;
        if (!user) return;
        try {
            JSON.parse(content);
        } catch (error) {
            alert('올바른 JSON 파일이 아닙니다. 파일 내용을 확인해주세요.');
            return;
        }
        try {
            const maxOrder = posts.length > 0 ? Math.max(0, ...posts.map(p => p.order).filter(o => typeof o === 'number')) : -1;
            await postsCollection.add({
                type: 'post', title: title, content: content, category: currentCategory,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                userId: user.uid, order: maxOrder + 1, parentId: 'root',
                isPinned: false // ★★★ isPinned 기본값 추가 ★★★
            });
            showToast(`'${title}' 파일이 추가되었습니다.`);
            await fetchPosts(user.uid);
            renderList();
        } catch (error) {
            console.error("JSON 파일로 게시글 생성 실패:", error);
            showToast('게시글 생성에 실패했습니다.');
        }
    }

    function renderList() {
        if (!normalItemList) return;
        ensureListLayout();
        const savedState = getSavedListState();
        const savedOpenFolderIds = Array.isArray(savedState.openFolderIds) ? savedState.openFolderIds : [];
        const openFolderIds = new Set([
            ...Array.from(document.querySelectorAll('.list-item.open')).map(li => li.dataset.id),
            ...savedOpenFolderIds
        ]);
        folderSection.innerHTML = '';
        memoGrid.innerHTML = '';
        const rootItems = posts.filter(p => !p.parentId || p.parentId === 'root').sort(sortRootItems);
        rootItems.filter(item => item.type === 'folder').forEach(item => renderItem(item, folderSection));
        rootItems.filter(item => item.type !== 'folder').forEach(item => renderItem(item, memoGrid));
        openFolderIds.forEach(id => {
            const folderLi = folderSection.querySelector(`.list-item[data-id="${id}"]`);
            if (folderLi) handleFolderClick(folderLi, false);
        });
        document.querySelectorAll('.sub-list').forEach(initializeSortable);
        initializeSortable(folderSection);
        initializeSortable(memoGrid);
        restoreListScroll();
    }

    function ensureListLayout() {
        if (folderSection && memoGrid) return;
        const normalList = document.querySelector('.normal-list');
        normalList.innerHTML = `
            <h4 class="section-title">📂 폴더</h4>
            <ul class="folder-section item-list"></ul>
            <h4 class="section-title">📌 고정 및 📝 미분류 채팅</h4>
            <ul class="memo-grid item-list"></ul>
        `;
        folderSection = normalList.querySelector('.folder-section');
        memoGrid = normalList.querySelector('.memo-grid');
    }

    function sortRootItems(a, b) {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        if (a.type !== 'folder' && b.type !== 'folder') {
            const pinDiff = Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
            if (pinDiff) return pinDiff;
        }
        return (a.order || 0) - (b.order || 0);
    }
    
    function renderItem(itemData, parentElement) {
        const li = document.createElement('li');
        li.className = 'list-item';
        li.dataset.id = itemData.id;
        if (itemData.isPinned) { li.classList.add('pinned'); }

        const wrapper = document.createElement('div');
        wrapper.className = isFolder ? 'item-content-wrapper folder-header' : 'item-content-wrapper memo-item';

        const isFolder = itemData.type === 'folder';
        const iconHtml = isFolder ? '<span class="icon-closed">📁</span><span class="icon-open">📂</span>' : '';
        const pinCheckboxHTML = isFolder ? '' : `<input type="checkbox" class="pin-checkbox" ${itemData.isPinned ? 'checked' : ''}>`;
        const pinIndicatorHTML = isFolder ? '' : '<span class="pin-indicator">📌</span>';
        
        wrapper.innerHTML = `
            <span class="drag-handle">⠿</span>
            ${pinCheckboxHTML}
            ${pinIndicatorHTML}
            <span class="item-icon">${iconHtml}</span>
            <span class="item-title">${itemData.title}</span>
            ${isFolder ? `<button class="edit-folder-btn" title="폴더 이름 변경">✏️</button><button class="delete-folder-btn" title="폴더 삭제">🗑️</button>` : ''}
        `;
        li.appendChild(wrapper);

        if (isFolder) {
            li.classList.add('item-folder');
            li.classList.add('folder-card');
            const subList = document.createElement('ul');
            subList.className = 'sub-list item-list folder-content';
            li.appendChild(subList);
        }
        parentElement.appendChild(li);
    }

    function handleFolderClick(liElement, withAnimation = true) {
        if (withAnimation) { liElement.classList.toggle('open'); } 
        else { liElement.classList.add('open'); }
        const subList = liElement.querySelector('.sub-list');
        if (liElement.classList.contains('open') && subList.children.length === 0) {
            const children = posts.filter(p => p.parentId === liElement.dataset.id).sort((a, b) => (a.order || 0) - (b.order || 0));
            children.forEach(child => renderItem(child, subList));
            initializeSortable(subList);
        }
        if (withAnimation) saveListState();
    }

    async function handleNewFolder(userId) {
        const title = prompt(`새 폴더의 이름을 입력하세요.`);
        if (!title) return;
        try {
            const minOrder = posts.length > 0 ? Math.min(0, ...posts.map(p => p.order).filter(o => typeof o === 'number')) : 0;
            await postsCollection.add({
                type: 'folder', title: title, content: '', category: currentCategory,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                userId: userId, order: minOrder - 1, parentId: 'root', isPinned: false
            });
            await fetchPosts(userId);
            renderList();
        } catch(error) {
            console.error("폴더 추가 실패:", error);
            showToast('폴더 추가에 실패했습니다.');
        }
    }

    async function deleteFolder(userId, folderId) {
        const children = posts.filter(p => p.parentId === folderId);
        const batch = db.batch();
        children.forEach(child => {
            batch.update(postsCollection.doc(child.id), { parentId: 'root', order: Date.now() });
        });
        batch.delete(postsCollection.doc(folderId));
        try {
            await batch.commit();
            showToast('폴더가 삭제되었습니다.');
            await fetchPosts(userId);
            renderList();
        } catch (error) {
            console.error("폴더 삭제 실패:", error);
            showToast('폴더 삭제에 실패했습니다.');
        }
    }
    
    async function editFolderName(userId, folderId) {
        const folder = posts.find(p => p.id === folderId);
        if (!folder) return;
        const newTitle = prompt("폴더의 새 이름을 입력하세요.", folder.title);
        if (newTitle && newTitle.trim() !== '' && newTitle !== folder.title) {
            try {
                await db.collection('posts').doc(folderId).update({ title: newTitle });
                showToast('폴더 이름이 변경되었습니다.');
                await fetchPosts(userId);
                renderList();
            } catch (error) {
                console.error("이름 변경 실패:", error);
                showToast('이름 변경에 실패했습니다.');
            }
        }
    }

    async function savePinChanges(userId) {
        const batch = db.batch();
        const listItems = document.querySelectorAll('.normal-list .list-item:not(.item-folder)');
        let hasChanges = false;
        listItems.forEach(li => {
            const postId = li.dataset.id;
            const post = posts.find(p => p.id === postId);
            const checkbox = li.querySelector('.pin-checkbox');
            if (post && checkbox) {
                const isNowPinned = checkbox.checked;
                if ((post.isPinned || false) !== isNowPinned) {
                    hasChanges = true;
                    batch.update(postsCollection.doc(postId), { isPinned: isNowPinned });
                }
            }
        });
        if (hasChanges) {
            try {
                await batch.commit();
                showToast('고정 상태가 저장되었습니다.');
                await fetchPosts(userId);
                renderList();
            } catch (error) {
                console.error("고정 상태 저장 실패:", error);
                showToast('저장에 실패했습니다.');
            }
        }
    }

    function initializeSortable(targetUl) {
        if (!targetUl || targetUl.sortable) return;
        new Sortable(targetUl, {
            group: 'nested', handle: '.drag-handle', animation: 150, ghostClass: 'sortable-ghost',
            onEnd: async (evt) => {
                const itemId = evt.item.dataset.id;
                const newParentEl = evt.to;
                let newParentId = 'root';
                if (newParentEl.classList.contains('sub-list')) {
                    newParentId = newParentEl.closest('.list-item').dataset.id;
                }
                const batch = db.batch();
                batch.update(postsCollection.doc(itemId), { parentId: newParentId });
                const involvedLists = new Set([evt.from, evt.to]);
                involvedLists.forEach(listEl => {
                    Array.from(listEl.children).forEach((item, index) => {
                        batch.update(postsCollection.doc(item.dataset.id), { order: index });
                    });
                });
                try {
                    await batch.commit();
                    await fetchPosts(auth.currentUser.uid);
                    renderList();
                } catch (error) {
                    console.error('순서 저장에 실패했습니다:', error);
                }
            }
        });
    }
});
