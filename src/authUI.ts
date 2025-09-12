import {
  UserRole,
  UserEmailValue,
  SignedIn,
  selectedCustomerDataEntryName,
  translateCustomerDataEntryName,
  createAccount,
  signIn,
  signOut,
  signInWithGoogle,
  checkForGoogleCallback,
  loadCustomerList,
  getCustomerListCache,
  updateCustomerName,
  updateSelectedCustomer,
  requestPasswordReset,
  deleteAccount,
  isValidEmail,
  translateError,
  initializeCustomerData,
  convertAnonymousAccount,
  on,
  showErrorModal,
  showInfoModal,
  showWarningModal,
  DEFAULT_CUSTOMER_DATA_ENTRY_NAME,
  isTermsAccepted,
  duplicateCustomerDataEntry,
  deleteCustomer,
  customerListCacheLength,
  createAPIKey,
  revokeAPIKey,
} from "./authService.js";

import { ANONYMOUS_EMAIL, debug } from "./constants.js";

const urlParams = new URLSearchParams(window.location.search);
const usernameParam = urlParams.get("username");

// Initialize DOM references
const userEmail = document.getElementById("userEmail") as HTMLSpanElement;
const accountManagementButton = document.getElementById("accountManagementButton") as HTMLButtonElement;
const customerButton = document.getElementById("customerButton") as HTMLButtonElement;
const loginButton = document.getElementById("loginButton") as HTMLButtonElement;
const signOutButton = document.getElementById("signOutButton") as HTMLButtonElement;
const loginOverlay = document.getElementById("loginOverlay") as HTMLDivElement;
const closeButton = document.querySelector(".close-button") as HTMLButtonElement;
const loginForm = document.querySelector(".login-form") as HTMLFormElement;
const toggleButtons = document.querySelectorAll(".toggle-button") as NodeListOf<HTMLButtonElement>;
const modalTitle = document.getElementById("modalTitle") as HTMLHeadingElement;
const loginSubmitButton = document.getElementById("loginSubmitButton") as HTMLButtonElement;
const googleButtonText = document.getElementById("googleButtonText") as HTMLSpanElement;
const githubButtonText = document.getElementById("githubButtonText") as HTMLSpanElement;
const customerOverlay = document.getElementById("customerOverlay") as HTMLDivElement;
const customerSelect = document.getElementById("customerSelect") as HTMLSelectElement;
const customerNameInput = document.getElementById("customerNameInput") as HTMLInputElement;
const updateCustomerButton = document.getElementById("updateCustomerButton") as HTMLButtonElement;
const accountOverlay = document.getElementById("accountOverlay") as HTMLDivElement;
const closeAccountModal = document.getElementById("closeAccountModal") as HTMLSpanElement;
const deleteAccountButton = document.getElementById("deleteAccountButton") as HTMLButtonElement;
const forgotPasswordLink = document.getElementById("forgotPasswordLink") as HTMLAnchorElement;
const passwordResetModal = document.getElementById("passwordResetModal") as HTMLDivElement;
const resetEmailDisplay = document.getElementById("resetEmailDisplay") as HTMLSpanElement;
const sendResetButton = document.getElementById("sendResetButton") as HTMLButtonElement;
const createApiKeyButton = document.getElementById("createApiKeyButton") as HTMLButtonElement;
const revokeApiKeyButton = document.getElementById("revokeApiKeyButton") as HTMLButtonElement;
const apiSection = document.getElementById("apiSection") as HTMLDivElement;
const apiKeyDisplayModal = document.getElementById("apiKeyDisplayModal") as HTMLDivElement;
const apiKeyDisplay = document.getElementById("apiKeyDisplay") as HTMLInputElement;
const copyApiKeyButton = document.getElementById("copyApiKeyButton") as HTMLButtonElement;
const closeApiKeyDisplay = document.getElementById("closeApiKeyDisplay") as HTMLButtonElement;
const userRoleSpan = document.getElementById("userRole") as HTMLSpanElement;

// Initialize customer data
initializeCustomerData();

// Set up event listeners
setupEventListeners();

