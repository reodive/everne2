window.addEventListener('load', () => {
  // Splash fade-out
  const splash = document.getElementById('splash');
  if (splash) {
    setTimeout(()=> splash.classList.add('hide'), 1200); // 少し長めに表示してからフェード
  }
  const wrapper = document.querySelector('.showcase-wrapper');
  const slides = document.querySelector('.slides');
  const slideItems = Array.from(document.querySelectorAll('.slide'));
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const dots = Array.from(document.querySelectorAll('.dot'));

  if (!wrapper || !slides || slideItems.length === 0) return;

  let index = 0;
  let slideWidth = 0;

  function layout() {
    // 実測幅で1枚の幅を固定し、総幅も設定
    slideWidth = Math.round(wrapper.getBoundingClientRect().width);
    slideItems.forEach(el => { el.style.minWidth = slideWidth + 'px'; el.style.flex = `0 0 ${slideWidth}px`; });
    slides.style.width = (slideWidth * slideItems.length) + 'px';
    applyTransform(false); // 初回はジャンプで適用
  }

  function applyTransform(animate = true) {
    if (!animate) slides.style.transition = 'none';
    slides.style.transform = `translate3d(${-index * slideWidth}px, 0, 0)`;
    if (!animate) requestAnimationFrame(() => { slides.style.transition = ''; });
  }

  function showSlide(i) {
    index = (i + slideItems.length) % slideItems.length;
    applyTransform(true);
    dots.forEach((dot, idx) => dot.classList.toggle('active', idx === index));
  }

  // イベント
  window.addEventListener('resize', layout);
  if (nextBtn) nextBtn.addEventListener('click', () => showSlide(index + 1));
  if (prevBtn) prevBtn.addEventListener('click', () => showSlide(index - 1));
  dots.forEach((dot, idx) => dot.addEventListener('click', () => showSlide(idx)));

  // 初期レイアウト
  layout();

  // debug hooks
  window.__slider = {
    layout,
    state: () => ({ index, slideWidth, count: slideItems.length, wrapper: wrapper.clientWidth }),
    next: () => showSlide(index + 1),
    prev: () => showSlide(index - 1)
  };

  // 自動再生（任意）
  setInterval(() => {
    showSlide(index + 1);
  }, 5000);
});
