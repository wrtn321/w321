document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // 전역 변수 및 요소
    const postsCollection = db.collection('posts');
    let currentCategory = '';
    let posts = []; // 모든 게시물을 여기에 평평하게 저장합니다.
    const categoryNames = { prompt: '프롬프트', chat: '채팅백업', novel: '소설' };

    // DOM 요소
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

    // 로그아웃 버튼 기능
    const logoutButton = document.querySelector('.logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', e => {
            e.preventDefault();
            auth.signOut().then(() => {
                window.location.href = 'index.html';
            }).catch(error => {
                console.error('로그아웃 에러:', error);
                alert('로그아웃 중 문제가 발생했습니다.');
            });
        });
    }

    // 인증 상태 확인 및 페이지 초기화
    auth.onAuthStateChanged(async user => {
        if (user) {
            initializePage();
            await fetchPosts(user.uid);
            renderList();
        } else {
            window.location.href = 'index.html';
        }
    });

    // 페이지 카테고리 설정
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

    // Firestore에서 데이터 불러오기
    async function fetchPosts(userId) {
        try {
            const snapshot = await postsCollection
                .where('userId', '==', userId)
                .where('category', '==', currentCategory)
                .orderBy('order') // 순서대로 정렬해서 가져옵니다.
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

    // 새 항목(폴더/파일) Firestore에 추가
    async function addDataToFirestore(data) {
        const user = auth.currentUser;
        if (!user) return;

        // 새 항목은 항상 목록의 맨 뒤에 추가됩니다.
        const newOrder = posts.length > 0 ? Math.max(...posts.map(p => p.order || 0)) + 1 : 0;

        try {
            await postsCollection.add({
                ...data,
                category: currentCategory,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                userId: user.uid,
                order: newOrder,
                parentId: 'root' // 모든 항목은 이제 'root'를 부모로 가집니다.
            });
        } catch (error) {
            console.error("문서 추가 실패:", error);
        }
    }

    // 화면에 목록 그리기 (매우 단순화됨)
    function renderList() {
        if (!normalItemList) return;
        normalItemList.innerHTML = ''; // 목록 비우기

        // 모든 게시물을 순서대로 하나씩 그립니다.
        posts.forEach(item => {
            renderItem(item, normalItemList);
        });

        addClickListenersToListItems();
        initializeSortable(normalItemList); // 단일 리스트에 Sortable 적용
    }

    // 개별 항목 그리기 (매우 단순화됨)
    function renderItem(itemData, parentElement) {
        const li = document.createElement('li');
        li.className = 'list-item';
        li.dataset.id = itemData.id;
        if (itemData.type === 'folder') {
            li.classList.add('item-folder');
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'item-content-wrapper';

        const iconType = itemData.type === 'folder' ? '📁' : '📝';
        wrapper.innerHTML = `<span class="drag-handle">⠿</span><span class="item-icon">${iconType}</span><span class="item-title">${itemData.title}</span>`;

        li.appendChild(wrapper);
        parentElement.appendChild(li);
    }

    // 클릭 이벤트 리스너 추가 (매우 단순화됨)
    function addClickListenersToListItems() {
        document.querySelectorAll('.list-container .item-content-wrapper').forEach(wrapper => {
            wrapper.addEventListener('click', e => {
                const li = wrapper.closest('.list-item');
                if (!li) return;

                // 폴더가 아닌 'post' 타입일 때만 post.html로 이동합니다.
                if (!li.classList.contains('item-folder')) {
                    const post = posts.find(p => p.id === li.dataset.id);
                    if (post) {
                        localStorage.setItem('currentPost', JSON.stringify(post));
                        localStorage.setItem('currentCategory', currentCategory);
                        window.location.href = 'post.html';
                    }
                }
                // 폴더를 클릭했을 때는 아무 일도 일어나지 않습니다.
            });

            // 이름 변경을 위한 더블클릭 이벤트는 그대로 유지합니다.
            wrapper.addEventListener('dblclick', e => {
                e.preventDefault();
                // (기존 이름 변경 로직과 동일하므로 생략)
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

    // 새 폴더/파일 버튼 이벤트
    if (newFolderBtn) {
        newFolderBtn.addEventListener('click', async () => {
            const title = prompt('새 폴더의 이름을 입력하세요.');
            if (title) {
                await addDataToFirestore({ type: 'folder', title: title, content: '' });
                await fetchPosts(auth.currentUser.uid); // 데이터 다시 로드
                renderList(); // 화면 새로고침
            }
        });
    }
    if (newPostBtn) {
        newPostBtn.addEventListener('click', async () => {
            const title = prompt('새 게시글의 이름을 입력하세요.');
            if (title) {
                await addDataToFirestore({ type: 'post', title: title, content: '' });
                await fetchPosts(auth.currentUser.uid); // 데이터 다시 로드
                renderList(); // 화면 새로고침
            }
        });
    }

    // SortableJS 초기화 (매우 단순화됨)
    function initializeSortable(targetUl) {
        if (!targetUl) return;
        new Sortable(targetUl, {
            handle: '.drag-handle',
            animation: 150,
            // 같은 리스트 내에서 순서가 바뀔 때만 작동합니다.
            onEnd: async (evt) => {
                if (evt.oldIndex !== evt.newIndex) {
                    await updateOrder(evt.from);
                }
            }
        });
    }

    // 순서 업데이트 로직
    async function updateOrder(listElement) {
        const items = listElement.children;
        const batch = db.batch();
        Array.from(items).forEach((item, index) => {
            const docId = item.dataset.id;
            if (docId) {
                const docRef = postsCollection.doc(docId);
                batch.update(docRef, { order: index });
            }
        });
        try {
            await batch.commit();
            // 순서 변경 후 posts 배열도 업데이트
            await fetchPosts(auth.currentUser.uid);
            console.log('순서가 성공적으로 저장되었습니다.');
        } catch (error) {
            console.error('순서 저장에 실패했습니다:', error);
        }
    }
});