

// 이 코드는 페이지의 모든 HTML 요소가 로딩된 후에 실행됩니다.
document.addEventListener('DOMContentLoaded', () => {
    // 현재 페이지가 로그인 페이지(index.html)인지 확인합니다.
    // login-form 클래스를 가진 요소가 있으면 로그인 페이지로 간주합니다.
    const loginForm = document.querySelector('.login-form');
    if (loginForm) {
        setupLoginPage();
    }
    // 현재 페이지가 메인 페이지(main.html)인지 확인합니다.
    // main-header 클래스를 가진 요소가 있으면 메인 페이지로 간주합니다.
    const mainHeader = document.querySelector('.main-header');
    if (mainHeader) {
        setupMainPage();
    }
});

/**
 * 로그인 페이지 (index.html)에 필요한 기능을 설정하는 함수
 */
function setupLoginPage() {
    const loginForm = document.querySelector('.login-form');
    const keywordInput = document.querySelector('.login-form input[type="text"]');
    const authButton = document.querySelector('.auth-button');

    // 1. '들어가기'
    loginForm.addEventListener('submit', (event) => {
        // form의 기본 동작(페이지 새로고침)을 막습니다.
        event.preventDefault();

        const enteredKeyword = keywordInput.value;
        const storedKeyword = localStorage.getItem('userKeyword');

        //저장된 키워드 없으면 알려줍니다.
        if (!storedKeyword) {
            alert('먼저 키워드를 설정해주세요.');
            return;
        }

        // 입력한 키워드와 저장된 키워드가 일치하는지 확인.
        if (enteredKeyword === storedKeyword) {
            // 일치하면, 로그인 상태를 저장하고 메인 페이지로 이동합니다.
            sessionStorage.setItem('isLoggedIn', 'true'); //sessionStorage: 브라우저 탭이 닫히면 사라지는 임시 저장소
            window.location.href = 'main.html';
        } else {
            // 일치하지 않으면 알려줍니다.
            alert('키워드가 올바르지 않습니다.');
            keywordInput.value = ''; //입력창 비우기
        }
    })
 

    // 2. '키워드 설정' 버튼을 눌렀을 때
    authButton.addEventListener('click', () => {
        // prompt 창을 띄워 사용자에게 새 키워드를 입력받습니다.
        const newKeyword = prompt('사용할 새 키워드를 입력하세요.');

        // 사용자가 값을 입력하고 '확인'을 눌렀을 때만 저장합니다.
        if (newKeyword) {
            // localStorage에 'userKeyword'라는 이름으로 키워드 저장.
            localStorage.setItem('userKeyword', newKeyword);
            alert('키워드가 성공적으로 설정되었습니다!');
        }
    })
}

/**
 * 메인 페이지 (main.html)에 필요한 기능을 설정하는 함수
 */

function setupMainPage() {
    //페이지에 들어왔을 때, 정말로 로그인을 한 사용자인지 확인.
    //만약 로그인 상태가 아니면, 주소창에 main.html을 직접 쳐서 들어오는 것을 막기.
    if (sessionStorage.getItem('isLoggedIn') !== 'true') {
        alert('로그인이 필요합니다.');
        window.location.href = 'index.html'; //로그인 페이지로 쫓아내기.
        return;
    }

    const logoutButton = document.querySelector('.logout-button');


    // 3. '로그아웃' 버튼
    logoutButton.addEventListener('click', (event) => {
        event.preventDefault(); // a태그의 기본동작(페이지이동)을 막기.

        // 로그인상태 제거
        sessionStorage.removeItem('isLoggedIn');

        // 로그인 페이지로 이동
        window.location.href = 'index.html';
    });

    // '+ 새로 만들기' 버튼 기능 추후 추가.
    const newButtons = document.querySelectorAll('.new-button');
    newButtons.forEach(button => {
        button.addEventListener('click', () => {
            alert('아직 준비 중인 기능입니다! :)');
        });
    });
}