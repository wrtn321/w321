// editor-script.js (깨끗하게 정리된 버전)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // 페이지 보호
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = '/index.html';
        }
    });

    // 전역 변수 및 요소
    let currentPostId = null;
    const backToListBtn = document.getElementById('back-to-list-btn');
    const titleInput = document.querySelector('.title-input');
    const contentTextarea = document.querySelector('.content-textarea');
    const editBtn = document.querySelector('.edit-btn');
    const deleteBtn = document.querySelector('.delete-btn');
    const copyBtn = document.querySelector('.copy-btn');
    const charCounter = document.getElementById('char-counter');
    const toastNotification = document.getElementById('toast-notification');
    const toastMessage = toastNotification.querySelector('.toast-message');
    let toastTimer;

    // 기능 함수들
    const updateCharCount = () => { charCounter.textContent = contentTextarea.value.length; };
    const autoResizeTextarea = () => { contentTextarea.style.height = 'auto'; contentTextarea.style.height = contentTextarea.scrollHeight + 'px'; };
    const showToast = message => {
        clearTimeout(toastTimer);
        toastMessage.textContent = message;
        toastNotification.classList.add('show');
        toastTimer = setTimeout(() => { toastNotification.classList.remove('show'); }, 3000);
    };

    // 페이지 로드 시 데이터 채우기
    function loadPostData() {
        const category = localStorage.getItem('currentCategory');
        if (category) {
            backToListBtn.href = `/list.html?category=${category}`;
        }
        const postDataString = localStorage.getItem('currentPost');
        if (postDataString) {
            const postData = JSON.parse(postDataString);
            currentPostId = postData.id;
            titleInput.value = postData.title;
            contentTextarea.value = postData.content;
        } else {
            titleInput.placeholder = "새 글을 작성해보세요.";
            editBtn.style.display = 'none';
            deleteBtn.style.display = 'none';
        }
        updateCharCount();
        autoResizeTextarea();
    }

    // 이벤트 리스너 연결
    contentTextarea.addEventListener('input', updateCharCount);
    contentTextarea.addEventListener('input', autoResizeTextarea);

    editBtn.addEventListener('click', async () => {
        if (!currentPostId) return;
        try {
            await db.collection('posts').doc(currentPostId).update({ title: titleInput.value, content: contentTextarea.value });
            showToast('저장되었습니다.');
        } catch (error) { console.error("수정 실패:", error); showToast('저장에 실패했습니다.'); }
    });

    deleteBtn.addEventListener('click', async () => {
        if (!currentPostId) return;
        if (confirm('정말로 이 게시글을 삭제하시겠습니까?')) {
            try {
                await db.collection('posts').doc(currentPostId).delete();
                window.location.href = backToListBtn.href; // 원래 목록으로 이동
            } catch (error) { console.error("삭제 실패:", error); showToast('삭제에 실패했습니다.'); }
        }
    });
    
    copyBtn.addEventListener('click', () => {
        if (!contentTextarea.value) { showToast('복사할 내용이 없습니다.'); return; }
        navigator.clipboard.writeText(contentTextarea.value)
            .then(() => showToast('본문이 클립보드에 복사되었습니다!'))
            .catch(err => { console.error('복사 실패:', err); showToast('복사에 실패했습니다.'); });
    });

    // 최초 실행
    loadPostData();
});