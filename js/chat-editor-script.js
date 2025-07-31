// js/chat-editor.js

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    let currentPost = null;

    // HTML 요소 가져오기
    const backBtn = document.getElementById('back-btn');
    const saveBtn = document.getElementById('save-btn');
    const editorTitle = document.getElementById('editor-title');
    const editorContainer = document.getElementById('chat-editor-container');
    const toastNotification = document.getElementById('toast-notification');
    const toastMessage = toastNotification.querySelector('.toast-message');
    let toastTimer;

    // 인증 상태 확인
    auth.onAuthStateChanged(user => {
        if (user) {
            loadAndRenderChat();
        } else {
            window.location.href = 'index.html';
        }
    });

    // 채팅 데이터를 불러와 화면에 렌더링하는 메인 함수
    function loadAndRenderChat() {
        const postDataString = localStorage.getItem('currentPost');
        if (!postDataString) {
            alert("편집할 채팅 기록을 찾을 수 없습니다.");
            window.location.href = 'main.html';
            return;
        }
        currentPost = JSON.parse(postDataString);
        editorTitle.textContent = currentPost.title;

        try {
            const chatData = JSON.parse(currentPost.content);
            if (!Array.isArray(chatData.messages)) throw new Error("Invalid format");

            editorContainer.innerHTML = ''; // 컨테이너 비우기

            chatData.messages.forEach(message => {
                const bubble = createEditableBubble(message);
                editorContainer.appendChild(bubble);
            });
        } catch (error) {
            editorContainer.innerHTML = `<p style="color: red;">채팅 기록을 불러올 수 없습니다. 형식이 올바르지 않을 수 있습니다.</p>`;
        }
    }

    // 편집 가능한 채팅 말풍선 한 개를 만드는 함수
    function createEditableBubble(message) {
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${message.role}-message`;
        bubble.dataset.role = message.role; // 역할을 데이터 속성으로 저장

        const textarea = document.createElement('textarea');
        textarea.className = 'editable-content';
        textarea.value = message.content || '';
        
        // 내용이 입력될 때마다 높이 자동 조절
        textarea.addEventListener('input', autoResizeTextarea);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-bubble-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = '이 메시지 삭제';
        deleteBtn.onclick = () => {
            if (confirm('이 메시지를 삭제하시겠습니까?')) {
                bubble.remove(); // 화면에서 바로 삭제
            }
        };

        bubble.appendChild(textarea);
        bubble.appendChild(deleteBtn);

        // 생성 직후 높이 조절
        setTimeout(() => autoResizeTextarea({ target: textarea }), 0);

        return bubble;
    }

    // Textarea 높이 자동 조절 함수
    function autoResizeTextarea(event) {
        const textarea = event.target;
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }

    // 토스트 알림 함수
    const showToast = message => {
        clearTimeout(toastTimer);
        toastMessage.textContent = message;
        toastNotification.classList.add('show');
        toastTimer = setTimeout(() => { toastNotification.classList.remove('show'); }, 3000);
    };

    // 저장 버튼 클릭 이벤트
    saveBtn.addEventListener('click', async () => {
        const bubbles = editorContainer.querySelectorAll('.message-bubble');
        const newMessages = [];

        bubbles.forEach(bubble => {
            const textarea = bubble.querySelector('.editable-content');
            newMessages.push({
                role: bubble.dataset.role,
                content: textarea.value
            });
        });

        const newContent = JSON.stringify({ messages: newMessages }, null, 2); // 보기 좋게 2칸 들여쓰기

        try {
            await db.collection('posts').doc(currentPost.id).update({ content: newContent });
            
            // 로컬 스토리지도 업데이트
            currentPost.content = newContent;
            localStorage.setItem('currentPost', JSON.stringify(currentPost));

            showToast('성공적으로 저장되었습니다!');
            // 1.5초 후 뷰어 페이지로 복귀
            setTimeout(() => {
                window.location.href = 'chat-viewer.html';
            }, 1500);

        } catch (error) {
            console.error("저장 실패:", error);
            showToast('저장에 실패했습니다.');
        }
    });

    // 뒤로가기 버튼 이벤트
    backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if(confirm('저장하지 않은 내용은 사라집니다. 정말로 돌아가시겠습니까?')) {
            window.location.href = 'chat-viewer.html';
        }
    });
});
