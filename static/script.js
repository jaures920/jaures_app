const chat = document.getElementById("chat");
let isNewModeActive = false;
let recognition = null;
let isListening = false;

// Variables de gestion d'historique persistante
let currentChatId = null;
let savedChats = JSON.parse(localStorage.getItem("grek_chats")) || {};

// Injection visuelle des bulles de messages
function addMessage(text, type) {
    const div = document.createElement("div");
    const cssClass = type === "user" ? "user-msg" : "bot-msg";
    div.className = `msg ${cssClass}`;
    div.textContent = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;

    // Sauvegarde en continu dans la structure de données locale
    if (currentChatId && savedChats[currentChatId]) {
        savedChats[currentChatId].messages.push({ text, type });
        localStorage.setItem("grek_chats", JSON.stringify(savedChats));
    }
}

// Configuration SpeechRecognition (Reconnaissance Vocale)
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false; 
    recognition.interimResults = false; 
    recognition.lang = 'fr-FR'; 

    recognition.onresult = (event) => {
        const resultText = event.results[0][0].transcript;
        const messageInput = document.getElementById("messageInput");
        if (resultText) {
            messageInput.value = resultText;
            messageInput.focus();
        }
        toggleMicUI(false);
    };

    recognition.onerror = () => toggleMicUI(false);
    recognition.onend = () => toggleMicUI(false);
}

function toggleVoiceInput() {
    if (!recognition) return alert("Micro non supporté.");
    if (isListening) { recognition.stop(); } 
    else { try { recognition.start(); toggleMicUI(true); } catch (e) { console.error(e); } }
}

function toggleMicUI(listening) {
    isListening = listening;
    const micBtn = document.querySelector(".mic-btn");
    const messageInput = document.getElementById("messageInput");
    if (!micBtn || !messageInput) return;

    if (listening) {
        micBtn.innerText = "🛑"; 
        micBtn.style.background = "rgba(255, 0, 0, 0.4)"; 
        messageInput.placeholder = "Écoute en cours...🎙️";
    } else {
        micBtn.innerText = "🎤";
        micBtn.style.background = "rgba(255, 255, 255, 0.15)";
        messageInput.placeholder = currentChatId ? `Discussion : ${savedChats[currentChatId].title} 🔍` : "Poser votre question 🔍";
    }
}

// Volet de saisie pour la création d'un nouveau fil
function toggleNewMode() {
    const btn = document.getElementById("newModeBtn");
    const nameContainer = document.getElementById("chatNameContainer");
    const nameInput = document.getElementById("chatNameInput");
    isNewModeActive = !isNewModeActive;
    
    if (isNewModeActive) {
        btn.classList.add("active");
        nameContainer.classList.add("visible");
        nameInput.focus();
    } else {
        btn.classList.remove("active");
        nameContainer.classList.remove("visible");
    }
}

// Crée et enregistre la session
function saveChatName() {
    const nameInput = document.getElementById("chatNameInput");
    const chatTitle = nameInput.value.trim();
    if (!chatTitle) return alert("Veuillez saisir un titre valide.");

    const chatId = "chat_" + Date.now();
    savedChats[chatId] = { title: chatTitle, messages: [] };
    localStorage.setItem("grek_chats", JSON.stringify(savedChats));

    currentChatId = chatId;
    chat.innerHTML = "";
    document.getElementById("welcomeMessage").style.display = "none";
    document.getElementById("inputContainer").classList.remove("centered");
    document.getElementById("messageInput").placeholder = `Discussion : ${chatTitle} 🔍`;

    toggleNewMode();
    nameInput.value = "";
    renderHistoryButtons();
}

