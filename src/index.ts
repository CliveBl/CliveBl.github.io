import { getFriendlyName, isCurrencyField, dummyName, dummyIdNumber, NO_YEAR, ANONYMOUS_EMAIL } from "./constants.js";
import { translateError,signInAnonymous, showInfoModal, showWarningModal, handleAuthResponse, SignedIn, UIVersion, ServerVersion, UserEmailValue, selectedCustomerDataEntryName, on } from "./authService.js";
import { debug, DEFAULT_CLIENT_ID_NUMBER } from "./constants.js";
// Import image utilities
import { convertImageToBWAndResize } from "./imageUtils.js";
import { cookieUtils } from "./cookieUtils.js";
import { hasUnsavedChanges, saveAllChanges, displayFileInfoInExpandableArea, editableFileListHasEntries, editableGetDocTypes, editableRemoveFileList, editableOpenFileListEntry } from "./editor.js";
import { API_BASE_URL, AUTH_BASE_URL } from "./env.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

interface FormType {
  formType: string;
  formName: string;
  userCanAdd: boolean;
  fieldTypes?: string[];
  fields?: string[];
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
let isCancelled = false;
const fetchConfig = {
  mode: "cors" as RequestMode,
};

// Patterns for which to suppress retry button on FormError files
const SUPPRESS_RETRY_PATTERNS = [
  /שנת המס-\d{4} אינה נתמכת/, // Tax year not supported
  // Add more patterns here as needed
];

// Set up event listeners
setupEventListeners();

// Check for shared files when page loads
checkForSharedFiles();

async function initializeUserSession() {
  clearTaxResults();
  await loadExistingFiles();
  await loadResults(false);
  restoreSelectedDocTypes();
  updateMissingDocuments();
  // Pre-fill feedback email if user is logged in
  feedbackEmail.value = SignedIn ? UserEmailValue : "";
}

// Update UI to show logged out state
function clearUserSession() {
  removeFileList();
  fileModifiedActions(false);
  clearMessages();

  // Clear feedback form on sign out
  clearFeedbackForm();
}

function setupEventListeners() {
  on("authServiceInitialized", () => {
    initialize();
  });
  on("signInChanged", () => {
    if (SignedIn) {
      initializeUserSession();
    } else {
      clearUserSession();
    }
  });

  on("selectedCustomerChanged", () => {
    if (SignedIn) {
      initializeUserSession();
    }
  });
  debug("setupEventListeners done");
}

// Helper function to check if retry button should be suppressed
function shouldSuppressRetryButton(reasonText: string): boolean {
  return SUPPRESS_RETRY_PATTERNS.some((pattern) => pattern.test(reasonText));
}

// Check for files shared to this app via PWA share target
async function checkForSharedFiles(): Promise<void> {
  try {
    // Check if we're on the tax return page
    if (!window.location.pathname.includes("tax_return.html")) {
      return;
    }

    // Debug logging
    console.log("checkForSharedFiles: pathname =", window.location.pathname);
    console.log("checkForSharedFiles: search =", window.location.search);

    // Check if this page was loaded with shared files parameter
    if (window.location.search.includes("shared=true") && window.location.search.includes("source=share")) {
      console.log("Detected shared files via PWA share target");

      // Try to get shared files from various sources
      const sharedFiles = await getSharedFilesFromMultipleSources();

      if (sharedFiles && sharedFiles.length > 0) {
        console.log(`Processing ${sharedFiles.length} shared files`);

        // Process shared files using existing upload logic
        await uploadFilesListener(sharedFiles, null);

        // Show success message
        showInfoModal(`הקבצים הועברו בהצלחה! התקבלו ${sharedFiles.length} קבצים באמצעות שיתוף. הקבצים עובדים כעת.`);

        // Clean up shared files
        await clearSharedFilesFromSession();
      }
    }
  } catch (error) {
    console.error("Error checking for shared files:", error);
  }
}

// Get shared files from multiple sources
async function getSharedFilesFromMultipleSources(): Promise<File[] | null> {
  try {
    // Check session storage for shared files
    const sharedFilesData = sessionStorage.getItem("sharedFiles");
    if (sharedFilesData) {
      const filesData = JSON.parse(sharedFilesData);
      console.log("Found shared files in sessionStorage:", filesData.length);

      // Convert base64 data back to File objects
      const files = await Promise.all(
        filesData.map(async (fileInfo: any) => {
          try {
            if (fileInfo.data && fileInfo.data.startsWith("data:")) {
              // Convert base64 data URL back to File object
              const response = await fetch(fileInfo.data);
              const blob = await response.blob();
              return new File([blob], fileInfo.name, {
                type: fileInfo.type,
                lastModified: fileInfo.lastModified || Date.now(),
              });
            } else {
              // Fallback: create a basic File object if data is missing
              console.warn("File data missing for:", fileInfo.name);
              return new File([], fileInfo.name, {
                type: fileInfo.type,
                lastModified: fileInfo.lastModified || Date.now(),
              });
            }
          } catch (fileError) {
            console.error("Error reconstructing file:", fileInfo.name, fileError);
            // Return a placeholder file to maintain the count
            return new File([], fileInfo.name, {
              type: fileInfo.type,
              lastModified: fileInfo.lastModified || Date.now(),
            });
          }
        })
      );

      console.log(`Successfully reconstructed ${files.length} shared files`);
      return files;
    }

    // Check if we have files in the current page context
    // This would be set by the service worker or other means
    const currentPageFiles = (window as any).sharedFiles;
    if (currentPageFiles && Array.isArray(currentPageFiles)) {
      return currentPageFiles;
    }

    // Try to get files from service worker cache as final fallback
    const cachedFiles = await getSharedFilesFromCache();
    if (cachedFiles && cachedFiles.length > 0) {
      console.log(`Retrieved ${cachedFiles.length} files from service worker cache`);
      return cachedFiles;
    }

    return null;
  } catch (error) {
    console.error("Error getting shared files from multiple sources:", error);
    return null;
  }
}

// Get shared files from session storage or other sources (kept for compatibility)
async function getSharedFilesFromSession(): Promise<File[] | null> {
  return getSharedFilesFromMultipleSources();
}

// Get shared files from service worker cache as fallback
async function getSharedFilesFromCache(): Promise<File[] | null> {
  try {
    if ("caches" in window) {
      const cache = await caches.open("shared-files");
      const keys = await cache.keys();
      const sharedFileKeys = keys.filter((key) => key.url.includes("/shared/"));

      if (sharedFileKeys.length > 0) {
        console.log(`Found ${sharedFileKeys.length} shared files in cache`);
        const files = await Promise.all(
          sharedFileKeys.map(async (key) => {
            const response = await cache.match(key);
            if (response) {
              const blob = await response.blob();
              const fileName = key.url.split("/").pop() || "shared-file";
              return new File([blob], fileName, { type: blob.type });
            }
            return null;
          })
        );

        const validFiles = files.filter((f) => f !== null) as File[];
        console.log(`Retrieved ${validFiles.length} valid files from cache`);
        return validFiles;
      }
    }
    return null;
  } catch (error) {
    console.error("Error getting shared files from cache:", error);
    return null;
  }
}

// Clear shared files from session storage and cache
async function clearSharedFilesFromSession(): Promise<void> {
  try {
    // Clear session storage
    sessionStorage.removeItem("sharedFiles");

    // Clear service worker cache
    if ("caches" in window) {
      const cache = await caches.open("shared-files");
      const keys = await cache.keys();
      const sharedFileKeys = keys.filter((key) => key.url.includes("/shared/"));

      if (sharedFileKeys.length > 0) {
        console.log(`Clearing ${sharedFileKeys.length} shared files from cache`);
        await Promise.all(sharedFileKeys.map((key) => cache.delete(key)));
      }
    }

    console.log("Cleared shared files from all storage locations");
  } catch (error) {
    console.error("Error clearing shared files from storage:", error);
  }
}

// Test function to simulate shared files via service worker message
export async function testSharedFilesViaMessage(files: File[]): Promise<boolean> {
  try {
    if (!("serviceWorker" in navigator)) {
      console.error("Service Worker not supported");
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) {
      console.error("Service Worker not active");
      return false;
    }

    console.log(`Testing shared files via message: ${files.length} files`);

    // Create a message channel for response
    const messageChannel = new MessageChannel();

    return new Promise((resolve) => {
      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          console.log("Service Worker response:", event.data.message);
          resolve(true);
        } else {
          console.error("Service Worker error:", event.data.error);
          resolve(false);
        }
      };

      // Send files to service worker
      registration.active!.postMessage(
        {
          action: "share-target",
          title: "Test Shared Tax Documents",
          text: "Simulated share from test",
          files: files,
        },
        [messageChannel.port2]
      );
    });
  } catch (error) {
    console.error("Error testing shared files via message:", error);
    return false;
  }
}

