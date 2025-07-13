import { getFriendlyName, isCurrencyField, dummyName, dummyIdNumber, NO_YEAR } from "./constants.js";

const uiVersion = "0.74";
const defaultId = "000000000";
const ANONYMOUS_EMAIL = "AnonymousEmail";
interface FormType {
  formType: string;
  formName: string;
  userCanAdd: boolean;
}

interface FileInfo {
  fileId: string;
  fileName: string;
  taxYear?: string;
  documentType?: string;
  [key: string]: any;
}

interface ConfigurationData {
  formTypes: FormType[];
}

export let configurationData: ConfigurationData;
let latestFileInfoList: FileInfo[] = [];
let documentIcons: Record<string, string | null> = {};
let isUploading = false;
let userEmailValue = "";
let signedIn = false;
const fetchConfig = {
  mode: "cors" as RequestMode,
};

// Add this near the top of your script
const DEBUG = true;

export function debug(...args: unknown[]): void {
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
const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const fileList = document.getElementById("fileList") as HTMLUListElement;
const folderInput = document.getElementById("folderInput") as HTMLInputElement;
const processButton = document.getElementById("processButton") as HTMLButtonElement;
const deleteAllButton = document.getElementById("deleteAllButton") as HTMLButtonElement;
const messageContainer = document.getElementById("messageContainer") as HTMLDivElement;
const loginButton = document.getElementById("loginButton") as HTMLButtonElement;
const signOutButton = document.getElementById("signOutButton") as HTMLButtonElement;
const loginOverlay = document.getElementById("loginOverlay") as HTMLDivElement;
const closeButton = document.querySelector(".close-button") as HTMLButtonElement;
const loginForm = document.querySelector(".login-form") as HTMLFormElement;
const toggleButtons = document.querySelectorAll(".toggle-button") as NodeListOf<HTMLButtonElement>;
const modalTitle = document.getElementById("modalTitle") as HTMLHeadingElement;
const submitButton = document.getElementById("submitButton") as HTMLButtonElement;
const googleButtonText = document.getElementById("googleButtonText") as HTMLSpanElement;
const githubButtonText = document.getElementById("githubButtonText") as HTMLSpanElement;
const userEmail = document.getElementById("userEmail") as HTMLSpanElement;
const createFormSelect = document.getElementById("createFormSelect") as HTMLSelectElement;
const acceptCookies = document.getElementById("acceptCookies") as HTMLButtonElement;
const cookieConsent = document.getElementById("cookieConsent") as HTMLDivElement;

export function updateButtons(hasEntries: boolean) {
  if (!isUploading) {
    processButton.disabled = !hasEntries;
    deleteAllButton.disabled = !hasEntries;
  }
}

function updateFileListP(fileInfoList: FileInfo[], isNewUpload = false) {
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
  } else {
    updateFileList(fileInfoList, isNewUpload);
  }
}

function removeFileList() {
  if (editableFileList) {
    editableRemoveFileList();
  } else {
    fileList.innerHTML = "";
  }
}

function openFileListEntryP(fileName: string, property: string | null, shouldScroll = true) {
  if (editableFileList) {
    editableOpenFileListEntry(fileName, property, shouldScroll);
  } else {
    openFileListEntry(fileName, property, shouldScroll);
  }
}

function openFileListEntry(fileName: string, property: string | null, shouldScroll = true) {
  // Find the file item by looking for the span with class 'fileNameElement' that contains the fileName
  const fileNameElements = document.querySelectorAll(".fileNameElement");
  for (const element of fileNameElements) {
    if (element.textContent?.trim().startsWith(fileName)) {
      // Click the parent file-header to open the accordion
      const fileHeader = element.closest(".file-header") as HTMLDivElement;
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
    return editableGetDocTypes();
  } else {
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
    signedIn = result.expirationTime;
    updateSignInUI();
    return;
  } catch (error) {
    debug("Sign in error:", error);
    throw error;
  }
}

async function handleLoginResponse(response: Response) {
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

async function signIn(email: string, password: string) {
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
  } catch (error) {
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
    } else {
      signOutButton.disabled = false;
    }
  } else {
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
  } catch (error: unknown) {
    debug("Failed to load files:", error);
    // Only show message if it's not an auth error
    if (error instanceof Error && !error.message.includes("Invalid token")) {
      addMessage("שגיאה בטעינת רשימת הקבצים: " + error.message);
    }
    throw error;
  }
}

// Add this helper function at the start of your script
function isValidFileType(file: File) {
  const validTypes = ["application/json", "application/pdf", "image/jpeg", "image/jpg", "image/gif", "image/bmp", "image/png"];
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      message: `סוג קובץ לא נתמך - רק קבצי PDF ,JPG ,GIF ,BMP ,PNG מותרים. שם הקובץ: ${file.name} (${file.webkitRelativePath})`,
    };
  }
  return { valid: true };
}

