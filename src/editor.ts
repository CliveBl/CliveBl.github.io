import { configurationData, debug, addMessage, handleResponse, updateButtons, fileModifiedActions } from "./index.js";
import { API_BASE_URL } from "./env.js";

/* ********************************************************** Generic modal ******************************************************************** */
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

/* ********************************************* friendly names ************************************ */
const friendlyNames = {
  organizationName: "שם הארגון",
  explanationText: "תאור",
  value: "סכום",
  receiptInteger: "מספר קבלה",
  donationDate: "תאריך תרומה",
  nonProfitTaxFileNumber: "קוד עמותה/ארגון",
  employerTaxFileNumber: "מספר מעסיק",
  branchCode: "קוד סניף",
  accountNumber: "מספר חשבון",
  matchTag: "תג התאמה",
  reason: "סיבה",
  cityName: "שם העיר",
  startDate: "תאריך התחלה",
  endDate: "תאריך סיום",
  NumberOfDealsInteger: "כמות עיסקאות",
  releaseDate: "תאריך שחרור",
  numberOfServiceMonths: "חודשי שרות",
  NONE: "ללא",
  ReceivedFromNI_196_194: "התקבל מהמוסד לביטוח לאומי",
  Salary_172_158: "שכר עבודה",
  LeavingBonus_272_258: "מענק פרישה",
  TaxFreeLeavingBonus_209: "מענק פרישה פטור ממס",
  EducationFund_219_218: "השכר לקרן השתלמות",
  EmployerKupatGemel_249_248: "קופת גמל מעסיק",
  InsuredIncome_245_244: "הכנסה מבוטחת",
  IncomeTaxDeduction_042: "מס הכנסה",
  NationalInsuranceIncomeTaxDeduction_040: "מס הכנסה מקצבה ביטוח לאומי",
  Donations_237_037: "תרומות",
  NationalInsuranceNotIncludingHealthTaxDeduction: "ביטוח לאומי ללא ניכוי מס בריאות",
  TemporarySalaryReductionRecuperationFund_012_011: "השתתפות זמנית הפחתת דמי הבראה",
  PersonalDeductionFundMember_086_045: "ניכוי אישי חבר קרן",
  SettlementDiscount_327_287: "הנחה יישובית",
  ShiftAllowance_069_068: "תוספת משמרות",
  DepositToNewPensionFund_180_135: "הפקדה לקרן פנסיה חדשה",
  DepositCurrentAccountIncomeTaxedAtPercent10_076: "הכנסה מחשבון עובר ושב ממוסה ב-10%",
  DepositCurrentAccountIncomeTaxedAtPercent15_217: "הכנסה מחשבון עובר ושב ממוסה ב-15%",
  DepositIncomeTaxedAtPercent10_076: "ריבית על פיקדונות ממוסה ב-10%",
  DepositIncomeTaxedAtPercent15_078: "ריבית על פיקדונות ממוסה ב-15%",
  DepositIncomeTaxedAtPercent20_126: "ריבית על פיקדונות ממוסה ב-20%",
  DepositIncomeTaxedAtPercent25_142: "ריבית על פיקדונות ממוסה ב-25%",
  DepositIncomeTaxedAtPercent35_053: "ריבית על פיקדונות ממוסה ב-35%",
  DepositFXIncomeTaxedAtPercent15_317: 'ריבית על פיקדונות מט"ח ממוסה ב-15%',
  DepositFXIncomeTaxedAtPercent20_226: 'ריבית על פיקדונות מט"ח ממוסה ב-20%',
  DepositFXIncomeTaxedAtPercent25_242: 'ריבית על פיקדונות מט"ח ממוסה ב-25%',
  DepositFXIncomeTaxedAtPercent23_232: 'ריבית על פיקדונות מט"ח ממוסה ב-23%',
  DepositFXIncomeTaxedAtPercent35_1043: 'ריבית על פיקדונות מט"ח ממוסה ב-35%',
  ProfitIncomeTaxedAtPercent0: "רווח הון ממוסה ב-0%",
  ProfitIncomeTaxedAtPercent15: "רווח הון ממוסה ב-15%",
  ProfitIncomeTaxedAtPercent20: "רווח הון ממוסה ב-20%",
  ProfitIncomeTaxedAtPercent25: "רווח הון ממוסה ב-25%",
  ProfitIncomeTaxedAtPercent23: "רווח הון ממוסה ב-23%",
  ProfitIncomeTaxedAtPercent30: "רווח הון ממוסה ב-30%",
  ProfitIncomeTaxedAtPercent35: "רווח הון ממוסה ב-35%",
  OffsetableLosses: "הפסדים ניתנים לקיזוז",
  TotalSales_256: 'סה"כ מכירות',
  NumberOfDeals: "מספר עסקאות",
  TaxDeductedAtSource_040: "מס שנוכה במקור",
  DividendFXIncomeTaxedAtPercent0: 'דיבידנד מט"ח ממוסה ב-0%',
  DividendFXIncomeTaxedAtPercent4: 'דיבידנד מט"ח ממוסה ב-4%',
  DividendFXIncomeTaxedAtPercent15: 'דיבידנד מט"ח ממוסה ב-15%',
  DividendFXIncomeTaxedAtPercent20: 'דיבידנד מט"ח ממוסה ב-20%',
  DividendFXIncomeTaxedAtPercent25: 'דיבידנד מט"ח ממוסה ב-25%',
  DividendFXIncomeTaxedAtPercent23: 'דיבידנד מט"ח ממוסה ב-23%',
  DividendIncomeTaxedAtPercent0: "דיבידנד ממוסה ב-0%",
  DividendIncomeTaxedAtPercent4: "דיבידנד ממוסה ב-4%",
  DividendIncomeTaxedAtPercent15: "דיבידנד ממוסה ב-15%",
  DividendIncomeTaxedAtPercent20: "דיבידנד ממוסה ב-20%",
  DividendIncomeTaxedAtPercent25: "דיבידנד ממוסה ב-25%",
  DividendIncomeTaxedAtPercent23: "דיבידנד ממוסה ב-23%",
  InterestIncomeTaxedAtPercent0: "ריבית מניירות ערך ממוסה ב-0%",
  InterestIncomeTaxedAtPercent10: "ריבית מניירות ערך ממוסה ב-10%",
  InterestIncomeTaxedAtPercent15: "ריבית מנייות ערך ממוסה ב-15%",
  InterestIncomeTaxedAtPercent20: "ריבית מניירות ערך ממוסה ב-20%",
  InterestIncomeTaxedAtPercent25: "ריבית מניירות ערך ממוסה ב-25%",
  InterestIncomeTaxedAtPercent23: "ריבית מניירות ערך ממוסה ב-23%",
  InterestIncomeTaxedAtPercent35: "ריבית מניירות ערך ממוסה ב-35%",
  TaxDeductedAtSourceDeposit_043: "מס שנוכה במקור (פקדון)",
  TaxDeductedAtSourceDividend_040: "מס שנוכה במקור (דיבידנד)",
  TaxDeductedAtSourceInterest_040: "מס שנוכה במקור (ריבית)",
  TotalExemptInterestAndIndexLinkageDifference_209: "ריבית פטורה והפרש הצמדה",
  LossesTransferredFromPreviousYear: "הפסדים שהועברו משנה קודמת",
  maritalStatusOptions: {
    name: "מצב משפחתי",
    options: ["רווק", "נשוי", "אלמן", "גרוש", "פרוד"],
  },
  genderOptions: { name: "מין", options: ["זכר", "נקבה"] },
  registeredTaxpayerBoolean: "בן/בת זוג רשום",
  birthDate: "תאריך לידה",
  children: "ילדים",
  noSecondParentBoolean: "אין הורה שני",
  caringForBoolean: "הילד בהחזקתי",
  requestDelayOfPointsBoolean: "בקשה לדחיי נקודות",
  requestUsePointsFromLastYearBoolean: "בקשה להשתמש בנקודות משנה קודמת",
  newImmigrantArrivalDate: "תאריך עליה",
  returningResidentReturnDate: "תאריך חזרה, תושב חוזר",
  degreeCompletionDate: "תאריך סיום לימודי תואר ראשון",
  specializationCompletionDate: "תאריך סיום לימודי תואר שני",
  degreeCode: "קוד תואר ראשון",
  noteText: "הערה",
  taxYear: "שנה",
  clientIdentificationNumber: "מספר זיהוי",
  fileName: "שם הקובץ",
  reasonText: "סיבה",
  movedHereDuringYearBoolean: "עברתי לכאן במהלך השנה",
};

