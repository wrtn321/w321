// js/common-script.js (모든 페이지의 공통 스크립트)

document.addEventListener('DOMContentLoaded', () => {

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

});
