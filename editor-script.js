// 페이지의 모든 HTML 요소가 로딩된 후에 실행되도록 합니다.
document.addEventListener('DOMContentLoaded', () => {

    // =====================================================
    // 1. 필요한 HTML 요소들을 미리 찾아놓습니다.
    // =====================================================
    const titleInput = document.querySelector('.title-input');
    const contentTextarea = document.querySelector('.content-textarea');
    const editBtn = document.querySelector('.edit-btn');
    const deleteBtn = document.querySelector('.delete-btn');
    const copyAllBtn = document.querySelector('.copy-all-btn');


    // =====================================================
    // 2. 페이지 로드 시, localStorage에서 데이터 불러와서 채워넣기
    // =====================================================
    
    // 페이지가 열렸을 때, 목록 페이지에서 보낸 데이터를 확인하고 화면에 표시하는 함수
    function loadPostData() {
        // 1. localStorage에서 'currentPost' 라는 이름으로 저장된 데이터를 가져옵니다.
        const postDataString = localStorage.getItem('currentPost');

        // 2. 데이터가 존재한다면(즉, 목록에서 게시글을 클릭해서 넘어왔다면)
        if (postDataString) {
            // 3. 가져온 JSON 문자열을 다시 JavaScript 객체로 변환합니다.
            const postData = JSON.parse(postDataString);

            // 4. 제목과 본문 입력창에 값을 채워넣습니다.
            titleInput.value = postData.title;
            contentTextarea.value = postData.content;
            
            // (중요) 한 번 사용한 임시 데이터는 localStorage에서 삭제합니다.
            // 이렇게 해야, 그냥 post.html 페이지만 새로고침했을 때
            // 이전에 봤던 글 내용이 다시 나타나는 것을 방지할 수 있습니다.
            localStorage.removeItem('currentPost');
        } else {
            // 데이터가 없다면 (예: 주소창에 post.html을 직접 쳐서 들어온 경우)
            // 그냥 비어있는 새 글 작성 화면을 보여줍니다.
            titleInput.placeholder = "새 글 제목을 입력하세요";
        }
    }

    // 페이지가 로드되면 loadPostData 함수를 즉시 실행해서 데이터를 채워넣습니다.
    loadPostData();


    // =====================================================
    // 3. 각 버튼에 클릭 이벤트 리스너 추가
    // =====================================================

    // '수정' 버튼 기능
    editBtn.addEventListener('click', () => {
        // 나중에 Firebase를 연동하면 이 부분에 실제 저장 코드가 들어갑니다.
        alert('수정(저장)되었습니다!');
    });


    // '삭제' 버튼 기능
    deleteBtn.addEventListener('click', () => {
        const isConfirmed = confirm('정말로 이 게시글을 삭제하시겠습니까?');

        if (isConfirmed) {
            // (나중에 여기에 Firebase에서 데이터를 삭제하는 코드가 추가됩니다.)
            alert('게시글이 삭제되었습니다.');
            window.location.href = 'list.html';
        }
    });


    // '전체 복사' 버튼 기능
    copyAllBtn.addEventListener('click', () => {
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