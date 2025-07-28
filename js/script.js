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
async function setupMainPage(auth, db, user) {
    // 로그아웃 버튼 기능 (기존과 동일)
    const logoutButton = document.querySelector('.logout-button');
    if(logoutButton) {
        logoutButton.addEventListener('click', e => {
            e.preventDefault();
            auth.signOut().catch(error => console.error('로그아웃 에러:', error));
        });
    }

    // 카드 헤더(카테고리) 링크 클릭 시
    document.querySelectorAll('.card-header-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            // replace -> href 로 변경하여 뒤로가기 기록을 남깁니다.
            window.location.href = link.href;
        });
    });

    // '+ 새로 만들기' 버튼 클릭 시
    document.querySelectorAll('.new-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const category = button.closest('.card').querySelector('a').href.split('=')[1];
            if (category) {
                const newPostUrl = `post.html?category=${category}&new=true`;
                // replace -> href 로 변경하여 뒤로가기 기록을 남깁니다.
                window.location.href = newPostUrl;
            }
        });
    });
    });
    
     // ========================================================
    // ★★★ 핵심 로직: 모든 데이터를 한 번에 가져와서 처리하기
    // ========================================================
    try {
        // 1. 현재 사용자의 '파일(post)' 타입 문서 전체를 한 번에 가져옵니다.
        const snapshot = await db.collection('posts')
            .where('userId', '==', user.uid)
            .where('type', '==', 'post')
            .orderBy('order') // order 순으로 정렬해서 가져옵니다.
            .get();

        const allPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 2. 모든 카드를 순회하며 각 카드에 맞는 데이터를 전달하고 화면을 그립니다.
        document.querySelectorAll('.card').forEach(card => {
            const cardBody = card.querySelector('.card-body');
            const category = card.querySelector('a').href.split('=')[1];

            if (cardBody && category) {
                // 전체 데이터(allPosts)에서 현재 카드에 해당하는 데이터만 필터링합니다.
                const recentItems = allPosts
                    .filter(post => post.category === category)
                    .slice(0, 3); // 필터링된 결과에서 상위 3개만 자릅니다.

                // 필터링된 데이터를 가지고 화면을 그리는 함수를 호출합니다.
                displayRecentItems(recentItems, category, cardBody);
            }
        });

    } catch (error) {
        console.error("최근 항목 전체 로딩 실패:", error);
        // 전체 로딩 실패 시 모든 카드에 에러 메시지 표시
        document.querySelectorAll('.card-body').forEach(container => {
            container.innerHTML = '<p class="no-items-text">항목을 불러오지 못했습니다.</p>';
        });
        
        if (error.code === 'failed-precondition') {
             alert(`[개발자 알림]\n메인 화면을 표시하기 위한 Firestore 색인이 필요합니다.\n개발자 도구(F12)의 콘솔 에러 메시지에 있는 링크를 클릭하여 색인을 생성해주세요.`);
        }
    }
}


/**
 * ★★★ 이제 이 함수는 Firestore와 통신하지 않고, 받은 데이터를 그리기만 합니다. ★★★
 * @param {Array} items 표시할 게시글 데이터 배열
 * @param {string} category 현재 카테고리 이름
 * @param {HTMLElement} container 표시할 DOM 요소
 */
function displayRecentItems(items, category, container) {
    // 1. 기존 내용을 비웁니다.
    container.innerHTML = '';

    // 2. 받은 데이터에 따라 화면을 그립니다.
    if (items.length === 0) {
        // 표시할 아이템이 하나도 없을 경우
        container.innerHTML = '<p class="no-items-text">작성된 파일이 없습니다.</p>';
    } else {
        // 아이템이 있을 경우, 각 아이템을 링크(<a>)로 만들어 추가
        items.forEach(post => {
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'recent-item';
            link.textContent = post.title;

            link.addEventListener('click', e => {
                e.preventDefault();
                localStorage.setItem('currentPost', JSON.stringify(post));
                localStorage.setItem('currentCategory', category);
                // ★ 이동은 replace가 아닌 일반 href로 해야 뒤로가기가 자연스럽습니다.
                //   main -> list, list -> post 이동은 역사가 남는 것이 좋습니다.
                //   post -> list 로 돌아올 때만 replace를 사용합니다.
                window.location.href = 'post.html';
            });
            container.appendChild(link);
        });
    }
}
