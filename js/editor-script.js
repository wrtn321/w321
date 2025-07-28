// editor-script.js (드롭다운 메뉴 UI가 적용된 최종 버전)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // 페이지 보호
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        }
    });

    // =====================================================
    // 전역 변수 및 요소
    // =====================================================
    let currentPost = null; // 게시글 데이터 전체를 저장할 변수
    const backToListBtn = document.getElementById('back-to-list-btn');

    // 모드 컨테이너
    const viewModeElements = document.getElementById('view-mode-elements');
    const editModeElements = document.getElementById('edit-mode-elements');

    // 읽기 모드 요소
    const viewTitle = viewModeElements.querySelector('.view-title');
    const viewContent = viewModeElements.querySelector('.view-content');
    const viewCopyBtn = document.getElementById('view-copy-btn');
    
    // 드롭다운 메뉴 관련 요소들 ▼▼▼
    const toggleMenuBtn = document.getElementById('toggle-menu-btn');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const dropdownEditBtn = document.getElementById('dropdown-edit-btn');
    const dropdownDeleteBtn = document.getElementById('dropdown-delete-btn');
    const dropdownDownloadBtn = document.getElementById('dropdown-download-btn');
    

    // 수정 모드 요소
    const titleInput = editModeElements.querySelector('.title-input');
    const contentTextarea = editModeElements.querySelector('.content-textarea');
    const editSaveBtn = document.getElementById('edit-save-btn');
    const editCancelBtn = document.getElementById('edit-cancel-btn');
    const charCounter = document.getElementById('char-counter');

    // 토스트 알림 관련 요소
    const toastNotification = document.getElementById('toast-notification');
    const toastMessage = toastNotification.querySelector('.toast-message');
    let toastTimer;

    // =====================================================
    // 기능 함수들 (이 부분은 수정되지 않았습니다)
    // =====================================================

    // 모드 전환 함수
    const toggleMode = (mode) => {
        if (mode === 'edit') {
            viewModeElements.hidden = true;
            editModeElements.hidden = false;
            titleInput.value = currentPost.title;
            contentTextarea.value = currentPost.content;
            updateCharCount();
            autoResizeTextarea();
        } else {
            viewModeElements.hidden = false;
            editModeElements.hidden = true;
        }
    };
    
    const updateCharCount = () => { charCounter.textContent = contentTextarea.value.length; };
    const autoResizeTextarea = () => {
        const scrollPosition = window.scrollY;
        contentTextarea.style.height = 'auto';
        contentTextarea.style.height = (contentTextarea.scrollHeight) + 'px';
        window.scrollTo(0, scrollPosition);
    };
    const showToast = message => {
        clearTimeout(toastTimer);
        toastMessage.textContent = message;
        toastNotification.classList.add('show');
        toastTimer = setTimeout(() => { toastNotification.classList.remove('show'); }, 3000);
    };

    /**
     * 현재 게시글의 내용을 .txt 파일로 다운로드하는 함수
     */
    function downloadTxtFile() {
        // 1. 파일 내용과 파일 이름을 준비합니다. 내용이나 제목이 없으면 기본값을 사용합니다.
        const content = currentPost.content || '';
        const filename = (currentPost.title.trim() || '제목없음') + '.txt';

        // 2. 파일 내용을 담는 Blob 객체를 만듭니다. (컴퓨터가 파일로 인식할 수 있는 데이터 덩어리)
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });

        // 3. 다운로드를 위한 임시 링크(<a>)를 메모리에 만듭니다.
        const link = document.createElement("a");

        // 4. Blob 객체를 가리키는 임시 URL을 생성하고 링크의 href와 download 속성에 설정합니다.
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = filename;

        // 5. 링크를 눈에 보이지 않게 문서에 추가하고, 강제로 클릭 이벤트를 발생시켜 다운로드를 시작합니다.
        document.body.appendChild(link);
        link.click();
        
        // 6. 다운로드가 시작되면 임시로 만들었던 링크와 URL을 메모리에서 제거하여 정리합니다.
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    // =====================================================
    // 페이지 로드 시 데이터 처리 (이 부분은 수정되지 않았습니다)
    // =====================================================
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
            currentPost = {
                title: '',
                content: '',
                category: categoryFromURL,
            };
            toggleMode('edit');
        } else {
            const postDataString = localStorage.getItem('currentPost');
            if (postDataString) {
                currentPost = JSON.parse(postDataString);
                viewTitle.textContent = currentPost.title;
                viewContent.innerHTML = marked.parse(currentPost.content || '');
                toggleMode('view');
            } else {
                alert("게시글 정보를 찾을 수 없습니다. 메인 페이지로 이동합니다.");
                window.location.href = 'main.html';
            }
        }
        updateCharCount();
        autoResizeTextarea();
    }
    
    // =====================================================
    // 이벤트 리스너 연결 (이 부분이 수정되었습니다)
    // =====================================================

    // ---- 뒤로가기 버튼 ----
    backToListBtn.addEventListener('click', (e) => {
        e.preventDefault(); 
        window.location.replace(backToListBtn.href);
    });

    // ---- 드롭다운 메뉴 토글 기능 ----
    toggleMenuBtn.addEventListener('click', () => {
        dropdownMenu.hidden = !dropdownMenu.hidden;
    });

    // ---- 화면의 다른 곳을 클릭하면 메뉴가 닫히게 하는 기능 ----
    window.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-menu-container')) {
            dropdownMenu.hidden = true;
        }
    });

    // ---- 드롭다운 메뉴 안의 '수정' 버튼 ----
    dropdownEditBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleMode('edit');
        dropdownMenu.hidden = true;
    });

    // ---- 드롭다운 메뉴 안의 '삭제' 버튼 ----
    dropdownDeleteBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        dropdownMenu.hidden = true;

        if (!currentPost.id) return;
        if (confirm('정말로 이 게시글을 삭제하시겠습니까?')) {
            try {
                await db.collection('posts').doc(currentPost.id).delete();
                localStorage.removeItem('currentPost');
                localStorage.removeItem('currentCategory');
                window.location.replace(backToListBtn.href);
            } catch (error) {
                console.error("삭제 실패:", error);
                showToast('삭제에 실패했습니다.');
            }
        }
    });

    // ---- 복사 버튼 ----
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

    dropdownDownloadBtn.addEventListener('click', (e) => {
        e.preventDefault(); // a 태그의 기본 동작(페이지 이동)을 막습니다.
        downloadTxtFile(); // 위에서 만든 다운로드 함수를 호출합니다.
        dropdownMenu.hidden = true; // 메뉴를 닫아줍니다.
    });

    // ---- 수정 모드의 버튼들 ----
    editCancelBtn.addEventListener('click', () => {
        toggleMode('view');
    });
    
    editSaveBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
            showToast('로그인 정보가 없습니다. 다시 로그인해주세요.');
            return;
        }

        const dataToSave = {
            title: titleInput.value.trim() || "제목 없음",
            content: contentTextarea.value,
            category: currentPost.category
        };

        try {
            if (currentPost.id) {
                await db.collection('posts').doc(currentPost.id).update(dataToSave);
                currentPost.title = dataToSave.title;
                currentPost.content = dataToSave.content;
            } else {
                const lastPostQuery = db.collection('posts')
                    .where('userId', '==', user.uid)
                    .where('category', '==', currentPost.category)
                    .orderBy('order', 'desc')
                    .limit(1);

                const snapshot = await lastPostQuery.get();
                let newOrder = 0;
                if (!snapshot.empty) {
                    const lastPost = snapshot.docs[0].data();
                    newOrder = (lastPost.order || 0) + 1;
                }

                const docRef = await db.collection('posts').add({
                    ...dataToSave,
                    userId: user.uid,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    order: newOrder,
                });
                
                currentPost.id = docRef.id;
                currentPost.title = dataToSave.title;
                currentPost.content = dataToSave.content;
            }
            
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
