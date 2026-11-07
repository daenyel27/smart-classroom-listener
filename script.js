// =====================================
// SMART CLASSROOM LISTENER
// =====================================


// =====================================
// MODEL CONFIGURATION
// =====================================

const MODEL_URL =
    "https://teachablemachine.withgoogle.com/models/FDMYPW5pw/";

const CONFIDENCE_THRESHOLD = 0.65;

let recognizer = null;
let isListening = false;
let isLoading = false;


// =====================================
// HTML ELEMENTS
// =====================================

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

const statusText = document.getElementById("status");
const description = document.getElementById("description");

const detectedSound = document.getElementById("detectedSound");
const confidenceText = document.getElementById("confidence");

const micStatus = document.getElementById("micStatus");
const indicator = document.getElementById("indicator");


// =====================================
// SOUND CLASS CONFIGURATION
// =====================================

const expectedClasses = [
    "School Bell Ringing",
    "Clapping / Palakpak",
    "Background Noise"
];


// =====================================
// UPDATE DETECTION BARS
// =====================================

function updateDetectionBar(name, percentage) {

    const bar = document.getElementById(name + "Bar");
    const value = document.getElementById(name + "Value");

    if (!bar || !value) return;

    const safePercentage = Math.max(
        0,
        Math.min(100, percentage)
    );

    bar.style.width = safePercentage + "%";
    value.textContent = safePercentage.toFixed(1) + "%";
}


// =====================================
// RESET DETECTION BARS
// =====================================

function resetDetectionBars() {

    updateDetectionBar("bell", 0);
    updateDetectionBar("clap", 0);
    updateDetectionBar("noise", 0);

}


// =====================================
// RESET DETECTION DISPLAY
// =====================================

function resetDetection() {

    detectedSound.textContent = "Waiting for sound...";
    confidenceText.textContent = "Confidence: --";

    resetDetectionBars();

}


// =====================================
// LOAD THE TRAINED AI MODEL
// =====================================

async function loadModel() {

    if (recognizer) return;

    if (isLoading) {
        throw new Error("The AI model is currently loading.");
    }

    isLoading = true;

    let newRecognizer = null;

    try {

        statusText.textContent = "Loading AI Model...";
        description.textContent = "Please wait while the model loads.";

        const checkpointURL = MODEL_URL + "model.json";
        const metadataURL = MODEL_URL + "metadata.json";


        // Create Teachable Machine recognizer

        newRecognizer = speechCommands.create(
            "BROWSER_FFT",
            undefined,
            checkpointURL,
            metadataURL
        );


        // Load trained model

        await newRecognizer.ensureModelLoaded();


        // Retrieve model labels

        const labels = newRecognizer.wordLabels();

        console.log("AI Model successfully loaded!");
        console.log("Available classes:", labels);


        // =====================================
        // VALIDATE MODEL CLASSES
        // =====================================

        const hasExactlyThreeClasses =
            labels.length === 3 &&
            expectedClasses.every(
                className => labels.includes(className)
            );

        if (!hasExactlyThreeClasses) {

            throw new Error(
                "Incorrect model classes.\n\n" +
                "Required classes:\n" +
                expectedClasses.join("\n") +
                "\n\nClasses detected:\n" +
                labels.join("\n") +
                "\n\nPlease export and upload the updated three-class model from Teachable Machine."
            );

        }


        // Assign recognizer after successful validation

        recognizer = newRecognizer;

        console.log("All three required classes verified successfully!");

    } catch (error) {

        if (newRecognizer && !recognizer) {
            try {
                newRecognizer.dispose();
            } catch (disposeError) {
                console.error("Model cleanup error:", disposeError);
            }
        }

        throw error;

    } finally {

        isLoading = false;

    }

}


// =====================================
// PROCESS AI PREDICTIONS
// =====================================