// Add this helper function to check if file is in GeneratedTaxForms folder
function isInGeneratedTaxFormsFolder(filePath: string) {
  return filePath.includes("GeneratedTaxForms");
}

// Add this function to update the file list from server response
function updateFileList(fileInfoList: FileInfo[], isNewUpload = false) {
  debug("updateFileList");
  // Store the latest fileInfoList for later reference
  latestFileInfoList = fileInfoList;

  const fileList = document.getElementById("fileList");
  if (!fileList) return;

  // Clear existing list
  fileList.innerHTML = "";

  // Group files by year
  const filesByYear = new Map<string, FileInfo[]>();
  fileInfoList.forEach((fileInfo) => {
    const year = fileInfo.taxYear || NO_YEAR;
    if (!filesByYear.has(year)) {
      filesByYear.set(year, []);
    }
    filesByYear.get(year)?.push(fileInfo);
  });

  // Sort years in descending order
  const sortedYears = Array.from(filesByYear.keys()).sort((a, b) => {
    if (a === NO_YEAR) return -1;
    if (b === NO_YEAR) return 1;
    return parseInt(b) - parseInt(a);
  });

  // Create year accordions
  sortedYears.forEach((year) => {
    const yearFiles = filesByYear.get(year) || [];

    const yearAccordion = document.createElement("div") as HTMLDivElement;
    yearAccordion.className = "date-accordion-container";

    const yearHeader = document.createElement("div") as HTMLDivElement;
    yearHeader.className = "date-accordion-header";
    if (yearFiles.some((file) => file.type === "FormError")) {
      yearHeader.className += " error";
    }

    const yearToggle = document.createElement("button") as HTMLButtonElement;
    yearToggle.className = "date-accordion-toggle-button";
    yearToggle.textContent = "+";
    yearHeader.appendChild(yearToggle);

    const yearTitle = document.createElement("span") as HTMLSpanElement;
    yearTitle.textContent = year;
    yearTitle.className = "date-title";

    // Add error icon if year is NO_YEAR
    if (year === NO_YEAR) {
      const errorIcon = document.createElement("span") as HTMLSpanElement;
      errorIcon.textContent = "❌";
      errorIcon.className = "year-error-icon";
      errorIcon.title = "שנה לא זוהתה - יש לבדוק את המסמך";
      yearTitle.appendChild(errorIcon);
    }

    yearHeader.appendChild(yearTitle);

    const yearBody = document.createElement("div") as HTMLDivElement;
    yearBody.className = "date-accordion-body";
    yearBody.style.display = "none";

    // Add click handler for year accordion
    yearHeader.addEventListener("click", () => {
      const isExpanded = yearBody.style.display !== "none";
      yearBody.style.display = isExpanded ? "none" : "block";
      yearToggle.textContent = isExpanded ? "+" : "-";
    });

    // Add files for this year
    yearFiles.forEach((fileInfo: FileInfo) => {
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
      debug("Checking year expansion:", { year, lastFileType: lastFile?.type, lastFileTaxYear: lastFile?.taxYear, isFormError: lastFile?.type === "FormError" });

      let shouldExpand = false;

      if (lastFile) {
        if (lastFile.type === "FormError") {
          // For FormError files, only expand the NO_YEAR accordion
          shouldExpand = year === NO_YEAR;
        } else {
          // For normal files, expand the accordion matching the tax year
          shouldExpand = lastFile.taxYear === year;
        }
      }

      if (shouldExpand) {
        debug("Expanding year accordion for:", year);
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
function updateProcessButton(hasEntries: boolean) {
  processButton.disabled = !hasEntries;
}

// Refactor uploadFilesListener to accept File[] or HTMLInputElement
async function uploadFilesListener(inputOrFiles: HTMLInputElement | File[], replacedFileId: string | null = null) {
  clearMessages();

  let files: File[];
  if (Array.isArray(inputOrFiles)) {
    files = inputOrFiles;
  } else {
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

  return uploadFilesWithButtonProgress(validFiles, fileInput, replacedFileId);
}

// File upload handler
fileInput.addEventListener("change", async () => {
  await uploadFilesListener(fileInput, null);
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

function showLoadingOverlay(message: string) {
  const loadingMessage = document.getElementById("loadingMessage") as HTMLDivElement;
  loadingMessage.textContent = message;
  const loadingOverlay = document.getElementById("loadingOverlay") as HTMLDivElement;
  loadingOverlay.classList.add("active");
}

function hideLoadingOverlay() {
  const loadingOverlay = document.getElementById("loadingOverlay") as HTMLDivElement;
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

    // Handle fatal error if present
    if (result.fatalProcessingError) {
      addMessage("שגיאה קריטית: " + result.fatalProcessingError, "error");
    }

    // Handle warnings if present
    if (result.processingWarnings && result.processingWarnings.length > 0) {
      result.processingWarnings.forEach((warning: string) => {
        addMessage("אזהרה: " + warning, "warning");
      });
    }
    // Handle information if present
    if (result.processingInformation && result.processingInformation.length > 0) {
      result.processingInformation.forEach((information: string) => {
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
  } catch (error: unknown) {
    console.error("Processing failed:", error);
    addMessage("שגיאה בעיבוד הקבצים: " + (error instanceof Error ? error.message : String(error)), "error");
  } finally {
    hideLoadingOverlay();
  }
});

async function uploadFilesWithButtonProgress(validFiles: File[], button: HTMLInputElement, replacedFileId: string | null = null) {
  const buttonLabel = button.nextElementSibling as HTMLSpanElement;
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
    success = await uploadFiles(validFiles, replacedFileId);
  } catch (error) {
    console.error("UploadFile failed:", error);
    addMessage("שגיאה באימות: " + (error instanceof Error ? error.message : String(error)), "error");
  } finally {
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

// General password prompt modal function that returns a promise
function showPasswordModal(fileName: string) {
  return new Promise<string>((resolve) => {
    const passwordMessage = document.getElementById("passwordMessage") as HTMLDivElement;
    passwordMessage.textContent = `הקובץ ${fileName} מוגן בסיסמה. אנא הכנס את הסיסמה:`;

    const modal = document.getElementById("passwordModal") as HTMLDivElement;
    const passwordInput = document.getElementById("passwordInput") as HTMLInputElement;

    // Create password toggle button if it doesn't exist
    let toggleButton = modal.querySelector(".password-toggle") as HTMLButtonElement;
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
    (modal.querySelector(".confirm-button") as HTMLButtonElement).onclick = () => {
      const password = passwordInput.value.trim();
      if (password) {
        modal.style.display = "none";
        resolve(password);
      } else {
        // Show error if password is empty
        passwordInput.classList.add("error");
        setTimeout(() => passwordInput.classList.remove("error"), 1000);
      }
    };

    // Handle cancel button
    (modal.querySelector(".cancel-button") as HTMLButtonElement).onclick = () => {
      modal.style.display = "none";
      resolve(""); // Return empty string to indicate cancellation
    };

    // Handle enter key
    passwordInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        (modal.querySelector(".confirm-button") as HTMLButtonElement).click();
      } else if (e.key === "Escape") {
        (modal.querySelector(".cancel-button") as HTMLButtonElement).click();
      }
    };

    // Close if clicking outside
    window.onclick = (event) => {
      if (event.target === modal) {
        modal.style.display = "none";
        resolve(""); // Return empty string to indicate cancellation
      }
    };
  });
}

async function uploadFiles(validFiles: File[], replacedFileId: string | null = null) {
  let fileInfoList = null;
  for (const file of validFiles) {
    try {
      let newFile = file;
      if (file.type.startsWith("image/")) {
        try {
          newFile = (await convertImageToBWAndResize(file)) as File;
        } catch (error: unknown) {
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
          customerDataEntryName: "Default",
          password: password, // Include password if provided
          replacedFileId: replacedFileId,
        };
        formData.append(
          "metadata",
          new Blob([JSON.stringify(metadata)], {
            type: "application/json",
          })
        );

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
        } catch (error) {
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
          } else {
            // Other error, don't retry
            console.error("Upload failed:", error);
            clearMessages();
            addMessage("שגיאה בהעלאת הקובץ: " + errorMessage, "error");
            return false;
          }
        }
      }
    } catch (error) {
      console.error("Upload failed:", error);
      clearMessages();
      addMessage("שגיאה בהעלאת הקובץ: " + (error instanceof Error ? error.message : String(error)), "error");
      return false;
    }
  }

  // Count the error types in the fileInfoList
  if (fileInfoList) {
    const errorTypes = fileInfoList.filter((fileInfo: { type: string }) => fileInfo.type === "FormError").length;
    if (errorTypes > 0) {
      addMessage(`הועלו ${validFiles.length} קבצים בהצלחה, מתוך ${fileInfoList.length} קבצים יש שגיאות ${errorTypes}`, "warning");
    } else {
      addMessage(`הועלו ${validFiles.length} קבצים בהצלחה`, "info");
    }
  }
  return true;
}

function getMessageCode(text: string) {
  return text.match(/\^([^ ]+)/)?.[1];
}

// Update addMessage function to handle message types
export function addMessage(text: string, type = "info", scrollToMessageSection = true) {
  // Map of error codes to faq ids
  const errorCodeToFaqId = {
    "^NoIdentity": "faq-personal-details",
  };
  const messageDiv = document.createElement("div");
  messageDiv.className = "message-item";
  if (type) {
    messageDiv.classList.add(type);
  }

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
    const fileNameMatches = text.match(/fileName=([^,\s]+)/g);
    const propertyMatches = text.match(/property=([^,\s]+)/g);

    if (fileNameMatches && fileNameMatches.length > 0) {
      // Clean up the display text by removing all fileName= and property= patterns
      let cleanText = text;
      fileNameMatches.forEach((match) => {
        cleanText = cleanText.replace(match + ",", "").replace(match, "");
      });
      if (propertyMatches) {
        propertyMatches.forEach((match) => {
          cleanText = cleanText.replace(match + ",", "").replace(match, "");
        });
      }
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
  } else if (messageCode) {
    // If the message contains a message code, make it clickable to navigate to FAQ
    const faqId = errorCodeToFaqId[`^${messageCode}` as keyof typeof errorCodeToFaqId];
    if (faqId) {
      // Add clickable class to show it's interactive
      messageDiv.classList.add("clickable");
      messageText.className = "message-text-help";
      // Make the messageDiv a clickable link to the FAQ
      messageText.addEventListener("click", () => {
        window.location.href = `faq.html#${faqId}`;
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
    const feedbackMessage = document.getElementById("feedbackMessage") as HTMLTextAreaElement;
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
    const signupButton = document.querySelector(".toggle-button[data-mode='signup']") as HTMLButtonElement;
    if (signupButton) {
      signupButton.click();
    }
    isAnonymousConversion = true;
  } else {
    const signinButton = document.querySelector(".toggle-button[data-mode='signin']") as HTMLButtonElement;
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
function switchMode(mode: string) {
  const isSignup = mode === "signup";
  modalTitle.textContent = isSignup ? "הרשמה" : "התחברות";
  submitButton.textContent = isSignup ? "הירשם" : "התחבר";
  const fullNameInput = document.getElementById("fullName") as HTMLInputElement;
  const fullNameField = document.getElementById("fullNameField") as HTMLDivElement;
  fullNameField.style.display = isSignup ? "block" : "none";
  if (isSignup) {
    fullNameInput.setAttribute("required", "");
  } else {
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
  const email = document.getElementById("email") as HTMLInputElement;
  const password = document.getElementById("password") as HTMLInputElement;
  const fullName = document.getElementById("fullName") as HTMLInputElement;
  const isSignup = (document.querySelector(".toggle-button.active") as HTMLButtonElement)?.dataset.mode === "signup";

  try {
    if (isSignup) {
      if (isAnonymousConversion) {
        await convertAnonymousAccount(email.value, password.value, fullName.value);
      } else {
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
    } else {
      // Call the signIn API
      await signIn(email.value, password.value);

      // Clear stored tax results
      localStorage.removeItem("taxResults");
      localStorage.removeItem("taxResultsYear");

      // Clear tax results display
      const taxResultsContainer = document.getElementById("taxResultsContainer") as HTMLDivElement;
      const taxCalculationContent = document.getElementById("taxCalculationContent") as HTMLDivElement;
      taxResultsContainer.classList.remove("active");
      taxCalculationContent.innerHTML = "";

      // Handle signin
      await loadExistingFiles(); // Load files with new token
      // Dont scroll
      await loadResults(false);
    }
    //addMessage("התחברת בהצלחה!");
    loginOverlay.classList.remove("active");
  } catch (error: unknown) {
    console.error("Login failed:", error);
    // Clear previous messages
    clearMessages();
    addMessage("שגיאה בהתחברות: " + (error instanceof Error ? error.message : String(error)), "error");
    // Dismiss the login overlay
    loginOverlay.classList.remove("active");
  }
});

const googleLogin = document.querySelector(".google-login") as HTMLButtonElement;
googleLogin.addEventListener("click", () => {
  debug("Google login clicked");
});

const githubLogin = document.querySelector(".github-login") as HTMLButtonElement;
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
    results.forEach((result: { messages: { fatalProcessingError: string; processingWarnings: string[]; processingInformation: string[] } }) => {
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
  } catch (error: unknown) {
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

function descriptionFromFileName(fileName: string) {
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
  } else if (name === "1322") {
    description = `${year}: טופס 1322 - רווח מהון מניירות ערך`;
  } else if (name === "1344") {
    description = `${year}: טופס 1344 - הפסדים מועברים`;
  } else if (name === "1301") {
    // Data file containing the annual data for uploading to the tax authority when filing the tax return
    description = `${year}: קובץ נתונים שנתיים להעלאה אתר מס הכנסה בזמן הגשת דו״ח שנתי`;
  } else {
    description = `${year}: מסמך נוסף - ` + fileName;
  }
  return description;
}

function displayResults(results: { file: { fileName: string } }[]) {
  const resultsContainer = document.getElementById("resultsContainer") as HTMLDivElement;
  const resultsList = document.getElementById("resultsList") as HTMLUListElement;
  resultsList.innerHTML = ""; // Clear existing results

  // If there are no results, hide the results container.
  if (!Array.isArray(results) || results.length === 0) {
    resultsContainer.classList.remove("active");
    return;
  }

  let hasFiles = false;

  results.forEach((result: { file: { fileName: string } }) => {
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
  } else {
    resultsContainer.classList.remove("active");
  }
}

async function downloadResult(fileName: string) {
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
  } catch (error: unknown) {
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
    if (!confirmed) return;

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
  } catch (error: unknown) {
    console.error("Delete all failed:", error);
    addMessage("שגיאה במחיקת הקבצים: " + (error instanceof Error ? error.message : String(error)), "error");
  }
});

// DOMContentLoaded event for other initialization
document.addEventListener("DOMContentLoaded", () => {
  debug("DOMContentLoaded 1");

  // Drag and Drop Area Logic
  const dragDropArea = document.getElementById("dragDropArea") as HTMLDivElement;
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
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) {
        // Use the same logic as file input
        await uploadFilesListener(files, null);
      }
    });
    // Click to open file dialog
    dragDropArea.addEventListener("click", () => {
      fileInput.click();
    });
  }
});

function clearTaxResults() {
  const taxResultsContainer = document.getElementById("taxResultsContainer") as HTMLDivElement;
  const taxCalculationContent = document.getElementById("taxCalculationContent") as HTMLDivElement;
  // Hide containers
  taxResultsContainer.classList.remove("active");
  // Clear content
  taxCalculationContent.innerHTML = "";
  // Clear stored results
  localStorage.removeItem("taxResults");
  localStorage.removeItem("taxResultsYear");
}

function clearResultsControls() {
  const resultsContainer = document.getElementById("resultsContainer") as HTMLDivElement;
  const resultsList = document.getElementById("resultsList") as HTMLUListElement;
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

function formatNumber(key: string, value: any) {
  if (isCurrencyField(key)) {
    return `<em>${getFriendlyName(key)}:</em> ${new Intl.NumberFormat(undefined, { style: "decimal", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)}`;
  } else {
    return `<em>${getFriendlyName(key)}:</em> ${value}`;
  }
}

export function addFileToList(fileInfo: any) {
  async function deleteFile(fileId: string) {
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
    } catch (error: unknown) {
      console.error("Delete failed:", error);
      addMessage("שגיאה במחיקת הקובץ: " + (error instanceof Error ? error.message : String(error)), "error");
    }
  }

  async function deleteFileQuietly(fileId: string) {
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
    } catch (error) {
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
  } else if (fileInfo.fileName.includes("ידני")) {
    status = null;
    // Add clent name and id number
    statusMessage = `עבור: ${fileInfo.clientName} ת.ז. ${fileInfo.clientIdentificationNumber} ${fileInfo.noteText ? ` (${fileInfo.noteText})` : ""}`;
  } else {
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

  const fileNameElement = document.createElement("span") as HTMLSpanElement;
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
  const editButton = document.createElement("button") as HTMLButtonElement;
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
        if (Object.keys(value).length === 0 || !hasNonNullValues) return;

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
                } else {
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
        } else {
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
      } else {
        // Regular field
        const field = document.createElement("div") as HTMLDivElement;
        field.className = "fileitem-field-label";
        if (key.endsWith("Name")) {
          field.innerHTML = `<strong>${getFriendlyName(key)}:</strong> ${dummyName(String(value))}`;
        } else if (key.endsWith("IdentificationNumber")) {
          field.innerHTML = `<strong>${getFriendlyName(key)}:</strong> ${dummyIdNumber(String(value))}`;
        } else {
          field.innerHTML = `<strong>${getFriendlyName(key)}:</strong> ${value}`;
        }
        accordionContent.appendChild(field);
      }
    }
  });

  // Add click handler for accordion
  fileHeader.addEventListener("click", (e) => {
    // Don't toggle if clicking delete button
    if ((e.target && (e.target as HTMLElement).closest(".delete-button")) || (e.target as HTMLElement).closest(".edit-button")) return;

    // Close any other open accordions first
    const allAccordions = document.querySelectorAll(".accordion-content");
    const allExpandIcons = document.querySelectorAll(".expand-icon");
    const allEditButtons = document.querySelectorAll(".edit-button");
    const allFileNames = document.querySelectorAll(".fileNameElement");

    allAccordions.forEach((acc, index) => {
      if (acc !== accordionContent && (acc as HTMLElement).style.display === "block") {
        (acc as HTMLElement).style.display = "none";
        allExpandIcons[index].textContent = "▼";
        allExpandIcons[index].classList.remove("expanded");
        (allEditButtons[index] as HTMLButtonElement).style.display = "none";
        allFileNames[index].classList.remove("expanded");
      }
    });

    const isExpanded = accordionContent.style.display === "block";
    if (isExpanded) {
      accordionContent.style.display = "none";
      expandIcon.textContent = "▼";
      fileNameElement.classList.remove("expanded");
      editButton.style.display = "none";
    } else {
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
    retryInput.accept = ".json,.pdf,.jpg,.jpeg,.gif,.tiff,.bmp,.png";
    retryInput.className = "retry-input";
    retryInput.multiple = true;

    const retryButton = document.createElement("button") as HTMLButtonElement;
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

export function fileModifiedActions(hasEntries: boolean) {
  updateDeleteAllButton(hasEntries);
  updateProcessButton(hasEntries);
  updateMissingDocuments();
  clearResultsControls();
}

// Return true if the response is ok, false if we signed out otherwise throw an exception..
export async function handleResponse(response: any, errorMessage: string) {
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

async function calculateTax(fileName: string) {
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
  } catch (error: unknown) {
    console.error("Calculate tax failed:", error);
    addMessage("שגיאה בחישוב המס: " + (error instanceof Error ? error.message : String(error)), "error");
  } finally {
    hideLoadingOverlay();
  }
}

function updateDeleteAllButton(hasEntries: boolean) {
  const deleteAllButton = document.getElementById("deleteAllButton") as HTMLButtonElement;
  deleteAllButton.disabled = !hasEntries || isUploading;
}

// Helper function to get color class based on numeric value
function getValueColorClass(value: string): string {
  if (!value || value.trim() === "") return "";

  // Remove any non-numeric characters except minus sign and decimal point
  const cleanValue = value.replace(/[^\d.-]/g, "");
  const numValue = parseFloat(cleanValue);

  if (isNaN(numValue)) return "";

  if (numValue <= 0) return "negative-value";
  if (numValue > 0) return "positive-value";
  return "";
}

// Add this function to display tax results
function displayTaxCalculation(result: any, year: string, shouldScroll = false) {
  debug("displayTaxCalculation");
  const taxCalculationContent = document.getElementById("taxCalculationContent") as HTMLDivElement;
  taxCalculationContent.innerHTML = ""; // Clear existing results
  // Append year to the title id taxResultsTitle
  const taxResultsTitle = document.getElementById("taxResultsTitle") as HTMLHeadingElement;
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
  result.forEach((row: any, index: number) => {
    const tr = document.createElement("tr");
    const isLastRow = index === result.length - 1;

    // Get color class only for the last row's total cell
    const totalColorClass = isLastRow ? getValueColorClass(row.total?.trim() || "") : "";

    tr.innerHTML = `
          <td>${row.title}</td>
          <td>${row.spouse?.trim() || ""}</td>
          <td>${row.registered?.trim() || ""}</td>
          <td class="${isLastRow ? "highlighted-cell" : ""} ${totalColorClass}">${row.total?.trim() || ""}</td>
        `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  taxCalculationContent.appendChild(table);
  const taxResultsContainer = document.getElementById("taxResultsContainer") as HTMLDivElement;
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
  const versionNumber = document.getElementById("versionNumber") as HTMLSpanElement;

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
  } catch (error) {
    console.error("Exception fetching Basic Info:", error);
  }
  if (!signedIn) {
    debug("Failed to fetch version:");
  }

  restoreSelectedDocTypes();
  updateSignInUI();

  // Pre-fill feedback email if user is logged in
  if (signedIn) {
    (document.getElementById("feedbackEmail") as HTMLInputElement).value = userEmailValue;
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
      const target = e.target as HTMLSelectElement;
      if (target.value === "create form") {
        // Get the document type from the select's id
        const docType = target.id.replace("-count", "");
        const docTypeName = target.closest(".doc-item")?.getAttribute("data-doc-typename") || "";

        // Create a new form of this type
        const createFormSelect = document.getElementById("createFormSelect") as HTMLSelectElement;
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
      } else {
        // Store the current value for future reference
        target.setAttribute("data-previous-value", target.value);
      }
    });
  });

  // Update form creation select elements according to the form types
  const createFormSelect = document.getElementById("createFormSelect") as HTMLSelectElement;
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
      (document.querySelector(".toggle-button[data-mode='signup']") as HTMLButtonElement).click();
      isAnonymousConversion = true;
    } else {
      (document.querySelector(".toggle-button[data-mode='signin']") as HTMLButtonElement).click();
      isAnonymousConversion = false;
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
    const passwordInput = document.getElementById("password") as HTMLInputElement;
    if (passwordInput) {
      passwordInput.focus();
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
    const cookieConsent = document.getElementById("cookieConsent") as HTMLDivElement;
    if (cookieConsent) {
      cookieConsent.classList.add("active");
    }
  }

  // Check if disclaimer has been accepted
  const disclaimerAccepted = cookieUtils.get("disclaimerAccepted");
  if (!disclaimerAccepted) {
    //await showDisclaimerModal();
    await showInfoModal(
      "אתר זה זמין ללא תשלום במטרה לסייע לאנשים המעוניינים להכין את הדוח השנתי שלהם למס הכנסה בעצמם. איננו מייצגים אתכם מול רשויות המס. אנא קראו בעיון את התנאים וההגבלות לפני המשך השימוש."
    );
    cookieUtils.set("disclaimerAccepted", "true", 365);
  }

  // Initialize the file list view
  updateFileListView();

  // Check for Google OAuth2 callback
  checkForGoogleCallback();
});

// Function to validate email format
function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Function to update feedback button state
function updateFeedbackButtonState() {
  const emailInput = document.getElementById("feedbackEmail") as HTMLInputElement;
  const privacyCheckbox = document.getElementById("privacyAgreement") as HTMLInputElement;
  const sendButton = document.getElementById("sendFeedbackButton") as HTMLButtonElement;

  sendButton.disabled = !isValidEmail(emailInput.value) || !privacyCheckbox.checked;
}

// Add event listeners for both email input and privacy checkbox
(document.getElementById("feedbackEmail") as HTMLInputElement).addEventListener("input", updateFeedbackButtonState);
(document.getElementById("privacyAgreement") as HTMLInputElement).addEventListener("change", updateFeedbackButtonState);

// Add feedback submission handler
(document.getElementById("sendFeedbackButton") as HTMLButtonElement).addEventListener("click", async () => {
  try {
    const email = (document.getElementById("feedbackEmail") as HTMLInputElement).value;
    const message = (document.getElementById("feedbackMessage") as HTMLInputElement).value;

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
    (document.getElementById("feedbackEmail") as HTMLInputElement).value = "";
    (document.getElementById("feedbackMessage") as HTMLInputElement).value = "";
    (document.getElementById("privacyAgreement") as HTMLInputElement).checked = false;
    updateFeedbackButtonState();
  } catch (error: unknown) {
    console.error("Failed to submit feedback:", error);
    addMessage("שגיאה בשליחת המשוב: " + (error instanceof Error ? error.message : String(error)), "error");
  }
});

// Add change handlers for document count selects
document.querySelectorAll(".doc-controls select").forEach((select) => {
  select.addEventListener("change", () => {
    const docItem = select.closest(".doc-item") as HTMLElement;
    if (parseInt((select as HTMLSelectElement).value) > 0) {
      docItem.classList.add("selected");
    } else {
      docItem.classList.remove("selected");
    }
    saveSelectedDocTypes();
    updateMissingDocuments();
  });
});

// Function to save selected doc types to localStorage
function saveSelectedDocTypes() {
  const docSelections: Record<string, string> = {};
  document.querySelectorAll(".doc-controls select").forEach((select) => {
    const docItem = select.closest(".doc-item") as HTMLElement;
    const docType = docItem.dataset.docType;
    if (docType) {
      docSelections[docType as string] = (select as HTMLSelectElement).value;
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
      const select = docItem.querySelector("select") as HTMLSelectElement;
      if (select) {
        select.value = value as string;
        // Update selected class based on value
        if (parseInt(value as string) > 0) {
          docItem.classList.add("selected");
        } else {
          docItem.classList.remove("selected");
        }
      }
    }
  });
}

// Add change handler for form select
(document.getElementById("createFormSelect") as HTMLSelectElement).addEventListener("change", async (e) => {
  if (!signedIn) {
    await signInAnonymous();
  }
  const formType = (e.target as HTMLSelectElement).value as string;
  if (!formType) return;

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
    updateFileListP(fileInfoList, true); // true = new form creation
    clearResultsControls();
    clearMessages();
    // Jump to the last file in the file list
    openFileListEntryP(fileInfoList[fileInfoList.length - 1].fileName, null, true);

    addMessage("הטופס נוצר בהצלחה", "success");
    // Reset select to default option
    (e.target as HTMLSelectElement).value = "";
  } catch (error: unknown) {
    console.error("Failed to create form:", error);
    addMessage("שגיאה ביצירת הטופס: " + (error instanceof Error ? error.message : String(error)), "error");
  }
  // return the control to its first option
  (e.target as HTMLSelectElement).value = "";
});

// Add this function to update missing document counts
function updateMissingDocuments() {
  // Get all documents from file list
  const fileListDocs = getDocTypes();

  // Count documents by type
  const docCounts = fileListDocs.reduce((acc: Record<string, number>, type: string | null) => {
    if (type) {
      acc[type] = (acc[type] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const missingDocs: { name: string; count: number }[] = [];
  // const allDocsZero = Array.from(document.querySelectorAll('.doc-controls select'))
  //   .every(select => select.value === '0');

  // Check each doc-item and update missing count
  document.querySelectorAll(".doc-item").forEach((item) => {
    const docType = (item as HTMLElement).dataset.docType;
    const docTypename = (item as HTMLElement).dataset.docTypename;
    const select = item.querySelector("select");
    const missingLabel = document.getElementById(`${docType}-missing`);

    if (select && missingLabel) {
      const required = parseInt(select.value);
      const uploaded = docCounts[docTypename as string] || 0;
      //debug("docType:", docType, "docTypename:", docTypename, "required:", required, "uploaded:", uploaded);
      const missing = Math.max(0, required - uploaded);
      //debug("missing:", missing);

      if (missing > 0) {
        missingLabel.textContent = `חסר ${missing}`;
        missingDocs.push({
          name: (item.querySelector("h3") as HTMLHeadingElement).textContent || "",
          count: missing,
        });
      } else {
        missingLabel.textContent = "";
      }
    }
  });

  // Update warning section
  const warningSection = document.getElementById("missingDocsWarning") as HTMLDivElement;
  //const warningList = document.getElementById("missingDocsList") as HTMLUListElement;

  if (missingDocs.length > 0) {
    warningSection.innerHTML = `<strong>שים לב!</strong> חסרים המסמכים הבאים: ${missingDocs.map((doc: { name: string }) => doc.name).join(", ")}`;
    const warningList = document.createElement("ul") as HTMLUListElement;
    warningList.className = "missing-docs-list";
    warningList.innerHTML += missingDocs.map((doc: { name: string; count: number }) => `<li>${doc.name}: חסר ${doc.count}</li>`).join("");
    warningSection.appendChild(warningList);
    warningSection.classList.add("visible");
    warningSection.classList.remove("success");
  } else if (Object.keys(docCounts).length > 0) {
    // Show summary when no documents are missing and all selectors are zero
    warningSection.classList.add("visible");
    warningSection.classList.add("success");
    const summary = Object.entries(docCounts)
      .map(([type, count]) => {
        const docItem = document.querySelector(`.doc-item[data-doc-typename="${type}"]`);
        if (docItem == null) {
          debug("Unhandled type:", type);
          if (type === "null") return "";
        }
        //const docName = docItem ? docItem.querySelector('h3').textContent : type;
        const docName = type;
        //debug("docName:", docName, "docItem:", docItem, "type:", type, "count:", count);
        return `<li>${docName}: ${count} מסמכים</li>`;
      })
      .join("");
    warningSection.innerHTML = `<strong>סיכום מסמכים:</strong>${summary}`;
  } else {
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

async function convertAnonymousAccount(email: string, password: string, fullName: string) {
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
function showInfoModal(message: string) {
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
function showWarningModal(message: string) {
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
  const toggleLink = document.getElementById("toggleFileListView") as HTMLAnchorElement;
  const fileList = document.getElementById("fileList") as HTMLElement;
  const expandableArea = document.getElementById("expandableAreaUploadFiles") as HTMLElement;

  if (!toggleLink || !fileList || !expandableArea) {
    console.error("Required elements not found");
    return;
  }

  if (editableFileList) {
    toggleLink.textContent = "נתונים קבצים";
    toggleLink.classList.add("active");
    fileList.style.display = "none";
    expandableArea.style.display = "block";
  } else {
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
    // Get the Google login URL from the backend. Call with the parameter $AUTH_BASE_URL
    //const response = await fetch(`${AUTH_BASE_URL}/google/login?redirect_base_uri=${encodeURIComponent(window.location.origin)}`);
    const url = AUTH_BASE_URL.replace("auth", "oauth2/authorization/google");
    debug("url:", url);
    window.location.href = url;
    // const response = await fetch(url);
    // if (!response.ok) {
    //   throw new Error("Failed to get Google login URL");
    // }
    // const loginUrl = await response.text();

    // // Redirect to Google login page
    // window.location.href = loginUrl;
  } catch (error) {
    console.error("Error initiating Google login:", error);
    addMessage("שגיאה בהתחברות עם Google", "error");
  }
}

// ... existing code ...

// Add event listener for Google login button
// document.addEventListener("DOMContentLoaded", () => {
//   const googleLoginButton = document.querySelector(".google-login");
//   if (googleLoginButton) {
//     googleLoginButton.addEventListener("click", (e) => {
//       e.preventDefault();
//       signInWithGoogle();
//     });
//   }
// });

// ... existing code ...

// Add function to check for Google OAuth2 callback
function checkForGoogleCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  const state = true; /*urlParams.get('state');*/

  if (code && state) {
    // We're in the OAuth2 callback
    //handleGoogleCallback();
  }
}

async function handleGoogleCallback() {
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      throw new Error("Missing code or state parameter");
    }

    // Send the code and state to the backend
    const response = await fetch(`${AUTH_BASE_URL}/auth/google/callback?code=${code}&state=${state}`, {
      method: "GET",
      credentials: "include", // Important for receiving the cookie
    });

    if (!response.ok) {
      throw new Error("Failed to complete Google login");
    }

    const data = await response.json();

    // Update UI with user info
    updateSignInUI();
    await loadExistingFiles();

    // Remove the OAuth2 parameters from the URL
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, "", url);

    addMessage("התחברת בהצלחה עם Google", "success");
  } catch (error) {
    console.error("Error handling Google callback:", error);
    addMessage("שגיאה בהתחברות עם Google", "error");
  }
}
