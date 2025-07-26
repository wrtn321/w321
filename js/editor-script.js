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
    // 1. 현재 스크롤 위치를 기억합니다.
    const scrollPosition = window.scrollY;

    // 2. 높이를 'auto'로 초기화하여 실제 필요한 높이를 계산하게 합니다.
    contentTextarea.style.height = 'auto';
    
    // 3. 계산된 높이(scrollHeight)로 실제 높이를 설정합니다.
    contentTextarea.style.height = (contentTextarea.scrollHeight) + 'px';

    // 4. 기억해둔 스크롤 위치로 되돌립니다.
    window.scrollTo(0, scrollPosition);
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
    const params = new URLSearchParams(window.location.search);
    const isNewPost = params.get('new') === 'true';
    const categoryFromURL = params.get('category');

    // "목록으로" 버튼의 링크를 먼저 설정합니다.
    const categoryForLink = localStorage.getItem('currentCategory') || categoryFromURL;
    if (categoryForLink) {
        backToListBtn.href = `list.html?category=${categoryForLink}`;
    }

    // ★★★ 새 글 작성 모드인지, 기존 글 수정 모드인지 확인 ★★★
    if (isNewPost && categoryFromURL) {
        // [새 글 작성 모드]
        console.log("새 글 작성 모드로 시작합니다. 카테고리:", categoryFromURL);
        
        // 임시 게시글 객체를 만듭니다. (ID가 없는 상태)
        currentPost = {
            title: '',
            content: '',
            category: categoryFromURL,
            // id는 아직 없습니다. 저장 시 생성됩니다.
        };

        // 읽기 모드 화면을 건너뛰고 바로 수정 모드로 진입!
        toggleMode('edit');
        
    } else {
        // [기존 글 수정 모드] (기존 로직과 동일)
        const postDataString = localStorage.getItem('currentPost');
        if (postDataString) {
            currentPost = JSON.parse(postDataString);
            
            viewTitle.textContent = currentPost.title;
            viewContent.textContent = currentPost.content;

            toggleMode('view');
        } else {
            alert("게시글 정보를 찾을 수 없습니다. 메인 페이지로 이동합니다.");
            window.location.href = 'main.html';
        }
    }
    // 이 함수들은 모드와 상관없이 한 번 실행해주는 것이 좋습니다.
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
    const user = auth.currentUser;
    if (!user) {
        showToast('로그인 정보가 없습니다. 다시 로그인해주세요.');
        return;
    }

    const dataToSave = {
        title: titleInput.value.trim() || "제목 없음", // 제목이 비어있으면 "제목 없음"으로 저장
        content: contentTextarea.value,
        category: currentPost.category // 카테고리 정보는 항상 포함
    };

    try {
        if (currentPost.id) {
            // [수정] currentPost에 ID가 있으면 update
            await db.collection('posts').doc(currentPost.id).update(dataToSave);
            
            currentPost.title = dataToSave.title;
            currentPost.content = dataToSave.content;

        } else {
            // [새로 추가] currentPost에 ID가 없으면 add
            const docRef = await db.collection('posts').add({
                ...dataToSave,
                userId: user.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                // 새 글의 순서는 목록 페이지에서 관리하게 되므로 여기서는 추가하지 않음
                // 또는 기본값 0을 부여할 수 있음
                order: 0,
            });
            
            // ★★★ 새로 받은 ID를 currentPost 객체에 저장! ★★★
            currentPost.id = docRef.id;
            currentPost.title = dataToSave.title;
            currentPost.content = dataToSave.content;
            console.log("새 문서가 생성되었습니다. ID:", currentPost.id);
        }
        
        // 읽기 모드 화면도 업데이트
        viewTitle.textContent = currentPost.title;
        viewContent.textContent = currentPost.content;

        // localStorage에 현재 상태 저장 (새로고침 대비)
        localStorage.setItem('currentPost', JSON.stringify(currentPost));
        
        showToast('저장되었습니다.');
        toggleMode('view'); // 저장 후 읽기 모드로 전환

    } catch (error) {
        console.error("저장 실패:", error);
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