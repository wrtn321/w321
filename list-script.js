document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // 전역 변수 및 요소
    const postsCollection = db.collection('posts');
    let currentCategory = '';
    let posts = [];
    const categoryNames = { prompt: '프롬프트', chat: '채팅백업', novel: '소설' };
    const listTitle = document.getElementById('list-title');
    const newPostBtn = document.querySelector('.new-post-btn');
    const newFolderBtn = document.querySelector('.new-folder-btn');
    const normalItemList = document.querySelector('.normal-list .item-list');
    let isDragging = false; // ★★★ 드래그 상태를 추적할 깃발 변수 ★★★

    // 토스트 알림 함수
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

    // =====================================================
    // 모든 로직의 시작점
    // =====================================================
    auth.onAuthStateChanged(async user => {
        if (user) {
            initializePage();
            await fetchPosts(user.uid);
            renderList();
        } else {
            window.location.href = 'index.html';
        }
    });

    // ... (로그아웃, 페이지 초기화, 데이터 가져오기, 데이터 추가하기 함수는 이전과 동일)
    
    // 페이지 초기화 함수
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

    // 데이터 가져오기 함수
    async function fetchPosts(userId) {
        try {
            const snapshot = await postsCollection
                .where('userId', '==', userId)
                .where('category', '==', currentCategory)
                .orderBy('order', 'asc')
                .get();
            posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`'${currentCategory}' 카테고리 데이터 로딩 성공:`, posts);
        } catch (error) {
            console.error("데이터 불러오기 실패:", error);
            if (error.code === 'failed-precondition') {
                alert("Firestore 색인이 필요합니다. 개발자 콘솔(F12)의 에러 메시지에 있는 링크를 클릭하여 색인을 생성해주세요.");
            }
        }
    }

    // 데이터 추가하기 함수
    async function addDataToFirestore(data, parentId = 'root') {
        const user = auth.currentUser;
        if (!user) return;
        const siblings = posts.filter(p => p.parentId === parentId);
        const newOrder = siblings.length > 0 ? Math.max(...siblings.map(p => p.order || 0)) + 1 : 0;
        try {
            await postsCollection.add({ ...data, category: currentCategory, createdAt: firebase.firestore.FieldValue.serverTimestamp(), userId: user.uid, order: newOrder, parentId: parentId });
        } catch (error) { console.error("문서 추가 실패:", error); }
    }


    // =====================================================
    // 렌더링 관련 함수들
    // =====================================================
    
    function renderList() {
        if (!normalItemList) return;
        normalItemList.innerHTML = '';
        const itemsById = {};
        posts.forEach(post => { itemsById[post.id] = { ...post, children: [] }; });
        const tree = [];
        Object.values(itemsById).forEach(item => {
            const parent = itemsById[item.parentId];
            if (item.parentId && parent) {
                parent.children.push(item);
            } else {
                tree.push(item);
            }
        });
        tree.sort((a, b) => a.order - b.order).forEach(item => renderItem(item, normalItemList, 0));
        addClickListenersToListItems();
        initializeSortable(normalItemList);
    }

    function renderItem(itemData, parentElement, level) {
        const li = document.createElement('li');
        li.className = 'list-item';
        li.dataset.id = itemData.id;
        li.dataset.level = level;
        const icon = itemData.type === 'folder' ? '📁' : '📝';
        li.innerHTML = `<span class="drag-handle">⠿</span><span class="item-icon">${icon}</span><span class="item-title">${itemData.title}</span>`;
        parentElement.appendChild(li);

        if (itemData.type === 'folder') {
            li.classList.add('item-folder');
            const ul = document.createElement('ul');
            ul.className = 'child-list is-collapsed';
            ul.dataset.parentId = itemData.id;
            parentElement.appendChild(ul);
            initializeSortable(ul);
            if (itemData.children.length > 0) {
                itemData.children.sort((a, b) => a.order - b.order).forEach(child => renderItem(child, ul, level + 1));
            }
        }
    }

    // =====================================================
    // 이벤트 리스너 관련 함수들
    // =====================================================
    
    function addClickListenersToListItems() {
        document.querySelectorAll('.list-container .list-item').forEach(item => {
            item.addEventListener('click', e => {
                if (isDragging || e.target.classList.contains('drag-handle') || e.target.tagName === 'INPUT') { // ★★★ isDragging 체크 추가 ★★★
                    return;
                }
                const itemIsFolder = item.classList.contains('item-folder');
                if (itemIsFolder) {
                    const childList = item.nextElementSibling;
                    if (childList && childList.tagName === 'UL') {
                        childList.classList.toggle('is-collapsed');
                        item.classList.toggle('is-expanded');
                        const iconElement = item.querySelector('.item-icon');
                        iconElement.textContent = item.classList.contains('is-expanded') ? '📂' : '📁';
                    }
                } else {
                    const post = posts.find(p => p.id === item.dataset.id);
                    if (post) {
                        localStorage.setItem('currentPost', JSON.stringify(post));
                        localStorage.setItem('currentCategory', currentCategory);
                        window.location.href = 'post.html';
                    }
                }
            });

            item.addEventListener('dblclick', e => {
                e.preventDefault();
                const titleSpan = item.querySelector('.item-title');
                if (!titleSpan || item.querySelector('.title-input')) return;
                const currentTitle = titleSpan.textContent;
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'title-input';
                input.value = currentTitle;
                titleSpan.style.display = 'none';
                titleSpan.after(input);
                input.focus();
                input.select();

                const finishEditing = async (save) => {
                    const newTitle = input.value.trim();
                    if (save && newTitle && newTitle !== currentTitle) {
                        try {
                            await postsCollection.doc(item.dataset.id).update({ title: newTitle });
                            titleSpan.textContent = newTitle;
                            showToast('이름이 변경되었습니다.');
                        } catch (error) { console.error('이름 변경 실패:', error); showToast('이름 변경에 실패했습니다.'); }
                    } else {
                        titleSpan.textContent = currentTitle;
                    }
                    input.remove();
                    titleSpan.style.display = 'inline';
                };
                
                input.addEventListener('blur', () => finishEditing(true));
                input.addEventListener('keydown', e => {
                    if (e.key === 'Enter') finishEditing(true);
                    if (e.key === 'Escape') finishEditing(false);
                });
            });
        });
    }

    if (newFolderBtn) {
        newFolderBtn.addEventListener('click', async () => {
            const title = prompt('새 폴더의 이름을 입력하세요.');
            if (title) {
                await addDataToFirestore({ type: 'folder', title: title, content: '' });
                await fetchPosts(auth.currentUser.uid);
                renderList();
            }
        });
    }
    if (newPostBtn) {
        newPostBtn.addEventListener('click', async () => {
            const title = prompt('새 게시글의 제목을 입력하세요.');
            if (title) {
                await addDataToFirestore({ type: 'post', title: title, content: '' });
                await fetchPosts(auth.currentUser.uid);
                renderList();
            }
        });
    }

    // =====================================================
    // SortableJS 관련 함수들
    // =====================================================
    function initializeSortable(targetUl) {
        if (!targetUl) return;
        new Sortable(targetUl, {
            group: 'nested',
            handle: '.drag-handle',
            animation: 150,
            onStart: () => { isDragging = true; }, // ★★★ 드래그 시작 시 깃발 올리기 ★★★
            onAdd: async (evt) => {
                const docId = evt.item.dataset.id;
                const newParentId = evt.to.dataset.parentId || 'root';
                try {
                    await postsCollection.doc(docId).update({ parentId: newParentId });
                    await updateOrder(evt.to);
                    showToast('폴더로 이동했습니다.');
                } catch (error) { console.error("폴더 이동 실패:", error); showToast('이동에 실패했습니다.'); }
                isDragging = false; // ★★★ 이벤트 종료 시 깃발 내리기 ★★★
            },
            onEnd: async (evt) => {
                if (evt.oldIndex !== evt.newIndex) {
                    await updateOrder(evt.from);
                }
                isDragging = false; // ★★★ 이벤트 종료 시 깃발 내리기 ★★★
            }
        });
    }

    async function updateOrder(listElement) {
        const items = listElement.querySelectorAll(':scope > .list-item');
        const batch = db.batch();
        items.forEach((item, index) => {
            const docId = item.dataset.id;
            if (docId) {
                const docRef = postsCollection.doc(docId);
                batch.update(docRef, { order: index });
            }
        });
        try { await batch.commit(); console.log('순서가 성공적으로 저장되었습니다.'); } 
        catch (error) { console.error('순서 저장에 실패했습니다:', error); }
    }
});