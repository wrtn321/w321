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

async function setupMainPage(db, user) {
    const tabsCollection = db.collection('tabs');
    let sortableInstance = null;
    let currentEditingTabId = null; // 새로 추가/수정 중인 탭의 ID를 저장

    // --- HTML 요소 가져오기 ---
    const logoutButton = document.querySelector('.logout-button');
    const dashboardContainer = document.querySelector('.dashboard-container');
    const editModeBtn = document.getElementById('main-edit-mode-btn');
    const modal = document.getElementById('tab-modal');
    const tabForm = document.getElementById('tab-form');
    const modalTitle = document.getElementById('modal-title');
    const tabNameInput = document.getElementById('tab-name');
    const tabKeyInput = document.getElementById('tab-key');
    const tabTypeSelect = document.getElementById('tab-type');
    const cancelTabBtn = document.getElementById('cancel-tab-btn');

    // --- 데이터 로드 및 렌더링 ---
    async function loadAndRenderTabs() {
        try {
            const snapshot = await tabsCollection
                .where('userId', '==', user.uid)
                .orderBy('order', 'asc')
                .get();
            
            dashboardContainer.innerHTML = ''; // 컨테이너 비우기
            if (snapshot.empty) {
                dashboardContainer.innerHTML = '<p style="text-align:center; color:#999;">탭이 없습니다. 편집 버튼을 눌러 추가해보세요.</p>';
            } else {
                snapshot.docs.forEach(doc => {
                    const tabData = { id: doc.id, ...doc.data() };
                    const card = createTabCard(tabData);
                    dashboardContainer.appendChild(card);
                });
            }
        } catch (error) {
            console.error("탭 로딩 실패:", error);
            dashboardContainer.innerHTML = '<p style="color:red;">탭을 불러오는 데 실패했습니다.</p>';
        }
    }

    // --- 카드 1개 생성 함수 ---
    function createTabCard(tabData) {
        const card = document.createElement('section');
        card.className = 'card';
        card.dataset.id = tabData.id; // 문서 ID를 저장
        card.dataset.name = tabData.name;
        card.dataset.key = tabData.categoryKey;
        card.dataset.type = tabData.type;

        const linkUrl = tabData.type === 'chat-list' ? 'chat-list.html' : `list.html?category=${tabData.categoryKey}`;
        
        card.innerHTML = `
            <div class="edit-controls">
                <button class="control-btn drag-handle" title="순서 변경">☰</button>
                <button class="control-btn delete-btn" title="탭 삭제">✕</button>
            </div>
            <a href="${linkUrl}" class="card-header-link">
                <div class="card-header">
                    <h2>${tabData.name}</h2>
                    <span>></span>
                </div>
            </a>
            <div class="card-body">
                <!-- 최근 항목은 추후 추가 -->
            </div>
            <div class="card-footer">
                <button type="button" class="new-button">+ 새로 만들기</button>
            </div>
        `;
        
        // --- 각 카드에 이벤트 리스너 연결 ---
        card.querySelector('.card-header-link').addEventListener('click', (e) => {
            if (document.body.classList.contains('edit-mode-active')) {
                e.preventDefault(); // 편집 모드일 땐 이름 변경
                editTabName(card);
            }
        });

        card.querySelector('.delete-btn').addEventListener('click', () => deleteTab(tabData.id, tabData.name));
        card.querySelector('.new-button').addEventListener('click', (e) => {
            if(tabData.type === 'chat-list') window.location.href = 'chat-list.html';
            else window.location.href = `post.html?category=${tabData.categoryKey}&new=true`;
        });
        
        return card;
    }

    // --- 편집 모드 관련 함수 ---
    function toggleEditMode() {
        document.body.classList.toggle('edit-mode-active');
        if (document.body.classList.contains('edit-mode-active')) {
            editModeBtn.textContent = '✓';
            // ★★★ 편집 모드일 때만 '탭 추가' 버튼이 보이도록 수정 ★★★
            const addTabBtn = document.createElement('button');
            addTabBtn.id = 'add-tab-btn';
            addTabBtn.textContent = '+ 탭 추가';
            addTabBtn.style.cssText = 'padding: 10px 20px; margin: 20px auto; display: block;';
            dashboardContainer.insertAdjacentElement('afterend', addTabBtn);
            addTabBtn.addEventListener('click', () => showTabModal());

            initSortable();
        } else {
            editModeBtn.textContent = '✏️';
            const addTabBtn = document.getElementById('add-tab-btn');
            if (addTabBtn) addTabBtn.remove();
            
            if (sortableInstance) {
                sortableInstance.destroy();
                sortableInstance = null;
            }
        }
    }
    
    // --- 1. 탭 이름 변경 ---
    async function editTabName(card) {
        const currentName = card.dataset.name;
        const newName = prompt("새 탭 이름을 입력하세요.", currentName);
        if (newName && newName.trim() !== '' && newName !== currentName) {
            try {
                await tabsCollection.doc(card.dataset.id).update({ name: newName });
                showToast('탭 이름이 변경되었습니다.');
                loadAndRenderTabs(); // 다시 렌더링
            } catch (error) {
                showToast('이름 변경에 실패했습니다.');
            }
        }
    }

    // --- 2. 탭 삭제 ---
    async function deleteTab(tabId, tabName) {
        if (confirm(`'${tabName}' 탭을 정말 삭제하시겠습니까?\n(연결된 게시물들은 삭제되지 않습니다)`)) {
            try {
                await tabsCollection.doc(tabId).delete();
                showToast('탭이 삭제되었습니다.');
                loadAndRenderTabs();
            } catch (error) {
                showToast('탭 삭제에 실패했습니다.');
            }
        }
    }
    
    // --- 3. 탭 추가 (모달) ---
    function showTabModal(tabData = null) {
        tabForm.reset(); // 폼 초기화
        if (tabData) { // 수정 모드
            modalTitle.textContent = '탭 수정';
            currentEditingTabId = tabData.id;
            tabNameInput.value = tabData.name;
            tabKeyInput.value = tabData.key;
            tabKeyInput.disabled = true; // 고유 키는 수정 불가
            tabTypeSelect.value = tabData.type;
        } else { // 추가 모드
            modalTitle.textContent = '새 탭 추가';
            currentEditingTabId = null;
            tabKeyInput.disabled = false;
        }
        modal.hidden = false;
    }
    
    // --- 4. 탭 순서 변경 (SortableJS) ---
    function initSortable() {
        sortableInstance = new Sortable(dashboardContainer, {
            handle: '.drag-handle',
            animation: 150,
            onEnd: async (evt) => {
                const items = dashboardContainer.querySelectorAll('.card');
                const batch = db.batch();
                items.forEach((item, index) => {
                    const docRef = tabsCollection.doc(item.dataset.id);
                    batch.update(docRef, { order: index });
                });
                try {
                    await batch.commit();
                    showToast('순서가 저장되었습니다.');
                } catch (error) {
                    showToast('순서 저장에 실패했습니다.');
                    loadAndRenderTabs(); // 실패 시 원위치로
                }
            }
        });
    }

     tabForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tabName = tabNameInput.value;
        const tabKey = tabKeyInput.value;
        const tabType = tabTypeSelect.value;

        // 고유 키 유효성 검사 (영어 소문자, 숫자, 하이픈만 허용)
        if (!/^[a-z0-9-]+$/.test(tabKey)) {
            alert('고유 키는 영어 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.');
            return;
        }

        const dataToSave = {
            name: tabName,
            type: tabType,
            userId: user.uid,
        };

        try {
            if (currentEditingTabId) { // 수정일 경우
                // 이름과 타입만 업데이트
                await tabsCollection.doc(currentEditingTabId).update({ name: tabName, type: tabType });
            } else { // 추가일 경우
                // 모든 데이터 저장
                const items = dashboardContainer.querySelectorAll('.card');
                dataToSave.order = items.length; // 맨 마지막 순서로 추가
                dataToSave.categoryKey = tabKey;
                await tabsCollection.add(dataToSave);
            }
            
            modal.hidden = true; // ★★★ 바로 이 부분! 저장이 성공하면 모달을 숨깁니다. ★★★
            showToast('성공적으로 저장되었습니다.');
            loadAndRenderTabs(); // 목록을 새로고침하여 변경사항을 반영합니다.

        } catch (error) {
            console.error('탭 저장 실패:', error);
            showToast('저장에 실패했습니다.');
        }
    });

    // --- 초기 이벤트 리스너 연결 ---
    logoutButton.addEventListener('click', (e) => { e.preventDefault(); firebase.auth().signOut(); });
    editModeBtn.addEventListener('click', toggleEditMode);
    cancelTabBtn.addEventListener('click', () => { modal.hidden = true; });

    // --- 최초 실행 ---
    loadAndRenderTabs();
}

//연결해줘
