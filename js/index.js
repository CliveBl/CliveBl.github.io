import { getFriendlyName, isCurrencyField, dummyName, dummyIdNumber, NO_YEAR } from "./constants.js";
const uiVersion = "1.02";
const defaultClientIdentificationNumber = "000000000";
const ANONYMOUS_EMAIL = "AnonymousEmail";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
const DEFAULT_CUSTOMER_DATA_ENTRY_NAME = "Default";
const SELECTED_CUSTOMER_STORAGE_KEY = "selectedCustomerDataEntryName";
// Customer list cache
let customerListCache = null;
let customerListCacheTimestamp = 0;
const CUSTOMER_LIST_CACHE_DURATION = 60 * 60 * 1000; // 5 minutes in milliseconds
export let selectedCustomerDataEntryName = loadSelectedCustomerFromStorage();
export let configurationData;
let latestFileInfoList = [];
let documentIcons = {};
let userEmailValue = "";
let signedIn = false;
let isCancelled = false;
const fetchConfig = {
    mode: "cors",
};
// Add this near the top of your script
const DEBUG = true;
// Patterns for which to suppress retry button on FormError files
const SUPPRESS_RETRY_PATTERNS = [
    /שנת המס-\d{4} אינה נתמכת/, // Tax year not supported
    // Add more patterns here as needed
];
// Helper function to check if retry button should be suppressed
function shouldSuppressRetryButton(reasonText) {
    return SUPPRESS_RETRY_PATTERNS.some((pattern) => pattern.test(reasonText));
}
export function debug(...args) {
    if (DEBUG) {
        console.log(...args);
    }
}
// Import image utilities
import { convertImageToBWAndResize } from "./imageUtils.js";
import { cookieUtils } from "./cookieUtils.js";
import { displayFileInfoInExpandableArea, editableFileListHasEntries, editableGetDocTypes, editableRemoveFileList, editableOpenFileListEntry } from "./editor.js";
import { API_BASE_URL, AUTH_BASE_URL } from "./env.js";
// Get environment from URL parameter
const urlParams = new URLSearchParams(window.location.search);
//const editableFileListParam = urlParams.get("editable");
let editableFileList = localStorage.getItem("editableFileList") === "true";
const usernameParam = urlParams.get("username");
// Get references to DOM elements
const fileInput = document.getElementById("fileInput");
const fileList = document.getElementById("fileList");
const folderInput = document.getElementById("folderInput");
const processButton = document.getElementById("processButton");
const deleteAllButton = document.getElementById("deleteAllButton");
const messageContainer = document.getElementById("messageContainer");
const loginButton = document.getElementById("loginButton");
const googleLoginButton = document.getElementById("googleLoginButton");
const signOutButton = document.getElementById("signOutButton");
const loginOverlay = document.getElementById("loginOverlay");
const closeButton = document.querySelector(".close-button");
const loginForm = document.querySelector(".login-form");
const toggleButtons = document.querySelectorAll(".toggle-button");
const modalTitle = document.getElementById("modalTitle");
const submitButton = document.getElementById("submitButton");
const googleButtonText = document.getElementById("googleButtonText");
const githubButtonText = document.getElementById("githubButtonText");
const userEmail = document.getElementById("userEmail");
const customerButton = document.getElementById("customerButton");
const customerOverlay = document.getElementById("customerOverlay");
const createFormSelect = document.getElementById("createFormSelect");
const acceptCookies = document.getElementById("acceptCookies");
const cookieConsent = document.getElementById("cookieConsent");
// Customer selection event handlers
const customerSelect = document.getElementById("customerSelect");
const customerNameInput = document.getElementById("customerNameInput");
const updateCustomerButton = document.getElementById("updateCustomerButton");
const feedbackEmail = document.getElementById("feedbackEmail");
const privacyCheckbox = document.getElementById("privacyAgreement");
const sendFeedbackButton = document.getElementById("sendFeedbackButton");
const feedbackMessage = document.getElementById("feedbackMessage");
const loginPassword = document.getElementById("loginPassword");
// Helper functions for localStorage
function saveSelectedCustomerToStorage(customerName) {
    try {
        localStorage.setItem(SELECTED_CUSTOMER_STORAGE_KEY, customerName);
    }
    catch (error) {
        debug("Failed to save selected customer to localStorage:", error);
    }
}
function loadSelectedCustomerFromStorage() {
    try {
        const stored = localStorage.getItem(SELECTED_CUSTOMER_STORAGE_KEY);
        return stored || DEFAULT_CUSTOMER_DATA_ENTRY_NAME;
    }
    catch (error) {
        debug("Failed to load selected customer from localStorage:", error);
        return DEFAULT_CUSTOMER_DATA_ENTRY_NAME;
    }
}
// Helper function to update selected customer and save to localStorage
function updateSelectedCustomer(newCustomerName) {
    selectedCustomerDataEntryName = newCustomerName;
    saveSelectedCustomerToStorage(newCustomerName);
}
// Helper functions for customer list cache
function isCustomerListCacheValid() {
    return customerListCache !== null && Date.now() - customerListCacheTimestamp < CUSTOMER_LIST_CACHE_DURATION;
}
function clearCustomerListCache() {
    customerListCache = null;
    customerListCacheTimestamp = 0;
}
function setCustomerListCache(customerData) {
    customerListCache = customerData;
    customerListCacheTimestamp = Date.now();
}
export function updateButtons(hasEntries) {
    processButton.disabled = !hasEntries;
    deleteAllButton.disabled = !hasEntries;
}
function updateFileListP(fileInfoList, isNewUpload = false) {
    // // Deep copy the fileInfoList
    // const fileInfoListCopy = structuredClone(fileInfoList);
    // // Filter so that only document type "טופס 867" are included
    // const fileInfoCGT = fileInfoListCopy.filter((file) => file.documentType === "טופס 867");
    // // Sort the array by fileName from after the /
    // fileInfoCGT.sort((a, b) => a.fileName.split("/").pop()!.localeCompare(b.fileName.split("/").pop()!));
    // debug("CGT forms",fileInfoCGT);
    if (editableFileList) {
        displayFileInfoInExpandableArea(fileInfoList, structuredClone(fileInfoList), false, isNewUpload);
        updateButtons(editableFileListHasEntries());
        updateMissingDocuments();
    }
    else {
        updateFileList(fileInfoList, isNewUpload);
    }
}
function removeFileList() {
    if (editableFileList) {
        editableRemoveFileList();
    }
    else {
        fileList.innerHTML = "";
    }
}
function openFileListEntryP(fileName, property, shouldScroll = true) {
    if (editableFileList) {
        editableOpenFileListEntry(fileName, property, shouldScroll);
    }
    else {
        openFileListEntry(fileName, property, shouldScroll);
    }
}
function openFileListEntry(fileName, property, shouldScroll = true) {
    // Find the file item by looking for the span with class 'fileNameElement' that contains the fileName
    const fileNameElements = document.querySelectorAll(".fileNameElement");
    for (const element of fileNameElements) {
        if (element.textContent?.trim().startsWith(fileName)) {
            // Click the parent file-header to open the accordion
            const fileHeader = element.closest(".file-header");
            if (fileHeader) {
                // scroll the fileHeader into view only if shouldScroll is true
                if (shouldScroll) {
                    fileHeader.scrollIntoView({ behavior: "smooth" });
                }
                fileHeader.click();
                break;
            }
        }
    }
}
function getDocTypes() {
    if (editableFileList) {
        const array = Array.from(document.querySelectorAll("#fileList li"))
            .map((li) => li.getAttribute("data-doc-typename"))
            .filter((type) => type === "שגיאה"); // Filter to only string 'שגיאה'
        return array.concat(editableGetDocTypes());
    }
    else {
        return Array.from(document.querySelectorAll("#fileList li")).map((li) => li.getAttribute("data-doc-typename"));
    }
}
async function signInAnonymous() {
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
        userEmailValue = result.email;
        signedIn = true; // Set to true since we have a valid response
        updateSignInUI();
        return;
    }
    catch (error) {
        debug("Sign in error:", error);
        throw error;
    }
}
async function handleLoginResponse(response) {
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Login failed");
    }
    const data = await response.json();
    // Store the JWT token from the cookie
    // The token is automatically stored in cookies by the backend
    // Update UI
    updateSignInUI();
    // Load user data
    await loadExistingFiles();
    return data;
}
async function signIn(email, password) {
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
        debug("Raw response:", text);
        if (!text) {
            throw new Error("Empty response from server");
        }
        const result = JSON.parse(text);
        userEmailValue = result.email;
        signedIn = true; // Set to true since we have a valid response
        updateSignInUI();
        return;
    }
    catch (error) {
        console.error("Sign in failed:", error);
        debug("Sign in error details:", error);
        throw error;
    }
}
function translateCustomerDataEntryName(customerDataEntryName) {
    if (customerDataEntryName === "Default") {
        return "צור לקוח חדש";
    }
    return customerDataEntryName;
}
function updateSignInUI() {
    // Check if user is signed in by checking if userEmailValue is not empty and not anonymous
    const isUserSignedIn = userEmailValue && userEmailValue !== ANONYMOUS_EMAIL;
    debug("updateSignInUI - userEmailValue:", userEmailValue, "isUserSignedIn:", isUserSignedIn);
    if (isUserSignedIn) {
        userEmail.textContent = userEmailValue;
        signOutButton.disabled = false;
        // Show customer button for logged in users
        if (customerButton) {
            customerButton.style.display = "inline-block";
            customerButton.textContent = translateCustomerDataEntryName(selectedCustomerDataEntryName);
        }
    }
    else if (userEmailValue === ANONYMOUS_EMAIL) {
        // Anonymous user
        userEmail.textContent = userEmailValue;
        signOutButton.disabled = true;
        loginButton.disabled = false;
        // Hide customer button for anonymous users
        if (customerButton) {
            customerButton.style.display = "none";
        }
    }
    else {
        // Not signed in
        userEmail.textContent = "";
        signOutButton.disabled = true;
        // Hide customer button for logged out users
        if (customerButton) {
            customerButton.style.display = "none";
        }
    }
}
// Update the sign out function
function signOut() {
    debug("signOut");
    // Delete the cookie by calling the signOut api
    fetch(`${API_BASE_URL}/signOut`, {
        method: "POST",
        credentials: "include",
    });
    // Update UI to show logged out state
    clearUserSession();
}
// Update UI to show logged out state
function clearUserSession() {
    userEmailValue = "";
    signedIn = false;
    updateSignInUI();
    removeFileList();
    fileModifiedActions(false);
    clearMessages();
    // Reset customer selection to default
    updateSelectedCustomer(DEFAULT_CUSTOMER_DATA_ENTRY_NAME);
    // Clear customer list cache
    clearCustomerListCache();
    // Hide customer button
    if (customerButton) {
        customerButton.style.display = "none";
    }
    // Clear feedback form on sign out
    clearFeedbackForm();
}
// Add this function to load files with existing token
async function loadExistingFiles() {
    try {
        debug("loadExistingFiles");
        const response = await fetch(`${API_BASE_URL}/getFilesInfo?customerDataEntryName=${selectedCustomerDataEntryName}`, {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
            credentials: "include",
            ...fetchConfig,
        });
        if (!(await handleResponse(response, "Load existing files failed"))) {
            return;
        }
        const fileInfoList = await response.json();
        updateFileListP(fileInfoList);
        // Enable all buttons after successful file info retrieval
        fileInput.disabled = false;
        folderInput.disabled = false;
        createFormSelect.disabled = false;
        // Also enable their labels for better visual feedback
        document.querySelectorAll(".custom-file-input label").forEach((label) => {
            label.classList.remove("disabled");
        });
    }
    catch (error) {
        // Only show message if it's not an auth error
        if (error instanceof Error && !error.message.includes("Invalid token")) {
            addMessage("שגיאה בטעינת רשימת הקבצים: " + error.message);
        }
        throw error;
    }
}
// Add this helper function at the start of your script
function isValidFileType(file) {
    const validTypes = ["application/json", "application/pdf", "image/jpeg", "image/jpg", "image/gif", "image/bmp", "image/png"];
    if (!validTypes.includes(file.type)) {
        return {
            valid: false,
            message: `סוג קובץ לא נתמך - רק קבצי PDF ,JPG ,GIF ,BMP ,PNG מותרים. שם הקובץ: ${file.name}`,
        };
    }
    // Check file size (5MB = 5 * 1024 * 1024 bytes)
    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            message: `גודל הקובץ גדול מדי - הקובץ חייב להיות קטן מ-5MB. שם הקובץ: ${file.name}`,
        };
    }
    return { valid: true };
}
// Add this helper function to check if file is in GeneratedTaxForms folder
function isInGeneratedTaxFormsFolder(filePath) {
    return filePath.includes("GeneratedTaxForms");
}
// Recursively walks the file system and processes file system entries (for folder drops)
// Updates the files array with the files in the entry
// Modified: Accepts a relativePathMap to store reconstructed paths
async function getFileList(entry, files, relativePathMap, currentPath = "") {
    if (entry.isFile) {
        return new Promise((resolve) => {
            entry.file((file) => {
                if (relativePathMap) {
                    // If webkitRelativePath is empty, set our reconstructed path
                    if (!file.webkitRelativePath) {
                        relativePathMap.set(file, currentPath + file.name);
                    }
                }
                files.push(file);
                resolve();
            });
        });
    }
    else if (entry.isDirectory) {
        const reader = entry.createReader();
        return new Promise((resolve) => {
            const readEntries = () => {
                reader.readEntries(async (entries) => {
                    if (entries.length === 0) {
                        resolve();
                        return;
                    }
                    for (const childEntry of entries) {
                        await getFileList(childEntry, files, relativePathMap, currentPath + entry.name + "/");
                    }
                    readEntries(); // Continue reading if there are more entries
                });
            };
            readEntries();
        });
    }
}
// Shared function to process folder files (used by both folder input and drag & drop)
// Modified: Accepts a relativePathMap for reconstructed paths
async function processFolderFiles(files, button, relativePathMap) {
    clearMessages();
    // Sort and filter files
    const validFiles = files
        .sort((a, b) => {
        // Use reconstructed path if webkitRelativePath is empty
        const pathA = a.webkitRelativePath || (relativePathMap && relativePathMap.get(a)) || a.name;
        const pathB = b.webkitRelativePath || (relativePathMap && relativePathMap.get(b)) || b.name;
        return pathA.localeCompare(pathB);
    })
        .filter((file) => {
        const relPath = file.webkitRelativePath || (relativePathMap && relativePathMap.get(file)) || file.name;
        if (isInGeneratedTaxFormsFolder(relPath) || file.name.match(/TaxAnalysis_\d{4}\.xlsx/)) {
            return false;
        }
        const validation = isValidFileType(file);
        if (!validation.valid) {
            addMessage(validation.message || "", "error");
            return false;
        }
        return true;
    });
    if (validFiles.length === 0) {
        return;
    }
    await uploadFilesWithProgress(validFiles);
}
// Add this function to update the file list from server response
function updateFileList(fileInfoList, isNewUpload = false) {
    debug("updateFileList");
    // Store the latest fileInfoList for later reference
    latestFileInfoList = fileInfoList;
    const fileList = document.getElementById("fileList");
    if (!fileList)
        return;
    // Clear existing list
    fileList.innerHTML = "";
    // Group files by year
    const filesByYear = new Map();
    fileInfoList.forEach((fileInfo) => {
        const year = fileInfo.taxYear || NO_YEAR;
        if (!filesByYear.has(year)) {
            filesByYear.set(year, []);
        }
        filesByYear.get(year)?.push(fileInfo);
    });
    // Sort years in descending order
    const sortedYears = Array.from(filesByYear.keys()).sort((a, b) => {
        if (a === NO_YEAR)
            return -1;
        if (b === NO_YEAR)
            return 1;
        return parseInt(b) - parseInt(a);
    });
    // Create year accordions
    sortedYears.forEach((year) => {
        const yearFiles = filesByYear.get(year) || [];
        const yearAccordion = document.createElement("div");
        yearAccordion.className = "date-accordion-container";
        const yearHeader = document.createElement("div");
        yearHeader.className = "date-accordion-header";
        if (yearFiles.some((file) => file.type === "FormError")) {
            yearHeader.className += " error";
        }
        const yearToggle = document.createElement("button");
        yearToggle.className = "date-accordion-toggle-button";
        yearToggle.textContent = "+";
        yearHeader.appendChild(yearToggle);
        const yearTitle = document.createElement("span");
        yearTitle.textContent = year;
        yearTitle.className = "date-title";
        // Add error icon if year is NO_YEAR
        if (year === NO_YEAR) {
            const errorIcon = document.createElement("span");
            errorIcon.textContent = "❌   " + "חשוב לבדוק ולתקן אם יש צורך!";
            errorIcon.className = "year-error-icon";
            errorIcon.title = "שנה לא זוהתה - יש לבדוק את המסמך";
            yearTitle.appendChild(errorIcon);
        }
        yearHeader.appendChild(yearTitle);
        const yearBody = document.createElement("div");
        yearBody.className = "date-accordion-body";
        yearBody.style.display = "none";
        // Add click handler for year accordion
        yearHeader.addEventListener("click", () => {
            const isExpanded = yearBody.style.display !== "none";
            yearBody.style.display = isExpanded ? "none" : "block";
            yearToggle.textContent = isExpanded ? "+" : "-";
        });
        // Add files for this year
        yearFiles.forEach((fileInfo) => {
            const fileElement = addFileToList(fileInfo);
            fileList.appendChild(fileElement);
            yearBody.appendChild(fileElement);
        });
        yearAccordion.appendChild(yearHeader);
        yearAccordion.appendChild(yearBody);
        fileList.appendChild(yearAccordion);
        // Only expand if this is a new upload and it's the year of the last uploaded file
        if (isNewUpload) {
            const lastFile = fileInfoList[fileInfoList.length - 1];
            let shouldExpand = false;
            if (lastFile) {
                if (lastFile.type === "FormError") {
                    // For FormError files, only expand the NO_YEAR accordion
                    shouldExpand = year === NO_YEAR;
                }
                else {
                    // For normal files, expand the accordion matching the tax year
                    shouldExpand = lastFile.taxYear === year;
                }
            }
            if (shouldExpand) {
                // Expand the year accordion for new uploads
                yearBody.style.display = "block";
                yearToggle.textContent = "-";
            }
        }
    });
    // Enable/disable delete all button based on file list
    updateDeleteAllButton(fileList.children.length > 0);
    // Enable/disable process button based on file list
    updateProcessButton(fileInfoList.length > 0);
    updateMissingDocuments();
}
// Add function to update process button state
function updateProcessButton(hasEntries) {
    processButton.disabled = !hasEntries;
}
// Refactor uploadFilesListener to accept File[] or HTMLInputElement
async function uploadFilesListener(inputOrFiles, replacedFileId = null) {
    clearMessages();
    let files;
    if (Array.isArray(inputOrFiles)) {
        files = inputOrFiles;
    }
    else {
        files = Array.from(inputOrFiles.files || []);
    }
    // Filter out invalid files first
    const validFiles = files.filter((file) => {
        const validation = isValidFileType(file);
        if (!validation.valid) {
            addMessage(validation.message || "", "error");
            return false;
        }
        return true;
    });
    if (validFiles.length === 0) {
        return;
    }
    return uploadFilesWithProgress(validFiles, replacedFileId);
}
// File upload handler
fileInput.addEventListener("change", async () => {
    await uploadFilesListener(fileInput, null);
});
// Folder upload handler. Always use individual uploads
folderInput.addEventListener("change", async () => {
    const files = Array.from(folderInput.files || []);
    await processFolderFiles(files, folderInput);
});
// Global variable to track the countdown timer
let countdownTimer = null;
function showLoadingOverlay(message, options = false) {
    const loadingMessage = document.getElementById("loadingMessage");
    const loadingOverlay = document.getElementById("loadingOverlay");
    const cancelButton = document.getElementById("cancelLoadingButton");
    const loadingProgress = document.getElementById("loadingProgress");
    const currentProgress = document.getElementById("currentProgress");
    const totalProgress = document.getElementById("totalProgress");
    const progressUnit = document.getElementById("progressUnit");
    // Clear any existing countdown timer
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
    loadingMessage.textContent = message;
    loadingOverlay.classList.add("active");
    isCancelled = false;
    // Handle options parameter
    let showCancelButton = false;
    let total = 0;
    let unit = "קבצים"; // Default unit
    if (typeof options === "boolean") {
        // Backward compatibility: if options is boolean, it's showCancelButton
        showCancelButton = options;
    }
    else {
        showCancelButton = options.showCancelButton || false;
        total = options.total || 0;
        unit = options.unit || "קבצים";
    }
    // Show/hide cancel button based on parameter
    cancelButton.style.display = showCancelButton ? "block" : "none";
    // Show/hide progress counter based on total parameter
    if (total && total > 0) {
        loadingProgress.style.display = "block";
        currentProgress.textContent = "0";
        totalProgress.textContent = total.toString();
        progressUnit.textContent = unit;
        // Start automatic countdown for seconds
        if (unit === "שניות" || unit === "seconds") {
            let currentSecond = 0;
            countdownTimer = window.setInterval(() => {
                currentSecond++;
                if (currentSecond <= total) {
                    updateLoadingProgress(currentSecond);
                }
                else {
                    // Stop the timer when we reach the total
                    if (countdownTimer) {
                        clearInterval(countdownTimer);
                        countdownTimer = null;
                    }
                }
            }, 1000); // Update every second
        }
    }
    else {
        loadingProgress.style.display = "none";
    }
    // Add cancel button event listener only if button is shown
    if (showCancelButton) {
        cancelButton.onclick = () => {
            isCancelled = true;
            hideLoadingOverlay();
        };
    }
}
function hideLoadingOverlay() {
    const loadingOverlay = document.getElementById("loadingOverlay");
    loadingOverlay.classList.remove("active");
    // Clear any existing countdown timer
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
}
/**
 * Updates the current progress value in the loading overlay
 * @param current - The current progress value to display
 * @example
 * // Update progress for file upload (1-based indexing)
 * updateLoadingProgress(i + 1);
 *
 * // Update progress for time-based operations
 * updateLoadingProgress(secondsElapsed);
 *
 * // Update progress for step-based operations
 * updateLoadingProgress(currentStep);
 */
