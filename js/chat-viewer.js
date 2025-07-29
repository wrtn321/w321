// js/chat-viewer.js (기능 버튼이 추가된 최종 버전)

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
    let currentPost = null; // 현재 보고 있는 게시글 데이터를 저장할 변수

    // HTML 요소 가져오기
    const backToListBtn = document.getElementById('back-to-list-btn');
    const viewerTitle = document.getElementById('viewer-title');
    const chatLogContainer = document.getElementById('chat-log-container');
    const toastNotification = document.getElementById('toast-notification');
    const toastMessage = toastNotification.querySelector('.toast-message');
    let toastTimer;

    // 새로 추가된 드롭다운 메뉴 요소들
    const toggleMenuBtn = document.getElementById('toggle-menu-btn');
    const dropdownMenu = document.getElementById('dropdown-menu');
    const dropdownEditBtn = document.getElementById('dropdown-edit-btn');
    const dropdownDownloadBtn = document.getElementById('dropdown-download-btn');
    const dropdownDeleteBtn = document.getElementById('dropdown-delete-btn');

    // =====================================================
    // 기능 함수들
    // =====================================================
    const showToast = message => {
        clearTimeout(toastTimer);
        toastMessage.textContent = message;
        toastNotification.classList.add('show');
        toastTimer = setTimeout(() => { toastNotification.classList.remove('show'); }, 3000);
    };

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
    // 페이지 로드 시 실행될 메인 함수
    // =====================================================
    function loadChatData() {
        const postDataString = localStorage.getItem('currentPost');
        const category = localStorage.getItem('currentCategory');

        if (category) {
            backToListBtn.href = `list.html?category=${category}`;
        }

        if (!postDataString) {
            alert("채팅 기록을 찾을 수 없습니다. 메인 페이지로 이동합니다.");
            window.location.href = 'main.html';
            return;
        }

        currentPost = JSON.parse(postDataString); // 변수에 데이터 저장
        viewerTitle.textContent = currentPost.title;

        try {
            const chatData = JSON.parse(currentPost.content);
            if (!chatData.messages || !Array.isArray(chatData.messages)) {
                throw new Error("JSON이 올바른 형식이 아닙니다. 'messages' 배열이 필요합니다.");
            }
            chatLogContainer.innerHTML = ''; 
            chatData.messages.forEach(message => {
                const bubble = document.createElement('div');
                bubble.classList.add('message-bubble');
                if (message.role === 'user') {
                    bubble.classList.add('user-message');
                } else if (message.role === 'assistant') {
                    bubble.classList.add('assistant-message');
                }
                bubble.textContent = message.content;
                chatLogContainer.appendChild(bubble);
            });
        } catch (error) {
            console.error("채팅 기록을 불러오는 중 에러 발생:", error);
            chatLogContainer.innerHTML = `<p style="text-align: center; color: red;">채팅 기록을 불러올 수 없습니다.<br>저장된 내용이 올바른 JSON 형식인지 확인해주세요.</p>`;
            showToast('채팅 기록을 불러오는 데 실패했습니다.');
        }
    }
    
    // =====================================================
    // 이벤트 리스너 연결
    // =====================================================

    // 뒤로가기 버튼
    backToListBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.replace(backToListBtn.href);
    });
    
    // 드롭다운 메뉴 토글
    toggleMenuBtn.addEventListener('click', () => {
        dropdownMenu.hidden = !dropdownMenu.hidden;
    });

    window.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-menu-container')) {
            dropdownMenu.hidden = true;
        }
    });

    // '수정' 버튼 클릭 시: post.html로 이동
    dropdownEditBtn.addEventListener('click', (e) => {
        e.preventDefault();
        // 로컬 스토리지에 데이터가 이미 있으므로, 그냥 에디터 페이지로 보내기만 하면 됩니다.
        window.location.href = 'post.html'; 
    });

    // 'txt 저장' 버튼
    dropdownDownloadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        downloadTxtFile();
        dropdownMenu.hidden = true;
    });

    // '삭제' 버튼
    dropdownDeleteBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        dropdownMenu.hidden = true;
        if (!currentPost.id) return;

        if (confirm('정말로 이 채팅 기록을 삭제하시겠습니까?')) {
            try {
                await db.collection('posts').doc(currentPost.id).delete();
                localStorage.removeItem('currentPost');
                localStorage.removeItem('currentCategory');
                window.location.replace(backToListBtn.href); // 목록으로 이동
            } catch (error) {
                console.error("삭제 실패:", error);
                showToast('삭제에 실패했습니다.');
            }
        }
    });

    // =====================================================
    // 최초 실행
    // =====================================================
    loadChatData();
});
