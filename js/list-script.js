// js/list-script.js (일반 글/소설 전용 스크립트)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const postsCollection = db.collection('posts');
    let currentCategory = '';
    let posts = [];
    
    const listTitle = document.getElementById('list-title');
    const newPostBtn = document.querySelector('.new-post-btn');
    const newFolderBtn = document.querySelector('.new-folder-btn');
    const normalItemList = document.querySelector('.normal-list .item-list');
    const logoutButton = document.querySelector('.logout-button');

    auth.onAuthStateChanged(async user => {
        if (user) {
            initializePage();
            if (!currentCategory) return;
            await fetchPosts(user.uid);
            renderList();
            addEventListeners(user);
        } else {
            window.location.href = 'index.html';
        }
    });

    function initializePage() {
        const params = new URLSearchParams(window.location.search);
        const categoryParam = params.get('category');
        const titleFromStorage = localStorage.getItem('currentListTitle');
        
        if (categoryParam) {
            currentCategory = categoryParam;
            listTitle.textContent = titleFromStorage || currentCategory; 
            newPostBtn.textContent = '+📝';
        } else {
            alert('잘못된 접근입니다. (카테고리 정보 없음)');
            window.location.href = 'main.html';
            currentCategory = null;
        }
    }

    async function fetchPosts(userId) {
    try {
        // ▼▼▼ 여기에 .orderBy('isPinned', 'desc') 를 추가합니다. ▼▼▼
        const snapshot = await postsCollection
            .where('userId', '==', userId)
            .where('category', '==', currentCategory)
            .orderBy('isPinned', 'desc') // 1. 고정된 항목을 위로
            .orderBy('order', 'asc')      // 2. 그 안에서 기존 순서대로 정렬
            .get();
        posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("데이터 불러오기 실패:", error);
        if (error.code === 'failed-precondition') {
            // ★★★★★ 중요 ★★★★★
            // 이 메시지가 콘솔에 나타나면, 에러 메시지에 포함된 링크를 클릭해서
            // Firestore 색인을 꼭 생성해주셔야 합니다!
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
        
        newPostBtn.addEventListener('click', () => {
            window.location.href = `post.html?category=${currentCategory}&new=true`;
        });
        
         normalItemList.addEventListener('click', e => {
        const li = e.target.closest('.list-item');
        if (!li) return;
        const itemId = li.dataset.id;
        
        // ▼▼▼ 고정 버튼 클릭 이벤트 처리 로직 추가 ▼▼▼
        if (e.target.classList.contains('pin-btn')) {
            e.stopPropagation(); // 다른 이벤트와 충돌 방지
            const post = posts.find(p => p.id === itemId);
            if(post) {
                // 현재 고정 상태의 반대 값으로 업데이트
                togglePinStatus(user.uid, itemId, !post.isPinned);
            }
            return;
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
            localStorage.setItem('currentPost', JSON.stringify(post));
            localStorage.setItem('currentCategory', currentCategory);
            window.location.href = 'post.html';
        }
    }

    function renderList() {
        if (!normalItemList) return;
        const openFolderIds = new Set(Array.from(document.querySelectorAll('.list-item.open')).map(li => li.dataset.id));
        normalItemList.innerHTML = '';
        const rootItems = posts.filter(p => !p.parentId || p.parentId === 'root').sort((a, b) => (a.order || 0) - (b.order || 0));
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
    
    // ▼▼▼ 고정 상태에 따라 'pinned' 클래스 추가 ▼▼▼
    if (itemData.isPinned) {
        li.classList.add('pinned');
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'item-content-wrapper';
    let iconHtml = itemData.type === 'folder' ? '<span class="icon-closed">📁</span><span class="icon-open">📂</span>' : '📝';
    
    // ▼▼▼ HTML 구조 안에 pin-btn 추가 ▼▼▼
    const pinTitle = itemData.isPinned ? '고정 해제' : '고정하기';
    const pinIcon = itemData.isPinned ? '📌' : '📍';

    wrapper.innerHTML = `
        <span class="drag-handle">⠿</span>
        <button class="pin-btn" title="${pinTitle}">${pinIcon}</button> <!-- 고정 버튼 -->
        <span class="item-icon">${iconHtml}</span>
        <span class="item-title">${itemData.title}</span>
        ${itemData.type === 'folder' ? `<button class="edit-folder-btn" title="폴더 이름 변경">✏️</button><button class="delete-folder-btn" title="폴더 삭제">🗑️</button>` : ''}
    `;
    li.appendChild(wrapper);
        if (itemData.type === 'folder') {
            li.classList.add('item-folder');
            const subList = document.createElement('ul');
            subList.className = 'sub-list item-list';
            li.appendChild(subList);
        }
        parentElement.appendChild(li);
    }

    function handleFolderClick(liElement, withAnimation = true) {
        if (withAnimation) liElement.classList.toggle('open');
        else liElement.classList.add('open');
        const subList = liElement.querySelector('.sub-list');
        if (liElement.classList.contains('open') && subList.children.length === 0) {
            const children = posts.filter(p => p.parentId === liElement.dataset.id).sort((a, b) => (a.order || 0) - (b.order || 0));
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
                userId: userId, order: minOrder - 1, parentId: 'root'
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

    async function togglePinStatus(userId, postId, shouldBePinned) {
        try {
            await postsCollection.doc(postId).update({ isPinned: shouldBePinned });
            showToast(shouldBePinned ? '상단에 고정되었습니다.' : '고정이 해제되었습니다.');
            await fetchPosts(userId); // 데이터를 다시 불러와서
            renderList();             // 목록을 새로고침
        } catch (error) {
            console.error("고정 상태 변경 실패:", error);
            showToast('상태 변경에 실패했습니다.');
        }
    }
});