function updateLoadingProgress(current) {
    const currentProgress = document.getElementById("currentProgress");
    if (currentProgress) {
        currentProgress.textContent = current.toString();
    }
}
// Update the process button handler
processButton.addEventListener("click", async () => {
    try {
        if (!signedIn) {
            await signInAnonymous();
        }
        showLoadingOverlay("מעבדת מסמכים...", {
            total: 30,
            unit: "שניות",
            showCancelButton: false,
        });
        // Clear previous messages
        clearMessages();
        // Tax results may now be invalid
        clearTaxResults();
        // Show initial processing message
        addMessage("מתחיל בעיבוד המסמכים...", "info");
        const response = await fetch(`${API_BASE_URL}/processFiles`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                customerDataEntryName: selectedCustomerDataEntryName,
            }),
        });
        if (!(await handleResponse(response, "Process files failed"))) {
            return;
        }
        const result = await response.json();
        // Handle fatal error if present
        if (result.fatalProcessingError) {
            addMessage("שגיאה קריטית: " + result.fatalProcessingError, "error");
        }
        // Handle warnings if present
        if (result.processingWarnings && result.processingWarnings.length > 0) {
            result.processingWarnings.forEach((warning) => {
                addMessage("אזהרה: " + warning, "warning");
            });
        }
        // Handle information if present
        if (result.processingInformation && result.processingInformation.length > 0) {
            result.processingInformation.forEach((information) => {
                addMessage("מידע: " + information, "info");
            });
        }
        // If no fatal errors, load results
        if (!result.fatalProcessingError) {
            //addMessage("טוען תוצאות...", "info");
            // Wait a moment for processing to complete on server
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await loadResults();
            addMessage("העיבוד הושלם", "info");
        }
    }
    catch (error) {
        console.error("Processing failed:", error);
        addMessage("שגיאה בעיבוד הקבצים: " + (error instanceof Error ? error.message : String(error)), "error");
    }
    finally {
        hideLoadingOverlay();
        // Check if operation was cancelled
        if (isCancelled) {
            addMessage("הפעולה בוטלה על ידי המשתמש", "warning");
            return;
        }
    }
});
async function uploadFilesWithProgress(validFiles, replacedFileId = null) {
    let success = false;
    // Show modal progress overlay with cancel button for file uploads
    showLoadingOverlay("מעלה קבצים...", {
        showCancelButton: true,
        total: validFiles.length,
        unit: "קבצים",
    });
    try {
        if (!signedIn) {
            await signInAnonymous();
        }
        // Upload files one by one
        success = await uploadFiles(validFiles, replacedFileId);
    }
    catch (error) {
        console.error("UploadFile failed:", error);
        addMessage("שגיאה באימות: " + (error instanceof Error ? error.message : String(error)), "error");
    }
    finally {
        // Hide modal progress overlay
        hideLoadingOverlay();
        // Check if operation was cancelled
        if (isCancelled) {
            addMessage("הפעולה בוטלה על ידי המשתמש", "warning");
            return false;
        }
        updateButtons(editableFileListHasEntries() || fileList.children.length > 0);
        // Clear all containers
        clearResultsControls();
    }
    return success;
}
// General password prompt modal function that returns a promise
function showPasswordModal(fileName) {
    return new Promise((resolve) => {
        const passwordMessage = document.getElementById("passwordMessage");
        passwordMessage.textContent = `הקובץ ${fileName} מוגן בסיסמה. אנא הכנס את הסיסמה:`;
        const modal = document.getElementById("passwordModal");
        const passwordInput = document.getElementById("passwordInput");
        // Create password toggle button if it doesn't exist
        let toggleButton = modal.querySelector(".password-toggle");
        if (!toggleButton) {
            toggleButton = document.createElement("button");
            toggleButton.type = "button";
            toggleButton.className = "password-toggle";
            toggleButton.innerHTML = "👁️"; // Eye icon
            toggleButton.title = "הצג/הסתר סיסמה";
            // Insert the toggle button after the password input
            const passwordContainer = passwordInput.parentElement;
            if (passwordContainer) {
                passwordContainer.style.position = "relative";
                passwordContainer.appendChild(toggleButton);
            }
        }
        // Add toggle functionality
        let isPasswordVisible = false;
        toggleButton.onclick = () => {
            isPasswordVisible = !isPasswordVisible;
            passwordInput.type = isPasswordVisible ? "text" : "password";
            //toggleButton.innerHTML = isPasswordVisible ? "👁️" : "👁️"; // Change icon based on state
        };
        modal.style.display = "block";
        passwordInput.value = ""; // Clear any previous value
        passwordInput.type = "password"; // Ensure it starts as password type
        passwordInput.focus();
        // Handle confirm button
        modal.querySelector(".confirm-button").onclick = () => {
            const password = passwordInput.value.trim();
            if (password) {
                modal.style.display = "none";
                resolve(password);
            }
            else {
                // Show error if password is empty
                passwordInput.classList.add("error");
                setTimeout(() => passwordInput.classList.remove("error"), 1000);
            }
        };
        // Handle cancel button
        modal.querySelector(".cancel-button").onclick = () => {
            modal.style.display = "none";
            resolve(""); // Return empty string to indicate cancellation
        };
        // Handle enter key
        passwordInput.onkeydown = (e) => {
            if (e.key === "Enter") {
                modal.querySelector(".confirm-button").click();
            }
            else if (e.key === "Escape") {
                modal.querySelector(".cancel-button").click();
            }
        };
        // // Close if clicking outside
        // window.onclick = (event) => {
        //   if (event.target === modal) {
        //     modal.style.display = "none";
        //     resolve(""); // Return empty string to indicate cancellation
        //   }
        // };
    });
}
async function calculateMD5(file) {
    const buffer = await file.arrayBuffer();
    // @ts-ignore
    return SparkMD5.ArrayBuffer.hash(buffer); // Always 32 hex chars
}
async function uploadFiles(validFiles, replacedFileId = null) {
    let fileInfoList = null;
    let uploadedFileCount = 0;
    for (uploadedFileCount = 0; uploadedFileCount < validFiles.length && !isCancelled; uploadedFileCount++) {
        const file = validFiles[uploadedFileCount];
        // Check for cancellation before processing each file
        try {
            let newFile = file;
            let hash = null;
            if (file.type.startsWith("image/")) {
                // Calculate hash of original image file before processing
                hash = await calculateMD5(file);
                try {
                    newFile = (await convertImageToBWAndResize(file));
                }
                catch (error) {
                    addMessage("שגיאה בעיבוד התמונה: " + file.name + " " + (error instanceof Error ? error.message : String(error)), "error");
                    continue;
                }
            }
            // Try to upload the file, with password retry logic
            let uploadSuccess = false;
            let password = "";
            while (!uploadSuccess) {
                const formData = new FormData();
                formData.append("file", newFile);
                const metadata = {
                    customerDataEntryName: selectedCustomerDataEntryName,
                    password: password, // Include password if provided
                    replacedFileId: replacedFileId,
                    imageHash: hash,
                };
                formData.append("metadata", new Blob([JSON.stringify(metadata)], {
                    type: "application/json",
                }));
                try {
                    const response = await fetch(`${API_BASE_URL}/uploadFile`, {
                        method: "POST",
                        headers: {},
                        credentials: "include",
                        body: formData,
                        ...fetchConfig,
                    });
                    if (!(await handleResponse(response, "Upload file failed"))) {
                        return false;
                    }
                    fileInfoList = await response.json();
                    updateFileListP(fileInfoList, true); // true = new upload
                    uploadSuccess = true;
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    // Check if the error is about invalid password
                    if (errorMessage.includes("can not open an encrypted document") && errorMessage.includes("password is invalid")) {
                        // Prompt user for password
                        password = await showPasswordModal(file.name);
                        if (!password) {
                            // User cancelled password prompt
                            addMessage(`העלאת הקובץ ${file.name} בוטלה על ידי המשתמש`, "warning");
                            break; // Skip this file and continue with next
                        }
                        // Try again with the new password
                        continue;
                    }
                    else {
                        // Other error, don't retry
                        console.error("Upload failed:", error);
                        clearMessages();
                        addMessage("שגיאה בהעלאת הקובץ: " + errorMessage, "error");
                        return false;
                    }
                }
            }
        }
        catch (error) {
            console.error("Upload failed:", error);
            clearMessages();
            addMessage("שגיאה בהעלאת הקובץ: " + (error instanceof Error ? error.message : String(error)), "error");
            return false;
        }
        // Update progress counter
        updateLoadingProgress(uploadedFileCount + 1);
    }
    // Count the error types in the fileInfoList
    if (fileInfoList) {
        const errorTypes = fileInfoList.filter((fileInfo) => fileInfo.type === "FormError").length;
        if (errorTypes > 0) {
            addMessage(`הועלו ${uploadedFileCount} קבצים מתוך ${validFiles.length}. יש ${errorTypes} שגיאות.`, "error");
        }
        else {
            addMessage(`הועלו ${uploadedFileCount} קבצים מתוך ${validFiles.length} `, "info");
        }
    }
    if (isCancelled) {
        return false;
    }
    return true;
}
function getMessageCode(text) {
    return text.match(/\^([^ ]+)/)?.[1];
}
// Update addMessage function to handle message types
export function addMessage(text, type = "info", scrollToMessageSection = true) {
    // Map of error codes to faq ids
    const errorCodeToFaqId = {
        "^NoIdentity": "faq-personal-details",
        "^LossesTransferred": "faq-calculations",
        "^TotalChildren": "faq-common-mistakes",
    };
    const errorCodeToHelpId = {
        "^No106": "form106",
    };
    const messageDiv = document.createElement("div");
    messageDiv.className = "message-item";
    if (type) {
        messageDiv.classList.add(type);
    }
    text = translateError(text);
    const messageText = document.createElement("span");
    messageText.className = "message-text";
    // ^<message code> indicates a message code
    const messageCode = getMessageCode(text);
    if (messageCode) {
        // Eliminate the message code from the text
        text = text.replace(`^${messageCode} `, "");
    }
    messageText.textContent = text;
    const dismissButton = document.createElement("button");
    dismissButton.className = "dismiss-button";
    dismissButton.textContent = "✕";
    dismissButton.addEventListener("click", () => {
        messageContainer.removeChild(messageDiv);
    });
    messageDiv.appendChild(messageText);
    messageDiv.appendChild(dismissButton);
    messageContainer.appendChild(messageDiv);
    // If the message contains fileName= then make messageDiv a clickable link to the entry for that file in the filelist
    if (text.includes("fileName=")) {
        // Extract all fileName= and property= pairs from the message
        const fileNameMatches = text.match(/fileName=[^,]+/g);
        const propertyMatches = text.match(/property=[^,]+/g);
        if (fileNameMatches && fileNameMatches.length > 0) {
            // Clean up the display text by removing all fileName= and property= patterns
            let cleanText = text;
            fileNameMatches.forEach((match) => {
                cleanText = cleanText.replace(match + ",", "").replace(match, "");
            });
            propertyMatches?.forEach((match) => {
                cleanText = cleanText.replace(match + ",", "").replace(match, "");
            });
            messageText.textContent = cleanText;
            // Add clickable class to show it's interactive
            messageDiv.classList.add("clickable");
            // Make the messageDiv a clickable link to open all files
            messageText.addEventListener("click", () => {
                if (!editableFileList) {
                    // switch to the editable file list view
                    editableFileList = true;
                    updateFileListView();
                }
                // Extract file names and properties
                const fileNames = fileNameMatches.map((match) => match.replace("fileName=", ""));
                const properties = propertyMatches ? propertyMatches.map((match) => match.replace("property=", "")) : [];
                // Open all files with their respective properties
                fileNames.forEach((fileName, index) => {
                    const property = properties[index] || null;
                    const shouldScrollTo = index === 0; // Only scroll to the first one
                    openFileListEntryP(fileName, property, shouldScrollTo);
                });
            });
        }
    }
    else if (messageCode) {
        // If the message contains a message code, make it clickable to navigate to FAQ or help
        const faqId = errorCodeToFaqId[`^${messageCode}`];
        const helpId = errorCodeToHelpId[`^${messageCode}`];
        if (faqId) {
            // Add clickable class to show it's interactive
            messageDiv.classList.add("clickable");
            messageText.className = "message-text-help";
            // Make the messageDiv a clickable link to the FAQ
            messageText.addEventListener("click", () => {
                window.location.href = `faq.html#${faqId}`;
            });
        }
        else if (helpId) {
            // Add clickable class to show it's interactive
            messageDiv.classList.add("clickable");
            messageText.className = "message-text-help";
            // Make the messageDiv a clickable link to the help page
            messageText.addEventListener("click", () => {
                window.location.href = `help.html#${helpId}`;
            });
        }
    }
    // Scroll to the bottom of the page if type is not "success" or "info"
    if (type !== "success" && type !== "info" && scrollToMessageSection) {
        window.scrollTo({
            top: messageContainer.offsetTop,
            behavior: "smooth",
        });
    }
    // If the message type is "error", append it to the feedbackMessage in the feedback section
    if (type === "error") {
        const timestamp = new Date().toLocaleTimeString();
        feedbackMessage.textContent = `${timestamp}: ${text}`;
    }
}
let isAnonymousConversion = false;
// Add event listener for signup anonymous button
signOutButton.addEventListener("click", () => {
    signOut();
    updateSignInUI();
});
loginButton.addEventListener("click", () => {
    loginOverlay.classList.add("active");
    if (signedIn && userEmail.textContent == ANONYMOUS_EMAIL) {
        const signupButton = document.querySelector(".toggle-button[data-mode='signup']");
        if (signupButton) {
            loginPassword.setAttribute("autocomplete", "new-password");
            signupButton.click();
        }
        isAnonymousConversion = true;
    }
    else {
        const signinButton = document.querySelector(".toggle-button[data-mode='signin']");
        if (signinButton) {
            loginPassword.setAttribute("autocomplete", "current-password");
            signinButton.click();
        }
        isAnonymousConversion = false;
    }
});
googleLoginButton.addEventListener("click", () => {
    signInWithGoogle();
});
closeButton.addEventListener("click", () => {
    loginOverlay.classList.remove("active");
});
// Function to switch between signin and signup modes
function switchMode(mode) {
    const isSignup = mode === "signup";
    modalTitle.textContent = isSignup ? "הרשמה" : "התחברות";
    submitButton.textContent = isSignup ? "הירשם" : "התחבר";
    const fullNameInput = document.getElementById("fullName");
    const fullNameField = document.getElementById("fullNameField");
    fullNameField.style.display = isSignup ? "block" : "none";
    if (isSignup) {
        fullNameInput.setAttribute("required", "");
    }
    else {
        fullNameInput.removeAttribute("required");
    }
    googleButtonText.textContent = isSignup ? "הרשמה עם Google" : "התחבר עם Google";
    githubButtonText.textContent = isSignup ? "הרשמה עם GitHub" : "התחבר עם GitHub";
    toggleButtons.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.mode === mode);
    });
}
// Customer selection functions
async function loadCustomerList(forceRefresh = false) {
    // Check cache first (unless forced refresh)
    if (!forceRefresh && isCustomerListCacheValid()) {
        const customerData = customerListCache;
        populateCustomerSelect(customerData);
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/getCustomerDataEntryNames`, {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
            credentials: "include",
            ...fetchConfig,
        });
        if (!(await handleResponse(response, "Load customer list failed"))) {
            return;
        }
        const customerData = await response.json();
        // Cache the customer data
        setCustomerListCache(customerData);
        // Populate the select dropdown
        populateCustomerSelect(customerData);
    }
    catch (error) {
        console.error("Failed to load customer list:", error);
        addMessage("שגיאה בטעינת רשימת הלקוחות: " + (error instanceof Error ? error.message : String(error)), "error");
    }
}
// Helper function to populate the customer select dropdown
function populateCustomerSelect(customerData) {
    // Clear loading option
    customerSelect.innerHTML = "";
    // Extract customer names
    const customerNames = customerData.map((customer) => customer.name);
    // Validate that the stored customer still exists
    if (!customerNames.includes(selectedCustomerDataEntryName)) {
        updateSelectedCustomer(DEFAULT_CUSTOMER_DATA_ENTRY_NAME);
    }
    // Add existing customers - extract names from the objects
    customerData.forEach((customer) => {
        const option = document.createElement("option");
        option.value = customer.name;
        option.textContent = customer.name;
        customerSelect.appendChild(option);
    });
    // Add "Create new customer" option
    const newCustomerOption = document.createElement("option");
    newCustomerOption.value = "new";
    newCustomerOption.textContent = "צור לקוח חדש";
    customerSelect.appendChild(newCustomerOption);
    // Set current selection
    customerSelect.value = translateCustomerDataEntryName(selectedCustomerDataEntryName);
    customerNameInput.value = "";
    // Enable update button if name is different and not duplicate
    const inputValue = customerNameInput.value.trim();
    const isEmpty = inputValue === "";
    const isSameAsCurrent = inputValue === selectedCustomerDataEntryName;
    // Check if name already exists
    let isDuplicate = false;
    if (customerListCache && inputValue) {
        const existingNames = customerListCache.map((customer) => customer.name);
        isDuplicate = existingNames.includes(inputValue);
    }
    updateCustomerButton.disabled = isEmpty || isSameAsCurrent || isDuplicate;
}
async function updateCustomerName() {
    try {
        debug("updateCustomerName");
        const newName = customerNameInput.value.trim();
        const oldName = selectedCustomerDataEntryName;
        if (!newName) {
            addMessage("שם לקוח לא יכול להיות ריק", "error");
            return;
        }
        if (newName === oldName) {
            addMessage("שם הלקוח לא השתנה", "info");
            return;
        }
        // If creating new customer, only update local variable - no API call
        if (customerSelect.value === "new") {
            // Only update the local variable - no API call for new customer
            updateSelectedCustomer(newName);
            addMessage(`לקוח חדש נבחר: ${newName} (ייווצר בעת העלאה)`, "info");
            // Dismiss the customer modal
            customerOverlay.classList.remove("active");
        }
        else {
            // Update existing customer name - make API call
            const changeResponse = await fetch(`${API_BASE_URL}/changeCustomerDataEntryName`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    fromCustomerDataEntryName: oldName,
                    toCustomerDataEntryName: newName,
                }),
                credentials: "include",
                ...fetchConfig,
            });
            if (!(await handleResponse(changeResponse, "Update customer name failed"))) {
                return;
            }
            updateSelectedCustomer(newName);
            addMessage(`שם הלקוח עודכן ל: ${newName}`, "info");
            // Reload customer list to reflect changes (force refresh to get updated data)
            await loadCustomerList(true);
            // Dismiss the customer modal
            customerOverlay.classList.remove("active");
        }
        // Update customer button text
        if (customerButton) {
            customerButton.textContent = translateCustomerDataEntryName(selectedCustomerDataEntryName);
        }
        // Reload files and results with new customer
        await loadExistingFiles();
        await loadResults(false);
    }
    catch (error) {
        console.error("Failed to update customer name:", error);
        addMessage("שגיאה בעדכון שם הלקוח: " + (error instanceof Error ? error.message : String(error)), "error");
    }
}
// Handlers for mode toggle buttons
toggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
        switchMode(button.dataset.mode || "");
    });
});
// login form submit handler
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email");
    const loginPassword = document.getElementById("loginPassword");
    const fullName = document.getElementById("fullName");
    const isSignup = document.querySelector(".toggle-button.active")?.dataset.mode === "signup";
    try {
        if (isSignup) {
            if (isAnonymousConversion) {
                await convertAnonymousAccount(email.value, loginPassword.value, fullName.value);
            }
            else {
                // Call the registration API
                const response = await fetch(`${AUTH_BASE_URL}/createAccount`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email: email.value,
                        password: loginPassword.value,
                        fullName: fullName.value,
                    }),
                    ...fetchConfig,
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error("הרשמה נכשלה: " + errorData.description);
                }
            }
            // Show verification message and close login dialog
            showInfoModal("נרשמת בהצלחה! אנא בדוק את תיבת הדואר שלך לקבלת קישור אימות.");
            loginOverlay.classList.remove("active");
            // Clear the form
            email.value = "";
            loginPassword.value = "";
            fullName.value = "";
        }
        else {
            // Call the signIn API
            await signIn(email.value, loginPassword.value);
            // Clear stored tax results
            localStorage.removeItem("taxResults");
            localStorage.removeItem("taxResultsYear");
            // Clear tax results display
            const taxResultsContainer = document.getElementById("taxResultsContainer");
            const taxCalculationContent = document.getElementById("taxCalculationContent");
            taxResultsContainer.classList.remove("active");
            taxCalculationContent.innerHTML = "";
            // Handle signin
            await loadExistingFiles(); // Load files with new token
            // Dont scroll
            await loadResults(false);
            // Initialize customer selection if user is logged in
            if (signedIn && userEmailValue !== ANONYMOUS_EMAIL) {
                await loadCustomerList();
                // Update customer button text
                if (customerButton) {
                    customerButton.textContent = translateCustomerDataEntryName(selectedCustomerDataEntryName);
                }
            }
        }
        //addMessage("התחברת בהצלחה!");
        loginOverlay.classList.remove("active");
    }
    catch (error) {
        console.error("Login failed:", error);
        // Clear previous messages
        clearMessages();
        if (error instanceof Error && error.message.includes("Bad credentials 401")) {
            showInfoModal("שם משתמש או סיסמה שגויים");
        }
        else if (error instanceof Error && error.message.includes("האימייל כבר בשימוש")) {
            showInfoModal("האימייל כבר בשימוש");
        }
        else {
            addMessage("שגיאה בהתחברות: " + (error instanceof Error ? translateError(error.message) : String(error)), "error");
            // Dismiss the login overlay
            loginOverlay.classList.remove("active");
        }
    }
});
const googleLogin = document.querySelector(".google-login");
const githubLogin = document.querySelector(".github-login");
async function loadResults(scrollToMessageSection = true) {
    try {
        const response = await fetch(`${API_BASE_URL}/getResultsInfo?customerDataEntryName=${selectedCustomerDataEntryName}`, {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
            credentials: "include",
            ...fetchConfig,
        });
        if (!(await handleResponse(response, "Load results failed"))) {
            return;
        }
        const results = await response.json();
        // Clear previous messages
        clearMessages();
        // Handle messages if present
        results.forEach((result) => {
            if (result.messages) {
                // Handle fatal error if present
                if (result.messages.fatalProcessingError) {
                    addMessage("שגיאה קריטית: " + result.messages.fatalProcessingError, "error", scrollToMessageSection);
                }
                // Handle warnings if present
                if (result.messages.processingWarnings && result.messages.processingWarnings.length > 0) {
                    result.messages.processingWarnings.forEach((warning) => {
                        addMessage("אזהרה: " + warning, "warning", scrollToMessageSection);
                    });
                }
                // Handle information if present
                if (result.messages.processingInformation && result.messages.processingInformation.length > 0) {
                    result.messages.processingInformation.forEach((information) => {
                        addMessage("מידע: " + information, "info", scrollToMessageSection);
                    });
                }
            }
        });
        // Display result files
        displayResults(results);
    }
    catch (error) {
        console.error("Failed to load results:", error);
        // Only show error if it's not an auth error
        if (error instanceof Error && !error.message.includes("Invalid token")) {
            addMessage("שגיאה בטעינת התוצאות: " + error.message, "error");
        }
    }
}
export function clearMessages() {
    messageContainer.innerHTML = "";
}
function descriptionFromFileName(fileName) {
    // A filename consists of <name>_<year>.<type>
    // We want to return a description of the file based on the <name> <year> and <type>
    // All the names follow a similar format: <name>_<year>.<type>
    // The possible names are as follows, the year can vary:
    // TaxAnalysis_2023.xlsx  should return 2023: Tax Analysis
    // 1322_2023_filled.pdf should return 2023: Capital Gains Form 1322
    // 1301_2023.dat should return 2023: Data file for uploading to the tax authority
    // Split the file name into its components
    const parts = fileName.split("_");
    const name = parts[0];
    const year = parts[1].split(".")[0];
    const type = parts[1].split(".")[1];
    // Build the description in Hebrew
    let description = "";
    if (name === "TaxAnalysis") {
        // Spreadsheet file containing a detailed analysis of the tax situation
        description = `${year}: קובץ גיליון אלקטרוני המכיל ניתוח מפורט של המצב המס`;
    }
    else if (name === "1322") {
        description = `${year}: טופס 1322 - רווח מהון מניירות ערך`;
    }
    else if (name === "1344") {
        description = `${year}: טופס 1344 - הפסדים מועברים`;
    }
    else if (name === "1301") {
        // Data file containing the annual data for uploading to the tax authority when filing the tax return
        description = `${year}: קובץ נתונים שנתיים להעלאה אתר מס הכנסה בזמן הגשת דו״ח שנתי`;
    }
    else {
        description = `${year}: מסמך נוסף - ` + fileName;
    }
    return description;
}
function displayResults(results) {
    const resultsContainer = document.getElementById("resultsContainer");
    const resultsList = document.getElementById("resultsList");
    resultsList.innerHTML = ""; // Clear existing results
    // If there are no results, hide the results container.
    if (!Array.isArray(results) || results.length === 0) {
        resultsContainer.classList.remove("active");
        return;
    }
    let hasFiles = false;
    results.forEach((result) => {
        if (result.file) {
            hasFiles = true;
            const li = document.createElement("li");
            li.className = "result-item";
            const fileDescription = document.createElement("span");
            fileDescription.textContent = descriptionFromFileName(result.file.fileName);
            // Add file icon based on extension
            const fileIcon = document.createElement("i");
            const extension = result.file.fileName.split(".").pop()?.toLowerCase();
            switch (extension) {
                case "pdf":
                    fileIcon.className = "fa fa-file-pdf-o";
                    break;
                case "xlsx":
                    fileIcon.className = "fa fa-file-excel-o";
                    break;
                case "dat":
                    fileIcon.className = "fa fa-database";
                    break;
                default:
                    fileIcon.className = "fa fa-question";
            }
            const buttonContainer = document.createElement("div");
            buttonContainer.className = "result-buttons";
            // Add a tax calculate button only for the excel file
            if (result.file.fileName.endsWith(".xlsx")) {
                const taxCalculateButton = document.createElement("button");
                taxCalculateButton.className = "action-button tax-calculate-button";
                taxCalculateButton.innerHTML = "💰 חשב מס";
                taxCalculateButton.addEventListener("click", () => {
                    calculateTax(result.file.fileName);
                });
                buttonContainer.appendChild(taxCalculateButton);
            }
            const downloadButton = document.createElement("button");
            downloadButton.className = "action-button download-button";
            // Create icon and text elements
            const iconSpan = document.createElement("span");
            iconSpan.className = "download-button-icon";
            iconSpan.appendChild(fileIcon);
            const textSpan = document.createElement("span");
            textSpan.className = "download-button-text";
            textSpan.textContent = "הורדה";
            downloadButton.appendChild(textSpan);
            downloadButton.appendChild(iconSpan);
            downloadButton.addEventListener("click", () => downloadResult(result.file.fileName));
            buttonContainer.appendChild(downloadButton);
            li.appendChild(fileDescription);
            li.appendChild(buttonContainer);
            resultsList.appendChild(li);
        }
    });
    if (hasFiles) {
        resultsContainer.classList.add("active");
    }
    else {
        resultsContainer.classList.remove("active");
    }
}
async function downloadResult(fileName) {
    try {
        const response = await fetch(`${API_BASE_URL}/downloadResultsFile?fileName=${encodeURIComponent(fileName)}&customerDataEntryName=${selectedCustomerDataEntryName}`, {
            method: "GET",
            credentials: "include",
            ...fetchConfig,
        });
        if (!(await handleResponse(response, "Download result failed"))) {
            return;
        }
        // Create blob from response
        const blob = await response.blob();
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        addMessage(`הקובץ ${fileName} הורד בהצלחה`);
    }
    catch (error) {
        console.error("Download failed:", error);
        addMessage("שגיאה בהורדת הקובץ: " + (error instanceof Error ? error.message : String(error)), "error");
    }
}
// Update delete all handler - remove confirmation dialog
deleteAllButton.addEventListener("click", async () => {
    try {
        if (!signedIn) {
            debug("no auth token");
            return;
        }
        const confirmed = await showWarningModal("האם אתה בטוח שברצונך למחוק את כל המסמכים שהוזנו?");
        if (!confirmed)
            return;
        const response = await fetch(`${API_BASE_URL}/deleteAllFiles?customerDataEntryName=${selectedCustomerDataEntryName}`, {
            method: "DELETE",
            credentials: "include",
            ...fetchConfig,
        });
        if (!(await handleResponse(response, "Delete all files failed"))) {
            return;
        }
        removeFileList();
        fileModifiedActions(fileList.children.length > 0);
        clearMessages();
        addMessage("כל הקבצים נמחקו בהצלחה");
    }
    catch (error) {
        console.error("Delete all failed:", error);
        addMessage("שגיאה במחיקת הקבצים: " + (error instanceof Error ? error.message : String(error)), "error");
    }
});
// DOMContentLoaded event for other initialization
document.addEventListener("DOMContentLoaded", () => {
    debug("DOMContentLoaded 1");
    // Drag and Drop Area Logic
    const dragDropArea = document.getElementById("dragDropArea");
    if (dragDropArea) {
        // Highlight on drag over
        dragDropArea.addEventListener("dragover", (e) => {
            e.preventDefault();
            dragDropArea.classList.add("dragover");
        });
        dragDropArea.addEventListener("dragleave", (e) => {
            e.preventDefault();
            dragDropArea.classList.remove("dragover");
        });
        dragDropArea.addEventListener("drop", async (e) => {
            e.preventDefault();
            dragDropArea.classList.remove("dragover");
            const items = Array.from(e.dataTransfer?.items || []);
            const files = [];
            // New: Map to store reconstructed relative paths
            const relativePathMap = new Map();
            // Process each dropped item
            for (const item of items) {
                if (item.kind === "file") {
                    // Use type assertion to access webkitGetAsEntry
                    const webkitItem = item;
                    const entry = webkitItem.webkitGetAsEntry?.() || webkitItem.getAsEntry?.();
                    if (entry) {
                        await getFileList(entry, files, relativePathMap, "");
                    }
                    else {
                        // Fallback for browsers that don't support FileSystem API
                        const file = item.getAsFile();
                        if (file) {
                            files.push(file);
                        }
                    }
                }
            }
            if (files.length > 0) {
                // Use the same logic as folder input for processing, pass relativePathMap
                await processFolderFiles(files, folderInput, relativePathMap);
            }
        });
        // Click to open file dialog
        dragDropArea.addEventListener("click", () => {
            fileInput.click();
        });
    }
});
function clearTaxResults() {
    const taxResultsContainer = document.getElementById("taxResultsContainer");
    const taxCalculationContent = document.getElementById("taxCalculationContent");
    // Hide containers
    taxResultsContainer.classList.remove("active");
    // Clear content
    taxCalculationContent.innerHTML = "";
    // Clear stored results
    localStorage.removeItem("taxResults");
    localStorage.removeItem("taxResultsYear");
}
function clearResultsControls() {
    const resultsContainer = document.getElementById("resultsContainer");
    const resultsList = document.getElementById("resultsList");
    clearTaxResults();
    // Hide containers
    resultsContainer.classList.remove("active");
    // Clear content
    resultsList.innerHTML = "";
}
async function loadConfiguration() {
    debug("loadConfiguration");
    if (!configurationData) {
        const response = await fetch(`${AUTH_BASE_URL}/getConfigurationData`, {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
            ...fetchConfig,
        });
        if (!(await handleResponse(response, "Load configuration failed"))) {
            return;
        }
        debug("loadConfiguration loaded");
        configurationData = await response.json();
    }
}
function formatNumber(key, value) {
    if (isCurrencyField(key)) {
        return `<em>${getFriendlyName(key)}:</em> ${new Intl.NumberFormat(undefined, { style: "decimal", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)}`;
    }
    else {
        return `<em>${getFriendlyName(key)}:</em> ${value}`;
    }
}
export function addFileToList(fileInfo) {
    async function deleteFile(fileId) {
        try {
            const response = await fetch(`${API_BASE_URL}/deleteFile?fileId=${fileId}&customerDataEntryName=${selectedCustomerDataEntryName}`, {
                method: "DELETE",
                headers: {},
                credentials: "include",
                ...fetchConfig,
            });
            if (!(await handleResponse(response, "Delete failed"))) {
                return;
            }
            // Find the year accordion container that contains this file
            const yearContainer = li.closest(".date-accordion-container");
            if (yearContainer) {
                // Remove the file item
                li.remove();
                // If this was the last file in the year container, remove the year container too
                const yearBody = yearContainer.querySelector(".date-accordion-body");
                if (yearBody && yearBody.children.length === 0) {
                    yearContainer.remove();
                }
            }
            fileModifiedActions(fileList.children.length > 0);
        }
        catch (error) {
            console.error("Delete failed:", error);
            addMessage("שגיאה במחיקת הקובץ: " + (error instanceof Error ? error.message : String(error)), "error");
        }
    }
    async function deleteFileQuietly(fileId) {
        try {
            const response = await fetch(`${API_BASE_URL}/deleteFile?fileId=${fileId}&customerDataEntryName=${selectedCustomerDataEntryName}`, {
                method: "DELETE",
                headers: {},
                credentials: "include",
                ...fetchConfig,
            });
            if (!(await handleResponse(response, "Delete failed"))) {
                return;
            }
        }
        catch (error) {
            console.error("Delete failed:", error);
        }
    }
    let status;
    let statusMessage;
    const fileId = fileInfo.fileId;
    const fileName = { name: fileInfo.fileName, size: 0, path: fileInfo.path };
    if (fileInfo.type === "FormError") {
        status = "error";
        statusMessage = fileInfo.reasonText;
    }
    else if (fileInfo.fileName.includes("ידני")) {
        status = null;
        // Add clent name and id number
        statusMessage = `עבור: ${fileInfo.clientName} ת.ז. ${fileInfo.clientIdentificationNumber} ${fileInfo.noteText ? ` (${fileInfo.noteText})` : ""}`;
    }
    else {
        status = null;
        statusMessage = `זוהה כ-${fileInfo.type} לשנת ${fileInfo.taxYear}${fileInfo.noteText ? ` (${fileInfo.noteText})` : ""}`;
    }
    const li = document.createElement("li");
    li.className = "file-item";
    li.setAttribute("data-doc-typename", fileInfo.documentType);
    if (status) {
        li.classList.add(status);
    }
    const fileInfoElement = document.createElement("div");
    fileInfoElement.className = "file-info";
    const fileHeader = document.createElement("div");
    fileHeader.className = "file-header";
    // Create status icon
    let statusIcon;
    switch (status) {
        case "warning":
            statusIcon = "⚠️";
            break;
        case "error":
            statusIcon = "❌";
            break;
        default:
            statusIcon = null; //documentIcons[fileInfo.documentType] || "📋";
    }
    const fileNameElement = document.createElement("span");
    fileNameElement.className = "fileNameElement";
    fileNameElement.textContent = fileName.path || fileName.name;
    if (statusIcon) {
        fileNameElement.textContent = fileNameElement.textContent + " " + statusIcon;
    }
    fileNameElement.dir = "ltr";
    // Add expand/collapse indicator
    const expandIcon = document.createElement("span");
    expandIcon.textContent = "▼";
    expandIcon.className = "expand-icon";
    fileHeader.appendChild(expandIcon);
    fileHeader.appendChild(fileNameElement);
    fileInfoElement.appendChild(fileHeader);
    if (statusMessage) {
        const statusMessageSpan = document.createElement("span");
        statusMessageSpan.className = "status-message";
        statusMessageSpan.textContent = statusMessage;
        fileInfoElement.appendChild(statusMessageSpan);
    }
    // Create accordion content
    const accordionContent = document.createElement("div");
    accordionContent.className = "accordion-content";
    // Create button container at the top of accordion content
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "accordion-button-container";
    // Create edit button
    const editButton = document.createElement("button");
    editButton.textContent = "✏️";
    editButton.className = "edit-button";
    editButton.title = "ערוך";
    editButton.style.display = "none"; // Initially hidden
    editButton.addEventListener("click", async (e) => {
        // Handle edit action here
        debug("Edit clicked for file:", fileId);
        // Get the entry that from the latestFileInfoList with the same fileId
        const formJson = latestFileInfoList.find((file) => file.fileId === fileId);
        if (!formJson || !formJson.fileName) {
            throw new Error("Form not found");
        }
        // Switch to edit mode
        await toggleFileListView();
        openFileListEntryP(formJson.fileName, null, true);
    });
    // Add edit button to the button container.
    buttonContainer.appendChild(editButton);
    // Add button container to the top of accordion content
    accordionContent.appendChild(buttonContainer);
    fileInfoElement.appendChild(accordionContent);
    // Add all fileInfo fields that aren't already displayed
    const excludedFields = ["fileName", "type", "fileId", "matchTag", "noteText"];
    Object.entries(fileInfo).forEach(([key, value]) => {
        //if (!excludedFields.includes(key) && value !== null) {
        if (!excludedFields.includes(key)) {
            // Check if value is an object (embedded field)
            if (value && typeof value === "object") {
                // Skip if object is empty or has no non-null values
                const hasNonNullValues = Object.values(value).some((v) => v !== null);
                if (Object.keys(value).length === 0 || !hasNonNullValues)
                    return;
                const fieldGroup = document.createElement("div");
                fieldGroup.className = "field-group";
                fieldGroup.innerHTML = `<strong>${getFriendlyName(key)}:</strong>`;
                // Create nested list for embedded fields
                const nestedList = document.createElement("ul");
                nestedList.className = "nested-list";
                // Handle arrays of objects
                if (Array.isArray(value)) {
                    value.forEach((item, index) => {
                        if (item && typeof item === "object") {
                            const arrayItem = document.createElement("li");
                            arrayItem.className = "array-item";
                            arrayItem.innerHTML = `<strong>פריט ${index + 1}:</strong>`;
                            const itemList = document.createElement("ul");
                            itemList.className = "nested-list";
                            Object.entries(item).forEach(([itemKey, itemValue]) => {
                                const itemField = document.createElement("li");
                                itemField.className = "nestedListItemField";
                                if (itemKey.endsWith("Type")) {
                                    itemField.innerHTML = formatNumber(itemKey, getFriendlyName(String(itemValue)));
                                }
                                else if (itemKey.endsWith("Boolean")) {
                                    itemField.innerHTML = `<strong>${getFriendlyName(itemKey)}:</strong> ${itemValue ? "כן" : "לא"}`;
                                }
                                else {
                                    itemField.innerHTML = formatNumber(itemKey, itemValue);
                                }
                                itemList.appendChild(itemField);
                            });
                            if (itemList.children.length > 0) {
                                arrayItem.appendChild(itemList);
                                nestedList.appendChild(arrayItem);
                            }
                        }
                    });
                }
                else {
                    Object.entries(value).forEach(([nestedKey, nestedValue]) => {
                        if (nestedValue !== null) {
                            const nestedItem = document.createElement("li");
                            nestedItem.className = "nestedListItemField";
                            nestedItem.innerHTML = formatNumber(nestedKey, nestedValue);
                            nestedList.appendChild(nestedItem);
                        }
                    });
                }
                fieldGroup.appendChild(nestedList);
                accordionContent.appendChild(fieldGroup);
            }
            else {
                // Regular field
                const field = document.createElement("div");
                field.className = "fileitem-field-label";
                if (key.endsWith("Name")) {
                    field.innerHTML = `<strong>${getFriendlyName(key)}:</strong> ${dummyName(String(value))}`;
                }
                else if (key.endsWith("IdentificationNumber")) {
                    field.innerHTML = `<strong>${getFriendlyName(key)}:</strong> ${dummyIdNumber(String(value))}`;
                }
                else if (key.endsWith("Boolean")) {
                    field.innerHTML = `<strong>${getFriendlyName(key)}:</strong> ${value ? "כן" : "לא"}`;
                }
                else {
                    field.innerHTML = `<strong>${getFriendlyName(key)}:</strong> ${value}`;
                }
                accordionContent.appendChild(field);
            }
        }
    });
    // Add click handler for accordion
    fileHeader.addEventListener("click", (e) => {
        // Don't toggle if clicking delete button
        if ((e.target && e.target.closest(".delete-button")) || e.target.closest(".edit-button"))
            return;
        // Close any other open accordions first
        const allAccordions = document.querySelectorAll(".accordion-content");
        const allExpandIcons = document.querySelectorAll(".expand-icon");
        const allEditButtons = document.querySelectorAll(".edit-button");
        const allFileNames = document.querySelectorAll(".fileNameElement");
        allAccordions.forEach((acc, index) => {
            if (acc !== accordionContent && acc.style.display === "block") {
                acc.style.display = "none";
                allExpandIcons[index].textContent = "▼";
                allExpandIcons[index].classList.remove("expanded");
                allEditButtons[index].style.display = "none";
                allFileNames[index].classList.remove("expanded");
            }
        });
        const isExpanded = accordionContent.style.display === "block";
        if (isExpanded) {
            accordionContent.style.display = "none";
            expandIcon.textContent = "▼";
            fileNameElement.classList.remove("expanded");
            editButton.style.display = "none";
        }
        else {
            accordionContent.style.display = "block";
            expandIcon.textContent = "▲";
            fileNameElement.classList.add("expanded");
            editButton.style.display = "block";
        }
    });
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "🗑️";
    deleteButton.className = "delete-button";
    deleteButton.title = "מחק";
    deleteButton.addEventListener("click", async () => {
        deleteFile(fileId);
    });
    li.appendChild(fileInfoElement);
    // In the case of an error form we add a retry button (unless suppressed by pattern)
    if (fileInfo.type === "FormError" && !shouldSuppressRetryButton(fileInfo.reasonText || "")) {
        const retryInput = document.createElement("input");
        retryInput.type = "file";
        retryInput.id = "xfileInput";
        retryInput.accept = ".json,.pdf,.jpg,.jpeg,.gif,.tiff,.bmp,.png";
        retryInput.className = "retry-input";
        retryInput.multiple = true;
        const retryButton = document.createElement("button");
        retryButton.innerHTML = "ניסיון שנית";
        retryButton.className = "form-action-button";
        //retryInputLabel.className = "custom-file-input-label";
        //retryButton.htmlFor =  "xfileInput";
        retryButton.addEventListener("click", () => {
            retryInput.click();
        });
        const retryInputContainer = document.createElement("div");
        retryInputContainer.appendChild(retryInput);
        retryInputContainer.appendChild(retryButton);
        fileInfoElement.appendChild(retryInputContainer);
        retryInput.addEventListener("change", async (event) => {
            // Open the select document dialog
            //   deleteFileQuietly(fileId);
            const success = await uploadFilesListener(retryInput, fileId);
            if (success) {
            }
        });
    }
    li.appendChild(deleteButton);
    return li;
}
export function fileModifiedActions(hasEntries) {
    updateDeleteAllButton(hasEntries);
    updateProcessButton(hasEntries);
    updateMissingDocuments();
    clearResultsControls();
}
// Return true if the response is ok, false if we signed out otherwise throw an exception..
export async function handleResponse(response, errorMessage) {
    if (!response.ok) {
        const errorData = await response.json();
        debug(errorData);
        if (errorData.detail.includes("JWT")) {
            signOut();
            // The session timed out. Please reconnect.
            addMessage("הסשן פג תוקף. אנא התחבר מחדש.", "error");
            return false;
        }
        if (errorData.detail.includes("User not found")) {
            // If we have an Anonymous account inform the user that his data has been deleted with a modal warning:
            if (userEmail.textContent == ANONYMOUS_EMAIL) {
                showInfoModal("חשבון אנונימי נמחק אוטומטית אחרי 30 יום, יחד עם כל הנתונים שלו. אתה יכול להשתמש בחשבון אנונימי חדש או ליצור משתמש קבוע על ידי הרישמה.");
            }
            clearUserSession();
            return false;
        }
        throw new Error(errorData.detail);
    }
    return true;
}
async function calculateTax(fileName) {
    try {
        if (!signedIn) {
            await signInAnonymous();
        }
        debug("calculateTax", fileName);
        // Extract <name>_<year>.dat
        const taxCalcTaxYear = fileName.split("_")[1].split(".")[0];
        clearMessages();
        showLoadingOverlay("מחשב מס...", {
            total: 30,
            unit: "שניות",
            showCancelButton: false,
        });
        const response = await fetch(`${API_BASE_URL}/calculateTax?customerDataEntryName=${selectedCustomerDataEntryName}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                customerDataEntryName: selectedCustomerDataEntryName,
                taxYear: taxCalcTaxYear,
            }),
            ...fetchConfig,
        });
        if (!(await handleResponse(response, "Calculate tax failed"))) {
            return;
        }
        const result = await response.json();
        // Show success message
        addMessage("חישוב המס הושלם בהצלחה", "info");
        // Store and display results with scroll
        displayTaxCalculation(result, taxCalcTaxYear, true);
        // Add this function to store tax results
        localStorage.setItem("taxResultsYear", taxCalcTaxYear);
        localStorage.setItem("taxResults", JSON.stringify(result));
    }
    catch (error) {
        console.error("Calculate tax failed:", error);
        addMessage("שגיאה בחישוב המס: " + (error instanceof Error ? error.message : String(error)), "error");
    }
    finally {
        hideLoadingOverlay();
        // Check if operation was cancelled
        if (isCancelled) {
            addMessage("הפעולה בוטלה על ידי המשתמש", "warning");
            return;
        }
    }
}
function updateDeleteAllButton(hasEntries) {
    const deleteAllButton = document.getElementById("deleteAllButton");
    deleteAllButton.disabled = !hasEntries;
}
// Helper function to get color class based on numeric value
function getValueColorClass(value) {
    if (!value || value.trim() === "")
        return "";
    // Remove any non-numeric characters except minus sign and decimal point
    const cleanValue = value.replace(/[^\d.-]/g, "");
    const numValue = parseFloat(cleanValue);
    if (isNaN(numValue))
        return "";
    if (numValue <= 0)
        return "negative-value";
    if (numValue > 0)
        return "positive-value";
    return "";
}
// Add this function to display tax results
function displayTaxCalculation(result, year, shouldScroll = false) {
    debug("displayTaxCalculation");
    const taxCalculationContent = document.getElementById("taxCalculationContent");
    taxCalculationContent.innerHTML = ""; // Clear existing results
    // Append year to the title id taxResultsTitle
    const taxResultsTitle = document.getElementById("taxResultsTitle");
    taxResultsTitle.innerHTML = "תוצאות חישוב מס עבור שנה " + year;
    // Create table
    const table = document.createElement("table");
    table.className = "tax-results-table";
    // Add table header
    const thead = document.createElement("thead");
    thead.innerHTML = `
        <tr>
          <th>פרטים</th>
          <th>בן/בת זוג</th>
          <th>בן/בת זוג רשום</th>
          <th>סה"כ</th>
        </tr>
      `;
    table.appendChild(thead);
    // Add table body
    const tbody = document.createElement("tbody");
    result.forEach((row, index) => {
        const tr = document.createElement("tr");
        const isLastRow = index === result.length - 1;
        // Get color class only for the last row's total cell
        const totalColorClass = isLastRow ? getValueColorClass(row.total?.trim() || "") : "";
        // Create the total cell with title for negative values
        const totalCell = document.createElement("td");
        totalCell.className = `${isLastRow ? "highlighted-cell" : ""} ${totalColorClass}`;
        totalCell.textContent = row.total?.trim() || "";
        // Add title for the highlighted cell explaining tax values
        if (isLastRow) {
            totalCell.title = "ערך חיובי = מס שעליך לשלם, ערך שלילי = מס שתקבל בחזרה";
        }
        tr.innerHTML = `
          <td>${row.title}</td>
          <td>${row.spouse?.trim() || ""}</td>
          <td>${row.registered?.trim() || ""}</td>
        `;
        tr.appendChild(totalCell);
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    taxCalculationContent.appendChild(table);
    const taxResultsContainer = document.getElementById("taxResultsContainer");
    taxResultsContainer.classList.add("active");
    // Only scroll if explicitly requested (i.e., after calculation)
    if (shouldScroll) {
        window.scrollTo({
            top: document.body.scrollHeight,
            behavior: "smooth",
        });
    }
}
// Add cookie consent button handler
acceptCookies.addEventListener("click", () => {
    cookieUtils.set("cookiesAccepted", "true", 365); // Cookie expires in 1 year
    cookieConsent.classList.remove("active");
});
// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
    debug("DOMContentLoaded 2");
    const versionNumber = document.getElementById("versionNumber");
    // Get and display version number
    try {
        await loadConfiguration();
        signedIn = false;
        userEmailValue = "";
        versionNumber.textContent = `גרסה ${uiVersion}`;
        const response = await fetch(`${API_BASE_URL}/getBasicInfo`, {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
            credentials: "include",
            ...fetchConfig,
        });
        if (response.ok) {
            const json = await response.json();
            versionNumber.textContent = `גרסה ${json.productVersion} ${uiVersion}`;
            userEmailValue = json.userEmail;
            signedIn = true;
            initializeDocumentIcons();
            await loadExistingFiles();
            await loadResults(false); // Dont scroll
            debug("Successfully loaded files and results with existing token");
        }
    }
    catch (error) {
        console.error("Exception fetching Basic Info:", error);
    }
    if (!signedIn) {
        debug("Failed to fetch version:");
    }
    // Check for Google OAuth2 callback
    checkForGoogleCallback();
    restoreSelectedDocTypes();
    updateSignInUI();
    // Pre-fill feedback email if user is logged in
    if (signedIn) {
        feedbackEmail.value = userEmailValue;
        updateFeedbackButtonState();
    }
    // Add event listeners for document count selects
    document.querySelectorAll('select[id$="-count"]').forEach((select) => {
        // Add option to the select only if the user can add forms
        if (configurationData != null && configurationData.formTypes.some((formType) => formType.userCanAdd)) {
            select.innerHTML += `<option value="create form">צור חדש</option>`;
        }
        // Add event listener to the select
        select.addEventListener("change", async (e) => {
            const target = e.target;
            if (target.value === "create form") {
                // Get the document type from the select's id
                const docType = target.id.replace("-count", "");
                const docTypeName = target.closest(".doc-item")?.getAttribute("data-doc-typename") || "";
                // Create a new form of this type
                const createFormSelect = document.getElementById("createFormSelect");
                if (createFormSelect) {
                    // Find the option that matches this document type
                    const option = Array.from(createFormSelect.options).find((opt) => opt.text.includes(docTypeName));
                    if (option) {
                        createFormSelect.value = option.value;
                        // Trigger the change event on createFormSelect
                        createFormSelect.dispatchEvent(new Event("change"));
                    }
                }
                // Reset the count select to its previous value
                target.value = target.getAttribute("data-previous-value") || "0";
            }
            else {
                // Store the current value for future reference
                target.setAttribute("data-previous-value", target.value);
            }
        });
    });
    // Update form creation select elements according to the form types
    const createFormSelect = document.getElementById("createFormSelect");
    createFormSelect.innerHTML = `<option value="">צור מסמך חדש</option>`;
    // Add the form types that the user can add only if the userCanAdd is true
    if (configurationData != null) {
        createFormSelect.innerHTML += configurationData.formTypes
            .filter((formType) => formType.userCanAdd)
            .map((formType) => {
            const icon = documentIcons[formType.formName] || "📋";
            return `<option value="${formType.formType}">${icon} ${formType.formName}</option>`;
        })
            .join("");
    }
    // Add this new code
    if (usernameParam) {
        // Show the login modal
        //loginOverlay.style.display = "flex";
        loginOverlay.classList.add("active");
        if (signedIn && userEmail.textContent == ANONYMOUS_EMAIL) {
            document.querySelector(".toggle-button[data-mode='signup']").click();
            isAnonymousConversion = true;
        }
        else {
            document.querySelector(".toggle-button[data-mode='signin']").click();
            isAnonymousConversion = false;
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
    }
    const toggleLink = document.getElementById("toggleFileListView");
    if (toggleLink) {
        toggleLink.addEventListener("click", (e) => {
            if (signedIn) {
                e.preventDefault();
                toggleFileListView();
            }
        });
    }
    // Check if user has already accepted cookies
    const cookiesAccepted = cookieUtils.get("cookiesAccepted");
    if (!cookiesAccepted) {
        const cookieConsent = document.getElementById("cookieConsent");
        if (cookieConsent) {
            cookieConsent.classList.add("active");
        }
    }
    // Check if disclaimer has been accepted
    const disclaimerAccepted = cookieUtils.get("disclaimerAccepted");
    if (!disclaimerAccepted) {
        //await showDisclaimerModal();
        await showInfoModal("אתר זה זמין ללא תשלום במטרה לסייע לאנשים המעוניינים להכין את הדו״ח השנתי שלהם למס הכנסה בעצמם. איננו מייצגים אתכם מול רשויות המס. אנא קראו בעיון את התנאים וההגבלות לפני המשך השימוש.");
        cookieUtils.set("disclaimerAccepted", "true", 365);
    }
    // Initialize the file list view
    updateFileListView();
});
// Function to validate email format
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
// Function to update feedback button state
function updateFeedbackButtonState() {
    sendFeedbackButton.disabled = !isValidEmail(feedbackEmail.value) || !privacyCheckbox.checked;
}
// Add event listeners for both email input and privacy checkbox
feedbackEmail.addEventListener("input", updateFeedbackButtonState);
privacyCheckbox.addEventListener("change", updateFeedbackButtonState);
// Add feedback submission handler
sendFeedbackButton.addEventListener("click", async () => {
    try {
        const email = feedbackEmail.value;
        const message = feedbackMessage.value;
        const response = await fetch(`${API_BASE_URL}/feedback`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                email: email,
                message: message,
            }),
            ...fetchConfig,
        });
        if (!(await handleResponse(response, "Feedback submission failed"))) {
            return;
        }
        addMessage("תודה על המשוב שלך!", "success");
        // Clear the form
        clearFeedbackForm();
    }
    catch (error) {
        console.error("Failed to submit feedback:", error);
        addMessage("שגיאה בשליחת המשוב: " + (error instanceof Error ? error.message : String(error)), "error");
    }
});
// Add change handlers for document count selects
document.querySelectorAll(".doc-controls select").forEach((select) => {
    select.addEventListener("change", () => {
        const docItem = select.closest(".doc-item");
        if (parseInt(select.value) > 0) {
            docItem.classList.add("selected");
        }
        else {
            docItem.classList.remove("selected");
        }
        saveSelectedDocTypes();
        updateMissingDocuments();
    });
});
function clearFeedbackForm() {
    feedbackEmail.value = "";
    feedbackMessage.value = "";
    privacyCheckbox.checked = false;
    updateFeedbackButtonState();
}
// Function to save selected doc types to localStorage
function saveSelectedDocTypes() {
    const docSelections = {};
    document.querySelectorAll(".doc-controls select").forEach((select) => {
        const docItem = select.closest(".doc-item");
        const docType = docItem.dataset.docType;
        if (docType) {
            docSelections[docType] = select.value;
        }
    });
    localStorage.setItem("docSelections", JSON.stringify(docSelections));
}
// Function to restore selected doc types from localStorage
function restoreSelectedDocTypes() {
    const savedSelections = JSON.parse(localStorage.getItem("docSelections") || "{}");
    Object.entries(savedSelections).forEach(([docType, value]) => {
        const docItem = document.querySelector(`.doc-item[data-doc-type="${docType}"]`);
        if (docItem) {
            const select = docItem.querySelector("select");
            if (select) {
                select.value = value;
                // Update selected class based on value
                if (parseInt(value) > 0) {
                    docItem.classList.add("selected");
                }
                else {
                    docItem.classList.remove("selected");
                }
            }
        }
    });
}
// Add change handler for form select
document.getElementById("createFormSelect").addEventListener("change", async (e) => {
    if (!signedIn) {
        await signInAnonymous();
    }
    const formType = e.target.value;
    if (!formType)
        return;
    const identificationNumber = defaultClientIdentificationNumber;
    try {
        const response = await fetch(`${API_BASE_URL}/createForm`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                customerDataEntryName: selectedCustomerDataEntryName,
                formType: formType,
                identificationNumber: identificationNumber,
            }),
            ...fetchConfig,
        });
        if (!(await handleResponse(response, "Create form failed"))) {
            return;
        }
        const fileInfoList = await response.json();
        updateFileListP(fileInfoList, true); // true = new form creation
        clearResultsControls();
        clearMessages();
        // Jump to the last file in the file list
        openFileListEntryP(fileInfoList[fileInfoList.length - 1].fileName, null, true);
        addMessage("הטופס נוצר בהצלחה", "success");
        // Reset select to default option
        e.target.value = "";
    }
    catch (error) {
        console.error("Failed to create form:", error);
        addMessage("שגיאה ביצירת הטופס: " + (error instanceof Error ? error.message : String(error)), "error");
    }
    // return the control to its first option
    e.target.value = "";
});
// Add this function to update missing document counts
function updateMissingDocuments() {
    // Get all documents from file list
    const fileListDocs = getDocTypes();
    // Count documents by type
    const docCounts = fileListDocs.reduce((acc, type) => {
        if (type) {
            acc[type] = (acc[type] || 0) + 1;
        }
        return acc;
    }, {});
    const missingDocs = [];
    // const allDocsZero = Array.from(document.querySelectorAll('.doc-controls select'))
    //   .every(select => select.value === '0');
    // Check each doc-item and update missing count
    document.querySelectorAll(".doc-item").forEach((item) => {
        const docType = item.dataset.docType;
        const docTypename = item.dataset.docTypename;
        const select = item.querySelector("select");
        const missingLabel = document.getElementById(`${docType}-missing`);
        if (select && missingLabel) {
            const required = parseInt(select.value);
            const uploaded = docCounts[docTypename] || 0;
            //debug("docType:", docType, "docTypename:", docTypename, "required:", required, "uploaded:", uploaded);
            const missing = Math.max(0, required - uploaded);
            //debug("missing:", missing);
            if (missing > 0) {
                missingLabel.textContent = `חסר ${missing}`;
                missingDocs.push({
                    name: item.querySelector("h3").textContent || "",
                    count: missing,
                });
            }
            else {
                missingLabel.textContent = "";
            }
        }
    });
    // Update warning section
    const warningSection = document.getElementById("missingDocsWarning");
    //const warningList = document.getElementById("missingDocsList") as HTMLUListElement;
    if (missingDocs.length > 0) {
        warningSection.innerHTML = `<strong>שים לב!</strong> חסרים המסמכים הבאים: ${missingDocs.map((doc) => doc.name).join(", ")}`;
        const warningList = document.createElement("ul");
        warningList.className = "missing-docs-list";
        warningList.innerHTML += missingDocs.map((doc) => `<li>${doc.name}: חסר ${doc.count}</li>`).join("");
        warningSection.appendChild(warningList);
        warningSection.classList.add("visible");
        warningSection.classList.remove("success");
    }
    else if (Object.keys(docCounts).length > 0) {
        // Show summary when no documents are missing and all selectors are zero
        warningSection.classList.add("visible");
        warningSection.classList.add("success");
        const summary = Object.entries(docCounts)
            .map(([type, count]) => {
            const docItem = document.querySelector(`.doc-item[data-doc-typename="${type}"]`);
            if (docItem == null) {
                debug("Unhandled type:", type);
                if (type === "null")
                    return "";
            }
            //const docName = docItem ? docItem.querySelector('h3').textContent : type;
            const docName = type;
            //debug("docName:", docName, "docItem:", docItem, "type:", type, "count:", count);
            return `<li>${docName}: ${count} מסמכים</li>`;
        })
            .join("");
        warningSection.innerHTML = `<strong>סיכום מסמכים:</strong>${summary}`;
    }
    else {
        warningSection.classList.remove("visible");
        warningSection.classList.remove("success");
    }
}
// Function to initialize document icons from info panel
function initializeDocumentIcons() {
    document.querySelectorAll(".doc-item").forEach((item) => {
        const docType = item.getAttribute("data-doc-typename");
        const icon = item.querySelector(".doc-icon");
        if (docType && icon) {
            documentIcons[docType] = icon.textContent;
        }
    });
}
async function convertAnonymousAccount(email, password, fullName) {
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
    if (!(await handleResponse(response, "Convert anonymous account failed"))) {
        return;
    }
    const result = await response.json();
    signOut();
    updateSignInUI();
}
// General warning modal function that returns a promise
function showInfoModal(message) {
    return new Promise((resolve) => {
        const infoMessage = document.getElementById("infoMessage");
        infoMessage.textContent = message;
        const modal = document.getElementById("generalInfoModal");
        modal.style.display = "block";
        // Handle close button
        modal.querySelector(".close-button").onclick = () => {
            modal.style.display = "none";
            resolve(false);
        };
        // Handle confirm button
        modal.querySelector(".confirm-button").onclick = () => {
            modal.style.display = "none";
            resolve(true);
        };
    });
}
// General warning modal function that returns a promise
function showWarningModal(message) {
    return new Promise((resolve) => {
        const warningMessage = document.getElementById("warningMessage");
        warningMessage.textContent = message;
        const modal = document.getElementById("generalWarningModal");
        modal.style.display = "block";
        // Handle close button
        modal.querySelector(".close-button").onclick = () => {
            modal.style.display = "none";
            resolve(false);
        };
        // Handle cancel button
        modal.querySelector(".cancel-button").onclick = () => {
            modal.style.display = "none";
            resolve(false);
        };
        // Handle confirm button
        modal.querySelector(".confirm-button").onclick = () => {
            modal.style.display = "none";
            resolve(true);
        };
    });
}
function updateFileListView() {
    const toggleLink = document.getElementById("toggleFileListView");
    const fileList = document.getElementById("fileList");
    const expandableArea = document.getElementById("expandableAreaUploadFiles");
    if (!toggleLink || !fileList || !expandableArea) {
        console.error("Required elements not found");
        return;
    }
    if (editableFileList) {
        toggleLink.textContent = "נתונים קבצים";
        toggleLink.classList.add("active");
        fileList.style.display = "none";
        expandableArea.style.display = "block";
    }
    else {
        toggleLink.textContent = "תציג נתונים מלאים";
        toggleLink.classList.remove("active");
        fileList.style.display = "block";
        expandableArea.style.display = "none";
    }
}
// If we are doing something after this we should await it.
async function toggleFileListView() {
    editableFileList = !editableFileList;
    localStorage.setItem("editableFileList", editableFileList.toString());
    updateFileListView();
    await loadExistingFiles();
}
async function signInWithGoogle() {
    try {
        // Redirect to our backend Google OAuth endpoint
        const url = `${AUTH_BASE_URL}/google`;
        debug("Redirecting to Google OAuth:", url);
        window.location.href = url;
    }
    catch (error) {
        console.error("Error initiating Google login:", error);
        addMessage("שגיאה בהתחברות עם Google", "error");
    }
}
async function handleGoogleCallback() {
    try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (!code) {
            throw new Error("Missing code parameter");
        }
        const baseUrl = signedIn ? API_BASE_URL : AUTH_BASE_URL;
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
        userEmailValue = result.email;
        signedIn = true; // Set to true since we have a valid response
        // Update UI with user info
        updateSignInUI();
        await loadExistingFiles();
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
        addMessage("התחברת בהצלחה עם Google", "success");
    }
    catch (error) {
        console.error("Error handling Google callback:", error);
        addMessage("שגיאה בהתחברות עם Google", "error");
    }
}
function checkForGoogleCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    if (code) {
        // We're in the OAuth2 callback
        handleGoogleCallback();
    }
}
if (customerSelect) {
    customerSelect.addEventListener("change", () => {
        if (customerSelect.value === "new") {
            customerNameInput.value = "";
            customerNameInput.focus();
        }
        else {
            customerNameInput.value = customerSelect.value;
            updateCustomerButton.disabled = customerNameInput.value === selectedCustomerDataEntryName;
            // If selecting an existing customer, switch to it immediately
            if (customerSelect.value !== selectedCustomerDataEntryName) {
                updateSelectedCustomer(customerSelect.value);
                // Update customer button text
                if (customerButton) {
                    customerButton.textContent = translateCustomerDataEntryName(selectedCustomerDataEntryName);
                }
                // Reload files and results with the new customer
                loadExistingFiles();
                loadResults(false);
                addMessage(`עברת ללקוח: ${customerSelect.value}`, "info");
                // Dismiss the customer modal
                customerOverlay.classList.remove("active");
            }
        }
    });
}
if (customerNameInput) {
    customerNameInput.addEventListener("input", () => {
        const inputValue = customerNameInput.value.trim();
        const isEmpty = inputValue === "";
        const isSameAsCurrent = inputValue === selectedCustomerDataEntryName;
        // Check if name already exists (for both new and existing customers)
        let isDuplicate = false;
        if (customerListCache && inputValue) {
            const existingNames = customerListCache.map((customer) => customer.name);
            isDuplicate = existingNames.includes(inputValue);
        }
        updateCustomerButton.disabled = isEmpty || isSameAsCurrent || isDuplicate;
    });
}
if (updateCustomerButton) {
    updateCustomerButton.addEventListener("click", updateCustomerName);
}
// Customer modal event handlers
if (customerButton) {
    customerButton.addEventListener("click", () => {
        customerOverlay.classList.add("active");
        loadCustomerList();
    });
}
if (customerOverlay) {
    // Close modal when clicking on overlay
    customerOverlay.addEventListener("click", (e) => {
        if (e.target === customerOverlay) {
            customerOverlay.classList.remove("active");
        }
    });
    // Close modal when clicking close button
    const customerCloseButton = customerOverlay.querySelector(".close-button");
    if (customerCloseButton) {
        customerCloseButton.addEventListener("click", () => {
            customerOverlay.classList.remove("active");
        });
    }
}
function translateError(error) {
    const tranlationTable = {
        // "NetworkError when attempting to fetch resource": "לא מצא את השרות. נא לבדוק את החיבור לאינטרנט.יתכן בעיה נמנית. תנסה שוב יותר מאוחר.",
        "HTTP error! status: Bad credentials 401": "שם משתמש או סיסמה שגויים",
    };
    debug("translateError:", error);
    return tranlationTable[error] || error;
}
const accountOverlay = document.getElementById("accountOverlay");
const closeAccountModal = document.getElementById("closeAccountModal");
const deleteAccountButton = document.getElementById("deleteAccountButton");
userEmail.addEventListener("click", () => {
    if (signedIn && userEmail.textContent !== ANONYMOUS_EMAIL) {
        accountOverlay.classList.add("active");
    }
});
closeAccountModal.addEventListener("click", () => {
    accountOverlay.classList.remove("active");
});
window.addEventListener("click", (event) => {
    if (event.target === accountOverlay) {
        accountOverlay.classList.remove("active");
    }
});
deleteAccountButton.addEventListener("click", async () => {
    if (confirm("האם אתה בטוח שברצונך למחוק את החשבון וכל הנתונים? פעולה זו אינה הפיכה.")) {
        try {
            const response = await fetch(`${API_BASE_URL}/deleteAccount`, {
                method: "DELETE",
                credentials: "include"
            });
            if (response.ok) {
                alert("החשבון נמחק. תנותק מהמערכת.");
                accountOverlay.classList.remove("active");
                // Sign out the user and refresh UI
                clearUserSession();
                //location.reload();
            }
            else {
                const errorText = await response.text();
                alert("שגיאה במחיקת החשבון: " + errorText);
            }
        }
        catch (err) {
            alert("שגיאה במחיקת החשבון: " + err);
        }
    }
});
//# sourceMappingURL=index.js.map