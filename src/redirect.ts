import { errorCodeToFaqId, errorCodeToHelpId } from "./constants.js";

function showElement(id: string) {
    const element = document.getElementById(id);
    if (element) {
        element.style.display = 'block';
    }
}

function hideElement(id: string) {
    const element = document.getElementById(id);
    if (element) {
        element.style.display = 'none';
    }
}

(function() {
    try {
        // Get the error code from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const errorCode = '^' + urlParams.get('errorCode');

        if (!errorCode) {
            hideElement('status-redirecting');
            showElement('status-no-code');
            return;
        }

        // Check if error code maps to FAQ
        if (errorCodeToFaqId[errorCode]) {
            const faqId = errorCodeToFaqId[errorCode];
            window.location.href = `faq.html#${faqId}`;
            return;
        }

        // Check if error code maps to Help
        if (errorCodeToHelpId[errorCode]) {
            const helpId = errorCodeToHelpId[errorCode];
            window.location.href = `help.html#${helpId}`;
            return;
        }

        // Error code not found in mappings
        const errorCodeValueElement = document.getElementById('error-code-value');
        if (errorCodeValueElement) {
            errorCodeValueElement.textContent = errorCode;
        }
        hideElement('status-redirecting');
        showElement('status-unknown-code');

    } catch (error) {
        hideElement('status-redirecting');
        showElement('status-error');
        console.error('Redirect error:', error);
    }
})();
