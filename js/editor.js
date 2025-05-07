import { configurationData, debug, addMessage, handleResponse, } from "./index.js";
import { API_BASE_URL } from "./env.js";
/* ********************************************************** Generic modal ******************************************************************** */
function customerMessageModal({ title, message, button1Text, button2Text = null, displayTimeInSeconds = 0, }) {
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
        const timeModalButtonContainer = document.createElement("div");
        timeModalButtonContainer.className = "time-modal-button-container";
        timeModalButtonContainer.style.justifyContent = button2Text
            ? "space-between"
            : "center";
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
        }
        else {
            // Button 1
            const timeModalButton1 = document.createElement("button");
            timeModalButton1.textContent = button1Text;
            timeModalButton1.className = "time-modal-button";
            timeModalButton1.onclick = () => {
                timeModal.remove(); // Close modal
                resolve(1); // Return 1 for first button clicked
            };
            timeModalButtonContainer.appendChild(timeModalButton1);
            // Button 2 (if provided)
            if (button2Text) {
                const timeModalButton2 = document.createElement("button");
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
    bankName: "שם הבנק",
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
    noteText: "הערה"
};
const excludedHeaderFields = [
    "taxYear",
    "clientName",
    "clientIdentificationNumber",
    "documentType",
    "type",
    "fileName",
    "fileId",
    "matchTag",
    "fieldTypes",
];
export function editableFileListHasEntries() {
    const expandableArea = document.getElementById("expandableAreaUploadFiles");
    return expandableArea && expandableArea.children.length > 0;
}
export function editableGetDocTypes() {
    // Get all accordionContainers and map to their document types
    return Array.from(document.querySelectorAll("#expandableAreaUploadFiles #accordionContainer"))
        .map((div) => div.getAttribute("data-doc-typename"))
        .filter(Boolean); // Remove any null/undefined values
}
export function editableRemoveFileList() {
    const expandableArea = document.getElementById("expandableAreaUploadFiles");
    expandableArea.innerHTML = "";
}
export function editableOpenFileListEntry(fileName) {
    // Find the accordion container that contains the file name in its header fields
    const accordionContainers = document.querySelectorAll("#expandableAreaUploadFiles #accordionContainer");
    for (const container of accordionContainers) {
        // Look for the input with data-field-name="fileName" in the header fields
        const fileNameInput = container.querySelector('input[data-field-name="fileName"]');
        if (fileNameInput && fileNameInput.value === fileName) {
            // Find the toggle button (first child of the header)
            const header = container.querySelector("div"); // First div is the header
            const toggleButton = header.querySelector("toggleButton");
            if (toggleButton) {
                toggleButton.click(); // This will trigger the accordion toggle
                // Scroll the container into view with smooth behavior
                container.scrollIntoView({ behavior: "smooth", block: "center" });
                break;
            }
        }
    }
}
export async function displayFileInfoInExpandableArea(data) {
    const expandableArea = document.getElementById("expandableAreaUploadFiles");
    if (!expandableArea) {
        console.error('Element with id "expandableAreaUploadFiles" not found!');
        return;
    }
    expandableArea.innerHTML = "";
    expandableArea.style.display = "block";
    displayFileInfoHeader(expandableArea, data);
    // Render each accordion entry
    data.forEach((fileData) => {
        const accordionContainer = document.createElement("div");
        accordionContainer.id = "accordionContainer";
        accordionContainer.className = "accordion-container";
        accordionContainer.setAttribute("data-doc-typename", fileData.documentType);
        // Accordion Header
        const accordianheader = document.createElement("div");
        accordianheader.className = "accordion-header";
        // Accordion Body (Initially Hidden)
        const accordianbody = document.createElement("div");
        accordianbody.style.display = "none";
        accordianbody.style.padding = "2px";
        // Toggle Button (+/-)
        const accordionToggleButton = document.createElement("toggleButton");
        displayFileInfoPlusMinusButton(accordianbody, accordionToggleButton);
        accordianheader.appendChild(accordionToggleButton);
        // Header Fields
        const headerFieldsContainer = document.createElement("div");
        headerFieldsContainer.style.display = "flex";
        displayFileInfoLine(headerFieldsContainer, fileData);
        accordianheader.appendChild(headerFieldsContainer);
        // Delete Button
        const editorDeleteButton = document.createElement("button");
        displayFileInfoDeleteButton(editorDeleteButton, fileData, accordionContainer);
        accordianheader.appendChild(editorDeleteButton);
        accordionContainer.appendChild(accordianheader);
        // First, display additional fields in the body (excluding header fields)
        renderFields(fileData, accordianbody);
        // Update Button
        const saveButton = document.createElement("button");
        const cancelButton = document.createElement("button");
        displayFileInfoButtons(saveButton, cancelButton, fileData, accordianbody, data);
        accordianbody.appendChild(saveButton);
        accordianbody.appendChild(cancelButton);
        //accordianbody.appendChild(addFieldsButton);
        accordionContainer.appendChild(accordianbody);
        expandableArea.appendChild(accordionContainer);
    });
    async function updateFormFunction(fileId, payload) {
        const URL = API_BASE_URL + "/updateForm";
        //debug("This is the payload in updateFormFunction:",JSON.stringify(payload));
        if (payload.fields) {
            // Remove fields with value "0.00"
            const filteredFields = Object.fromEntries(Object.entries(payload.fields).filter(([_, value]) => value !== "0.00"));
            //debug("filtered fields", filteredFields);
            // remove the fields from the payload if they are empty
            if (Object.keys(filteredFields).length === 0) {
                delete payload.fields;
            }
            else {
                payload = {
                    ...payload,
                    fields: filteredFields,
                };
            }
        }
        try {
            // Send the POST request
            const response = await fetch(URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    customerDataEntryName: "Default",
                    formAsJSON: {
                        ...payload,
                        fileId: fileId, // Ensure fileId is included in the payload
                    },
                }),
            });
            if (!(await handleResponse(response, "Failed to update form"))) {
                return;
            }
            // Parse and handle the response
            const responseData = await response.json();
            //debug("Form updated successfully:", responseData);
            return responseData; // Return the response if needed
        }
        catch (error) {
            console.error("Error updating form:", error);
            addMessage("שגיאה בעריכת הטופס: " + error.message, "error");
        }
    }
    async function updateFormFunctionNewForm(fileId, fileType, fileData) {
        // Parse configurationData to extract the necessary form types and fields
        let config;
        try {
            debug("Parsing configuration data...");
            config = configurationData;
            debug("Parsed configuration data successfully:", config);
        }
        catch (error) {
            console.error("Failed to parse configuration data:", error);
            return;
        }
        // Find the formType details
        const formDetails = config.formTypes.find((form) => form.formType === fileType);
        if (!formDetails) {
            console.error(`Form type '${fileType}' not found in configuration data.`);
            return;
        }
        debug(`Found form details for '${fileType}':`, formDetails);
        // Ensure fieldTypes exist before iterating
        if (!formDetails.fieldTypes || formDetails.fieldTypes.length === 0) {
            console.warn(`No fieldTypes found for '${fileType}'.`);
        }
        // Copy existing fields from fileData (excluding the `fields` object)
        const existingData = { ...fileData };
        delete existingData.fields; // Ensure we don't mix fields with other properties
        // Initialize fieldsData with existing fields from fileData.fields
        const fieldsData = { ...(fileData.fields || {}) };
        // Fill missing fields from configuration with default values
        if (formDetails.fieldTypes) {
            formDetails.fieldTypes.forEach((field) => {
                if (!(field in fieldsData)) {
                    fieldsData[field] = "0.00"; // Default placeholder value
                }
            });
        }
        //debug("Final fields data (separate fields object):", fieldsData);
        // Construct the JSON payload using ALL copied fields + generated missing fields inside "fields" section
        const payload = {
            fileId: fileId,
            type: fileType,
            ...existingData, // Includes all original fileData fields
            fields: fieldsData, // Separate section for form fields
        };
        debug("Final payload to be sent:", JSON.stringify(payload, null, 2));
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
            //   if (!response.ok) {
            //     throw new Error(`API request failed with status ${response.status}`);
            //   }
            if (!(await handleResponse(response, "Failed to update form"))) {
                return;
            }
            // Parse and handle the response
            const responseData = await response.json();
            debug("Form updated successfully:", responseData);
            return responseData;
        }
        catch (error) {
            addMessage("שגיאה בעריכת הקובץ: " +
                (error instanceof Error ? error.message : String(error)), "error");
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
        }
        catch (error) {
            console.error("Error getting files info:", error);
            throw error;
        }
    }
    function renderFields(fileData, body) {
        // Store the action buttons before clearing
        const actionButtons = body.querySelectorAll(".form-action-button");
        const buttonsArray = Array.from(actionButtons);
        // Clear the body
        body.innerHTML = "";
        function createFieldRow(container, key, value, isMainField = false) {
            // Skip fields already displayed in the header
            if (excludedHeaderFields.includes(key))
                return;
            let codeLabel = null;
            const fieldRow = document.createElement("div");
            fieldRow.style.display = "flex";
            fieldRow.style.marginBottom = "5px";
            let fieldLabel = document.createElement("label");
            const friendly = friendlyNames[key];
            fieldLabel.textContent =
                typeof friendly === "string" ? friendly : friendly?.name ?? "";
            fieldLabel.className = "field-labelx";
            let input = document.createElement("input");
            input.className = "field-input";
            input.setAttribute("data-field-name", key); // Add data-field-name attribute
            // 🟢 **Apply Field Formatting Rules**
            if (key.endsWith("Name")) {
                input.type = "text";
                input.maxLength = 50;
                input.value = value;
            }
            else if (key.endsWith("Text")) {
                input.type = "text";
                input.maxLength = 20;
                input.pattern = "\\d*";
                input.value = value;
                input.oninput = () => {
                    input.value = input.value.replace(/\D/g, "");
                };
            }
            else if (key.endsWith("Number")) {
                input.type = "text";
                input.maxLength = 9;
                input.pattern = "\\d{9}";
                input.value = value;
                input.oninput = () => {
                    input.value = input.value.replace(/\D/g, "").slice(0, 9);
                };
            }
            else if (key.endsWith("taxYear")) {
                input.type = "text";
                input.maxLength = 4;
                input.pattern = "\\d{4}";
                input.value = value;
                input.oninput = () => {
                    input.value = input.value.replace(/\D/g, "").slice(0, 4);
                };
            }
            else if (key.endsWith("Code")) {
                input.type = "text";
                input.maxLength = 3;
                input.pattern = "\\d{3}";
                input.value = value;
                input.oninput = () => {
                    input.value = input.value.replace(/\D/g, "").slice(0, 3);
                };
            }
            else if (key.endsWith("Date")) {
                input.type = "date";
                if (value === "" || value === null) {
                    input.value = "";
                }
                else {
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
            }
            else if (key.endsWith("Months")) {
                input.type = "text";
                input.maxLength = 2;
                input.pattern = "\\d{1,2}";
                input.value = value;
                input.oninput = () => {
                    input.value = input.value.replace(/\D/g, "").slice(0, 2);
                };
            }
            else if (key.endsWith("Integer")) {
                input.type = "text";
                input.maxLength = 3;
                input.pattern = "\\d{1,3}";
                input.value = value;
                input.oninput = () => {
                    input.value = input.value.replace(/\D/g, "").slice(0, 3);
                };
            }
            else if (key.endsWith("Boolean")) {
                input.type = "checkbox";
                input.value = value;
                input.checked = value === true || value === "true";
                input.onchange = () => {
                    if (input.checked) {
                        input.value = "true";
                    }
                    else {
                        input.value = "false";
                    }
                };
            }
            else if (key.endsWith("Options")) {
                const friendly = friendlyNames[key];
                fieldLabel.textContent =
                    typeof friendly === "string" ? friendly : friendly?.name ?? "";
                const controls = document.createElement("div");
                controls.setAttribute("data-field-name", key); // Add data-field-name attribute
                const options = typeof friendly === "object" && "options" in friendly
                    ? friendly.options
                    : [];
                options.forEach((option) => {
                    const radioButton = document.createElement("input");
                    const label = document.createElement("label");
                    radioButton.type = "radio";
                    radioButton.value = option;
                    const name = typeof friendly === "object" && "name" in friendly
                        ? friendly.name
                        : "";
                    radioButton.name = name;
                    radioButton.id = name + option;
                    radioButton.checked = value === option;
                    label.appendChild(radioButton);
                    label.appendChild(document.createTextNode(option));
                    controls.appendChild(label);
                });
                input = controls;
            }
            else {
                // 🟢 **Default: Currency Field (if no other condition matched)**
                input.type = "text";
                if (key.includes("_")) {
                    const fieldCode = key.split("_")[1];
                    codeLabel = document.createElement("label");
                    codeLabel.textContent = fieldCode;
                    codeLabel.className = "codeLabel";
                }
                // Firld code from friendlyNames[key]. It is the text after the underscore.
                let numericValue = parseFloat(value);
                if (isNaN(numericValue)) {
                    numericValue = 0.0;
                }
                input.value = formatCurrencyWithSymbol(numericValue);
                // **Restrict typing to valid numeric input**
                input.addEventListener("input", (e) => {
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
        // Process main fields (thicker border)
        Object.entries(fileData).forEach(([key, value]) => {
            if (key !== "fields" && key !== "genericFields" && key !== "children") {
                createFieldRow(body, key, value, true);
            }
        });
        // Process nested fields inside `fileData.fields` (thinner border)
        Object.entries(fileData.fields || {}).forEach(([key, value]) => {
            createFieldRow(body, key, value, false);
        });
        // Only show children section if there are children or if this is a form that can have children
        if (fileData.children) {
            // Title for the children with a control button before the title, that adds a new child.
            const childrenTitle = document.createElement("div");
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
            fileData.children.forEach((child, index) => {
                childCount++;
                // Title and container for the child
                const childContainer = document.createElement("div");
                childContainer.className = "child-container";
                const childTitleText = document.createElement("span");
                childTitleText.textContent = "ילד " + childCount;
                childTitleText.className = "child-title-text";
                childContainer.appendChild(childTitleText);
                // Add remove button
                const removeButton = document.createElement("button");
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
    function formatCurrencyWithSymbol(value) {
        let parts = value.toFixed(2).split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ","); // Add commas for thousands
        return `₪${parts.join(".")}`;
    }
    /* **************** display header for file info ******************** */
    function displayFileInfoHeader(expandableArea, data) {
        // Caption row for the accordion headers
        const captionsRow = document.createElement("div");
        captionsRow.className = "caption-row";
        const headerCaptions = [
            { text: "", width: "40px" },
            { text: "שנה", width: "100px" },
            { text: "שם הלקוח", width: "180px" },
            { text: "מספר זיהוי", width: "150px" },
            { text: "סוג מסמך", width: "150px" },
            { text: "שם הקובץ", width: "200px" },
        ];
        headerCaptions.forEach((caption) => {
            const captionElement = document.createElement("div");
            captionElement.textContent = caption.text;
            captionElement.className = "caption-element";
            captionElement.style.flex = `0 0 ${caption.width}`;
            captionsRow.appendChild(captionElement);
        });
        expandableArea.appendChild(captionsRow);
        // Hide the header if it's a mobile screen
        function toggleHeaderVisibility() {
            if (window.innerWidth <= 768) {
                captionsRow.style.display = "none";
            }
            else {
                captionsRow.style.display = "flex";
            }
        }
        // Run on page load
        toggleHeaderVisibility();
        // Update when resizing
        window.addEventListener("resize", toggleHeaderVisibility);
    }
    /* ********************************** create +_ button ************************************** */
    function displayFileInfoPlusMinusButton(accordionBody, accordionToggleButton) {
        accordionToggleButton.textContent = "+";
        accordionToggleButton.className = "accordion-toggle-button";
        accordionToggleButton.onclick = () => {
            accordionBody.style.display =
                accordionBody.style.display === "none" ? "block" : "none";
            accordionToggleButton.textContent =
                accordionToggleButton.textContent === "+" ? "-" : "+";
        };
    }
    /* ********************************** create header input (Responsive) ************************************** */
    function displayFileInfoLine(headerFieldsContainer, fileData) {
        // Create a wrapper for the header fields
        const fieldsWrapper = document.createElement("div");
        fieldsWrapper.className = "header-fields-wrapper"; // Used for layout styling
        const createHeaderInput = (value, fieldName, labelText, isEditable = true, width = "120px") => {
            const fieldContainer = document.createElement("div");
            fieldContainer.className = "field-container"; // Used for mobile layout
            // Create label (only visible on mobile)
            const headerFieldlabel = document.createElement("label");
            headerFieldlabel.textContent = labelText;
            headerFieldlabel.className = "headerfield-label";
            // Create input field
            const input = document.createElement("input");
            input.type = "text";
            input.value = value || "";
            input.setAttribute("data-field-name", fieldName);
            input.className = "header-input";
            //input.style.backgroundColor = isEditable ? '#fff' : '#e0e0e0';
            input.readOnly = !isEditable;
            // Append label and input (label appears only in mobile)
            fieldContainer.appendChild(headerFieldlabel);
            fieldContainer.appendChild(input);
            return fieldContainer;
        };
        // Append fields to the wrapper
        fieldsWrapper.appendChild(createHeaderInput(fileData.taxYear, "taxYear", "שנה", true, "50px"));
        fieldsWrapper.appendChild(createHeaderInput(fileData.clientName, "clientName", "שם הלקוח", true, "180px"));
        fieldsWrapper.appendChild(createHeaderInput(fileData.clientIdentificationNumber, "clientIdentificationNumber", "מספר זיהוי", true, "80px"));
        fieldsWrapper.appendChild(createHeaderInput(fileData.documentType, "documentType", "סוג מסמך", false, "150px"));
        //fieldsWrapper.appendChild(createHeaderInput(fileData.type, 'type', 'סוג קובץ', false, '150px'));
        fieldsWrapper.appendChild(createHeaderInput(fileData.fileName, "fileName", "שם הקובץ", false, "150px"));
        // Append the wrapper to the container
        headerFieldsContainer.appendChild(fieldsWrapper);
    }
    /* ********************************** create delete button ************************************** */
    function displayFileInfoDeleteButton(editorDeleteButton, fileData, accordionContainer) {
        editorDeleteButton.textContent = "X";
        editorDeleteButton.className = "editor-delete-button";
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
                    accordionContainer.remove();
                }
                else {
                    addMessage("שגיאה במחיקת קובץ. אנא נסה שוב.", "error");
                }
            })
                .catch((error) => {
                addMessage("שגיאה במחיקת קובץ. אנא נסה שוב.", "error");
                console.error("Delete error:", error);
            });
        };
    }
    /* ********************************** create the save button with cancel option ************************************** */
    async function displayFileInfoButtons(saveButton, cancelButton, fileData, accordianBody, data) {
        //debug("displayFileInfoButtons", fileData);
        function getDataFromControls() {
            const updatedData = { ...fileData }; // Clone original fileData
            updatedData.fields = { ...fileData.fields }; // Preserve existing fields
            function isCurrencyField(fieldName) {
                return !(fieldName.endsWith("Name") ||
                    fieldName.endsWith("Text") ||
                    fieldName.endsWith("Number") ||
                    fieldName.endsWith("taxYear") ||
                    fieldName.endsWith("Date") ||
                    fieldName.endsWith("Months") ||
                    fieldName.endsWith("Integer") ||
                    fieldName.endsWith("Code") ||
                    fieldName.endsWith("Boolean") ||
                    fieldName.endsWith("Options"));
            }
            // Update main fields and fields object
            accordianBody
                .querySelectorAll("input[data-field-name]:not(.child-container input)")
                .forEach((input) => {
                const htmlInput = input;
                const fieldName = htmlInput.getAttribute("data-field-name");
                let fieldValue = htmlInput.value;
                if (isCurrencyField(fieldName)) {
                    fieldValue = fieldValue.replace(/[₪,]/g, "");
                    if (!isNaN(parseFloat(fieldValue)) &&
                        isFinite(parseFloat(fieldValue))) {
                        fieldValue = parseFloat(fieldValue).toFixed(2);
                    }
                }
                else if (fieldName.endsWith("Boolean")) {
                    fieldValue = htmlInput.checked ? "true" : "false";
                    updatedData[fieldName] = fieldValue;
                }
                else {
                    // 🟢 **Determine where to store the updated value**
                    if (fieldName in fileData &&
                        !fileData.fields?.hasOwnProperty(fieldName)) {
                        updatedData[fieldName] = fieldValue;
                    }
                    else if (fileData.fields?.hasOwnProperty(fieldName)) {
                        updatedData.fields[fieldName] = fieldValue;
                    }
                }
            });
            // Update Options fields and fields object
            accordianBody
                .querySelectorAll("div[data-field-name]:not(.child-container input)")
                .forEach((div) => {
                const htmlDiv = div;
                const fieldName = htmlDiv.getAttribute("data-field-name");
                if (fieldName.endsWith("Options")) {
                    // Iterate over the radio buttons and check which one is checked.
                    const radioButtons = htmlDiv.querySelectorAll("input[type='radio']");
                    for (const radioButton of radioButtons) {
                        const rb = radioButton;
                        if (rb.checked) {
                            updatedData[fieldName] = rb.value;
                        }
                    }
                }
            });
            // Update header fields
            const headerContainer = accordianBody
                .closest(".accordion-container")
                ?.querySelector(".header-fields-wrapper");
            if (headerContainer) {
                headerContainer
                    .querySelectorAll("input[data-field-name]")
                    .forEach((input) => {
                    const fieldName = input.getAttribute("data-field-name");
                    let fieldValue = input.value.trim();
                    updatedData[fieldName] = fieldValue;
                });
            }
            // Update children array
            if (fileData.children) {
                updatedData.children = [];
                const childContainers = Array.from(accordianBody.querySelectorAll(".child-container"));
                for (let i = 0; i < childContainers.length; i++) {
                    const container = childContainers[i];
                    const child = {};
                    // Get all inputs within this child container, including those in nested divs
                    const inputs = Array.from(container.querySelectorAll("input[data-field-name]"));
                    for (const input of inputs) {
                        const htmlInput = input;
                        const fieldName = htmlInput.getAttribute("data-field-name");
                        if (fieldName.endsWith("Boolean")) {
                            child[fieldName] = htmlInput.checked;
                        }
                        else if (fieldName.endsWith("Date")) {
                            // Convert date from YYYY-MM-DD to DD/MM/YYYY
                            const dateValue = htmlInput.value;
                            if (dateValue) {
                                const [year, month, day] = dateValue.split("-");
                                child[fieldName] = `${day}/${month}/${year}`;
                            }
                            else {
                                child[fieldName] = "";
                            }
                        }
                        else {
                            child[fieldName] = htmlInput.value;
                        }
                    }
                    debug(`Child ${i} data:`, child);
                    updatedData.children.push(child);
                }
            }
            return updatedData;
        }
        // Set up the save button
        saveButton.textContent = "שמור שינויים";
        saveButton.className = "form-action-button";
        // Create the cancel button
        cancelButton.textContent = "ביטול שינויים";
        cancelButton.className = "form-action-button";
        if (fileData.fields && configurationData) {
            //debug("fileData.fields", fileData.fields);
            // Check if the number of fields is the same as the number of fields in the formType
            const formDetails = configurationData.formTypes.find((form) => form.formType === fileData.type);
            // Count the number of properties in the fileData.fields object
            const fileDataFieldsLength = Object.keys(fileData.fields).length;
            //debug("fileDataFieldsLength", fileDataFieldsLength);
            // Only if it is different add the add fields buton.
            if (formDetails?.fieldTypes?.length !== fileDataFieldsLength) {
                //debug("Lengths:", formDetails?.fieldTypes?.length, fileDataFieldsLength);
                const addFieldsButton = document.createElement("button");
                addFieldsButton.textContent = "הוספת שדות קלט";
                addFieldsButton.className = "form-action-button";
                accordianBody.appendChild(addFieldsButton);
                //  add fields to an existing form
                addFieldsButton.onclick = async () => {
                    debug("Adding fields to an existing form");
                    //await updateFormsWithoutFields(data);
                    const updatedData = await updateFormFunctionNewForm(fileData.fileId, fileData.type, getDataFromControls());
                    if (updatedData) {
                        // Remove the add fields button
                        accordianBody.removeChild(addFieldsButton);
                        displayFileInfoInExpandableArea(updatedData);
                    }
                };
            }
        }
        // Cancel button behavior: Restore original file info
        cancelButton.onclick = async () => {
            debug("🔄 Cancel button clicked, restoring original data");
            displayFileInfoInExpandableArea(data);
        };
        // Save button behavior: Process and save the data
        saveButton.onclick = async () => {
            const updatedData = getDataFromControls();
            //debug("🔄 Updating Form Data:", updatedData);
            await updateFormFunction(fileData.fileId, updatedData);
            // Display success modal
            await customerMessageModal({
                title: "שמירת נתונים",
                message: `הנתונים נשמרו בהצלחה`,
                button1Text: "",
                button2Text: "",
                displayTimeInSeconds: 2,
            });
        };
        async function updateFormsWithoutFields(formsData) {
            for (const fileData of formsData) {
                // Check if the fields object is missing or empty
                if (!fileData.fields || Object.keys(fileData.fields).length === 0) {
                    debug(`No fields found for fileId ${fileData.fileId}. Calling updateFormFunctionNewForm...`);
                    try {
                        // Pass the entire fileData object to updateFormFunctionNewForm
                        await updateFormFunctionNewForm(fileData.fileId, fileData.type, fileData);
                        debug(`Successfully updated form for fileId: ${fileData.fileId}`);
                    }
                    catch (error) {
                        console.error(`Error updating form for fileId ${fileData.fileId}:`, error);
                    }
                }
                else {
                    debug(`Fields already exist for fileId ${fileData.fileId}. Skipping update.`);
                }
            }
        }
        async function addFieldsToExistingForm(fileId, fileType, fileData) {
            // Construct the API URL
            const URL = API_BASE_URL + "/updateForm";
            // Parse configurationData to extract the necessary form types and fields
            let config = configurationData;
            // Find the formType details
            const formDetails = config.formTypes.find((form) => form.formType === fileType);
            if (!formDetails) {
                console.error(`Form type '${fileType}' not found in configuration data.`);
                return;
            }
            debug(`Found form details for '${fileType}':`, formDetails);
            // Ensure fieldTypes exist before iterating
            if (!formDetails.fieldTypes || formDetails.fieldTypes.length === 0) {
                console.warn(`No fieldTypes found for '${fileType}'.`);
            }
            // Copy existing fields from fileData (excluding the `fields` object)
            const existingData = { ...fileData };
            // delete existingData.fields; // do not delete existing fields
            // Initialize fieldsData with existing fields from fileData.fields
            //const fieldsData = { ...(fileData.fields || {}) };
            const fieldsData = fileData.fields;
            debug("field data before adding fields");
            debug(fileData.fields);
            // Fill missing fields from configuration with default values
            if (formDetails.fieldTypes) {
                formDetails.fieldTypes.forEach((field) => {
                    debug(`Adding missing field: ${field}`);
                    fieldsData[field] = "0.00"; // Default placeholder value
                });
            }
            debug("Final fields data (separate fields object):", fieldsData);
            // Construct the JSON payload using ALL copied fields + generated missing fields inside "fields" section
            const payload = {
                fileId: fileId,
                type: fileType,
                ...existingData, // Includes all original fileData fields
                fields: fieldsData, // Separate section for form fields
            };
            //debug("Final payload to be sent:", JSON.stringify(payload, null, 2));
            try {
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
                if (!response.ok) {
                    throw new Error(`API request failed with status ${response.status}`);
                }
                // Parse and handle the response
                const responseData = await response.json();
                debug("Form updated successfully:", responseData);
            }
            catch (error) {
                console.error("Error updating form:", error);
            }
        }
    }
}
//# sourceMappingURL=editor.js.map