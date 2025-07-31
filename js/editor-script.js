// js/editor-script.js (일반 글 에디터 전용)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    auth.onAuthStateChanged(user => {
        if (!user) window.location.href = 'index.html';
    });

    let currentPost = null;
    const backToListBtn = document.getElementById('back-to-list-btn');

    const viewModeHeader = document.getElementById('view-mode-elements-header');
    const editModeHeader = document.getElementById('edit-mode-elements-header');
    const viewModeContent = document.getElementById('view-mode-elements-content');
    const editModeContent = document.getElementById('edit-mode-elements-content');
    const viewTitle = viewModeHeader.querySelector('.view-title');
    const viewContent = viewModeContent.querySelector('.view-content');
    const viewCopyBtn = document.getElementById('view-copy-btn');
    const viewModeActions = document.getElementById('view-mode-actions');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const dropdownEditBtn = document.getElementById('dropdown-edit-btn');
    const dropdownDownloadBtn = document.getElementById('dropdown-download-btn');
    const dropdownDeleteBtn = document.getElementById('dropdown-delete-btn');
    const titleInput = editModeHeader.querySelector('.title-input');
    const contentTextarea = editModeContent.querySelector('.content-textarea');
    const editModeActions = document.getElementById('edit-mode-actions');
    const charCounter = editModeContent.querySelector('#char-counter');

    function loadPostData() {
        const params = new URLSearchParams(window.location.search);
        const isNewPost = params.get('new') === 'true';
        const categoryFromURL = params.get('category');
        const finalCategory = categoryFromURL || localStorage.getItem('currentCategory');

        if (finalCategory) {
            backToListBtn.href = `list.html?category=${finalCategory}`;
            localStorage.setItem('currentCategory', finalCategory);
        }

        if (isNewPost && categoryFromURL) {
            currentPost = { title: '', content: '', category: categoryFromURL };
            toggleMode('edit');
        } else {
            const postDataString = localStorage.getItem('currentPost');
            if (postDataString) {
                currentPost = JSON.parse(postDataString);
                viewTitle.textContent = currentPost.title;
                viewContent.innerHTML = marked.parse(currentPost.content || '');
                toggleMode('view');
            } else {
                alert("게시글 정보를 찾을 수 없습니다.");
                window.location.href = 'main.html';
            }
        }
        updateCharCount();
        autoResizeTextarea();
    }
    
    const toggleMode = (mode) => {
        if (mode === 'edit') {
            viewModeHeader.hidden = true; editModeHeader.hidden = false;
            viewModeContent.hidden = true; editModeContent.hidden = false;
            viewModeActions.hidden = true; editModeActions.hidden = false;
            viewCopyBtn.hidden = true;
            titleInput.value = currentPost.title;
            contentTextarea.value = currentPost.content;
            updateCharCount(); autoResizeTextarea();
        } else {
            viewModeHeader.hidden = false; editModeHeader.hidden = true;
            viewModeContent.hidden = false; editModeContent.hidden = true;
            viewModeActions.hidden = false; editModeActions.hidden = true;
            viewCopyBtn.hidden = false;
        }
    };
    
    const updateCharCount = () => { if(charCounter) charCounter.textContent = contentTextarea.value.length; };
    const autoResizeTextarea = () => {
        const scrollPosition = window.scrollY;
        contentTextarea.style.height = 'auto';
        contentTextarea.style.height = (contentTextarea.scrollHeight) + 'px';
        window.scrollTo(0, scrollPosition);
    };

    function downloadTxtFile() {
        const content = currentPost.content || '';
        const filename = (currentPost.title.trim() || '제목없음') + '.txt';
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.href = url; link.download = filename;
        document.body.appendChild(link); link.click();
        document.body.removeChild(link); URL.revokeObjectURL(url);
    }

    backToListBtn.addEventListener('click', (e) => { e.preventDefault(); window.location.replace(backToListBtn.href); });
    document.getElementById('toggle-menu-btn').addEventListener('click', () => { dropdownMenu.hidden = !dropdownMenu.hidden; });
    window.addEventListener('click', (e) => { if (!e.target.closest('.dropdown-menu-container')) dropdownMenu.hidden = true; });
    dropdownEditBtn.addEventListener('click', (e) => { e.preventDefault(); toggleMode('edit'); dropdownMenu.hidden = true; });
    dropdownDownloadBtn.addEventListener('click', (e) => { e.preventDefault(); downloadTxtFile(); dropdownMenu.hidden = true; });
    // ---- 읽기 모드의 플로팅 '복사' 버튼 ----
    viewCopyBtn.addEventListener('click', () => {
        if (!currentPost.content) {
            showToast('복사할 내용이 없습니다.');
            return;
        }
        navigator.clipboard.writeText(currentPost.content)
            .then(() => showToast('본문이 클립보드에 복사되었습니다!'))
            .catch(err => {
                console.error('복사 실패:', err);
                showToast('복사에 실패했습니다.');
            });
    });

    // ---- 수정 모드의 '취소' 버튼 ----
    editModeActions.querySelector('#edit-cancel-btn').addEventListener('click', () => {
        // 새 글 작성 중 취소하면 목록으로, 기존 글 수정 중 취소하면 읽기 모드로
        if (!currentPost.id) {
            window.location.replace(backToListBtn.href);
        } else {
            toggleMode('view');
        }
    });
    
    // ---- 수정 모드의 '저장' 버튼 ----
    editModeActions.querySelector('#edit-save-btn').addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
            showToast('로그인 정보가 없습니다. 다시 로그인해주세요.');
            return;
        }

        const dataToSave = {
            title: titleInput.value.trim() || "제목 없음",
            content: contentTextarea.value,
            category: currentPost.category,
            // 수정 시간을 기록하려면 아래 줄의 주석을 푸세요
            // updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            if (currentPost.id) { // 기존 글 업데이트
                await db.collection('posts').doc(currentPost.id).update(dataToSave);
            } else { // 새 글 생성
                const docRef = await db.collection('posts').add({
                    ...dataToSave,
                    userId: user.uid,
                    type: 'post', // 기본 타입은 post
                    parentId: 'root', // 기본적으로 최상위에 생성
                    order: Date.now(), // 순서 정렬을 위해 현재 시간 사용
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                });
                currentPost.id = docRef.id;
            }

            // 로컬 데이터 및 UI 업데이트
            currentPost.title = dataToSave.title;
            currentPost.content = dataToSave.content;
            viewTitle.textContent = currentPost.title;
            viewContent.innerHTML = marked.parse(currentPost.content || '');
            localStorage.setItem('currentPost', JSON.stringify(currentPost));
            
            showToast('저장되었습니다.');
            toggleMode('view');

        } catch (error) {
            console.error("저장 실패:", error);
            showToast('저장에 실패했습니다.');
        }
    });

    // ---- 입력창 이벤트 ----
    contentTextarea.addEventListener('input', updateCharCount);
    contentTextarea.addEventListener('input', autoResizeTextarea);

    // =====================================================
    // 최초 실행
    // =====================================================
    loadPostData();
});
