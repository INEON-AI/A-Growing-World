
/* =====================================
   I.N.E.O.N. - Main JavaScript
   ===================================== */

// AI backend address.
// We'll create this backend in a later step.
const API_URL = "/api/chat";

const input = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");
const micButton = document.getElementById("micButton");
const wakeButton = document.getElementById("wakeButton");
const voiceButton = document.getElementById("voiceButton");

const chatBox =
    document.getElementById("log") ||
    document.querySelector(".chatBox");

const statusText = document.getElementById("status");

let history = [];
let voiceEnabled = true;
let wakeEnabled = false;
let awaitingWakeCommand = false;
let recognition = null;
let busy = false;

// ---------- Boot Screen ----------

setTimeout(() => {
    const boot = document.getElementById("bootScreen");
    const dashboard = document.getElementById("dashboard");

    if (boot) boot.style.display = "none";
    if (dashboard) dashboard.style.display = "block";
}, 4000);

// ---------- Theme Selector ----------

const themeSelector = document.getElementById("themeSelector");

const themes = {
    green: "#00ff88",
    blue: "#00bfff",
    purple: "#bb00ff",
    red: "#ff3333",
    gold: "#ffd700"
};

function changeTheme() {
    if (!themeSelector) return;

    const color = themes[themeSelector.value] || themes.green;

    document.documentElement.style.setProperty("--accent", color);
    document.documentElement.style.setProperty(
        "--accent-soft",
        `${color}26`
    );
}

if (themeSelector) {
    themeSelector.addEventListener("change", changeTheme);
    changeTheme();
}

// ---------- Interface Helpers ----------

function setStatus(message, state = "idle") {
    document.body.dataset.state = state;

    if (statusText) {
        statusText.textContent = message;
    }
}

function addMessage(role, message) {
    if (!chatBox) return;

    const bubble = document.createElement("div");

    bubble.className =
        role === "user" ? "userMessage" : "botMessage";

    bubble.textContent = message;

    chatBox.appendChild(bubble);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function speak(message) {
    if (!voiceEnabled || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(message);
    speech.rate = 1;
    speech.pitch = 1;

    window.speechSynthesis.speak(speech);
}

// ---------- Basic Built-in Responses ----------

function basicResponse(message) {
    const q = message.toLowerCase().trim();

    if (/^(hi|hello|hey)\b/.test(q)) {
        return "Hello! I'm I.N.E.O.N. How can I help you today?";
    }

    if (q.includes("your name")) {
        return "My name is I.N.E.O.N., your AI assistant.";
    }

    if (q.includes("what time")) {
        return "The time is " +
            new Date().toLocaleTimeString();
    }

    if (q.includes("what date") || q.includes("today's date")) {
        return "Today is " +
            new Date().toLocaleDateString();
    }

    if (q.includes("what can you do") || q === "help") {
        return "I can respond to basic greetings, tell you the date and time, and connect to my AI backend when it is available.";
    }

    return "My full AI connection isn't available yet. My basic mode is active while we finish setting up the backend.";
}

// ---------- AI Conversation ----------

async function askAI(message) {
    history.push({
        role: "user",
        content: message
    });

    history = history.slice(-20);

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: history
            })
        });

        if (!response.ok) {
            throw new Error("AI service unavailable");
        }

        const data = await response.json();

        if (!data.reply || typeof data.reply !== "string") {
            throw new Error("Invalid AI response");
        }

        history.push({
            role: "assistant",
            content: data.reply
        });

        history = history.slice(-20);

        return data.reply;

    } catch (error) {
        // Basic mode is used until the backend is ready.
        history.pop();
        return basicResponse(message);
    }
}

// ---------- Send Message ----------

async function sendMessage(message) {
    if (busy || !message.trim()) return;

    busy = true;

    const cleanMessage = message.trim();

    addMessage("user", cleanMessage);

    if (input) input.value = "";

    setStatus("I.N.E.O.N. is thinking...", "thinking");

    const loading = document.createElement("div");
    loading.className = "botMessage";
    loading.textContent = "Thinking...";
    loading.id = "loadingMessage";

    if (chatBox) {
        chatBox.appendChild(loading);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    try {
        const reply = await askAI(cleanMessage);

        if (loading.parentNode) loading.remove();

        addMessage("assistant", reply);

        setStatus("Ready", "speaking");
        speak(reply);

    } catch (error) {
        if (loading.parentNode) loading.remove();

        addMessage(
            "assistant",
            "Something went wrong. Please try again."
        );

        setStatus("Ready", "idle");

    } finally {
        busy = false;

        if (input) input.focus();
        if (document.body.dataset.state === "speaking") {
            setTimeout(() => setStatus("Ready", "idle"), 1500);
        }
    }
}

// ---------- Text Controls ----------

if (sendButton) {
    sendButton.addEventListener("click", () => {
        sendMessage(input ? input.value : "");
    });
}

if (input) {
    input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            sendMessage(input.value);
        }
    });
}

// ---------- Voice Output Toggle ----------

if (voiceButton) {
    voiceButton.addEventListener("click", () => {
        voiceEnabled = !voiceEnabled;

        voiceButton.textContent =
            voiceEnabled ? "🔊 Voice On" : "🔇 Voice Off";

        if (!voiceEnabled && "speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }
    });
}

// ---------- Microphone Input ----------

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = event => {
        const spokenText =
            event.results[event.results.length - 1][0].transcript.trim();

        if (wakeEnabled) {
            if (spokenText.toLowerCase().includes("yo ineon")) {
                awaitingWakeCommand = true;
                setStatus("I'm listening. What do you need?", "listening");
                speak("I'm listening.");
            } else if (awaitingWakeCommand) {
                awaitingWakeCommand = false;
                sendMessage(spokenText);
            }
        } else {
            sendMessage(spokenText);
        }
    };

    recognition.onerror = () => {
        setStatus("Microphone unavailable", "idle");
    };

    recognition.onend = () => {
        if (wakeEnabled) {
            setStatus("Say Yo INEON to begin", "idle");

            setTimeout(() => {
                if (wakeEnabled) {
                    try {
                        recognition.start();
                    } catch (error) {
                        // Recognition may already be starting.
                    }
                }
            }, 500);
        } else {
            setStatus("Ready", "idle");
        }
    };

} else {
    if (micButton) micButton.disabled = true;
    if (wakeButton) wakeButton.disabled = true;
}

if (micButton && recognition) {
    micButton.addEventListener("click", () => {
        if (wakeEnabled) return;

        try {
            setStatus("Listening...", "listening");
            recognition.start();
        } catch (error) {
            setStatus("Microphone is already active", "idle");
        }
    });
}

// ---------- Wake Word ----------

if (wakeButton && recognition) {
    wakeButton.addEventListener("click", () => {
        wakeEnabled = !wakeEnabled;
        awaitingWakeCommand = false;

        wakeButton.textContent =
            wakeEnabled ? "Wake On" : "Wake";

        if (wakeEnabled) {
            setStatus("Say Yo INEON to begin", "listening");

            try {
                recognition.start();
            } catch (error) {
                // Recognition may already be active.
            }

        } else {
            recognition.stop();
            setStatus("Ready", "idle");
        }
    });
}

// ---------- Startup ----------

setStatus("Ready", "idle");