let editableFileList = sessionStorage.getItem("editableFileList") === "true";

// Get references to DOM elements
const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const fileList = document.getElementById("fileList") as HTMLUListElement;
const folderInput = document.getElementById("folderInput") as HTMLInputElement;
const processButton = document.getElementById("processButton") as HTMLButtonElement;
const deleteAllButton = document.getElementById("deleteAllButton") as HTMLButtonElement;
const saveAllButton = document.getElementById("saveAllButton") as HTMLButtonElement;
const messageContainer = document.getElementById("messageContainer") as HTMLDivElement;
const createFormSelect = document.getElementById("createFormSelect") as HTMLSelectElement;
const feedbackEmail = document.getElementById("feedbackEmail") as HTMLInputElement;
const privacyCheckbox = document.getElementById("privacyAgreement") as HTMLInputElement;
const sendFeedbackButton = document.getElementById("sendFeedbackButton") as HTMLButtonElement;
const feedbackMessage = document.getElementById("feedbackMessage") as HTMLTextAreaElement;
const resultsContainer = document.getElementById("resultsContainer") as HTMLDivElement;
const resultsList = document.getElementById("resultsList") as HTMLUListElement;

export function updateButtons(hasEntries: boolean) {
  processButton.disabled = !hasEntries;
  deleteAllButton.disabled = !hasEntries;
  saveAllButton.disabled = !hasEntries || !hasUnsavedChanges();
  updateBorderStyles(hasEntries);
}

