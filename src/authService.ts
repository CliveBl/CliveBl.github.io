import { API_BASE_URL, AUTH_BASE_URL } from "./env.js";
import { ANONYMOUS_EMAIL, debug } from "./constants.js";
import { cookieUtils } from "./cookieUtils.js";

// Authentication state
export let UserEmailValue = "";
export let SignedIn = false;
export let UIVersion = "1.20";
export let ServerVersion = "";

// Customer management
export const DEFAULT_CUSTOMER_DATA_ENTRY_NAME = "Default";
export let selectedCustomerDataEntryName = DEFAULT_CUSTOMER_DATA_ENTRY_NAME;
const SELECTED_CUSTOMER_STORAGE_KEY = "selectedCustomerDataEntryName";

// Customer list cache
let customerListCache: { name: string; modified: number; dbver: number }[] | null = null;
let customerListCacheTimestamp: number = 0;
const CUSTOMER_LIST_CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
const fetchConfig = { mode: "cors" as RequestMode };

type EventCallback = () => void;
const listeners: Record<string, EventCallback[]> = {};

export function on(eventName: string, callback: EventCallback): void {
  if (!listeners[eventName]) {
    listeners[eventName] = [];
  }
  listeners[eventName].push(callback);
}

function emit(eventName: string): void {
  const callbacks = listeners[eventName];
  if (callbacks) {
    callbacks.forEach((callback) => callback());
  }
}
function updateSignInState(bool: boolean): void {
  SignedIn = bool;
  emit("signInChanged");
}

const acceptCookies = document.getElementById("acceptCookies") as HTMLButtonElement;
const cookieConsent = document.getElementById("cookieConsent") as HTMLDivElement;

// Add cookie consent button handler
acceptCookies.addEventListener("click", () => {
  cookieUtils.set("cookiesAccepted", "true", 365); // Cookie expires in 1 year
  cookieConsent.classList.remove("active");
});

// Customer storage functions
export function saveSelectedCustomerToStorage(customerName: string): void {
  sessionStorage.setItem(SELECTED_CUSTOMER_STORAGE_KEY, customerName);
}

export function loadSelectedCustomerFromStorage(): string {
  return sessionStorage.getItem(SELECTED_CUSTOMER_STORAGE_KEY) || DEFAULT_CUSTOMER_DATA_ENTRY_NAME;
}

export function updateSelectedCustomer(newCustomerName: string): void {
  selectedCustomerDataEntryName = newCustomerName;
  emit("selectedCustomerChanged");
  saveSelectedCustomerToStorage(newCustomerName);
}

// Customer list cache management
function isCustomerListCacheValid(): boolean {
  return customerListCache !== null && Date.now() - customerListCacheTimestamp < CUSTOMER_LIST_CACHE_DURATION;
}

function clearCustomerListCache(): void {
  customerListCache = null;
  customerListCacheTimestamp = 0;
}

export function customerListCacheLength(): number {
  return customerListCache ? customerListCache.length : 0;
}

export function setCustomerListCache(customerData: { name: string; modified: number; dbver: number }[]): void {
  customerListCache = customerData;
  customerListCacheTimestamp = Date.now();
}

export function getCustomerListCache(): { name: string; modified: number; dbver: number }[] | null {
  return customerListCache;
}

// Authentication functions
export async function signInAnonymous(): Promise<void> {
  try {
    debug("Anonymous sign in...");
    const response = await fetch(`${AUTH_BASE_URL}/signInAnonymous`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json();
      debug(errorData);
      throw new Error(`HTTP error! status: ${errorData.detail} ${response.status}`);
    }

    const result = await response.json();
    UserEmailValue = result.email;

    // Clear basic info cache since user state has changed
    clearBasicInfoCache();

    updateSignInState(true);
    return;
  } catch (error) {
    debug("Sign in error:", error);
    throw error;
  }
}

export async function handleLoginResponse(response: Response): Promise<any> {
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Login failed");
  }

  const data = await response.json();
  return data;
}

export async function signIn(email: string, password: string): Promise<void> {
  debug("signIn");
  try {
    const response = await fetch(`${AUTH_BASE_URL}/signIn`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        email: email,
        password: password,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      debug("Sign in error response:", errorData);
      throw new Error(`HTTP error! status: ${errorData.detail} ${response.status}`);
    }

    const text = await response.text();
    if (!text) {
      throw new Error("Empty response from server");
    }

    const result = JSON.parse(text);
    UserEmailValue = result.email;

    // Clear basic info cache since user state has changed
    clearBasicInfoCache();

    updateSignInState(true);
    return;
  } catch (error) {
    console.error("Sign in failed:", error);
    throw error;
  }
}

