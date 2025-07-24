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
    async function addDataToFirestore(data, parentId = 'root') { // parentId 인자 추가
    const user = auth.currentUser;
    if (!user) return;

    let newOrder = 0;
    // 같은 부모를 가진 자식들 중에서 가장 큰 order 값을 찾는다.
    const siblings = posts.filter(p => p.parentId === parentId);
    if (siblings.length > 0) {
        const maxOrder = Math.max(...siblings.map(p => p.order || 0));
        newOrder = maxOrder + 1;
    }

    try {
        await postsCollection.add({
            ...data,
            category: currentCategory,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            userId: user.uid,
            order: newOrder,
            parentId: parentId // ★★★ parentId 필드 추가 ★★★
        });
    } catch (error) {
        console.error("문서 추가 실패:", error);
    }
    }

    // 화면 렌더링 함수 (계층 구조 렌더링으로 완전히 변경)
function renderList() {
    if (!normalItemList) return;
    normalItemList.innerHTML = ''; // 목록을 비웁니다.

    // 데이터를 부모-자식 관계의 트리 구조로 재구성합니다.
    const itemsById = {};
    posts.forEach(post => {
        itemsById[post.id] = { ...post, children: [] };
    });

    const tree = [];
    Object.values(itemsById).forEach(item => {
        if (item.parentId && itemsById[item.parentId]) {
            itemsById[item.parentId].children.push(item);
        } else {
            // parentId가 없거나 'root'인 경우 최상위로 간주
            tree.push(item);
        }
    });
    
    // 각 최상위 아이템에 대해 렌더링 함수를 호출합니다.
    tree.sort((a, b) => a.order - b.order).forEach(item => {
        renderItem(item, normalItemList, 0); // 최상위 레벨은 0
    });
    
    addClickListenersToListItems();
    initializeSortable(normalItemList);
}

