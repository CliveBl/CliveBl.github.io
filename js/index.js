import { getFriendlyName, isCurrencyField } from "./constants.js";
const uiVersion = "0.48";
const defaultId = "000000000";
const ANONYMOUS_EMAIL = "AnonymousEmail";
export let configurationData;
let latestFileInfoList = [];
let documentIcons = {};
let isUploading = false;
let userEmailValue = "";
let signedIn = false;
const fetchConfig = {
    mode: "cors",
};
// Add this near the top of your script
const DEBUG = true;
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
const createFormSelect = document.getElementById("createFormSelect");
const acceptCookies = document.getElementById("acceptCookies");
const cookieConsent = document.getElementById("cookieConsent");
export function updateButtons(hasEntries) {
    if (!isUploading) {
        processButton.disabled = !hasEntries;
        deleteAllButton.disabled = !hasEntries;
    }
}
function updateFileListP(fileInfoList) {
    if (editableFileList) {
        displayFileInfoInExpandableArea(fileInfoList, structuredClone(fileInfoList), false);
        updateButtons(editableFileListHasEntries());
        updateMissingDocuments();
    }
    else {
        updateFileList(fileInfoList);
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
function openFileListEntryP(fileName) {
    if (editableFileList) {
        editableOpenFileListEntry(fileName);
    }
    else {
        openFileListEntry(fileName);
    }
}
function openFileListEntry(fileName) {
    // Find the file item by looking for the span with class 'fileNameElement' that contains the fileName
    const fileNameElements = document.querySelectorAll(".fileNameElement");
    for (const element of fileNameElements) {
        if (element.textContent?.trim().startsWith(fileName)) {
            // Click the parent file-header to open the accordion
            const fileHeader = element.closest(".file-header");
            if (fileHeader) {
                // scroll the fileHeader into view
                fileHeader.scrollIntoView({ behavior: "smooth" });
                fileHeader.click();
                break;
            }
        }
    }
}
function getDocTypes() {
    if (editableFileList) {
        return editableGetDocTypes();
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
        debug("Sign in response:", response.status);
        if (!response.ok) {
            const errorData = await response.json();
            debug(errorData);
            throw new Error(`HTTP error! status: ${errorData.detail} ${response.status}`);
        }
        const result = await response.json();
        userEmailValue = result.email;
        signedIn = result.expirationTime;
        updateSignInUI();
        return;
    }
    catch (error) {
        debug("Sign in error:", error);
        throw error;
    }
}
// Update signIn function
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
        signedIn = result.expirationTime;
        updateSignInUI();
        return;
    }
    catch (error) {
        console.error("Sign in failed:", error);
        debug("Sign in error details:", error);
        throw error;
    }
}
function updateSignInUI() {
    if (signedIn) {
        userEmail.textContent = userEmailValue;
        if (userEmailValue == ANONYMOUS_EMAIL) {
            signOutButton.disabled = true;
            loginButton.disabled = false;
        }
        else {
            signOutButton.disabled = false;
        }
    }
    else {
        userEmail.textContent = "";
        signOutButton.disabled = true;
    }
}
// Update the sign out function
function signOut() {
    debug("signOut");
    userEmailValue = "";
    signedIn = false;
    // Delete the cookie by calling the signOut api
    fetch(`${API_BASE_URL}/signOut`, {
        method: "POST",
        credentials: "include",
    });
    // Update UI to show logged out state
    updateSignInUI();
    removeFileList();
    fileModifiedActions(false);
    clearMessages();
    //addMessage("התנתקת בהצלחה");
}
// Add this function to load files with existing token
async function loadExistingFiles() {
    try {
        debug("loadExistingFiles");
        const response = await fetch(`${API_BASE_URL}/getFilesInfo?customerDataEntryName=Default`, {
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
        debug("Failed to load files:", error);
        // Only show message if it's not an auth error
        if (error instanceof Error && !error.message.includes("Invalid token")) {
            addMessage("שגיאה בטעינת רשימת הקבצים: " + error.message);
        }
        throw error;
    }
}
// Add this helper function at the start of your script
function isValidFileType(file) {
    const validTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/gif", "image/bmp", "image/png"];
    if (!validTypes.includes(file.type)) {
        return {
            valid: false,
            message: `סוג קובץ לא נתמך - רק קבצי PDF ,JPG ,GIF ,BMP ,PNG מותרים. שם הקובץ: ${file.name} (${file.webkitRelativePath})`,
        };
    }
    return { valid: true };
}
// Add this helper function to check if file is in GeneratedTaxForms folder
function isInGeneratedTaxFormsFolder(filePath) {
    return filePath.includes("GeneratedTaxForms");
}
// Add this function to update the file list from server response
function updateFileList(fileInfoList) {
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
        const year = fileInfo.taxYear || "ללא שנה";
        if (!filesByYear.has(year)) {
            filesByYear.set(year, []);
        }
        filesByYear.get(year)?.push(fileInfo);
    });
    // Sort years in descending order
    const sortedYears = Array.from(filesByYear.keys()).sort((a, b) => {
        if (a === "Other")
            return 1;
        if (b === "Other")
            return -1;
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
            yearBody.appendChild(fileElement);
        });
        yearAccordion.appendChild(yearHeader);
        yearAccordion.appendChild(yearBody);
        fileList.appendChild(yearAccordion);
        // If this is a newly added file (check if it's the last file in the data array)
        const lastFile = fileInfoList[fileInfoList.length - 1];
        if (lastFile && (lastFile.taxYear === year || lastFile.type === "FormError")) {
            // Expand the year accordion
            yearBody.style.display = "block";
            yearToggle.textContent = "-";
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
async function uploadFilesListener(fileInput) {
    clearMessages();
    // Filter out invalid files first
    const files = Array.from(fileInput.files || []);
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
    return uploadFilesWithButtonProgress(validFiles, fileInput);
}
// File upload handler
fileInput.addEventListener("change", async () => {
    await uploadFilesListener(fileInput);
});
// Folder upload handler. Always use individual uploads
folderInput.addEventListener("change", async () => {
    clearMessages();
    const files = Array.from(folderInput.files || []);
    // Sort and filter files
    const validFiles = files
        .sort((a, b) => {
        const pathA = a.webkitRelativePath || a.name;
        const pathB = b.webkitRelativePath || b.name;
        return pathA.localeCompare(pathB);
    })
        .filter((file) => {
        if (isInGeneratedTaxFormsFolder(file.webkitRelativePath || file.name) || file.name.match(/TaxAnalysis_\d{4}\.xlsx/)) {
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
    await uploadFilesWithButtonProgress(validFiles, folderInput);
});
function showLoadingOverlay(message) {
    const loadingMessage = document.getElementById("loadingMessage");
    loadingMessage.textContent = message;
    const loadingOverlay = document.getElementById("loadingOverlay");
    loadingOverlay.classList.add("active");
}
function hideLoadingOverlay() {
    const loadingOverlay = document.getElementById("loadingOverlay");
    loadingOverlay.classList.remove("active");
}
// Update the process button handler
processButton.addEventListener("click", async () => {
    try {
        if (!signedIn) {
            await signInAnonymous();
        }
        showLoadingOverlay("מעבדת מסמכחם...");
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
                customerDataEntryName: "Default",
            }),
        });
        if (!(await handleResponse(response, "Process files failed"))) {
            return;
        }
        const result = await response.json();
        debug("Processing response:", result);
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
    }
});
async function uploadFilesWithButtonProgress(validFiles, button) {
    const buttonLabel = button.nextElementSibling;
    const originalText = buttonLabel.textContent;
    let success = false;
    isUploading = true;
    // Disable the upload buttons
    fileInput.disabled = true;
    folderInput.disabled = true;
    createFormSelect.disabled = true;
    buttonLabel.innerHTML = "⏳ מעלה...";
    buttonLabel.classList.add("uploading");
    try {
        if (!signedIn) {
            await signInAnonymous();
        }
        // Upload files one by one
        success = await uploadFiles(validFiles);
    }
    catch (error) {
        console.error("UploadFile failed:", error);
        addMessage("שגיאה באימות: " + (error instanceof Error ? error.message : String(error)), "error");
    }
    finally {
        // Restore button text
        buttonLabel.innerHTML = originalText || "";
        buttonLabel.classList.remove("uploading");
        button.value = "";
        // Re-enable the upload buttons
        fileInput.disabled = false;
        folderInput.disabled = false;
        createFormSelect.disabled = false;
        isUploading = false;
        //updateDeleteAllButton(fileList.children.length > 0);
        updateButtons(editableFileListHasEntries() || fileList.children.length > 0);
        // Clear all containers
        clearResultsControls();
    }
    return success;
}
async function uploadFiles(validFiles) {
    let fileInfoList = null;
    for (const file of validFiles) {
        try {
            let newFile = file;
            if (file.type.startsWith("image/")) {
                try {
                    newFile = (await convertImageToBWAndResize(file));
                }
                catch (error) {
                    addMessage("שגיאה בעיבוד התמונה: " + file.name + " " + (error instanceof Error ? error.message : String(error)), "error");
                    continue;
                }
            }
            const formData = new FormData();
            formData.append("file", newFile);
            const metadata = {
                customerDataEntryName: "Default",
            };
            formData.append("metadata", new Blob([JSON.stringify(metadata)], {
                type: "application/json",
            }));
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
            updateFileListP(fileInfoList);
        }
        catch (error) {
            console.error("Upload failed:", error);
            clearMessages();
            addMessage("שגיאה בהעלאת הקובץ: " + (error instanceof Error ? error.message : String(error)), "error");
            return false;
        }
    }
    // Count the error types in the fileInfoList
    const errorTypes = fileInfoList.filter((fileInfo) => fileInfo.type === "FormError").length;
    if (errorTypes > 0) {
        addMessage(`הועלו ${validFiles.length} קבצים בהצלחה, מתוך ${fileInfoList.length} קבצים יש שגיאות ${errorTypes}`, "warning");
    }
    else {
        addMessage(`הועלו ${validFiles.length} קבצים בהצלחה`, "info");
    }
    return true;
}
// Update addMessage function to handle message types
export function addMessage(text, type = "info", scrollToMessageSection = true) {
    const messageDiv = document.createElement("div");
    messageDiv.className = "message-item";
    if (type) {
        messageDiv.classList.add(type);
    }
    const messageText = document.createElement("span");
    messageText.className = "message-text";
    const textParts = text.split(":");
    // Check if the text contains a message code
    if (textParts && textParts.length > 2) {
        // Eliminate the textParts[1] code from the text
        const textToDisplay = `${textParts[0]}:${textParts.slice(2).join(":")}`;
        messageText.textContent = textToDisplay;
    }
    else {
        messageText.textContent = text;
    }
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
        // Match the pattern fileName=.*,
        const fileName = text.match(/fileName=([^,]+)/)?.[1];
        if (fileName) {
            // Eliminate fileName= from the text
            messageText.textContent = messageText.textContent.replace("fileName=", "");
            // Add clickable class to show it's interactive
            messageDiv.classList.add("clickable");
            // Make the messageDiv a clickable link to the fileItem
            messageDiv.addEventListener("click", () => {
                openFileListEntryP(fileName);
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
        const feedbackMessage = document.getElementById("feedbackMessage");
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
            signupButton.click();
        }
        isAnonymousConversion = true;
    }
    else {
        const signinButton = document.querySelector(".toggle-button[data-mode='signin']");
        if (signinButton) {
            signinButton.click();
        }
        isAnonymousConversion = false;
    }
});
closeButton.addEventListener("click", () => {
    loginOverlay.classList.remove("active");
});
loginOverlay.addEventListener("click", (e) => {
    if (e.target === loginOverlay) {
        loginOverlay.classList.remove("active");
    }
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
    const password = document.getElementById("password");
    const fullName = document.getElementById("fullName");
    const isSignup = document.querySelector(".toggle-button.active")?.dataset.mode === "signup";
    try {
        if (isSignup) {
            if (isAnonymousConversion) {
                await convertAnonymousAccount(email.value, password.value, fullName.value);
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
                        password: password.value,
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
            password.value = "";
            fullName.value = "";
        }
        else {
            // Call the signIn API
            await signIn(email.value, password.value);
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
        }
        //addMessage("התחברת בהצלחה!");
        loginOverlay.classList.remove("active");
    }
    catch (error) {
        console.error("Login failed:", error);
        // Clear previous messages
        clearMessages();
        addMessage("שגיאה בהתחברות: " + (error instanceof Error ? error.message : String(error)), "error");
        // Dismiss the login overlay
        loginOverlay.classList.remove("active");
    }
});
const googleLogin = document.querySelector(".google-login");
googleLogin.addEventListener("click", () => {
    debug("Google login clicked");
});
const githubLogin = document.querySelector(".github-login");
githubLogin.addEventListener("click", () => {
    debug("GitHub login clicked");
});
async function loadResults(scrollToMessageSection = true) {
    try {
        const response = await fetch(`${API_BASE_URL}/getResultsInfo?customerDataEntryName=Default`, {
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
function clearMessages() {
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
    else if (name === "1301") {
        // Data file containing the annual data for uploading to the tax authority when filing the tax return
        description = `${year}: קובץ נתונים שנתיים להעלאה אתר מס הכנסה בזמן הגשת דו"ח שנתי`;
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
        const response = await fetch(`${API_BASE_URL}/downloadResultsFile?fileName=${encodeURIComponent(fileName)}&customerDataEntryName=Default`, {
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
        const response = await fetch(`${API_BASE_URL}/deleteAllFiles?customerDataEntryName=Default`, {
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
// Keep the docDetails object for hover functionality
const docDetails = {
    form106: {
        title: "טופס 106 - פירוט מלא",
        sections: [
            {
                title: "מה זה טופס 106?",
                content: "טופס 106 הוא דיווח שנתי שמנפיק המעסיק לעובד ומפרט את כל התשלומים והניכויים במהלך שנת המס.",
            },
            {
                title: "מתי מקבלים את הטופס?",
                content: "המעסיק חייב להנפיק את הטופס עד סוף חודש מרץ בשנה העוקבת לשנת המס.",
            },
            {
                title: "מה כולל הטופס?",
                content: `
              - פרטי העובד והמעסיק
              - סך כל ההכנסות מעבודה
              - ניכויי מס הכנסה
              - ניכויי ביטוח לאומי
              - הפרשות לקופות גמל ופנסיה
              - שווי הטבות ותשלומים נוספים
            `,
            },
        ],
    },
    "capital-gains": {
        title: "אישורי רווח הון - פירוט מלא",
        sections: [
            {
                title: "מה הם אישורי רווח הון?",
                content: "אישורים שנתיים מהבנקים המפרטים את הרווחים וההפסדים מעסקאות בניירות ערך.",
            },
            {
                title: "מתי מקבלים את האישורים?",
                content: "הבנקים מנפיקים את האישורים עד סוף חודש מרץ בשנה העוקבת.",
            },
            {
                title: "מה כולל האישור?",
                content: `
              - פירוט כל העסקאות בניירות ערך
              - רווחים והפסדים מכל עסקה
              - סיכום שנתי של הרווחים וההפסדים
              - מס שנוכה במקור
            `,
            },
        ],
    },
    residency: {
        title: "אשור תושב - פירוט מלא",
        sections: [
            {
                title: "מהו אישור תושב?",
                content: "אישור מהרשות המקומית המעיד על מגורים בייוב המזכה בהטבת מס.",
            },
            {
                title: "למה צריך את האישור?",
                content: "האישור נדרש כדי לקבל זיכוי ממס הכנסה בהתאם ליישב המגורים.",
            },
        ],
    },
    donations: {
        title: "אישורי תרומות - פירוט מלא",
        sections: [
            {
                title: "מה הם אישורי תרומות?",
                content: "אישורים שנתיים מהמוסדות המפרטים את סכומי התרומות למוסדות מוכרים.",
            },
            {
                title: "מתי מקבלים את האישורים?",
                content: "המוסדות מנפיקים את האישורים עד סוף חודש מרץ בשנה העוקבת.",
            },
            {
                title: "מה כולל האישור?",
                content: `
              - סכומי התרומות למוסדות מוכרים
              - פרטי המוסד המוכר
              - תאריכי התרומות
            `,
            },
        ],
    },
    education: {
        title: "לימודים אקדמאיים - פירוט מלא",
        sections: [
            {
                title: "מה נחשב להוצאות לימודים מוכרות?",
                content: "שכר לימוד במוסד אקדמי מוכר לתואר ראשון או שני.",
            },
            {
                title: "איזה מסמכים נדרשים?",
                content: `
              - אישור על סיום לימודים או תעודת זכאות לתואר
              - קבלות על תשלום שכר לימוד
              - אישור מהמוסד על היקף הלימודים
            `,
            },
        ],
    },
    "national-insurance": {
        title: "ביטוח לאומי - פירוט מלא",
        sections: [
            {
                title: "מהו האישור השנתי מביטוח לאומי?",
                content: "אישור שנתי מביטוח לאומי מפרט את כל התשלומים וההחזרים שהתקבלו מביטוח לאומי במהלך השנה.",
            },
            {
                title: "איזה מסמכים נדרשים?",
                content: `
              - אישור שנתי מביטוח לאומי
              - פירוט כל סוגי התשלומים וההחזרים
              - סכום מספרים ותריכי תשלום
            `,
            },
        ],
    },
    "service-release": {
        title: "תעודת שחרור משירות צבאי או לאומי",
        sections: [
            {
                title: "מהי תעודת שחרור?",
                content: "תעודת שחרור היא מסמך רשמי המעיד על סיום השירות הצבאי או הלאומי. התעודה כוללת פרטים על תקופת השירות ומועד השחרור.",
            },
            {
                title: "למה זה חשוב?",
                content: "חיילים משוחררים זכאים להטבות מס בשנת השחרור ובשנה שלאחריה. התעודה נדרשת כדי לקבל את ההטבות הללו.",
            },
            {
                title: "איך להשיג את התעודה?",
                content: "ניתן לקבל העתק של תעודת השחרור דרך אתר 'שירות אישי' של צה\"ל או במשרדי היחידה להכוונת חיילים משוחררים.",
            },
        ],
    },
    "identity-document": {
        title: "תעודת זהות - פירוט מלא",
        sections: [
            {
                title: "מהו תעודת זהות?",
                content: "תעודת זהות היא מסמך המעיד על זהות המגיש את הדוח למס הכנסה.",
            },
            {
                title: "איך להכין את תעודת הזהות?",
                content: "ניתן להכין את תעודת הזהות בשתי דרכים:\n1. להכין באופן ידני\n2.  צילום תעודת זהות",
            },
            {
                title: "העלאת תעודת הזהות",
                content: "ניתן לצלם את תעודת הזהות על גב המסמך המצורף, כל עוד התמונה לא תכסה שום מידע מהמסמך המצורף.",
            },
        ],
    },
};
// Keep the hover functionality
document.addEventListener("DOMContentLoaded", () => {
    debug("DOMContentLoaded 1");
    const docDetailsModal = document.getElementById("docDetailsModal");
    const docDetailsTitle = docDetailsModal.querySelector(".doc-details-title");
    const docDetailsBody = docDetailsModal.querySelector(".doc-details-body");
    // Add click handlers for doc items
    document.querySelectorAll(".doc-item").forEach((docItem) => {
        docItem.addEventListener("click", (e) => {
            // Don't show info if clicking on select or within doc-controls
            if (e.target && e.target.closest(".doc-controls")) {
                return;
            }
            const docType = docItem.dataset.docType;
            const details = docDetails[docType];
            if (details) {
                // If clicking the same panel that's already showing info, close it
                if (docDetailsModal.style.display === "block" && docDetailsModal.dataset.currentDocType === docType) {
                    docDetailsModal.style.display = "none";
                    return;
                }
                const itemBounds = docItem.getBoundingClientRect();
                docDetailsTitle.textContent = details.title;
                docDetailsBody.innerHTML = details.sections
                    .map((section) => `
              <h4>${section.title}</h4>
              <p>${section.content}</p>
            `)
                    .join("");
                docDetailsModal.style.top = `${itemBounds.bottom + 5}px`;
                docDetailsModal.style.left = `${itemBounds.left}px`;
                docDetailsModal.dataset.currentDocType = docType;
                docDetailsModal.style.display = "block";
            }
        });
    });
    // Close modal when clicking outside
    document.addEventListener("click", (e) => {
        if (!docDetailsModal.contains(e.target) && !e.target.closest(".doc-item")) {
            docDetailsModal.style.display = "none";
        }
    });
    // Add click handlers for more info buttons
    document.querySelectorAll(".more-info-button").forEach((button) => {
        button.addEventListener("click", (e) => {
            e.stopPropagation(); // Prevent doc-item click
            const docItem = button.closest(".doc-item");
            const docType = docItem.dataset.docType;
            const details = docDetails[docType];
            if (details) {
                // If clicking the same button that's already showing info, close it
                if (docDetailsModal.style.display === "block" && docDetailsModal.dataset.currentDocType === docType) {
                    docDetailsModal.style.display = "none";
                    return;
                }
                const itemBounds = docItem.getBoundingClientRect();
                docDetailsTitle.textContent = details.title;
                docDetailsBody.innerHTML = details.sections
                    .map((section) => `
                  <h4>${section.title}</h4>
                  <p>${section.content}</p>
                `)
                    .join("");
                docDetailsModal.style.top = `${itemBounds.bottom + 5}px`;
                docDetailsModal.style.left = `${itemBounds.left}px`;
                docDetailsModal.dataset.currentDocType = docType;
                docDetailsModal.style.display = "block";
            }
        });
    });
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
function addFileToList(fileInfo) {
    async function deleteFile(fileId) {
        try {
            const response = await fetch(`${API_BASE_URL}/deleteFile?fileId=${fileId}&customerDataEntryName=Default`, {
                method: "DELETE",
                headers: {},
                credentials: "include",
                ...fetchConfig,
            });
            if (!(await handleResponse(response, "Delete failed"))) {
                return;
            }
            fileList.removeChild(li);
            fileModifiedActions(fileList.children.length > 0);
        }
        catch (error) {
            console.error("Delete failed:", error);
            addMessage("שגיאה במחיקת הקובץ: " + (error instanceof Error ? error.message : String(error)), "error");
        }
    }
    async function deleteFileQuietly(fileId) {
        try {
            const response = await fetch(`${API_BASE_URL}/deleteFile?fileId=${fileId}&customerDataEntryName=Default`, {
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
                field.innerHTML = `<strong>${getFriendlyName(key)}:</strong> ${value}`;
                accordionContent.appendChild(field);
            }
        }
    });
    fileInfoElement.appendChild(accordionContent);
    // Create edit button
    const editButton = document.createElement("button");
    editButton.textContent = "✏️";
    editButton.className = "edit-button";
    editButton.title = "ערוך";
    editButton.style.display = "none"; // Initially hidden
    editButton.addEventListener("click", async () => {
        try {
            // Handle edit action here
            debug("Edit clicked for file:", fileId);
            // Get the entry that from the latestFileInfoList with the same fileId
            const formJson = latestFileInfoList.find((file) => file.fileId === fileId);
            if (!formJson || !formJson.fileName) {
                throw new Error("Form not found");
            }
            const response = await fetch(`${API_BASE_URL}/updateForm`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    customerDataEntryName: "Default",
                    formAsJSON: formJson,
                }),
                ...fetchConfig,
            });
            if (!(await handleResponse(response, "Update form failed"))) {
                return;
            }
            const fileInfoList = await response.json();
            updateFileListP(fileInfoList);
            clearMessages();
            addMessage(`הטופס ${formJson.fileName} עודכן בהצלחה`, "success");
        }
        catch (error) {
            console.error("Edit failed:", error);
            addMessage("שגיאה בעריכת הקובץ: " + (error instanceof Error ? error.message : String(error)), "error");
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
    // In the case of an error form we add a retry button
    if (fileInfo.type === "FormError") {
        const retryInput = document.createElement("input");
        retryInput.type = "file";
        retryInput.id = "xfileInput";
        retryInput.accept = ".pdf,.jpg,.jpeg,.gif,.tiff,.bmp,.png";
        retryInput.className = "retry-input";
        retryInput.multiple = true;
        const retryButton = document.createElement("button");
        retryButton.innerHTML = "ניסיון שנית";
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
            deleteFileQuietly(fileId);
            const success = await uploadFilesListener(retryInput);
            if (success) {
            }
        });
    }
    li.appendChild(editButton);
    li.appendChild(deleteButton);
    fileList.appendChild(li);
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
        showLoadingOverlay("מחשב מס...");
        const response = await fetch(`${API_BASE_URL}/calculateTax?customerDataEntryName=Default`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                customerDataEntryName: "Default",
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
    }
}
function updateDeleteAllButton(hasEntries) {
    const deleteAllButton = document.getElementById("deleteAllButton");
    deleteAllButton.disabled = !hasEntries || isUploading;
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
          <th>בן זוג רשום</th>
          <th>סה"כ</th>
        </tr>
      `;
    table.appendChild(thead);
    // Add table body
    const tbody = document.createElement("tbody");
    result.forEach((row) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${row.title}</td>
          <td>${row.spouse?.trim() || ""}</td>
          <td>${row.registered?.trim() || ""}</td>
          <td>${row.total?.trim() || ""}</td>
        `;
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
// Setup document hover functionality
function initializeDocumentHovers() {
    const docDetailsModal = document.getElementById("docDetailsModal");
    const docDetailsTitle = docDetailsModal.querySelector(".doc-details-title");
    const docDetailsBody = docDetailsModal.querySelector(".doc-details-body");
    document.querySelectorAll(".doc-item").forEach((item) => {
        item.addEventListener("mouseenter", () => {
            const docType = item.dataset.docType;
            const details = docDetails[docType];
            if (details) {
                const itemBounds = item.getBoundingClientRect();
                docDetailsTitle.textContent = details.title;
                docDetailsBody.innerHTML = details.sections
                    .map((section) => `
              <h4>${section.title}</h4>
              <p>${section.content}</p>
            `)
                    .join("");
                docDetailsModal.style.top = `${itemBounds.top}px`;
                docDetailsModal.style.display = "block";
            }
        });
        item.addEventListener("mouseleave", () => {
            docDetailsModal.style.display = "none";
        });
    });
}
// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
    debug("DOMContentLoaded 2");
    const versionNumber = document.getElementById("versionNumber");
    // Get and display version number
    try {
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
            await loadConfiguration();
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
    restoreSelectedDocTypes();
    updateSignInUI();
    // Pre-fill feedback email if user is logged in
    if (signedIn) {
        document.getElementById("feedbackEmail").value = userEmailValue;
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
    createFormSelect.innerHTML = `<option value="">צור טופס חדש</option>`;
    // Add the form types that the user can add only if the userCanAdd is true
    if (configurationData != null) {
        createFormSelect.innerHTML += configurationData.formTypes
            .filter((formType) => formType.userCanAdd)
            .map((formType) => `<option value="${formType.formType}">${formType.formName}</option>`)
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
        const passwordInput = document.getElementById("password");
        if (passwordInput) {
            passwordInput.focus();
        }
    }
    const toggleLink = document.getElementById("toggleFileListView");
    if (toggleLink) {
        toggleLink.addEventListener("click", (e) => {
            e.preventDefault();
            toggleFileListView();
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
        await showInfoModal("אתר זה זמין ללא תשלום במטרה לסייע לאנשים המעוניינים להכין את הדוח השנתי שלהם למס הכנסה בעצמם. איננו מייצגים אתכם מול רשויות המס. אנא קראו בעיון את התנאים וההגבלות לפני המשך השימוש.");
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
    const emailInput = document.getElementById("feedbackEmail");
    const privacyCheckbox = document.getElementById("privacyAgreement");
    const sendButton = document.getElementById("sendFeedbackButton");
    sendButton.disabled = !isValidEmail(emailInput.value) || !privacyCheckbox.checked;
}
// Add event listeners for both email input and privacy checkbox
document.getElementById("feedbackEmail").addEventListener("input", updateFeedbackButtonState);
document.getElementById("privacyAgreement").addEventListener("change", updateFeedbackButtonState);
// Add feedback submission handler
document.getElementById("sendFeedbackButton").addEventListener("click", async () => {
    try {
        const email = document.getElementById("feedbackEmail").value;
        const message = document.getElementById("feedbackMessage").value;
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
        document.getElementById("feedbackEmail").value = "";
        document.getElementById("feedbackMessage").value = "";
        document.getElementById("privacyAgreement").checked = false;
        updateFeedbackButtonState();
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
    const identificationNumber = defaultId;
    try {
        const response = await fetch(`${API_BASE_URL}/createForm`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                customerDataEntryName: "Default",
                formType: formType,
                identificationNumber: identificationNumber,
            }),
            ...fetchConfig,
        });
        if (!(await handleResponse(response, "Create form failed"))) {
            return;
        }
        const fileInfoList = await response.json();
        debug("createForm response:", fileInfoList);
        updateFileListP(fileInfoList);
        clearResultsControls();
        clearMessages();
        // Jump to the last file in the file list
        openFileListEntryP(fileInfoList[fileInfoList.length - 1].fileName);
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
        // Close if clicking outside
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = "none";
                resolve(false);
            }
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
        // Close if clicking outside
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = "none";
                resolve(false);
            }
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
function toggleFileListView() {
    editableFileList = !editableFileList;
    localStorage.setItem("editableFileList", editableFileList.toString());
    updateFileListView();
    loadExistingFiles();
}
//# sourceMappingURL=index.js.map