export async function createAccount(email: string, password: string, fullName: string) {
  // Call the registration API
  const response = await fetch(`${AUTH_BASE_URL}/createAccount`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: email,
      password: password,
      fullName: fullName,
    }),
    ...fetchConfig,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error("הרשמה נכשלה: " + errorData.description);
  }
}

export async function convertAnonymousAccount(email: string, password: string, fullName: string) {
  const response = await fetch(`${API_BASE_URL}/convertAnonymousAccount`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({
      email: email,
      password: password,
      fullName: fullName,
    }),
  });

  if (!(await handleAuthResponse(response, "Convert anonymous account failed"))) {
    return;
  }

  const result = await response.json();
  signOut();
}

export function signOut(): void {
  debug("signOut");
  // Delete the cookie by calling the signOut api
  fetch(`${API_BASE_URL}/signOut`, {
    method: "POST",
    credentials: "include",
  });

  // Update UI to show logged out state
  clearUserSession();
}

export function clearUserSession(): void {
  UserEmailValue = "";
  updateSignInState(false);

  // Reset customer selection to default
  updateSelectedCustomer(DEFAULT_CUSTOMER_DATA_ENTRY_NAME);

  // Clear customer list cache
  clearCustomerListCache();

  // Clear basic info cache
  clearBasicInfoCache();
}

// Customer management functions
export async function loadCustomerList(forceRefresh = false): Promise<{ name: string; modified: number; dbver: number }[]> {
  if (!forceRefresh && isCustomerListCacheValid() && customerListCacheLength() > 0) {
    debug("Using cached customer list");
    return customerListCache!;
  }

  try {
    debug("Loading customer list from server...");
    const response = await fetch(`${API_BASE_URL}/getCustomerDataEntryNames`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const customerData = await response.json();
    setCustomerListCache(customerData);
    return customerData;
  } catch (error) {
    console.error("Failed to load customer list:", error);
    throw error;
  }
}

export async function updateCustomerName(oldCustomerName: string, newCustomerName: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/changeCustomerDataEntryName`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        fromCustomerDataEntryName: oldCustomerName,
        toCustomerDataEntryName: newCustomerName,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`שגיאה בעדכון שם לקוח: ${errorText}`);
    }

    // Update local state
    updateSelectedCustomer(newCustomerName);

    // Refresh customer list from result
    const customerData = await response.json();
    setCustomerListCache(customerData);

    // Close modal
    const customerOverlay = document.getElementById("customerOverlay") as HTMLDivElement;
    if (customerOverlay) {
      customerOverlay.classList.remove("active");
    }
  } catch (error) {
    console.error("Failed to update customer name:", error);
    throw error;
  }
}

// Delete a customer and all its files. The caller must call updateSelectedCustomer() after this function returns.
export async function deleteCustomer(newCustomerName: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/deleteCustomer?customerDataEntryName=${newCustomerName}`, {
      method: "DELETE",
      credentials: "include",
      ...fetchConfig,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`שגיאה במחיקת לקוח: ${errorText}`);
    }

    // Refresh customer list from result if there are any customers left
    const customerData = await response.json();
    if (customerData.length > 0) {
      setCustomerListCache(customerData);
    } else {
      clearCustomerListCache();
    }

    // Close modal
    const customerOverlay = document.getElementById("customerOverlay") as HTMLDivElement;
    if (customerOverlay) {
      customerOverlay.classList.remove("active");
    }
  } catch (error) {
    console.error("Failed to delete customer:", error);
    throw error;
  }
}

export async function duplicateCustomerDataEntry(newCustomerName: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/duplicateCustomerDataEntry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        fromCustomerDataEntryName: selectedCustomerDataEntryName,
        toCustomerDataEntryName: newCustomerName,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`שגיאה בעדכון שם לקוח: ${errorText}`);
    }

    // Update local state
    updateSelectedCustomer(newCustomerName);

    // Refresh customer list
    await loadCustomerList(true);

    // Close modal
    const customerOverlay = document.getElementById("customerOverlay") as HTMLDivElement;
    if (customerOverlay) {
      customerOverlay.classList.remove("active");
    }
  } catch (error) {
    console.error("Failed to update customer name:", error);
    throw error;
  }
}

// Google OAuth functions
export async function signInWithGoogle(): Promise<void> {
  try {
    // Redirect to our backend Google OAuth endpoint
    const url = `${AUTH_BASE_URL}/google`;
    debug("Redirecting to Google OAuth:", url);
    window.location.href = url;
  } catch (error) {
    console.error("Error initiating Google login:", error);
    throw new Error("שגיאה בהתחברות עם Google");
  }
}