const excludedHeaderFields = ["organizationName", "clientIdentificationNumber", "clientName", "documentType", "type", "fileId", "matchTag", "fieldTypes"];
const readOnlyFields = ["fileName", "reasonText"];

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

export function editableOpenFileListEntry(fileName: string) {
  // Find the accordion container that contains the file name in its header fields
  const accordionContainers = document.querySelectorAll("#expandableAreaUploadFiles #accordionContainer");

  for (const container of accordionContainers) {
    // Look for either an input or label with data-field-name="fileName"
    const fileNameElement = container.querySelector('input[data-field-name="fileName"], label[data-field-name="fileName"]') as HTMLInputElement | HTMLLabelElement;
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
        // Scroll the container into view with smooth behavior
        container.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      }
    }
  }
}

export async function displayFileInfoInExpandableArea(allFilesData: any, backupAllFilesData: any, withAllFields = false) {
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
    let year = "No Year";
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
    if (a === "No Year") return 1;
    if (b === "No Year") return -1;
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

    // Create year toggle button
    const yearToggleButton = document.createElement("button") as HTMLButtonElement;
    yearToggleButton.textContent = "+";
    yearToggleButton.className = "date-accordion-toggle-button";
    yearHeader.appendChild(yearToggleButton);

    // Create year title
    const yearTitle = document.createElement("span") as HTMLSpanElement;
    yearTitle.textContent = year;
    yearTitle.className = "date-title";
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
      const accordionContainer = document.createElement("div") as HTMLDivElement;
      accordionContainer.id = "accordionContainer";
      accordionContainer.className = "accordion-container";
      accordionContainer.setAttribute("data-doc-typename", fileData.documentType);

      // Accordion Header
      const accordianheader = document.createElement("div") as HTMLDivElement;
      accordianheader.className = "accordion-header";

      // Accordion Body (Initially Hidden)
      const accordianbody = document.createElement("div") as HTMLDivElement;
      accordianbody.className = "accordian-body";
      accordianbody.style.display = "none";

      // Toggle Button (+/-)
      const accordionToggleButton = document.createElement("button") as HTMLButtonElement;
      accordionToggleButton.className = "accordion-toggle-button";

      displayFileInfoPlusMinusButton(accordianbody, accordionToggleButton);

      accordianheader.appendChild(accordionToggleButton);

      // Header Fields
      const headerFieldsContainer = document.createElement("div") as HTMLDivElement;
      headerFieldsContainer.style.display = "flex";

      if (fileData.type === "FormError") {
        displayFileInfoLineError(headerFieldsContainer, fileData);
        accordionContainer.classList.add("error");
      } else {
        displayFileInfoLine(headerFieldsContainer, fileData);
      }

      accordianheader.appendChild(headerFieldsContainer);

      // Delete Button
      const editorDeleteButton = document.createElement("button") as HTMLButtonElement;

      displayFileInfoDeleteButton(editorDeleteButton, fileData, accordionContainer);

      accordianheader.appendChild(editorDeleteButton);
      accordionContainer.appendChild(accordianheader);

      // First, display additional fields in the body (excluding header fields)
      renderFields(fileData, accordianbody, withAllFields);

      // Update Button
      const saveButton = document.createElement("button") as HTMLButtonElement;
      const cancelButton = document.createElement("button") as HTMLButtonElement;

      displayFileInfoButtons(saveButton, cancelButton, fileData, accordianbody, allFilesData);

      accordianbody.appendChild(saveButton);
      accordianbody.appendChild(cancelButton);
      accordionContainer.appendChild(accordianbody);
      yearBody.appendChild(accordionContainer);
    });

    yearContainer.appendChild(yearHeader);
    yearContainer.appendChild(yearBody);
    expandableArea.appendChild(yearContainer);

    // If this is a newly added file (check if it's the last file in the data array)
    const lastFile = allFilesData[allFilesData.length - 1];
    if (lastFile && lastFile.taxYear === year) {
      // Expand the year accordion
      yearBody.style.display = "block";
      yearToggleButton.textContent = "-";
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
    let updatedData: any[] = [];
    // Now clone data, (which is an array of file objects), into updatedData item by item.
    allFilesData.forEach((file: any) => {
      if (file.fileId === fileId) {
        updatedData.push(updatedFileData);
      } else {
        // Deep clone the file object
        updatedData.push(structuredClone(file));
      }
    });
    return updatedData;
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
      debug("Form updated successfully:", responseData);
      return responseData;
    } catch (error: any) {
      addMessage("שגיאה בעריכת הקובץ: " + (error instanceof Error ? error.message : String(error)), "error");
    }
  }

  async function getFilesInfoFunction() {
    const URL = API_BASE_URL + "/getFilesInfo";
    try {
      const response = await fetch(URL, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      console.error("Error getting files info:", error);
      throw error;
    }
  }

  function renderFields(fileData: any, body: HTMLElement, withAllFields = false) {
    // Store the action buttons before clearing
    const actionButtons = body.querySelectorAll(".form-action-button");
    const buttonsArray = Array.from(actionButtons);

    // Clear the body
    body.innerHTML = "";

    function createFieldRow(container: HTMLElement, key: string, value: any, isMainField = false) {
      // Skip fields already displayed in the header
      if (excludedHeaderFields.includes(key)) return;

      let codeLabel = null;
      const fieldRow = document.createElement("div") as HTMLDivElement;
      fieldRow.className = "field-row";

      let fieldLabel = document.createElement("label") as HTMLLabelElement;
      const friendly = friendlyNames[key as keyof typeof friendlyNames];
      fieldLabel.textContent = typeof friendly === "string" ? friendly : friendly?.name ?? "";
      fieldLabel.className = "field-labelx";

      // For readOnlyFields, just create a label with the value
      if (readOnlyFields.includes(key)) {
        const valueLabel = document.createElement("label") as HTMLLabelElement;
        valueLabel.textContent = value || "";
        valueLabel.className = "read-only-field-value";
        valueLabel.setAttribute("data-field-name", key);
        fieldRow.appendChild(fieldLabel);
        fieldRow.appendChild(valueLabel);
        container.appendChild(fieldRow);
        return;
      }

      let input = document.createElement("input") as HTMLInputElement;

      input.className = "field-input";
      input.setAttribute("data-field-name", key); // Add data-field-name attribute

      // 🟢 **Apply Field Formatting Rules**
      if (key.endsWith("Name")) {
        input.type = "text";
        input.maxLength = 50;
        input.value = value;
      } else if (key.endsWith("Text")) {
        input.type = "text";
        input.maxLength = 20;
        input.pattern = "\\d*";
        input.value = value;
        input.oninput = () => {
          input.value = input.value.replace(/\D/g, "");
        };
      } else if (key.endsWith("Number")) {
        input.type = "text";
        input.maxLength = 9;
        input.pattern = "\\d{9}";
        input.value = value;
        input.oninput = () => {
          input.value = input.value.replace(/\D/g, "").slice(0, 9);
        };
      } else if (key.endsWith("taxYear")) {
        input.type = "text";
        input.maxLength = 4;
        input.pattern = "\\d{4}";
        input.value = value;
        input.oninput = () => {
          input.value = input.value.replace(/\D/g, "").slice(0, 4);
        };
      } else if (key.endsWith("Code")) {
        input.type = "text";
        input.maxLength = 3;
        input.pattern = "\\d{3}";
        input.value = value;
        input.oninput = () => {
          input.value = input.value.replace(/\D/g, "").slice(0, 3);
        };
      } else if (key.endsWith("Date")) {
        input.type = "date";
        if (value === "" || value === null) {
          input.value = "";
        } else {
          input.value = value.split("/").reverse().join("-");
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
        input.value = value;
        input.oninput = () => {
          input.value = input.value.replace(/\D/g, "").slice(0, 2);
        };
      } else if (key.endsWith("Integer")) {
        input.type = "text";
        input.maxLength = 3;
        input.pattern = "\\d{1,3}";
        input.value = value;
        input.oninput = () => {
          input.value = input.value.replace(/\D/g, "").slice(0, 3);
        };
      } else if (key.endsWith("Boolean")) {
        input.type = "checkbox";
        input.value = value;
        input.checked = value === true || value === "true";
        input.onchange = () => {
          if (input.checked) {
            input.value = "true";
          } else {
            input.value = "false";
          }
        };
      } else if (key.endsWith("Options")) {
        const friendly = friendlyNames[key as keyof typeof friendlyNames];
        fieldLabel.textContent = typeof friendly === "string" ? friendly : friendly?.name ?? "";
        const controls = document.createElement("div") as HTMLDivElement;
        controls.setAttribute("data-field-name", key); // Add data-field-name attribute

        const options = typeof friendly === "object" && "options" in friendly ? friendly.options : [];
        options.forEach((option: string) => {
          const radioButton = document.createElement("input") as HTMLInputElement;
          const label = document.createElement("label") as HTMLLabelElement;
          radioButton.type = "radio";
          radioButton.value = option;
          const name = typeof friendly === "object" && "name" in friendly ? friendly.name : "";
          radioButton.name = name;
          radioButton.id = name + option;
          radioButton.checked = value === option;
          label.appendChild(radioButton);
          label.appendChild(document.createTextNode(option));
          controls.appendChild(label);
        });
        input = controls as HTMLInputElement;
      } else {
        // 🟢 **Default: Currency Field (if no other condition matched)**
        input.type = "text";
        if (key.includes("_")) {
          // Field code from friendlyNames[key]. It is the text after the underscore.
          const fieldCode = key.split("_")[1];
          codeLabel = document.createElement("label");
          codeLabel.textContent = fieldCode;
          codeLabel.className = "codeLabel";
        }

        let numericValue = parseFloat(value);
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

      fieldRow.appendChild(fieldLabel);
      fieldRow.appendChild(input);
      if (codeLabel) {
        fieldRow.appendChild(codeLabel);
      }
      container.appendChild(fieldRow);
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

    function populateField(container: HTMLElement, key: string, value: any) {
      // Find the field in the container
      const field = container.querySelector(`input[data-field-name="${key}"]`) as HTMLInputElement;
      if (field) {
        let numericValue = parseFloat(value);
        if (isNaN(numericValue)) {
          numericValue = 0.0;
        }
        field.value = formatCurrencyWithSymbol(numericValue);
        field.addEventListener("input", (e) => {
          currencyEventListener(field);
        });
      }
    }

    // Process main fields (thicker border)
    Object.entries(fileData).forEach(([key, value]) => {
      if (key !== "fields" && key !== "genericFields" && key !== "children") {
        createFieldRow(body, key, value, true);
      }
    });
    // If it is an 867 form and we are not on mobile we render according to the template
    if (fileData.documentType === "טופס 867" && window.innerWidth > 768 && withAllFields) {
      // Clone template_867_2022
      const template = document.getElementById("template_867_2022") as HTMLDivElement;
      const clone = template.cloneNode(true) as HTMLDivElement;
      clone.id = "";
      // Populate the clone with the fileData
      Object.entries(fileData.fields || {}).forEach(([key, value]) => {
        populateField(clone, key, value);
      });
      clone.removeAttribute("hidden");
      body.appendChild(clone);
    } else {
      // Process nested fields inside `fileData.fields` (thinner border)
      Object.entries(fileData.fields || {}).forEach(([key, value]) => {
        createFieldRow(body, key, value, false);
      });
    }

    // Only show children section if there are children or if this is a form that can have children
    if (fileData.children) {
      // Title for the children with a control button before the title, that adds a new child.
      const childrenTitle = document.createElement("div") as HTMLDivElement;
      childrenTitle.textContent = "ילדים";
      childrenTitle.className = "children-title";
      body.appendChild(childrenTitle);
      // add a button to add a new child on the same line as the title
      const addChildButton = document.createElement("button");
      addChildButton.textContent = "הוספת ילד";
      addChildButton.className = "add-child-button";
      body.appendChild(addChildButton);
      addChildButton.onclick = () => {
        fileData.children.push({
          birthDate: "",
          noSecondParentBoolean: false,
          caringForBoolean: true,
          requestDelayOfPointsBoolean: false,
          requestUsePointsFromLastYearBoolean: false,
        });
        // Re-render the fields
        renderFields(fileData, body);
      };

      // Process child fields inside `fileData.children` (thinner border)
      let childCount = 0;
      fileData.children.forEach((child: any, index: number) => {
        childCount++;
        // Title and container for the child
        const childContainer = document.createElement("div") as HTMLDivElement;
        childContainer.className = "child-container";

        const childTitleText = document.createElement("span") as HTMLSpanElement;
        childTitleText.textContent = "ילד " + childCount;
        childTitleText.className = "child-title-text";
        childContainer.appendChild(childTitleText);

        // Add remove button
        const removeButton = document.createElement("button") as HTMLButtonElement;
        removeButton.textContent = "X";
        removeButton.className = "remove-child-button";
        removeButton.onclick = () => {
          fileData.children.splice(index, 1);
          // Re-render the fields
          renderFields(fileData, body);
        };
        childContainer.appendChild(removeButton);

        body.appendChild(childContainer);
        Object.entries(child).forEach(([key, value]) => {
          createFieldRow(childContainer, key, value, false);
        });
      });
    }

    // Re-add the action buttons
    buttonsArray.forEach((button) => {
      body.appendChild(button);
    });
  }

  // 🟢 **Function to Format Currency with Commas & Symbol**
  function formatCurrencyWithSymbol(value: number) {
    let parts = value.toFixed(2).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ","); // Add commas for thousands
    return `₪${parts.join(".")}`;
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

  /* ********************************** create header input (Responsive) ************************************** */
  function displayFileInfoLineError(headerFieldsContainer: HTMLDivElement, fileData: any) {
    // If it is an error document type

    const fileName = { name: fileData.fileName, size: 0, path: fileData.path };

    const fileInfoElement = document.createElement("div");
    fileInfoElement.className = "file-info";

    const fileHeader = document.createElement("div");
    fileHeader.className = "file-header";

    const fileNameElement = document.createElement("span") as HTMLSpanElement;
    fileNameElement.className = "fileNameElement";

    fileNameElement.textContent = fileName.path || fileName.name;
    fileNameElement.textContent = fileNameElement.textContent + " " + "❌";

    fileHeader.appendChild(fileNameElement);
    fileInfoElement.appendChild(fileHeader);

    const statusMessageSpan = document.createElement("span");
    statusMessageSpan.className = "status-message";
    statusMessageSpan.textContent = fileData.reasonText;
    fileInfoElement.appendChild(statusMessageSpan);
    // Append the wrapper to the container
    headerFieldsContainer.appendChild(fileInfoElement);
  }

  function displayFileInfoLine(headerFieldsContainer: HTMLDivElement, fileData: any) {
    // Create a wrapper for the header fields
    const fieldsWrapper = document.createElement("div");
    fieldsWrapper.className = "header-fields-wrapper"; // Used for layout styling

    const createHeaderInput = (value: any, fieldName: string, labelText: string, isEditable = true) => {
      const fieldContainer = document.createElement("div") as HTMLDivElement;
      fieldContainer.className = "field-container"; // Used for mobile layout

      // Create label (only visible on mobile)
      const headerFieldlabel = document.createElement("label");
      headerFieldlabel.textContent = labelText;
      headerFieldlabel.className = "headerfield-label";

      // Create input field
      const input = document.createElement("input") as HTMLInputElement;
      input.type = "text";
      input.value = value || "";
      input.setAttribute("data-field-name", fieldName);
      input.className = "header-input";
      input.readOnly = !isEditable;

      // Append label and input (label appears only in mobile)
      fieldContainer.appendChild(headerFieldlabel);
      fieldContainer.appendChild(input);

      return fieldContainer;
    };

    // Append fields to the wrapper
    //fieldsWrapper.appendChild(createHeaderInput(fileData.taxYear, "taxYear", "שנה", true, "50px"));
    fieldsWrapper.appendChild(createHeaderInput(fileData.documentType, "documentType", "סוג מסמך", false));
    fieldsWrapper.appendChild(createHeaderInput(fileData.organizationName, "organizationName", "שם הארגונים", true));
    fieldsWrapper.appendChild(createHeaderInput(fileData.clientName, "clientName", "שם הלקוח", true));
    fieldsWrapper.appendChild(createHeaderInput(fileData.clientIdentificationNumber, "clientIdentificationNumber", "מספר זיהוי", true));
    //fieldsWrapper.appendChild(createHeaderInput(fileData.fileName, "fileName", "שם הקובץ", false, "150px"));

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

  async function displayFileInfoButtons(saveButton: HTMLButtonElement, cancelButton: HTMLButtonElement, fileData: any, accordianBody: HTMLElement, allFilesData: any) {
    function getDataFromControls() {
      const updatedData = { ...fileData }; // Clone original fileData
      //   if (fileData.fields) {
      //     updatedData.fields = { ...fileData.fields }; // Preserve existing fields
      //   }

      function isCurrencyField(fieldName: string) {
        return !(
          fieldName.endsWith("Name") ||
          fieldName.endsWith("Text") ||
          fieldName.endsWith("Number") ||
          fieldName.endsWith("taxYear") ||
          fieldName.endsWith("Date") ||
          fieldName.endsWith("Months") ||
          fieldName.endsWith("Integer") ||
          fieldName.endsWith("Code") ||
          fieldName.endsWith("Boolean") ||
          fieldName.endsWith("Options")
        );
      }

      const formDetails = configurationData.formTypes.find((form) => form.formType === fileData.type) as { fieldTypes?: string[] };

      // Update main fields and fields object
      accordianBody.querySelectorAll("input[data-field-name]:not(.child-container input)").forEach((input) => {
        const htmlInput = input as HTMLInputElement;
        const fieldName = htmlInput.getAttribute("data-field-name") as string;
        let fieldValue = htmlInput.value;

        if (isCurrencyField(fieldName)) {
          fieldValue = fieldValue.replace(/[₪,]/g, "");
          if (!isNaN(parseFloat(fieldValue)) && isFinite(parseFloat(fieldValue))) {
            fieldValue = parseFloat(fieldValue).toFixed(2);
          }
        } else if (fieldName.endsWith("Boolean")) {
          fieldValue = htmlInput.checked ? "true" : "false";
        } else if (fieldName.endsWith("Date")) {
          fieldValue = normalizeDate(htmlInput.value);
        }
        // Search the fieldTypes array for a field with the same name as fieldName
        const isField = formDetails.fieldTypes?.find((field) => field === fieldName) !== undefined;

        // Determine where to store the updated value
        if (isField) {
          updatedData.fields[fieldName] = fieldValue;
        } else if (fieldName in fileData) {
          updatedData[fieldName] = fieldValue;
        }
      });

      // Update Options fields and fields object
      accordianBody.querySelectorAll("div[data-field-name]:not(.child-container input)").forEach((div) => {
        const htmlDiv = div as HTMLDivElement;
        const fieldName = htmlDiv.getAttribute("data-field-name") as string;

        if (fieldName.endsWith("Options")) {
          // Iterate over the radio buttons and check which one is checked.
          const radioButtons = htmlDiv.querySelectorAll("input[type='radio']");
          for (const radioButton of radioButtons) {
            const rb = radioButton as HTMLInputElement;
            if (rb.checked) {
              updatedData[fieldName] = rb.value;
            }
          }
        }
      });

      // Update header fields
      const headerContainer = accordianBody.closest(".accordion-container")?.querySelector(".header-fields-wrapper");
      if (headerContainer) {
        headerContainer.querySelectorAll("input[data-field-name]").forEach((input: Element) => {
          const fieldName = input.getAttribute("data-field-name");
          let fieldValue = (input as HTMLInputElement).value.trim();
          updatedData[fieldName as keyof typeof updatedData] = fieldValue;
        });
      }

      // Update children array
      if (fileData.children) {
        updatedData.children = [];
        const childContainers = Array.from(accordianBody.querySelectorAll(".child-container"));

        for (let i = 0; i < childContainers.length; i++) {
          const container = childContainers[i];
          const child: any = {};

          // Get all inputs within this child container, including those in nested divs
          const inputs = Array.from(container.querySelectorAll("input[data-field-name]"));

          for (const input of inputs) {
            const htmlInput = input as HTMLInputElement;
            const fieldName = htmlInput.getAttribute("data-field-name") as string;

            if (fieldName.endsWith("Boolean")) {
              child[fieldName] = htmlInput.checked;
            } else if (fieldName.endsWith("Date")) {
              // Convert date from YYYY-MM-DD to DD/MM/YYYY
              child[fieldName] = normalizeDate(htmlInput.value);
            } else {
              child[fieldName] = htmlInput.value;
            }
          }

          debug(`Child ${i} data:`, child);
          updatedData.children.push(child);
        }
      }
      return updatedData;

      function normalizeDate(dateValue: string) {
        if (dateValue) {
          const [year, month, day] = dateValue.split("-");
          return `${day}/${month}/${year}`;
        } else {
          return "";
        }
      }
    }

    // Set up the save button
    saveButton.textContent = "שמור שינויים";
    saveButton.className = "form-action-button";

    // Create the cancel button
    cancelButton.textContent = "ביטול שינויים";
    cancelButton.className = "form-action-button";

    if (fileData.fields && configurationData) {
      const addFieldsButton = document.createElement("button") as HTMLButtonElement;
      addFieldsButton.textContent = "הוספת שדות קלט";
      addFieldsButton.className = "form-action-button";
      accordianBody.appendChild(addFieldsButton);

      //  add fields to an existing form
      addFieldsButton.onclick = async () => {
        handleAddFields(addFieldsButton, withAllFields);
      };
    }
    //}
    // Cancel button behavior: Restore original file info
    cancelButton.onclick = async () => {
      debug("🔄 Cancel button clicked, restoring original data");
      // Restore only this form from the backupAllFilesData
      const backupFormIndex = backupAllFilesData.findIndex((form: any) => form.fileId === fileData.fileId);
      if (backupFormIndex !== -1) {
        // Replace the form in the allFilesData array with the form in the backupAllFilesData array
        renderFields(backupAllFilesData[backupFormIndex], accordianBody, false);
      }
    };

    // Save button behavior: Process and save the data
    saveButton.onclick = async () => {
      const formData = getDataFromControls();

      //debug("🔄 Updating Form Data:", updatedData);
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
            backupAllFilesData[backupFormIndex] = structuredClone(updatedData[formIndex]);
          }
        }
        fileModifiedActions(editableFileListHasEntries());
        addMessage("נתונים נשמרו בהצלחה", "success");
      }
    };

    function handleAddFields(addFieldsButton: HTMLButtonElement, withAllFields: boolean) {
      // If it is a 867 form and we are not on mobile we render according to the template
      if (!withAllFields) {
        addFieldsButton.textContent = "הסר שדות קלט";
      } else {
        addFieldsButton.textContent = "הוספת שדות קלט";
      }

      const updatedData = updateFormAllFields(allFilesData, fileData.fileId, fileData.type, getDataFromControls(), !withAllFields);
      if (updatedData) {
        const formIndex = updatedData.findIndex((form: any) => form.fileId === fileData.fileId);
        if (formIndex !== -1) {
          renderFields(updatedData[formIndex], accordianBody, !withAllFields);
          addFieldsButton.onclick = async () => {
            handleAddFields(addFieldsButton, !withAllFields);
          };
        }
        fileModifiedActions(editableFileListHasEntries());
        // reopen the file accordian
        editableOpenFileListEntry(fileData.fileName);
      }
    }
  }
}
