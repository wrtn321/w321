// js/chat-list-script.js (채팅 목록 전용 스크립트)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const postsCollection = db.collection('posts');
    const currentCategory = 'chat'; // 이 스크립트는 항상 'chat' 카테고리만 다룹니다.
    let posts = [];

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

    // Firebase 인증 상태 변화 감지
    auth.onAuthStateChanged(async user => {
        if (user) {
            initializePage(); // 페이지 초기 설정
            await fetchPosts(user.uid); // 데이터 불러오기
            renderList(); // 화면에 목록 그리기
            addEventListeners(user); // 이벤트 리스너 연결
        } else {
            window.location.href = 'index.html';
        }
    });

    // 페이지 제목 설정
    function initializePage() {
        listTitle.textContent = '채팅백업'; // 제목을 '채팅백업'으로 고정
    }

    // Firestore에서 'chat' 카테고리 데이터만 불러오기
    async function fetchPosts(userId) {
        try {
            const snapshot = await postsCollection
                .where('userId', '==', userId)
                .where('category', '==', currentCategory) // 항상 'chat' 카테고리만 조회
                .get();
            posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("데이터 불러오기 실패:", error);
            if (error.code === 'failed-precondition') {
                alert("Firestore 색인이 필요합니다. 개발자 콘솔(F12)의 에러 메시지에 있는 링크를 클릭하여 색인을 생성해주세요.");
            }
        }
    }

    // 이벤트 리스너들을 연결하는 함수
    function addEventListeners(user) {
        logoutButton.addEventListener('click', e => {
            e.preventDefault();
            auth.signOut().then(() => window.location.href = 'index.html');
        });

        // 새 폴더 만들기 버튼
        newFolderBtn.addEventListener('click', () => handleNewFolder(user.uid));
    
        // '+ JSON 추가' 버튼
        newPostBtn.addEventListener('click', handleJsonUpload);
        
        // 목록 아이템 클릭 이벤트
        normalItemList.addEventListener('click', e => {
            const wrapper = e.target.closest('.item-content-wrapper');
            if (!wrapper) return;
            const li = wrapper.closest('.list-item');
            if (!li) return;

            if (e.target.classList.contains('delete-folder-btn')) {
                e.stopPropagation();
                if (confirm('폴더를 삭제하시겠습니까?\n(안에 있는 파일은 밖으로 이동됩니다)')) {
                    deleteFolder(user.uid, li.dataset.id);
                }
                return;
            }

            if (e.target.classList.contains('edit-folder-btn')) {
                e.stopPropagation();
                editFolderName(user.uid, li.dataset.id);
                return;
            }

            if (li.classList.contains('item-folder')) {
                handleFolderClick(li);
            } else {
                handleFileClick(li); // 파일(채팅) 클릭 처리
            }
        });
    }

    // ★★★ 핵심 변경점 1 ★★★
    // 파일을 클릭하면 항상 chat-viewer.html 로 이동합니다.
    function handleFileClick(liElement) {
        const post = posts.find(p => p.id === liElement.dataset.id);
        if (post) {
            localStorage.setItem('currentPost', JSON.stringify(post));
            localStorage.setItem('currentCategory', currentCategory); // 'chat' 카테고리 정보 저장
            
            // 일반 post.html이 아닌, 채팅 전용 뷰어인 chat-viewer.html로 이동
            window.location.href = 'chat-viewer.html';
        }
    }
    
    // ★★★ 핵심 변경점 2 ★★★
    // JSON 파일 업로드 기능만 남겨서 코드를 단순화했습니다.
    function handleJsonUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';

        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const fileContent = event.target.result;
                const title = file.name.replace(/\.json$/, ''); 
                createPostFromJson(title, fileContent);
            };
            reader.onerror = () => showToast('파일을 읽는 데 실패했습니다.');
            reader.readAsText(file);
        };
        input.click();
    }

    async function createPostFromJson(title, content) {
        const user = auth.currentUser;
        if (!user) return;

        try {
            JSON.parse(content);
        } catch (error) {
            alert('올바른 JSON 파일이 아닙니다. 파일 내용을 확인해주세요.');
            return;
        }

        try {
            await postsCollection.add({
                type: 'post', // 타입은 동일하게 'post'로 유지
                title: title,
                content: content,
                category: currentCategory,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                userId: user.uid,
                order: Date.now(), // 순서 정렬을 위해 현재 시간 사용
                parentId: 'root'
            });

            showToast(`'${title}' 파일이 추가되었습니다.`);
            await fetchPosts(user.uid);
            renderList();
        } catch (error) {
            console.error("JSON 파일로 게시글 생성 실패:", error);
            showToast('게시글 생성에 실패했습니다.');
        }
    }

    /* 
      아래 함수들은 기존 list-script.js와 거의 동일합니다.
      (renderList, renderItem, handleFolderClick, handleNewFolder, deleteFolder, editFolderName, initializeSortable 등)
    */

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
        let iconHtml = itemData.type === 'folder' 
            ? '<span class="icon-closed">📁</span><span class="icon-open">📂</span>' 
            : '💬'; // 아이콘을 채팅 모양으로 변경
        wrapper.innerHTML = `
            <span class="drag-handle">⠿</span>
            <span class="item-icon">${iconHtml}</span>
            <span class="item-title">${itemData.title}</span>
            ${itemData.type === 'folder' 
                ? `<button class="edit-folder-btn" title="이름 변경">✏️</button>
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
        if (withAnimation) {
            liElement.classList.toggle('open');
        } else {
            liElement.classList.add('open');
        }
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
            await postsCollection.add({
                type: 'folder',
                title: title,
                content: '',
                category: currentCategory,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                userId: userId,
                order: Date.now() - 1, // 폴더가 위쪽에 위치하도록
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
                [evt.from, evt.to].forEach(listEl => {
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
