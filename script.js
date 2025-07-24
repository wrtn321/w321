// script.js (최종 정리 버전)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // =====================================================
    // 로그인 상태 감시자 (모든 페이지에 적용)
    // =====================================================
    auth.onAuthStateChanged(user => {
        const authContainer = document.querySelector('.auth-container');
        const mainHeader = document.querySelector('.main-header');

        if (user) {
            console.log('로그인 상태:', user.email);
            if (authContainer) {
                window.location.href = '/main.html';
            }
        } else {
            console.log('로그아웃 상태');
            if (mainHeader) {
                window.location.href = '/index.html';
            }
        }
    });

    // =====================================================
    // 현재 페이지 종류에 따라 필요한 기능만 실행
    // =====================================================
    const authContainer = document.querySelector('.auth-container');
    if (authContainer) {
        setupAuthPage(auth); // 인증 페이지(index.html)라면 이 함수 실행
    }

    const dashboardContainer = document.querySelector('.dashboard-container');
    if (dashboardContainer) {
        setupMainPage(auth); // 메인 페이지(main.html)라면 이 함수 실행
    }
});


/**
 * 인증 페이지 (index.html) 전용 기능 설정
 */
function setupAuthPage(auth) {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const showSignupBtn = document.getElementById('show-signup');
    const showLoginBtn = document.getElementById('show-login');

    // 폼 전환 기능
    showSignupBtn.addEventListener('click', e => { e.preventDefault(); loginForm.hidden = true; signupForm.hidden = false; });
    showLoginBtn.addEventListener('click', e => { e.preventDefault(); loginForm.hidden = false; signupForm.hidden = true; });

    // 회원가입 기능
    signupForm.addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        auth.createUserWithEmailAndPassword(email, password)
            .then(() => {
                alert('회원가입에 성공했습니다! 로그인 해주세요.');
                signupForm.reset();
                loginForm.hidden = false;
                signupForm.hidden = true;
            })
            .catch(error => {
                if (error.code === 'auth/email-already-in-use') alert('이미 사용 중인 이메일입니다.');
                else if (error.code === 'auth/weak-password') alert('비밀번호는 6자리 이상이어야 합니다.');
                else alert('회원가입 실패: ' + error.message);
            });
    });

    // 로그인 기능
    loginForm.addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        auth.signInWithEmailAndPassword(email, password)
            .catch(error => {
                console.error('로그인 에러:', error);
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    alert('이메일 또는 비밀번호가 올바르지 않습니다.');
                } else {
                    alert('로그인에 실패했습니다: ' + error.message);
                }
            });
    });
}


/**
 * 메인 페이지 (main.html) 전용 기능 설정
 */
function setupMainPage(auth) {
    // 로그아웃 버튼 기능
    const logoutButton = document.querySelector('.logout-button');
    logoutButton.addEventListener('click', e => {
        e.preventDefault();
        auth.signOut().catch(error => console.error('로그아웃 에러:', error));
    });

    // '+ 새로 만들기' 버튼 기능
    document.querySelectorAll('.new-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const category = e.target.dataset.category;
            if (category) {
                window.location.href = `/list.html?category=${category}`;
            }
        });
    });
}