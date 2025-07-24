// script.js (인증 기능 버전)

document.addEventListener('DOMContentLoaded', () => {
    // Firebase Auth 서비스 참조
    const auth = firebase.auth();

    // 현재 페이지가 인증 페이지(index.html)인지 확인
    const authContainer = document.querySelector('.auth-container');
    if (authContainer) {
        setupAuthPage(auth);
    }

    // 현재 페이지가 메인 페이지(main.html)인지 확인
    const mainHeader = document.querySelector('.main-header');
    if (mainHeader) {
        setupMainPage(auth);
    }
});

/**
 * 인증 페이지 (index.html) 기능 설정
 * @param {firebase.auth.Auth} auth - Firebase Auth 서비스 인스턴스
 */
function setupAuthPage(auth) {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const showSignupBtn = document.getElementById('show-signup');
    const showLoginBtn = document.getElementById('show-login');

    // '회원가입' 링크 클릭 시
    showSignupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.hidden = true;
        signupForm.hidden = false;
    });

    // '로그인' 링크 클릭 시
    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.hidden = false;
        signupForm.hidden = true;
    });

    // 회원가입 폼 제출 시
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;

        // Firebase Auth로 새로운 사용자 생성
        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // 회원가입 성공
                console.log('회원가입 성공!', userCredential.user);
                alert('회원가입에 성공했습니다! 로그인 페이지로 이동합니다.');
                // 폼 초기화 및 로그인 폼 보여주기
                signupForm.reset();
                loginForm.hidden = false;
                signupForm.hidden = true;
            })
            .catch((error) => {
                // 회원가입 실패
                console.error('회원가입 에러:', error);
                // 흔한 에러 메시지 번역
                if (error.code === 'auth/email-already-in-use') {
                    alert('이미 사용 중인 이메일입니다.');
                } else if (error.code === 'auth/weak-password') {
                    alert('비밀번호는 6자리 이상이어야 합니다.');
                } else {
                    alert('회원가입에 실패했습니다: ' + error.message);
                }
            });
    });

    // 로그인 폼 제출 시 (일단 비워둠 - 다음 단계에서 구현)
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('로그인 기능은 다음 단계에서 만들 거예요!');
    });
}

/**
 * 메인 페이지 (main.html) 기능 설정
 * @param {firebase.auth.Auth} auth - Firebase Auth 서비스 인스턴스
 */
function setupMainPage(auth) {
    // 이 부분도 다음 단계에서 로그인 상태를 확인하는 코드로 변경될 예정
    const logoutButton = document.querySelector('.logout-button');

    logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        alert('로그아웃 기능도 곧 만들 거예요!');
    });
}