export async function handleGoogleCallback(): Promise<void> {
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");

    if (!code) {
      throw new Error("Missing code parameter");
    }

    const baseUrl = SignedIn ? API_BASE_URL : AUTH_BASE_URL;
    const response = await fetch(`${baseUrl}/google/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Important for receiving the cookie
      body: JSON.stringify(code),
    });

    if (!response.ok) {
      throw new Error("Failed to complete Google login");
    }

    const result = await response.json();
    UserEmailValue = result.email;

    // Remove all OAuth2 parameters from the URL
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    url.searchParams.delete("error");
    url.searchParams.delete("error_description");
    url.searchParams.delete("error_uri");
    url.searchParams.delete("scope");
    url.searchParams.delete("authuser");
    url.searchParams.delete("prompt");
    window.history.replaceState({}, "", url);

    // Clear basic info cache since user state has changed
    clearBasicInfoCache();

    updateSignInState(true);
  } catch (error) {
    console.error("Error handling Google callback:", error);
    throw new Error("שגיאה בהתחברות עם Google");
  }
}

export function checkForGoogleCallback(): void {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");

  if (code) {
    // We're in the OAuth2 callback
    handleGoogleCallback();
  }
}

// Password reset functions
export async function requestPasswordReset(email: string): Promise<void> {
  try {
    const response = await fetch(`${AUTH_BASE_URL}/requestPasswordReset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.description || "שגיאה בשליחת קישור האיפוס");
    }
  } catch (error) {
    console.error("Password reset request failed:", error);
    throw error;
  }
}

