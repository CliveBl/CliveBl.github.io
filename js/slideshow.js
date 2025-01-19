// Slideshow functionality
let currentSlide = 0;
const slides = document.querySelectorAll('.slides img');
const dots = document.querySelectorAll('.dot');

function showSlide(n) {
    // Remove active class from all slides and dots
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));
    
    // Handle wrapping
    currentSlide = n;
    if (currentSlide >= slides.length) currentSlide = 0;
    if (currentSlide < 0) currentSlide = slides.length - 1;
    
    // Show active slide and dot
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
}

// Add click handlers for arrows
document.querySelector('.prev').addEventListener('click', () => {
    showSlide(currentSlide - 1);
});

document.querySelector('.next').addEventListener('click', () => {
    showSlide(currentSlide + 1);
});

// Add click handlers for dots
dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
        showSlide(index);
    });
});

// Auto advance slides every 5 seconds
// setInterval(() => {
//     showSlide(currentSlide + 1);
// }, 5000);

// Show first slide initially
showSlide(0); 