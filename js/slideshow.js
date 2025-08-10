"use strict";
// Slideshow functionality
let currentSlide = 0;
const slides = document.querySelectorAll('.slides > *');
const dots = document.querySelectorAll('.dot');
const prevButton = document.querySelector('.prev');
const nextButton = document.querySelector('.next');
const logoOverlay = document.querySelector('.logo-overlay');
function showSlide(n) {
    // Remove active class from all slides and dots
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));
    // Handle wrapping
    currentSlide = n;
    if (currentSlide >= slides.length)
        currentSlide = 0;
    if (currentSlide < 0)
        currentSlide = slides.length - 1;
    // Show active slide and dot
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
    // Only show logo-overlay for the first slide
    if (logoOverlay) {
        logoOverlay.style.display = currentSlide === 0 ? 'block' : 'none';
    }
    // Disable/enable navigation buttons
    prevButton.disabled = currentSlide === 0;
    nextButton.disabled = currentSlide === slides.length - 1;
    // Update button opacity for visual feedback
    prevButton.style.opacity = currentSlide === 0 ? '0.5' : '1';
    nextButton.style.opacity = currentSlide === slides.length - 1 ? '0.5' : '1';
}
// Add click handlers for arrows
prevButton.addEventListener('click', () => {
    showSlide(currentSlide - 1);
});
nextButton.addEventListener('click', () => {
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
//# sourceMappingURL=slideshow.js.map