// 개별 아이템과 그 자식들을 재귀적으로 렌더링하는 함수 (버그 수정 버전)
    function renderItem(itemData, parentElement, level) {
    // 1. li 아이템 생성 (기존과 동일)
    const li = document.createElement('li');
    li.className = 'list-item';
    li.dataset.id = itemData.id;
    li.dataset.level = level;
    
    const icon = itemData.type === 'folder' ? '📁' : '📝';
    li.innerHTML = `<span class="drag-handle">⠿</span><span class="item-icon">${icon}</span><span class="item-title">${itemData.title}</span>`;
    parentElement.appendChild(li);

    // ★★★ 시작: 수정된 폴더 처리 로직 ★★★
    if (itemData.type === 'folder') {
        li.classList.add('item-folder'); // 폴더 클래스 추가

        // 1. 모든 폴더에 대해 자식을 담을 ul을 먼저 생성합니다.
        //    이 ul이 바로 '드롭 존(Drop Zone)' 역할을 합니다.
        const ul = document.createElement('ul');
        ul.className = 'child-list is-collapsed';
        ul.dataset.parentId = itemData.id;
        parentElement.appendChild(ul);
        
        // 2. 이 폴더(ul)를 드롭 가능한 영역으로 만듭니다.
        initializeSortable(ul); 
        
        // 3. 실제로 자식이 있을 때만, 그 자식들을 ul 안에 그려줍니다.
        if (itemData.children.length > 0) {
            itemData.children.sort((a, b) => a.order - b.order).forEach(child => {
                // 재귀 호출: 자식 아이템을 방금 만든 ul 안에 그려달라고 요청
                renderItem(child, ul, level + 1);
            });
        }
    }
    // ★★★ 끝: 수정된 폴더 처리 로직 ★★★
    }


    // 클릭 & 더블클릭 리스너 추가 함수 (이름 수정 기능 추가)
    function addClickListenersToListItems() {
    document.querySelectorAll('.list-container .list-item').forEach(item => {
        // --- 1. 일반 클릭 이벤트 (폴더 열기/파일 열기) ---
        item.addEventListener('click', e => {
            // ... (이 부분은 이전과 동일한 코드입니다)
            if (e.target.classList.contains('drag-handle') || e.target.tagName === 'INPUT') {
                return;
            }
            const itemIsFolder = item.classList.contains('item-folder');
            if (itemIsFolder) {
                const childList = item.nextElementSibling;
                if (childList && childList.tagName === 'UL') {
                    childList.classList.toggle('is-collapsed');
                    item.classList.toggle('is-expanded');
                    const iconElement = item.querySelector('.item-icon');
                    if (item.classList.contains('is-expanded')) {
                        iconElement.textContent = '📂';
                    } else {
                        iconElement.textContent = '📁';
                    }
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

        // --- 2. 더블 클릭 이벤트 (이름 수정) ---
        item.addEventListener('dblclick', e => {
            e.preventDefault(); // 기본 더블클릭 동작(텍스트 선택 등) 방지

            const titleSpan = item.querySelector('.item-title');
            if (!titleSpan || item.querySelector('.title-input')) return; // 이미 수정 중이면 무시

            const currentTitle = titleSpan.textContent;
            
            // 입력 필드 생성
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'title-input'; // 재활용 가능한 클래스명
            input.value = currentTitle;

            // Span을 Input으로 교체
            titleSpan.style.display = 'none';
            titleSpan.after(input);
            input.focus();
            input.select();

            // 수정 완료 또는 취소 함수
            const finishEditing = async (save) => {
                const newTitle = input.value.trim();

                if (save && newTitle && newTitle !== currentTitle) {
                    // 저장 로직
                    try {
                        const docId = item.dataset.id;
                        await postsCollection.doc(docId).update({ title: newTitle });
                        titleSpan.textContent = newTitle; // 화면에도 반영
                        showToast('이름이 변경되었습니다.');
                    } catch (error) {
                        console.error('이름 변경 실패:', error);
                        showToast('이름 변경에 실패했습니다.');
                    }
                } else {
                    // 취소 또는 변경사항 없음
                    titleSpan.textContent = currentTitle;
                }

                // Input을 다시 Span으로 되돌림
                input.remove();
                titleSpan.style.display = 'inline';
            };
            
            // 이벤트 리스너: 포커스를 잃거나(blur) Enter를 누르면 저장
            input.addEventListener('blur', () => finishEditing(true));
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finishEditing(true);
                if (e.key === 'Escape') finishEditing(false);
            });
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

    // =====================================================
// SortableJS 초기화 함수 (계층 구조 지원 버전)
// =====================================================
    function initializeSortable(targetUl) {
        if (!targetUl) return;

        new Sortable(targetUl, {
            group: 'nested', // ★★★ 모든 리스트를 'nested'라는 동일한 그룹으로 묶음 ★★★
            handle: '.drag-handle',
            animation: 150,

            // 이벤트 1: 다른 리스트에서 이 리스트로 아이템이 들어왔을 때
            onAdd: async (evt) => {
                const itemEl = evt.item; // 드래그된 아이템
                const newParentId = evt.to.dataset.parentId || 'root'; // 새 부모 폴더 ID
                const docId = itemEl.dataset.id; // 아이템의 DB ID

                console.log(`아이템 '${docId}'가 폴더 '${newParentId}'로 이동했습니다.`);

                try {
                    // DB 업데이트: 아이템의 parentId를 새 부모의 ID로 변경
                    await postsCollection.doc(docId).update({ parentId: newParentId });
                    
                    // 순서도 함께 업데이트 해주는 것이 좋습니다.
                    await updateOrder(evt.to); // 아래에서 만들 함수
                    showToast('폴더로 이동했습니다.');

                } catch (error) {
                    console.error("폴더 이동 실패:", error);
                    showToast('이동에 실패했습니다.');
                }
            },

            // 이벤트 2: 같은 리스트 안에서 순서만 바뀌었을 때
            onEnd: async (evt) => {
                // 순서가 실제로 변경되었을 때만 실행
                if (evt.oldIndex !== evt.newIndex) {
                    console.log('같은 폴더 내에서 순서가 변경되었습니다.');
                    await updateOrder(evt.from); // 아래에서 만들 함수
                }
            }
        });
    }

    // 특정 리스트의 모든 아이템 순서를 DB에 업데이트하는 함수
    async function updateOrder(listElement) {
        const items = listElement.querySelectorAll('.list-item');
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
        } catch (error) {
            console.error('순서 저장에 실패했습니다:', error);
        }
    }
});