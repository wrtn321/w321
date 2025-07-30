// editor-script.js

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        }
    });

    // =====================================================
    // 전역 변수 및 요소
    // =====================================================
    let currentPost = null;
    const backToListBtn = document.getElementById('back-to-list-btn');

    // 모드 컨테이너
    const viewModeHeader = document.getElementById('view-mode-elements-header');
    const editModeHeader = document.getElementById('edit-mode-elements-header');
    const viewModeContent = document.getElementById('view-mode-elements-content');
    const editModeContent = document.getElementById('edit-mode-elements-content');

    // 읽기 모드 요소
    const viewTitle = viewModeHeader.querySelector('.view-title');
    const viewContent = viewModeContent.querySelector('.view-content');
    const viewCopyBtn = document.getElementById('view-copy-btn');
    const viewModeActions = document.getElementById('view-mode-actions'); // 헤더 오른쪽 버튼 그룹
    const toggleMenuBtn = document.getElementById('toggle-menu-btn');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const dropdownEditBtn = document.getElementById('dropdown-edit-btn');
    const dropdownDownloadBtn = document.getElementById('dropdown-download-btn');
    const dropdownDeleteBtn = document.getElementById('dropdown-delete-btn');

    // 수정 모드 요소
    const titleInput = editModeHeader.querySelector('.title-input');
    const contentTextarea = editModeContent.querySelector('.content-textarea');
    const editModeActions = document.getElementById('edit-mode-actions'); // 헤더 오른쪽 버튼 그룹
    const charCounter = editModeContent.querySelector('#char-counter');

    // 토스트 알림 관련 요소
    const toastNotification = document.getElementById('toast-notification');
    const toastMessage = toastNotification.querySelector('.toast-message');
    let toastTimer;

    // =====================================================
    // 기능 함수들
    // =====================================================
    
    /**
     * 화면 모드를 '읽기' 또는 '수정'으로 전환하는 함수
     * @param {'view' | 'edit'} mode - 전환할 모드
     */
    const toggleMode = (mode) => {
        if (mode === 'edit') {
            // 수정 모드 관련 요소 보이기
            viewModeHeader.hidden = true;
            editModeHeader.hidden = false;
            viewModeContent.hidden = true;
            editModeContent.hidden = false;
            
            // 헤더 오른쪽 버튼 그룹 제어
            viewModeActions.hidden = true;
            editModeActions.hidden = false;

            // 읽기 모드 전용 플로팅 버튼 숨기기
            viewCopyBtn.hidden = true;

            // 데이터 채우기
            titleInput.value = currentPost.title;
            contentTextarea.value = currentPost.content;
            updateCharCount();
            autoResizeTextarea();
        } else { // 'view' 모드
            // 읽기 모드 관련 요소 보이기
            viewModeHeader.hidden = false;
            editModeHeader.hidden = true;
            viewModeContent.hidden = false;
            editModeContent.hidden = true;

            // 헤더 오른쪽 버튼 그룹 제어
            viewModeActions.hidden = false;
            editModeActions.hidden = true;

            // 읽기 모드 전용 플로팅 버튼 보이기
            viewCopyBtn.hidden = false;
        }
    };
    
    const updateCharCount = () => {
        if(charCounter) charCounter.textContent = contentTextarea.value.length;
    };

    const autoResizeTextarea = () => {
        const scrollPosition = window.scrollY; // 현재 스크롤 위치 저장
        contentTextarea.style.height = 'auto'; // 높이를 초기화하여 줄어들 수 있게 함
        contentTextarea.style.height = (contentTextarea.scrollHeight) + 'px'; // 스크롤 높이에 맞게 설정
        window.scrollTo(0, scrollPosition); // 원래 스크롤 위치로 복귀
    };

    const showToast = message => {
        if (!toastNotification || !toastMessage) return;
        clearTimeout(toastTimer);
        toastMessage.textContent = message;
        toastNotification.classList.add('show');
        toastTimer = setTimeout(() => {
            toastNotification.classList.remove('show');
        }, 3000);
    };

    /**
     * 현재 게시글의 내용을 .txt 파일로 다운로드하는 함수
     */
    function downloadTxtFile() {
        const content = currentPost.content || '';
        const filename = (currentPost.title.trim() || '제목없음') + '.txt';

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);

        link.href = url;
        link.download = filename;
        
        document.body.appendChild(link);
        link.click();
        
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // =====================================================
    // 페이지 로드 시 데이터 처리
    // =====================================================
    function loadPostData() {
        const params = new URLSearchParams(window.location.search);
        const isNewPost = params.get('new') === 'true';
        const isChatEditMode = params.get('editMode') === 'chat';
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
                
                // chat-viewer에서 넘어왔다면 바로 수정 모드로, 아니면 읽기 모드로 시작
                if (isChatEditMode) {
                    toggleMode('edit'); 
                } else {
                    toggleMode('view');
                }
            } else {
                alert("게시글 정보를 찾을 수 없습니다. 메인 페이지로 이동합니다.");
                window.location.href = 'main.html';
            }
        }
        updateCharCount();
        autoResizeTextarea();
    }
    
    // =====================================================
    // 이벤트 리스너 연결
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

        if (!currentPost || !currentPost.id) {
             showToast('삭제할 수 없는 게시글입니다.');
             return;
        }
        if (confirm('정말로 이 게시글을 삭제하시겠습니까?')) {
            try {
                await db.collection('posts').doc(currentPost.id).delete();
                localStorage.removeItem('currentPost');
                localStorage.removeItem('currentCategory');
                showToast('게시글이 삭제되었습니다.');
                window.location.replace(backToListBtn.href);
            } catch (error) {
                console.error("삭제 실패:", error);
                showToast('삭제에 실패했습니다.');
            }
        }
    });

    // ---- 드롭다운 메뉴 안의 'txt 저장' 버튼 ----
    dropdownDownloadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        downloadTxtFile();
        dropdownMenu.hidden = true;
    });
    
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
