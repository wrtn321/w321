// js/editor-script.js (인터랙티브 헤더, isPinned 저장, 뒤로가기 버튼 로직 정리 등 모든 기능 적용 최종본)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- 스크립트 전역 변수 ---
    let currentPost = null;
    let lastScrollY = 0; // 인터랙티브 헤더를 위한 변수

    // --- HTML 요소 가져오기 ---
    const header = document.querySelector('.main-header'); // 헤더 요소
    // backToListBtn은 이제 common-script.js에서 처리하므로 여기서 제거합니다.
    const viewModeHeader = document.getElementById('view-mode-elements-header');
    const editModeHeader = document.getElementById('edit-mode-elements-header');
    const viewModeContent = document.getElementById('view-mode-elements-content');
    const editModeContent = document.getElementById('edit-mode-elements-content');
    const viewTitle = viewModeHeader.querySelector('.view-title');
    const viewContent = viewModeContent.querySelector('.view-content');
    const viewCopyBtn = document.getElementById('view-copy-btn');
    const viewModeActions = document.getElementById('view-mode-actions');
    const toggleMenuBtn = document.getElementById('toggle-menu-btn');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const dropdownEditBtn = document.getElementById('dropdown-edit-btn');
    const dropdownDownloadBtn = document.getElementById('dropdown-download-btn');
    const dropdownDeleteBtn = document.getElementById('dropdown-delete-btn');
    const titleInput = editModeHeader.querySelector('.title-input');
    const contentTextarea = editModeContent.querySelector('.content-textarea');
    const editModeActions = document.getElementById('edit-mode-actions');
    const charCounter = editModeContent.querySelector('#char-counter');

    // --- Firebase 인증 및 초기화 ---
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            // 사용자가 로그인 되어 있으면 스크롤 이벤트 리스너 추가
            window.addEventListener('scroll', handleHeaderVisibility);
        }
    });

    // --- 페이지 로드 및 데이터 처리 ---
    function loadPostData() {
        const params = new URLSearchParams(window.location.search);
        const isNewPost = params.get('new') === 'true';
        const categoryFromURL = params.get('category');
        
        // localStorage에 현재 카테고리 저장 (뒤로가기 후 목록 유지를 위해)
        if (categoryFromURL) {
            localStorage.setItem('currentCategory', categoryFromURL);
        }

        if (isNewPost && categoryFromURL) {
            // 새 글일 경우 isPinned 기본값 false로 초기화
            currentPost = { title: '', content: '', category: categoryFromURL, isPinned: false };
            toggleMode('edit');
        } else {
            const postDataString = localStorage.getItem('currentPost');
            if (postDataString) {
                currentPost = JSON.parse(postDataString);
                viewTitle.textContent = currentPost.title;
                viewContent.innerHTML = parseMarkdown(currentPost.content || '');
                toggleMode('view');
            } else {
                alert("게시글 정보를 찾을 수 없습니다.");
                window.location.href = 'main.html';
            }
        }
        updateCharCount();
        autoResizeTextarea();
    }
    
    // --- UI 제어 함수 ---
    const toggleMode = (mode) => {
        if (mode === 'edit') {
            viewModeHeader.hidden = true; editModeHeader.hidden = false;
            viewModeContent.hidden = true; editModeContent.hidden = false;
            viewModeActions.hidden = true; editModeActions.hidden = false;
            viewCopyBtn.hidden = true;
            titleInput.value = currentPost.title;
            contentTextarea.value = currentPost.content;
            updateCharCount(); autoResizeTextarea();
            titleInput.focus();
        } else {
            viewModeHeader.hidden = false; editModeHeader.hidden = true;
            viewModeContent.hidden = false; editModeContent.hidden = true;
            viewModeActions.hidden = false; editModeActions.hidden = true;
            viewCopyBtn.hidden = false;
        }
    };
    
    const updateCharCount = () => { if(charCounter) charCounter.textContent = contentTextarea.value.length; };
    const autoResizeTextarea = () => {
        if (!contentTextarea) return;
        const scrollPosition = window.scrollY;
        contentTextarea.style.height = 'auto';
        contentTextarea.style.height = (contentTextarea.scrollHeight) + 'px';
        window.scrollTo(0, scrollPosition);
    };

    function downloadTxtFile() {
        const content = currentPost.content || '';
        const filename = (currentPost.title.trim() || '제목없음').normalize('NFC') + '.txt';
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.href = url; link.download = filename;
        document.body.appendChild(link); link.click();
        document.body.removeChild(link); URL.revokeObjectURL(url);
    }

    // --- 이벤트 리스너 연결 ---
    toggleMenuBtn.addEventListener('click', () => { dropdownMenu.hidden = !dropdownMenu.hidden; });
    window.addEventListener('click', (e) => { if (!e.target.closest('.dropdown-menu-container')) dropdownMenu.hidden = true; });
    dropdownEditBtn.addEventListener('click', (e) => { e.preventDefault(); toggleMode('edit'); dropdownMenu.hidden = true; });
    dropdownDownloadBtn.addEventListener('click', (e) => { e.preventDefault(); downloadTxtFile(); dropdownMenu.hidden = true; });

    dropdownDeleteBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        dropdownMenu.hidden = true;
        
        if (!currentPost || !currentPost.id) {
             showToast('저장되지 않은 새 글은 삭제할 수 없습니다.');
             return;
        }

        if (confirm('정말로 이 게시글을 삭제하시겠습니까?')) {
            try {
                await db.collection('posts').doc(currentPost.id).delete();
                localStorage.removeItem('currentPost');
                showToast('게시글이 삭제되었습니다.');
                history.back(); // 목록으로 돌아가기
            } catch (error) {
                console.error("삭제 실패:", error);
                showToast('삭제에 실패했습니다.');
            }
        }
    });

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

    editModeActions.querySelector('#edit-cancel-btn').addEventListener('click', () => {
        if (!currentPost.id) { // 새 글 작성 중 취소하면 뒤로가기
            history.back();
        } else { // 기존 글 수정 중 취소하면 읽기 모드로
            toggleMode('view');
        }
    });

    editModeActions.querySelector('#edit-save-btn').addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) { showToast('로그인 정보가 없습니다.'); return; }

        const dataToSave = {
            title: titleInput.value.trim() || "제목 없음",
            content: contentTextarea.value,
            category: currentPost.category,
            // ★★★ isPinned 상태를 보존하거나 기본값 false를 부여합니다. ★★★
            isPinned: currentPost.isPinned || false,
        };

        try {
            if (currentPost.id) { // 기존 글 업데이트
                await db.collection('posts').doc(currentPost.id).update(dataToSave);
            } else { // 새 글 생성
                const docRef = await db.collection('posts').add({
                    ...dataToSave,
                    userId: user.uid,
                    type: 'post',
                    parentId: 'root',
                    order: Date.now(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                });
                currentPost.id = docRef.id;
            }

            // 로컬 데이터도 최신으로 동기화
            currentPost = { ...currentPost, ...dataToSave };
            viewTitle.textContent = currentPost.title;
            viewContent.innerHTML = parseMarkdown(currentPost.content || '');
            localStorage.setItem('currentPost', JSON.stringify(currentPost));
            
            showToast('저장되었습니다.');
            toggleMode('view');
        } catch (error) {
            console.error("저장 실패:", error);
            showToast('저장에 실패했습니다.');
        }
    });

    contentTextarea.addEventListener('input', updateCharCount);
    contentTextarea.addEventListener('input', autoResizeTextarea);

    // --- 인터랙티브 헤더를 위한 함수 ---
    function handleHeaderVisibility() {
        const currentScrollY = window.scrollY;
        if (header) {
            if (currentScrollY > lastScrollY && currentScrollY > header.offsetHeight) {
                // 아래로 스크롤
                header.style.transform = 'translateY(-100%)';
            } else {
                // 위로 스크롤
                header.style.transform = 'translateY(0)';
            }
        }
        lastScrollY = currentScrollY;
    }

    // --- 최초 실행 ---
    loadPostData();
});