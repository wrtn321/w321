// js/script.js (main.html 전용 스크립트 - 최종 검수 완료 버전)

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
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const showSignupBtn = document.getElementById('show-signup');
    const showLoginBtn = document.getElementById('show-login');

    if (showSignupBtn && showLoginBtn && loginForm && signupForm) {
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
}

async function setupMainPage(db, user) {
    const tabsCollection = db.collection('tabs');
    let sortableInstance = null;
    let currentEditingTabId = null;

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
    const forceCloseBtn = document.getElementById('force-close-modal-x');

    // --- 데이터 로드 및 렌더링 ---
    async function loadAndRenderTabs() {
        try {
            const snapshot = await tabsCollection.where('userId', '==', user.uid).orderBy('order', 'asc').get();
            dashboardContainer.innerHTML = '';
            if (snapshot.empty) {
                dashboardContainer.innerHTML = '<p style="text-align:center; color:#999; padding: 20px;">탭이 없습니다. 편집 버튼을 눌러 추가해보세요.</p>';
            } else {
                snapshot.docs.forEach(doc => {
                    dashboardContainer.appendChild(createTabCard({ id: doc.id, ...doc.data() }));
                });
            }
        } catch (error) {
            console.error("탭 로딩 실패:", error);
            dashboardContainer.innerHTML = '<p style="color:red; text-align:center;">탭을 불러오는 데 실패했습니다.</p>';
        }
    }

    // --- 카드 1개 생성 함수 ---
    function createTabCard(tabData) {
        const card = document.createElement('section');
        card.className = 'card';
        card.dataset.id = tabData.id;
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
                <div class="card-header"><h2>${tabData.name}</h2><span>></span></div>
            </a>
            <div class="card-body"></div>
            <div class="card-footer"><button type="button" class="new-button">+ 새로 만들기</button></div>
        `;
        card.querySelector('.card-header-link').addEventListener('click', (e) => {
            if (document.body.classList.contains('edit-mode-active')) {
                e.preventDefault();
                editTabName(card);
            }
        });
        card.querySelector('.delete-btn').addEventListener('click', () => deleteTab(tabData.id, tabData.name));
        card.querySelector('.new-button').addEventListener('click', () => {
            if (tabData.type === 'chat-list') window.location.href = 'chat-list.html';
            else window.location.href = `post.html?category=${tabData.categoryKey}&new=true`;
        });
        return card;
    }

    // --- 편집 모드 관련 함수 ---
    function toggleEditMode() {
        document.body.classList.toggle('edit-mode-active');
        const addTabBtn = document.getElementById('add-tab-btn');
        if (document.body.classList.contains('edit-mode-active')) {
            editModeBtn.textContent = '✓';
            if (!addTabBtn) {
                const newBtn = document.createElement('button');
                newBtn.id = 'add-tab-btn';
                newBtn.textContent = '+ 탭 추가';
                newBtn.style.cssText = 'padding: 10px 20px; margin: 20px auto; display: block; border-radius: 8px; border: 1px solid #ccc; cursor: pointer;';
                dashboardContainer.insertAdjacentElement('afterend', newBtn);
                newBtn.addEventListener('click', () => showTabModal());
            }
            initSortable();
        } else {
            editModeBtn.textContent = '✏️';
            if (addTabBtn) addTabBtn.remove();
            if (sortableInstance) {
                sortableInstance.destroy();
                sortableInstance = null;
            }
        }
    }
    
    async function editTabName(card) {
        const currentName = card.dataset.name;
        const newName = prompt("새 탭 이름을 입력하세요.", currentName);
        if (newName && newName.trim() !== '' && newName !== currentName) {
            try {
                await tabsCollection.doc(card.dataset.id).update({ name: newName });
                showToast('탭 이름이 변경되었습니다.');
                await loadAndRenderTabs();
            } catch (error) {
                showToast('이름 변경에 실패했습니다.');
            }
        }
    }

    async function deleteTab(tabId, tabName) {
        if (confirm(`'${tabName}' 탭을 정말 삭제하시겠습니까?\n(연결된 게시물들은 삭제되지 않습니다)`)) {
            try {
                await tabsCollection.doc(tabId).delete();
                showToast('탭이 삭제되었습니다.');
                await loadAndRenderTabs();
            } catch (error) {
                showToast('탭 삭제에 실패했습니다.');
            }
        }
    }
    
    function initSortable() {
        if (sortableInstance) sortableInstance.destroy();
        sortableInstance = new Sortable(dashboardContainer, {
            handle: '.drag-handle',
            animation: 150,
            onEnd: async () => {
                const items = dashboardContainer.querySelectorAll('.card');
                const batch = db.batch();
                items.forEach((item, index) => {
                    batch.update(tabsCollection.doc(item.dataset.id), { order: index });
                });
                try {
                    await batch.commit();
                    showToast('순서가 저장되었습니다.');
                } catch (error) {
                    showToast('순서 저장에 실패했습니다.');
                    await loadAndRenderTabs();
                }
            }
        });
    }

    // --- 모달 제어 함수 ---
    function showTabModal(tabData = null) {
        tabForm.reset();
        if (tabData) {
            modalTitle.textContent = '탭 수정';
            currentEditingTabId = tabData.id;
            tabNameInput.value = tabData.name;
            tabKeyInput.value = tabData.key;
            tabKeyInput.disabled = true;
            tabTypeSelect.value = tabData.type;
        } else {
            modalTitle.textContent = '새 탭 추가';
            currentEditingTabId = null;
            tabKeyInput.disabled = false;
        }
        modal.classList.add('is-visible');
    }
    
    function closeModal() {
        modal.classList.remove('is-visible');
    }

    // --- 이벤트 리스너 중앙 관리 ---
    tabForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tabName = tabNameInput.value;
        const tabKey = tabKeyInput.value;
        const tabType = tabTypeSelect.value;
        if (!currentEditingTabId && !/^[a-z0-9-]+$/.test(tabKey)) {
            alert('고유 키는 영어 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.');
            return;
        }
        const dataToSave = { name: tabName, type: tabType, userId: user.uid };
        try {
            if (currentEditingTabId) {
                await tabsCollection.doc(currentEditingTabId).update({ name: tabName, type: tabType });
            } else {
                const items = dashboardContainer.querySelectorAll('.card');
                dataToSave.order = items.length;
                dataToSave.categoryKey = tabKey;
                await tabsCollection.add(dataToSave);
            }
            closeModal();
            showToast('성공적으로 저장되었습니다.');
            await loadAndRenderTabs();
        } catch (error) {
            console.error('탭 저장 실패:', error);
            showToast('저장에 실패했습니다.');
        }
    });

    cancelTabBtn.addEventListener('click', closeModal);
    if (forceCloseBtn) forceCloseBtn.addEventListener('click', closeModal);
    editModeBtn.addEventListener('click', toggleEditMode);
    logoutButton.addEventListener('click', (e) => { e.preventDefault(); firebase.auth().signOut(); });

    // --- 최초 실행 ---
    loadAndRenderTabs();
}
