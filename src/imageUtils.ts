/**
 * Converts an image to black and white and resizes it if necessary.
 * If the input is not an image, returns the original file.
 * @param {File} file - The input file to process
 * @returns {Promise<File>} - The processed file
 */
export function convertImageToBWAndResize(file: File) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith("image/")) {
            // If not an image, return the original file
            resolve(file);
            return;
        }

        const contrastFactor = 1.2; // Adjust this value to control contrast (1 = no change)
        const maxResolution = 1568;

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject(new Error("Could not get 2D context"));
                return;
            }

            // Set canvas size to match image initially
            canvas.width = img.width;
            canvas.height = img.height;

            // Draw the image on the canvas
            ctx.drawImage(img, 0, 0);

            // Black-and-white conversion with contrast adjustment
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const gray = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
                const adjustedGray = Math.min(255, Math.max(0, (gray - 128) * contrastFactor + 128));
                data[i] = data[i + 1] = data[i + 2] = adjustedGray; // Set R, G, B to adjusted gray
            }
            ctx.putImageData(imageData, 0, 0);

            // Resize the image if its longest edge exceeds maxResolution pixels
            let width = img.width;
            let height = img.height;
            if (Math.max(width, height) > maxResolution) {
                if (width > height) {
                    height *= maxResolution / width;
                    width = maxResolution;
                } else {
                    width *= maxResolution / height;
                    height = maxResolution;
                }
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
            }

            // Convert the processed canvas to a Blob (JPEG format)
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        const convertedFile = new File([blob], file.name, { type: "image/jpeg" });
                        resolve(convertedFile);
                    } else {
                        reject(new Error("Failed to convert canvas to Blob"));
                    }
                },
                "image/jpeg",
                0.95 // Quality setting for JPEG
            );
        };

        img.onerror = (err) => reject(err);

        // Load the image file into the img element
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result;
            if (typeof result === "string") {
                img.src = result;
            } else {
                reject(new Error("Failed to read file as data URL"));
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
} 