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

    // ===============================================
    // 페이지 초기화 및 데이터 로딩
    // ===============================================

    auth.onAuthStateChanged(async user => {
        if (user) {
            initializePage();
            await fetchPosts(user.uid);
            renderList();
            addEventListeners(); // ★★★ 모든 이벤트 리스너를 한 곳에서 관리
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
                // ★ 이제 order 뿐만 아니라 parentId도 쿼리에 필요할 수 있습니다.
                // 만약 색인 오류가 발생하면 콘솔의 링크를 통해 색인을 추가해주세요.
                .get();
            posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("데이터 불러오기 실패:", error);
            if (error.code === 'failed-precondition') {
                alert("Firestore 색인이 필요합니다. 개발자 콘솔(F12)의 에러 메시지에 있는 링크를 클릭하여 색인을 생성해주세요.");
            }
        }
    }

    // ===============================================
    // ★★★ 핵심 수정: 화면 그리기 (Render)
    // ===============================================

    function renderList() {
    if (!normalItemList) return;

    // ★ 1. 그리기 전에, 현재 열려있는 폴더들의 ID를 기억합니다.
    const openFolderIds = new Set();
    document.querySelectorAll('.list-item.open').forEach(li => {
        openFolderIds.add(li.dataset.id);
    });

    // 목록을 완전히 비웁니다.
    normalItemList.innerHTML = '';

    const rootItems = posts
        .filter(p => !p.parentId || p.parentId === 'root')
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    rootItems.forEach(item => {
        renderItem(item, normalItemList);
    });

    // ★ 2. 그린 후에, 기억해둔 ID를 가진 폴더들을 다시 열어줍니다.
    if (openFolderIds.size > 0) {
        openFolderIds.forEach(id => {
            const folderLi = normalItemList.querySelector(`.list-item[data-id="${id}"]`);
            if (folderLi) {
                // handleFolderClick 함수를 재사용해서 폴더를 여는 동작을 실행
                handleFolderClick(folderLi, false); // false는 애니메이션 없이 바로 열리게 하는 옵션 (선택사항)
            }
        });
    }

    document.querySelectorAll('.sub-list').forEach(subList => {
        initializeSortable(subList);
    });
    initializeSortable(normalItemList);
    }

    function renderItem(itemData, parentElement) {
        const li = document.createElement('li');
        li.className = 'list-item';
        li.dataset.id = itemData.id;

        const wrapper = document.createElement('div');
        wrapper.className = 'item-content-wrapper';
        
        let iconHtml;
        if (itemData.type === 'folder') {
            // ★ 수정된 부분 ★
            // 닫힌 아이콘과 열린 아이콘을 모두 만들어두고, CSS로 보이거나 안보이게 제어
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
    // ★★★ 핵심 수정: 모든 이벤트 리스너 통합 관리
    // ===============================================

    function addEventListeners() {
        // 로그아웃 버튼
        logoutButton.addEventListener('click', e => {
            e.preventDefault();
            auth.signOut().then(() => window.location.href = 'index.html');
        });

        // 새 폴더 버튼
        newFolderBtn.addEventListener('click', () => handleNewItem('folder'));
        // 새 파일 버튼
        newPostBtn.addEventListener('click', () => handleNewItem('post'));
        
        // ★ 이벤트 위임(Event Delegation)으로 목록의 모든 클릭을 한 번에 처리!
        normalItemList.addEventListener('click', e => {
            const wrapper = e.target.closest('.item-content-wrapper');
            if (!wrapper) return;

            const li = wrapper.closest('.list-item');
            if (!li) return;

            // 휴지통 버튼을 클릭한 경우
            if (e.target.classList.contains('delete-folder-btn')) {
                e.stopPropagation(); // ★ 이벤트 전파를 막아 폴더가 열리지 않게 함!
                if (confirm('폴더를 삭제하시겠습니까?\n(안에 있는 파일은 밖으로 이동됩니다)')) {
                    deleteFolder(li.dataset.id);
                }
                return;
            }
            
            // 폴더를 클릭한 경우
            if (li.classList.contains('item-folder')) {
                handleFolderClick(li);
            } 
            // 파일을 클릭한 경우
            else {
                handleFileClick(li);
            }
        });
    }

    // ===============================================
    // 이벤트 핸들러 함수들
    // ===============================================

    async function handleNewItem(type) {
    const title = prompt(`새 ${type === 'folder' ? '폴더' : '게시글'}의 이름을 입력하세요.`);
    if (!title) return;

    const user = auth.currentUser;
    if (!user) return;

    const batch = db.batch();

    // ★★★ 타입에 따라 로직을 분기합니다. ★★★
    if (type === 'folder') {
        // [폴더를 추가하는 경우]
        
        // 1. 기존 루트 아이템들의 order를 1씩 뒤로 밉니다.
        const rootItems = posts.filter(p => !p.parentId || p.parentId === 'root');
        rootItems.forEach(item => {
            const itemRef = postsCollection.doc(item.id);
            batch.update(itemRef, { order: (item.order || 0) + 1 });
        });

        // 2. 새 폴더를 order: 0 (맨 위)으로 추가합니다.
        const newFolderRef = postsCollection.doc(); // 미리 참조를 만듭니다.
        batch.set(newFolderRef, {
            type: 'folder',
            title: title,
            content: '',
            category: currentCategory,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            userId: user.uid,
            order: 0, // 맨 위로
            parentId: 'root'
        });

    } else {
        // [파일(게시글)을 추가하는 경우] - 기존 로직과 거의 동일
        
        // 전체 posts 배열에서 가장 큰 order 값을 찾습니다.
        const maxOrder = posts.length > 0 ? Math.max(...posts.map(p => p.order || 0)) : -1;
        const newOrder = maxOrder + 1;

        // 새 파일을 맨 뒤 순서로 추가합니다.
        const newPostRef = postsCollection.doc();
        batch.set(newPostRef, {
            type: 'post',
            title: title,
            content: '',
            category: currentCategory,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            userId: user.uid,
            order: newOrder, // 맨 아래로
            parentId: 'root'
        });
    }

    // 준비된 모든 작업을 한 번에 실행합니다.
    try {
        await batch.commit();
        await fetchPosts(user.uid);
        renderList();
    } catch(error) {
        console.error("항목 추가 실패:", error);
        showToast('항목 추가에 실패했습니다.');
    }
    }

    function handleFolderClick(liElement, withAnimation = true) {
    if (withAnimation) {
        liElement.classList.toggle('open');
    } else {
        liElement.classList.add('open'); // 애니메이션 없을 땐 그냥 열기만 함
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
            localStorage.setItem('currentPost', JSON.stringify(post));
            localStorage.setItem('currentCategory', currentCategory);
            window.location.href = 'post.html';
        }
    }

    async function deleteFolder(folderId) {
    const user = auth.currentUser;
    if (!user || !folderId) return;

    // 1. 메모리(posts 배열)에서 필요한 조각들을 준비합니다.
    const folderToDelete = posts.find(p => p.id === folderId);
    if (!folderToDelete) return;

    // 폴더 안의 자식들을 순서대로 가져옵니다.
    const childrenOfFolder = posts
        .filter(p => p.parentId === folderId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    // 현재 루트에 있는 모든 아이템을 순서대로 가져옵니다.
    const originalRootItems = posts
        .filter(p => (!p.parentId || p.parentId === 'root'))
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    // 2. ★★★ 핵심 로직: splice를 이용해 폴더를 자식들로 교체합니다.
    // 삭제될 폴더의 현재 인덱스(위치)를 찾습니다.
    const folderIndex = originalRootItems.findIndex(p => p.id === folderId);

    if (folderIndex > -1) {
        // `splice`를 사용해, folderIndex 위치의 1개(폴더)를 제거하고,
        // 그 자리에 childrenOfFolder 배열의 모든 내용을 삽입합니다.
        originalRootItems.splice(folderIndex, 1, ...childrenOfFolder);
    }

    // 이제 `originalRootItems`는 완벽하게 정렬된 최종 목록이 됩니다.

    // 3. 새로 정렬된 순서대로 Firestore에 한 번에 업데이트합니다.
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

    // 폴더 자체는 이제 삭제해도 됩니다.
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

    // ===============================================
    // ★★★ 핵심 수정: 드래그 앤 드롭 (SortableJS)
    // ===============================================
    
    function initializeSortable(targetUl) {
        if (!targetUl) return;

        new Sortable(targetUl, {
            group: 'nested', // ★ 같은 그룹끼리 아이템 이동 가능
            handle: '.drag-handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            
            // 드롭이 끝났을 때 실행되는 함수
            onEnd: async (evt) => {
                const itemId = evt.item.dataset.id;
                const newParentEl = evt.to;
                
                let newParentId = 'root';
                // 드롭된 곳이 하위 리스트(sub-list)라면, 그 부모 li의 id가 새로운 parentId가 됨
                if (newParentEl.classList.contains('sub-list')) {
                    newParentId = newParentEl.closest('.list-item').dataset.id;
                }

                // 1. parentId를 Firestore에 업데이트합니다.
                try {
                    await postsCollection.doc(itemId).update({ parentId: newParentId });
                } catch (error) {
                    console.error('Parent ID 업데이트 실패:', error);
                    // 실패 시 원래대로 되돌리는 로직이 필요하지만, 우선은 에러만 기록
                    return; 
                }

                // 2. 이동이 발생한 모든 리스트의 순서를 다시 계산하고 업데이트합니다.
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
                    // 최종적으로 데이터와 화면을 동기화합니다.
                    await fetchPosts(auth.currentUser.uid);
                    renderList();
                } catch (error) {
                    console.error('순서 저장에 실패했습니다:', error);
                }
            }
        });
    }
});