// Initialize form state (ensure fullName is not required initially)
const fullNameInput = document.getElementById("fullName") as HTMLInputElement;
if (fullNameInput) {
  fullNameInput.required = false;
}

// Check for Google OAuth callback
checkForGoogleCallback();

// Set up all event listeners
function setupEventListeners(): void {
  // Listen for terms acceptance events
  on("termsAcceptedChanged", () => {
    updateLoginButtonState();
  });

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

  on("selectedCustomerChanged", () => {
    // Update the customer button text
    customerButton.textContent = translateCustomerDataEntryName(selectedCustomerDataEntryName);
  });

  // Google login button
  const googleLoginButton = document.getElementById("googleLoginButton") as HTMLButtonElement;
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
        updateCustomerButton.innerHTML = "צור";
        updateCustomerButton.disabled = true;
        customerNameInput.disabled = false;
        customerNameInput.value = "";
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

    const customerCloseButton = customerOverlay.querySelector(".close-button") as HTMLButtonElement;
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
    updateCustomerButton.addEventListener("click", handleUpdateCustomer);
  }

  // Account management events
  if (accountManagementButton && accountOverlay) {
    accountManagementButton.addEventListener("click", () => {
      if (SignedIn && userEmail.textContent !== ANONYMOUS_EMAIL) {
        accountOverlay.classList.add("active");
        deleteConfirmationInput.value = "";
        deleteAccountButton.disabled = true;
        userRoleSpan.textContent = "פרופיל: ";
        if (UserRole === "ROLE_ADMIN") {
          userRoleSpan.textContent += "מנהל";
        } else if (UserRole === "ROLE_USER") {
          userRoleSpan.textContent += "סטנדרטי";
        } else if (UserRole === "ROLE_API") {
          userRoleSpan.textContent += "מפתח API";
        } else if (UserRole === "ROLE_PRO") {
          userRoleSpan.textContent += "מקצועי";
        } else {
          userRoleSpan.textContent += "לא ידוע";
        }
      }
    });
  }

  if (closeAccountModal && accountOverlay) {
    closeAccountModal.addEventListener("click", () => {
      accountOverlay.classList.remove("active");
    });
  }

  if (deleteAccountButton) {
    deleteAccountButton.addEventListener("click", handleDeleteAccount);
  }

  function handleDeleteConfirmationInput(): void {
    const deleteConfirmationInput = document.getElementById("deleteConfirmationInput") as HTMLInputElement;
    if (deleteConfirmationInput && deleteAccountButton) {
      const inputValue = deleteConfirmationInput.value.trim();
      deleteAccountButton.disabled = inputValue !== "DELETE";
    }
  }

  // Delete confirmation input event listeners - mobile-friendly with multiple event types
  const deleteConfirmationInput = document.getElementById("deleteConfirmationInput") as HTMLInputElement;
  if (deleteConfirmationInput) {
    // Listen to multiple events for better mobile support
    deleteConfirmationInput.addEventListener("input", handleDeleteConfirmationInput);
  }

  // Password reset events
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (e) => {
      e.preventDefault();
      showPasswordResetModal();
    });
  }

  if (passwordResetModal) {
    const resetCloseButton = passwordResetModal.querySelector(".close-button") as HTMLSpanElement;
    if (resetCloseButton) {
      resetCloseButton.addEventListener("click", () => {
        passwordResetModal.style.display = "none";
      });
    }

    const resetCancelButton = passwordResetModal.querySelector(".cancel-button") as HTMLButtonElement;
    if (resetCancelButton) {
      resetCancelButton.addEventListener("click", () => {
        passwordResetModal.style.display = "none";
      });
    }

    if (sendResetButton) {
      sendResetButton.addEventListener("click", handlePasswordReset);
    }
  }

  // API key creation events
  if (createApiKeyButton) {
    createApiKeyButton.addEventListener("click", async () => {
      const confirmed = await showWarningModal("שים לב: יצירת מפתח API חדש תחליף את המפתח הקיים שלך. המפתח הישן לא יעבוד יותר לאחר יצירת המפתח החדש. האם אתה בטוח שברצונך להמשיך?");
      if (confirmed) {
        await handleCreateApiKey();
      }
    });
  }

  // API key revocation events
  if (revokeApiKeyButton) {
    revokeApiKeyButton.addEventListener("click", async () => {
      const confirmed = await showWarningModal("שים לב: ביטול מפתח API יגרום לכך שהמפתח הנוכחי לא יעבוד יותר. האם אתה בטוח שברצונך לבטל את המפתח?");
      if (confirmed) {
        await handleRevokeApiKey();
      }
    });
  }

  // API key display modal events
  if (apiKeyDisplayModal) {
    const apiKeyDisplayCloseButton = apiKeyDisplayModal.querySelector(".close-button") as HTMLSpanElement;
    if (apiKeyDisplayCloseButton) {
      apiKeyDisplayCloseButton.addEventListener("click", () => {
        apiKeyDisplayModal.style.display = "none";
      });
    }

    if (closeApiKeyDisplay) {
      closeApiKeyDisplay.addEventListener("click", () => {
        apiKeyDisplayModal.style.display = "none";
      });
    }

    if (copyApiKeyButton) {
      copyApiKeyButton.addEventListener("click", handleCopyApiKey);
    }
  }
}

