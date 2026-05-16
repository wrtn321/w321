// js/common-script.js (모든 페이지의 공통 스크립트)

document.addEventListener('DOMContentLoaded', () => {

    const normalizePath = (path) => path.replace(/\\/g, '/');

    window.appNavigate = (url, options = {}) => {
        window.dispatchEvent(new CustomEvent('app:beforeNavigate'));
        if (options.replace) {
            window.location.replace(url);
        } else {
            window.location.href = url;
        }
    };

    /**
     * 토스트(Toast) 알림을 화면에 표시하는 전역 함수
     * @param {string} message - 표시할 메시지 내용
     */
    window.showToast = (message) => {
        const toastNotification = document.getElementById('toast-notification');
        const toastMessage = toastNotification ? toastNotification.querySelector('.toast-message') : null;
        
        if (!toastNotification || !toastMessage) {
            console.warn('Toast notification element not found.');
            return;
        }

        // 기존 타이머가 있다면 초기화
        if (toastNotification.toastTimer) {
            clearTimeout(toastNotification.toastTimer);
        }

        toastMessage.textContent = message;
        toastNotification.classList.add('show');
        
        // 3초 후 자동으로 사라지게 하는 타이머 설정
        toastNotification.toastTimer = setTimeout(() => {
            toastNotification.classList.remove('show');
        }, 3000);
    };


    /**
     * '맨 위로 가기' 버튼 기능 초기화
     */
    const initScrollToTopButton = () => {
        const scrollToTopBtn = document.getElementById('scroll-to-top-btn');
        
        if (!scrollToTopBtn) return; // 버튼이 없는 페이지면 실행 안 함

        // 스크롤 이벤트 감지
        window.addEventListener('scroll', () => {
            // 화면 높이의 절반 이상 스크롤되면 버튼 보이기
            if (window.scrollY > window.innerHeight / 2) {
                scrollToTopBtn.classList.add('show');
            } else {
                scrollToTopBtn.classList.remove('show');
            }
        });

        // 버튼 클릭 이벤트
        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    };

    // '맨 위로 가기' 버튼 기능 실행
    initScrollToTopButton();

     /**
     * '목록으로 가기' 버튼 기능 
     * 현재 페이지 위치에 따라 적절한 이전 페이지로 이동시킵니다.
     */
    const initSmartBackButton = () => {
        const backBtn = document.getElementById('history-back-btn');
        if (!backBtn) return;

        backBtn.addEventListener('click', () => {
            const path = window.location.pathname;
            let targetUrl = null;

            if (path.includes('post.html')) {
                // post.html 에서는 해당 글의 카테고리 목록으로 이동합니다.
                const category = localStorage.getItem('currentCategory');
                if (category) {
                    targetUrl = `list.html?category=${category}`;
                } else {
                    targetUrl = 'main.html'; // 카테고리 정보가 없으면 메인으로
                }
            } else if (path.includes('chat-viewer.html')) {
                // chat-viewer.html 에서는 항상 chat-list.html 로 이동합니다.
                targetUrl = 'chat-list.html';
            } else if (path.includes('list.html') || path.includes('chat-list.html')) {
                // 목록 페이지에서는 main.html 로 이동합니다.
                targetUrl = 'main.html';
            } else {
                // 그 외의 경우, 기존처럼 뒤로가기 기능을 수행합니다.
                history.back();
                return;
            }

            const referrer = document.referrer ? new URL(document.referrer, window.location.href) : null;
            const target = new URL(targetUrl, window.location.href);
            const cameFromTarget = referrer
                && referrer.origin === window.location.origin
                && normalizePath(referrer.pathname) === normalizePath(target.pathname)
                && referrer.search === target.search;

            if (cameFromTarget && history.length > 1) {
                window.dispatchEvent(new CustomEvent('app:beforeNavigate'));
                history.back();
            } else {
                window.appNavigate(targetUrl, { replace: true });
            }
        });
    };

    // '뒤로가기' 버튼 기능 실행
    initSmartBackButton();

});
