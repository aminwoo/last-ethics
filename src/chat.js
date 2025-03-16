import { sendChatMessage, setChatMessageCallback, getChatMessages } from './network.js';

// Chat UI elements
let chatContainer = null;
let chatMessages = null;
let chatInput = null;
let chatForm = null;

// Chat state
let isChatActive = false;
let isTyping = false;
let displayTimeout = null;
const CHAT_DISPLAY_TIMEOUT = 8000; // Hide chat after 8 seconds of inactivity
const CHAT_FADE_TIMEOUT = 2000; // Start fading chat after 2 seconds of inactivity

/**
 * Initialize the chat interface
 */
export function initializeChat() {
    createChatUI();
    setupChatEvents();
    
    // Set callback for when chat messages are received
    setChatMessageCallback(handleChatMessage);
    
    return {
        sendMessage: sendChatMessage,
        toggleChat: toggleChat,
        isChatActive: () => isChatActive,
        isTyping: () => isTyping
    };
}

/**
 * Create the chat UI elements
 */
function createChatUI() {
    // Create container
    chatContainer = document.createElement('div');
    chatContainer.id = 'chat-container';
    chatContainer.className = 'chat-container chat-hidden';
    
    // Create messages area
    chatMessages = document.createElement('div');
    chatMessages.className = 'chat-messages';
    chatContainer.appendChild(chatMessages);
    
    // Create form with input and button
    chatForm = document.createElement('form');
    chatForm.className = 'chat-form';
    
    chatInput = document.createElement('input');
    chatInput.type = 'text';
    chatInput.className = 'chat-input';
    chatInput.placeholder = 'Type a message...';
    chatInput.maxLength = 200;
    chatForm.appendChild(chatInput);
    
    const sendButton = document.createElement('button');
    sendButton.type = 'submit';
    sendButton.className = 'chat-send-btn';
    sendButton.textContent = 'Send';
    chatForm.appendChild(sendButton);
    
    chatContainer.appendChild(chatForm);
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .chat-container {
            position: absolute;
            bottom: 20px;
            right: 20px;
            width: 300px;
            background-color: rgba(0, 0, 0, 0.7);
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 10px;
            color: white;
            font-family: Arial, sans-serif;
            font-size: 14px;
            z-index: 1000;
            transition: opacity 0.3s ease, transform 0.3s ease;
            display: flex;
            flex-direction: column;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
        }
        
        .chat-messages {
            max-height: 200px;
            overflow-y: auto;
            margin-bottom: 10px;
            padding: 5px;
            display: flex;
            flex-direction: column;
        }
        
        .chat-message {
            margin-bottom: 8px;
            word-wrap: break-word;
            animation: fadeIn 0.3s ease;
        }
        
        .chat-message.system {
            color: #ffcc00;
            font-style: italic;
            font-size: 13px;
        }
        
        .chat-message.self {
            color: #66ffcc;
        }
        
        .chat-message .sender {
            font-weight: bold;
            margin-right: 5px;
        }
        
        .chat-message .timestamp {
            font-size: 10px;
            color: rgba(255, 255, 255, 0.5);
            margin-left: 5px;
        }
        
        .chat-form {
            display: flex;
            gap: 5px;
        }
        
        .chat-input {
            flex: 1;
            background-color: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            padding: 5px 10px;
            color: white;
            outline: none;
        }
        
        .chat-input::placeholder {
            color: rgba(255, 255, 255, 0.5);
        }
        
        .chat-send-btn {
            background-color: rgba(100, 200, 255, 0.7);
            border: none;
            border-radius: 4px;
            padding: 5px 10px;
            color: white;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .chat-send-btn:hover {
            background-color: rgba(100, 200, 255, 0.9);
        }
        
        .chat-hidden {
            opacity: 0.3;
            pointer-events: none;
        }
        
        .chat-active {
            opacity: 1;
            pointer-events: all;
        }
        
        .chat-fading {
            opacity: 0.6;
        }
        
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    
    // Add to document
    document.head.appendChild(style);
    document.body.appendChild(chatContainer);
    
    // Initially populate with existing messages
    refreshChatMessages();
}

/**
 * Set up event handlers for chat interactions
 */
function setupChatEvents() {
    // Submit form
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = chatInput.value.trim();
        
        if (message) {
            sendChatMessage(message);
            chatInput.value = '';
        }
        
        // Keep chat open after sending
        resetChatTimeout();
    });
    
    // Focus/blur events to track typing state
    chatInput.addEventListener('focus', () => {
        isTyping = true;
        // Keep chat open while typing
        clearTimeout(displayTimeout);
        chatContainer.classList.remove('chat-hidden', 'chat-fading');
        chatContainer.classList.add('chat-active');
    });
    
    chatInput.addEventListener('blur', () => {
        isTyping = false;
        // Start timeout to hide chat
        resetChatTimeout();
    });
    
    // Global key handler for toggling chat
    document.addEventListener('keydown', (e) => {
        // T key to open chat
        if (e.key.toLowerCase() === 't' && !isTyping) {
            toggleChat(true);
            e.preventDefault(); // Prevent 't' from being typed in the input
            
            // Focus input after a short delay to ensure it's visible
            setTimeout(() => {
                chatInput.focus();
            }, 10);
        }
        
        // Escape to close chat if active and typing
        if (e.key === 'Escape' && isTyping) {
            chatInput.blur();
            toggleChat(false);
        }
    });
}

