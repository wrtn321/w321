// js/script.js (main.html 전용 스크립트)

document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // 페이지 로드 시 인증 상태 확인
    auth.onAuthStateChanged(user => {
        const isAuthPage = document.querySelector('.auth-container') !== null;
        const isMainPage = document.querySelector('.dashboard-container') !== null;

        if (user) {
            if (isAuthPage) { // 로그인 페이지에 있다면 메인으로 이동
                window.location.href = 'main.html';
            }
            if (isMainPage) { // 메인 페이지에 있다면 페이지 설정
                setupMainPage(db, user); 
            }
        } else {
            if (isMainPage) { // 메인 페이지에 있는데 로그아웃 상태면 로그인 페이지로
                window.location.href = 'index.html';
            }
            if (isAuthPage) { // 로그인 페이지에 있다면 인증 폼 설정
                setupAuthPage(auth);
            }
        }
    });
});

// 로그인/회원가입 페이지 설정 함수
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

// 메인 대시보드 페이지 설정 함수
async function setupMainPage(db, user) {
    // 로그아웃 기능
    const logoutButton = document.querySelector('.logout-button');
    if(logoutButton) {
        logoutButton.addEventListener('click', e => {
            e.preventDefault();
            firebase.auth().signOut().catch(error => console.error('로그아웃 에러:', error));
        });
    }

    // 각 카드의 링크 클릭 이벤트
    document.querySelectorAll('.card-header-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const category = link.href.split('=').pop();
            if (category === 'chat') {
                window.location.href = 'chat-list.html';
            } else {
                window.location.href = `list.html?category=${category}`;
            }
        });
    });

    // '새로 만들기' 버튼 클릭 이벤트
    document.querySelectorAll('.new-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const card = button.closest('.card');
            const link = card.querySelector('a');
            const category = link.href.split('=').pop();
            if (category !== 'chat') {
                window.location.href = `post.html?category=${category}&new=true`;
            } else {
                window.location.href = 'chat-list.html';
            }
        });
    });

    // 대시보드에 최근 항목 표시
    try {
        const cards = document.querySelectorAll('.card');
        for (const card of cards) {
            const category = card.querySelector('a').href.split('=').pop();
            const cardBody = card.querySelector('.card-body');
            if (category && cardBody) {
                const items = await getTopItemsForDashboard(db, user.uid, category);
                displayRecentItems(items, category, cardBody);
            }
        }
    } catch (error) {
        console.error("대시보드 로딩 중 에러 발생:", error);
    }
}

// 대시보드 표시용 아이템을 가져오는 함수
async function getTopItemsForDashboard(db, userId, category) {
    const finalPosts = [];
    const rootSnapshot = await db.collection('posts')
        .where('userId', '==', userId)
        .where('category', '==', category)
        .where('parentId', '==', 'root')
        .orderBy('order', 'asc')
        .get();
    
    const rootItems = rootSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    for (const item of rootItems) {
        if (finalPosts.length >= 3) break;
        if (item.type === 'post') {
            finalPosts.push(item);
        } else if (item.type === 'folder') {
            const firstPostInFolderSnapshot = await db.collection('posts')
                .where('userId', '==', userId)
                .where('parentId', '==', item.id)
                .where('type', '==', 'post')
                .orderBy('order', 'asc')
                .limit(1)
                .get();
            if (!firstPostInFolderSnapshot.empty) {
                finalPosts.push({ id: firstPostInFolderSnapshot.docs[0].id, ...firstPostInFolderSnapshot.docs[0].data() });
            }
        }
    }
    return finalPosts;
}

// 가져온 아이템을 화면에 그리는 함수
function displayRecentItems(items, category, container) {
    container.innerHTML = '';
    if (items.length === 0) {
        container.innerHTML = '<p class="no-items-text" style="color:#999; text-align:center; padding:20px 0;">작성된 파일이 없습니다.</p>';
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
                if (category === 'chat') {
                    window.location.href = 'chat-viewer.html';
                } else {
                    window.location.href = 'post.html';
                }
            });
            container.appendChild(link);
        });
    }
}