// Account deletion
export async function deleteAccount(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/deleteAccount`, {
      method: "DELETE",
      credentials: "include",
      ...fetchConfig,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`שגיאה במחיקת החשבון: ${errorText}`);
    }

    // Sign out the user
    clearUserSession();
  } catch (error) {
    console.error("Failed to delete account:", error);
    throw error;
  }
}

// Utility functions
export function translateCustomerDataEntryName(customerDataEntryName: string): string {
  if (customerDataEntryName === DEFAULT_CUSTOMER_DATA_ENTRY_NAME) {
    return "לקוח";
  }
  return customerDataEntryName;
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function translateError(error: string): string {
  const translationTable: Record<string, string> = {
    "HTTP error! status: Bad credentials 401": "שם משתמש או סיסמה שגויים",
  };
  debug("translateError:", error);
  return translationTable[error] || error;
}

// Initialize customer data from storage
export function initializeCustomerData(): void {
  selectedCustomerDataEntryName = loadSelectedCustomerFromStorage();
}

// Return true if the response is ok, false if we signed out otherwise throw an exception..
export async function handleAuthResponse(response: any, errorMessage: string) {
  if (!response.ok) {
    const errorData = await response.json();
    debug(errorData);

    if (errorData.detail.includes("JWT")) {
      signOut();
      // The session timed out. Please reconnect.
      showErrorModal("הסשן פג תוקף. אנא התחבר מחדש.");
      return false;
    }
    if (errorData.detail.includes("User not found")) {
      // If we have an Anonymous account inform the user that his data has been deleted with a modal warning:
      if (UserEmailValue == ANONYMOUS_EMAIL) {
        showInfoModal("חשבון אנונימי נמחק אוטומטית אחרי 30 יום, יחד עם כל הנתונים שלו. אתה יכול להשתמש בחשבון אנונימי חדש או ליצור משתמש קבוע על ידי הרישמה.");
      }
      clearUserSession();
      return false;
    }
    throw new Error(errorData.detail);
  }
  return true;
}

// General warning modal function that returns a promise
export function showInfoModal(message: string) {
  return new Promise((resolve) => {
    const infoMessage = document.getElementById("infoMessage") as HTMLDivElement;
    infoMessage.textContent = message;

    const modal = document.getElementById("generalInfoModal") as HTMLDivElement;
    modal.style.display = "block";

    // Handle close button
    (modal.querySelector(".close-button") as HTMLButtonElement).onclick = () => {
      modal.style.display = "none";
      resolve(false);
    };

    // Handle confirm button
    (modal.querySelector(".confirm-button") as HTMLButtonElement).onclick = () => {
      modal.style.display = "none";
      resolve(true);
    };
  });
}

// General warning modal function that returns a promise
export function showErrorModal(message: string) {
  return new Promise((resolve) => {
    const errorMessage = document.getElementById("errorMessage") as HTMLDivElement;
    errorMessage.textContent = message;

    const modal = document.getElementById("generalErrorModal") as HTMLDivElement;
    modal.style.display = "block";

    // Handle close button
    (modal.querySelector(".close-button") as HTMLButtonElement).onclick = () => {
      modal.style.display = "none";
      resolve(false);
    };

    // Handle confirm button
    (modal.querySelector(".confirm-button") as HTMLButtonElement).onclick = () => {
      modal.style.display = "none";
      resolve(true);
    };
  });
}

// General warning modal function that returns a promise
export function showWarningModal(message: string) {
  return new Promise((resolve) => {
    const warningMessage = document.getElementById("warningMessage") as HTMLDivElement;
    warningMessage.textContent = message;

    const modal = document.getElementById("generalWarningModal") as HTMLDivElement;
    modal.style.display = "block";

    // Handle close button
    (modal.querySelector(".close-button") as HTMLButtonElement).onclick = () => {
      modal.style.display = "none";
      resolve(false);
    };

    // Handle cancel button
    (modal.querySelector(".cancel-button") as HTMLButtonElement).onclick = () => {
      modal.style.display = "none";
      resolve(false);
    };

    // Handle confirm button
    (modal.querySelector(".confirm-button") as HTMLButtonElement).onclick = () => {
      modal.style.display = "none";
      resolve(true);
    };
  });
}

async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    try {
      // Check if already registered first
      debug("Checking if service worker is already registered");
      const existingRegistration = await navigator.serviceWorker.getRegistration();
      debug("Existing service worker registration:", existingRegistration);
      if (existingRegistration) {
        debug("Service worker already registered, waiting for ready state...");
        await navigator.serviceWorker.ready;
        debug("Existing service worker is ready");
        return existingRegistration;
      }

      // Not registered yet, so register it
      debug("Registering service worker...");
      const registration = await navigator.serviceWorker.register("/sw.js");
      debug("Service worker registered:", registration);

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      debug("Service worker is ready");

      return registration;
    } catch (error) {
      debug("Service worker registration failed:", error);
      return null;
    }
  }
  return null;
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
  debug("AuthServiceDOMContentLoaded");

  await registerServiceWorker();

  // Get and display version number
  try {
    UserEmailValue = "";

    const basicInfo = await getBasicInfo();
    if (basicInfo) {
      ServerVersion = basicInfo.productVersion;
      UserEmailValue = basicInfo.userEmail;
      SignedIn = true;

      debug("Successfully got BasicInfo");
    }
  } catch (error) {
    console.error("Exception fetching Basic Info:", error);
  }
  if (!SignedIn) {
    debug("Failed to fetch version:");
  }

  // Check if user has already accepted cookies
  const cookiesAccepted = cookieUtils.get("cookiesAccepted");
  if (!cookiesAccepted) {
    const cookieConsent = document.getElementById("cookieConsent") as HTMLDivElement;
    if (cookieConsent) {
      cookieConsent.classList.add("active");
    }
  }

  emit("authServiceInitialized");
});

// Basic info caching with session storage
const BASIC_INFO_CACHE_KEY = "basicInfo";
const BASIC_INFO_TIMESTAMP_KEY = "basicInfoTimestamp";
const BASIC_INFO_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

export async function getBasicInfo(forceRefresh = false): Promise<any> {
  // Check cache first if not forcing refresh
  if (!forceRefresh) {
    const cached = sessionStorage.getItem(BASIC_INFO_CACHE_KEY);
    const timestamp = sessionStorage.getItem(BASIC_INFO_TIMESTAMP_KEY);

    if (cached && timestamp) {
      const age = Date.now() - parseInt(timestamp);
      if (age < BASIC_INFO_CACHE_DURATION) {
        //debug("Using cached basic info");
        return JSON.parse(cached);
      }
    }
  }

  try {
    debug("Fetching fresh basic info from server");
    const response = await fetch(`${API_BASE_URL}/getBasicInfo`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      credentials: "include",
      ...fetchConfig,
    });

    if (response.ok) {
      const data = await response.json();

      // Cache the data
      sessionStorage.setItem(BASIC_INFO_CACHE_KEY, JSON.stringify(data));
      sessionStorage.setItem(BASIC_INFO_TIMESTAMP_KEY, Date.now().toString());

      //debug("Successfully cached basic info");
      return data;
    } else {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to fetch basic info:", error);

    // Return cached data if available, even if stale
    const cached = sessionStorage.getItem(BASIC_INFO_CACHE_KEY);
    if (cached) {
      debug("Returning stale cached basic info due to fetch error");
      return JSON.parse(cached);
    }

    throw error;
  }
}

// Clear basic info cache (call this on logout or when data might be stale)
export function clearBasicInfoCache(): void {
  sessionStorage.removeItem(BASIC_INFO_CACHE_KEY);
  sessionStorage.removeItem(BASIC_INFO_TIMESTAMP_KEY);
  debug("Cleared basic info cache");
}

// Terms acceptance management
export function acceptTerms(): void {
  cookieUtils.set("termsAccepted", "true", 365); // Cookie expires in 1 year
  emit("termsAcceptedChanged");
}

export function declineTerms(): void {
  cookieUtils.delete("termsAccepted");
  emit("termsAcceptedChanged");
}

export function isTermsAccepted(): boolean {
  return cookieUtils.get("termsAccepted") === "true";
}
