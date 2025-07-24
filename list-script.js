document.addEventListener('DOMContentLoaded', async () => {


    const auth = firebase.auth();

    // 로그아웃 버튼 기능
    const logoutButton = document.querySelector('.logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            auth.signOut().catch(error => console.error('로그아웃 에러:', error));
        });
    }

    auth.onAuthStateChanged(user => {
        if (!user) {
            console.log('권한 없음. 로그인 페이지로 이동합니다.');
            window.location.href = '/index.html';
        }
    });

    // =====================================================
    // 1. 전역 변수 및 설정
    // =====================================================
    const db = firebase.firestore();
    const postsCollection = db.collection('posts');
    let currentCategory = ''; // 현재 어떤 카테고리 페이지인지 저장
    let posts = []; // 데이터를 담을 배열

    // 카테고리 영어 이름과 한글 이름을 연결
    const categoryNames = {
        prompt: '프롬프트',
        chat: '채팅백업',
        novel: '소설'
    };

    // =====================================================
    // 2. 필요한 HTML 요소 찾아놓기
    // =====================================================
    const listTitle = document.getElementById('list-title');
    const newPostBtn = document.querySelector('.new-post-btn');
    // ... (다른 요소들은 필요시 추가) ...
    const normalItemList = document.querySelector('.normal-list .item-list');

    // =====================================================
    // 3. 페이지 초기화 함수
    // =====================================================
    function initializePage() {
        // 1. 주소창의 URL에서 'category' 꼬리표(파라미터) 값을 읽어온다.
        const params = new URLSearchParams(window.location.search);
        const categoryParam = params.get('category');

        // 2. 유효한 카테고리가 있으면 설정, 없으면 메인으로 돌려보낸다.
        if (categoryParam && categoryNames[categoryParam]) {
            currentCategory = categoryParam;
            // 페이지 제목을 카테고리에 맞게 변경
            listTitle.textContent = categoryNames[currentCategory];
        } else {
            alert('잘못된 접근입니다.');
            window.location.href = 'main.html';
        }
    }

    // =====================================================
    // 4. 데이터 조작 함수 (Firestore와 통신)
    // =====================================================

    // Firestore에서 '현재 카테고리'에 맞는 데이터만 불러오는 함수
    async function fetchPosts() {
    const user = firebase.auth().currentUser;

    if (!user) {
        console.log('로그인되어 있지 않아 데이터를 불러올 수 없습니다.');
        posts = []; // 데이터 배열을 비웁니다.
        renderList(); // 화면을 비웁니다.
        return;
    }

    try {
        const snapshot = await postsCollection
            .where('userId', '==', user.uid) // 👈 [핵심!] 내 userId와 일치하는 글만
            .where('category', '==', currentCategory)
            .orderBy('createdAt', 'desc')
            .get();
            
        posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`'${currentCategory}' 카테고리 데이터 로딩 성공:`, posts);
    } catch (error) {
        console.error("데이터 불러오기 실패:", error);
    }
    }

    // 새로운 데이터를 Firestore에 추가하는 함수 (category 필드 추가!)
    async function addDataToFirestore(data) {
    const user = firebase.auth().currentUser; // 현재 로그인한 사용자 정보 가져오기

    if (!user) {
        console.error('사용자가 로그인되어 있지 않아 글을 저장할 수 없습니다.');
        return; // 사용자가 없으면 함수 종료
    }

    try {
        const docRef = await postsCollection.add({
            ...data,
            category: currentCategory,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            userId: user.uid // 👈 [핵심!] 사용자의 고유 ID를 함께 저장
        });
        console.log("새 문서가 추가되었습니다. ID:", docRef.id);
    } catch (error) {
        console.error("문서 추가 실패:", error);
    }
    }
    
    // =====================================================
    // 5. 화면 렌더링 및 UI 관련 함수 (기존과 거의 동일)
    // =====================================================
    function renderList() {
        if (!normalItemList) return;
        normalItemList.innerHTML = ''; // 목록 비우기
        posts.forEach(itemData => {
            const listItemElement = createListItem(itemData);
            normalItemList.append(listItemElement);
        });
        addClickListenersToListItems();
    }

    function createListItem(itemData) {
        // ... (이 함수는 기존과 완전히 동일) ...
        const li = document.createElement('li');
        li.classList.add('list-item');
        li.dataset.id = itemData.id;
        const icon = itemData.type === 'folder' ? '📁' : '📝';
        if (itemData.type === 'folder') {
            li.classList.add('item-folder');
        }
        li.innerHTML = `
            <span class="drag-handle">⠿</span>
            <span class="item-icon">${icon}</span>
            <span class="item-title">${itemData.title}</span>
        `;
        return li;
    }

    function addClickListenersToListItems() {
        // ... (이 함수는 기존과 거의 동일) ...
        document.querySelectorAll('.list-container .list-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // 핸들을 클릭한게 아니면 페이지 이동
                if (!e.target.classList.contains('drag-handle')) {
                    const itemId = item.dataset.id;
                    const postData = posts.find(post => post.id === itemId);
                    if (postData) {
                        localStorage.setItem('currentPost', JSON.stringify(postData));
                        localStorage.setItem('currentCategory', currentCategory);
                        window.location.href = 'post.html';
                    }
                }
            });
        });
    }

    // =====================================================
    // 6. 이벤트 리스너 연결
    // =====================================================

    // 새 글 만들기 버튼
    if (newPostBtn) {
        newPostBtn.addEventListener('click', async () => {
            const title = prompt('새 게시글의 제목을 입력하세요.');
            if (title) {
                const newPostData = { type: 'post', title: title, content: '' };
                await addDataToFirestore(newPostData);
                await fetchPosts();
                renderList();
            }
        });
    }

    // (폴더 만들기 기능 등 다른 리스너는 여기에 추가)

    // =====================================================
    // 7. 최초 실행
    // =====================================================
    initializePage();   // 페이지 정보 설정 먼저!
    await fetchPosts(); // 그 다음 데이터 불러오기
    renderList();       // 마지막으로 화면에 그리기
});