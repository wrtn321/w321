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
        } else {
            // 슬래시 제거!
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
            // 슬래시 제거!
            window.location.href = 'main.html';
        }
    }

    // 데이터 가져오기 함수 (userId를 인자로 받음)
    async function fetchPosts(userId) {
        try {
            const snapshot = await postsCollection
                .where('userId', '==', userId)
                .where('category', '==', currentCategory)
                .orderBy('createdAt', 'desc')
                .get();
            posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`'${currentCategory}' 카테고리 데이터 로딩 성공:`, posts);
        } catch (error) {
            console.error("데이터 불러오기 실패:", error);
            if (error.code === 'failed-precondition') {
                console.error("Firestore 복합 색인이 필요할 수 있습니다. 오류 메시지의 링크를 확인하세요.");
            }
        }
    }

    // 데이터 추가하기 함수 (기존과 동일)
    async function addDataToFirestore(data) {
        const user = auth.currentUser;
        if (!user) return;
        try {
            await postsCollection.add({
                ...data,
                category: currentCategory,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                userId: user.uid
            });
        } catch (error) {
            console.error("문서 추가 실패:", error);
        }
    }

    // 화면 렌더링 함수 (기존과 동일)
    function renderList() {
        if (!normalItemList) return;
        normalItemList.innerHTML = '';
        posts.forEach(itemData => normalItemList.append(createListItem(itemData)));
        addClickListenersToListItems();
    }

    // 리스트 아이템 생성 함수 (기존과 동일)
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
                    // 슬래시 제거!
                    window.location.href = 'post.html';
                }
            });
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
});