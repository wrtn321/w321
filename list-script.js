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

    auth.onAuthStateChanged(async user => {
        if (user) {
            initializePage();
            await fetchPosts(user.uid);
            renderList();
        } else { window.location.href = 'index.html'; }
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
            const snapshot = await postsCollection.where('userId', '==', userId).where('category', '==', currentCategory).get();
            posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`'${currentCategory}' 카테고리 데이터 로딩 성공:`, posts);
        } catch (error) {
            console.error("데이터 불러오기 실패:", error);
            if (error.code === 'failed-precondition') { alert("Firestore 색인이 필요합니다. 개발자 콘솔(F12)의 에러 메시지에 있는 링크를 클릭하여 색인을 생성해주세요."); }
        }
    }

    async function addDataToFirestore(data, parentId = 'root') {
        const user = auth.currentUser;
        if (!user) return;
        const siblings = posts.filter(p => p.parentId === parentId);
        const newOrder = siblings.length > 0 ? Math.max(...siblings.map(p => p.order || 0)) + 1 : 0;
        try {
            await postsCollection.add({ ...data, category: currentCategory, createdAt: firebase.firestore.FieldValue.serverTimestamp(), userId: user.uid, order: newOrder, parentId: parentId });
        } catch (error) { console.error("문서 추가 실패:", error); }
    }

    function renderList() {
        if (!normalItemList) return;
        normalItemList.innerHTML = '';
        const itemsById = {};
        posts.forEach(post => { itemsById[post.id] = { ...post, children: [] }; });
        const tree = [];
        Object.values(itemsById).forEach(item => {
            const parent = itemsById[item.parentId];
            if (item.parentId !== 'root' && parent) {
                parent.children.push(item);
            } else {
                tree.push(item);
            }
        });
        tree.sort((a, b) => a.order - b.order).forEach(item => renderItem(item, normalItemList, 0));
        addClickListenersToListItems();
        initializeSortable(normalItemList);
    }

    // ★★★ 시작: renderItem 함수가 완전히 새로워졌습니다. ★★★
    function renderItem(itemData, parentElement, level) {
        const li = document.createElement('li');
        li.className = 'list-item';
        li.dataset.id = itemData.id;

        const wrapper = document.createElement('div');
        wrapper.className = 'item-content-wrapper';

        const iconType = itemData.type === 'folder' ? '📁' : '📝';
        wrapper.innerHTML = `<span class="drag-handle">⠿</span><span class="item-icon">${iconType}</span><span class="item-title">${itemData.title}</span>`;
        li.appendChild(wrapper);
        parentElement.appendChild(li);

        if (itemData.type === 'folder') {
            li.classList.add('item-folder');
            const childUl = document.createElement('ul');
            childUl.className = 'child-list is-collapsed';
            childUl.dataset.parentId = itemData.id;
            li.appendChild(childUl); // ★★★ 이제 ul은 li의 자식입니다. ★★★

            initializeSortable(childUl);

            if (itemData.children.length > 0) {
                itemData.children.sort((a, b) => a.order - b.order).forEach(child => {
                    renderItem(child, childUl, level + 1);
                });
            }
        }
    }
    // ★★★ 끝: renderItem 함수 ★★★


    function addClickListenersToListItems() {
        document.querySelectorAll('.list-container .item-content-wrapper').forEach(wrapper => {
            // ★★★ 클릭 이벤트 대상을 li가 아닌 wrapper로 변경 ★★★
            wrapper.addEventListener('click', e => {
                const li = wrapper.closest('.list-item');
                if (!li || e.target.classList.contains('drag-handle') || e.target.tagName === 'INPUT') return;

                if (li.classList.contains('item-folder')) {
                    const childList = li.querySelector('.child-list'); // ★★★ 이제 자식 ul을 querySelector로 찾습니다. ★★★
                    if (childList) {
                        childList.classList.toggle('is-collapsed');
                        li.classList.toggle('is-expanded');
                        const iconElement = wrapper.querySelector('.item-icon');
                        iconElement.textContent = li.classList.contains('is-expanded') ? '📂' : '📁';
                    }
                } else {
                    const post = posts.find(p => p.id === li.dataset.id);
                    if (post) {
                        localStorage.setItem('currentPost', JSON.stringify(post));
                        localStorage.setItem('currentCategory', currentCategory);
                        window.location.href = 'post.html';
                    }
                }
            });

            wrapper.addEventListener('dblclick', e => {
                e.preventDefault();
                const li = wrapper.closest('.list-item');
                const titleSpan = wrapper.querySelector('.item-title');
                if (!titleSpan || wrapper.querySelector('.title-input')) return;
                
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
                            await postsCollection.doc(li.dataset.id).update({ title: newTitle });
                            titleSpan.textContent = newTitle;
                            showToast('이름이 변경되었습니다.');
                        } catch (error) { console.error('이름 변경 실패:', error); showToast('이름 변경에 실패했습니다.'); }
                    } else { titleSpan.textContent = currentTitle; }
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
            const title = prompt('새 게시글의 이름을 입력하세요.');
            if (title) {
                await addDataToFirestore({ type: 'post', title: title, content: '' });
                await fetchPosts(auth.currentUser.uid);
                renderList();
            }
        });
    }

    function initializeSortable(targetUl) {
        if (!targetUl) return;
        new Sortable(targetUl, {
            group: 'nested',
            handle: '.drag-handle',
            animation: 150,
            onAdd: async (evt) => {
                const docId = evt.item.dataset.id;
                const newParentId = evt.to.dataset.parentId || 'root';
                try {
                    await postsCollection.doc(docId).update({ parentId: newParentId });
                    await updateOrder(evt.to);
                    showToast('폴더로 이동했습니다.');
                } catch (error) { console.error("폴더 이동 실패:", error); showToast('이동에 실패했습니다.'); }
            },
            onEnd: async (evt) => {
                if (evt.oldIndex !== evt.newIndex) {
                    await updateOrder(evt.from);
                }
            }
        });
    }

    async function updateOrder(listElement) {
        // ★★★ 이제 li는 ul의 직접적인 자식입니다. ★★★
        const items = listElement.children;
        const batch = db.batch();
        // HTMLCollection을 배열로 변환하여 forEach 사용
        Array.from(items).forEach((item, index) => {
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