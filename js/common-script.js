// js/common-script.js

document.addEventListener('DOMContentLoaded', () => {

    // '맨 위로 가기' 버튼 로직
    const scrollToTopBtn = document.getElementById('scroll-to-top-btn');

    // 이 페이지에 '맨 위로 가기' 버튼이 없으면, 여기서 스크립트 실행을 중단합니다.
    if (!scrollToTopBtn) {
        return;
    }

    // 1. 스크롤 이벤트를 감지하는 리스너
    window.addEventListener('scroll', () => {
        // window.scrollY는 현재 스크롤된 Y축 위치를 알려줍니다.
        // 화면 높이의 절반(window.innerHeight / 2) 이상 스크롤되면 버튼을 보여줍니다.
        if (window.scrollY > window.innerHeight / 2) {
            scrollToTopBtn.classList.add('show');
        } else {
            scrollToTopBtn.classList.remove('show');
        }
    });

    // 2. 버튼 클릭 이벤트를 감지하는 리스너
    scrollToTopBtn.addEventListener('click', () => {
        // 최상단(top: 0)으로 부드럽게(smooth) 스크롤합니다.
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

});
