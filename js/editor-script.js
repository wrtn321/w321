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

    // 1. URL의 카테고리 정보를 localStorage의 정보보다 우선합니다.
    const finalCategory = categoryFromURL || localStorage.getItem('currentCategory');

    // 2. 결정된 최종 카테고리가 있다면,
    if (finalCategory) {
        // 2-1. 목록 버튼의 링크를 올바르게 설정합니다.
        backToListBtn.href = `list.html?category=${finalCategory}`;

        // 2-2. localStorage의 정보도 최신으로 덮어써서 '기억'을 갱신합니다.
        //      (이래야 페이지를 새로고침해도 정보가 유지됩니다)
        localStorage.setItem('currentCategory', finalCategory);
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
            viewContent.innerHTML = marked.parse(currentPost.content || '');

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

    // ---- 뒤로가기 버튼의 기본 동작 변경 ----
    backToListBtn.addEventListener('click', (e) => {
    // <a> 태그의 기본 이동 기능(href)을 막습니다.
    e.preventDefault(); 
    
    // history를 남기지 않고 해당 주소로 이동시킵니다.
    window.location.replace(backToListBtn.href);
    });

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
            // ------------------ 여기가 교체된 부분입니다 ------------------
            
            // 1. 마지막 순서(order)를 가진 문서를 찾기 위해 쿼리를 실행합니다.
            const lastPostQuery = db.collection('posts')
                .where('userId', '==', user.uid)
                .where('category', '==', currentPost.category)
                .orderBy('order', 'desc') // 순서를 내림차순(큰->작은)으로 정렬
                .limit(1);                // 그 중 1개만 가져옵니다. (가장 큰 것)

            const snapshot = await lastPostQuery.get();
            
            let newOrder = 0; // 기본 순서는 0
            if (!snapshot.empty) {
                // 2. 만약 해당 카테고리에 문서가 하나라도 있다면,
                //    가장 큰 order 값에 1을 더해 새 순서로 정합니다.
                const lastPost = snapshot.docs[0].data();
                newOrder = (lastPost.order || 0) + 1;
            }

            // 3. 계산된 순서(newOrder)를 포함하여 새 문서를 추가합니다.
            const docRef = await db.collection('posts').add({
                ...dataToSave,
                userId: user.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                order: newOrder, // 계산된 새 순서 값 사용
            });
            
            // 새로 받은 ID와 데이터를 현재 게시글 정보에 업데이트합니다.
            currentPost.id = docRef.id;
            currentPost.title = dataToSave.title;
            currentPost.content = dataToSave.content;
            console.log("새 문서가 생성되었습니다. ID:", currentPost.id, "Order:", newOrder);
            // -----------------------------------------------------------------
        }
        
        // 읽기 모드 화면도 업데이트
        viewTitle.textContent = currentPost.title;
        viewContent.innerHTML = marked.parse(currentPost.content || '');

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
                window.location.replace(backToListBtn.href); // 원래 목록으로 이동
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

    /* =======================================
   드롭다운 메뉴 스타일
   ======================================= */

/* 메뉴 전체를 감싸는 컨테이너 */
.dropdown-menu-container {
    position: relative; /* 자식 요소인 드롭다운 메뉴의 위치 기준점이 됩니다. */
    display: inline-block; /* 다른 버튼 옆에 나란히 있도록 합니다. */
}

/* 실제로 나타나는 드롭다운 메뉴의 스타일 */
.dropdown-content {
    /* 평소엔 안 보이게 처리했다가, JS로 'show' 클래스가 추가되면 보이게 할 수 있습니다. */
    /* 하지만 여기서는 hidden 속성을 사용했으므로 JS로 직접 제어합니다. */
    position: absolute; /* 컨테이너를 기준으로 자유롭게 위치를 잡습니다. */
    right: 0; /* 컨테이너의 오른쪽에 붙입니다. */
    background-color: var(--surface-color);
    min-width: 120px; /* 메뉴가 너무 좁아 보이지 않게 최소 너비를 줍니다. */
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.1);
    z-index: 1; /* 다른 요소들 위에 보이도록 합니다. */
    overflow: hidden; /* border-radius가 내부 요소에도 적용되게 합니다. */
}

/* 드롭다운 메뉴 안의 각 항목 (수정, 삭제 링크) */
.dropdown-content a {
    color: var(--text-primary-color);
    padding: 12px 16px;
    text-decoration: none;
    display: block; /* 링크가 한 줄 전체를 차지하게 만들어 클릭하기 쉽게 합니다. */
    font-size: 15px;
    transition: background-color 0.2s;
}

/* 메뉴 항목에 마우스를 올렸을 때 */
.dropdown-content a:hover {
    background-color: var(--background-color);
}

/* '삭제'와 같이 위험한 동작을 나타내는 항목 스타일 */
.dropdown-content a.danger:hover {
    background-color: #ffdddd; /* 붉은 계열 배경으로 경고의 의미를 줍니다. */
    color: #d32f2f;
}
    
});
