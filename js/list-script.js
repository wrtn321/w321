// list-script.js (새 파일 버튼 기능이 수정된 최종 버전)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const postsCollection = db.collection('posts');
    let currentCategory = '';
    let posts = [];
    const categoryNames = { prompt: '프롬프트', chat: '채팅백업', novel: '소설' };

    const listTitle = document.getElementById('list-title');
    const newPostBtn = document.querySelector('.new-post-btn');
    const newFolderBtn = document.querySelector('.new-folder-btn');
    const normalItemList = document.querySelector('.normal-list .item-list');
    const logoutButton = document.querySelector('.logout-button');

    // ... (토스트 알림 관련 코드는 그대로 유지) ...
    const toastNotification = document.getElementById('toast-notification');
    const toastMessage = toastNotification ? toastNotification.querySelector('.toast-message') : null;
    let toastTimer;
    const showToast = message => {
        if (!toastNotification || !toastMessage) return;
        clearTimeout(toastTimer);
        toastMessage.textContent = message;
        toastNotification.classList.add('show');
        toastTimer = setTimeout(() => { toastNotification.classList.remove('show'); }, 3000);
    };

    auth.onAuthStateChanged(async user => {
        if (user) {
            initializePage();
            await fetchPosts(user.uid);
            renderList();
            addEventListeners();
        } else {
            window.location.href = 'index.html';
        }
    });

    function initializePage() {
        const params = new URLSearchParams(window.location.search);
        const categoryParam = params.get('category');
        if (categoryParam && categoryNames[categoryParam]) {
            currentCategory = categoryParam;
            listTitle.textContent = categoryNames[currentCategory];
        if (currentCategory === 'chat') {
            newPostBtn.textContent = '+ JSON 불러오기';
        } else {
            newPostBtn.textContent = '+📝';
        }
    } else {
        alert('잘못된 접근입니다.');
        window.location.href = 'main.html';
    }
    }

    async function fetchPosts(userId) {
        try {
            const snapshot = await postsCollection
                .where('userId', '==', userId)
                .where('category', '==', currentCategory)
                .get();
            posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("데이터 불러오기 실패:", error);
            if (error.code === 'failed-precondition') {
                alert("Firestore 색인이 필요합니다. 개발자 콘솔(F12)의 에러 메시지에 있는 링크를 클릭하여 색인을 생성해주세요.");
            }
        }
    }

    // renderList, renderItem 함수는 수정할 필요 없이 그대로 사용합니다.
    function renderList() {
        // ... (기존 renderList 함수 코드는 그대로) ...
        if (!normalItemList) return;
        const openFolderIds = new Set();
        document.querySelectorAll('.list-item.open').forEach(li => {
            openFolderIds.add(li.dataset.id);
        });
        normalItemList.innerHTML = '';
        const rootItems = posts
            .filter(p => !p.parentId || p.parentId === 'root')
            .sort((a, b) => (a.order || 0) - (b.order || 0));
        rootItems.forEach(item => {
            renderItem(item, normalItemList);
        });
        if (openFolderIds.size > 0) {
            openFolderIds.forEach(id => {
                const folderLi = normalItemList.querySelector(`.list-item[data-id="${id}"]`);
                if (folderLi) {
                    handleFolderClick(folderLi, false);
                }
            });
        }
        document.querySelectorAll('.sub-list').forEach(subList => {
            initializeSortable(subList);
        });
        initializeSortable(normalItemList);
    }
    
    function renderItem(itemData, parentElement) {
        // ... (기존 renderItem 함수 코드는 그대로) ...
        const li = document.createElement('li');
        li.className = 'list-item';
        li.dataset.id = itemData.id;
        const wrapper = document.createElement('div');
        wrapper.className = 'item-content-wrapper';
        let iconHtml;
        if (itemData.type === 'folder') {
            iconHtml = '<span class="icon-closed">📁</span><span class="icon-open">📂</span>';
        } else {
            iconHtml = '📝';
        }
        wrapper.innerHTML = `
        <span class="drag-handle">⠿</span>
        <span class="item-icon">${iconHtml}</span>
        <span class="item-title">${itemData.title}</span>
        ${itemData.type === 'folder' ? '<button class="delete-folder-btn">🗑️</button>' : ''}
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
    
    // ===============================================
    // ★★★ 핵심 수정 부분 1: 이벤트 리스너 변경 ★★★
    // ===============================================
    function addEventListeners() {
        logoutButton.addEventListener('click', e => {
            e.preventDefault();
            auth.signOut().then(() => window.location.href = 'index.html');
        });

        // 새 폴더 버튼은 기존과 동일
        newFolderBtn.addEventListener('click', () => handleNewItem('folder'));
        
        // ▼▼▼ 새 파일 버튼의 동작을 변경합니다! ▼▼▼
        newPostBtn.addEventListener('click', () => {
            // 이제 prompt를 띄우거나 handleNewItem을 호출하지 않습니다.
            // 바로 post.html 페이지로, 현재 카테고리 정보와 '새 글'이라는 표시를 함께 넘겨줍니다.
            window.location.href = `post.html?category=${currentCategory}&new=true`;
        });
        // ▲▲▲ 여기까지가 새 파일 버튼의 새로운 기능입니다. ▲▲▲
        
        normalItemList.addEventListener('click', e => {
            const wrapper = e.target.closest('.item-content-wrapper');
            if (!wrapper) return;
            const li = wrapper.closest('.list-item');
            if (!li) return;
            if (e.target.classList.contains('delete-folder-btn')) {
                e.stopPropagation();
                if (confirm('폴더를 삭제하시겠습니까?\n(안에 있는 파일은 밖으로 이동됩니다)')) {
                    deleteFolder(li.dataset.id);
                }
                return;
            }
            if (li.classList.contains('item-folder')) {
                handleFolderClick(li);
            } else {
                handleFileClick(li);
            }
        });
    }

    // ===============================================
    // ★★★ 핵심 수정 부분 2: 함수 간소화 ★★★
    // ===============================================

    // handleNewItem 함수에서 'post' 관련 로직을 제거합니다. 이제 폴더 생성만 담당합니다.
    async function handleNewItem(type) {
        // 이 함수는 이제 type이 'folder'일 때만 호출됩니다.
        const title = prompt(`새 폴더의 이름을 입력하세요.`);
        if (!title) return;

        const user = auth.currentUser;
        if (!user) return;

        const batch = db.batch();

        const rootItems = posts.filter(p => !p.parentId || p.parentId === 'root');
        rootItems.forEach(item => {
            const itemRef = postsCollection.doc(item.id);
            batch.update(itemRef, { order: (item.order || 0) + 1 });
        });

        const newFolderRef = postsCollection.doc();
        batch.set(newFolderRef, {
            type: 'folder',
            title: title,
            content: '',
            category: currentCategory,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            userId: user.uid,
            order: 0,
            parentId: 'root'
        });

        try {
            await batch.commit();
            await fetchPosts(user.uid);
            renderList();
        } catch(error) {
            console.error("항목 추가 실패:", error);
            showToast('항목 추가에 실패했습니다.');
        }
    }

    // handleFolderClick, handleFileClick, deleteFolder, initializeSortable 함수는
    // 수정할 필요 없이 그대로 사용합니다.
    function handleFolderClick(liElement, withAnimation = true) { /* ... 기존 코드 ... */ 
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
            children.forEach(child => {
                renderItem(child, subList);
            });
        }
    }
    function handleFileClick(liElement) {
    const post = posts.find(p => p.id === liElement.dataset.id);
    if (post) {
        // 로컬 스토리지에 데이터를 저장하는 것은 동일합니다.
        localStorage.setItem('currentPost', JSON.stringify(post));
        localStorage.setItem('currentCategory', currentCategory);

        // ★★★ 여기가 핵심 변경사항 ★★★
        // 현재 카테고리가 'chat'이면 chat-viewer.html로,
        // 그 외에는 기존처럼 post.html로 이동합니다.
        if (currentCategory === 'chat') {
            window.location.href = 'chat-viewer.html';
        } else {
            window.location.href = 'post.html';
        }
    }
    }
    async function deleteFolder(folderId) { /* ... 기존 코드 ... */
        const user = auth.currentUser;
        if (!user || !folderId) return;
        const folderToDelete = posts.find(p => p.id === folderId);
        if (!folderToDelete) return;
        const childrenOfFolder = posts
            .filter(p => p.parentId === folderId)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
        const originalRootItems = posts
            .filter(p => (!p.parentId || p.parentId === 'root'))
            .sort((a, b) => (a.order || 0) - (b.order || 0));
        const folderIndex = originalRootItems.findIndex(p => p.id === folderId);
        if (folderIndex > -1) {
            originalRootItems.splice(folderIndex, 1, ...childrenOfFolder);
        }
        const batch = db.batch();
        originalRootItems.forEach((item, index) => {
            const itemRef = postsCollection.doc(item.id);
            const wasChild = childrenOfFolder.some(child => child.id === item.id);
            if (wasChild) {
                batch.update(itemRef, { parentId: 'root', order: index });
            } else {
                batch.update(itemRef, { order: index });
            }
        });
        batch.delete(postsCollection.doc(folderId));
        try {
            await batch.commit();
            showToast('폴더가 삭제되었습니다.');
            await fetchPosts(user.uid);
            renderList();
        } catch (error) {
            console.error("폴더 삭제 실패:", error);
            showToast('폴더 삭제에 실패했습니다.');
        }
    }
    function initializeSortable(targetUl) { /* ... 기존 코드 ... */
        if (!targetUl) return;
        new Sortable(targetUl, {
            group: 'nested',
            handle: '.drag-handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: async (evt) => {
                const itemId = evt.item.dataset.id;
                const newParentEl = evt.to;
                let newParentId = 'root';
                if (newParentEl.classList.contains('sub-list')) {
                    newParentId = newParentEl.closest('.list-item').dataset.id;
                }
                try {
                    await postsCollection.doc(itemId).update({ parentId: newParentId });
                } catch (error) {
                    console.error('Parent ID 업데이트 실패:', error);
                    return; 
                }
                const involvedLists = new Set([evt.from, evt.to]);
                const batch = db.batch();
                involvedLists.forEach(listEl => {
                    const items = listEl.children;
                    Array.from(items).forEach((item, index) => {
                        const docRef = postsCollection.doc(item.dataset.id);
                        batch.update(docRef, { order: index });
                    });
                });
                try {
                    await batch.commit();
                    console.log('순서가 성공적으로 저장되었습니다.');
                    await fetchPosts(auth.currentUser.uid);
                    renderList();
                } catch (error) {
                    console.error('순서 저장에 실패했습니다:', error);
                }
            }
        });
    }
});
