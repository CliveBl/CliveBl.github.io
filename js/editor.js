import { configurationData, debug, addMessage, handleResponse, updateButtons, fileModifiedActions } from "./index.js";
import { API_BASE_URL } from "./env.js";
import { getFriendlyName, getFriendlyOptions, getFriendlyOptionName } from "./constants.js";
/* ********************************************************** Generic modal ******************************************************************** */
function customerMessageModal({ title, message, button1Text, button2Text = null, displayTimeInSeconds = 1, }) {
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
const excludedHeaderFields = ["organizationName", "clientIdentificationNumber", "clientName", "documentType", "type", "fileId", "matchTag", "fieldTypes"];
const readOnlyFields = ["fileName", "reasonText"];
const addFieldsText = "הצג כל השדות";
const removeFieldsText = "הסר שדות קלט";
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
    const expandableArea = document.getElementById("expandableAreaUploadFiles");
    expandableArea.innerHTML = "";
}
export function editableOpenFileListEntry(fileName) {
    // Find the accordion container that contains the file name in its header fields
    const accordionContainers = document.querySelectorAll("#expandableAreaUploadFiles #accordionContainer");
    for (const container of accordionContainers) {
        // Look for either an input or label with data-field-name="fileName"
        const fileNameElement = container.querySelector('input[data-field-name="fileName"], label[data-field-name="fileName"]');
        if (fileNameElement && fileNameElement.textContent === fileName) {
            // Find the toggle button (first child of the header)
            const header = container.querySelector("div"); // First div is the header
            const toggleButton = header.querySelector(".accordion-toggle-button");
            if (toggleButton) {
                // Find the parent year accordion container and its toggle button
                const yearContainer = container.closest(".date-accordion-container");
                if (yearContainer) {
                    const yearToggleButton = yearContainer.querySelector(".date-accordion-toggle-button");
                    const yearBody = yearContainer.querySelector(".date-accordion-body");
                    // Only open the year accordion if it's currently closed
                    if (yearToggleButton && yearBody && yearBody.style.display === "none") {
                        yearBody.style.display = "block";
                        yearToggleButton.textContent = "-";
                    }
                }
                // Only click the toggle button if the accordion is currently closed
                const accordionBody = container.querySelector(".accordian-body");
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
export async function displayFileInfoInExpandableArea(allFilesData, backupAllFilesData, withAllFields = false) {
    const expandableArea = document.getElementById("expandableAreaUploadFiles");
    if (!expandableArea) {
        console.error('Element with id "expandableAreaUploadFiles" not found!');
        return;
    }
    expandableArea.innerHTML = "";
    expandableArea.style.display = "block";
    // Group files by year
    const filesByYear = new Map();
    allFilesData.forEach((fileData) => {
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
        if (a === "No Year")
            return 1;
        if (b === "No Year")
            return -1;
        return parseInt(b) - parseInt(a);
    });
    // Create year-level accordions
    sortedYears.forEach((year) => {
        const files = filesByYear.get(year) || [];
        // Create year container
        const yearContainer = document.createElement("div");
        yearContainer.className = "date-accordion-container";
        // Create year header
        const yearHeader = document.createElement("div");
        yearHeader.className = "date-accordion-header";
        if (files.some((file) => file.type === "FormError")) {
            yearHeader.className += " error";
        }
        // Create year toggle button
        const yearToggleButton = document.createElement("button");
        yearToggleButton.textContent = "+";
        yearToggleButton.className = "date-accordion-toggle-button";
        yearHeader.appendChild(yearToggleButton);
        // Create year title
        const yearTitle = document.createElement("span");
        yearTitle.textContent = year;
        yearTitle.className = "date-title";
        yearHeader.appendChild(yearTitle);
        // Create year body
        const yearBody = document.createElement("div");
        yearBody.className = "date-accordion-body";
        yearBody.style.display = "none";
        // Add toggle functionality
        yearToggleButton.onclick = () => {
            yearBody.style.display = yearBody.style.display === "none" ? "block" : "none";
            yearToggleButton.textContent = yearToggleButton.textContent === "+" ? "-" : "+";
        };
        displayFileInfoHeader(yearBody, allFilesData);
        // Add files to year body
        files.forEach((fileData) => {
            const accordionContainer = document.createElement("div");
            accordionContainer.id = "accordionContainer";
            accordionContainer.className = "accordion-container";
            accordionContainer.setAttribute("data-doc-typename", fileData.documentType);
            // Accordion Header
            const accordianheader = document.createElement("div");
            accordianheader.className = "accordion-header";
            // Accordion Body (Initially Hidden)
            const accordianBody = document.createElement("div");
            accordianBody.className = "accordian-body";
            accordianBody.style.display = "none";
            // Toggle Button (+/-)
            const accordionToggleButton = document.createElement("button");
            accordionToggleButton.className = "accordion-toggle-button";
            displayFileInfoPlusMinusButton(accordianBody, accordionToggleButton);
            accordianheader.appendChild(accordionToggleButton);
            // Header Fields
            const headerFieldsContainer = document.createElement("div");
            headerFieldsContainer.style.display = "flex";
            if (fileData.type === "FormError") {
                displayFileInfoLineError(headerFieldsContainer, fileData);
                accordionContainer.classList.add("error");
            }
            else {
                displayFileInfoLine(headerFieldsContainer, fileData);
            }
            accordianheader.appendChild(headerFieldsContainer);
            // Delete Button
            const editorDeleteButton = document.createElement("button");
            displayFileInfoDeleteButton(editorDeleteButton, fileData, accordionContainer);
            accordianheader.appendChild(editorDeleteButton);
            accordionContainer.appendChild(accordianheader);
            async function displayFileInfoButtons(saveButton, cancelButton, fileData, accordianBody, allFilesData) {
                // Set up the save button
                saveButton.textContent = "שמור שינויים";
                saveButton.className = "form-action-button";
                // Create the cancel button
                cancelButton.textContent = "ביטול שינויים";
                cancelButton.className = "form-action-button";
                // Cancel button behavior: Restore original file info
                cancelButton.onclick = async () => {
                    debug("🔄 Cancel button clicked, restoring original data");
                    // Restore only this form from the backupAllFilesData
                    const backupFormIndex = backupAllFilesData.findIndex((form) => form.fileId === fileData.fileId);
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
                        const formIndex = updatedData.findIndex((form) => form.fileId === fileData.fileId);
                        if (formIndex !== -1) {
                            const backupFormIndex = backupAllFilesData.findIndex((form) => form.fileId === fileData.fileId);
                            if (backupFormIndex !== -1) {
                                backupAllFilesData[backupFormIndex] = structuredClone(updatedData[formIndex]);
                            }
                        }
                        fileModifiedActions(editableFileListHasEntries());
                        addMessage("נתונים נשמרו בהצלחה", "success");
                    }
                };
            }
            function getDataFromControls() {
                const updatedData = { ...fileData }; // Clone original fileData
                //   if (fileData.fields) {
                //     updatedData.fields = { ...fileData.fields }; // Preserve existing fields
                //   }
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
                        fieldName.endsWith("Options") ||
                        fieldName.endsWith("Type"));
                }
                function normalizeDate(dateValue) {
                    if (dateValue) {
                        const [year, month, day] = dateValue.split("-");
                        return `${day}/${month}/${year}`;
                    }
                    else {
                        return "";
                    }
                }
                const formDetails = configurationData.formTypes.find((form) => form.formType === fileData.type);
                // Update from main fields and fields object
                accordianBody.querySelectorAll("input[data-field-name]:not(.item-container input)").forEach((input) => {
                    const htmlInput = input;
                    const fieldName = htmlInput.getAttribute("data-field-name");
                    let fieldValue = htmlInput.value;
                    if (isCurrencyField(fieldName)) {
                        fieldValue = fieldValue.replace(/[₪,]/g, "");
                        if (!isNaN(parseFloat(fieldValue)) && isFinite(parseFloat(fieldValue))) {
                            fieldValue = parseFloat(fieldValue).toFixed(2);
                        }
                    }
                    else if (fieldName.endsWith("Boolean")) {
                        fieldValue = htmlInput.checked ? "true" : "false";
                    }
                    else if (fieldName.endsWith("Date")) {
                        fieldValue = normalizeDate(htmlInput.value);
                    }
                    // Search the fieldTypes array for a field with the same name as fieldName
                    const isField = formDetails.fieldTypes?.find((field) => field === fieldName) !== undefined;
                    // Determine where to store the updated value
                    if (isField) {
                        updatedData.fields[fieldName] = fieldValue;
                    }
                    else if (fieldName in fileData) {
                        updatedData[fieldName] = fieldValue;
                    }
                });
                // Update from Options fields and fields object
                accordianBody.querySelectorAll("div[data-field-name]:not(.item-container input)").forEach((div) => {
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
                // Update from header fields
                const headerContainer = accordianBody.closest(".accordion-container")?.querySelector(".header-fields-wrapper");
                if (headerContainer) {
                    headerContainer.querySelectorAll("input[data-field-name]").forEach((input) => {
                        const fieldName = input.getAttribute("data-field-name");
                        let fieldValue = input.value.trim();
                        updatedData[fieldName] = fieldValue;
                    });
                }
                // Function to update item arrays like children and genericFields
                function updateItemArray(fileData, updatedData, itemArrayName, containerSelector) {
                    if (fileData[itemArrayName]) {
                        updatedData[itemArrayName] = [];
                        const itemContainers = Array.from(accordianBody.querySelectorAll(containerSelector));
                        for (let i = 0; i < itemContainers.length; i++) {
                            const container = itemContainers[i];
                            const item = {};
                            // Get all inputs within this item container, including those in nested divs
                            const selectInputs = Array.from(container.querySelectorAll("select[data-field-name]"));
                            for (const input of selectInputs) {
                                const htmlSelect = input;
                                const fieldName = htmlSelect.getAttribute("data-field-name");
                                item[fieldName] = htmlSelect.value;
                            }
                            const inputs = Array.from(container.querySelectorAll("input[data-field-name]"));
                            for (const input of inputs) {
                                const htmlInput = input;
                                const fieldName = htmlInput.getAttribute("data-field-name");
                                let fieldValue = htmlInput.value;
                                if (isCurrencyField(fieldName)) {
                                    fieldValue = fieldValue.replace(/[₪,]/g, "");
                                    if (!isNaN(parseFloat(fieldValue)) && isFinite(parseFloat(fieldValue))) {
                                        fieldValue = parseFloat(fieldValue).toFixed(2);
                                        item[fieldName] = fieldValue;
                                    }
                                    else {
                                        item[fieldName] = "0.00";
                                    }
                                }
                                else if (fieldName.endsWith("Boolean")) {
                                    item[fieldName] = htmlInput.checked;
                                }
                                else if (fieldName.endsWith("Date")) {
                                    // Convert date from YYYY-MM-DD to DD/MM/YYYY
                                    item[fieldName] = normalizeDate(htmlInput.value);
                                }
                                else {
                                    item[fieldName] = fieldValue;
                                }
                            }
                            debug(`Item ${i} data:`, item);
                            updatedData[itemArrayName].push(item);
                        }
                    }
                }
                // Update children array
                updateItemArray(fileData, updatedData, "children", ".item-container");
                // Update genericFields array
                updateItemArray(fileData, updatedData, "genericFields", ".item-container");
                return updatedData;
            }
            function toggleFieldsView(toggleLink) {
                // Get desired state.
                const showAllFields = toggleLink.textContent === addFieldsText;
                // Perform the toggle by changing the text content of the toggle link.
                if (showAllFields) {
                    toggleLink.textContent = removeFieldsText;
                }
                else {
                    toggleLink.textContent = addFieldsText;
                }
                const updatedData = updateFormAllFields(allFilesData, fileData.fileId, fileData.type, getDataFromControls(), showAllFields);
                if (updatedData) {
                    const formIndex = updatedData.findIndex((form) => form.fileId === fileData.fileId);
                    if (formIndex !== -1) {
                        renderFields(updatedData[formIndex], accordianBody, showAllFields);
                    }
                    fileModifiedActions(editableFileListHasEntries());
                }
            }
            function handleToggleClick(e) {
                e.preventDefault(); // Prevent scrolling to the top of the page
                const toggleLink = e.currentTarget;
                toggleFieldsView(toggleLink);
            }
            if (fileData.fields && configurationData) {
                // Create div with a toggle link for displaying all fields
                const toggleLinkContainer = document.createElement("div");
                toggleLinkContainer.className = "fields-toggle";
                const fieldsToggleLink = document.createElement("a");
                fieldsToggleLink.className = "fields-toggle-link";
                fieldsToggleLink.textContent = addFieldsText;
                fieldsToggleLink.href = "#";
                fieldsToggleLink.addEventListener("click", handleToggleClick);
                toggleLinkContainer.appendChild(fieldsToggleLink);
                accordianBody.appendChild(toggleLinkContainer);
            }
            // First, display additional fields in the body (excluding header fields)
            renderFields(fileData, accordianBody, withAllFields);
            // Update Button
            const saveButton = document.createElement("button");
            const cancelButton = document.createElement("button");
            displayFileInfoButtons(saveButton, cancelButton, fileData, accordianBody, allFilesData);
            accordianBody.appendChild(saveButton);
            accordianBody.appendChild(cancelButton);
            accordionContainer.appendChild(accordianBody);
            yearBody.appendChild(accordionContainer);
        });
        yearContainer.appendChild(yearHeader);
        yearContainer.appendChild(yearBody);
        expandableArea.appendChild(yearContainer);
        // If this is a newly added file (check if it's the last file in the data array)
        const lastFile = allFilesData[allFilesData.length - 1];
        if (lastFile && (lastFile.taxYear === year || lastFile.type === "FormError")) {
            // Expand the year accordion
            yearBody.style.display = "block";
            yearToggleButton.textContent = "-";
        }
    });
    async function updateForm(fileId, payload) {
        if (payload.fields) {
            // Remove fields with value "0.00"
            const filteredFields = Object.fromEntries(Object.entries(payload.fields).filter(([_, value]) => value !== "0.00"));
            payload.fields = filteredFields;
            payload.fileId = fileId; // Ensure fileId is included in the payload
            //debug("filtered fields", filteredFields);
        }
        return updateFormAPI(fileId, payload);
    }
    function updateFormAllFields(allFilesData, fileId, fileType, fileData, withAllFields) {
        // Find the formType details
        const formDetails = configurationData.formTypes.find((form) => form.formType === fileType);
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
            }
            else {
                // Remove any fields with 0 value
                Object.keys(fieldsData).forEach((key) => {
                    if (fieldsData[key] === "0.00") {
                        delete fieldsData[key];
                    }
                });
            }
        }
        // Create a new list of obkects.
        let updatedData = [];
        // Now clone data, (which is an array of file objects), into updatedData item by item.
        allFilesData.forEach((file) => {
            if (file.fileId === fileId) {
                updatedData.push(updatedFileData);
            }
            else {
                // Deep clone the file object
                updatedData.push(structuredClone(file));
            }
        });
        return updatedData;
    }
    async function updateFormAPI(fileId, payload) {
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
        }
        catch (error) {
            addMessage("שגיאה בעריכת הקובץ: " + (error instanceof Error ? error.message : String(error)), "error");
        }
    }
    function renderFields(fileData, accordianBody, withAllFields = false) {
        // Store the action buttons before clearing
        const actionButtons = accordianBody.querySelectorAll(".form-action-button");
        const buttonsArray = Array.from(actionButtons);
        const fieldsToggleLink = accordianBody.querySelector(".fields-toggle-link");
        // Clear the body
        accordianBody.innerHTML = "";
        if (fieldsToggleLink) {
            //debug("Adding the toggle link to the body");
            accordianBody.appendChild(fieldsToggleLink);
        }
        function formatInput(key, input, value) {
            if (key.endsWith("Name")) {
                input.className = "field-text-input";
                input.type = "text";
                input.maxLength = 30;
                input.value = value;
            }
            else if (key.endsWith("Text")) {
                input.className = "field-text-input";
                input.type = "text";
                input.maxLength = 50;
                input.value = value;
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
                input.maxLength = MAX_INTEGER_LENGTH;
                input.pattern = "\\d+";
                input.value = Math.round(parseFloat(value)).toString();
                input.oninput = () => {
                    input.value = input.value.replace(/\D/g, "").slice(0, MAX_INTEGER_LENGTH);
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
                // Deal with this later
            }
            else if (key.endsWith("field867Type")) {
                // Deal with this later
            }
            else {
                // 🟢 **Default: Currency Field (if no other condition matched)**
                input.type = "text";
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
        }
        function createFieldRow(container, key, value, isMainField = false) {
            // Skip fields already displayed in the header
            if (excludedHeaderFields.includes(key))
                return;
            const fieldRow = document.createElement("div");
            fieldRow.className = "field-row";
            let fieldLabel = document.createElement("label");
            fieldLabel.textContent = getFriendlyName(key);
            fieldLabel.className = "field-labelx";
            fieldRow.appendChild(fieldLabel);
            const fieldId = `field-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
            fieldLabel.setAttribute("for", fieldId);
            // For readOnlyFields, just create a label with the value
            if (readOnlyFields.includes(key)) {
                const valueLabel = document.createElement("label");
                valueLabel.textContent = value || "";
                valueLabel.className = "read-only-field-value";
                valueLabel.setAttribute("data-field-name", key);
                valueLabel.id = fieldId;
                fieldRow.appendChild(valueLabel);
                container.appendChild(fieldRow);
                return;
            }
            if (key.endsWith("Options")) {
                const controls = document.createElement("div");
                controls.setAttribute("data-field-name", key);
                controls.id = fieldId;
                const options = getFriendlyOptions(key);
                options.forEach((option) => {
                    const radioButton = document.createElement("input");
                    const label = document.createElement("label");
                    radioButton.type = "radio";
                    radioButton.value = option;
                    const name = getFriendlyOptionName(key);
                    radioButton.name = name;
                    radioButton.id = name + option;
                    radioButton.checked = value === option;
                    label.appendChild(radioButton);
                    label.appendChild(document.createTextNode(option));
                    controls.appendChild(label);
                });
                fieldRow.appendChild(controls);
            }
            else if (key.endsWith("field867Type")) {
                // Create a dropdown with the options
                const dropdown = document.createElement("select");
                dropdown.className = "form-select";
                dropdown.id = fieldId;
                dropdown.name = key;
                dropdown.setAttribute("data-field-name", key);
                dropdown.appendChild(document.createTextNode(value));
                // Add options to the dropdown from the configuration data
                const formDetails = configurationData.formTypes.find((form) => form.formType === fileData.type);
                formDetails.fieldTypes?.forEach((option) => {
                    const optionElement = document.createElement("option");
                    optionElement.value = option;
                    let optionText = getFriendlyName(option);
                    if (option.includes("_")) {
                        // Field code from friendlyNames[key]. It is the text after the underscore.
                        optionText += " (" + option.split("_")[1] + ")";
                    }
                    optionElement.appendChild(document.createTextNode(optionText));
                    dropdown.appendChild(optionElement);
                });
                // Select the option that is currently selected
                dropdown.value = value;
                fieldRow.appendChild(dropdown);
            }
            else {
                let input = document.createElement("input");
                input.className = "field-input";
                input.setAttribute("data-field-name", key);
                // Associate the input with a unique ID and connect it to the label so that screen readers can read the label when the input is focused.
                input.id = fieldId;
                // 🟢 **Apply Field Formatting Rules**
                formatInput(key, input, value);
                fieldRow.appendChild(input);
            }
            if (key.includes("_")) {
                // Field code from friendlyNames[key]. It is the text after the underscore.
                const fieldCode = key.split("_")[1];
                const codeLabel = document.createElement("label");
                codeLabel.textContent = fieldCode;
                codeLabel.className = "codeLabel";
                codeLabel.htmlFor = fieldId;
                fieldRow.appendChild(codeLabel);
            }
            container.appendChild(fieldRow);
        }
        function currencyEventListener(input) {
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
        function populateField(container, key, value) {
            // Find the field in the container
            const field = container.querySelector(`input[data-field-name="${key}"]`);
            if (field) {
                formatInput(key, field, value);
            }
        }
        // Process main fields (thicker border)
        Object.entries(fileData).forEach(([key, value]) => {
            if (key !== "fields" && key !== "genericFields" && key !== "children") {
                createFieldRow(accordianBody, key, value, true);
            }
        });
        // If it is an 867 form and we are not on mobile we render according to the template
        if (fileData.documentType === "טופס 867" && window.innerWidth > 768 && withAllFields) {
            // Clone template_867_2022
            const template = document.getElementById(template867YearsMap[fileData.taxYear]);
            const clone = template.cloneNode(true);
            clone.id = "";
            // Populate the clone with the fileData
            Object.entries(fileData.fields || {}).forEach(([key, value]) => {
                populateField(clone, key, value);
            });
            clone.removeAttribute("hidden");
            accordianBody.appendChild(clone);
        }
        else {
            // Process nested fields inside `fileData.fields` (thinner border)
            Object.entries(fileData.fields || {}).forEach(([key, value]) => {
                createFieldRow(accordianBody, key, value, false);
            });
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
        function renderItemArray(itemArray, accordianBody, title, addButtonLabel, itemTemplate) {
            if (itemArray) {
                // Title for the children or generic fields with a control button before the title, that adds a new item.
                const titleElement = document.createElement("div");
                titleElement.textContent = title;
                titleElement.className = "item-title";
                accordianBody.appendChild(titleElement);
                // Add a button to add a new item on the same line as the title
                const addButton = document.createElement("button");
                addButton.textContent = addButtonLabel;
                addButton.className = "add-item-button";
                accordianBody.appendChild(addButton);
                addButton.onclick = () => {
                    itemArray.push(itemTemplate);
                    // Re-render the fields
                    renderFields(fileData, accordianBody);
                };
                // Process child or generic fields inside `data` (thinner border)
                let itemCount = 0;
                itemArray.forEach((item, index) => {
                    itemCount++;
                    // Title and container for the item
                    const itemContainer = document.createElement("div");
                    itemContainer.className = "item-container";
                    const itemTitleText = document.createElement("span");
                    itemTitleText.textContent = title + " " + itemCount;
                    itemTitleText.className = "item-title-text";
                    itemContainer.appendChild(itemTitleText);
                    // Add remove button
                    const removeButton = document.createElement("button");
                    removeButton.textContent = "X";
                    removeButton.className = "remove-item-button";
                    removeButton.onclick = () => {
                        itemArray.splice(index, 1);
                        // Re-render the fields
                        renderFields(fileData, accordianBody);
                    };
                    itemContainer.appendChild(removeButton);
                    accordianBody.appendChild(itemContainer);
                    Object.entries(item).forEach(([key, value]) => {
                        createFieldRow(itemContainer, key, value, false);
                    });
                });
            }
        }
        // Call the function for children
        renderItemArray(fileData.children, accordianBody, "ילדים", "הוספת ילד", Child);
        // Call the function for generic fields
        renderItemArray(fileData.genericFields, accordianBody, "שדות גנריים", "הוספת שדה גנרי", Generic867Item);
        // Re-add the action buttons
        buttonsArray.forEach((button) => {
            accordianBody.appendChild(button);
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
            const captionElement = document.createElement("div");
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
            }
            else {
                captionsRow.style.display = "flex";
            }
        }
        // Run on page load
        setHeaderVisibility();
        // Update when resizing
        window.addEventListener("resize", setHeaderVisibility);
    }
    /* ********************************** create +_ button ************************************** */
    function displayFileInfoPlusMinusButton(accordionBody, accordionToggleButton) {
        accordionToggleButton.textContent = "▼";
        accordionToggleButton.className = "accordion-toggle-button";
        accordionToggleButton.onclick = () => {
            accordionBody.style.display = accordionBody.style.display === "none" ? "block" : "none";
            accordionToggleButton.textContent = accordionToggleButton.textContent === "▼" ? "▲" : "▼";
        };
    }
    /* ********************************** create header input (Responsive) ************************************** */
    function displayFileInfoLineError(headerFieldsContainer, fileData) {
        // If it is an error document type
        const fileName = { name: fileData.fileName, size: 0, path: fileData.path };
        const fileInfoElement = document.createElement("div");
        fileInfoElement.className = "file-info";
        const fileHeader = document.createElement("div");
        fileHeader.className = "file-header";
        const fileNameElement = document.createElement("span");
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
    function displayFileInfoLine(headerFieldsContainer, fileData) {
        // Create a wrapper for the header fields
        const fieldsWrapper = document.createElement("div");
        fieldsWrapper.className = "header-fields-wrapper"; // Used for layout styling
        const createHeaderInput = (value, fieldName, labelText, isEditable = true) => {
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
            input.readOnly = !isEditable;
            const fieldId = `field-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
            input.id = fieldId;
            headerFieldlabel.htmlFor = fieldId; // or label.setAttribute('for', fieldId)
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
    function displayFileInfoDeleteButton(editorDeleteButton, fileData, accordionContainer) {
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
                    const backupFormIndex = backupAllFilesData.findIndex((form) => form.fileId === fileData.fileId);
                    if (backupFormIndex !== -1) {
                        backupAllFilesData.splice(backupFormIndex, 1);
                    }
                    updateButtons(editableFileListHasEntries());
                    fileModifiedActions(editableFileListHasEntries());
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
}
//# sourceMappingURL=editor.js.map