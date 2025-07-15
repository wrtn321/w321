// list-script.js (진짜진짜 최종 완성본!!!)

document.addEventListener('DOMContentLoaded', () => {

    // 1. 필요한 HTML 요소 찾아놓기
    const newPostBtn = document.querySelector('.new-post-btn');
    const newFolderBtn = document.querySelector('.new-folder-btn');
    const pinnedItemList = document.querySelector('.pinned-list .item-list');
    const normalItemList = document.querySelector('.normal-list .item-list');

    // 2. 데이터 관리
    let posts;

    function loadPosts() {
        const postsDataString = localStorage.getItem('myPosts');
        if (postsDataString) {
            posts = JSON.parse(postsDataString);
        } else {
            posts = [
                { id: 'post-a1b2', type: 'post', title: '첫 번째 게시글', content: '첫 번째 게시글의 본문 내용입니다.' },
                { id: 'folder-c3d4', type: 'folder', title: '중요한 폴더' },
                { id: 'post-e5f6', type: 'post', title: '두 번째 게시글', content: '두 번째 글은 내용이 좀 더 깁니다. 안녕하세요.' },
            ];
            savePosts(); // 최초 실행 시 초기 데이터를 저장
        }
    }

    function savePosts() {
        localStorage.setItem('myPosts', JSON.stringify(posts));
    }

    // 3. 화면 렌더링 및 이벤트 관련 함수
    function renderList() {
        if (!normalItemList) return;
        normalItemList.innerHTML = '';
        posts.forEach(itemData => {
            const listItemElement = createListItem(itemData);
            normalItemList.append(listItemElement);
        });
        addClickListenersToListItems();
    }

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

    function addClickListenersToListItems() {
    const listItems = document.querySelectorAll('.list-container .list-item');

    listItems.forEach(item => {
        // --- ▼▼▼ 핵심 수정 부분 ▼▼▼ ---
        // 1. 기존의 item을 복제해서 깨끗한 새 item을 만듭니다.
        //    이렇게 하면 기존에 달려있던 모든 이벤트 리스너가 사라집니다.
        const newItem = item.cloneNode(true);
        
        // 2. 원래 있던 item을 깨끗한 새 item으로 교체합니다.
        item.parentNode.replaceChild(newItem, item);
        // --- ▲▲▲ 여기까지 ▲▲▲ ---


        // 3. 이제 '깨끗한' newItem에 클릭 이벤트를 딱 한 번만 추가합니다.
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
            } else {
                // 이 메시지가 이제는 절대 뜨면 안 됩니다.
                console.error('클릭된 아이템의 데이터를 찾을 수 없습니다. ID:', itemId);
            }
        });
    });
}

    // 4. 기능 실행 및 이벤트 리스너 연결
    if (newPostBtn) {
        newPostBtn.addEventListener('click', () => {
            const title = prompt('새 게시글의 제목을 입력하세요.');
            if (title) {
                const newPost = {
                    id: 'post-' + new Date().getTime(),
                    type: 'post', title: title, content: ''
                };
                posts.unshift(newPost);
                savePosts();
                renderList();
            }
        });
    }

    if (newFolderBtn) {
        newFolderBtn.addEventListener('click', () => {
            const title = prompt('새 폴더의 이름을 입력하세요.');
            if (title) {
                const newFolder = {
                    id: 'folder-' + new Date().getTime(), type: 'folder', title: title
                };
                posts.unshift(newFolder);
                savePosts();
                renderList();
            }
        });
    }

    if (normalItemList) {
        new Sortable(normalItemList, {
            handle: '.drag-handle', animation: 150, ghostClass: 'sortable-ghost',
            onEnd: function (evt) {
                const newOrderIds = Array.from(evt.to.children).map(li => li.dataset.id);
                posts.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id));
                savePosts();
                // 순서 변경 후에는 렌더링을 다시 할 필요는 없지만,
                // 만약의 사태를 대비해 클릭 리스너는 한번 더 붙여주는 것이 안전할 수 있습니다.
                addClickListenersToListItems();
            }
        });
    }
    
    // 5. 최초 실행
    loadPosts();
    renderList();
});