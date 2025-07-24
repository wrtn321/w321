// script.js (인증 최종 버전)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // =====================================================
    // 로그인 상태 감시자 (가장 중요한 부분!)
    // =====================================================
    auth.onAuthStateChanged(user => {
        const authContainer = document.querySelector('.auth-container');
        const mainHeader = document.querySelector('.main-header');

        if (user) {
            // 사용자가 로그인한 상태일 때
            console.log('로그인 상태:', user.email);
            // 만약 인증 페이지(index.html)에 있다면, 메인 페이지로 보낸다 (자동 로그인).
            if (authContainer) {
                window.location.href = 'main.html';
            }
        } else {
            // 사용자가 로그아웃한 상태일 때
            console.log('로그아웃 상태');
            // 만약 인증 페이지가 아닌 다른 페이지에 있다면, 로그인 페이지로 쫓아낸다.
            if (mainHeader) {
                window.location.href = '/index.html';
            }
        }
    });

    // 페이지별 기능 설정
    const authContainer = document.querySelector('.auth-container');
    if (authContainer) {
        setupAuthPage(auth);
    }

    const mainHeader = document.querySelector('.main-header');
    if (mainHeader) {
        setupMainPage(auth);
    }
});


/**
 * 인증 페이지 (index.html) 기능 설정
 */
function setupAuthPage(auth) {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const showSignupBtn = document.getElementById('show-signup');
    const showLoginBtn = document.getElementById('show-login');

    // 폼 전환 기능 (기존과 동일)
    showSignupBtn.addEventListener('click', e => { e.preventDefault(); loginForm.hidden = true; signupForm.hidden = false; });
    showLoginBtn.addEventListener('click', e => { e.preventDefault(); loginForm.hidden = false; signupForm.hidden = true; });

    // 회원가입 폼 제출 (기존과 동일)
    signupForm.addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        auth.createUserWithEmailAndPassword(email, password)
            .then(userCredential => {
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

    // ===== 로그인 폼 제출 기능 구현! =====
    loginForm.addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        // Firebase Auth로 로그인
        auth.signInWithEmailAndPassword(email, password)
            .then(userCredential => {
                // 로그인은 성공하면 onAuthStateChanged 감시자가 알아서 main.html로 보내주므로
                // 여기서는 특별히 할 일이 없습니다.
                console.log('로그인 성공:', userCredential.user.email);
            })
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
 * 메인 페이지 (main.html) 기능 설정
 */
function setupMainPage(auth) {
    const logoutButton = document.querySelector('.logout-button');

    logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        alert('로그아웃 기능도 곧 만들 거예요!');
    });

    // ... '+ 새로 만들기' 버튼 기능
}

/**
 * 메인 페이지 (main.html) 기능 설정
 * @param {firebase.auth.Auth} auth - Firebase Auth 서비스 인스턴스
 */
function setupMainPage(auth) {
    const logoutButton = document.querySelector('.logout-button');

    // ===== 최종 버전 로그아웃 버튼 기능! =====
    logoutButton.addEventListener('click', e => {
        e.preventDefault();
        
        auth.signOut()
            .then(() => {
                // 로그아웃이 성공적으로 완료된 후에 실행됩니다.
                console.log('로그아웃 성공. 로그인 페이지로 이동합니다.');
                // 이제 여기서 직접 페이지를 이동시킵니다.
                window.location.href = '/index.html'; // 404 방지를 위해 절대 경로 사용!
            })
            .catch(error => {
                console.error('로그아웃 에러:', error);
                alert('로그아웃에 실패했습니다.');
            });
    });

    // '+ 새로 만들기' 버튼 기능 (이 부분은 기존과 동일)
    document.querySelectorAll('.new-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const category = e.target.dataset.category;
            if (category) {
                window.location.href = `list.html?category=${category}&new=true`;
            }
        });
    });
}