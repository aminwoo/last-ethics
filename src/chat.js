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
    
    // Add to document
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