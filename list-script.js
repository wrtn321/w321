// list-script.js (Firestore 최종 정리 버전)

document.addEventListener('DOMContentLoaded', async () => {

    // =====================================================
    // 1. Firebase Firestore DB 참조 및 전역 변수
    // =====================================================
    const db = firebase.firestore();
    const postsCollection = db.collection('posts');
    let posts = []; // 데이터를 담을 배열

    // =====================================================
    // 2. 필요한 HTML 요소 찾아놓기
    // =====================================================
    const newPostBtn = document.querySelector('.new-post-btn');
    const newFolderBtn = document.querySelector('.new-folder-btn');
    const pinnedItemList = document.querySelector('.pinned-list .item-list');
    const normalItemList = document.querySelector('.normal-list .item-list');

    // =====================================================
    // 3. 데이터 조작 함수 (Firestore와 통신)
    // =====================================================

    // Firestore에서 모든 데이터를 불러와서 posts 배열에 채우는 함수
    async function fetchPosts() {
        try {
            const snapshot = await postsCollection.orderBy('createdAt', 'desc').get(); // 최신순으로 정렬해서 가져오기
            posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log('Firebase에서 데이터를 성공적으로 불러왔습니다:', posts);
        } catch (error) {
            console.error("데이터 불러오기 실패:", error);
        }
    }

    // 새로운 데이터를 Firestore에 추가하는 함수
    async function addDataToFirestore(data) {
        try {
            // Firestore에 데이터를 추가하고, 생성된 시간(timestamp)도 함께 기록
            const docRef = await postsCollection.add({
                ...data,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("새 문서가 추가되었습니다. ID:", docRef.id);
        } catch (error) {
            console.error("문서 추가 실패:", error);
        }
    }
    
    // 순서 변경 사항을 Firestore에 저장하는 함수 (나중에 구현)
    async function updateOrderInFirestore() {
        // 이 부분은 조금 복잡해서 다음 단계에서 진행합니다.
        console.log("순서 변경사항을 저장해야 합니다:", posts.map(p => p.title));
    }


    // =====================================================
    // 4. 화면 렌더링 및 UI 관련 함수
    // =====================================================

    // 데이터를 기반으로 화면에 목록을 그리는 함수
    function renderList() {
        if (!normalItemList) return;
        normalItemList.innerHTML = '';
        posts.forEach(itemData => {
            const listItemElement = createListItem(itemData);
            normalItemList.append(listItemElement);
        });
        addClickListenersToListItems();
    }

    // 새로운 li 요소를 생성하는 공장 함수
    function createListItem(itemData) {
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

    // 목록 아이템에 클릭 이벤트를 추가하는 함수
    function addClickListenersToListItems() {
        const listItems = document.querySelectorAll('.list-container .list-item');
        listItems.forEach(item => {
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);

            newItem.addEventListener('click', () => {
                if (newItem.classList.contains('item-folder')) {
                    alert('폴더 열기 기능은 준비 중입니다!');
                    return;
                }
                const itemId = newItem.dataset.id;
                const postData = posts.find(post => post.id === itemId);
                if (postData) {
                    localStorage.setItem('currentPost', JSON.stringify(postData));
                    window.location.href = 'post.html';
                }
            });
        });
    }

    // =====================================================
    // 5. 기능 실행 및 이벤트 리스너 연결
    // =====================================================

    // 새 글 만들기
    if (newPostBtn) {
        newPostBtn.addEventListener('click', async () => {
            const title = prompt('새 게시글의 제목을 입력하세요.');
            if (title) {
                const newPostData = {
                    type: 'post',
                    title: title,
                    content: ''
                };
                await addDataToFirestore(newPostData); // Firestore에 데이터 추가
                await fetchPosts(); // DB에서 최신 데이터 다시 불러오기
                renderList(); // 화면 다시 그리기
            }
        });
    }

    // 새 폴더 만들기
    if (newFolderBtn) {
        newFolderBtn.addEventListener('click', async () => {
            const title = prompt('새 폴더의 이름을 입력하세요.');
            if (title) {
                const newFolderData = {
                    type: 'folder',
                    title: title
                };
                await addDataToFirestore(newFolderData);
                await fetchPosts();
                renderList();
            }
        });
    }

    // SortableJS 기능 활성화
    if (normalItemList) {
        new Sortable(normalItemList, {
            handle: '.drag-handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: async function (evt) {
                const newOrderIds = Array.from(evt.to.children).map(li => li.dataset.id);
                posts.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
                // 지금은 순서 변경을 Firestore에 저장하지는 않습니다.
                // 이 기능은 다음 단계에서 구현합니다!
                await updateOrderInFirestore();
            }
        });
    }

    // =====================================================
    // 6. 최초 실행
    // =====================================================
    await fetchPosts();
    renderList();

});