/**
 * Toggle chat visibility
 * @param {boolean} show - Whether to show or hide the chat
 */
export function toggleChat(show = null) {
    // If show is null, toggle based on current state
    if (show === null) {
        show = !isChatActive;
    }
    
    isChatActive = show;
    
    if (show) {
        chatContainer.classList.remove('chat-hidden', 'chat-fading');
        chatContainer.classList.add('chat-active');
        resetChatTimeout();
    } else {
        chatContainer.classList.add('chat-hidden');
        chatContainer.classList.remove('chat-active', 'chat-fading');
        isTyping = false;
        chatInput.blur(); // Remove focus from input
    }
    
    return isChatActive;
}

/**
 * Reset the timeout for hiding the chat
 */
function resetChatTimeout() {
    clearTimeout(displayTimeout);
    
    // Don't hide if typing
    if (isTyping) return;
    
    // Start fading after a delay
    displayTimeout = setTimeout(() => {
        // Skip if typing
        if (isTyping) return;
        
        chatContainer.classList.add('chat-fading');
        
        // Then hide after another delay
        displayTimeout = setTimeout(() => {
            // Skip if typing
            if (isTyping) return;
            
            toggleChat(false);
        }, CHAT_FADE_TIMEOUT);
    }, CHAT_DISPLAY_TIMEOUT - CHAT_FADE_TIMEOUT);
}

/**
 * Handle a new chat message received from the server
 * @param {Object} message - The chat message object
 */
function handleChatMessage(message) {
    // Add message to the UI
    addMessageToUI(message);
    
    // Show chat temporarily when new messages arrive
    if (!isTyping) {
        toggleChat(true);
        resetChatTimeout();
    }
}

/**
 * Add a message to the chat UI
 * @param {Object} message - The message to add
 */
function addMessageToUI(message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'chat-message';
    
    // Add appropriate classes
    if (message.isSystem) {
        messageEl.classList.add('system');
    }
    
    if (message.isSelf) {
        messageEl.classList.add('self');
    }
    
    // Format timestamp
    const timestamp = new Date(message.timestamp);
    const timeStr = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Add content
    if (message.isSystem) {
        messageEl.innerHTML = `<span class="message">${message.message}</span> <span class="timestamp">${timeStr}</span>`;
    } else {
        messageEl.innerHTML = `<span class="sender">${message.playerName}:</span> <span class="message">${message.message}</span> <span class="timestamp">${timeStr}</span>`;
    }
    
    // Add to messages container
    chatMessages.appendChild(messageEl);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Refresh the chat messages display with all current messages
 */
function refreshChatMessages() {
    // Clear existing messages
    chatMessages.innerHTML = '';
    
    // Add all messages
    const messages = getChatMessages();
    messages.forEach(message => {
        addMessageToUI(message);
    });
} 