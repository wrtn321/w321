// script.js (폴더 구조를 올바르게 인식하는 최종 버전)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    auth.onAuthStateChanged(user => {
        const isAuthPage = document.querySelector('.auth-container') !== null;
        const isMainPage = document.querySelector('.dashboard-container') !== null;

        if (user) {
            if (isAuthPage) {
                window.location.href = 'main.html';
            }
            if (isMainPage) {
                setupMainPage(db, user); 
            }
        } else {
            if (isMainPage) {
                window.location.href = 'index.html';
            }
            if (isAuthPage) {
                setupAuthPage(auth);
            }
        }
    });
});

function setupAuthPage(auth) {
    // 이 함수는 수정할 필요가 없습니다. (기존 코드 그대로)
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
 * ★★★ 메인 페이지 (main.html)의 핵심 로직 (수정됨) ★★★
 */
async function setupMainPage(db, user) {
    // 로그아웃 및 버튼 기능
    const logoutButton = document.querySelector('.logout-button');
    if(logoutButton) {
        logoutButton.addEventListener('click', e => {
            e.preventDefault();
            firebase.auth().signOut().catch(error => console.error('로그아웃 에러:', error));
        });
    }
    document.querySelectorAll('.card-header-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = link.href;
        });
    });
    document.querySelectorAll('.new-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const category = button.closest('.card').querySelector('a').href.split('=')[1];
            if (category) {
                window.location.href = `post.html?category=${category}&new=true`;
            }
        });
    });

    try {
        const cards = document.querySelectorAll('.card');
        
        // 모든 카드를 순회하며 각각에 맞는 데이터를 비동기적으로 가져와 채웁니다.
        for (const card of cards) {
            const category = card.querySelector('a').href.split('=')[1];
            const cardBody = card.querySelector('.card-body');
            if (category && cardBody) {
                // 각 카테고리별로 올바른 순서의 상위 3개 아이템을 가져오는 함수 호출
                const items = await getTopItemsForDashboard(db, user.uid, category);
                // 가져온 아이템을 화면에 그리는 함수 호출
                displayRecentItems(items, category, cardBody);
            }
        }
    } catch (error) {
        console.error("대시보드 로딩 중 에러 발생:", error);
         if (error.code === 'failed-precondition') {
             alert(`[개발자 알림]\nFirestore 색인이 필요합니다.\n개발자 도구(F12)의 콘솔 에러 메시지에 있는 링크를 클릭하여 색인을 생성해주세요.`);
        }
    }
}

/**
 * ★★★ 대시보드 표시용 아이템을 올바른 순서로 가져오는 새 함수 ★★★
 */
async function getTopItemsForDashboard(db, userId, category) {
    const finalPosts = [];

    // 1단계: 최상위 아이템들 (폴더와 파일)을 순서대로 모두 가져옵니다.
    const rootSnapshot = await db.collection('posts')
        .where('userId', '==', userId)
        .where('category', '==', category)
        .where('parentId', '==', 'root')
        .orderBy('order', 'asc')
        .get();
    
    const rootItems = rootSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 2단계: 최상위 아이템들을 순서대로 탐색하며 최종 표시할 파일 3개를 찾습니다.
    for (const item of rootItems) {
        // 이미 3개를 다 찾았다면 루프를 중단합니다.
        if (finalPosts.length >= 3) {
            break;
        }

        if (item.type === 'post') {
            // 아이템이 파일이면 바로 결과에 추가합니다.
            finalPosts.push(item);
        } else if (item.type === 'folder') {
            // 아이템이 폴더이면, 그 안에서 가장 순서가 빠른 파일 1개를 찾습니다.
            const firstPostInFolderSnapshot = await db.collection('posts')
                .where('userId', '==', userId)
                .where('parentId', '==', item.id) // 이 폴더의 ID를 부모로 갖는
                .where('type', '==', 'post')      // 파일 중에서
                .orderBy('order', 'asc')          // 가장 순서가 빠른
                .limit(1)                         // 1개만 가져옵니다.
                .get();
            
            if (!firstPostInFolderSnapshot.empty) {
                // 폴더 안에 파일이 있다면, 그 파일을 결과에 추가합니다.
                const firstPost = { id: firstPostInFolderSnapshot.docs[0].id, ...firstPostInFolderSnapshot.docs[0].data() };
                finalPosts.push(firstPost);
            }
        }
    }
    
    // 최종적으로 찾은 파일 목록을 반환합니다. (최대 3개)
    return finalPosts;
}


/**
 * ★★★ 화면에 그리는 함수 (이 함수는 수정할 필요가 없습니다) ★★★
 */
function displayRecentItems(items, category, container) {
    container.innerHTML = '';

    if (items.length === 0) {
        container.innerHTML = '<p class="no-items-text">작성된 파일이 없습니다.</p>';
    } else {
        items.forEach(post => {
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'recent-item';
            link.textContent = post.title;

            link.addEventListener('click', e => {
                e.preventDefault();
                localStorage.setItem('currentPost', JSON.stringify(post));
                localStorage.setItem('currentCategory', category);
                window.location.href = 'post.html';
            });
            container.appendChild(link);
        });
    }
}
