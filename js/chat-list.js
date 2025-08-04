// js/chat-list.js (핀 편집 모드 및 폴더 기능 모두 적용된 최종본)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const postsCollection = db.collection('posts');
    const currentCategory = 'chat'; // 이 스크립트는 항상 'chat' 카테고리만 다룹니다.
    let posts = [];

    // --- HTML 요소 가져오기 ---
    const listContainer = document.querySelector('.list-container');
    const listTitle = document.getElementById('list-title');
    const pinEditBtn = document.querySelector('.pin-edit-btn'); // 핀 편집 버튼
    const newPostBtn = document.querySelector('.new-post-btn');
    const newFolderBtn = document.querySelector('.new-folder-btn');
    const normalItemList = document.querySelector('.normal-list .item-list');
    const logoutButton = document.querySelector('.logout-button');

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

    function initializePage() {
        listTitle.textContent = localStorage.getItem('currentListTitle') || '채팅백업';
    }

    async function fetchPosts(userId) {
        try {
            const snapshot = await postsCollection
                .where('userId', '==', userId)
                .where('category', '==', currentCategory)
                .orderBy('isPinned', 'desc') // 고정된 항목 우선 정렬
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

    // --- 이벤트 리스너 ---
    function addEventListeners(user) {
        logoutButton.addEventListener('click', e => {
            e.preventDefault();
            auth.signOut().then(() => window.location.href = 'index.html');
        });

        newFolderBtn.addEventListener('click', () => handleNewFolder(user.uid));
        newPostBtn.addEventListener('click', handleJsonUpload);
        
        // 핀 편집 버튼 이벤트 리스너
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
        
        // 목록 클릭 이벤트 리스너
        normalItemList.addEventListener('click', e => {
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

    // --- 핵심 기능 함수 ---

    function handleFileClick(liElement) {
        const post = posts.find(p => p.id === liElement.dataset.id);
        if (post) {
            localStorage.setItem('currentPost', JSON.stringify(post));
            localStorage.setItem('currentCategory', currentCategory);
            window.location.href = 'chat-viewer.html';
        }
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
    
    // ▼▼▼ 여기에 isPinned 필드 추가 로직이 들어갑니다 (아래 2번 항목에서 설명)
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
        
        // ▼▼▼ DB에 데이터를 추가하는 이 객체에 isPinned: false를 추가합니다. ▼▼▼
        await postsCollection.add({
            type: 'post',
            title: title,
            content: content,
            category: currentCategory,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            userId: user.uid,
            order: maxOrder + 1,
            parentId: 'root',
            isPinned: false // ★★★ 바로 이 부분입니다! ★★★
        });
        
        showToast(`'${title}' 파일이 추가되었습니다.`);
        await fetchPosts(user.uid);
        renderList();
    } catch (error) {
        console.error("JSON 파일로 게시글 생성 실패:", error);
        showToast('게시글 생성에 실패했습니다.');
    }
}
    
    // --- 렌더링 및 UI 관련 함수 ---

    function renderList() {
        if (!normalItemList) return;
        const openFolderIds = new Set(Array.from(document.querySelectorAll('.list-item.open')).map(li => li.dataset.id));
        normalItemList.innerHTML = '';
        const rootItems = posts
            .filter(p => !p.parentId || p.parentId === 'root')
            .sort((a, b) => (a.order || 0) - (b.order || 0));
        rootItems.forEach(item => renderItem(item, normalItemList));
        openFolderIds.forEach(id => {
            const folderLi = normalItemList.querySelector(`.list-item[data-id="${id}"]`);
            if (folderLi) handleFolderClick(folderLi, false);
        });
        document.querySelectorAll('.sub-list').forEach(initializeSortable);
        initializeSortable(normalItemList);
    }
    
    function renderItem(itemData, parentElement) {
        const li = document.createElement('li');
        li.className = 'list-item';
        li.dataset.id = itemData.id;
        
        if (itemData.isPinned) {
            li.classList.add('pinned');
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'item-content-wrapper';

        const isFolder = itemData.type === 'folder';
        const pinCheckboxHTML = isFolder ? '' : `<input type="checkbox" class="pin-checkbox" ${itemData.isPinned ? 'checked' : ''}>`;
        const pinIndicatorHTML = isFolder ? '' : '<span class="pin-indicator">📌</span>';
        
        let iconHtml = isFolder 
            ? '<span class="icon-closed">📁</span><span class="icon-open">📂</span>' 
            : '💬';

        wrapper.innerHTML = `
            <span class="drag-handle">⠿</span>
            ${pinCheckboxHTML}
            ${pinIndicatorHTML}
            <span class="item-icon">${iconHtml}</span>
            <span class="item-title">${itemData.title}</span>
            ${isFolder 
                ? `<button class="edit-folder-btn" title="폴더 이름 변경">✏️</button>
                   <button class="delete-folder-btn" title="폴더 삭제">🗑️</button>` 
                : ''
            }
        `;
        li.appendChild(wrapper);
        if (isFolder) {
            li.classList.add('item-folder');
            const subList = document.createElement('ul');
            subList.className = 'sub-list item-list';
            li.appendChild(subList);
        }
        parentElement.appendChild(li);
    }

    // --- 폴더 및 핀 관련 함수들 (list-script.js와 동일) ---

    function handleFolderClick(liElement, withAnimation = true) {
        if (withAnimation) {
            liElement.classList.toggle('open');
        } else {
            liElement.classList.add('open');
        }
        const subList = liElement.querySelector('.sub-list');
        if (liElement.classList.contains('open') && subList.children.length === 0) {
            const children = posts
                .filter(p => p.parentId === liElement.dataset.id)
                .sort((a, b) => (a.order || 0) - (b.order || 0));
            children.forEach(child => renderItem(child, subList));
        }
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
            const docRef = postsCollection.doc(child.id);
            batch.update(docRef, { parentId: 'root', order: Date.now() });
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
        const listItems = normalItemList.querySelectorAll('.list-item:not(.item-folder)');
        let hasChanges = false;
        listItems.forEach(li => {
            const postId = li.dataset.id;
            const post = posts.find(p => p.id === postId);
            const checkbox = li.querySelector('.pin-checkbox');
            if (post && checkbox) {
                const isNowPinned = checkbox.checked;
                if ((post.isPinned || false) !== isNowPinned) {
                    hasChanges = true;
                    const postRef = postsCollection.doc(postId);
                    batch.update(postRef, { isPinned: isNowPinned });
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

    // --- SortableJS 라이브러리 관련 함수 (list-script.js와 동일) ---
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
