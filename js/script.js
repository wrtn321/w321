// script.js (메인 화면 동적 로딩 기능이 추가된 최종 버전)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore(); // Firestore 인스턴스 추가

    // =====================================================
    // 로그인 상태 감시자 (문지기)
    // =====================================================
    auth.onAuthStateChanged(user => {
        const isAuthPage = document.querySelector('.auth-container') !== null;
        const isMainPage = document.querySelector('.dashboard-container') !== null;

        if (user) { // 로그인 상태
            if (isAuthPage) {
                window.location.href = 'main.html';
            }
            // ★★★ 메인 페이지라면, 최근 항목을 불러오는 함수를 실행! ★★★
            if (isMainPage) {
                setupMainPage(auth, db, user); 
            }
        } else { // 로그아웃 상태
            if (isMainPage) {
                window.location.href = 'index.html';
            }
            if (isAuthPage) {
                setupAuthPage(auth); // 로그아웃 상태일 때만 로그인/가입 기능 설정
            }
        }
    });
});


/**
 * 인증 페이지 (index.html) 전용 기능
 */
function setupAuthPage(auth) {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const showSignupBtn = document.getElementById('show-signup');
    const showLoginBtn = document.getElementById('show-login');

    showSignupBtn.addEventListener('click', e => { e.preventDefault(); loginForm.hidden = true; signupForm.hidden = false; });
    showLoginBtn.addEventListener('click', e => { e.preventDefault(); loginForm.hidden = false; signupForm.hidden = true; });

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
}


/**
 * 메인 페이지 (main.html) 전용 기능
 */
function setupMainPage(auth, db, user) {
    // 로그아웃 버튼 기능
    const logoutButton = document.querySelector('.logout-button');
    if(logoutButton) {
        logoutButton.addEventListener('click', e => {
            e.preventDefault();
            auth.signOut().catch(error => console.error('로그아웃 에러:', error));
        });
    }

    // 뒤로가기 기록 방지 기능들 (기존 코드 유지)
    document.querySelectorAll('.card-header-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            window.location.replace(link.href);
        });
    });
    document.querySelectorAll('.new-button').forEach(button => {
        button.addEventListener('click', e => {
            const category = button.closest('.card').querySelector('a').href.split('=')[1];
            if (category) {
                const newPostUrl = `post.html?category=${category}&new=true`;
                window.location.replace(newPostUrl);
            }
        });
    });
    
    // ★★★ 핵심 기능: 모든 카드의 최근 항목을 동적으로 불러오기 ★★★
    document.querySelectorAll('.card').forEach(card => {
        const cardBody = card.querySelector('.card-body');
        const category = card.querySelector('a').href.split('=')[1];

        if (cardBody && category) {
            displayRecentItems(db, user, category, cardBody);
        }
    });
}


/**
 * 특정 카테고리의 최근 항목 3개를 불러와 표시하는 함수
 * @param {*} db Firestore 인스턴스
 * @param {*} user 현재 로그인한 사용자 객체
 * @param {string} category 불러올 카테고리 이름
 * @param {HTMLElement} container 표시할 DOM 요소
 */
async function displayRecentItems(db, user, category, container) {
    // 1. 기존에 있던 정적 HTML 내용을 비웁니다.
    container.innerHTML = '';

    try {
        // 2. Firestore에 데이터를 요청하는 쿼리 작성
        const snapshot = await db.collection('posts')
            .where('userId', '==', user.uid)       // 현재 사용자의 글
            .where('category', '==', category)     // 해당 카테고리의 글
            .where('type', '==', 'post')           // ★ 폴더가 아닌 '파일'만
            .orderBy('order')                      // 순서가 빠른 순으로 정렬
            .limit(3)                              // ★ 최대 3개만 가져오기
            .get();

        // 3. 응답 결과에 따라 화면을 그림
        if (snapshot.empty) {
            // 가져온 파일이 하나도 없을 경우
            container.innerHTML = '<p class="no-items-text">작성된 파일이 없습니다.</p>';
        } else {
            // 파일이 있을 경우, 각 파일을 링크(<a>)로 만들어 추가
            snapshot.forEach(doc => {
                const post = { id: doc.id, ...doc.data() };
                const link = document.createElement('a');
                link.href = '#'; // 실제 이동은 클릭 이벤트로 처리
                link.className = 'recent-item';
                link.textContent = post.title;

                // 링크 클릭 시 post.html로 이동하는 기능 추가
                link.addEventListener('click', e => {
                    e.preventDefault();
                    localStorage.setItem('currentPost', JSON.stringify(post));
                    localStorage.setItem('currentCategory', category);
                    window.location.href = 'post.html';
                });
                container.appendChild(link);
            });
        }
    } catch (error) {
        console.error(`${category} 항목 로딩 실패:`, error);
        container.innerHTML = '<p class="no-items-text">항목을 불러오지 못했습니다.</p>';
        // ★ 만약 콘솔에 'failed-precondition' 에러가 뜬다면, 색인이 필요하다는 의미!
        if (error.code === 'failed-precondition') {
             alert(`[개발자 알림]\n'${category}' 카테고리를 표시하기 위한 Firestore 색인이 필요합니다.\n개발자 도구(F12)의 콘솔 에러 메시지에 있는 링크를 클릭하여 색인을 생성해주세요.`);
        }
    }
}