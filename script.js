// script.js (진짜 최종 버전!)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // =====================================================
    // 로그인 상태 감시자 (문지기)
    // =====================================================
    auth.onAuthStateChanged(user => {
        const authContainer = document.querySelector('.auth-container');
        // 페이지 종류를 더 명확하게 구분하기 위해 mainHeader 대신 dashboard-container 사용
        const dashboardContainer = document.querySelector('.dashboard-container'); 
        const isAuthPage = authContainer !== null;
        const isProtectedPage = dashboardContainer !== null; // main.html을 특정

        if (user) { // 로그인 상태일 때
            if (isAuthPage) { // 로그인 페이지에 있다면
                window.location.href = 'main.html'; // 메인으로 보낸다
            }
        } else { // 로그아웃 상태일 때
            // main.html 뿐만 아니라, list.html, post.html 같은 모든 내부 페이지를 포함해야 함
            // 따라서 각 파일(list-script.js, editor-script.js)에 있는 보호 코드가 이 역할을 담당.
            // 여기서는 main.html만 체크해도 충분.
            if (isProtectedPage) {
                window.location.href = 'index.html'; // 로그인 페이지로 보낸다
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
    // 이 함수 내용은 이전과 동일하게 유지
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    // ... (이하 모든 인증 페이지 로직은 그대로)
    loginForm.addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        auth.signInWithEmailAndPassword(email, password)
            .catch(error => {
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    alert('이메일 또는 비밀번호가 올바르지 않습니다.');
                } else {
                    alert('로그인에 실패했습니다: ' + error.message);
                }
            });
    });
    // ... (나머지 회원가입, 폼 전환 로직도 그대로)
}


/**
 * 메인 페이지 (main.html) 전용 기능 설정
 */
function setupMainPage(auth) {
    // 로그아웃 버튼 기능
    const logoutButton = document.querySelector('.logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', e => {
            e.preventDefault();
            // signOut().catch()로 에러만 처리. 페이지 이동은 문지기가 담당.
            auth.signOut().catch(error => console.error('로그아웃 에러:', error));
        });
    }

    // '+ 새로 만들기' 버튼 기능
    document.querySelectorAll('.new-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const category = e.target.dataset.category;
            if (category) {
                // 여기도 절대 경로로 바꿔주면 더 안정적입니다.
                window.location.href = `/list.html?category=${category}`;
            }
        });
    });
}