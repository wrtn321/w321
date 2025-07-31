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
    // 로그아웃 기능
    const logoutButton = document.querySelector('.logout-button');
    if(logoutButton) {
        logoutButton.addEventListener('click', e => {
            e.preventDefault();
            firebase.auth().signOut().catch(error => console.error('로그아웃 에러:', error));
        });
    }

    // ★★★ 핵심 수정: 각 카드의 링크 클릭 이벤트 ★★★
    document.querySelectorAll('.card-header-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const category = link.href.split('=').pop(); // href에서 category= 뒤의 값을 추출

            // 카테고리가 'chat'이면 chat-list.html로, 그 외에는 list.html로 이동
            if (category === 'chat') {
                window.location.href = 'chat-list.html';
            } else {
                window.location.href = `list.html?category=${category}`;
            }
        });
    });

    // ★★★ 핵심 수정: '새로 만들기' 버튼 클릭 이벤트 ★★★
    document.querySelectorAll('.new-button').forEach(button => {
        button.addEventListener('click', (e) => {
            // 버튼이 속한 카드의 a 태그에서 카테고리 정보 가져오기
            const card = button.closest('.card');
            const link = card.querySelector('a');
            const category = link.href.split('=').pop();

            // 'chat' 카테고리는 새로 만들기가 없으므로 (JSON 업로드만 있음) 제외
            if (category !== 'chat') {
                // 새 글 작성 페이지로 이동
                window.location.href = `post.html?category=${category}&new=true`;
            } else {
                // 채팅 목록 페이지로 이동해서 사용자가 직접 JSON을 올리도록 유도
                window.location.href = 'chat-list.html';
            }
        });
    });

    // 대시보드에 최근 항목 표시하는 로직 (기존과 동일)
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


// ★★★ 핵심 수정: displayRecentItems 함수 ★★★
function displayRecentItems(items, category, container) {
    container.innerHTML = '';

    if (items.length === 0) {
        container.innerHTML = '<p class="no-items-text">작성된 파일이 없습니다.</p>';
        // no-items-text 클래스에 대한 스타일을 CSS에 추가해주는 것이 좋습니다.
        // 예: .no-items-text { color: #999; text-align: center; padding: 20px 0; }
    } else {
        items.forEach(post => {
            const link = document.createElement('a');
            link.href = '#'; // 링크 기능은 아래 이벤트 리스너가 처리
            link.className = 'recent-item';
            link.textContent = post.title;

            link.addEventListener('click', e => {
                e.preventDefault();
                localStorage.setItem('currentPost', JSON.stringify(post));
                localStorage.setItem('currentCategory', category);
                
                // 여기서도 'chat'과 '그 외'를 구분해서 이동
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