// Function to update border styles based on file count
function updateBorderStyles(hasEntries: boolean) {
  const uploadLabels = document.querySelectorAll(".custom-file-input label");
  const docSelects = document.querySelectorAll(".doc-controls select");

  if (hasEntries) {
    // Files exist: remove red border from upload buttons and doc selects, add to process button
    uploadLabels.forEach((label) => {
      label.classList.remove("no-files-border");
    });
    docSelects.forEach((select) => {
      select.classList.remove("no-files-border");
    });
    processButton.classList.add("has-files-border");
  } else {
    // No files: add red border to upload buttons and doc selects, remove from process button
    uploadLabels.forEach((label) => {
      label.classList.add("no-files-border");
    });
    docSelects.forEach((select) => {
      select.classList.add("no-files-border");
    });
    processButton.classList.remove("has-files-border");
  }
}

function updateFileListP(fileInfoList: FileInfo[], isNewUpload = false) {
  if (editableFileList) {
    displayFileInfoInExpandableArea(fileInfoList, structuredClone(fileInfoList), isNewUpload);
    updateButtons(editableFileListHasEntries());
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
  // Update border styles when file list is cleared
  updateBorderStyles(false);
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
    const array = Array.from(document.querySelectorAll("#fileList li"))
      .map((li) => li.getAttribute("data-doc-typename"))
      .filter((type): type is string => type === "שגיאה"); // Filter to only string 'שגיאה'

    return array.concat(editableGetDocTypes());
  } else {
    return Array.from(document.querySelectorAll("#fileList li")).map((li) => li.getAttribute("data-doc-typename"));
  }
}