// Génère la liste des discussions avec le bouton X à l'intérieur
function renderHistoryButtons() {
    const container = document.getElementById("historyContainer");
    if (!container) return;
    container.innerHTML = "";

    Object.keys(savedChats).reverse().forEach(chatId => {
        // 1. Création de la capsule bouton principale
        const btn = document.createElement("button");
        btn.className = "history-btn";
        if (chatId === currentChatId) btn.classList.add("active-chat");
        btn.onclick = () => loadChatSession(chatId);

        // 2. Zone de texte interne
        const textSpan = document.createElement("span");
        textSpan.className = "history-btn-text";
        textSpan.textContent = savedChats[chatId].title;

        // 3. Zone cliquable de la croix ✖
        const deleteSpan = document.createElement("span");
        deleteSpan.className = "delete-chat-icon";
        deleteSpan.innerHTML = "✖";
        deleteSpan.title = "Supprimer cette discussion";
        deleteSpan.onclick = (e) => deleteChatSession(chatId, e);

        // Assemblage imbriqué
        btn.appendChild(textSpan);
        btn.appendChild(deleteSpan);
        container.appendChild(btn);
    });
}

// Supprime définitivement la discussion sélectionnée
function deleteChatSession(chatId, event) {
    if (event) event.stopPropagation(); // Bloque l'ouverture de la discussion
    
    const confirmDelete = confirm(`Frérot, tu veux vraiment supprimer "${savedChats[chatId].title}" ?`);
    if (!confirmDelete) return;

    if (chatId === currentChatId) {
        goToHome();
    }

    delete savedChats[chatId];
    localStorage.setItem("grek_chats", JSON.stringify(savedChats));
    renderHistoryButtons();
}

// Charge un historique existant à l'écran
function loadChatSession(chatId) {
    if (!savedChats[chatId]) return;
    currentChatId = chatId;
    chat.innerHTML = "";

    document.getElementById("welcomeMessage").style.display = "none";
    document.getElementById("inputContainer").classList.remove("centered");
    document.getElementById("messageInput").placeholder = `Discussion : ${savedChats[chatId].title} 🔍`;

    savedChats[chatId].messages.forEach(msg => {
        const div = document.createElement("div");
        const cssClass = msg.type === "user" ? "user-msg" : "bot-msg";
        div.className = `msg ${cssClass}`;
        div.textContent = msg.text;
        chat.appendChild(div);
    });
    chat.scrollTop = chat.scrollHeight;
    renderHistoryButtons();
}

// Communication vers l'API Flask
async function sendMessage() {
    const input = document.getElementById("messageInput");
    const welcome = document.getElementById("welcomeMessage");
    const inputContainer = document.getElementById("inputContainer");
    const text = input.value.trim();

    if (!text) return;

    if (welcome && welcome.style.display !== "none") {
        welcome.style.display = "none";
        inputContainer.classList.remove("centered");
        input.placeholder = "Continuer la conversation 🔍";
    }

    addMessage(text, "user");
    input.value = "";

    try {
        const response = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text })
        });

        const data = await response.json();
        addMessage(data.reply, "bot");

    } catch (error) {
        if (currentChatId) savedChats[currentChatId].messages.pop();
        addMessage("Sah j'ai un bug réseau là, réessaie.", "bot");
    }
}

function openFileExplorer() { document.getElementById("fileInput").click(); }

function handleFileSelect(inputElement) {
    const files = inputElement.files;
    if (files && files.length > 0) {
        const messageInput = document.getElementById("messageInput");
        const welcome = document.getElementById("welcomeMessage");
        const inputContainer = document.getElementById("inputContainer");

        if (welcome && welcome.style.display !== "none") {
            welcome.style.display = "none";
            inputContainer.classList.remove("centered");
            messageInput.placeholder = "Continuer la conversation 🔍";
        }

        messageInput.value = `[Fichier : ${files[0].name}] ` + messageInput.value;
        messageInput.focus();
    }
}

// Nettoie l'interface et retourne au menu central d'origine
function goToHome() {
    chat.innerHTML = ""; 
    isNewModeActive = false;
    currentChatId = null;
    
    const welcome = document.getElementById("welcomeMessage");
    const inputContainer = document.getElementById("inputContainer");
    const input = document.getElementById("messageInput");
    const btn = document.getElementById("newModeBtn");
    
    if (welcome) welcome.style.display = "block"; 
    if (inputContainer) inputContainer.classList.add("centered"); 
    if (btn) btn.classList.remove("active");
    if (input) {
        input.value = ""; 
        input.placeholder = "Poser votre question 🔍";
    }
    renderHistoryButtons();
}

document.addEventListener("DOMContentLoaded", renderHistoryButtons);

document.getElementById("messageInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
});

