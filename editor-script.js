// editor-script.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Firebase DB 참조 및 전역 변수 설정
    const db = firebase.firestore(); // v8 문법 기준
    let currentPostId = null; // 현재 보고 있는 게시글의 ID를 저장할 변수

    // 1. 필요한 HTML 요소들을 미리 찾아놓습니다.
    const titleInput = document.querySelector('.title-input');
    const contentTextarea = document.querySelector('.content-textarea');
    // 클래스 이름이 바뀌었으므로, 새로운 클래스 이름으로 선택합니다.
    const editBtn = document.querySelector('.edit-btn');
    const deleteBtn = document.querySelector('.delete-btn');
    const copyBtn = document.querySelector('.copy-btn'); // copyAllBtn -> copyBtn

    // 2. localStorage에서 데이터 불러와서 채워넣는 함수 수정
    function loadPostData() {
        const postDataString = localStorage.getItem('currentPost');
        if (postDataString) {
            const postData = JSON.parse(postDataString);
            
            // 전역 변수에 현재 게시글 ID 저장!
            currentPostId = postData.id; 
            
            titleInput.value = postData.title;
            contentTextarea.value = postData.content;
            
            // 여기서 삭제하지 않아야 수정/삭제 시 ID를 사용할 수 있습니다.
            // localStorage.removeItem('currentPost'); 
        } else {
            titleInput.placeholder = "새 글 제목을 입력하세요";
            // 새 글일 경우 버튼 일부를 숨기는 것도 좋은 방법입니다.
            editBtn.style.display = 'none';
            deleteBtn.style.display = 'none';
        }
    }

    loadPostData();

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