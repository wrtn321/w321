// list-script.js (새 파일 버튼 기능이 수정된 최종 버전)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    const postsCollection = db.collection('posts');
    let currentCategory = '';
    let posts = [];
    const categoryNames = { prompt: '프롬프트', chat: '채팅백업', novel: '소설' };

    const listTitle = document.getElementById('list-title');
    const newPostBtn = document.querySelector('.new-post-btn');
    const newFolderBtn = document.querySelector('.new-folder-btn');
    const normalItemList = document.querySelector('.normal-list .item-list');
    const logoutButton = document.querySelector('.logout-button');

    // ... (토스트 알림 관련 코드는 그대로 유지) ...
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
            addEventListeners();
        } else {
            window.location.href = 'index.html';
        }
    });

    function initializePage() {
        const params = new URLSearchParams(window.location.search);
        const categoryParam = params.get('category');
        if (categoryParam && categoryNames[categoryParam]) {
            currentCategory = categoryParam;
            listTitle.textContent = categoryNames[currentCategory];
        if (currentCategory === 'chat') {
            newPostBtn.textContent = '+ JSON 불러오기';
        } else {
            newPostBtn.textContent = '+📝';
        }
    } else {
        alert('잘못된 접근입니다.');
        window.location.href = 'main.html';
    }
    }

    async function fetchPosts(userId) {
        try {
            const snapshot = await postsCollection
                .where('userId', '==', userId)
                .where('category', '==', currentCategory)
                .get();
            posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("데이터 불러오기 실패:", error);
            if (error.code === 'failed-precondition') {
                alert("Firestore 색인이 필요합니다. 개발자 콘솔(F12)의 에러 메시지에 있는 링크를 클릭하여 색인을 생성해주세요.");
            }
        }
    }

    // renderList, renderItem 함수는 수정할 필요 없이 그대로 사용합니다.
    function renderList() {
        // ... (기존 renderList 함수 코드는 그대로) ...
        if (!normalItemList) return;
        const openFolderIds = new Set();
        document.querySelectorAll('.list-item.open').forEach(li => {
            openFolderIds.add(li.dataset.id);
        });
        normalItemList.innerHTML = '';
        const rootItems = posts
            .filter(p => !p.parentId || p.parentId === 'root')
            .sort((a, b) => (a.order || 0) - (b.order || 0));
        rootItems.forEach(item => {
            renderItem(item, normalItemList);
        });
        if (openFolderIds.size > 0) {
            openFolderIds.forEach(id => {
                const folderLi = normalItemList.querySelector(`.list-item[data-id="${id}"]`);
                if (folderLi) {
                    handleFolderClick(folderLi, false);
                }
            });
        }
        document.querySelectorAll('.sub-list').forEach(subList => {
            initializeSortable(subList);
        });
        initializeSortable(normalItemList);
    }
    
    function renderItem(itemData, parentElement) {
        // ... (기존 renderItem 함수 코드는 그대로) ...
        const li = document.createElement('li');
        li.className = 'list-item';
        li.dataset.id = itemData.id;
        const wrapper = document.createElement('div');
        wrapper.className = 'item-content-wrapper';
        let iconHtml;
        if (itemData.type === 'folder') {
            iconHtml = '<span class="icon-closed">📁</span><span class="icon-open">📂</span>';
        } else {
            iconHtml = '📝';
        }
        wrapper.innerHTML = `
        <span class="drag-handle">⠿</span>
        <span class="item-icon">${iconHtml}</span>
        <span class="item-title">${itemData.title}</span>
        ${itemData.type === 'folder' ? '<button class="delete-folder-btn">🗑️</button>' : ''}
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
    
    // ===============================================
    // ★★★ 핵심 수정 부분 1: 이벤트 리스너 변경 ★★★
    // ===============================================
    function addEventListeners() {
    logoutButton.addEventListener('click', e => {
        e.preventDefault();
        auth.signOut().then(() => window.location.href = 'index.html');
    });

    newFolderBtn.addEventListener('click', () => handleNewItem('folder'));
    
    // ▼▼▼ 새 파일 버튼의 이벤트 리스너를 수정합니다. ▼▼▼
    newPostBtn.addEventListener('click', () => {
        // 현재 카테고리가 'chat'일 경우와 아닐 경우를 나눕니다.
        if (currentCategory === 'chat') {
            // 'JSON 불러오기' 버튼을 클릭한 경우
            handleJsonUpload();
        } else {
            // 기존의 '새 글 작성' 버튼을 클릭한 경우
            window.location.href = `post.html?category=${currentCategory}&new=true`;
        }
    });
        
        normalItemList.addEventListener('click', e => {
            const wrapper = e.target.closest('.item-content-wrapper');
            if (!wrapper) return;
            const li = wrapper.closest('.list-item');
            if (!li) return;
            if (e.target.classList.contains('delete-folder-btn')) {
                e.stopPropagation();
                if (confirm('폴더를 삭제하시겠습니까?\n(안에 있는 파일은 밖으로 이동됩니다)')) {
                    deleteFolder(li.dataset.id);
                }
                return;
            }
            if (li.classList.contains('item-folder')) {
                handleFolderClick(li);
            } else {
                handleFileClick(li);
            }
        });
    }

    // ===============================================
    // ★★★ 핵심 수정 부분 2: 함수 간소화 ★★★
    // ===============================================

    // handleNewItem 함수에서 'post' 관련 로직을 제거합니다. 이제 폴더 생성만 담당합니다.
    async function handleNewItem(type) {
        // 이 함수는 이제 type이 'folder'일 때만 호출됩니다.
        const title = prompt(`새 폴더의 이름을 입력하세요.`);
        if (!title) return;

        const user = auth.currentUser;
        if (!user) return;

        const batch = db.batch();

        const rootItems = posts.filter(p => !p.parentId || p.parentId === 'root');
        rootItems.forEach(item => {
            const itemRef = postsCollection.doc(item.id);
            batch.update(itemRef, { order: (item.order || 0) + 1 });
        });

        const newFolderRef = postsCollection.doc();
        batch.set(newFolderRef, {
            type: 'folder',
            title: title,
            content: '',
            category: currentCategory,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            userId: user.uid,
            order: 0,
            parentId: 'root'
        });

        try {
            await batch.commit();
            await fetchPosts(user.uid);
            renderList();
        } catch(error) {
            console.error("항목 추가 실패:", error);
            showToast('항목 추가에 실패했습니다.');
        }
    }

    // handleFolderClick, handleFileClick, deleteFolder, initializeSortable 함수는
    // 수정할 필요 없이 그대로 사용합니다.
    function handleFolderClick(liElement, withAnimation = true) { /* ... 기존 코드 ... */ 
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
            children.forEach(child => {
                renderItem(child, subList);
            });
        }
    }
    function handleFileClick(liElement) {
    const post = posts.find(p => p.id === liElement.dataset.id);
    if (post) {
        // 로컬 스토리지에 데이터를 저장하는 것은 동일합니다.
        localStorage.setItem('currentPost', JSON.stringify(post));
        localStorage.setItem('currentCategory', currentCategory);

        // ★★★ 여기가 핵심 변경사항 ★★★
        // 현재 카테고리가 'chat'이면 chat-viewer.html로,
        // 그 외에는 기존처럼 post.html로 이동합니다.
        if (currentCategory === 'chat') {
            window.location.href = 'chat-viewer.html';
        } else {
            window.location.href = 'post.html';
        }
    }
    }
    async function deleteFolder(folderId) { /* ... 기존 코드 ... */
        const user = auth.currentUser;
        if (!user || !folderId) return;
        const folderToDelete = posts.find(p => p.id === folderId);
        if (!folderToDelete) return;
        const childrenOfFolder = posts
            .filter(p => p.parentId === folderId)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
        const originalRootItems = posts
            .filter(p => (!p.parentId || p.parentId === 'root'))
            .sort((a, b) => (a.order || 0) - (b.order || 0));
        const folderIndex = originalRootItems.findIndex(p => p.id === folderId);
        if (folderIndex > -1) {
            originalRootItems.splice(folderIndex, 1, ...childrenOfFolder);
        }
        const batch = db.batch();
        originalRootItems.forEach((item, index) => {
            const itemRef = postsCollection.doc(item.id);
            const wasChild = childrenOfFolder.some(child => child.id === item.id);
            if (wasChild) {
                batch.update(itemRef, { parentId: 'root', order: index });
            } else {
                batch.update(itemRef, { order: index });
            }
        });
        batch.delete(postsCollection.doc(folderId));
        try {
            await batch.commit();
            showToast('폴더가 삭제되었습니다.');
            await fetchPosts(user.uid);
            renderList();
        } catch (error) {
            console.error("폴더 삭제 실패:", error);
            showToast('폴더 삭제에 실패했습니다.');
        }
    }
    function initializeSortable(targetUl) { /* ... 기존 코드 ... */
        if (!targetUl) return;
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
                try {
                    await postsCollection.doc(itemId).update({ parentId: newParentId });
                } catch (error) {
                    console.error('Parent ID 업데이트 실패:', error);
                    return; 
                }
                const involvedLists = new Set([evt.from, evt.to]);
                const batch = db.batch();
                involvedLists.forEach(listEl => {
                    const items = listEl.children;
                    Array.from(items).forEach((item, index) => {
                        const docRef = postsCollection.doc(item.dataset.id);
                        batch.update(docRef, { order: index });
                    });
                });
                try {
                    await batch.commit();
                    console.log('순서가 성공적으로 저장되었습니다.');
                    await fetchPosts(auth.currentUser.uid);
                    renderList();
                } catch (error) {
                    console.error('순서 저장에 실패했습니다:', error);
                }
            }
        });
    }

    /**
 * 사용자가 JSON 파일을 선택하도록 하는 숨겨진 input 요소를 다루는 함수
 */
function handleJsonUpload() {
    // 1. 눈에 보이지 않는 파일 선택 input 요소를 동적으로 만듭니다.
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json'; // json 파일만 선택할 수 있도록 제한

    // 2. 파일이 선택되면 실행될 로직을 정의합니다.
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            // 파일 읽기가 성공하면, 파일 이름과 내용을 다음 함수로 넘겨줍니다.
            const fileContent = event.target.result;
            // .json 확장자를 제외한 파일 이름을 제목으로 사용합니다.
            const title = file.name.replace(/\.json$/, ''); 
            createPostFromJson(title, fileContent);
        };
        reader.onerror = () => {
            showToast('파일을 읽는 데 실패했습니다.');
        };
        reader.readAsText(file); // 파일을 텍스트로 읽기 시작
    };

    // 3. 동적으로 만든 input 요소를 강제로 클릭하여 파일 선택 창을 엽니다.
    input.click();
}

/**
 * 읽어들인 JSON 내용으로 새 게시물을 Firestore에 생성하는 함수
 * @param {string} title - 파일 이름에서 추출한 제목
 * @param {string} content - 파일의 전체 내용 (JSON 텍스트)
 */
async function createPostFromJson(title, content) {
    const user = auth.currentUser;
    if (!user) return;

    // JSON 형식이 올바른지 간단하게 확인합니다.
    try {
        JSON.parse(content);
    } catch (error) {
        alert('올바른 JSON 파일이 아닙니다. 파일 내용을 확인해주세요.');
        return;
    }

    try {
        // 마지막 순서를 찾아서 그 다음에 새 글을 추가합니다.
        const maxOrder = posts.length > 0 ? Math.max(...posts.map(p => p.order || 0)) : -1;
        const newOrder = maxOrder + 1;

        await postsCollection.add({
            type: 'post',
            title: title,
            content: content,
            category: currentCategory,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            userId: user.uid,
            order: newOrder,
            parentId: 'root'
        });

        showToast(`'${title}' 파일이 추가되었습니다.`);
        await fetchPosts(user.uid); // 목록을 다시 불러와서
        renderList(); // 화면을 새로 그립니다.

    } catch (error) {
        console.error("JSON 파일로 게시글 생성 실패:", error);
        showToast('게시글 생성에 실패했습니다.');
    }
}
});
