// js/chat-viewer.js

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();

    // 페이지 접근 제어
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        }
    });

    // 필요한 HTML 요소들을 가져옵니다.
    const backToListBtn = document.getElementById('back-to-list-btn');
    const viewerTitle = document.getElementById('viewer-title');
    const chatLogContainer = document.getElementById('chat-log-container');
    
    // 토스트 알림 관련 (에러 표시용)
    const toastNotification = document.getElementById('toast-notification');
    const toastMessage = toastNotification.querySelector('.toast-message');
    let toastTimer;
    const showToast = message => {
        clearTimeout(toastTimer);
        toastMessage.textContent = message;
        toastNotification.classList.add('show');
        toastTimer = setTimeout(() => { toastNotification.classList.remove('show'); }, 3000);
    };


    /**
     * 페이지가 로드될 때 실행되는 메인 함수
     */
    function loadChatData() {
        // 1. 로컬 스토리지에서 게시글 데이터와 카테고리 정보를 가져옵니다.
        const postDataString = localStorage.getItem('currentPost');
        const category = localStorage.getItem('currentCategory');

        // 목록 페이지로 돌아갈 링크를 설정합니다.
        if (category) {
            backToListBtn.href = `list.html?category=${category}`;
        }
        backToListBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.replace(backToListBtn.href);
        });

        // 2. 게시글 데이터가 없으면 함수를 중단하고 메인으로 보냅니다.
        if (!postDataString) {
            alert("채팅 기록을 찾을 수 없습니다. 메인 페이지로 이동합니다.");
            window.location.href = 'main.html';
            return;
        }

        const currentPost = JSON.parse(postDataString);
        viewerTitle.textContent = currentPost.title; // 페이지 제목 설정

        // 3. 채팅 기록(JSON 형식의 문자열)을 파싱하여 실제 객체로 변환합니다.
        try {
            const chatData = JSON.parse(currentPost.content);

            // 4. JSON 데이터가 올바른 형식인지 확인합니다.
            if (!chatData.messages || !Array.isArray(chatData.messages)) {
                throw new Error("JSON이 올바른 형식이 아닙니다. 'messages' 배열이 필요합니다.");
            }

            // 5. 채팅 로그 컨테이너를 비우고, 각 메시지를 화면에 그립니다.
            chatLogContainer.innerHTML = ''; 
            chatData.messages.forEach(message => {
                const bubble = document.createElement('div');
                bubble.classList.add('message-bubble'); // 공통 말풍선 스타일 적용

                // 역할(role)에 따라 다른 스타일을 적용합니다.
                if (message.role === 'user') {
                    bubble.classList.add('user-message');
                } else if (message.role === 'assistant') {
                    bubble.classList.add('assistant-message');
                }
                
                // 말풍선에 내용을 채우고, 컨테이너에 추가합니다.
                bubble.textContent = message.content;
                chatLogContainer.appendChild(bubble);
            });

        } catch (error) {
            // JSON 파싱에 실패하거나 형식이 잘못된 경우, 에러 메시지를 보여줍니다.
            console.error("채팅 기록을 불러오는 중 에러 발생:", error);
            chatLogContainer.innerHTML = `<p style="text-align: center; color: red;">채팅 기록을 불러올 수 없습니다.<br>저장된 내용이 올바른 JSON 형식인지 확인해주세요.</p>`;
            showToast('채팅 기록을 불러오는 데 실패했습니다.');
        }
    }

    // 페이지가 로드되면 메인 함수를 실행합니다.
    loadChatData();
});
