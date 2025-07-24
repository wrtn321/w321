// editor-script.js (읽기/수정 모드 기능이 추가된 최종 버전)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // 페이지 보호
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        }
    });

    // 전역 변수 및 요소
    let currentPost = null; // 게시글 데이터 전체를 저장할 변수
    const backToListBtn = document.getElementById('back-to-list-btn');

    // 모드 컨테이너
    const viewModeElements = document.getElementById('view-mode-elements');
    const editModeElements = document.getElementById('edit-mode-elements');

    // 읽기 모드 요소
    const viewTitle = viewModeElements.querySelector('.view-title');
    const viewContent = viewModeElements.querySelector('.view-content');
    const viewEditBtn = document.getElementById('view-edit-btn');
    const viewDeleteBtn = document.getElementById('view-delete-btn');
    const viewCopyBtn = document.getElementById('view-copy-btn');

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
    // 기능 함수들
    // =====================================================

    // 모드 전환 함수
    const toggleMode = (mode) => {
        if (mode === 'edit') {
            // 수정 모드로 전환
            // 1. 읽기 모드 요소를 숨기고, 수정 모드 요소를 보여준다.
            viewModeElements.hidden = true;
            editModeElements.hidden = false;

            // 2. 현재 게시글 데이터를 입력창에 채워준다.
            titleInput.value = currentPost.title;
            contentTextarea.value = currentPost.content;
            
            // 3. 부가 기능 실행
            updateCharCount();
            autoResizeTextarea();

        } else { // 'view' 모드 또는 그 외
            // 읽기 모드로 전환
            viewModeElements.hidden = false;
            editModeElements.hidden = true;
        }
    };
    
    const updateCharCount = () => { charCounter.textContent = contentTextarea.value.length; };
    const autoResizeTextarea = () => {
        contentTextarea.style.height = 'auto';
        contentTextarea.style.height = (contentTextarea.scrollHeight + 2) + 'px';
    };
    const showToast = message => {
        clearTimeout(toastTimer);
        toastMessage.textContent = message;
        toastNotification.classList.add('show');
        toastTimer = setTimeout(() => { toastNotification.classList.remove('show'); }, 3000);
    };

    // =====================================================
    // 페이지 로드 시 데이터 처리
    // =====================================================
    function loadPostData() {
        // 목록 페이지로 돌아갈 링크 설정
        const category = localStorage.getItem('currentCategory');
        if (category) {
            backToListBtn.href = `list.html?category=${category}`;
        }

        // 로컬 스토리지에서 게시글 데이터 가져오기
        const postDataString = localStorage.getItem('currentPost');
        if (postDataString) {
            currentPost = JSON.parse(postDataString);
            
            // 읽기 모드 요소에 데이터 채우기
            viewTitle.textContent = currentPost.title;
            viewContent.textContent = currentPost.content;

            // 페이지를 읽기 모드로 시작
            toggleMode('view');

        } else {
            // 게시글 데이터가 없는 경우 (예: 에러)
            alert("게시글을 불러오는 데 실패했습니다.");
            window.location.href = 'main.html';
        }
        updateCharCount();
        autoResizeTextarea();
    }

    // =====================================================
    // 이벤트 리스너 연결
    // =====================================================

    // ---- 모드 전환 버튼 ----
    viewEditBtn.addEventListener('click', () => {
        toggleMode('edit');
    });

    editCancelBtn.addEventListener('click', () => {
        toggleMode('view');
        // 수정 중이던 내용은 저장하지 않고 그냥 읽기 모드로 돌아감
    });
    
    // ---- 기능 버튼 ----
    editSaveBtn.addEventListener('click', async () => {
        if (!currentPost.id) return;

        const updatedData = {
            title: titleInput.value,
            content: contentTextarea.value
        };

        try {
            await db.collection('posts').doc(currentPost.id).update(updatedData);
            
            // 로컬 데이터도 업데이트
            currentPost.title = updatedData.title;
            currentPost.content = updatedData.content;
            
            // 읽기 모드 화면도 업데이트
            viewTitle.textContent = updatedData.title;
            viewContent.textContent = updatedData.content;

            // 로컬 스토리지 데이터도 업데이트 (사용자가 새로고침해도 유지되도록)
            localStorage.setItem('currentPost', JSON.stringify(currentPost));
            
            showToast('저장되었습니다.');
            toggleMode('view'); // 저장 후 읽기 모드로 전환
        } catch (error) {
            console.error("수정 실패:", error);
            showToast('저장에 실패했습니다.');
        }
    });

    viewDeleteBtn.addEventListener('click', async () => {
        if (!currentPost.id) return;
        if (confirm('정말로 이 게시글을 삭제하시겠습니까?')) {
            try {
                await db.collection('posts').doc(currentPost.id).delete();
                // 삭제 후 로컬 스토리지 데이터도 정리
                localStorage.removeItem('currentPost');
                localStorage.removeItem('currentCategory');
                window.location.href = backToListBtn.href; // 원래 목록으로 이동
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

    // ---- 입력창 이벤트 ----
    contentTextarea.addEventListener('input', updateCharCount);
    contentTextarea.addEventListener('input', autoResizeTextarea);

    // =====================================================
    // 최초 실행
    // =====================================================
    loadPostData();
});