// Event handlers
async function handleLoginFormSubmit(e: Event): Promise<void> {
  e.preventDefault();

  const emailInput = document.getElementById("email") as HTMLInputElement;
  const passwordInput = document.getElementById("loginPassword") as HTMLInputElement;
  const fullNameField = document.getElementById("fullNameField") as HTMLDivElement;
  const isSignup = (document.querySelector(".toggle-button.active") as HTMLButtonElement)?.dataset.mode === "signup";

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const fullName = fullNameField.style.display !== "none" ? (document.getElementById("fullName") as HTMLInputElement)?.value.trim() : "";

  let isAnonymousConversion = false;
  if (SignedIn && userEmail.textContent == ANONYMOUS_EMAIL) {
    const signupButton = document.querySelector(".toggle-button[data-mode='signup']") as HTMLButtonElement;
    if (signupButton) {
      passwordInput.setAttribute("autocomplete", "new-password");
      signupButton.click();
    }
    isAnonymousConversion = true;
  } else {
    const signinButton = document.querySelector(".toggle-button[data-mode='signin']") as HTMLButtonElement;
    if (signinButton) {
      passwordInput.setAttribute("autocomplete", "current-password");
      signinButton.click();
    }
    isAnonymousConversion = false;
  }

  try {
    if (loginSubmitButton) {
      loginSubmitButton.disabled = true;
      loginSubmitButton.textContent = "מתחבר...";
    }

    if (isSignup) {
      if (isAnonymousConversion) {
        await convertAnonymousAccount(email, password, fullName);
      } else {
        await createAccount(email, password, fullName);
      }
      // Show verification message and close login dialog
      showInfoModal("נרשמת בהצלחה! אנא בדוק את תיבת הדואר שלך לקבלת קישור אימות.");
    } else {
      await signIn(email, password);
    }

    // Close modal and update UI
    if (loginOverlay) {
      loginOverlay.classList.remove("active");
    }
    updateSignInUI();
  } catch (error) {
    console.error("Login failed:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    showErrorModal(translateError(errorMessage));
  } finally {
    if (loginSubmitButton) {
      loginSubmitButton.disabled = false;
      loginSubmitButton.textContent = "התחבר";
    }
  }
}

async function handleGoogleLogin(): Promise<void> {
  try {
    await signInWithGoogle();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showErrorModal(errorMessage);
  }
}

function handleCustomerSelectChange(): void {
  if (customerSelect.value === "new" || customerSelect.value === "duplicate") {
    customerNameInput.value = "";
    customerNameInput.focus();
    updateCustomerButton.disabled = true;
    customerNameInput.disabled = false;
    updateCustomerButton.innerHTML = "צור";
  } else if (customerSelect.value === "delete") {
    customerNameInput.value = selectedCustomerDataEntryName;
    updateCustomerButton.disabled = false;
    updateCustomerButton.innerHTML = "מחק";
    customerNameInput.disabled = true;
  } else {
    customerNameInput.value = customerSelect.value;
    updateCustomerButton.disabled = customerNameInput.value === selectedCustomerDataEntryName;
    customerNameInput.disabled = false;
    updateCustomerButton.innerHTML = "עדכן";
    // If selecting an existing customer, switch to it immediately
    if (customerSelect.value !== selectedCustomerDataEntryName) {
      updateSelectedCustomer(customerSelect.value);
      // Dismiss the customer overlay
      customerOverlay.classList.remove("active");
    }
  }
}

function handleCustomerNameInput(): void {
  const inputValue = customerNameInput.value.trim();
  const isEmpty = inputValue === "";
  const isSameAsCurrent = inputValue === selectedCustomerDataEntryName;

  // Check if name already exists (for both new and existing customers)
  let isDuplicate = false;
  const customerListCache = getCustomerListCache();
  if (customerListCache && inputValue) {
    const existingNames = customerListCache.map((customer: { name: string }) => customer.name);
    isDuplicate = existingNames.includes(inputValue);
  }

  updateCustomerButton.disabled = isEmpty || isSameAsCurrent || isDuplicate;
}

async function handleUpdateCustomer(): Promise<void> {
  try {
    if (customerSelect.value === "duplicate") {
      await duplicateCustomerDataEntry(customerNameInput.value.trim());
    } else if (customerSelect.value === "delete") {
      await deleteCustomer(customerNameInput.value.trim());
      // Update to the next one in the list
      if (customerListCacheLength() > 0) {
        updateSelectedCustomer(getCustomerListCache()![0].name);
      } else {
        updateSelectedCustomer(DEFAULT_CUSTOMER_DATA_ENTRY_NAME);
      }
    } else if (customerSelect.value === "new") {
      await updateCustomerName("", customerNameInput.value.trim());
    } else {
      await updateCustomerName(selectedCustomerDataEntryName, customerNameInput.value.trim());
    }
    // Update customer button text
    if (customerButton) {
      customerButton.textContent = translateCustomerDataEntryName(selectedCustomerDataEntryName);
    }
    // Reload files and results with the new customer
    // This would need to be handled by the main application
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showErrorModal(errorMessage);
  }
}

async function handleDeleteAccount(): Promise<void> {
  const confirmed = await showWarningModal("האם אתה בטוח שברצונך למחוק את החשבון וכל הנתונים? פעולה זו אינה הפיכה.");

  if (confirmed) {
    try {
      await deleteAccount();
      accountOverlay.classList.remove("active");
      updateSignInUI();
      // Additional cleanup would be handled by the main application
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      showErrorModal("שגיאה במחיקת החשבון: " + errorMessage);
    }
  }
}

async function handlePasswordReset(): Promise<void> {
  const email = resetEmailDisplay.textContent;
  if (!email) return;

  try {
    sendResetButton.disabled = true;
    sendResetButton.textContent = "שולח...";

    await requestPasswordReset(email);

    passwordResetModal.style.display = "none";
    showInfoModal("קישור לאיפוס סיסמה נשלח לכתובת הדוא״ל שלך. אנא בדוק את תיבת הדואר שלך.");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showErrorModal("שגיאה בשליחת קישור האיפוס: " + errorMessage);
  } finally {
    sendResetButton.disabled = false;
    sendResetButton.textContent = "שלח קישור";
  }
}

// API key functions
async function handleCreateApiKey(): Promise<void> {
  try {
    // Call the service function to create a new API key
    const apiKey = await createAPIKey();

    // Display the API key in the display modal
    if (apiKeyDisplay && apiKeyDisplayModal) {
      apiKeyDisplay.value = apiKey;
      apiKeyDisplayModal.style.display = "block";
    }

    // Close the account modal as well
    if (accountOverlay) {
      accountOverlay.classList.remove("active");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showErrorModal("שגיאה ביצירת מפתח API: " + errorMessage);
  }
}

async function handleRevokeApiKey(): Promise<void> {
  try {
    // Call the service function to revoke the current API key
    await revokeAPIKey();

    // Show success message
    showInfoModal("מפתח API בוטל בהצלחה!");

    // Close the account modal
    if (accountOverlay) {
      accountOverlay.classList.remove("active");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    showErrorModal("שגיאה בביטול מפתח API: " + errorMessage);
  }
}

async function handleCopyApiKey(): Promise<void> {
  if (apiKeyDisplay && copyApiKeyButton) {
    try {
      // Use modern clipboard API
      await navigator.clipboard.writeText(apiKeyDisplay.value || apiKeyDisplay.textContent || "");

      // Show visual feedback
      const originalText = copyApiKeyButton.textContent;
      copyApiKeyButton.textContent = "הועתק!";
      copyApiKeyButton.classList.add("copied");

      // Reset button after 2 seconds
      setTimeout(() => {
        copyApiKeyButton.textContent = originalText;
        copyApiKeyButton.classList.remove("copied");
      }, 2000);

      //showInfoModal("מפתח API הועתק ללוח!");
    } catch (error) {
      // Fallback to legacy method if clipboard API fails
      try {
        apiKeyDisplay.select();
        apiKeyDisplay.setSelectionRange(0, 99999); // For mobile devices
        document.execCommand("copy");

        // Show visual feedback
        const originalText = copyApiKeyButton.textContent;
        copyApiKeyButton.textContent = "הועתק!";
        copyApiKeyButton.classList.add("copied");

        // Reset button after 2 seconds
        setTimeout(() => {
          copyApiKeyButton.textContent = originalText;
          copyApiKeyButton.classList.remove("copied");
        }, 2000);
      } catch (fallbackError) {
        showErrorModal("שגיאה בהעתקת מפתח API: " + fallbackError);
      }
    }
  }
}

// UI update functions
export function updateSignInUI(): void {
  // Check if user is signed in by checking if userEmailValue is not empty and not anonymous
  const isUserSignedIn = UserEmailValue && UserEmailValue !== ANONYMOUS_EMAIL;

  if (isUserSignedIn) {
    userEmail.textContent = UserEmailValue;
    userEmail.title = UserEmailValue;
    signOutButton.disabled = false;

    // Show/hide customer button based on user role
    if (customerButton) {
      if (UserRole === "ROLE_USER") {
        // Hide customer button for ROLE_USER
        customerButton.style.display = "none";
      } else {
        // Show customer button for other roles
        customerButton.style.display = "inline-block";
        customerButton.textContent = translateCustomerDataEntryName(selectedCustomerDataEntryName);
      }
    }

    // Enable/disable API section based on user role
    if (apiSection) {
      if (UserRole === "ROLE_API") {
        // Enable API section for ROLE_API
        apiSection.style.opacity = "1";
        if (createApiKeyButton) createApiKeyButton.disabled = false;
        if (revokeApiKeyButton) revokeApiKeyButton.disabled = false;
      } else {
        // Disable API section for other roles (keep panel interactive for tooltips)
        apiSection.style.opacity = "0.5";
        if (createApiKeyButton) createApiKeyButton.disabled = true;
        if (revokeApiKeyButton) revokeApiKeyButton.disabled = true;
      }
    }

    // Enable account management button for signed in users
    accountManagementButton.disabled = false;
  } else if (UserEmailValue === ANONYMOUS_EMAIL) {
    // Anonymous user
    userEmail.textContent = UserEmailValue;
    signOutButton.disabled = true;
    // Update login button state based on terms acceptance
    updateLoginButtonState();
    // Hide customer button for anonymous users
    if (customerButton) {
      customerButton.style.display = "none";
    }
    // Disable API section for anonymous users
    if (apiSection) {
      apiSection.style.opacity = "0.5";
      if (createApiKeyButton) createApiKeyButton.disabled = true;
      if (revokeApiKeyButton) revokeApiKeyButton.disabled = true;
    }
    // Disable account management button for anonymous users
    accountManagementButton.disabled = true;
  } else {
    // Not signed in
    userEmail.textContent = "";
    userEmail.title = "";
    signOutButton.disabled = true;
    // Update login button state based on terms acceptance
    updateLoginButtonState();
    // Hide customer button for logged out users
    if (customerButton) {
      customerButton.style.display = "none";
    }
    // Disable API section for logged out users
    if (apiSection) {
      apiSection.style.opacity = "0.5";
      if (createApiKeyButton) createApiKeyButton.disabled = true;
      if (revokeApiKeyButton) revokeApiKeyButton.disabled = true;
    }
    // Disable account management button for logged out users
    accountManagementButton.disabled = true;
  }
}

function switchMode(mode: string): void {
  const fullNameField = document.getElementById("fullNameField") as HTMLDivElement;
  const fullNameInput = document.getElementById("fullName") as HTMLInputElement;

  // Update toggle buttons
  if (toggleButtons) {
    toggleButtons.forEach((button) => {
      button.classList.toggle("active", button.getAttribute("data-mode") === mode);
    });
  }

  // Update modal title and form
  if (mode === "signup" && modalTitle && loginSubmitButton && googleButtonText && githubButtonText) {
    modalTitle.textContent = "הרשמה";
    fullNameField.style.display = "block";
    fullNameInput.required = true;
    loginSubmitButton.textContent = "הרשם";
    googleButtonText.textContent = "הירשם עם Google";
    githubButtonText.textContent = "הירשם עם GitHub";
  } else if (modalTitle && loginSubmitButton && googleButtonText && githubButtonText) {
    modalTitle.textContent = "התחברות";
    fullNameField.style.display = "none";
    fullNameInput.required = false;
    loginSubmitButton.textContent = "התחבר";
    googleButtonText.textContent = "התחבר עם Google";
    githubButtonText.textContent = "התחבר עם GitHub";
  }
}

// Customer list population
export function populateCustomerSelect(customerData: { name: string; modified: number; dbver: number }[]): void {
  if (!customerSelect) return;

  // Clear existing options
  customerSelect.innerHTML = '<option value="">טוען...</option>';

  if (customerData && customerData.length > 0) {
    customerSelect.innerHTML = '<option value="new">➕ צור לקוח חדש</option>';
    customerSelect.innerHTML += '<option value="duplicate">&#128111; שכפל לקוח</option>';
    customerSelect.innerHTML += '<option value="delete">🗑️ מחק לקוח</option>';

    customerData.forEach((customer) => {
      const option = document.createElement("option");
      option.value = customer.name;
      option.textContent = customer.name === DEFAULT_CUSTOMER_DATA_ENTRY_NAME ? "ברירת מחדל" : customer.name;
      customerSelect.appendChild(option);
    });
  } else {
    customerSelect.innerHTML = '<option value="new">צור לקוח חדש</option>';
  }
}

function showPasswordResetModal(): void {
  const emailInput = document.getElementById("email") as HTMLInputElement;
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
    (document.querySelector(".toggle-button[data-mode='signup']") as HTMLButtonElement).click();
  } else {
    (document.querySelector(".toggle-button[data-mode='signin']") as HTMLButtonElement).click();
  }

  // Get the email input field and set its value
  const emailInput = document.getElementById("email") as HTMLInputElement;
  if (emailInput) {
    emailInput.value = usernameParam;
  }

  // Make sure we're in login mode (not register mode)
  const loginToggle = document.querySelector('[data-mode="login"]') as HTMLButtonElement;
  if (loginToggle) {
    loginToggle.click();
  }

  // Focus on the password field since we already have the email
  const loginPassword = document.getElementById("loginPassword") as HTMLInputElement;
  if (loginPassword) {
    loginPassword.focus();
  }
  // remove the username parameter from the url
  const url = new URL(window.location.href);
  url.searchParams.delete("username");
  window.history.replaceState({}, "", url);
}

function updateLoginButtonState(): void {
  const termsAccepted = isTermsAccepted();
  loginButton.disabled = !termsAccepted;

  // Set tooltip text based on terms acceptance
  if (termsAccepted) {
    loginButton.title = "התחבר או צור חשבון";
  } else {
    loginButton.title = "אנא הסכם לתנאי השימוש תחילה";
  }
}

document.addEventListener("DOMContentLoaded", function () {
  // DOM is fully loaded and parsed
  updateLoginButtonState();
  debug("AuthUI DOM is ready!");
});