// Add this function to load files with existing token
async function loadExistingFiles() {
  try {
    debug("loadExistingFiles");
    const response = await fetch(`${API_BASE_URL}/getFilesInfo?customerDataEntryName=${encodeURIComponent(selectedCustomerDataEntryName)}`, {
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

    // Update border styles based on whether files were loaded
    if (fileInfoList.length === 0) {
      updateBorderStyles(false);
    }
  } catch (error: unknown) {
    // Only show message if it's not an auth error
    if (error instanceof Error && !error.message.includes("Invalid token")) {
      addMessage("שגיאה בטעינת רשימת הקבצים: " + error.message);
    }
    throw error;
  }
  debug("loadExistingFiles done");
}

// Add this helper function at the start of your script
function isValidFileType(file: File) {
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
function isInGeneratedTaxFormsFolder(filePath: string) {
  return filePath.includes("GeneratedTaxForms");
}

// Recursively walks the file system and processes file system entries (for folder drops)
// Updates the files array with the files in the entry
// Modified: Accepts a relativePathMap to store reconstructed paths
async function getFileList(entry: any, files: File[], relativePathMap?: Map<File, string>, currentPath = ""): Promise<void> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file((file: File) => {
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
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    return new Promise((resolve) => {
      const readEntries = () => {
        reader.readEntries(async (entries: any[]) => {
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
async function processFolderFiles(files: File[], button: HTMLInputElement, relativePathMap?: Map<File, string>) {
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

  // Helper function to generate a key for a file based solely on its base name (up to the first dot).
  const getBaseFileNameKey = (file: File): string => {
    const fileName = file.name;
    const lastDotIndex = fileName.lastIndexOf(".");
    return lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
  };

  // Identify all base file names that have a corresponding .json file within the validFiles list
  const jsonBaseNameKeys = new Set<string>();
  validFiles.forEach((file) => {
    if (file.name.endsWith(".json")) {
      jsonBaseNameKeys.add(getBaseFileNameKey(file));
    }
  });

  // Filter the files: keep .json files, or non-.json files that don't have a .json counterpart
  // based on their base name (ignoring path).
  const validFiles2 = validFiles.filter((file) => {
    const fileKey = getBaseFileNameKey(file);
    // Keep the file if it's a JSON file, OR if its base name does not have a corresponding JSON file.
    return file.name.endsWith(".json") || !jsonBaseNameKeys.has(fileKey);
  });

  if (validFiles2.length === 0) {
    return;
  }

  await uploadFilesWithProgress(validFiles2);
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
      errorIcon.textContent = "❌   " + "חשוב לבדוק ולתקן אם יש צורך!";
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
        // Expand the year accordion for new uploads
        yearBody.style.display = "block";
        yearToggle.textContent = "-";
      }
    }
  });

  // Update all buttons and border styles based on file list
  updateButtons(fileInfoList.length > 0);
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

/**
 * Options for configuring loading progress display
 * @example
 * // Show progress for files
 * showLoadingOverlay("Uploading files...", {
 *   total: 10,
 *   unit: "קבצים",
 *   showCancelButton: true
 * });
 *
 * // Show progress for seconds (auto-countdown)
 * // When unit is "שניות" or "seconds", the progress automatically
 * // counts up every second from 0 to the total value
 * showLoadingOverlay("Processing...", {
 *   total: 60,
 *   unit: "שניות",
 *   showCancelButton: false
 * });
 *
 * // Show progress for steps
 * showLoadingOverlay("Analyzing documents...", {
 *   total: 5,
 *   unit: "שלבים",
 *   showCancelButton: true
 * });
 */
interface LoadingProgressOptions {
  total?: number;
  unit?: string;
  showCancelButton?: boolean;
}

// Global variable to track the countdown timer
let countdownTimer: number | null = null;

function showLoadingOverlay(message: string, options: LoadingProgressOptions | boolean = false) {
  const loadingMessage = document.getElementById("loadingMessage") as HTMLDivElement;
  const loadingOverlay = document.getElementById("loadingOverlay") as HTMLDivElement;
  const cancelButton = document.getElementById("cancelLoadingButton") as HTMLButtonElement;
  const loadingProgress = document.getElementById("loadingProgress") as HTMLDivElement;
  const currentProgress = document.getElementById("currentProgress") as HTMLSpanElement;
  const totalProgress = document.getElementById("totalProgress") as HTMLSpanElement;
  const progressUnit = document.getElementById("progressUnit") as HTMLSpanElement;

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
  } else {
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
        } else {
          // Stop the timer when we reach the total
          if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
          }
        }
      }, 1000); // Update every second
    }
  } else {
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
  const loadingOverlay = document.getElementById("loadingOverlay") as HTMLDivElement;
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
function updateLoadingProgress(current: number) {
  const currentProgress = document.getElementById("currentProgress") as HTMLSpanElement;
  if (currentProgress) {
    currentProgress.textContent = current.toString();
  }
}

// Update the process button handler
processButton.addEventListener("click", async () => {
  try {
    if (!SignedIn) {
      await signInAnonymous();
    }

	if (hasUnsavedChanges()) {
		// show a modal to the user to save the changes use the warning modal function
		const confirmed = await showWarningModal("יש שינויים שלא נשמרו. האם ברצונך לשמור את השינויים?");
		if (!confirmed) {
			return;
		}
		else {
			await saveAllChanges();
		}
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
      addMessage("שגיאה: " + result.fatalProcessingError, "error");
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
      // Wait a moment for processing to complete on server
      //   await new Promise((resolve) => setTimeout(resolve, 1000));
      await loadResults();
      addMessage("העיבוד הושלם", "info");
    }
  } catch (error: unknown) {
    console.error("Processing failed:", error);
    addMessage("שגיאה בעיבוד הקבצים: " + (error instanceof Error ? error.message : String(error)), "error");
  } finally {
    hideLoadingOverlay();

    // Check if operation was cancelled
    if (isCancelled) {
      addMessage("הפעולה בוטלה על ידי המשתמש", "warning");
      return;
    }
  }
});

async function uploadFilesWithProgress(validFiles: File[], replacedFileId: string | null = null) {
  let success = false;

  // Show modal progress overlay with cancel button for file uploads
  showLoadingOverlay("מעלה קבצים...", {
    showCancelButton: true,
    total: validFiles.length,
    unit: "קבצים",
  });

  try {
    if (!SignedIn) {
      await signInAnonymous();
    }

    // Upload files one by one
    success = await uploadFiles(validFiles, replacedFileId);
  } catch (error) {
    console.error("UploadFile failed:", error);
    addMessage("שגיאה באימות: " + (error instanceof Error ? error.message : String(error)), "error");
  } finally {
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
function showPasswordModal(fileName: string) {
  return new Promise<string>((resolve) => {
    const passwordMessage = document.getElementById("passwordMessage") as HTMLLabelElement;
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

    // // Close if clicking outside
    // window.onclick = (event) => {
    //   if (event.target === modal) {
    //     modal.style.display = "none";
    //     resolve(""); // Return empty string to indicate cancellation
    //   }
    // };
  });
}

async function calculateMD5(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  // @ts-ignore
  return SparkMD5.ArrayBuffer.hash(buffer); // Always 32 hex chars
}

async function uploadFiles(validFiles: File[], replacedFileId: string | null = null) {
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
          customerDataEntryName: selectedCustomerDataEntryName,
          password: password, // Include password if provided
          replacedFileId: replacedFileId,
          imageHash: hash,
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
          updateMissingDocuments();
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
    // Update progress counter
    updateLoadingProgress(uploadedFileCount + 1);
  }
  // Count the error types in the fileInfoList
  if (fileInfoList) {
    const errorTypes = fileInfoList.filter((fileInfo: { type: string }) => fileInfo.type === "FormError").length;
    if (errorTypes > 0) {
      addMessage(`הועלו ${uploadedFileCount} קבצים מתוך ${validFiles.length}. יש ${errorTypes} שגיאות.`, "error");
    } else {
      addMessage(`הועלו ${uploadedFileCount} קבצים מתוך ${validFiles.length} `, "info");
    }
  }
  if (isCancelled) {
    return false;
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
    "^LossesTransferred": "faq-calculations",
    "^TotalChildren": "faq-common-mistakes",
    "^TaxCalc": "faq-calculation-failure"
  };
  const errorCodeToHelpId = {
    "^No106": "form106",
  };
  const messageDiv: HTMLDivElement = document.createElement("div");
  messageDiv.className = "message-item";
  if (type) {
    messageDiv.classList.add(type);
  }

  let displayedText = text;
  const messageTextSpan: HTMLSpanElement = document.createElement("span");
  messageTextSpan.className = "message-text";
  // ^<message code> indicates a message code
  const messageCode = getMessageCode(text);
  if (messageCode) {
    // Eliminate the message code from the text
    displayedText = displayedText.replace(`^${messageCode} `, "");
  }

  const dismissButton: HTMLButtonElement = document.createElement("button");
  dismissButton.className = "dismiss-button";
  dismissButton.textContent = "✕";
  dismissButton.addEventListener("click", () => {
    messageContainer.removeChild(messageDiv);
  });

  messageDiv.appendChild(messageTextSpan);
  messageDiv.appendChild(dismissButton);
  messageContainer.appendChild(messageDiv);

  // If the message contains fileName= then make messageDiv a clickable link to the entry for that file in the filelist
  if (displayedText.includes("fileName=")) {
    // Extract all fileName= and property= pairs from the message
    const fileNameMatches = displayedText.match(/fileName=[^,]+/g);
    const propertyMatches = displayedText.match(/property=[^,]+/g);

    if (fileNameMatches && fileNameMatches.length > 0) {
      // Clean up the display text by removing all fileName= and property= patterns
      let cleanText = displayedText;
      fileNameMatches.forEach((match) => {
        cleanText = cleanText.replace(match + ",", "").replace(match, "");
      });
      propertyMatches?.forEach((match) => {
        cleanText = cleanText.replace(match + ",", "").replace(match, "");
      });
      displayedText = cleanText;
      messageTextSpan.textContent = displayedText;

      // Add clickable class to show it's interactive
      messageDiv.classList.add("clickable");

      // Make the messageDiv a clickable link to open all files
      messageTextSpan.addEventListener("click", async () => {
        if (!editableFileList) {
          // switch to the editable file list view
          await toggleFileListView();
        }

        // Extract file names and properties
        const fileNames = fileNameMatches.map((match) => match.replace("fileName=", ""));
        const properties = propertyMatches ? propertyMatches.map((match) => match.replace("property=", "")) : [];

        // Open all files with their respective properties
        fileNames.forEach((fileName, index) => {
          let property = null;
          if (properties.length == 1) {
            property = properties[0];
          } else {
            property = properties[index] || null;
          }
          const shouldScrollTo = index === 0; // Only scroll to the first one
          openFileListEntryP(fileName, property, shouldScrollTo);
        });
      });
    }
  } else if (messageCode) {
    // If the message contains a message code, make it clickable to navigate to FAQ or help
    const faqId = errorCodeToFaqId[`^${messageCode}` as keyof typeof errorCodeToFaqId];
    const helpId = errorCodeToHelpId[`^${messageCode}` as keyof typeof errorCodeToHelpId];

    if (faqId) {
      // Add clickable class to show it's interactive
      messageDiv.classList.add("clickable");
      messageTextSpan.className = "message-text-help";
      // Make the messageDiv a clickable link to the FAQ
      messageTextSpan.addEventListener("click", () => {
        window.location.href = `faq.html#${faqId}`;
      });
    } else if (helpId) {
      // Add clickable class to show it's interactive
      messageDiv.classList.add("clickable");
      messageTextSpan.className = "message-text-help";
      // Make the messageDiv a clickable link to the help page
      messageTextSpan.addEventListener("click", () => {
        window.location.href = `help.html#${helpId}`;
      });
    }
  }
  const translatedText = translateError(displayedText);
  messageTextSpan.textContent = translatedText;
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

async function loadResults(scrollToMessageSection = true) {
  try {
    const response = await fetch(`${API_BASE_URL}/getResultsInfo?customerDataEntryName=${encodeURIComponent(selectedCustomerDataEntryName)}`, {
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
          addMessage("שגיאה: " + result.messages.fatalProcessingError, "error", scrollToMessageSection);
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
        taxCalculateButton.title = "חשב את המס לתשלום או להחזר עבור שנת המס של הקובץ";
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
      downloadButton.title = "הורד את הקובץ";

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
    const response = await fetch(`${API_BASE_URL}/downloadResultsFile?fileName=${encodeURIComponent(fileName)}&customerDataEntryName=${encodeURIComponent(selectedCustomerDataEntryName)}`, {
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

saveAllButton.addEventListener("click", async () => {
  try {
    if (!SignedIn) {
      debug("no auth token");
      return;
    }
    await saveAllChanges();
  } catch (error: unknown) {
    console.error("Save all failed:", error);
    addMessage("שגיאה בשמירת הקבצים: " + (error instanceof Error ? error.message : String(error)), "error");
  }
});

// Update delete all handler - remove confirmation dialog
deleteAllButton.addEventListener("click", async () => {
  try {
    if (!SignedIn) {
      debug("no auth token");
      return;
    }
    const confirmed = await showWarningModal("האם אתה בטוח שברצונך למחוק את כל המסמכים שהוזנו?");
    if (!confirmed) return;

    const response = await fetch(`${API_BASE_URL}/deleteAllForms?customerDataEntryName=${encodeURIComponent(selectedCustomerDataEntryName)}`, {
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

      const items = Array.from(e.dataTransfer?.items || []);
      const files: File[] = [];
      // New: Map to store reconstructed relative paths
      const relativePathMap = new Map<File, string>();

      // Process each dropped item
      for (const item of items) {
        if (item.kind === "file") {
          // Use type assertion to access webkitGetAsEntry
          const webkitItem = item as any;
          const entry = webkitItem.webkitGetAsEntry?.() || webkitItem.getAsEntry?.();
          if (entry) {
            await getFileList(entry, files, relativePathMap, "");
          } else {
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
      const response = await fetch(`${API_BASE_URL}/deleteForm?fileId=${fileId}&customerDataEntryName=${encodeURIComponent(selectedCustomerDataEntryName)}`, {
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
      const response = await fetch(`${API_BASE_URL}/deleteForm?fileId=${fileId}&customerDataEntryName=${encodeURIComponent(selectedCustomerDataEntryName)}`, {
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
                } else if (itemKey.endsWith("Boolean")) {
                  itemField.innerHTML = `<strong>${getFriendlyName(itemKey)}:</strong> ${itemValue === "true" ? "כן" : "לא"}`;
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
        } else if (key.endsWith("Boolean")) {
          field.innerHTML = `<strong>${getFriendlyName(key)}:</strong> ${value === "true" ? "כן" : "לא"}`;
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

    // // Close any other open accordions first
    // const allAccordions = document.querySelectorAll(".accordion-content");
    // const allExpandIcons = document.querySelectorAll(".expand-icon");
    // const allEditButtons = document.querySelectorAll(".edit-button");
    // const allFileNames = document.querySelectorAll(".fileNameElement");

    // allAccordions.forEach((acc, index) => {
    //   if (acc !== accordionContent && (acc as HTMLElement).style.display === "block") {
    //     (acc as HTMLElement).style.display = "none";
    //     allExpandIcons[index].textContent = "▼";
    //     allExpandIcons[index].classList.remove("expanded");
    //     (allEditButtons[index] as HTMLButtonElement).style.display = "none";
    //     allFileNames[index].classList.remove("expanded");
    //   }
    // });

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
  deleteButton.type = "button";
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

    const retryButton = document.createElement("button") as HTMLButtonElement;
    retryButton.type = "button";
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
  updateButtons(hasEntries);
  updateMissingDocuments();
  clearResultsControls();
}

// Return true if the response is ok, false if we signed out otherwise throw an exception..
export async function handleResponse(response: any, errorMessage: string) {
  if (await handleAuthResponse(response, errorMessage)) {
    return true;
  }
  clearUserSession();
  return false;
}

async function calculateTax(fileName: string) {
  try {
    if (!SignedIn) {
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

    const response = await fetch(`${API_BASE_URL}/calculateTax?customerDataEntryName=${encodeURIComponent(selectedCustomerDataEntryName)}`, {
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
      clearTaxResults();
      return;
    }

    const result = await response.json();

    // Show success message
    addMessage("חישוב המס הושלם בהצלחה", "info");

    // Store and display results with scroll
    displayTaxCalculation(result, taxCalcTaxYear, true);
    // Store tax results
    localStorage.setItem("taxResultsYear", taxCalcTaxYear);
    localStorage.setItem("taxResults", JSON.stringify(result));
  } catch (error: unknown) {
    console.error("Calculate tax failed:", error);
    clearTaxResults();
    addMessage("שגיאה בחישוב המס: " + (error instanceof Error ? error.message : String(error)), "error");
  } finally {
    hideLoadingOverlay();

    // Check if operation was cancelled
    if (isCancelled) {
      addMessage("הפעולה בוטלה על ידי המשתמש", "warning");
      return;
    }
  }
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

  // Update title with year
  const taxResultsTitle = document.getElementById("taxResultsTitle") as HTMLHeadingElement;
  const titleSpan = taxResultsTitle.querySelector("span");
  if (titleSpan) {
    titleSpan.textContent = `תוצאות חישוב מס עבור שנה ${year}`;
  }

  // Add event listener for copy button
  const copyButton = document.getElementById("copyTaxResultsBtn");
  if (copyButton) {
    copyButton.addEventListener("click", copyTaxResults);
  }

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

// Function to copy tax results to clipboard
async function copyTaxResults() {
  try {
    const taxResultsContainer = document.getElementById("taxResultsContainer");
    if (taxResultsContainer) {
      // Copy the entire tax results container for complete context
      const htmlContent = taxResultsContainer.innerHTML;
      const blob = new Blob([htmlContent], { type: "text/html" });

      // Use clipboard API with blob for rich HTML copying
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": blob,
          "text/plain": blob,
        }),
      ]);

      const copyButton = document.getElementById("copyTaxResultsBtn");
      if (copyButton) {
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = "הועתק!";
        copyButton.title = "הועתק ללוח";

        // Reset button after 2 seconds
        setTimeout(() => {
          copyButton.innerHTML = "העתק";
          copyButton.title = "העתק תוצאות מס";
        }, 2000);
      }
    }
  } catch (error) {
    // Fallback for older browsers or when clipboard API is not available
    try {
      const taxResultsContainer = document.getElementById("taxResultsContainer");
      if (taxResultsContainer) {
        // Create a temporary textarea to copy the entire container content
        const textarea = document.createElement("textarea");
        textarea.value = taxResultsContainer.innerHTML;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);

        const copyButton = document.getElementById("copyTaxResultsBtn");
        if (copyButton) {
          const originalText = copyButton.innerHTML;
          copyButton.innerHTML = "הועתק!";
          copyButton.title = "הועתק ללוח";

          // Reset button after 2 seconds
          setTimeout(() => {
            copyButton.innerHTML = "העתק";
            copyButton.title = "העתק תוצאות מס";
          }, 2000);
        }
      }
    } catch (fallbackError) {
      console.error("Failed to copy tax results:", fallbackError);
    }
  }
}

// Initialize when DOM is ready
async function initialize() {
  const versionNumberElement = document.getElementById("versionNumber") as HTMLSpanElement;
  debug("initialize");

  // Check if user is on tax_return.html and redirect if privacy agreement not accepted
  if (window.location.pathname.includes("tax_return.html")) {
    const disclaimerAccepted = cookieUtils.get("disclaimerAccepted");
    if (!disclaimerAccepted) {
      console.log("Privacy agreement not accepted, redirecting to index.html");
      window.location.href = "index.html";
      return;
    }
  }

  try {
    await loadConfiguration();
    versionNumberElement.textContent = `גרסה ${UIVersion}`;

    if (SignedIn) {
      versionNumberElement.textContent = `גרסה ${ServerVersion} ${UIVersion}`;

      initializeDocumentIcons();
      await loadExistingFiles();
      await loadResults(false); // Dont scroll
      debug("Successfully loaded files and results with existing token");
    }
  } catch (error) {
    console.error("Exception fetching Basic Info:", error);
  }
  if (!SignedIn) {
    debug("Not signed in");
  }

  // Pre-fill feedback email if user is logged in
  feedbackEmail.value = SignedIn ? UserEmailValue : "";
  updateFeedbackButtonState();

  // Add event listeners for document count selects
  document.querySelectorAll('select[id$="-count"]').forEach((select) => {
    // Add a option to upload a file
    select.innerHTML += `<option value="upload file">העלאת מסמך</option>`;
    // Add option to the select only if the user can add forms
    if (configurationData != null && configurationData.formTypes.some((formType) => formType.userCanAdd)) {
      select.innerHTML += `<option value="create form">צור חדש</option>`;
    }
    // Add event listener to the select
    select.addEventListener("change", async (e) => {
      const selectElement = e.target as HTMLSelectElement;
      if (selectElement.value === "create form") {
        // Get the document type from the select's id
        const docType = selectElement.id.replace("-count", "");
        const docTypeName = selectElement.closest(".doc-item")?.getAttribute("data-doc-typename") || "";

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
        selectElement.value = selectElement.getAttribute("data-previous-value") || "0";
        // Cancel pulsing animation on all document items when create form is selected
        document.querySelectorAll(".doc-controls select").forEach((docSelect) => {
          docSelect.classList.remove("no-files-border");
        });
      } else if (selectElement.value === "upload file") {
        // Open the select document dialog
        const fileInput = document.getElementById("fileInput") as HTMLInputElement;
        const currentValue = selectElement.getAttribute("data-previous-value") || "0";
        fileInput.click();
        // Reset the count select to its previous value
        // If target.value is an integer, add 1 to it until reaches the maximum value and then leave it at the maximum value.
        if (!isNaN(parseInt(currentValue))) {
          const newValue = Math.max(parseInt(currentValue), selectElement.options.length - 3); // -3 because we have 3 options: upload file, create form, and 0
          selectElement.value = newValue.toString();
          selectElement.setAttribute("data-previous-value", selectElement.value);
        }
        // Cancel pulsing animation on all document items when upload file is selected
        document.querySelectorAll(".doc-controls select").forEach((docSelect) => {
          docSelect.classList.remove("no-files-border");
        });
      } else {
        // Store the current value for future reference
        selectElement.setAttribute("data-previous-value", selectElement.value);
      }
      // Updates panel color
      const docItem = select.closest(".doc-item") as HTMLElement;
      if (parseInt((select as HTMLSelectElement).value) > 0) {
        docItem.classList.add("selected");
        // Cancel pulsing animation on all document items when any doc item is selected
        document.querySelectorAll(".doc-controls select").forEach((docSelect) => {
          docSelect.classList.remove("no-files-border");
        });
      } else {
        docItem.classList.remove("selected");
      }
      saveSelectedDocTypes();
      updateMissingDocuments();
    });
  });

  // Add event listener for info-section toggle
  const infoSectionToggle = document.getElementById("infoSectionToggle");
  const infoSectionContent = document.getElementById("infoSectionContent");
  if (infoSectionToggle && infoSectionContent) {
    // Check if info section was previously collapsed
    const wasCollapsed = sessionStorage.getItem("infoSectionCollapsed") === "true";
    if (wasCollapsed) {
      // Already collapsed by default in HTML, just update the icon and title
      const toggleIcon = infoSectionToggle.querySelector("#infoSectionToggleIcon") as HTMLElement;
      toggleIcon.textContent = "▼"; // Use same icons as editor accordion
      infoSectionToggle.title = "הצג מידע";
    } else {
      // Expand the section by removing the collapsed class
      infoSectionContent.classList.remove("collapsed");
      const toggleIcon = infoSectionToggle.querySelector("#infoSectionToggleIcon") as HTMLElement;
      toggleIcon.textContent = "▲"; // Use same icons as editor accordion
      infoSectionToggle.title = "הסתר מידע";
    }

    infoSectionToggle.addEventListener("click", () => {
      const isCollapsed = infoSectionContent.classList.contains("collapsed");
      const toggleIcon = infoSectionToggle.querySelector("#infoSectionToggleIcon") as HTMLElement;

      if (isCollapsed) {
        // Expand the section
        infoSectionContent.classList.remove("collapsed");
        toggleIcon.textContent = "▲"; // Use same icons as editor accordion
        infoSectionToggle.title = "הסתר מידע";
        sessionStorage.setItem("infoSectionCollapsed", "false");
      } else {
        // Collapse the section
        infoSectionContent.classList.add("collapsed");
        toggleIcon.textContent = "▼"; // Use same icons as editor accordion
        infoSectionToggle.title = "הצג מידע";
        sessionStorage.setItem("infoSectionCollapsed", "true");
      }
    });
  }

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

  const toggleLink = document.getElementById("toggleFileListView");
  if (toggleLink) {
    toggleLink.addEventListener("click", (e) => {
      if (SignedIn) {
        e.preventDefault();
        toggleFileListView();
      }
    });
  }

  // Check if disclaimer has been accepted
  const disclaimerAccepted = cookieUtils.get("disclaimerAccepted");
  if (!disclaimerAccepted) {
    showInfoModal(
      "אתר זה זמין ללא תשלום במטרה לסייע לאנשים המעוניינים להכין את הדו״ח השנתי שלהם למס הכנסה בעצמם. איננו מייצגים אתכם מול רשויות המס. אנא קראו בעיון את התנאים וההגבלות לפני המשך השימוש."
    );
    cookieUtils.set("disclaimerAccepted", "true", 365);
  }

  // Initialize the file list view
  updateFileListView();
  // Needs to be last so that select elements can be populated before updating them.
  restoreSelectedDocTypes();
  // Update missing documents
  updateMissingDocuments();
}

// Function to validate email format
function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Function to update feedback button state
function updateFeedbackButtonState() {
  sendFeedbackButton.disabled = !SignedIn || !isValidEmail(feedbackEmail.value) || !privacyCheckbox.checked;
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
  } catch (error: unknown) {
    console.error("Failed to submit feedback:", error);
    addMessage("שגיאה בשליחת המשוב: " + (error instanceof Error ? error.message : String(error)), "error");
  }
});

function clearFeedbackForm() {
  feedbackEmail.value = "";
  feedbackMessage.value = "";
  privacyCheckbox.checked = false;
  updateFeedbackButtonState();
}

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
      const selectElement = docItem.querySelector("select") as HTMLSelectElement;
      if (selectElement) {
        if (selectElement.options.length > 0) {
          selectElement.value = value as string;
          // Update selected class based on value
          if (parseInt(value as string) > 0) {
            docItem.classList.add("selected");
          } else {
            docItem.classList.remove("selected");
          }
        }
      }
    }
  });
}

// Add change handler for form select
(document.getElementById("createFormSelect") as HTMLSelectElement).addEventListener("change", async (e) => {
  if (!SignedIn) {
    await signInAnonymous();
  }
  const formType = (e.target as HTMLSelectElement).value as string;
  if (!formType) return;

  const identificationNumber = DEFAULT_CLIENT_ID_NUMBER;

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
    if (!editableFileList) {
      // switch to the editable file list view without loading the existing files becaue we already have them in fileInfoList
      await toggleFileListView(false);
    }
    updateFileListP(fileInfoList, true); // true = new form creation
    updateMissingDocuments();
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
  debug("updateMissingDocuments");
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

  const warningSection = document.getElementById("missingDocsWarning") as HTMLDivElement;

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
async function toggleFileListView(loadExistingFilesBoolean = true) {
  editableFileList = !editableFileList;
  sessionStorage.setItem("editableFileList", editableFileList.toString());
  updateFileListView();
  if (loadExistingFilesBoolean) {
    await loadExistingFiles();
  }
}
