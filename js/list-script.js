// js/chat-list-script.js (채팅 목록 전용 스크립트 - 인라인 제목 편집 기능 포함)

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
                .orderBy('order', 'asc') // 순서대로 정렬
                .get();
            posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("데이터 불러오기 실패:", error);
            if (error.code === 'failed-precondition') {
                alert("Firestore 색인이 필요합니다. 개발자 콘솔(F12)의 에러 메시지에 있는 링크를 클릭하여 색인을 생성해주세요.");
            }
        }
    }

    // ★★★ 모든 클릭 이벤트를 한번에 처리하는 통합 이벤트 리스너 ★★★
    function addEventListeners(user) {
        logoutButton.addEventListener('click', e => {
            e.preventDefault();
            auth.signOut().then(() => window.location.href = 'index.html');
        });

        newFolderBtn.addEventListener('click', () => handleNewFolder(user.uid));
        newPostBtn.addEventListener('click', handleJsonUpload);
        
        // 목록 아이템에 대한 모든 클릭 이벤트를 여기서 위임하여 처리
        normalItemList.addEventListener('click', e => {
            const target = e.target; // 클릭된 요소
            const li = target.closest('.list-item');
            if (!li) return;

            const itemId = li.dataset.id;

            // 1. 제목(span)을 클릭했을 때 -> 인라인 편집 모드로 전환
            if (target.classList.contains('item-title') && !normalItemList.querySelector('.title-edit-input')) {
                const currentTitle = target.textContent;
                
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'title-edit-input';
                input.value = currentTitle;

                target.style.display = 'none';
                target.parentNode.insertBefore(input, target.nextSibling);
                input.focus();
                input.select();

                const saveTitle = async () => {
                    const newTitle = input.value.trim();
                    input.remove(); // input 태그 제거
                    target.style.display = 'inline'; // 원래 제목 보이기

                    if (newTitle && newTitle !== currentTitle) {
                        target.textContent = newTitle;
                        try {
                            await db.collection('posts').doc(itemId).update({ title: newTitle });
                            showToast('제목이 변경되었습니다.');
                            const post = posts.find(p => p.id === itemId);
                            if (post) post.title = newTitle;
                        } catch (error) {
                            showToast('제목 변경에 실패했습니다.');
                            target.textContent = currentTitle; // 실패 시 원상복구
                        }
                    }
                };
                input.addEventListener('blur', saveTitle);
                input.addEventListener('keydown', e => {
                    if (e.key === 'Enter') input.blur();
                    if (e.key === 'Escape') {
                        input.remove();
                        target.style.display = 'inline';
                    }
                });
                return; // 다른 클릭 이벤트와 중복 실행 방지
            }

            // 2. 폴더 삭제 버튼 클릭
            if (target.classList.contains('delete-folder-btn')) {
                e.stopPropagation();
                if (confirm('폴더를 삭제하시겠습니까?\n(안에 있는 파일은 밖으로 이동됩니다)')) {
                    deleteFolder(user.uid, itemId);
                }
                return;
            }
            
            // 3. (일반 글 목록용 - 지금은 사용 안함) 폴더 수정 버튼 클릭 
            if (target.classList.contains('edit-folder-btn')) {
                e.stopPropagation();
                // editFolderName(user.uid, itemId); // prompt 방식이므로 사용하지 않음
                showToast('제목을 직접 클릭하여 수정하세요.');
                return;
            }

            // 4. 아이콘이나 제목이 아닌, 아이템 전체(wrapper)를 클릭했을 때
            const wrapper = target.closest('.item-content-wrapper');
            if(wrapper) {
                if (li.classList.contains('item-folder')) {
                    handleFolderClick(li); // 폴더 열기/닫기
                } else {
                    handleFileClick(li); // 파일(채팅) 열기
                }
            }
        });
    }

    // 파일을 클릭하면 항상 chat-viewer.html 로 이동
    function handleFileClick(liElement) {
        const post = posts.find(p => p.id === liElement.dataset.id);
        if (post) {
            localStorage.setItem('currentPost', JSON.stringify(post));
            localStorage.setItem('currentCategory', currentCategory);
            window.location.href = 'chat-viewer.html';
        }
    }
    
    // JSON 파일 업로드 기능
    function handleJsonUpload() {
        // ... (기존과 동일)
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
        // ... (기존과 동일)
        const user = auth.currentUser;
        if (!user) return;

        try {
            JSON.parse(content);
        } catch (error) {
            alert('올바른 JSON 파일이 아닙니다. 파일 내용을 확인해주세요.');
            return;
        }

        try {
            const maxOrder = posts.length > 0 ? Math.max(...posts.map(p => p.order || 0).filter(o => typeof o === 'number')) : -1;
            await postsCollection.add({
                type: 'post',
                title: title,
                content: content,
                category: currentCategory,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                userId: user.uid,
                order: maxOrder + 1,
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
        // ... (기존과 동일, ✏️ 버튼은 일단 유지)
        const li = document.createElement('li');
        li.className = 'list-item';
        li.dataset.id = itemData.id;
        const wrapper = document.createElement('div');
        wrapper.className = 'item-content-wrapper';
        let iconHtml = itemData.type === 'folder' 
            ? '<span class="icon-closed">📁</span><span class="icon-open">📂</span>' 
            : '💬';
        wrapper.innerHTML = `
            <span class="drag-handle">⠿</span>
            <span class="item-icon">${iconHtml}</span>
            <span class="item-title">${itemData.title}</span>
            ${itemData.type === 'folder' 
                ? `<button class="edit-folder-btn" title="제목을 클릭하여 수정">✏️</button>
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
        // ... (기존과 동일)
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
        // ... (기존과 동일, order만 수정)
        const title = prompt(`새 폴더의 이름을 입력하세요.`);
        if (!title) return;
        try {
            const minOrder = posts.length > 0 ? Math.min(...posts.map(p => p.order || 0).filter(o => typeof o === 'number')) : 0;
            await postsCollection.add({
                type: 'folder',
                title: title,
                content: '',
                category: currentCategory,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                userId: userId,
                order: minOrder - 1, // 새 폴더가 항상 위로 가도록
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
        // ... (기존과 동일)
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
    
    function initializeSortable(targetUl) {
        // ... (기존과 동일)
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
                const involvedLists = new Set([evt.from, evt.to]);
                involvedLists.forEach(listEl => {
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
