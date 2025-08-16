// Slideshow functionality
let currentSlide = 0;
const slides = document.querySelectorAll('.slides > *');
const dots = document.querySelectorAll('.dot');
const prevButton = document.querySelector('.prev') as HTMLButtonElement;
const nextButton = document.querySelector('.next') as HTMLButtonElement;
const logoOverlay = document.querySelector('.logo-overlay') as HTMLElement;

// Touch navigation variables
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
const minSwipeDistance = 50; // Minimum distance for a swipe to be registered

// Check if device supports touch events
function isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// Hide/show navigation buttons based on device type
function toggleNavigationButtons() {
    if (isTouchDevice()) {
        // Hide navigation buttons on touch devices
        if (prevButton) prevButton.style.display = 'none';
        if (nextButton) nextButton.style.display = 'none';
    }
}

function showSlide(n: number) {
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

    // Only show logo-overlay for the first slide
    if (logoOverlay) {
        logoOverlay.style.display = currentSlide === 0 ? 'block' : 'none';
    }

    // Only update button states if they are visible (non-touch devices)
    if (!isTouchDevice()) {
        // Disable/enable navigation buttons
        prevButton.disabled = currentSlide === 0;
        nextButton.disabled = currentSlide === slides.length - 1;
        
        // Update button opacity for visual feedback
        prevButton.style.opacity = currentSlide === 0 ? '0.5' : '1';
        nextButton.style.opacity = currentSlide === slides.length - 1 ? '0.5' : '1';
    }
}

// Touch navigation functions
function handleTouchStart(e: Event) {
    const touchEvent = e as TouchEvent;
    touchStartX = touchEvent.changedTouches[0].screenX;
    touchStartY = touchEvent.changedTouches[0].screenY;
}

function handleTouchMove(e: Event) {
    const touchEvent = e as TouchEvent;
    touchEvent.preventDefault(); // Prevent scrolling while swiping
}

function handleTouchEnd(e: Event) {
    const touchEvent = e as TouchEvent;
    touchEndX = touchEvent.changedTouches[0].screenX;
    touchEndY = touchEvent.changedTouches[0].screenY;
    
    handleSwipe();
}

function handleSwipe() {
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    
    // Check if the swipe is more horizontal than vertical
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
        if (deltaX > 0) {
            // Swipe right - go to next slide
            showSlide(currentSlide + 1);
        } else {
            // Swipe left - go to previous slide
            showSlide(currentSlide - 1);
        }
    }
}

// Add touch event listeners for slideshow navigation
function addTouchNavigation() {
    const slideshowContainer = document.querySelector('.slideshow-container');
    if (slideshowContainer) {
        slideshowContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
        slideshowContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
        slideshowContainer.addEventListener('touchend', handleTouchEnd, { passive: false });
    }
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

// Initialize touch navigation
addTouchNavigation();

// Initialize button visibility based on device type
toggleNavigationButtons();

// Show first slide initially
showSlide(0); 