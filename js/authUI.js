import { UserEmailValue, SignedIn, selectedCustomerDataEntryName, translateCustomerDataEntryName, createAccount, signIn, signOut, signInWithGoogle, checkForGoogleCallback, loadCustomerList, getCustomerListCache, updateCustomerName, requestPasswordReset, deleteAccount, isValidEmail, translateError, initializeCustomerData, convertAnonymousAccount, on, showErrorModal, showInfoModal, showWarningModal, } from "./authService.js";
import { ANONYMOUS_EMAIL } from "./constants.js";
const urlParams = new URLSearchParams(window.location.search);
const usernameParam = urlParams.get("username");
// Initialize DOM references
const userEmail = document.getElementById("userEmail");
const customerButton = document.getElementById("customerButton");
const loginButton = document.getElementById("loginButton");
const signOutButton = document.getElementById("signOutButton");
const loginOverlay = document.getElementById("loginOverlay");
const closeButton = document.querySelector(".close-button");
const loginForm = document.querySelector(".login-form");
const toggleButtons = document.querySelectorAll(".toggle-button");
const modalTitle = document.getElementById("modalTitle");
const submitButton = document.getElementById("submitButton");
const googleButtonText = document.getElementById("googleButtonText");
const githubButtonText = document.getElementById("githubButtonText");
const customerOverlay = document.getElementById("customerOverlay");
const customerSelect = document.getElementById("customerSelect");
const customerNameInput = document.getElementById("customerNameInput");
const updateCustomerButton = document.getElementById("updateCustomerButton");
const accountOverlay = document.getElementById("accountOverlay");
const closeAccountModal = document.getElementById("closeAccountModal");
const deleteAccountButton = document.getElementById("deleteAccountButton");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const passwordResetModal = document.getElementById("passwordResetModal");
const resetEmailDisplay = document.getElementById("resetEmailDisplay");
const sendResetButton = document.getElementById("sendResetButton");
// Initialize customer data
initializeCustomerData();
// Set up event listeners
setupEventListeners();
// Initialize form state (ensure fullName is not required initially)
const fullNameInput = document.getElementById("fullName");
if (fullNameInput) {
    fullNameInput.required = false;
}
// Check for Google OAuth callback
checkForGoogleCallback();
// Set up all event listeners
function setupEventListeners() {
    // Login button
    if (loginButton && loginOverlay) {
        loginButton.addEventListener("click", () => {
            loginOverlay.classList.add("active");
        });
    }
    // Close button
    if (closeButton && loginOverlay) {
        closeButton.addEventListener("click", () => {
            loginOverlay.classList.remove("active");
        });
    }
    // Login overlay close on outside click
    if (loginOverlay) {
        loginOverlay.addEventListener("click", (e) => {
            if (e.target === loginOverlay) {
                loginOverlay.classList.remove("active");
            }
        });
    }
    // Login form submission
    if (loginForm) {
        loginForm.addEventListener("submit", handleLoginFormSubmit);
    }
    // Toggle buttons for signin/signup
    if (toggleButtons) {
        toggleButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const mode = button.getAttribute("data-mode");
                switchMode(mode || "signin");
            });
        });
    }
    on("signInChanged", () => {
        updateSignInUI();
    });
    on("authServiceInitialized", () => {
        updateSignInUI();
    });
    // Google login button
    const googleLoginButton = document.getElementById("googleLoginButton");
    if (googleLoginButton) {
        googleLoginButton.addEventListener("click", handleGoogleLogin);
    }
    // Sign out button
    if (signOutButton) {
        signOutButton.addEventListener("click", signOut);
    }
    // Customer button
    if (customerButton && customerOverlay) {
        customerButton.addEventListener("click", () => {
            customerOverlay.classList.add("active");
            loadCustomerList().then((customerList) => {
                populateCustomerSelect(customerList);
            });
        });
    }
    // Customer overlay events
    if (customerOverlay) {
        customerOverlay.addEventListener("click", (e) => {
            if (e.target === customerOverlay) {
                customerOverlay.classList.remove("active");
            }
        });
        const customerCloseButton = customerOverlay.querySelector(".close-button");
        if (customerCloseButton) {
            customerCloseButton.addEventListener("click", () => {
                customerOverlay.classList.remove("active");
            });
        }
    }
    // Customer selection events
    if (customerSelect) {
        customerSelect.addEventListener("change", handleCustomerSelectChange);
    }
    if (customerNameInput) {
        customerNameInput.addEventListener("input", handleCustomerNameInput);
    }
    if (updateCustomerButton) {
        updateCustomerButton.addEventListener("click", handleUpdateCustomerName);
    }
    // Account management events
    if (userEmail && accountOverlay) {
        userEmail.addEventListener("click", () => {
            if (SignedIn && userEmail.textContent !== ANONYMOUS_EMAIL) {
                accountOverlay.classList.add("active");
            }
        });
    }
    if (closeAccountModal && accountOverlay) {
        closeAccountModal.addEventListener("click", () => {
            accountOverlay.classList.remove("active");
        });
    }
    if (accountOverlay) {
        window.addEventListener("click", (event) => {
            if (event.target === accountOverlay) {
                accountOverlay.classList.remove("active");
            }
        });
    }
    if (deleteAccountButton) {
        deleteAccountButton.addEventListener("click", handleDeleteAccount);
    }
    // Password reset events
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener("click", (e) => {
            e.preventDefault();
            showPasswordResetModal();
        });
    }
    if (passwordResetModal) {
        const resetCloseButton = passwordResetModal.querySelector(".close-button");
        if (resetCloseButton) {
            resetCloseButton.addEventListener("click", () => {
                passwordResetModal.style.display = "none";
            });
        }
        const resetCancelButton = passwordResetModal.querySelector(".cancel-button");
        if (resetCancelButton) {
            resetCancelButton.addEventListener("click", () => {
                passwordResetModal.style.display = "none";
            });
        }
        if (sendResetButton) {
            sendResetButton.addEventListener("click", handlePasswordReset);
        }
    }
}
// Event handlers
async function handleLoginFormSubmit(e) {
    e.preventDefault();
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("loginPassword");
    const fullNameField = document.getElementById("fullNameField");
    const isSignup = document.querySelector(".toggle-button.active")?.dataset.mode === "signup";
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const fullName = fullNameField.style.display !== "none" ? document.getElementById("fullName")?.value.trim() : "";
    let isAnonymousConversion = false;
    if (SignedIn && userEmail.textContent == ANONYMOUS_EMAIL) {
        const signupButton = document.querySelector(".toggle-button[data-mode='signup']");
        if (signupButton) {
            passwordInput.setAttribute("autocomplete", "new-password");
            signupButton.click();
        }
        isAnonymousConversion = true;
    }
    else {
        const signinButton = document.querySelector(".toggle-button[data-mode='signin']");
        if (signinButton) {
            passwordInput.setAttribute("autocomplete", "current-password");
            signinButton.click();
        }
        isAnonymousConversion = false;
    }
    try {
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "מתחבר...";
        }
        if (isSignup) {
            if (isAnonymousConversion) {
                await convertAnonymousAccount(email, password, fullName);
            }
            else {
                await createAccount(email, password, fullName);
            }
            // Show verification message and close login dialog
            showInfoModal("נרשמת בהצלחה! אנא בדוק את תיבת הדואר שלך לקבלת קישור אימות.");
        }
        else {
            await signIn(email, password);
        }
        // Close modal and update UI
        if (loginOverlay) {
            loginOverlay.classList.remove("active");
        }
        updateSignInUI();
    }
    catch (error) {
        console.error("Login failed:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        showErrorModal(translateError(errorMessage));
    }
    finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "התחבר";
        }
    }
}
async function handleGoogleLogin() {
    try {
        await signInWithGoogle();
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        showErrorModal(errorMessage);
    }
}
function handleCustomerSelectChange() {
    if (customerSelect.value === "new") {
        customerNameInput.value = "";
        customerNameInput.focus();
    }
    else {
        customerNameInput.value = customerSelect.value;
        updateCustomerButton.disabled = customerNameInput.value === selectedCustomerDataEntryName;
        // If selecting an existing customer, switch to it immediately
        if (customerSelect.value !== selectedCustomerDataEntryName) {
            // This would need to be handled by the main application
            // For now, just update the UI
            if (customerButton) {
                customerButton.textContent = translateCustomerDataEntryName(customerSelect.value);
            }
        }
    }
}
function handleCustomerNameInput() {
    const inputValue = customerNameInput.value.trim();
    const isEmpty = inputValue === "";
    const isSameAsCurrent = inputValue === selectedCustomerDataEntryName;
    // Check if name already exists (for both new and existing customers)
    let isDuplicate = false;
    const customerListCache = getCustomerListCache();
    if (customerListCache && inputValue) {
        const existingNames = customerListCache.map((customer) => customer.name);
        isDuplicate = existingNames.includes(inputValue);
    }
    updateCustomerButton.disabled = isEmpty || isSameAsCurrent || isDuplicate;
}
async function handleUpdateCustomerName() {
    try {
        await updateCustomerName();
        // Update customer button text
        if (customerButton) {
            customerButton.textContent = translateCustomerDataEntryName(selectedCustomerDataEntryName);
        }
        // Reload files and results with the new customer
        // This would need to be handled by the main application
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        showErrorModal(errorMessage);
    }
}
async function handleDeleteAccount() {
    const confirmed = await showWarningModal("האם אתה בטוח שברצונך למחוק את החשבון וכל הנתונים? פעולה זו אינה הפיכה.");
    if (confirmed) {
        try {
            await deleteAccount();
            accountOverlay.classList.remove("active");
            updateSignInUI();
            // Additional cleanup would be handled by the main application
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            showErrorModal("שגיאה במחיקת החשבון: " + errorMessage);
        }
    }
}
async function handlePasswordReset() {
    const email = resetEmailDisplay.textContent;
    if (!email)
        return;
    try {
        sendResetButton.disabled = true;
        sendResetButton.textContent = "שולח...";
        await requestPasswordReset(email);
        passwordResetModal.style.display = "none";
        showInfoModal("קישור לאיפוס סיסמה נשלח לכתובת הדוא״ל שלך. אנא בדוק את תיבת הדואר שלך.");
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        showErrorModal("שגיאה בשליחת קישור האיפוס: " + errorMessage);
    }
    finally {
        sendResetButton.disabled = false;
        sendResetButton.textContent = "שלח קישור";
    }
}
// UI update functions
export function updateSignInUI() {
    // Check if user is signed in by checking if userEmailValue is not empty and not anonymous
    const isUserSignedIn = UserEmailValue && UserEmailValue !== ANONYMOUS_EMAIL;
    if (isUserSignedIn && userEmail && signOutButton) {
        userEmail.textContent = UserEmailValue;
        signOutButton.disabled = false;
        // Show customer button for logged in users
        if (customerButton) {
            customerButton.style.display = "inline-block";
            customerButton.textContent = translateCustomerDataEntryName(selectedCustomerDataEntryName);
        }
    }
    else if (UserEmailValue === ANONYMOUS_EMAIL && userEmail && signOutButton && loginButton) {
        // Anonymous user
        userEmail.textContent = UserEmailValue;
        signOutButton.disabled = true;
        loginButton.disabled = false;
        // Hide customer button for anonymous users
        if (customerButton) {
            customerButton.style.display = "none";
        }
    }
    else if (userEmail && signOutButton) {
        // Not signed in
        userEmail.textContent = "";
        signOutButton.disabled = true;
        // Hide customer button for logged out users
        if (customerButton) {
            customerButton.style.display = "none";
        }
    }
}
function switchMode(mode) {
    const fullNameField = document.getElementById("fullNameField");
    const fullNameInput = document.getElementById("fullName");
    // Update toggle buttons
    if (toggleButtons) {
        toggleButtons.forEach((button) => {
            button.classList.toggle("active", button.getAttribute("data-mode") === mode);
        });
    }
    // Update modal title and form
    if (mode === "signup" && modalTitle && submitButton && googleButtonText && githubButtonText) {
        modalTitle.textContent = "הרשמה";
        fullNameField.style.display = "block";
        fullNameInput.required = true;
        submitButton.textContent = "הרשם";
        googleButtonText.textContent = "הירשם עם Google";
        githubButtonText.textContent = "הירשם עם GitHub";
    }
    else if (modalTitle && submitButton && googleButtonText && githubButtonText) {
        modalTitle.textContent = "התחברות";
        fullNameField.style.display = "none";
        fullNameInput.required = false;
        submitButton.textContent = "התחבר";
        googleButtonText.textContent = "התחבר עם Google";
        githubButtonText.textContent = "התחבר עם GitHub";
    }
}
// Customer list population
export function populateCustomerSelect(customerData) {
    if (!customerSelect)
        return;
    // Clear existing options
    customerSelect.innerHTML = '<option value="">טוען...</option>';
    if (customerData && customerData.length > 0) {
        customerSelect.innerHTML = '<option value="new">צור לקוח חדש</option>';
        customerData.forEach((customer) => {
            const option = document.createElement("option");
            option.value = customer.name;
            option.textContent = customer.name;
            customerSelect.appendChild(option);
        });
    }
    else {
        customerSelect.innerHTML = '<option value="new">צור לקוח חדש</option>';
    }
}
function showPasswordResetModal() {
    const emailInput = document.getElementById("email");
    const email = emailInput.value.trim();
    if (!email) {
        showErrorModal("אנא הזן כתובת דוא״ל בטופס ההתחברות תחילה");
        return;
    }
    if (!isValidEmail(email)) {
        showErrorModal("כתובת הדוא״ל שהוזנה אינה תקינה");
        return;
    }
    resetEmailDisplay.textContent = email;
    passwordResetModal.style.display = "block";
}
if (usernameParam) {
    // Show the login modal
    //loginOverlay.style.display = "flex";
    loginOverlay.classList.add("active");
    if (SignedIn && userEmail.textContent == ANONYMOUS_EMAIL) {
        document.querySelector(".toggle-button[data-mode='signup']").click();
    }
    else {
        document.querySelector(".toggle-button[data-mode='signin']").click();
    }
    // Get the email input field and set its value
    const emailInput = document.getElementById("email");
    if (emailInput) {
        emailInput.value = usernameParam;
    }
    // Make sure we're in login mode (not register mode)
    const loginToggle = document.querySelector('[data-mode="login"]');
    if (loginToggle) {
        loginToggle.click();
    }
    // Focus on the password field since we already have the email
    const loginPassword = document.getElementById("loginPassword");
    if (loginPassword) {
        loginPassword.focus();
    }
    // remove the username parameter from the url
    const url = new URL(window.location.href);
    url.searchParams.delete("username");
    window.history.replaceState({}, "", url);
}
//# sourceMappingURL=authUI.js.map