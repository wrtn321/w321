// js/list-script.js (일반 글/소설 전용 스크립트)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const postsCollection = db.collection('posts');
    let currentCategory = ''; // URL에 따라 동적으로 변경될 변수
    let posts = [];
    // 이 스크립트가 인식하는 카테고리 목록
    const categoryNames = { prompt: '프롬프트', novel: '소설' };

    // --- HTML 요소 가져오기 ---
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

    // --- Firebase 인증 및 데이터 로드 ---
    auth.onAuthStateChanged(async user => {
        if (user) {
            initializePage(); // 페이지 초기화가 먼저!
            if (!currentCategory) return; // 유효한 카테고리가 아니면 중단

            await fetchPosts(user.uid);
            renderList();
            addEventListeners(user);
        } else {
            window.location.href = 'index.html';
        }
    });

    // ★★★ 핵심: URL에서 카테고리를 읽어오는 함수 ★★★
    function initializePage() {
        const params = new URLSearchParams(window.location.search);
        const categoryParam = params.get('category');
        
        // URL의 category가 유효한 경우 (prompt, novel)
        if (categoryParam && categoryNames[categoryParam]) {
            currentCategory = categoryParam;
            listTitle.textContent = categoryNames[currentCategory];
            newPostBtn.textContent = '+📝'; // 버튼 텍스트 고정
        } else {
            // 유효하지 않은 카테고리이거나, category 파라미터가 없으면 메인으로 보냄
            alert('잘못된 접근입니다.');
            window.location.href = 'main.html';
            currentCategory = null; // 작업을 중단시키기 위해 null로 설정
        }
    }

    async function fetchPosts(userId) {
        try {
            const snapshot = await postsCollection
                .where('userId', '==', userId)
                .where('category', '==', currentCategory) // 여기서 동적으로 설정된 카테고리 사용
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
        
        // '+📝' 버튼 클릭 시 새 글 작성 페이지로 이동
        newPostBtn.addEventListener('click', () => {
            window.location.href = `post.html?category=${currentCategory}&new=true`;
        });
        
        normalItemList.addEventListener('click', e => {
            const li = e.target.closest('.list-item');
            if (!li) return;
            const itemId = li.dataset.id;
            
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
                    handleFileClick(li); // 일반 글 파일 클릭
                }
            }
        });
    }

    // --- 핵심 기능 함수 ---

    // 파일을 클릭하면 항상 post.html 로 이동
    function handleFileClick(liElement) {
        const post = posts.find(p => p.id === liElement.dataset.id);
        if (post) {
            localStorage.setItem('currentPost', JSON.stringify(post));
            localStorage.setItem('currentCategory', currentCategory);
            window.location.href = 'post.html';
        }
    }
    
    // --- 렌더링 및 UI 관련 함수 (chat-list와 거의 동일) ---

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
        const wrapper = document.createElement('div');
        wrapper.className = 'item-content-wrapper';
        // 아이콘을 문서(📝) 모양으로 변경
        let iconHtml = itemData.type === 'folder' 
            ? '<span class="icon-closed">📁</span><span class="icon-open">📂</span>' 
            : '📝';
        wrapper.innerHTML = `
            <span class="drag-handle">⠿</span>
            <span class="item-icon">${iconHtml}</span>
            <span class="item-title">${itemData.title}</span>
            ${itemData.type === 'folder' 
                ? `<button class="edit-folder-btn" title="폴더 이름 변경">✏️</button>
                   <button class="delete-folder-btn" title="폴더 삭제">🗑️</button>` 
                : ''
            }
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
                type: 'folder',
                title: title,
                content: '',
                category: currentCategory,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                userId: userId,
                order: minOrder - 1,
                parentId: 'root'
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
    
    function initializeSortable(targetUl) {
        // ... (기존과 동일)
        if (!targetUl || targetUl.sortable) return;
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