function processPrediction(result) {

    if (!recognizer) return;

    const scores = result.scores;
    const labels = recognizer.wordLabels();


    // Find class indexes using their names

    const bellIndex = labels.indexOf("School Bell Ringing");
    const clapIndex = labels.indexOf("Clapping / Palakpak");
    const noiseIndex = labels.indexOf("Background Noise");


    // Verify class indexes

    if (
        bellIndex === -1 ||
        clapIndex === -1 ||
        noiseIndex === -1
    ) {

        console.error("Required class not found in model.");
        return;

    }


    // Get prediction percentages

    const bellScore = scores[bellIndex] * 100;
    const clapScore = scores[clapIndex] * 100;
    const noiseScore = scores[noiseIndex] * 100;


    // Update probability bars

    updateDetectionBar("bell", bellScore);
    updateDetectionBar("clap", clapScore);
    updateDetectionBar("noise", noiseScore);


    // Find highest prediction

    let highestIndex = 0;

    for (let i = 1; i < scores.length; i++) {

        if (scores[i] > scores[highestIndex]) {
            highestIndex = i;
        }

    }


    const highestScore = scores[highestIndex];
    const prediction = labels[highestIndex];


    // Display detected sound

    if (highestScore < CONFIDENCE_THRESHOLD) {

        detectedSound.textContent = "Uncertain Sound";

    } else {

        detectedSound.textContent = prediction;

    }


    // Display confidence percentage

    confidenceText.textContent =
        "Confidence: " +
        (highestScore * 100).toFixed(1) +
        "%";

}


// =====================================
// START MICROPHONE LISTENING
// =====================================

async function startListening() {

    if (isListening || isLoading) return;

    try {

        startBtn.disabled = true;
        stopBtn.disabled = true;

        statusText.textContent = "Loading AI Model...";
        description.textContent = "Preparing microphone and model.";


        // Load model

        await loadModel();


        // Reset previous predictions

        resetDetection();


        // Start microphone recognition

        await recognizer.listen(

            (result) => {
                processPrediction(result);
            },

            {
                probabilityThreshold: 0.50,
                invokeCallbackOnNoiseAndUnknown: true,
                overlapFactor: 0.50
            }

        );


        // Update listening status

        isListening = true;

        statusText.textContent = "Listening...";
        description.textContent =
            "The system is detecting classroom sounds.";

        micStatus.textContent = "Microphone active";

        indicator.classList.add("active");

        startBtn.disabled = true;
        stopBtn.disabled = false;


    } catch (error) {

        console.error("Microphone or model error:", error);


        // Update error information

        statusText.textContent = "Unable to start";

        description.textContent =
            error.message ||
            "Please check your microphone permission and model URL.";


        detectedSound.textContent = "No detection";
        confidenceText.textContent = "Confidence: --";

        micStatus.textContent = "Microphone inactive";

        indicator.classList.remove("active");


        // Stop recognition if it partially started

        if (recognizer && isListening) {

            try {
                await recognizer.stopListening();
            } catch (stopError) {
                console.error("Recognition cleanup error:", stopError);
            }

        }

        isListening = false;

        startBtn.disabled = false;
        stopBtn.disabled = true;

    }

}


// =====================================
// STOP MICROPHONE LISTENING
// =====================================

async function stopListening() {

    if (!recognizer || !isListening) return;

    try {

        await recognizer.stopListening();

    } catch (error) {

        console.error("Error stopping microphone:", error);

    }


    // Update listening state

    isListening = false;


    // Update status

    statusText.textContent = "Microphone stopped";

    description.textContent =
        "Press Start Listening to detect sounds again.";


    // Reset predictions

    resetDetection();


    // Update microphone status

    micStatus.textContent = "Microphone inactive";

    indicator.classList.remove("active");


    // Update buttons

    startBtn.disabled = false;
    stopBtn.disabled = true;

}


// =====================================
// BUTTON EVENT LISTENERS
// =====================================

startBtn.addEventListener("click", startListening);

stopBtn.addEventListener("click", stopListening);


// =====================================
// INITIAL APPLICATION STATE
// =====================================

stopBtn.disabled = true;

resetDetection();