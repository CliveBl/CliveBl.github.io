import { configurationData, debug, addMessage, handleResponse, updateButtons, fileModifiedActions, clearMessages, addFileToList } from "./index.js";
import { API_BASE_URL } from "./env.js";
import { getFriendlyName, getFriendlyOptions, getFriendlyOptionName, isCurrencyField, isExceptionalIntegerField, isFieldValidForTaxYear, 
	dummyName, dummyIdNumber, NO_YEAR } from "./constants.js";
/* ********************************************************** Generic modal ******************************************************************** */

function makeUniqueId() {
  return `field-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function customerMessageModal({
  title,
  message,
  button1Text,
  button2Text = null,
  displayTimeInSeconds = 1,
}: {
  title: string;
  message: string;
  button1Text: string;
  button2Text?: string | null;
  displayTimeInSeconds?: number;
}) {
  return new Promise((resolve) => {
    // Remove any existing modal
    const existingModal = document.getElementById("customModal");
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal container
    const timeModal = document.createElement("div");
    timeModal.id = "customModal";

    const timeModalContent = document.createElement("div");
    timeModalContent.className = "time-modal-content";

    const timeModalTitle = document.createElement("h2");
    timeModalTitle.textContent = title;
    timeModalTitle.className = "time-modal-title";
    timeModalContent.appendChild(timeModalTitle);

    const timeModalMessage = document.createElement("p");
    timeModalMessage.textContent = message;
    timeModalMessage.className = "time-modal-message";
    timeModalContent.appendChild(timeModalMessage);

    const timeModalButtonContainer = document.createElement("div") as HTMLDivElement;
    timeModalButtonContainer.className = "time-modal-button-container";
    timeModalButtonContainer.style.justifyContent = button2Text ? "space-between" : "center";

    const timeModalCountdownText = document.createElement("p");
    timeModalCountdownText.textContent = `Closing in ${displayTimeInSeconds} seconds...`;
    timeModalCountdownText.className = "time-modal-countdown";
    timeModalContent.appendChild(timeModalCountdownText);

    // If displayTimeInSeconds > 0, hide buttons and auto-close
    if (displayTimeInSeconds > 0) {
      // Countdown update every second
      let remainingTime = displayTimeInSeconds;
      const countdownInterval = setInterval(() => {
        remainingTime--;
        timeModalCountdownText.textContent = `Closing in ${remainingTime} seconds...`;

        if (remainingTime <= 0) {
          clearInterval(countdownInterval);
          timeModal.remove();
          resolve(0); // Return 0 when auto-closing
        }
      }, 1000);
    } else {
      // Button 1
      const timeModalButton1 = document.createElement("button") as HTMLButtonElement;
      timeModalButton1.textContent = button1Text;
      timeModalButton1.className = "time-modal-button";
      timeModalButton1.onclick = () => {
        timeModal.remove(); // Close modal
        resolve(1); // Return 1 for first button clicked
      };
      timeModalButtonContainer.appendChild(timeModalButton1);

      // Button 2 (if provided)
      if (button2Text) {
        const timeModalButton2 = document.createElement("button") as HTMLButtonElement;
        timeModalButton2.textContent = button2Text;
        timeModalButton2.className = "time-modal-button";
        timeModalButton2.onclick = () => {
          timeModal.remove(); // Close modal
          resolve(2); // Return 2 for second button clicked
        };
        timeModalButtonContainer.appendChild(timeModalButton2);
      }

      timeModalContent.appendChild(timeModalButtonContainer);
    }

    timeModal.appendChild(timeModalContent);
    document.body.appendChild(timeModal);
  });
}

const excludedHeaderFields = ["organizationName", "clientIdentificationNumber", "clientName", "documentType", "type", "fileId", "matchTag", "fieldTypes"];
const readOnlyFields = ["fileName", "reasonText"];
const addFieldsText = "הצג כל השדות";
const removeFieldsText = "הציג סדות שיש ערכים בלבד";
const MAX_INTEGER_LENGTH = 10;
// Template map years: template name
const template867YearsMap = {
  2018: "template_867_2022",
  2019: "template_867_2022",
  2020: "template_867_2022",
  2021: "template_867_2022",
  2022: "template_867_2022",
  2023: "template_867_2022",
  2024: "template_867_2022",
};

interface Value {
  type: string;
  value: any;
}

const Child = {
  birthDate: "",
  noSecondParentBoolean: false,
  caringForBoolean: true,
  requestDelayOfPointsBoolean: false,
  requestUsePointsFromLastYearBoolean: false,
};

const Generic867Item = {
  field867Type: "NONE",
  value: "0.00",
  explanationText: "",
};
const Generic106Item = {
  field106Type: "NONE",
  value: "0.00",
  explanationText: "",
};

function getDataFromControls(accordionBody: HTMLDivElement, fileData: any) {
  const updatedData = { ...fileData }; // Clone original fileData

  function normalizeDate(dateValue: string) {
    if (dateValue) {
      const [year, month, day] = dateValue.split("-");
      return `${day}/${month}/${year}`;
    } else {
      return "";
    }
  }

  function getElementValue(element: HTMLElement): string {
    if (element instanceof HTMLInputElement) {
      return element.value;
    } else if (element instanceof HTMLSelectElement) {
      return element.value;
    }
    return "";
  }

  function getControlValue(htmlElement: HTMLElement, fieldName: string) {
    let fieldValue: string = getElementValue(htmlElement);
    if (isCurrencyField(fieldName)) {
      fieldValue = fieldValue.replace(/[₪,]/g, "");
      if (!isNaN(parseFloat(fieldValue)) && isFinite(parseFloat(fieldValue))) {
        fieldValue = parseFloat(fieldValue).toFixed(2);
      } else {
        fieldValue = "0.00";
      }
    } else if (fieldName.endsWith("Date")) {
      fieldValue = normalizeDate(getElementValue(htmlElement));
    } else if (fieldName.endsWith("Options")) {
      const radioButtons = htmlElement.querySelectorAll("input[type='radio']");
      for (const radioButton of radioButtons) {
        const rb = radioButton as HTMLInputElement;
        if (rb.checked) {
          fieldValue = rb.value;
          break;
        }
      }
    }
    return fieldValue;
  }

  const formDetails = configurationData.formTypes.find((form) => form.formType === fileData.type) as { fieldTypes?: string[] };

  // Update regular fields
  accordionBody.querySelectorAll("input[data-field-name],select[data-field-name],div[data-field-name]:not(.item-container input)").forEach((htmlElement: Element) => {
    // Check the ancestors of the htmlElement are not item containers. We update those later.
    const isInItemContainer = htmlElement.closest(".item-container") !== null;
    if (!isInItemContainer) {
      const fieldName = htmlElement.getAttribute("data-field-name") as string;
      const isField = formDetails.fieldTypes?.find((field) => field === fieldName) !== undefined;
      const fieldValue = getControlValue(htmlElement as HTMLElement, fieldName);
      if (isField) {
        updatedData.fields[fieldName] = fieldValue;
      } else if (fieldName in fileData) {
        updatedData[fieldName] = fieldValue;
      }
    }
  });

  // Update header fields
  const headerContainer = accordionBody.closest(".accordion-container")?.querySelector(".header-fields-wrapper");
  if (headerContainer) {
    headerContainer.querySelectorAll("input[data-field-name]").forEach((htmlElement: Element) => {
      const fieldName = htmlElement.getAttribute("data-field-name") as string;
      let fieldValue = getControlValue(htmlElement as HTMLElement, fieldName);
      updatedData[fieldName] = fieldValue;
    });
  }

  // Update item containers
  const itemTitles: HTMLDivElement[] = Array.from(accordionBody.querySelectorAll(".item-title"));
  for (const itemTitle of itemTitles) {
    const itemArrayName: string = itemTitle.getAttribute("name") || "";
    // Get all item containers with the name attribute matching itemArrayName.
    const itemContainers = Array.from(accordionBody.querySelectorAll(".item-container") as NodeListOf<HTMLElement>).filter((container) => container.getAttribute("name") === itemArrayName);
    if (itemContainers.length > 0) {
      updatedData[itemArrayName] = [];
      // Iterate over all item containers and update the item data.
      for (let i = 0; i < itemContainers.length; i++) {
        const container = itemContainers[i];
        const item: any = {};
        const htmlElements: HTMLElement[] = Array.from(container.querySelectorAll("input[data-field-name], select[data-field-name], div[data-field-name]"));
        // Iterate over all html elements and populate an item with the field names and values from the controls.
        for (const htmlElement of htmlElements) {
          const fieldName = htmlElement.getAttribute("data-field-name") as string;
          item[fieldName] = getControlValue(htmlElement, fieldName);
        }
        updatedData[itemArrayName].push(item);
      }
    }
  }

  return updatedData;
}

export function editableFileListHasEntries() {
  const expandableArea = document.getElementById("expandableAreaUploadFiles");
  if (!expandableArea) {
    console.error('Element with id "expandableAreaUploadFiles" not found!');
    return false;
  }
  // Query the number of accordionContainer elements in the expandableArea
  const accordionContainers = expandableArea?.querySelectorAll("#expandableAreaUploadFiles #accordionContainer");
  return accordionContainers.length > 0;
}

export function editableGetDocTypes() {
  // Get all accordionContainers and map to their document types
  return Array.from(document.querySelectorAll("#expandableAreaUploadFiles #accordionContainer"))
    .map((div) => div.getAttribute("data-doc-typename"))
    .filter(Boolean); // Remove any null/undefined values
}

export function editableRemoveFileList() {
  const expandableArea = document.getElementById("expandableAreaUploadFiles") as HTMLElement;
  expandableArea.innerHTML = "";
}

export function editableOpenFileListEntry(fileName: string, property: string | null, shouldScrollTo = true) {
  // Find the accordion container that contains the file name in its header fields
  const accordionContainers = document.querySelectorAll("#expandableAreaUploadFiles #accordionContainer");

  for (const container of accordionContainers) {
    // Look for either an input or label with data-field-name="fileName"
    const fileNameElement = container.querySelector('input[data-field-name="fileName"], span[data-field-name="fileName"]') as HTMLInputElement | HTMLSpanElement;
    if (fileNameElement && fileNameElement.textContent === fileName) {
      // Find the toggle button (first child of the header)
      const header = container.querySelector("div") as HTMLDivElement; // First div is the header
      const toggleButton = header.querySelector(".accordion-toggle-button") as HTMLButtonElement;
      if (toggleButton) {
        // Find the parent year accordion container and its toggle button
        const yearContainer = container.closest(".date-accordion-container");
        if (yearContainer) {
          const yearToggleButton = yearContainer.querySelector(".date-accordion-toggle-button") as HTMLButtonElement;
          const yearBody = yearContainer.querySelector(".date-accordion-body") as HTMLDivElement;
          // Only open the year accordion if it's currently closed
          if (yearToggleButton && yearBody && yearBody.style.display === "none") {
            yearBody.style.display = "block";
            yearToggleButton.textContent = "-";
          }
        }
        // Only click the toggle button if the accordion is currently closed
        const accordionBody = container.querySelector(".accordian-body") as HTMLDivElement;
        if (accordionBody && accordionBody.style.display === "none") {
          toggleButton.click(); // This will trigger the accordion toggle
        }
        if (property) {
          // Mark the field with the property as error. Search for the field by data
          const field = container.querySelector(`input[data-field-name="${property}"]`) as HTMLInputElement;
          setFieldError(field, !shouldScrollTo);
        }

        // Scroll the container into view with smooth behavior only if shouldScroll is true
        if (shouldScrollTo) {
          container.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        break;
      }
    }
  }
}

function setFieldError(field: HTMLElement, shouldSelect = false) {
  if (field) {
    field.classList.remove("changed");
    field.classList.add("error");
    // set focus to the field and select the text if it is an input
    if (field instanceof HTMLInputElement && !shouldSelect) {
      field.focus();
      field.select();
    }
  }
}

function setFieldChanged(field: HTMLElement) {
  if (field) {
    field.classList.remove("error");
    field.classList.add("changed");
  } else {
    console.error("Field not found");
  }
}

function setFieldNotChanged(field: HTMLElement) {
  if (field) {
    field.classList.remove("changed");
    field.classList.remove("error");
  }
}

export async function displayFileInfoInExpandableArea(allFilesData: any, backupAllFilesData: any, withAllFields = false, isNewUpload = false) {
  const expandableArea = document.getElementById("expandableAreaUploadFiles") as HTMLDivElement;
  if (!expandableArea) {
    console.error('Element with id "expandableAreaUploadFiles" not found!');
    return;
  }

  expandableArea.innerHTML = "";
  expandableArea.style.display = "block";

  // Group files by year
  const filesByYear = new Map<string, any[]>();
  allFilesData.forEach((fileData: any) => {
    // Use taxYear for grouping
    let year = NO_YEAR;
    if (fileData.taxYear && fileData.taxYear.trim() !== "") {
      year = fileData.taxYear;
    }

    // Initialize the year group if it doesn't exist
    if (!filesByYear.has(year)) {
      filesByYear.set(year, []);
    }

    // Check if this file is already in the year group
    const yearGroup = filesByYear.get(year) || [];
    const isDuplicate = yearGroup.some((file) => file.fileId === fileData.fileId);

    // Only add the file if it's not already in the group
    if (!isDuplicate) {
      yearGroup.push(fileData);
      filesByYear.set(year, yearGroup);
    }
  });

  // Sort years in descending order
  const sortedYears = Array.from(filesByYear.keys()).sort((a, b) => {
    if (a === NO_YEAR) return -1;
    if (b === NO_YEAR) return 1;
    return parseInt(b) - parseInt(a);
  });

  // Create year-level accordions
  sortedYears.forEach((year) => {
    const files = filesByYear.get(year) || [];

    // Create year container
    const yearContainer = document.createElement("div") as HTMLDivElement;
    yearContainer.className = "date-accordion-container";

    // Create year header
    const yearHeader = document.createElement("div") as HTMLDivElement;
    yearHeader.className = "date-accordion-header";
    if (files.some((file) => file.type === "FormError")) {
      yearHeader.className += " error";
    }

    // Create year toggle button
    const yearToggleButton = document.createElement("button") as HTMLButtonElement;
    yearToggleButton.textContent = "+";
    yearToggleButton.className = "date-accordion-toggle-button";
    yearHeader.appendChild(yearToggleButton);

    // Create year title
    const yearTitle = document.createElement("span") as HTMLSpanElement;
    yearTitle.textContent = year;
    yearTitle.className = "date-title";

    // Add error icon if year is NO_YEAR
    if (year === NO_YEAR) {
      const errorIcon = document.createElement("span") as HTMLSpanElement;
      errorIcon.textContent = "❌   " + "חשוב לבדוק ולתקן אם יש צורך!"
      errorIcon.className = "year-error-icon";
      errorIcon.title = "שנה לא זוהתה - יש לבדוק את המסמך";
      yearTitle.appendChild(errorIcon);
    }

    yearHeader.appendChild(yearTitle);

    // Create year body
    const yearBody = document.createElement("div") as HTMLDivElement;
    yearBody.className = "date-accordion-body";
    yearBody.style.display = "none";

    // Add toggle functionality
    yearToggleButton.onclick = () => {
      yearBody.style.display = yearBody.style.display === "none" ? "block" : "none";
      yearToggleButton.textContent = yearToggleButton.textContent === "+" ? "-" : "+";
    };

    displayFileInfoHeader(yearBody, allFilesData);

    // Add files to year body
    files.forEach((fileData: any) => {
      if (fileData.type === "FormError") {
        // displayFileInfoLineError(headerFieldsContainer, fileData, accordionToggleButton);
        const fileElement = addFileToList(fileData);
        yearBody.appendChild(fileElement);
        // 	accordionContainer.classList.add("error");
        return;
      }
      const accordionContainer = document.createElement("div") as HTMLDivElement;
      accordionContainer.id = "accordionContainer";
      accordionContainer.className = "accordion-container";
      accordionContainer.setAttribute("data-doc-typename", fileData.documentType);

      // Accordion Header
      const accordianheader = document.createElement("div") as HTMLDivElement;
      accordianheader.className = "accordion-header";

      // Accordion Body (Initially Hidden)
      const accordianBody = document.createElement("div") as HTMLDivElement;
      accordianBody.className = "accordian-body";
      accordianBody.style.display = "none";

      // Toggle Button (+/-)
      const accordionToggleButton = document.createElement("button") as HTMLButtonElement;
      accordionToggleButton.className = "accordion-toggle-button";

      displayFileInfoPlusMinusButton(accordianBody, accordionToggleButton);
      accordianheader.appendChild(accordionToggleButton);
      // Header Fields
      const headerFieldsContainer = document.createElement("div") as HTMLDivElement;
      headerFieldsContainer.style.display = "flex";

      displayFileInfoLine(accordianBody, headerFieldsContainer, fileData);

      accordianheader.appendChild(headerFieldsContainer);

      // Delete Button
      const editorDeleteButton = document.createElement("button") as HTMLButtonElement;

      displayFileInfoDeleteButton(editorDeleteButton, fileData, accordionContainer);

      accordianheader.appendChild(editorDeleteButton);

      accordionContainer.appendChild(accordianheader);

      function toggleFieldsView(toggleLink: HTMLAnchorElement) {
        // Get desired state.
        const showAllFields: boolean = toggleLink.textContent === addFieldsText;
        // Perform the toggle by changing the text content of the toggle link.
        if (showAllFields) {
          toggleLink.textContent = removeFieldsText;
        } else {
          toggleLink.textContent = addFieldsText;
        }

        // Render the new form with the data from the controls of the current form.
        const updatedData = updateFormAllFields(allFilesData, fileData.fileId, fileData.type, getDataFromControls(accordianBody, fileData), showAllFields);
        if (updatedData) {
          // Find the form in the allFilesData array.
          const formIndex = updatedData.findIndex((form: any) => form.fileId === fileData.fileId);
          if (formIndex !== -1) {
            // Render the new form with the data from the controls of the current form.
            renderFields(updatedData[formIndex], accordianBody, showAllFields);
          }
          fileModifiedActions(editableFileListHasEntries());
        }
      }

      function handleToggleClick(e: Event) {
        e.preventDefault(); // Prevent scrolling to the top of the page
        const toggleLink = e.currentTarget as HTMLAnchorElement;
        toggleFieldsView(toggleLink);
      }

      if (fileData.fields && configurationData) {
        // Create div with a toggle link for displaying all fields
        const toggleLinkContainer = document.createElement("div") as HTMLDivElement;
        toggleLinkContainer.className = "fields-toggle";
        const fieldsToggleLink = document.createElement("a") as HTMLAnchorElement;
        fieldsToggleLink.className = "fields-toggle-link";
        fieldsToggleLink.textContent = addFieldsText;
        fieldsToggleLink.href = "#";
        fieldsToggleLink.addEventListener("click", handleToggleClick);
        toggleLinkContainer.appendChild(fieldsToggleLink);
        accordianBody.appendChild(toggleLinkContainer);
      }
      // Form Action Buttons
      const saveButton = document.createElement("button") as HTMLButtonElement;
      saveButton.className = "form-action-button";
      saveButton.disabled = true;
      const cancelButton = document.createElement("button") as HTMLButtonElement;
      cancelButton.className = "form-action-button";
      cancelButton.disabled = true;

      // First, display additional fields in the body (excluding header fields)
      renderFields(fileData, accordianBody, withAllFields);

      displayFileInfoButtons(saveButton, cancelButton, fileData, accordianBody, allFilesData);

      accordianBody.appendChild(saveButton);
      accordianBody.appendChild(cancelButton);
      accordionContainer.appendChild(accordianBody);
      yearBody.appendChild(accordionContainer);
    });

    yearContainer.appendChild(yearHeader);
    yearContainer.appendChild(yearBody);
    expandableArea.appendChild(yearContainer);

    // Only expand if this is a new upload and it's the year of the last uploaded file
    if (isNewUpload) {
      const lastFile = allFilesData[allFilesData.length - 1];
      debug("Editor: Checking year expansion:", { year, lastFileType: lastFile?.type, lastFileTaxYear: lastFile?.taxYear, isFormError: lastFile?.type === "FormError" });
      
      if (lastFile) {
        // For FormError files, only expand the NO_YEAR accordion
        if (lastFile.type === "FormError" && year === NO_YEAR) {
          debug("Editor: Expanding NO_YEAR accordion for FormError file");
          yearBody.style.display = "block";
          yearToggleButton.textContent = "-";
        }
        // For normal files, expand the matching year accordion
        else if (lastFile.type !== "FormError" && lastFile.taxYear === year) {
          debug("Editor: Expanding year accordion for normal file:", year);
          yearBody.style.display = "block";
          yearToggleButton.textContent = "-";
        }
      }
    }
  });

  async function updateForm(fileId: string, payload: any) {
    if (payload.fields) {
      // Remove fields with value "0.00"
      const filteredFields = Object.fromEntries(Object.entries(payload.fields).filter(([_, value]) => value !== "0.00"));
      payload.fields = filteredFields;
      payload.fileId = fileId; // Ensure fileId is included in the payload
      //debug("filtered fields", filteredFields);
    }
    return updateFormAPI(fileId, payload);
  }

  function updateFormAllFields(allFilesData: any, fileId: string, fileType: string, fileData: any, withAllFields: boolean) {
    // Find the formType details
    const formDetails = configurationData.formTypes.find((form) => form.formType === fileType) as { fieldTypes?: string[] };
    if (!formDetails) {
      console.error(`Form type '${fileType}' not found in configuration data.`);
      return;
    }

    //debug(`Found form details for '${fileType}':`, formDetails);

    // Ensure fieldTypes exist before iterating
    if (!formDetails.fieldTypes || formDetails.fieldTypes.length === 0) {
      console.warn(`No fieldTypes found for '${fileType}'.`);
    }

    // Deep copy existing fields from fileData (excluding the `fields` object)
    const updatedFileData = structuredClone(fileData);
    //delete existingData.fields; // Ensure we don't mix fields with other properties

    // Initialize fieldsData reference to existing fields from fileData.fields
    const fieldsData = updatedFileData.fields || {};

    if (formDetails.fieldTypes) {
      if (withAllFields) {
        // Fill missing fields from configuration with default values
        formDetails.fieldTypes.forEach((field) => {
          if (!(field in fieldsData)) {
            fieldsData[field] = "0.00"; // Default placeholder value
          }
        });
      } else {
        // Remove any fields with 0 value
        Object.keys(fieldsData).forEach((key) => {
          if (fieldsData[key] === "0.00") {
            delete fieldsData[key];
          }
        });
      }
    }
    // Create a new list of obkects.
    let updatedAllFilesData: any[] = [];
    // Now clone data, (which is an array of file objects), into updatedData item by item.
    allFilesData.forEach((file: any) => {
      if (file.fileId === fileId) {
        updatedAllFilesData.push(updatedFileData);
      } else {
        // Deep clone the file object
        updatedAllFilesData.push(structuredClone(file));
      }
    });
    return updatedAllFilesData;
  }

  async function updateFormAPI(fileId: string, payload: any) {
    try {
      // Construct the API URL
      const URL = API_BASE_URL + "/updateForm";

      // Send the POST request
      const response = await fetch(URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          customerDataEntryName: "Default",
          formAsJSON: payload,
        }),
      });

      if (!(await handleResponse(response, "Failed to update form"))) {
        return;
      }

      // Parse and handle the response
      const responseData = await response.json();
      return responseData;
    } catch (error: any) {
      clearMessages();
      addMessage("שגיאה בעריכת הקובץ: " + (error instanceof Error ? error.message : String(error)), "error");
    }
  }

  function formatCurrencyWithSymbol(value: number) {
    let parts = value.toFixed(2).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ","); // Add commas for thousands
    return `₪${parts.join(".")}`;
  }

  function currencyEventListener(input: HTMLInputElement) {
    let rawValue = input.value.replace(/[^\d.]/g, "");

    if (rawValue.split(".").length > 2) {
      rawValue = rawValue.substring(0, rawValue.lastIndexOf("."));
    }

    let parts = rawValue.split(".");

    // Restrict max 10 digits before decimal
    if (parts[0].length > 10) {
      parts[0] = parts[0].slice(0, 10);
    }
    // Restrict max 2 digits after decimal
    if (parts[1] && parts[1].length > 2) {
      parts[1] = parts[1].slice(0, 2);
    }

    input.value = parts.join(".");
  }

  function enableFormActionButtons(accordianBody: HTMLDivElement) {
    const actionButtons = accordianBody.querySelectorAll(".form-action-button");
    const buttonsArray: HTMLButtonElement[] = Array.from(actionButtons) as HTMLButtonElement[];
    buttonsArray.forEach((button: HTMLButtonElement) => {
      button.disabled = false;
    });
  }

  function formatInput(key: string, input: HTMLInputElement, fieldValue: Value) {
    if (key.endsWith("Name")) {
      if (!input.className) input.className = "field-text-input";
      input.type = "text";
      input.maxLength = 30;
      if (key.endsWith("clientName")) {
        input.value = dummyName(fieldValue.value);
      } else {
        input.value = fieldValue.value;
      }
    } else if (key.endsWith("Text")) {
      input.className = "field-text-input";
      input.type = "text";
      input.maxLength = 100;
      if (fieldValue.value) {
        input.value = fieldValue.value;
        input.classList.add("value");
      }
    } else if (key.endsWith("IdentificationNumber")) {
      input.type = "text";
      input.maxLength = 9;
      input.pattern = "\\d{9}";
      input.inputMode = "numeric";
      input.value = dummyIdNumber(fieldValue.value);
      input.oninput = () => {
        input.value = input.value.replace(/\D/g, "").slice(0, 9);
      };
      input.onblur = () => {
        input.value = input.value.padStart(9, "0");
      };
    } else if (key.endsWith("Number")) {
      input.type = "text";
      input.maxLength = 9;
      input.pattern = "\\d{9}";
      input.inputMode = "numeric";
      input.value = fieldValue.value;
      input.oninput = () => {
        input.value = input.value.replace(/\D/g, "").slice(0, 9);
      };
      input.onblur = () => {
        input.value = input.value.padStart(9, "0");
      };
    } else if (key.endsWith("taxYear")) {
      input.type = "text";
      input.maxLength = 4;
      input.pattern = "\\d{4}";
      input.inputMode = "numeric";
      input.value = fieldValue.value;
      input.oninput = () => {
        input.value = input.value.replace(/\D/g, "").slice(0, 4);
      };
    } else if (key.endsWith("Code")) {
      input.type = "text";
      input.maxLength = 3;
      input.pattern = "\\d{3}";
      input.inputMode = "numeric";
      input.value = fieldValue.value;
      input.oninput = () => {
        input.value = input.value.replace(/\D/g, "").slice(0, 3);
      };
    } else if (key.endsWith("Date")) {
      input.className = "field-date-input";
      input.type = "date";
      if (fieldValue.value === "" || fieldValue.value === null) {
        input.value = "";
      } else {
        input.value = fieldValue.value.split("/").reverse().join("-");
      }
      input.onblur = () => {
        if (input.value != "") {
          const isValidDate = !isNaN(new Date(input.value).getTime());
          if (!isValidDate) {
            alert("Invalid date format " + input.value);
            input.value = "";
          }
        }
      };
    } else if (key.endsWith("Months")) {
      input.type = "text";
      input.maxLength = 2;
      input.pattern = "\\d{1,2}";
      input.inputMode = "numeric";
      input.value = fieldValue.value;
      input.oninput = () => {
        input.value = input.value.replace(/\D/g, "").slice(0, 2);
      };
    } else if (key.endsWith("Integer") || fieldValue.type === "Integer" || isExceptionalIntegerField(key)) {
      input.type = "text";
      input.maxLength = MAX_INTEGER_LENGTH;
      input.pattern = "\\d+";
      input.inputMode = "numeric";
      input.value = Math.round(parseFloat(fieldValue.value)).toString();
      input.oninput = () => {
        input.value = input.value.replace(/\D/g, "").slice(0, MAX_INTEGER_LENGTH);
      };
    } else if (key.endsWith("Boolean")) {
      input.type = "checkbox";
      input.className = "custom-checkbox";
      input.value = fieldValue.value;
      input.checked = fieldValue.value === true || fieldValue.value === "true";
      input.onchange = () => {
        if (input.checked) {
          input.value = "true";
        } else {
          input.value = "false";
        }
      };
    } else if (key.endsWith("Options")) {
      // Deal with this later
    } else if (key.endsWith("field867Type") || key.endsWith("field106Type")) {
      // Deal with this later
    } else if (key.endsWith("documentType")) {
      input.type = "text";
      input.value = fieldValue.value;
      // Deal with this later
    } else {
      // 🟢 **Default: Currency Field (if no other condition matched)**
      input.type = "text";
      input.inputMode = "numeric";

      let numericValue = parseFloat(fieldValue.value);
      if (isNaN(numericValue)) {
        numericValue = 0.0;
      }
      input.value = formatCurrencyWithSymbol(numericValue);

      // **Restrict typing to valid numeric input**
      input.addEventListener("input", (e) => {
        currencyEventListener(input);
      });

      // 🟢 **Format on Blur**
      input.addEventListener("blur", () => {
        let rawValue = input.value.replace(/[^\d.]/g, "");
        let parsedNum = parseFloat(rawValue);

        if (isNaN(parsedNum)) {
          parsedNum = 0.0;
        }

        input.value = formatCurrencyWithSymbol(parsedNum);
      });
    }
  }

  function renderFields(fileData: any, accordianBody: HTMLDivElement, withAllFields = false) {
    // Store the action buttons before clearing
    const fieldsToggleLink = accordianBody.querySelector(".fields-toggle-link") as HTMLAnchorElement;
    const actionButtons = accordianBody.querySelectorAll(".form-action-button");
    const buttonsArray: HTMLButtonElement[] = Array.from(actionButtons) as HTMLButtonElement[];

    // Clear the body
    accordianBody.innerHTML = "";

    if (fieldsToggleLink) {
      accordianBody.appendChild(fieldsToggleLink);
    }

    function createFieldRow(container: HTMLElement, key: string, fieldValue: Value) {
      // Skip fields already displayed in the header
      if (excludedHeaderFields.includes(key)) return;

      const fieldRow = document.createElement("div") as HTMLDivElement;
      fieldRow.className = "field-row";

      let fieldLabel = document.createElement("label") as HTMLLabelElement;
      fieldLabel.textContent = getFriendlyName(key);
      fieldLabel.className = "field-labelx";
      fieldRow.appendChild(fieldLabel);

      const fieldId = makeUniqueId();
      fieldLabel.setAttribute("for", fieldId);

      // For readOnlyFields, just create a label with the value
      if (readOnlyFields.includes(key)) {
        const valueLabel = document.createElement("span") as HTMLSpanElement;
        valueLabel.textContent = fieldValue.value || "";
        if (key === "fileName") {
          valueLabel.dir = "ltr";
        }
        valueLabel.className = "read-only-field-value";
        valueLabel.setAttribute("data-field-name", key);
        valueLabel.id = fieldId;
        fieldRow.appendChild(valueLabel);
        container.appendChild(fieldRow);
        return;
      }

      if (key.endsWith("Options")) {
        const radioGroup = document.createElement("div") as HTMLDivElement;
        radioGroup.setAttribute("data-field-name", key);
        radioGroup.id = fieldId;

        const options = getFriendlyOptions(key);
        options.forEach((option: string) => {
          const radioButton = document.createElement("input") as HTMLInputElement;
          const label = document.createElement("label") as HTMLLabelElement;
          radioButton.type = "radio";
          radioButton.value = option;
          radioButton.className = "custom-radio";
          const name = getFriendlyOptionName(key);
          // Must have a unique name so that it doesnt get mixed up with other forms.
          radioButton.name = `${fileData.fileId}_${name}`;
          //radioButton.id = name + option;
          radioButton.checked = fieldValue.value === option;
          label.appendChild(radioButton);
          label.appendChild(document.createTextNode(option));
          radioGroup.appendChild(label);
        });
        addChangeHandler(radioGroup, accordianBody);
        fieldRow.appendChild(radioGroup);
      } else if (key.endsWith("field867Type") || key.endsWith("field106Type")) {
        // Create a dropdown with the options
        const dropdown = document.createElement("select") as HTMLSelectElement;
        dropdown.className = "editor-select";
        dropdown.id = fieldId;
        dropdown.name = key;
        dropdown.textContent = key;
        dropdown.setAttribute("data-field-name", key);
        dropdown.appendChild(document.createTextNode(fieldValue.value));
        // Add options to the dropdown from the configuration data
        const formDetails = configurationData.formTypes.find((form) => form.formType === fileData.type) as { fieldTypes?: string[] };

        formDetails.fieldTypes?.forEach((option: string) => {
          const optionElement = document.createElement("option") as HTMLOptionElement;
          optionElement.value = option;
          const optionText = getOptionTextWithTaxCode(option);
          optionElement.appendChild(document.createTextNode(optionText));
          dropdown.appendChild(optionElement);
        });
        // Select the option that is currently selected
        dropdown.value = fieldValue.value;
        addChangeHandler(dropdown, accordianBody);
        fieldRow.appendChild(dropdown);
      } else {
        let input = document.createElement("input") as HTMLInputElement;
        input.className = "field-input";
        input.setAttribute("data-field-name", key);
        // Associate the input with a unique ID and connect it to the label so that screen readers can read the label when the input is focused.
        input.id = fieldId;

        // 🟢 **Apply Field Formatting Rules**
        formatInput(key, input, fieldValue);
        addChangeHandler(input, accordianBody);
        fieldRow.appendChild(input);
      }

      if (key.includes("_")) {
        // Field code from friendlyNames[key]. It is the text after the underscore.
        const fieldCode = getTaxCodeFromFieldName(key);
        const codeLabel = document.createElement("label");
        codeLabel.textContent = fieldCode;
        codeLabel.className = "codeLabel";
        codeLabel.setAttribute("for", fieldId);
        fieldRow.appendChild(codeLabel);
      }
      container.appendChild(fieldRow);
    }

    function populateField(container: HTMLElement, key: string, fieldValue: Value) {
      // Find the field in the container
      const field = container.querySelector(`input[data-field-name="${key}"]`) as HTMLInputElement;
      if (field) {
        formatInput(key, field, fieldValue);
        addChangeHandler(field, accordianBody);
      }
    }

    // Process main fields (thicker border)
    Object.entries(fileData).forEach(([key, value]) => {
      if (key !== "fields" && key !== "genericFields" && key !== "children") {
        const fieldValue: Value = {
          type: "any",
          value: value,
        };
        createFieldRow(accordianBody, key, fieldValue);
      }
    });
    // If it is an 867 form and we are not on mobile we render according to the template
    if (fileData.documentType === "טופס 867" && window.innerWidth > 768 && withAllFields) {
      // Clone template_867_2022
      const template = document.getElementById(template867YearsMap[fileData.taxYear as keyof typeof template867YearsMap]) as HTMLDivElement;
      const clone = template.cloneNode(true) as HTMLDivElement;
      clone.id = "";
      // Populate the clone with the fileData
      Object.entries(fileData.fields || {}).forEach(([key, value]) => {
        const fieldValue: Value = {
          type: "any",
          value: value,
        };
        populateField(clone, key, fieldValue);
      });
      clone.removeAttribute("hidden");
      accordianBody.appendChild(clone);
    } else {
      // Process nested fields inside `fileData.fields` (thinner border)
      Object.entries(fileData.fields || {}).forEach(([key, value]) => {
        const v = value || "";
        if (!isFieldValidForTaxYear(key, fileData.taxYear) && v === "0.00") {
          //debug("field " + key + " value " + v + " type " + (value as any).type + " is not valid for tax year " + fileData.taxYear);
          return;
        }
        const fieldValue: Value = {
          type: "any",
          value: value,
        };
        createFieldRow(accordianBody, key, fieldValue);
      });
    }

    function renderItemArray(itemArray: any, accordianBody: HTMLDivElement, title: string, addButtonLabel: string, itemTemplate: any, withAllFields: boolean) {
      if (itemArray) {
        // Title for the children or generic fields with a control button before the title, that adds a new item.
        const titleElement = document.createElement("div") as HTMLDivElement;
        const titleText = getFriendlyName(title);
        titleElement.textContent = titleText;
        titleElement.className = "item-title";
        titleElement.setAttribute("name", title);
        accordianBody.appendChild(titleElement);
        // Add a button to add a new item on the same line as the title
        const addItemButton = document.createElement("button");
        addItemButton.textContent = addButtonLabel;
        addItemButton.className = "form-add-item-button";
        titleElement.appendChild(addItemButton);
        addItemButton.onclick = () => {
          // Update the form from the controls
          const updatedAllFilesData = updateFormAllFields(allFilesData, fileData.fileId, fileData.type, getDataFromControls(accordianBody, fileData), withAllFields);
          if (updatedAllFilesData) {
            // Find the form in the allFilesData array.
            const formIndex = updatedAllFilesData.findIndex((form: any) => form.fileId === fileData.fileId);
            if (formIndex !== -1) {
              // Add the new item to the item array
              updatedAllFilesData[formIndex][title].push(itemTemplate);
              fileData = updatedAllFilesData[formIndex];

              // Re-render the fields
              renderFields(fileData, accordianBody, withAllFields);
            }
            enableFormActionButtons(accordianBody);
          }
        };

        // Process child or generic fields inside `data` (thinner border)
        let itemCount = 0;
        itemArray.forEach((item: any, index: number) => {
          itemCount++;
          // Title and container for the item
          const itemContainer = document.createElement("div") as HTMLDivElement;
          itemContainer.className = "item-container";
          itemContainer.setAttribute("name", title);

          const itemTitleText = document.createElement("label") as HTMLLabelElement;
          itemTitleText.textContent = titleText + " " + itemCount;
          itemTitleText.className = "item-title-text";
          itemContainer.appendChild(itemTitleText);

          // Add remove button
          const deleteItemButton = document.createElement("button") as HTMLButtonElement;
          deleteItemButton.textContent = "🗑️";
          deleteItemButton.className = "delete-item-button";
          deleteItemButton.onclick = () => {
            // Update the form from the controls
            const updatedAllFilesData = updateFormAllFields(allFilesData, fileData.fileId, fileData.type, getDataFromControls(accordianBody, fileData), withAllFields);
            if (updatedAllFilesData) {
              // Find the form in the allFilesData array.
              const formIndex = updatedAllFilesData.findIndex((form: any) => form.fileId === fileData.fileId);
              if (formIndex !== -1) {
                // Remove the item from the item array
                updatedAllFilesData[formIndex][title].splice(index, 1);

                // Re-render the fields
                renderFields(updatedAllFilesData[formIndex], accordianBody, withAllFields);
              }
              enableFormActionButtons(accordianBody);
            }
          };
          itemContainer.appendChild(deleteItemButton);

          accordianBody.appendChild(itemContainer);
          Object.entries(item).forEach(([key, value]) => {
            let fieldValue: Value = {
              type: "any",
              value: value,
            };
            if (key === "value" && ((item.field867Type && isExceptionalIntegerField(item.field867Type)) || (item.field106Type && isExceptionalIntegerField(item.field106Type)))) {
              fieldValue.type = "Integer";
            }
            createFieldRow(itemContainer, key, fieldValue);
          });
        });
      }
    }

    // Call the function for children
    renderItemArray(fileData.children, accordianBody, "children", "הוספת ילד", Child, withAllFields);

    const template = fileData.documentType === "טופס 106" ? Generic106Item : Generic867Item;
    // Call the function for generic fields
    renderItemArray(fileData.genericFields, accordianBody, "genericFields", "הוספת שדה", template, withAllFields);

    // Re-add the action buttons
    buttonsArray.forEach((button) => {
      accordianBody.appendChild(button);
    });
  }

  function getTaxCodeFromFieldName(fieldName: string) {
    if (fieldName.includes("_")) {
      const parts = fieldName.split("_");
      if (parts.length > 2) {
        return " (" + parts[1] + "/" + parts[2] + ")";
      } else if (parts.length > 1) {
        return " (" + parts[1] + ")";
      }
    }
    return "";
  }

  function getOptionTextWithTaxCode(option: string) {
    let optionText = getFriendlyName(option);
    if (option.includes("_")) {
      // Field code from friendlyNames[key]. It is the text after the underscore. can be 1 or two codes.
      const parts = option.split("_");
      if (parts.length > 2) {
        optionText += " (" + parts[1] + "/" + parts[2] + ")";
      } else if (parts.length > 1) {
        optionText += " (" + parts[1] + ")";
      }
    }
    return optionText;
  }

  // Called when a form field is changed
  function addChangeHandler(field: HTMLElement, accordianBody: HTMLDivElement) {
    const savedValue = (field as HTMLInputElement).value;
    field.addEventListener("change", () => {
      // make the background green by adjusting the css class
      setFieldChanged(field);
      // enable save and cancel buttons
      enableFormActionButtons(accordianBody);

      // Handle the special case of switching between a number and integer option in the select control of an item.
      formatValueFieldBySelectOption(field);
    });
    field.addEventListener("input", () => {
      // enable save and cancel buttons
      enableFormActionButtons(accordianBody);
    });
    // Lose focus. remove changed if the value is the same as the saved value
    field.addEventListener("blur", () => {
      if ((field as HTMLInputElement).value === savedValue) {
        setFieldNotChanged(field);
      }
    });
    // Check if it is a select and within an item
  }

  // Handle the special case of switching between a number and integer option in the select control of an item.
  function formatValueFieldBySelectOption(field: HTMLElement) {
    // check if field has an ancestor with the class "item-container" and if it is a select
    const itemContainer = field.closest(".item-container");
    if (itemContainer && field.tagName === "SELECT") {
      // Get the selected option
      const selectedOption = (field as HTMLSelectElement).value;
      // If it is an exceptional field type, we need to update the field with the option text
      const valueField = itemContainer.querySelector("input[data-field-name='value']") as HTMLInputElement;
      if (valueField) {
        if (isExceptionalIntegerField(selectedOption)) {
          // Format it as an integer
          formatInput(valueField.getAttribute("data-field-name") as string, valueField, { type: "Integer", value: "0" });
        } else {
          formatInput(valueField.getAttribute("data-field-name") as string, valueField, { type: "any", value: "0" });
        }
      }
    }
  }

  // Called to clear the effect of the change handler
  function clearChanged(accordianBody: HTMLDivElement) {
    // Collect all inputs and controls
    const allElements = [
      ...Array.from(accordianBody.querySelectorAll("input[data-field-name], select[data-field-name], div[data-field-name]")),
      ...Array.from(accordianBody.querySelectorAll(".item-container input[data-field-name], .item-container select[data-field-name], .item-container div[data-field-name]")),
      ...(accordianBody.closest(".accordion-container")?.querySelector(".header-fields-wrapper")?.querySelectorAll("input[data-field-name], select[data-field-name], div[data-field-name]") || []),
    ];
    // Clear changed class from all inputs and controls
    allElements.forEach((element) => {
      element.classList.remove("changed");
      element.classList.remove("error");
    });
    // Disable save and cancel buttons
    accordianBody.querySelectorAll(".form-action-button").forEach((button) => {
      (button as HTMLButtonElement).disabled = true;
    });
  }
  /* **************** display header for file info ******************** */

  function displayFileInfoHeader(expandableArea: HTMLDivElement, data: any) {
    // Caption row for the accordion headers
    const captionsRow = document.createElement("div") as HTMLDivElement;
    captionsRow.className = "caption-row";
    captionsRow.id = "captionsRow";

    const headerCaptions = [
      { text: "", width: "40px" },
      //{ text: "שנה", width: "100px" },
      { text: "סוג מסמך", width: "150px" },
      { text: "שם האירגון", width: "180px" },
      { text: "שם הלקוח", width: "180px" },
      { text: "מספר זיהוי", width: "150px" },
      //{ text: "שם הקובץ", width: "200px" },
    ];

    headerCaptions.forEach((caption) => {
      const captionElement = document.createElement("div") as HTMLDivElement;
      captionElement.textContent = caption.text;
      captionElement.className = "caption-element";
      captionElement.style.flex = `0 0 ${caption.width}`;
      captionsRow.appendChild(captionElement);
    });

    expandableArea.appendChild(captionsRow);
    // Hide the header if it's a mobile screen or if there are no files
    function setHeaderVisibility() {
      if (window.innerWidth <= 768 || data.length === 0) {
        captionsRow.style.display = "none";
      } else {
        captionsRow.style.display = "flex";
      }
    }
    // Run on page load
    setHeaderVisibility();

    // Update when resizing
    window.addEventListener("resize", setHeaderVisibility);
  }

  /* ********************************** create +_ button ************************************** */
  function displayFileInfoPlusMinusButton(accordionBody: HTMLElement, accordionToggleButton: HTMLButtonElement) {
    accordionToggleButton.textContent = "▼";
    accordionToggleButton.className = "accordion-toggle-button";

    accordionToggleButton.onclick = () => {
      accordionBody.style.display = accordionBody.style.display === "none" ? "block" : "none";
      accordionToggleButton.textContent = accordionToggleButton.textContent === "▼" ? "▲" : "▼";
    };
  }

  function displayFileInfoLine(accordianBody: HTMLDivElement, headerFieldsContainer: HTMLDivElement, fileData: any) {
    // Create a wrapper for the header fields
    const fieldsWrapper = document.createElement("div");
    fieldsWrapper.className = "header-fields-wrapper"; // Used for layout styling

    function createHeaderInput(value: any, fieldName: string, labelText: string, isEditable = true) {
      const fieldContainer = document.createElement("div") as HTMLDivElement;
      fieldContainer.className = "field-container"; // Used for mobile layout

      // Create label (only visible on mobile)
      const headerFieldlabel = document.createElement("label");
      headerFieldlabel.textContent = labelText;
      headerFieldlabel.className = "headerfield-label";

      // Create input field
      const input = document.createElement("input") as HTMLInputElement;
      input.setAttribute("data-field-name", fieldName);
      input.className = "header-input";
      if (!isEditable) {
        input.readOnly = true;
        input.tabIndex = -1;
        input.onfocus = () => {
          input.blur();
        };
        input.classList.add("read-only");
      }
      const fieldId = makeUniqueId();
      input.id = fieldId;
      headerFieldlabel.setAttribute("for", fieldId);

      const fieldValue: Value = {
        type: "any",
        value: value,
      };
      formatInput(fieldName, input, fieldValue);
      addChangeHandler(input, accordianBody);
      // Append label and input (label appears only in mobile)
      fieldContainer.appendChild(headerFieldlabel);
      fieldContainer.appendChild(input);

      return fieldContainer;
    }

    // Append fields to the wrapper
    fieldsWrapper.appendChild(createHeaderInput(fileData.documentType, "documentType", "סוג מסמך", false));
    fieldsWrapper.appendChild(createHeaderInput(fileData.organizationName, "organizationName", "שם הארגונים", true));
    fieldsWrapper.appendChild(createHeaderInput(fileData.clientName, "clientName", "שם הלקוח", true));
    fieldsWrapper.appendChild(createHeaderInput(fileData.clientIdentificationNumber, "clientIdentificationNumber", "מספר זיהוי", true));

    // Append the wrapper to the container
    headerFieldsContainer.appendChild(fieldsWrapper);
  }

  /* ********************************** create delete button ************************************** */
  function displayFileInfoDeleteButton(editorDeleteButton: HTMLButtonElement, fileData: any, accordionContainer: HTMLDivElement) {
    editorDeleteButton.textContent = "🗑️";
    editorDeleteButton.className = "delete-button";

    editorDeleteButton.onclick = () => {
      const deleteUrl = `${API_BASE_URL}/deleteFile?fileId=${fileData.fileId}&customerDataEntryName=Default`;
      fetch(deleteUrl, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      })
        .then((response) => {
          if (response.ok) {
            addMessage("קובץ נמחק בהצלחה!", "success");
            // check if accordionContainers parent will now be empty and remove it if so
            const parent = accordionContainer.parentElement;
            accordionContainer.remove();
            if (parent && parent.children.length === 1) {
              parent.remove();
              // refresh the accordion
              window.location.reload();
            }
            // Remove the file from the backupAllFilesData array
            const backupFormIndex = backupAllFilesData.findIndex((form: any) => form.fileId === fileData.fileId);
            if (backupFormIndex !== -1) {
              backupAllFilesData.splice(backupFormIndex, 1);
            }
            updateButtons(editableFileListHasEntries());
            fileModifiedActions(editableFileListHasEntries());
          } else {
            addMessage("שגיאה במחיקת קובץ. אנא נסה שוב.", "error");
          }
        })
        .catch((error) => {
          addMessage("שגיאה במחיקת קובץ. אנא נסה שוב.", "error");
          console.error("Delete error:", error);
        });
    };
  }

  async function displayFileInfoButtons(saveButton: HTMLButtonElement, cancelButton: HTMLButtonElement, fileData: any, accordianBody: HTMLDivElement, allFilesData: any) {
    // Set up the save button
    saveButton.textContent = "שמור שינויים";

    // Create the cancel button
    cancelButton.textContent = "ביטול שינויים";

    // Cancel button behavior: Restore original file info
    cancelButton.onclick = async () => {
      // Restore only this form from the backupAllFilesData
      const backupFormIndex = backupAllFilesData.findIndex((form: any) => form.fileId === fileData.fileId);
      if (backupFormIndex !== -1) {
        // Replace the form in the allFilesData array with the form in the backupAllFilesData array
        renderFields(backupAllFilesData[backupFormIndex], accordianBody, false);
        clearChanged(accordianBody);
      }
    };

    // Save button behavior: Process and save the data
    saveButton.onclick = async (event: MouseEvent) => {
      // Check if Ctrl key is pressed
      if (event.ctrlKey) {
        // Show exporting state
        saveButton.classList.add("save-button-exporting");

        // Save as JSON file
        const formData = getDataFromControls(accordianBody, fileData);

        // Create a clean version of the data for export (remove internal fields)
        const exportData = {
          ...formData,
          // Remove internal fields that shouldn't be exported
          fileId: undefined,
        };

        // Create the JSON blob
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });

        // Use the original fileName with .json extension (replacing existing extension)
        const fileName = fileData.fileName ? fileData.fileName.replace(/\.[^/.]+$/, "") + ".json" : "form.json";

        // Check if Web Share API is available (mobile browsers)
        if (navigator.share && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
          try {
            const file = new File([blob], fileName, { type: "application/json" });
            await navigator.share({
              title: "Form Data Export",
              text: "Exported form data as JSON",
              files: [file],
            });
            addMessage("קובץ JSON נשלח בהצלחה", "success");
          } catch (error) {
            // Fallback to download method
            downloadFile(blob, fileName);
          }
        } else {
          // Desktop or fallback method
          downloadFile(blob, fileName);
        }

        // Reset button appearance
        saveButton.classList.remove("save-button-exporting");
        return;
      }

      // Normal save behavior (existing code)
      const formData = getDataFromControls(accordianBody, fileData);
      const updatedData = await updateForm(fileData.fileId, formData);
      if (updatedData) {
        // Display success modal
        await customerMessageModal({
          title: "שמירת נתונים",
          message: `הנתונים נשמרו בהצלחה`,
          button1Text: "",
          button2Text: "",
        });
        // Just update the backupAllFilesData with the updatedData
        const formIndex = updatedData.findIndex((form: any) => form.fileId === fileData.fileId);
        if (formIndex !== -1) {
          const backupFormIndex = backupAllFilesData.findIndex((form: any) => form.fileId === fileData.fileId);
          if (backupFormIndex !== -1) {
            // Replace the form in the allFilesData array with the form in the backupAllFilesData array
            backupAllFilesData[backupFormIndex] = structuredClone(updatedData[formIndex]);
            // Update the display
            renderFields(backupAllFilesData[backupFormIndex], accordianBody, false);
          }
        }
        clearChanged(accordianBody);
        fileModifiedActions(editableFileListHasEntries());
        clearMessages();
        addMessage("נתונים נשמרו בהצלחה", "success");
      }
    };
  }

  // Helper function for file download
  function downloadFile(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addMessage("קובץ JSON נשמר בהצלחה", "success");
  }
}
