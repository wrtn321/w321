// editor-script.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Firebase DB 참조 및 전역 변수 설정
    const db = firebase.firestore(); // v8 문법 기준
    let currentPostId = null; // 현재 보고 있는 게시글의 ID를 저장할 변수

    // 1. 필요한 HTML 요소들을 미리 찾아놓습니다.
    const titleInput = document.querySelector('.title-input');
    const contentTextarea = document.querySelector('.content-textarea');
    const editBtn = document.querySelector('.edit-btn');
    const deleteBtn = document.querySelector('.delete-btn');
    const copyBtn = document.querySelector('.copy-btn'); // copyAllBtn -> copyBtn
    const charCounter = document.getElementById('char-counter'); //글자수

    // 2. localStorage에서 데이터 불러와서 채워넣는 함수 수정

    //글자수
    function updateCharCount() {
    const count = contentTextarea.value.length; // .length가 공백 포함 글자 수를 세어줍니다.
    charCounter.textContent = count; // 화면에 숫자만 표시
}

    // 높이를 자동으로 조절하는 함수
function autoResizeTextarea() {
    // 일단 높이를 초기화해서, 글을 지웠을 때도 높이가 줄어들게 만듭니다.
    contentTextarea.style.height = 'auto'; 
    
    // 스크롤이 생기지 않을 만큼의 실제 내용 높이(scrollHeight)를 측정해서
    // textarea의 보이는 높이(height)로 설정해줍니다.
    contentTextarea.style.height = contentTextarea.scrollHeight + 'px';
}


    function loadPostData() {
        const postDataString = localStorage.getItem('currentPost');
        if (postDataString) {
            const postData = JSON.parse(postDataString);
            currentPostId = postData.id;
            titleInput.value = postData.title;
            contentTextarea.value = postData.content;
        } else {
            titleInput.placeholder = "새 글 제목을 입력하세요";
            editBtn.style.display = 'none';
            deleteBtn.style.display = 'none';
        }
        updateCharCount();
        autoResizeTextarea();
    }

    loadPostData();

    // 텍스트 입력시마다 글자수 업데이트
    contentTextarea.addEventListener('input', updateCharCount);
    // 사용자가 입력할 때마다 높이도 자동으로 조절
    contentTextarea.addEventListener('input', autoResizeTextarea);


    // 3. '수정' 버튼 기능 (실제 저장 로직 추가)
    editBtn.addEventListener('click', async () => {
        if (!currentPostId) return; // ID가 없으면 실행하지 않음

        try {
            // posts 컬렉션에서 currentPostId 문서를 찾아 내용 업데이트
            await db.collection('posts').doc(currentPostId).update({
                title: titleInput.value,
                content: contentTextarea.value
            });
            alert('수정되었습니다!');
        } catch (error) {
            console.error("수정 실패:", error);
            alert('수정에 실패했습니다.');
        }
    });

    // 4. '삭제' 버튼 기능 (실제 삭제 로직 추가)
    deleteBtn.addEventListener('click', async () => {
        if (!currentPostId) return;

        const isConfirmed = confirm('정말로 이 게시글을 삭제하시겠습니까?');

        if (isConfirmed) {
            try {
                // posts 컬렉션에서 currentPostId 문서를 삭제
                await db.collection('posts').doc(currentPostId).delete();
                alert('게시글이 삭제되었습니다.');
                window.location.href = 'list.html'; // 목록으로 이동
            } catch (error) {
                console.error("삭제 실패:", error);
                alert('삭제에 실패했습니다.');
            }
        }
    });


    // '전체 복사' 버튼 기능 (선택자만 변경)
copyBtn.addEventListener('click', () => { // copyAllBtn -> copyBtn
    const content = contentTextarea.value;

    if (!content) {
        alert('복사할 내용이 없습니다.');
        return;
    }

    navigator.clipboard.writeText(content)
        .then(() => {
            alert('본문이 클립보드에 복사되었습니다!');
        })
        .catch(err => {
            console.error('복사 실패:', err);
            alert('복사에 실패했습니다. 다시 시도해주세요.');
        });
});

}); // DOMContentLoaded 이벤트 리스너 끝