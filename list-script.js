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
    const normalItemList = document.querySelector('.normal-list .item-list');

    // =====================================================
    // 모든 로직의 시작점: 로그인 상태가 확인된 후에 실행!
    // =====================================================
    auth.onAuthStateChanged(async user => {
        if (user) {
            initializePage();
            await fetchPosts(user.uid);
            renderList();
            initializeSortable(); // 목록이 그려진 후 드래그 기능 활성화
        } else {
            window.location.href = 'index.html';
        }
    });

    // 로그아웃 버튼 기능
    const logoutButton = document.querySelector('.logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', e => {
            e.preventDefault();
            auth.signOut().catch(error => console.error('로그아웃 에러:', error));
        });
    }

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

    // 데이터 가져오기 함수 (order 기준 정렬)
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

    // 데이터 추가하기 함수 (order 값 포함)
    async function addDataToFirestore(data) {
    const user = auth.currentUser;
    if (!user) return;

    // ★★★ 시작: 새로운 order 값을 계산하는 로직 ★★★
    let newOrder = 0; // 기본값은 0
    if (posts.length > 0) {
        // posts 배열에 있는 모든 order 값들 중에서 가장 큰 값을 찾는다.
        const maxOrder = Math.max(...posts.map(p => p.order || 0));
        newOrder = maxOrder + 1;
    }
    // ★★★ 끝: 새로운 order 값을 계산하는 로직 ★★★

    try {
        await postsCollection.add({
            ...data,
            category: currentCategory,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            userId: user.uid,
            order: newOrder // ★★★ 계산된 newOrder 값을 사용 ★★★
        });
    } catch (error) {
        console.error("문서 추가 실패:", error);
    }
    }

    // 화면 렌더링 함수
    function renderList() {
        if (!normalItemList) return;
        normalItemList.innerHTML = '';
        posts.forEach(itemData => normalItemList.append(createListItem(itemData)));
        addClickListenersToListItems();
    }

    // 리스트 아이템 생성 함수
    function createListItem(itemData) {
        const li = document.createElement('li');
        li.classList.add('list-item');
        li.dataset.id = itemData.id;
        const icon = itemData.type === 'folder' ? '📁' : '📝';
        if (itemData.type === 'folder') li.classList.add('item-folder');
        li.innerHTML = `<span class="drag-handle">⠿</span><span class="item-icon">${icon}</span><span class="item-title">${itemData.title}</span>`;
        return li;
    }

    // 클릭 리스너 추가 함수
    function addClickListenersToListItems() {
        document.querySelectorAll('.list-container .list-item').forEach(item => {
            item.addEventListener('click', e => {
                if (e.target.classList.contains('drag-handle')) return;
                const post = posts.find(p => p.id === item.dataset.id);
                if (post) {
                    localStorage.setItem('currentPost', JSON.stringify(post));
                    localStorage.setItem('currentCategory', currentCategory);
                    window.location.href = 'post.html';
                }
            });
        });
    }

    // 새 폴더 만들기 버튼
    const newFolderBtn = document.querySelector('.new-folder-btn');
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

    // 새 글 만들기 버튼 이벤트
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

    // ★★★ 이 함수 전체를 DOMContentLoaded 안으로 옮겼습니다! ★★★
    // =====================================================
    // SortableJS 초기화 및 순서 저장 함수
    // =====================================================
    function initializeSortable() {
        if (!normalItemList) return;

        new Sortable(normalItemList, {
            handle: '.drag-handle',
            animation: 150,

            onEnd: async (evt) => {
                console.log('드래그가 끝났습니다. 순서를 저장합니다.');
                const items = normalItemList.querySelectorAll('.list-item');
                const batch = db.batch();

                items.forEach((item, index) => {
                    const docId = item.dataset.id;
                    if (docId) {
                        const docRef = postsCollection.doc(docId);
                        batch.update(docRef, { order: index });
                    }
                });

                try {
                    await batch.commit();
                    console.log('순서가 성공적으로 저장되었습니다.');
                    // 로컬 데이터와 화면의 순서는 이미 드래그로 변경되었으므로
                    // 여기서는 Firestore에 바뀐 순서만 저장해주는 역할에 집중합니다.
                    // 만약을 위해 fetchPosts를 다시 호출해 서버와 데이터를 동기화할 수 있습니다.
                    await fetchPosts(auth.currentUser.uid);
                } catch (error) {
                    console.error('순서 저장에 실패했습니다:', error);
                }
            }
        });
    }
});