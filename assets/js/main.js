

const slides = document.querySelector('.slides');
const slideItems = document.querySelectorAll('.slide');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const dots = document.querySelectorAll('.dot');

let index = 0;

function showSlide(i) {
  index = (i + slideItems.length) % slideItems.length;
  slides.style.transform = `translateX(-${index * 100}%)`;
  dots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === index);
  });
}

nextBtn.addEventListener('click', () => showSlide(index + 1));
prevBtn.addEventListener('click', () => showSlide(index - 1));

dots.forEach((dot, idx) => {
  dot.addEventListener('click', () => showSlide(idx));
});

// 自動再生
setInterval(() => {
  showSlide(index + 1);
}, 5000);
