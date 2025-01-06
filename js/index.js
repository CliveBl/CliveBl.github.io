      // Add these variables at the top of your script
      let cachedQuestions = null;
      let answersMap = {};
      let currentlySelectedTaxYear;

      document.querySelectorAll(".doc-item").forEach((item) => {
        item.addEventListener("mouseenter", () => {
          const docType = item.dataset.docType;
          const details = docDetails[docType];
          if (details) {
            const itemBounds = item.getBoundingClientRect();
            const modalWidth = 300;
            const docDetailsModal = document.getElementById("docDetailsModal");

            // Update modal content
            docDetailsModal.querySelector(".doc-details-title").textContent =
              details.title;
            docDetailsModal.querySelector(".doc-details-body").innerHTML =
              details.sections
                .map(
                  (section) => `
            <h4>${section.title}</h4>
            <p>${section.content}</p>
          `
                )
                .join("");

            // Position vertically aligned with the hovered item
            docDetailsModal.style.top = `${itemBounds.top}px`;

            docDetailsModal.style.display = "block";
          }
        });

        item.addEventListener("mouseleave", () => {
          docDetailsModal.style.display = "none";
        });
      });

      // Add these constants at the start of your script section, after DEBUG
      const API_BASE_URL = "https://localhost:443/api/v1";
      const AUTH_BASE_URL = "https://localhost:443/auth";
      const fetchConfig = {
        credentials: "include",
        mode: "cors",
      };

      // Add this near the top of your script
      const DEBUG = true;

      function debug(...args) {
        if (DEBUG) {
          console.log(...args);
        }
      }

      // Get references to DOM elements
      const fileInput = document.getElementById("fileInput");
      const fileList = document.getElementById("fileList");
      const processButton = document.getElementById("processButton");
      const messageContainer = document.getElementById("messageContainer");
      const messages = [
        "מתחיל בעיבוד המסמכים...",
        "בואק את פורמט הקבצים...",
        "ממת א הוכן...",
        "העיבוד הושלם!",
      ];

      // Add these cookie utility functions at the start of your script
      const cookieUtils = {
        set: function (name, value, days = 7) {
          const d = new Date();
          d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
          const expires = "expires=" + d.toUTCString();
          document.cookie =
            name +
            "=" +
            value +
            ";" +
            expires +
            ";path=/;Secure;SameSite=Strict";
        },

        get: function (name) {
          const nameEQ = name + "=";
          const ca = document.cookie.split(";");
          for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === " ") c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0)
              return c.substring(nameEQ.length, c.length);
          }
          return null;
        },

        delete: function (name) {
          document.cookie =
            name +
            "=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/;Secure;SameSite=Strict";
        },
      };

      // Update the auth token handling
      let authToken = cookieUtils.get("authToken");

      // Update signInAnonymous function
      async function signInAnonymous() {
        try {
          debug("Attempting anonymous sign in...");
          const response = await fetch(`${AUTH_BASE_URL}/signInAnonymous`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            credentials: "include",
            mode: "cors",
          });

          debug("Sign in response:", response.status);

          if (!response.ok) {
			const errorData = await response.json();
			console.log(errorData);	
            throw new Error(`HTTP error! status: ${errorData.detail} ${response.status}`);
          }

          const result = await response.json();
          if (!result.token) {
            throw new Error("No token received");
          }
          authToken = result.token;
          cookieUtils.set("authToken", authToken); // Save token to cookie
          debug("Token received and saved:", authToken);
          return authToken;
        } catch (error) {
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
            body: JSON.stringify({
              email: email,
              password: password,
            }),
          });

          if (!response.ok) {
			const errorData = await response.json();
			console.log(errorData);	
            throw new Error(`HTTP error! status: ${errorData.detail} ${response.status}`);
          }

          const result = await response.json();
          authToken = result.token;
          cookieUtils.set("authToken", authToken); // Save token to cookie
          console.log("Sign in successful");
          return authToken;
        } catch (error) {
          console.error("Sign in failed:", error);
          throw error;
        }
      }

      // Update the sign out function
      function signOut() {
        authToken = null;
        cookieUtils.delete("authToken");

        // Update UI to show logged out state
        const userEmail = document.getElementById("userEmail");
        const loginButton = document.querySelector(".login-button");
        userEmail.textContent = "";
        loginButton.textContent = "התחברות";
        loginButton.classList.remove("logged-in");

        // Clear the file list
        fileList.innerHTML = "";

        // Clear results
        const resultsContainer = document.getElementById("resultsContainer");
        resultsContainer.classList.remove("active");
        document.getElementById("resultsList").innerHTML = "";

		removeAnswersMapFromLocalStorage();
        //addMessage("התנתקת בהצלחה");
      }

      // Add this function to load files with existing token
      async function loadExistingFiles() {
        try {
          console.log("loadExistingFiles");
          const response = await fetch(
            `${API_BASE_URL}/getFilesInfo?customerDataEntryName=Default`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${authToken}`,
                Accept: "application/json",
              },
              ...fetchConfig,
            }
          );

          if (!response.ok) {
			const errorData = await response.json();	
			console.log(errorData);	
            throw new Error(`HTTP error! status: ${errorData.detail} ${response.status}`);
          }

          const fileInfoList = await response.json();
          updateFileList(fileInfoList);

          // Enable all buttons after successful file info retrieval
          document.getElementById("fileInput").disabled = false;
          document.getElementById("folderInput").disabled = false;
          document.getElementById("questionnaireButton").disabled = false;

          // Also enable their labels for better visual feedback
          document
            .querySelectorAll(".custom-file-input label")
            .forEach((label) => {
              label.classList.remove("disabled");
            });
        } catch (error) {
          debug("Failed to load files:", error);
          // Only show message if it's not an auth error
          if (!error.message.includes("Invalid token")) {
            addMessage("שגיאה בטעינת רשימת הקבצים: " + error.message);
          }
          throw error;
        }
      }

      // Update window load event to include cookie consent check
      window.addEventListener("load", async () => {
        // Check if user has already accepted cookies
        const cookiesAccepted = cookieUtils.get("cookiesAccepted");
        if (!cookiesAccepted) {
          document.getElementById("cookieConsent").classList.add("active");
        }

        try {
          // If we have a token, try to use it
          console.log("load");
          if (authToken) {
            await loadExistingFiles();
            await loadResults();
            debug("Successfully loaded files and results with existing token");
          } else {
            // No token, sign in anonymously
            debug("No token found, signing in anonymously");
            await signInAnonymous();
            await loadExistingFiles();
            await loadResults();
          }
          // Load stored tax results
          loadStoredTaxCalculation();
        } catch (error) {
          debug("Error during initialization:", error);
          // If loading files failed, try anonymous sign in
          if (error.message.includes("Invalid token")) {
            debug("Token invalid, signing in anonymously");
            await signInAnonymous();
            await loadExistingFiles();
            await loadResults();
            loadStoredTaxCalculation();
          }
        }
      });

      // Add this helper function at the start of your script
      function isValidFileType(file) {
        const validTypes = ["application/pdf", "image/jpeg", "image/jpg"];
        if (!validTypes.includes(file.type)) {
          return {
            valid: false,
            message: `סוג קובץ לא נתמך - רק קבצי PDF או JPG מותרים. שם הקובץ: ${file.name} (${file.webkitRelativePath})`,
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
        fileList.innerHTML = '';
        fileInfoList.forEach(fileInfo => {
          addFileToList(fileInfo);
        });
        
        // Enable/disable delete all button based on file list
        updateDeleteAllButton();
        // Enable/disable process button based on file list
        updateProcessButton();
      }

      // Add function to update process button state
      function updateProcessButton() {
        document.getElementById("processButton").disabled = fileList.children.length === 0;
      }

      // Update file input handler to always use individual uploads
      fileInput.addEventListener("change", async () => {

          // Filter out invalid files first
		const files = Array.from(fileInput.files);
          const validFiles = files.filter((file) => {

            const validation = isValidFileType(file);
            if (!validation.valid) {
              addMessage(validation.message, "error");
              return false;
            }
            return true;
          });

          if (validFiles.length === 0) {
            return;
          }

		await uploadFilesWithButtonProgress(validFiles, fileInput);
      });

      // Update folder upload handler to always use individual uploads
      folderInput.addEventListener("change", async () => {
        const files = Array.from(folderInput.files);

          // Sort and filter files
          const validFiles = files
            .sort((a, b) => {
              const pathA = a.webkitRelativePath || a.name;
              const pathB = b.webkitRelativePath || b.name;
              return pathA.localeCompare(pathB);
            })
            .filter((file) => {
              if (
                isInGeneratedTaxFormsFolder(
                  file.webkitRelativePath || file.name
                )
              ) {
                return false;
              }

              const validation = isValidFileType(file);
              if (!validation.valid) {
                addMessage(validation.message, "error");
                return false;
              }

              return true;
            });

          if (validFiles.length === 0) {
            return;
          }

		  await uploadFilesWithButtonProgress(validFiles, folderInput);
      });

      // Update the process button handler
      processButton.addEventListener("click", async () => {
        try {
          if (!authToken) {
            await signInAnonymous();
          }

          // Disable button and show spinner
          processButton.disabled = true;
          processButton.classList.add("processing");
          const spinner = document.createElement("span");
          spinner.className = "spinner";
          processButton.appendChild(spinner);

          // Clear previous messages
          messageContainer.innerHTML = "";

          // Show initial processing message
          addMessage("מתחיל בעיבוד המסמכים...", "info");

          const response = await fetch(`${API_BASE_URL}/processFiles`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              customerDataEntryName: "Default",
            }),
          });

          if (!response.ok) {
			const errorData = await response.json();	
			console.log(errorData);	
            throw new Error(`HTTP error! status: ${errorData.detail} ${response.status}`);
          }

          const result = await response.json();
          console.log("Processing response:", result);

          // Handle fatal error if present
          if (result.fatalProcessingError) {
            addMessage("שגיאה קריטית: " + result.fatalProcessingError, "error");
          }

          // Handle warnings if present
          if (
            result.processingWarnings &&
            result.processingWarnings.length > 0
          ) {
            result.processingWarnings.forEach((warning) => {
              addMessage("אזהרה: " + warning, "warning");
            });
          }

          // If no fatal errors, load results
          if (!result.fatalProcessingError) {
            addMessage("טוען תוצאות...", "info");
            // Wait a moment for processing to complete on server
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await loadResults();
            addMessage("העיבוד הושלם", "info");
          }
        } catch (error) {
          console.error("Processing failed:", error);
          addMessage("שגיאה בעיבוד הקבצים: " + error.message, "error");
        } finally {
          // Re-enable button and remove spinner
          processButton.disabled = false;
          processButton.classList.remove("processing");
          const spinner = processButton.querySelector(".spinner");
          if (spinner) {
            processButton.removeChild(spinner);
          }
        }
      });

async function uploadFilesWithButtonProgress(validFiles, button) {
    const buttonLabel = button.nextElementSibling;
    const originalText = buttonLabel.textContent;

    // Disable the upload buttons
    document.getElementById("fileInput").disabled = true;
    document.getElementById("folderInput").disabled = true;

    buttonLabel.innerHTML = "⏳ מעלה...";
    buttonLabel.classList.add("uploading");

    try {
        if (!authToken) {
            await signInAnonymous();
        }

        // Upload files one by one
        await uploadFiles(validFiles);
    } catch (error) {
        console.error("Authentication failed:", error);
        addMessage("שגיאה באימות: " + error.message, "error");
    } finally {
        // Restore button text
        buttonLabel.innerHTML = originalText;
        buttonLabel.classList.remove("uploading");
        button.value = "";

        // Re-enable the upload buttons
        document.getElementById("fileInput").disabled = false;
        document.getElementById("folderInput").disabled = false;

        // Clear all containers
        clearResultsControls();
    }
}

async function uploadFiles(validFiles) {
	for (const file of validFiles) {
		try {
			const formData = new FormData();
			formData.append("file", file);

			const metadata = {
				customerDataEntryName: "Default",
			};
			formData.append(
				"metadata",
				new Blob([JSON.stringify(metadata)], {
					type: "application/json",
				})
			);

			const response = await fetch(`${API_BASE_URL}/uploadFile`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${authToken}`,
				},
				body: formData,
				...fetchConfig,
			});

			const fileInfoList = await response.json();
			console.log("Upload response:", fileInfoList);
			updateFileList(fileInfoList);
		} catch (error) {
			console.error("Upload failed:", error);
			addMessage("שגיאה בהעלאת הקובץ: " + error.message, "error");
		}
	}
	addMessage(`הועלו ${validFiles.length} קבצים בהצלחה`, 'info');
}

      // Update addMessage function to handle message types
      function addMessage(text, type = "info") {
        const messageDiv = document.createElement("div");
        messageDiv.className = "message-item";
        if (type) {
          messageDiv.classList.add(type);
        }

        const messageText = document.createElement("span");
        messageText.className = "message-text";
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
		
		// Scroll to the bottom of the page
		window.scrollTo({
            top: document.body.scrollHeight,
            behavior: "smooth",
          });
      }

      // Add this to your existing script
      const loginButton = document.querySelector(".login-button");
      const loginOverlay = document.getElementById("loginOverlay");
      const closeButton = document.querySelector(".close-button");
      const loginForm = document.querySelector(".login-form");
      const toggleButtons = document.querySelectorAll(".toggle-button");
      const modalTitle = document.getElementById("modalTitle");
      const submitButton = document.getElementById("submitButton");
      const confirmPassword = document.getElementById("confirmPassword");
      const googleButtonText = document.getElementById("googleButtonText");
      const githubButtonText = document.getElementById("githubButtonText");

      loginButton.addEventListener("click", () => {
        if (authToken) {
          signOut();
        } else {
          document.getElementById("loginOverlay").classList.add("active");
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

        // Update UI elements
        modalTitle.textContent = isSignup ? "הרשמה" : "התחברות";
        submitButton.textContent = isSignup ? "הירשם" : "התחבר";
        confirmPassword.style.display = isSignup ? "block" : "none";
        googleButtonText.textContent = isSignup
          ? "הרשמה עם Google"
          : "התחבר עם Google";
        githubButtonText.textContent = isSignup
          ? "הרשמה עם GitHub"
          : "התחבר עם GitHub";

        // Update active toggle button
        toggleButtons.forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.mode === mode);
        });
      }

      // Add click handlers for mode toggle buttons
      toggleButtons.forEach((button) => {
        button.addEventListener("click", () => {
          switchMode(button.dataset.mode);
        });
      });

      // Update the login form submit handler
      document.getElementById("loginForm").addEventListener("submit", async (e) => {
          e.preventDefault();
          const email = document.getElementById("email").value;
          const password = document.getElementById("password").value;

          try {
            // Call the signIn API
            const response = await fetch(`${AUTH_BASE_URL}/signIn`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                email: email,
                password: password,
              }),
              ...fetchConfig,
            });

            if (!response.ok) {
				const errorData = await response.json();
				console.log(errorData);		
              throw new Error("התחברות נכשלה: " + errorData.detail);
            }

            const data = await response.json();

            // Store the token
            authToken = data.token;
            cookieUtils.set("authToken", authToken);

            // Update UI to show logged in user
            const userEmail = document.getElementById("userEmail");
            const loginButton = document.querySelector(".login-button");
            userEmail.textContent = email;
            loginButton.textContent = "התנתק";
            loginButton.classList.add("logged-in");

            // Clear stored tax results
            localStorage.removeItem("taxResults");

            // Clear tax results display
            const taxResultsContainer = document.getElementById("taxResultsContainer");
            const taxCalculationContent = document.getElementById("taxCalculationContent");
            taxResultsContainer.classList.remove("active");
            taxCalculationContent.innerHTML = "";

            // Handle signin
            await loadExistingFiles(); // Load files with new token
            await loadResults();

            //addMessage("התחברת בהצלחה!");
            document.getElementById("loginOverlay").classList.remove("active");
          } catch (error) {
            console.error("Login failed:", error);
            addMessage("שגיאה בהתחברות: " + error.message, "error");
          }
        });

      document.querySelector(".google-login").addEventListener("click", () => {
        console.log("Google login clicked");
      });

      document.querySelector(".github-login").addEventListener("click", () => {
        console.log("GitHub login clicked");
      });

      // Add these functions before the window load event listener
      async function loadResults() {
        try {
          const response = await fetch(
            `${API_BASE_URL}/getResultsInfo?customerDataEntryName=Default`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${authToken}`,
                Accept: "application/json",
              },
              ...fetchConfig,
            }
          );

          if (!response.ok) {
			const errorData = await response.json();	
			console.log(errorData);	
            throw new Error(`HTTP error! status: ${errorData.detail} ${response.status}`);
          }

          const results = await response.json();

          // Clear previous messages
          messageContainer.innerHTML = "";

          // Handle messages if present
          results.forEach((result) => {
            if (result.messages) {
              // Handle fatal error if present
              if (result.messages.fatalProcessingError) {
                addMessage(
                  "שגיאה קריטית: " + result.messages.fatalProcessingError,
                  "error"
                );
              }

              // Handle warnings if present
              if (
                result.messages.processingWarnings &&
                result.messages.processingWarnings.length > 0
              ) {
                result.messages.processingWarnings.forEach((warning) => {
                  addMessage("אזהרה: " + warning, "warning");
                });
              }
            }
          });

          // Display result files
          displayResults(results);
        } catch (error) {
          console.error("Failed to load results:", error);
          // Only show error if it's not an auth error
          if (!error.message.includes("Invalid token")) {
            addMessage("שגיאה בטעינת התוצאות: " + error.message, "error");
          }
        }
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
        } else if (name === "1322") {
          description = `${year}: טופס 1322 - רווח מהון מניירות ערך`;
        } else if (name === "1301") {
          // Data file containing the annual data for uploading to the tax authority when filing the tax return
          description = `${year}: קובץ נתונים שנתיים להעלאה אתר מס הכנסה בזמן הגשת דו"ח שנתי`;
        } else {
          description = `${year}: מסמך נוסף - ` + fileName;
        }

        // Return the description
        return description;
      }

      function displayResults(results) {
        const resultsContainer = document.getElementById("resultsContainer");
        const resultsList = document.getElementById("resultsList");
        resultsList.innerHTML = ""; // Clear existing results

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
            fileDescription.textContent = descriptionFromFileName(
              result.file.fileName
            );

            const downloadButton = document.createElement("button");
            downloadButton.className = "download-button";
            downloadButton.innerHTML = "⬇️ הורדה";
            downloadButton.addEventListener("click", () =>
              downloadResult(result.file.fileName)
            );

            li.appendChild(fileDescription);
            li.appendChild(downloadButton);
            resultsList.appendChild(li);
          }
        });

        if (hasFiles) {
          resultsContainer.classList.add("active");
        } else {
          resultsContainer.classList.remove("active");
        }
      }

      async function downloadResult(fileName) {
        try {
          const response = await fetch(
            `${API_BASE_URL}/downloadResultsFile?fileName=${encodeURIComponent(
              fileName
            )}&customerDataEntryName=Default`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
              ...fetchConfig,
            }
          );

          if (!response.ok) {
			const errorData = await response.json();
			console.log(errorData);	
            throw new Error(`Download failed: ${errorData.detail} ${response.status}`);
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
        } catch (error) {
          console.error("Download failed:", error);
          addMessage("שגיאה בהורדת הקובץ: " + error.message, "error");
        }
      }
	  
      function saveAnswersMapToLocalStorage() {
        if (answersMap) {
		  console.log("saveAnswersMapToLocalStorage");
		  const mapArray = Array.from(answersMap.entries());
          const answersMapJson = JSON.stringify(mapArray);
          localStorage.setItem("answersMap", answersMapJson);
        }
      }

      // Add this function at the global scope
      function hasLocalAnswersMap() {
        return localStorage.getItem("answersMap") !== null;
      }

      // Update the loadAnswersMapFromLocalStorage function
      function loadAnswersMapFromLocalStorage() {
        console.log("loadAnswersMapFromLocalStorage");
        const answersMapJson = localStorage.getItem("answersMap");
        if (answersMapJson) {
          answersMap = new Map(JSON.parse(answersMapJson));
        }
      }

	  function removeAnswersMapFromLocalStorage() {
		console.log("removeAnswersMapFromLocalStorage");
		localStorage.removeItem("answersMap");
		// Delete answersMap
		answersMap = {};
	  }	

      function updateAnswersMapFromControls() {
		console.log("updateAnswersMapFromControls");
        const selectedYear = parseInt(document.getElementById("taxYear").value);
        const yearAnswers = {};

        // Get all question groups
        const questionGroups =
          questionnaireForm.querySelectorAll(".question-group");

        // First collect all answers for current year
        questionGroups.forEach((group) => {
          const controls = group.querySelector(".question-controls");
          const questionName = group.getAttribute("data-question");

          // Get control type from data attribute
          const controlType = controls.getAttribute("data-control-type");
          const isPair = controls.getAttribute("data-is-pair") === "true";

          let answer = "";

          switch (controlType) {
            case "ID":
              if (isPair) {
                const partnerIdField =
                  controls.querySelector('input[name$="_1"]');
                const registeredPartnerIdField =
                  controls.querySelector('input[name$="_2"]');
                answer = `${partnerIdField.value.trim()},${registeredPartnerIdField.value.trim()}`;
              } else {
                const idField = controls.querySelector("input");
                answer = idField.value.trim();
              }
              break;

            case "DATE":
              if (isPair) {
                const partnerDateField =
                  controls.querySelector('input[name$="_1"]');
                const registeredPartnerDateField =
                  controls.querySelector('input[name$="_2"]');
                answer = `${partnerDateField.value.trim()},${registeredPartnerDateField.value.trim()}`;
              } else {
                const dateField = controls.querySelector("input");
                answer = dateField.value.trim();
              }
              break;

            case "NUMERIC":
              if (isPair) {
                const partnerNumField =
                  controls.querySelector('input[name$="_1"]');
                const registeredPartnerNumField =
                  controls.querySelector('input[name$="_2"]');
                const value1 = partnerNumField.value.trim() || "0";
                const value2 = registeredPartnerNumField.value.trim() || "0";
                answer = `${value1},${value2}`;
              } else {
                const numField = controls.querySelector("input");
                answer = numField.value.trim() || "0";
              }
              break;

            case "CHECKBOX":
              if (isPair) {
                const partnerCheckbox =
                  controls.querySelector('input[name$="_1"]');
                const registeredPartnerCheckbox =
                  controls.querySelector('input[name$="_2"]');
                if (
                  registeredPartnerCheckbox.checked &&
                  partnerCheckbox.checked
                ) {
                  answer = "both";
                } else if (registeredPartnerCheckbox.checked) {
                  answer = "registeredPartner";
                } else if (partnerCheckbox.checked) {
                  answer = "partner";
                } else {
                  answer = "none";
                }
              } else {
                const checkbox = controls.querySelector("input");
                answer = checkbox.checked ? "registeredPartner" : "none";
              }
              break;

            case "RADIO":
              // The value can be none or one of two values in the tooltip separated by a colon
              // We need to calculate the answer based on the radio buttons
              // Get the radio buttons by index
              const yesButton = controls.querySelectorAll(
                'input[type="radio"]'
              )[0];
              const noButton = controls.querySelectorAll(
                'input[type="radio"]'
              )[1];
              // Answer is the value of the checked radio button or none
              answer = yesButton.checked
                ? yesButton.value
                : noButton.checked
                ? noButton.value
                : "none";
              break;
          }

		  // Get question from cache
		  const question = cachedQuestions.find(q => q.name === questionName);
		  // Add the answer only if it is different from the default answer.
		  if (answer !== question.defaultAnswer) {
          yearAnswers[questionName] = answer;
		  }
        });

        // Update the Map with the current year's answers
        answersMap.set(selectedYear.toString(), {
          taxYear: selectedYear,
          answers: yearAnswers,
        });
      } // updateAnswersMapFromControls

      async function createQuestionnaire(requiredQuestionsList = []) {
        try {
			console.log("createQuestionnaire");
          if (!authToken) {
            await signInAnonymous();
          }
          // Get the questionnaire container
          const questionnaireContainer = document.getElementById("questionnaireContainer");
          // Get reference to the questionnaire form
          const questionnaireForm = document.getElementById("questionnaireForm");
          if (!questionnaireForm) {
            throw new Error("Questionnaire form not found");
          }

          await loadQuestions();

		  // Get the container to which we will add the dynamic questions container child
		  const questionsContainer = document.getElementById("questionsContainer");
		  // If questionsContainerChild already exists, remove it
		  const questionsContainerChildOld = document.getElementById("questionsContainerChild");
		  if (questionsContainerChildOld) {
			console.log("questionsContainerChildOld found");
			questionsContainer.removeChild(questionsContainerChildOld);
		  }	
          // Create the questions container child to which we will add the question controls.
          const questionsContainerChild = document.createElement("div");
		  questionsContainerChild.id = "questionsContainerChild";
          questionsContainerChild.className = "questions-container";
          questionsContainerChild.innerHTML = ""; // Clear existing questions
          questionsContainer.appendChild(questionsContainerChild);

          await getAnswersMap();

          // Set initial current year
          const endYear = 2023;
          currentlySelectedTaxYear = endYear;

          // Use let for currentYearAnswers since we need to update it
          let yearAnswers = answersMap.get(currentlySelectedTaxYear.toString());
          let currentYearAnswers = yearAnswers?.answers || {};

          // Populate year selector
          const yearSelect = document.getElementById("taxYear");
          yearSelect.innerHTML = "";

          // Add supported years (2017-2023)
          for (let year = endYear; year >= 2017; year--) {
            const option = document.createElement("option");
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
          }

          // Set the year selector to match currentlySelectedTaxYear
          yearSelect.value = currentlySelectedTaxYear;
          //console.log('Set year selector to:', currentlySelectedTaxYear); // Debug log

          // Create questions and populate with answers
          cachedQuestions.forEach((question) => {
            const questionGroup = document.createElement("div");
            questionGroup.className = "question-group";
            questionGroup.setAttribute("data-question", question.name);
            questionGroup.setAttribute(
              "data-control-type",
              question.controlType
            );
            questionGroup.setAttribute(
              "data-is-pair",
              question.pair === "PAIR"
            );

            const questionText = document.createElement("div");
            questionText.className = "question-text";
            questionText.textContent = question.text;
			// If the question is in the list of required questions, add a red asterisk to the question text
			if (requiredQuestionsList.includes(question.name)) {
				console.log("Required question.name:", question.name);
				questionText.innerHTML += "<span>*</span>";
				questionText.classList.add('highlight-questions');
			}
            questionGroup.appendChild(questionText);

            const controls = document.createElement("div");
            controls.className = "question-controls";
            controls.setAttribute("data-control-type", question.controlType);
            controls.setAttribute("data-is-pair", question.pair === "PAIR");

            switch (question.controlType) {
              case "ID":
                if (question.pair === "PAIR") {
                  // Create container for pair of inputs
                  const pairContainer = document.createElement("div");
                  pairContainer.className = "id-pair-container";
                  pairContainer.style.display = "flex";
                  pairContainer.style.gap = "10px";

                  // First ID input (registered partner)
                  const idInput1 = document.createElement("div");
                  idInput1.style.flex = "1";

                  const label1 = document.createElement("label");
                  label1.textContent = "בן זוג רשום";
                  label1.style.display = "block";
                  label1.style.marginBottom = "3px";
                  label1.style.fontSize = "0.9em";

                  const idNumberInput = document.createElement("input");
                  idNumberInput.type = "text";
                  idNumberInput.name = question.name + "_1";
                  idNumberInput.pattern = "\\d{9}";
                  idNumberInput.maxLength = 9;
                  idNumberInput.placeholder = "הכנס 9 ספרות";
                  idNumberInput.style.direction = "ltr";
                  idNumberInput.style.textAlign = "left";
                  idNumberInput.style.width = "120px";
                  idNumberInput.style.padding = "4px 8px";

                  // Second ID input (partner)
                  const idInput2 = document.createElement("div");
                  idInput2.style.flex = "1";

                  const label2 = document.createElement("label");
                  label2.textContent = "בן/בת זוג";
                  label2.style.display = "block";
                  label2.style.marginBottom = "3px";
                  label2.style.fontSize = "0.9em";

                  const input2 = document.createElement("input");
                  input2.type = "text";
                  input2.name = question.name + "_2";
                  input2.pattern = "\\d{9}";
                  input2.maxLength = 9;
                  input2.placeholder = "הכנס 9 ספרות";
                  input2.style.direction = "ltr";
                  input2.style.textAlign = "left";
                  input2.style.width = "120px";
                  input2.style.padding = "4px 8px";

                  // Add validation to both inputs
                  [idNumberInput, input2].forEach((input) => {
                    input.addEventListener("input", (e) => {
                      e.target.value = e.target.value.replace(/[^\d]/g, "");
                      if (e.target.value.length > 9) {
                        e.target.value = e.target.value.slice(0, 9);
                      }
                    });
                  });

                  idInput1.appendChild(label1);
                  idInput1.appendChild(idNumberInput);
                  idInput2.appendChild(label2);
                  idInput2.appendChild(input2);

                  pairContainer.appendChild(idInput1);
                  pairContainer.appendChild(idInput2);
                  controls.appendChild(pairContainer);
                } else {
                  // Single ID input
                  const idNumberInput = document.createElement("input");
                  idNumberInput.type = "text";
                  idNumberInput.name = question.name;
                  idNumberInput.pattern = "\\d{9}";
                  idNumberInput.maxLength = 9;
                  idNumberInput.placeholder = "הכנס 9 ספרות";
                  idNumberInput.style.direction = "ltr";
                  idNumberInput.style.textAlign = "left";
                  idNumberInput.style.width = "120px";
                  idNumberInput.style.padding = "4px 8px";

                  idNumberInput.addEventListener("input", (e) => {
                    e.target.value = e.target.value.replace(/[^\d]/g, "");
                    if (e.target.value.length > 9) {
                      e.target.value = e.target.value.slice(0, 9);
                    }
                  });

                  controls.appendChild(idNumberInput);
                }
                break;

              case "CHECKBOX":
                if (question.pair === "PAIR") {
                  // Create container for pair of checkboxes
                  const pairContainer = document.createElement("div");
                  pairContainer.className = "checkbox-pair-container";
                  pairContainer.style.display = "flex";
                  pairContainer.style.gap = "10px";
                  pairContainer.style.whiteSpace = "nowrap"; // Add this

                  // Partner container
                  const partnerContainer = document.createElement("div");
                  partnerContainer.style.flex = "0 0 auto"; // Add this

                  const partnerLabel = document.createElement("label");
                  partnerLabel.textContent = "בן/בת זוג";
                  partnerLabel.style.display = "block";
                  partnerLabel.style.marginBottom = "3px";
                  partnerLabel.style.fontSize = "0.9em";

                  const partnerCheckbox = document.createElement("input");
                  partnerCheckbox.type = "checkbox";
                  partnerCheckbox.name = question.name + "_1";

                  // Registered container
                  const registeredContainer = document.createElement("div");
                  registeredContainer.style.flex = "0 0 auto"; // Add this

                  const registeredLabel = document.createElement("label");
                  registeredLabel.textContent = "בן זוג רשום";
                  registeredLabel.style.display = "block";
                  registeredLabel.style.marginBottom = "3px";
                  registeredLabel.style.fontSize = "0.9em";

                  const registeredCheckbox = document.createElement("input");
                  registeredCheckbox.type = "checkbox";
                  registeredCheckbox.name = question.name + "_2";

                  partnerContainer.appendChild(partnerLabel);
                  partnerContainer.appendChild(partnerCheckbox);
                  registeredContainer.appendChild(registeredLabel);
                  registeredContainer.appendChild(registeredCheckbox);

                  pairContainer.appendChild(partnerContainer);
                  pairContainer.appendChild(registeredContainer);
                  controls.appendChild(pairContainer);
                } else {
                  // Single checkbox
                  const container = document.createElement("div");

                  const label = document.createElement("label");
                  label.textContent = "בן זוג רשום";
                  label.style.display = "block";
                  label.style.marginBottom = "3px";
                  label.style.fontSize = "0.9em";

                  const checkbox = document.createElement("input");
                  checkbox.type = "checkbox";
                  checkbox.name = question.name;

                  container.appendChild(label);
                  container.appendChild(checkbox);
                  controls.appendChild(container);
                }
                break;

              case "NUMERIC":
                if (question.pair === "PAIR") {
                  // Create container for pair of numeric inputs
                  const pairContainer = document.createElement("div");
                  pairContainer.className = "numeric-pair-container";
                  pairContainer.style.display = "flex";
                  pairContainer.style.gap = "10px";

                  // Partner numeric input
                  const partnerContainer = document.createElement("div");
                  partnerContainer.style.flex = "1";

                  const partnerLabel = document.createElement("label");
                  partnerLabel.textContent = "בן/בת זוג";
                  partnerLabel.style.display = "block";
                  partnerLabel.style.marginBottom = "3px";
                  partnerLabel.style.fontSize = "0.9em";

                  const partnerInput = document.createElement("input");
                  partnerInput.type = "number";
                  partnerInput.name = question.name + "_1";
                  partnerInput.style.width = "120px";
                  partnerInput.style.padding = "4px 8px";

                  // Registered partner numeric input
                  const registeredContainer = document.createElement("div");
                  registeredContainer.style.flex = "1";

                  const registeredLabel = document.createElement("label");
                  registeredLabel.textContent = "בן זוג רשום";
                  registeredLabel.style.display = "block";
                  registeredLabel.style.marginBottom = "3px";
                  registeredLabel.style.fontSize = "0.9em";

                  const registeredInput = document.createElement("input");
                  registeredInput.type = "number";
                  registeredInput.name = question.name + "_2";
                  registeredInput.style.width = "120px";
                  registeredInput.style.padding = "4px 8px";

                  partnerContainer.appendChild(partnerLabel);
                  partnerContainer.appendChild(partnerInput);
                  registeredContainer.appendChild(registeredLabel);
                  registeredContainer.appendChild(registeredInput);

                  pairContainer.appendChild(partnerContainer);
                  pairContainer.appendChild(registeredContainer);
                  controls.appendChild(pairContainer);
                } else {
                  // Single numeric input
                  const input = document.createElement("input");
                  input.type = "number";
                  input.name = question.name;
                  input.style.width = "120px";
                  input.style.padding = "4px 8px";
                  controls.appendChild(input);
                }
                break;

              case "DATE":
                if (question.pair === "PAIR") {
                  // Create container for pair of date inputs
                  const dateContainer = document.createElement("div");
                  dateContainer.className = "date-pair-container";
                  dateContainer.style.display = "flex";
                  dateContainer.style.gap = "10px";

                  // First date input (registered partner)
                  const dateInput1 = document.createElement("div");
                  dateInput1.style.flex = "1";

                  const dateLabel1 = document.createElement("label");
                  dateLabel1.textContent = "בן זוג רשום";
                  dateLabel1.style.display = "block";
                  dateLabel1.style.marginBottom = "3px";
                  dateLabel1.style.fontSize = "0.9em";

                  const input1 = document.createElement("input");
                  input1.type = "text";
                  input1.placeholder = "dd/MM/yyyy";
                  input1.pattern = "\\d{2}/\\d{2}/\\d{4}";
                  input1.name = question.name + "_1";

                  // Add input validation and formatting
                  input1.addEventListener("input", formatDateInput);
                  input1.addEventListener("blur", validateDateInput);

                  dateInput1.appendChild(dateLabel1);
                  dateInput1.appendChild(input1);
                  dateContainer.appendChild(dateInput1);

                  // Second date input (partner)
                  const dateInput2 = document.createElement("div");
                  dateInput2.style.flex = "1";

                  const dateLabel2 = document.createElement("label");
                  dateLabel2.textContent = "בן/בת זוג";
                  dateLabel2.style.display = "block";
                  dateLabel2.style.marginBottom = "3px";
                  dateLabel2.style.fontSize = "0.9em";

                  const input2 = document.createElement("input");
                  input2.type = "text";
                  input2.placeholder = "dd/MM/yyyy";
                  input2.pattern = "\\d{2}/\\d{2}/\\d{4}";
                  input2.name = question.name + "_2";

                  // Add input validation and formatting
                  input2.addEventListener("input", formatDateInput);
                  input2.addEventListener("blur", validateDateInput);

                  dateInput2.appendChild(dateLabel2);
                  dateInput2.appendChild(input2);
                  dateContainer.appendChild(dateInput2);

                  controls.appendChild(dateContainer);
                } else {
                  const input = document.createElement("input");
                  input.type = "text";
                  input.placeholder = "dd/MM/yyyy";
                  input.pattern = "\\d{2}/\\d{2}/\\d{4}";
                  input.name = question.name;

                  // Add input validation and formatting
                  input.addEventListener("input", formatDateInput);
                  input.addEventListener("blur", validateDateInput);

                  controls.appendChild(input);
                }
                break;

              case "RADIO":
                const options = question.tooltip.split(":");
                options.forEach((option) => {
                  const label = document.createElement("label");
                  const radio = document.createElement("input");
                  radio.type = "radio";
                  radio.name = question.name;
                  radio.value = option;
                  label.appendChild(radio);
                  label.appendChild(document.createTextNode(option));
                  controls.appendChild(label);
                });
                break;
            }

            questionGroup.appendChild(controls);
            questionsContainerChild.appendChild(questionGroup);

            // After creating all controls for a question, populate with saved answers
            let savedAnswer = currentYearAnswers[question.name];
            if (!savedAnswer) {
              savedAnswer = question.defaultAnswer;
            }
            //console.log(`Attempting to populate ${question.name}:`, savedAnswer); // Debug log

            if (savedAnswer) {
              const controls =
                questionGroup.querySelector(".question-controls");
              //console.log(`Found controls for ${question.name}:`, controls); // Debug log

              const controlType = question.controlType;
              const isPair = question.pair === "PAIR";

              switch (controlType) {
                case "ID":
                  if (isPair) {
                    const [value1, value2] = savedAnswer.split(",");
                    const input1 = controls.querySelector(
                      `input[name="${question.name}_1"]`
                    );
                    const input2 = controls.querySelector(
                      `input[name="${question.name}_2"]`
                    );
                    //console.log(`Found ID inputs for ${question.name}:`, input1, input2); // Debug log
                    if (input1) {
                      input1.value = value1 || "";
                      //console.log(`Set ${question.name}_1 to:`, value1);
                    }
                    if (input2) {
                      input2.value = value2 || "";
                      //console.log(`Set ${question.name}_2 to:`, value2);
                    }
                  } else {
                    const input = controls.querySelector(
                      `input[name="${question.name}"]`
                    );
                    //console.log(`Found single ID input for ${question.name}:`, input); // Debug log
                    if (input) {
                      input.value = savedAnswer;
                      //console.log(`Set ${question.name} to:`, savedAnswer);
                    }
                  }
                  break;

                case "DATE":
                  if (isPair) {
                    const [value1, value2] = savedAnswer.split(",");
                    const input1 = controls.querySelector(
                      `input[name="${question.name}_1"]`
                    );
                    const input2 = controls.querySelector(
                      `input[name="${question.name}_2"]`
                    );
                    if (input1) input1.value = value1 || "";
                    if (input2) input2.value = value2 || "";
                  } else {
                    const input = controls.querySelector(
                      `input[name="${question.name}"]`
                    );
                    if (input) input.value = savedAnswer;
                  }
                  break;

                case "NUMERIC":
                  if (isPair) {
                    const [value1, value2] = savedAnswer.split(",");
                    const input1 = controls.querySelector(
                      `input[name="${question.name}_1"]`
                    );
                    const input2 = controls.querySelector(
                      `input[name="${question.name}_2"]`
                    );
                    if (input1) input1.value = value1 === "0" ? "" : value1;
                    if (input2) input2.value = value2 === "0" ? "" : value2;
                  } else {
                    const input = controls.querySelector(
                      `input[name="${question.name}"]`
                    );
                    if (input)
                      input.value = savedAnswer === "0" ? "" : savedAnswer;
                  }
                  break;

                case "CHECKBOX":
                  if (isPair) {
                    const checkbox1 = controls.querySelector(
                      `input[name="${question.name}_1"]`
                    );
                    const checkbox2 = controls.querySelector(
                      `input[name="${question.name}_2"]`
                    );
                    if (checkbox1)
                      checkbox1.checked =
                        savedAnswer === "partner" || savedAnswer === "both";
                    if (checkbox2)
                      checkbox2.checked =
                        savedAnswer === "registeredPartner" ||
                        savedAnswer === "both";
                  } else {
                    const checkbox = controls.querySelector(
                      `input[name="${question.name}"]`
                    );
                    if (checkbox)
                      checkbox.checked = savedAnswer === "registeredPartner";
                  }
                  break;

                case "RADIO":
                  // The value can be none or one of two values in the tooltip separated by a colon
                  // We need to check if the value is one of the two values or none
                  const options = question.tooltip.split(":");
                  const yesButton = controls.querySelector(
                    `input[value="${options[0]}"]`
                  );
                  const noButton = controls.querySelector(
                    `input[value="${options[1]}"]`
                  );
                  // Clear the radio buttons
                  controls
                    .querySelectorAll('input[type="radio"]')
                    .forEach((radio) => (radio.checked = false));
                  // Check the correct radio button
                  if (yesButton) yesButton.checked = savedAnswer === options[0];
                  if (noButton) noButton.checked = savedAnswer === options[1];
                  break;
              }
            }
          });

          // Add debug logging for the answers map and current year answers
          //console.log('Full answers map:', answersMap);
          //console.log('Current year answers:', currentYearAnswers);

          // Add year change handler to load answers for selected year
          yearSelect.addEventListener("change", () => {
            const selectedYear = parseInt(yearSelect.value);

            // If the selected year is different from the currently selected year
            if (selectedYear !== currentlySelectedTaxYear) {
              // First save current year's answers to the answersMap
              const previousYearAnswers = {};

			  //const questionnaireForm = document.getElementById("questionnaireForm");
              cachedQuestions.forEach((question) => {
                const controls = questionnaireForm.querySelector(
                  `.question-group[data-question="${question.name}"] .question-controls`
                );

                if (controls) {
                  const controlType =
                    controls.getAttribute("data-control-type");
                  const isPair =
                    controls.getAttribute("data-is-pair") === "true";

                  let answer = "";

                  // Get answer from controls using the same logic as form submission
                  switch (controlType) {
                    case "ID":
                      if (isPair) {
                        const input1 = controls.querySelector(
                          `input[name="${question.name}_1"]`
                        );
                        const input2 = controls.querySelector(
                          `input[name="${question.name}_2"]`
                        );
                        answer = `${input1.value.trim()},${input2.value.trim()}`;
                      } else {
                        const input = controls.querySelector(
                          `input[name="${question.name}"]`
                        );
                        answer = input.value.trim();
                      }
                      break;

                    case "DATE":
                      if (isPair) {
                        const input1 = controls.querySelector(
                          `input[name="${question.name}_1"]`
                        );
                        const input2 = controls.querySelector(
                          `input[name="${question.name}_2"]`
                        );
                        answer = `${input1.value.trim()},${input2.value.trim()}`;
                      } else {
                        const input = controls.querySelector(
                          `input[name="${question.name}"]`
                        );
                        answer = input.value.trim();
                      }
                      break;

                    case "NUMERIC":
                      if (isPair) {
                        const input1 = controls.querySelector(
                          `input[name="${question.name}_1"]`
                        );
                        const input2 = controls.querySelector(
                          `input[name="${question.name}_2"]`
                        );
                        const value1 = input1.value.trim() || "0";
                        const value2 = input2.value.trim() || "0";
                        answer = `${value1},${value2}`;
                      } else {
                        const input = controls.querySelector(
                          `input[name="${question.name}"]`
                        );
                        answer = input.value.trim() || "0";
                      }
                      break;

                    case "CHECKBOX":
                      if (isPair) {
                        const partnerCheckbox = controls.querySelector(
                          `input[name="${question.name}_1"]`
                        );
                        const registeredPartnerCheckbox =
                          controls.querySelector(
                            `input[name="${question.name}_2"]`
                          );
                        if (
                          registeredPartnerCheckbox.checked &&
                          partnerCheckbox.checked
                        ) {
                          answer = "both";
                        } else if (registeredPartnerCheckbox.checked) {
                          answer = "registeredPartner";
                        } else if (partnerCheckbox.checked) {
                          answer = "partner";
                        } else {
                          answer = "none";
                        }
                      } else {
                        const checkbox = controls.querySelector(
                          `input[name="${question.name}"]`
                        );
                        answer = checkbox.checked
                          ? "registeredPartner"
                          : "none";
                      }
                      break;

                    case "RADIO":
                      // The value can be none or one of two values in the tooltip separated by a colon
                      // We need to calculate the answer based on the radio buttons
                      const options = question.tooltip.split(":");
                      const yesButton = controls.querySelector(
                        `input[value="${options[0]}"]`
                      );
                      const noButton = controls.querySelector(
                        `input[value="${options[1]}"]`
                      );
                      // Check the correct radio button
                      answer = yesButton.checked
                        ? options[0]
                        : noButton.checked
                        ? options[1]
                        : "none";
                      break;
                  }

                  // Only add the answer if it is not the default answer
                  if (question.defaultAnswer !== answer) {
                    previousYearAnswers[question.name] = answer;
                  }
                }
              });
              // Update answersMap with previous year's answers
              answersMap.set(currentlySelectedTaxYear.toString(), {
                taxYear: currentlySelectedTaxYear,
                answers: previousYearAnswers,
              });

              // Now update controls with selected year's answers
              let selectedYearAnswers;
              const selectedYearEntry = answersMap.get(selectedYear.toString());
              if (selectedYearEntry) {
                selectedYearAnswers = selectedYearEntry.answers;
              }

              // iterate over the questions
              cachedQuestions.forEach((question) => {
                let savedAnswer;
                if (selectedYearAnswers) {
                  savedAnswer = selectedYearAnswers[question.name];
                } else {
                  savedAnswer = question.defaultAnswer;
                }
                // get the controls for the question
                const controls = questionnaireForm.querySelector(
                  `.question-group[data-question="${question.name}"] .question-controls`
                );

                if (controls) {
                  // Update controls using same logic as initial population
                  const controlType =
                    controls.getAttribute("data-control-type");
                  if (savedAnswer) {
                    switch (controlType) {
                      case "ID":
                        if (question.pair === "PAIR") {
                          const [value1, value2] = savedAnswer.split(",");
                          const input1 = controls.querySelector(
                            `input[name="${question.name}_1"]`
                          );
                          const input2 = controls.querySelector(
                            `input[name="${question.name}_2"]`
                          );
                          if (input1) input1.value = value1 || "";
                          if (input2) input2.value = value2 || "";
                        } else {
                          const input = controls.querySelector(
                            `input[name="${question.name}"]`
                          );
                          if (input) input.value = savedAnswer;
                        }
                        break;

                      case "DATE":
                        if (question.pair === "PAIR") {
                          const [value1, value2] = savedAnswer.split(",");
                          const input1 = controls.querySelector(
                            `input[name="${question.name}_1"]`
                          );
                          const input2 = controls.querySelector(
                            `input[name="${question.name}_2"]`
                          );
                          if (input1) input1.value = value1 || "";
                          if (input2) input2.value = value2 || "";
                        } else {
                          const input = controls.querySelector(
                            `input[name="${question.name}"]`
                          );
                          if (input) input.value = savedAnswer;
                        }
                        break;

                      case "NUMERIC":
                        if (question.pair === "PAIR") {
                          const [value1, value2] = savedAnswer.split(",");
                          const input1 = controls.querySelector(
                            `input[name="${question.name}_1"]`
                          );
                          const input2 = controls.querySelector(
                            `input[name="${question.name}_2"]`
                          );
                          if (input1)
                            input1.value = value1 === "0" ? "" : value1;
                          if (input2)
                            input2.value = value2 === "0" ? "" : value2;
                        } else {
                          const input = controls.querySelector(
                            `input[name="${question.name}"]`
                          );
                          if (input)
                            input.value =
                              savedAnswer === "0" ? "" : savedAnswer;
                        }
                        break;

                      case "CHECKBOX":
                        if (question.pair === "PAIR") {
                          const checkbox1 = controls.querySelector(
                            `input[name="${question.name}_1"]`
                          );
                          const checkbox2 = controls.querySelector(
                            `input[name="${question.name}_2"]`
                          );
                          if (checkbox1)
                            checkbox1.checked =
                              savedAnswer === "partner" ||
                              savedAnswer === "both";
                          if (checkbox2)
                            checkbox2.checked =
                              savedAnswer === "registeredPartner" ||
                              savedAnswer === "both";
                        } else {
                          const checkbox = controls.querySelector(
                            `input[name="${question.name}"]`
                          );
                          if (checkbox)
                            checkbox.checked =
                              savedAnswer === "registeredPartner";
                        }
                        break;

                      case "RADIO":
                        // The value can be none or one of two values in the tooltip separated by a colon
                        // We need to check if the value is one of the two values or none
                        const options = question.tooltip.split(":");
                        const yesButton = controls.querySelector(
                          `input[value="${options[0]}"]`
                        );
                        const noButton = controls.querySelector(
                          `input[value="${options[1]}"]`
                        );
                        // Clear the radio buttons
                        controls
                          .querySelectorAll('input[type="radio"]')
                          .forEach((radio) => (radio.checked = false));
                        // Check the correct radio button
                        if (yesButton)
                          yesButton.checked = savedAnswer === options[0];
                        if (noButton)
                          noButton.checked = savedAnswer === options[1];
                        break;
                    }
                  } else {
                    // Clear controls if no saved answer
                    clearControls(controls, controlType);
                  }
                }
              });

              // Update current year tracker
              currentlySelectedTaxYear = selectedYear;
            }
          });

          // Add helper function to clear controls
          function clearControls(controls, controlType) {
            switch (controlType) {
              case "ID":
              case "DATE":
              case "NUMERIC":
                controls
                  .querySelectorAll("input")
                  .forEach((input) => (input.value = ""));
                break;
              case "CHECKBOX":
                controls
                  .querySelectorAll('input[type="checkbox"]')
                  .forEach((cb) => (cb.checked = false));
                break;
              case "RADIO":
                controls
                  .querySelectorAll('input[type="radio"]')
                  .forEach((radio) => (radio.checked = false));
                break;
            }
          }

          // Show questionnaire dialog
          showQuestionaire();
		  localStorage.setItem("questionnaireExists", "true");

        } catch (error) {
          console.error("Failed to load questionnaire:", error);
          addMessage("שגיאה בטעינת השאלון: " + error.message, "error");
        }
      } // createQuestionnaire
      // Add this after the other button references
      const deleteAllButton = document.getElementById("deleteAllButton");

      // Update delete all handler - remove confirmation dialog
      deleteAllButton.addEventListener("click", async () => {
        try {
          if (!authToken) {
            await signInAnonymous();
          }

          const response = await fetch(
            `${API_BASE_URL}/deleteAllFiles?customerDataEntryName=Default`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
              ...fetchConfig,
            }
          );

          if (!response.ok) {
			const errorData = await response.json();	
			console.log(errorData);	
            throw new Error(`Delete failed: ${errorData.detail} ${response.status}`);
          }

          // Clear the file list
          fileList.innerHTML = "";
          // Disable delete all button since list is now empty
          updateDeleteAllButton();
          // Disable process button since list is now empty
          updateProcessButton();

          // Clear all containers
          clearResultsControls();

          addMessage("כל הקבצים נמחקו בהצלחה");
        } catch (error) {
          console.error("Delete all failed:", error);
          addMessage("שגיאה במחיקת הקבצים: " + error.message, "error");
        }
      });

      // Add this with your other event listeners
      document
        .querySelector(".more-info-button")
        .addEventListener("click", function () {
          const content = document.querySelector(".more-info-content");
          const button = this;

          button.classList.toggle("active");
          content.classList.toggle("active");
        });

      // Add this with your other event listeners
      const taxpayerIdInput = document.getElementById("taxpayerId");

      taxpayerIdInput.addEventListener("input", (e) => {
        // Allow only numbers
        e.target.value = e.target.value.replace(/[^\d]/g, "");

        // Limit to 9 digits
        if (e.target.value.length > 9) {
          e.target.value = e.target.value.slice(0, 9);
        }
      });

      // Store taxpayer ID when changed
      taxpayerIdInput.addEventListener("change", () => {
        if (taxpayerIdInput.value.length === 9) {
          localStorage.setItem("taxpayerId", taxpayerIdInput.value);
        }
      });

      // Load saved taxpayer ID on page load
      window.addEventListener("load", () => {
        const savedId = localStorage.getItem("taxpayerId");
        if (savedId) {
          taxpayerIdInput.value = savedId;
        }
      });

      // Save state before the page unloads
      window.addEventListener("beforeunload", () => {
		const questionnaireExists = localStorage.getItem("questionnaireExists");
        if (answersMap && questionnaireExists === "true") {
          updateAnswersMapFromControls();
          saveAnswersMapToLocalStorage();
        }
      });




      // Keep the docDetails object for hover functionality
      const docDetails = {
        form106: {
          title: "טופס 106 - פירוט מלא",
          sections: [
            {
              title: "מה זה טופס 106?",
              content:
                "טופס 106 הוא דיווח שנתי שמנפיק המעסיק לעובד ומפרט את כל התשלומים והניכויים במהלך שנת המס.",
            },
            {
              title: "מתי מקבלים את הטופס?",
              content:
                "המעסיק חייב להנפיק את הטופס עד סוף חודש מרץ בשנה העוקבת לשנת המס.",
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
              content:
                "אישורים שנתיים מהבנקים המפרטים את הרווחים וההפסדים מעסקאות בניירות ערך.",
            },
            {
              title: "מתי מקבלים את האישורים?",
              content:
                "הבנקים מנפיקים את האישורים עד סוף חודש מרץ בשנה העוקבת.",
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
              content:
                "אישור מהרשות המקומית המעיד על מגורים בייוב המזכה בהטבת מס.",
            },
            {
              title: "למה צריך את האישור?",
              content:
                "האישור נדרש כדי לקבל זיכוי ממס הכנסה בהתאם ליישב המגורים.",
            },
          ],
        },
        donations: {
          title: "אישורי תרומות - פירוט מלא",
          sections: [
            {
              title: "מה הם אישורי תרומות?",
              content:
                "אישורים שנתיים מהמוסדות המפרטים את סכומי התרומות למוסדות מוכרים.",
            },
            {
              title: "מתי מקבלים את האישורים?",
              content:
                "המוסדות מנפיקים את האישורים עד סוף חודש מרץ בשנה העוקבת.",
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
        medical: {
          title: "הוצאות רפואיות - פירוט מלא",
          sections: [
            {
              title: "אילו הוצאות רפואיות מוכרות?",
              content:
                "הוצאות רפואיות חריגות, טיפולים, תרופות ואביזרים רפואיים שלא מכוסים על ידי קופת החולים.",
            },
            {
              title: "איזה מסמכים נדרשים?",
              content: `
              - קבלות על הוצאות רפואיות
              - אישורים רפואיים המעידים על הצורך בטיפול
              - אישור על אי-כיסוי מקופת החולים
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
        childcare: {
          title: "הוצאות טיפול בילדים - פירוט מלא",
          sections: [
            {
              title: "אילו הוצאות מוכרות?",
              content:
                "הוצאות עבור מעונות יום, משפחתונים וגני ילדים מוכרים לילדים עד גיל 5.",
            },
            {
              title: "איזה מסמכים נדרשים?",
              content: `
              - קבלות ממעון יום או משפחתון מוכר
              - אישור על רישום הילד למסגרת
              - אישור על הכרה במסגרת על ידי משרד העבודה והרווחה
            `,
            },
          ],
        },
        "national-insurance": {
          title: "ביטוח לאומי - פירוט מלא",
          sections: [
            {
              title: "מהו האישור השנתי מביטוח לאומי?",
              content:
                "אישור שנתי מביטוח לאומי מפרט את כל התשלומים וההחזרים שהתקבלו מביטוח לאומי במהלך השנה.",
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
      };

      // Keep the hover functionality
      document.addEventListener("DOMContentLoaded", () => {
		console.log("DOMContentLoaded 1");
        const docDetailsModal = document.getElementById("docDetailsModal");
        const docDetailsTitle = docDetailsModal.querySelector(".doc-details-title");
        const docDetailsBody = docDetailsModal.querySelector(".doc-details-body");

        // Add hover event listeners for document items
        document.querySelectorAll(".doc-item").forEach((item) => {
          item.addEventListener("mouseenter", () => {
            const docType = item.dataset.docType;
            const details = docDetails[docType];
            if (details) {
              const itemBounds = item.getBoundingClientRect();

              docDetailsTitle.textContent = details.title;
              docDetailsBody.innerHTML = details.sections
                .map(
                  (section) => `
              <h4>${section.title}</h4>
              <p>${section.content}</p>
            `
                )
                .join("");

              docDetailsModal.style.top = `${itemBounds.top}px`;
              docDetailsModal.style.display = "block";
            }
          });

          item.addEventListener("mouseleave", () => {
            docDetailsModal.style.display = "none";
          });
        });
      });

      // Update the questionnaire button click handler
      document.getElementById("questionnaireButton").addEventListener("click", async () => {
          //const questionnaireContainer = document.getElementById("questionnaireContainer");
          const isCurrentlyActive = questionnaireContainer.classList.contains("active");
          
          if (isCurrentlyActive) {
            // Hide questionnaire if it's currently shown
            hideQuestionaire();
          } else {
			// Check if the questionnaire is already created
			if (!document.getElementById("questionsContainerChild")) {
				await createQuestionnaire();
			}
			else {
				showQuestionaire();
			}
          }
        });

      // Make sure the form has an ID and method
      questionnaireForm.setAttribute("method", "post");

      // Close questionnaire on overlay click
    //   questionnaireOverlay.addEventListener("click", (e) => {
    //     if (e.target === questionnaireOverlay) {
    //       closeQuestionaire();
	// 	  removeAnswersMapFromLocalStorage();
    //     }
    //   });

      // Close questionnaire on close button click
    //   questionnaireOverlay.querySelector(".close-button").addEventListener("click", () => {
    //       closeQuestionaire();
    //     });

      // Update the questionnaire form submission handler
      questionnaireForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          updateAnswersMapFromControls();
          // Convert Map to object for JSON serialization
          const answersObject = Object.fromEntries(answersMap);
          const answersMapJson = JSON.stringify(answersObject);

          // Call the API to save answers
          const response = await fetch(`${API_BASE_URL}/setAnswersMap`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              customerDataEntryName: "Default",
              answersMapJson: answersMapJson,
            }),
            ...fetchConfig,
          });

          if (!response.ok) {
			const errorData = await response.json();	
			console.log(errorData);	
            throw new Error(`HTTP error! status: ${errorData.detail} ${response.status}`);
          }

          // Close the questionnaire dialog
		  hideQuestionaire();

          // Show success message
          addMessage("התשובות נשמרו בהצלחה", "info");
        } catch (error) {
          console.error("Failed to save answers:", error);
          addMessage("שגיאה בשמירת התשובות: " + error.message, "error");
        }
      });

function hideQuestionaire() {
	questionnaireContainer.classList.remove("active");
	localStorage.setItem("questionnaireOpen", "false");
}

// Open the questionnaire
function showQuestionaire() {
	questionnaireContainer.classList.add("active");
	localStorage.setItem("questionnaireOpen", "true");
}

function clearResultsControls() {
	const resultsContainer = document.getElementById("resultsContainer");
	const resultsList = document.getElementById("resultsList");
	const messageContainer = document.getElementById("messageContainer");
	const taxResultsContainer = document.getElementById("taxResultsContainer");
	const taxCalculationContent = document.getElementById("taxCalculationContent");

	// Hide containers
	resultsContainer.classList.remove("active");
	taxResultsContainer.classList.remove("active");

	// Clear content
	resultsList.innerHTML = "";
	messageContainer.innerHTML = "";
	taxCalculationContent.innerHTML = "";

	// Clear stored results
	localStorage.removeItem("taxResults");
}

async function getAnswersMap() {
	if (!hasLocalAnswersMap()) {
		// Get the answers map
		const answersResponse = await fetch(
			`${API_BASE_URL}/getAnswersMap?customerDataEntryName=Default`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${authToken}`,
					Accept: "application/json",
				},
				...fetchConfig,
			}
		);

		if (!answersResponse.ok) {
			throw new Error(`HTTP error! status: ${answersResponse.status}`);
		}

		const answersData = await answersResponse.json();
		answersMap = new Map(Object.entries(answersData));
		saveAnswersMapToLocalStorage();
	} else {
		loadAnswersMapFromLocalStorage();
	}
}

async function loadQuestions() {
	if (!cachedQuestions) {
		const response = await fetch(
			`${AUTH_BASE_URL}/getQuestionDefinitions`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${authToken}`,
					Accept: "application/json",
				},
				...fetchConfig,
			}
		);

		if (!response.ok) {
			const errorData = await response.json();	
			console.log(errorData);	
			throw new Error(`HTTP error! status: ${errorData.detail} ${response.status}`);
		}

		cachedQuestions = await response.json();
	}
}

function formatNumber(key, value) {
  if (!isNaN(value)) {
    return `<em>${key}:</em> ${new Intl.NumberFormat(undefined, { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)}`;
  } else {
    return `<em>${key}:</em> ${value}`;
  }
}	

      function addFileToList(fileInfo) {
		let status;
		let statusMessage;
		const fileId = fileInfo.fileId;
		const fileName = { name: fileInfo.fileName, size: 0 }
		if (fileInfo.type === "FormError") {
			status = "error";
			statusMessage = fileInfo.reason;
		} else {
			status = null;
			statusMessage = `זוהה כ-${fileInfo.type} לשנת ${fileInfo.taxYear}`;
		}

        const li = document.createElement("li");
        li.className = "file-item";
        if (status) {
          li.classList.add(status);
        }

        const fileInfoElement = document.createElement("div");
        fileInfoElement.className = "file-info";

        const fileHeader = document.createElement("div");
        fileHeader.className = "file-header";
        fileHeader.style.cursor = 'pointer';

        // Create status icon
        const statusIcon = document.createElement("span");
        statusIcon.className = "status-icon";
        switch (status) {
          case "warning":
            statusIcon.textContent = "⚠️";
            break;
          case "error":
            statusIcon.textContent = "❌";
            break;
          default:
            statusIcon.textContent = "✓";
        }

        const fileNameElement = document.createElement("span");
        fileNameElement.textContent = fileName.path || fileName.name;

        // Add expand/collapse indicator
        const expandIcon = document.createElement("span");
        expandIcon.textContent = "▼";
        expandIcon.style.marginRight = "10px";
        expandIcon.style.transition = "transform 0.3s";
        expandIcon.style.display = "inline-block";

        fileHeader.appendChild(expandIcon);
        fileHeader.appendChild(fileNameElement);
        fileInfoElement.appendChild(fileHeader);
        fileHeader.appendChild(statusIcon);

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
        const excludedFields = ['fileName', 'type', 'taxYear', 'fileId'];
        Object.entries(fileInfo).forEach(([key, value]) => {
          if (!excludedFields.includes(key) && value !== null) {
            // Check if value is an object (embedded field)
            if (value && typeof value === 'object') {
              // Skip if object is empty or has no non-null values
              const hasNonNullValues = Object.values(value).some(v => v !== null);
              if (Object.keys(value).length === 0 || !hasNonNullValues) return;
              
              const fieldGroup = document.createElement("div");
              fieldGroup.className = "field-group";
              fieldGroup.innerHTML = `<strong>${key}:</strong>`;
              
              // Create nested list for embedded fields
              const nestedList = document.createElement("ul");
              nestedList.className = "nested-list";
              
              // Handle arrays of objects
              if (Array.isArray(value)) {
                value.forEach((item, index) => {
                  if (item && typeof item === 'object') {
                    const arrayItem = document.createElement("li");
                    arrayItem.className = "array-item";
                    arrayItem.innerHTML = `<strong>פריט ${index + 1}:</strong>`;
                    
                    const itemList = document.createElement("ul");
                    itemList.className = "nested-list";
                    
                    Object.entries(item).forEach(([itemKey, itemValue]) => {
                        const itemField = document.createElement("li");
                        itemField.className = "nestedListItemField";
                        itemField.innerHTML = formatNumber(itemKey, itemValue);
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
              const field = document.createElement("div");
              field.style.marginBottom = "5px";
              field.innerHTML = `<strong>${key}:</strong> ${value}`;
              accordionContent.appendChild(field);
            }
          }
        });
        
        fileInfoElement.appendChild(accordionContent);
        
        // Add click handler for accordion
        fileHeader.addEventListener('click', (e) => {
          // Don't toggle if clicking delete button
          if (e.target.closest('.delete-button')) return;
          
          const isExpanded = accordionContent.style.display === "block";
          accordionContent.style.display = isExpanded ? "none" : "block";
          expandIcon.style.transform = isExpanded ? "rotate(0deg)" : "rotate(180deg)";
        });

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "🗑️";
        deleteButton.className = "delete-button";
        deleteButton.title = "מחק";
        deleteButton.addEventListener("click", async () => {
          try {
              const response = await fetch(
                `${API_BASE_URL}/deleteFile?fileId=${fileId}&customerDataEntryName=Default`,
                {
                  method: "DELETE",
                  headers: {
                    Authorization: `Bearer ${authToken}`,
                  },
                  ...fetchConfig,
                }
              );

              if (!response.ok) {
				const errorData = await response.json();
				console.log(errorData);	
                throw new Error(`Delete failed: ${errorData.detail} ${response.status}`);
              }

              fileList.removeChild(li);
              // Update delete all button state
              updateDeleteAllButton();
              // Update process button state
              updateProcessButton();

			// Clear all containers
			clearResultsControls();

          } catch (error) {
            console.error("Delete failed:", error);
            addMessage("שגיאה במחיקת הקובץ: " + error.message, "error");
          }
        });

        li.appendChild(fileInfoElement);
        li.appendChild(deleteButton);
        fileList.appendChild(li);
      }

      // Add this with your other event listeners
      document.getElementById("calculateTaxButton").addEventListener("click", async () => {
          try {
            if (!authToken) {
              await signInAnonymous();
            }

            const taxCalcTaxYear = "2023";
            // // Check if we have a taxpaer ID in the answers map for this year
            // const answersMap = JSON.parse(localStorage.getItem('answersMap'));
            // const taxpayerId = answersMap[taxCalcTaxYear]?.answers?.taxpayerId;
            // if (!taxpayerId || taxpayerId.length !== 9) {
            // 	// Get taxpayer ID
            // 	taxpayerId = document.getElementById('taxpayerId').value;
            // 	if (!taxpayerId || taxpayerId.length !== 9) {
            //   		throw new Error('נדרש מספר זהות תקין של 9 ספרות');
            // 	}
            // }
			// Check if required questions have been answered by iterating over the answersMap
			// for taxCalcTaxYear and checking if the answers that exists in the json are not the same
			// as the default values found in the cachedQuestions.
			// If any required question is not answered then add a message.
			//const answersMap = JSON.parse(localStorage.getItem('answersMap'));
			// Get questions from cache or fetch if not cached
			await getAnswersMap();

			await loadQuestions();
			// Returns all questions that have required field equal to REQUIRED
			const requiredQuestions = cachedQuestions.filter(question => question.required === "REQUIRED");
			let requiredQuestionsList = [];
			const yearAnswers = answersMap.get(taxCalcTaxYear);
			const currentYearAnswers = yearAnswers?.answers || {};
			// Check unanswered questions by comparing to the default values.
			requiredQuestions.forEach(question => {
				if (!currentYearAnswers || currentYearAnswers[question.name] === undefined || 
					currentYearAnswers[question.name] === null || 
					currentYearAnswers[question.name] === question.defaultAnswer) {
					console.log("Required question not answered: " + question.name + ":" + currentYearAnswers[question.name] + " " + question.defaultAnswer);
					// the question name to a list of required questions	
					requiredQuestionsList.push(question.name);
				}
			});

			if (requiredQuestionsList.length > 0) {
				// create the questions dialog
				createQuestionnaire(requiredQuestionsList);
				//removeAnswersMapFromLocalStorage();
			}
			else {
            // Show loading overlay
            document.getElementById("loadingOverlay").classList.add("active");
            // Disable calculate button
            document.getElementById("calculateTaxButton").disabled = true;

            const response = await fetch(
              `${API_BASE_URL}/calculateTax?customerDataEntryName=Default`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${authToken}`,
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
                body: JSON.stringify({
                  customerDataEntryName: "Default",
                  taxYear: taxCalcTaxYear,
                }),
                ...fetchConfig,
              }
            );

            if (!response.ok) {
				const errorData = await response.json();
				console.log(errorData);	
              throw new Error(`HTTP error! status: ${errorData.detail} ${response.status}`);
            }

            const result = await response.json();

            // Show success message
            addMessage("חישוב המס הושלם בהצלחה", "info");

            // Store and display results with scroll
            displayTaxCalculation(result, true);
            storeTaxCalculation(result);
          }
          } catch (error) {
            console.error("Calculate tax failed:", error);
            addMessage("שגיאה בחישוב המס: " + error.message, "error");
          } finally {
            // Hide loading overlay
            document
              .getElementById("loadingOverlay")
              .classList.remove("active");
            // Re-enable calculate button
            document.getElementById("calculateTaxButton").disabled = false;
          }
        });

		function updateDeleteAllButton() {
			document.getElementById("deleteAllButton").disabled = fileList.children.length === 0;
		}

      // Add these helper functions for date formatting and validation
      function formatDateInput(e) {
        let value = e.target.value.replace(/\D/g, ""); // Remove non-digits
        if (value.length > 8) value = value.slice(0, 8);

        // Add slashes as the user types
        if (value.length >= 4) {
          value =
            value.slice(0, 2) + "/" + value.slice(2, 4) + "/" + value.slice(4);
        } else if (value.length >= 2) {
          value = value.slice(0, 2) + "/" + value.slice(2);
        }

        e.target.value = value;
      }

      function validateDateInput(e) {
        const value = e.target.value;
        if (!value) return; // Allow empty value

        const parts = value.split("/");
        if (parts.length !== 3) {
          e.target.setCustomValidity("תאריך חייב להיות בפורמט dd/MM/yyyy");
          return;
        }

        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);

        const date = new Date(year, month - 1, day);
        const isValid =
          date &&
          date.getDate() === day &&
          date.getMonth() === month - 1 &&
          date.getFullYear() === year &&
          year >= 1900 &&
          year <= new Date().getFullYear();

        if (!isValid) {
          e.target.setCustomValidity("תאריך לא תקין");
        } else {
          e.target.setCustomValidity("");
        }
      }

      // Add this function to store tax results
      function storeTaxCalculation(results) {
        try {
          localStorage.setItem("taxResults", JSON.stringify(results));
        } catch (error) {
          console.error("Failed to store tax results:", error);
        }
      }

      // Add this function to load stored tax results
      function loadStoredTaxCalculation() {
        try {
          const storedResults = localStorage.getItem("taxResults");
          if (storedResults) {
            const results = JSON.parse(storedResults);
            displayTaxCalculation(results);
          }
        } catch (error) {
          console.error("Failed to load stored tax results:", error);
        }
      }

      // Add this function to display tax results
      function displayTaxCalculation(result, shouldScroll = false) {
        const taxCalculationContent = document.getElementById("taxCalculationContent");
        taxCalculationContent.innerHTML = ""; // Clear existing results

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
        document.getElementById("taxResultsContainer").classList.add("active");

        // Only scroll if explicitly requested (i.e., after calculation)
        if (shouldScroll) {
          window.scrollTo({
            top: document.body.scrollHeight,
            behavior: "smooth",
          });
        }
      }

      // Add cookie consent button handler
      document.getElementById("acceptCookies").addEventListener("click", () => {
        cookieUtils.set("cookiesAccepted", "true", 365); // Cookie expires in 1 year
        document.getElementById("cookieConsent").classList.remove("active");
      });

      // Add this function to initialize auth state
      async function initializeAuthState() {
        const storedToken = cookieUtils.get("authToken");
        if (storedToken) {
          try {
            console.log("initializeAuthState");
            // Verify the token is still valid by making a test request
            const response = await fetch(
              `${API_BASE_URL}/getFilesInfo?customerDataEntryName=Default`,
              {
                method: "GET",
                headers: {
                  Authorization: `Bearer ${storedToken}`,
                  Accept: "application/json",
                },
                ...fetchConfig,
              }
            );

            if (response.ok) {
              // Token is valid, update UI
              authToken = storedToken;
              const userEmail = document.getElementById("userEmail");
              const loginButton = document.querySelector(".login-button");

              // Use jwt-decode to extract email
              const decodedToken = jwt_decode(storedToken);
              userEmail.textContent = decodedToken.email;

              loginButton.textContent = "התנתק";
              loginButton.classList.add("logged-in");
            } else {
              // Token is invalid, clear it
              cookieUtils.delete("authToken");
              authToken = null;
            }
          } catch (error) {
            console.error("Failed to verify stored token:", error);
            cookieUtils.delete("authToken");
            authToken = null;
          }
        }
      }


      // Setup document hover functionality
      function initializeDocumentHovers() {
        const docDetailsModal = document.getElementById("docDetailsModal");
        const docDetailsTitle =
          docDetailsModal.querySelector(".doc-details-title");
        const docDetailsBody =
          docDetailsModal.querySelector(".doc-details-body");

        document.querySelectorAll(".doc-item").forEach((item) => {
          item.addEventListener("mouseenter", () => {
            const docType = item.dataset.docType;
            const details = docDetails[docType];
            if (details) {
              const itemBounds = item.getBoundingClientRect();
              docDetailsTitle.textContent = details.title;
              docDetailsBody.innerHTML = details.sections
                .map(
                  (section) => `
              <h4>${section.title}</h4>
              <p>${section.content}</p>
            `
                )
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
		console.log("DOMContentLoaded 2");

		localStorage.setItem("questionnaireExists", "false");

        await initializeAuthState();
        initializeDocumentHovers();
		restoreSelectedDocTypes();

        // Initialize questionnaire state
        const questionnaireContainer = document.getElementById("questionnaireContainer");
        // const wasQuestionnaireOpen = localStorage.getItem("questionnaireOpen") === "true";
        // if (!wasQuestionnaireOpen) {
        //   hideQuestionaire();
        // }

        // Pre-fill feedback email if user is logged in
        if (authToken) {
          const decodedToken = jwt_decode(authToken);
          if (decodedToken.email) {
            document.getElementById("feedbackEmail").value = decodedToken.email;
            updateFeedbackButtonState();
          }
        }

        // Check if the questionnaire was open or closed last time
        const questionnaireExists = localStorage.getItem("questionnaireExists");
        if (questionnaireExists && questionnaireExists === "true") {
          createQuestionnaire();
        }
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
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              email: email,
              message: message
            }),
            ...fetchConfig
          });

          if (!response.ok) {
			const errorData = await response.json();
			console.log(errorData);
            throw new Error(`Feedback submission failed: ${errorData.detail} ${response.status}`);
          }

          addMessage("תודה על המשוב שלך!", "success");
          // Clear the form
          document.getElementById("feedbackEmail").value = "";
          document.getElementById("feedbackMessage").value = "";
          document.getElementById("privacyAgreement").checked = false;
          updateFeedbackButtonState();
        } catch (error) {
          console.error("Failed to submit feedback:", error);
          addMessage("שגיאה בשליחת המשוב: " + error.message, "error");
        }
      });

      // Add click handlers for document items
      document.querySelectorAll('.doc-item').forEach(item => {
        item.addEventListener('click', () => {
          // Toggle selected state
          item.classList.toggle('selected');
          
          // Update file input state based on selections
        //   const hasSelections = document.querySelectorAll('.doc-item.selected').length > 0;
        //   document.getElementById('fileInput').disabled = !hasSelections;
        //   document.getElementById('folderInput').disabled = !hasSelections;
          
          // Save selection state
          saveSelectedDocTypes();
        });
      });

      // Function to save selected doc types to localStorage
      function saveSelectedDocTypes() {
        const selectedDocs = Array.from(document.querySelectorAll('.doc-item.selected'))
          .map(item => item.dataset.docType);
        localStorage.setItem('selectedDocTypes', JSON.stringify(selectedDocs));
      }

      // Function to restore selected doc types from localStorage
      function restoreSelectedDocTypes() {
        const savedDocs = JSON.parse(localStorage.getItem('selectedDocTypes') || '[]');
        savedDocs.forEach(docType => {
          const docItem = document.querySelector(`.doc-item[data-doc-type="${docType}"]`);
          if (docItem) {
            docItem.classList.add('selected');
          }
        });
        
        // Update file input state based on restored selections
        // const hasSelections = document.querySelectorAll('.doc-item.selected').length > 0;
        // document.getElementById('fileInput').disabled = !hasSelections;
        // document.getElementById('folderInput').disabled = !hasSelections;
      }

      // Restore selections when page loads
    //   document.addEventListener('DOMContentLoaded', () => {
    //     restoreSelectedDocTypes();
    //   });

    //   // Add questionnaire button click handler
    //   document.getElementById('questionnaireButton').addEventListener('click', () => {
    //     const questionnaireContainer = document.getElementById('questionnaireContainer');
    //     questionnaireContainer.classList.add('active');
        
    //     // Create questionnaire if not already created
    //     if (!document.querySelector('.questions-container .question-group')) {
    //       createQuestionnaire();
    //     }
    //   });

