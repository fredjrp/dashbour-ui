// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCDYianIs_dLAI2bpBNRPRXVamHDYOhIcE",
  authDomain: "housingfreeop.firebaseapp.com",
  databaseURL: "https://housingfreeop-default-rtdb.firebaseio.com",
  projectId: "housingfreeop",
  storageBucket: "housingfreeop.appspot.com",
  messagingSenderId: "369472820914",
  appId: "1:369472820914:web:3f189fe62e034bb1a91bab",
  measurementId: "G-E6H9E9DLCP"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// DOM elements
const conversationList = document.getElementById('conversation-list');
const messageContainer = document.getElementById('message-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messageInputContainer = document.getElementById('message-input-container');
const currentChatName = document.getElementById('current-chat-name');
const currentChatNumber = document.getElementById('current-chat-number');
const transferBtn = document.getElementById('transfer-btn');
const aiBtn = document.getElementById('ai-btn');
const authButton = document.getElementById('auth-button');
const userDetailsContent = document.getElementById('user-details-content');
const userName = document.getElementById('user-name');
const userPhone = document.getElementById('user-phone');
const lastActive = document.getElementById('last-active');
const businessType = document.getElementById('business-type');
const userStatus = document.getElementById('user-status');
const userNotes = document.getElementById('user-notes');
const saveNotes = document.getElementById('save-notes');

// State variables
let currentUser = null;
let selectedConversation = null;
let conversations = [];
let messages = {};
let unsubscribeConversations = null;
let unsubscribeMessages = null;

// Initialize the app
function initApp() {
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            authButton.textContent = 'Sign Out';
            setupRealTimeListeners();
        } else {
            currentUser = null;
            authButton.textContent = 'Sign In';
            if (unsubscribeConversations) unsubscribeConversations();
            if (unsubscribeMessages) unsubscribeMessages();
            clearConversations();
        }
    });

    authButton.addEventListener('click', () => {
        if (currentUser) {
            auth.signOut();
        } else {
            auth.signInWithEmailAndPassword('your-email@example.com', 'your-password')
                .catch(error => {
                    console.error('Authentication error:', error);
                    alert('Authentication failed: ' + error.message);
                });
        }
    });

    // Set up event listeners for conversation selection
    conversationList.addEventListener('click', (e) => {
        const conversationItem = e.target.closest('.conversation-item');
        if (conversationItem) {
            const phoneNumber = conversationItem.dataset.phone;
            selectConversation(phoneNumber);
        }
    });

    // Set up send message functionality
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Set up transfer/AI buttons
    transferBtn.addEventListener('click', () => {
        if (selectedConversation) {
            // In a real implementation, this would update Firestore to transfer to human agent
            alert(`Conversation with ${selectedConversation} transferred to human agent`);
            transferBtn.disabled = true;
            aiBtn.disabled = false;
        }
    });

    aiBtn.addEventListener('click', () => {
        if (selectedConversation) {
            // In a real implementation, this would update Firestore to switch to AI mode
            alert(`Conversation with ${selectedConversation} switched to AI mode`);
            transferBtn.disabled = false;
            aiBtn.disabled = true;
        }
    });

    // Set up save notes functionality
    saveNotes.addEventListener('click', saveUserNotes);
}

// Set up real-time Firestore listeners
function setupRealTimeListeners() {
    // Listen for conversations
    unsubscribeConversations = db.collection('users')
        .orderBy('lastActive', 'desc')
        .limit(50)
        .onSnapshot(snapshot => {
            conversations = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                conversations.push({
                    id: doc.id,
                    ...data
                });
            });
            renderConversations();
        }, error => {
            console.error('Conversations listener error:', error);
        });
}

// Select a conversation and load its messages
function selectConversation(phoneNumber) {
    selectedConversation = phoneNumber;
    
    // Update UI
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.phone === phoneNumber) {
            item.classList.add('active');
        }
    });
    
    // Find the conversation data
    const conversation = conversations.find(c => c.id === phoneNumber);
    if (conversation) {
        currentChatName.textContent = conversation.profileName || 'Unknown';
        currentChatNumber.textContent = conversation.id;
        
        // Update user details
        updateUserDetails(conversation);
    } else {
        currentChatName.textContent = phoneNumber;
        currentChatNumber.textContent = phoneNumber;
    }
    
    // Show message input
    messageInputContainer.style.display = 'flex';
    messageInput.disabled = false;
    sendButton.disabled = false;
    transferBtn.disabled = false;
    aiBtn.disabled = false;
    
    // Clear previous messages
    messageContainer.innerHTML = '';
    
    // Unsubscribe from previous message listener
    if (unsubscribeMessages) unsubscribeMessages();
    
    // Subscribe to messages for this conversation
    unsubscribeMessages = db.collection('whatsapp_logs')
        .where('from', '==', phoneNumber)
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            messages[phoneNumber] = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                messages[phoneNumber].push({
                    id: doc.id,
                    ...data
                });
            });
            renderMessages(phoneNumber);
        }, error => {
            console.error('Messages listener error:', error);
        });
}

// Render conversations list
function renderConversations() {
    conversationList.innerHTML = '';
    
    if (conversations.length === 0) {
        conversationList.innerHTML = '<div class="empty-state"><p>No conversations found</p></div>';
        return;
    }
    
    conversations.forEach(conversation => {
        const lastMessage = conversation.lastMessage || 'No messages yet';
        const lastActiveTime = formatTime(conversation.lastActive);
        
        const conversationItem = document.createElement('div');
        conversationItem.className = 'conversation-item';
        if (selectedConversation === conversation.id) {
            conversationItem.classList.add('active');
        }
        conversationItem.dataset.phone = conversation.id;
        
        conversationItem.innerHTML = `
            <div class="conversation-avatar">
                ${conversation.profileName ? conversation.profileName.charAt(0).toUpperCase() : '?'}
            </div>
            <div class="conversation-info">
                <div class="conversation-name">${conversation.profileName || conversation.id}</div>
                <div class="conversation-preview">${truncate(lastMessage, 30)}</div>
            </div>
            <div class="conversation-time">${lastActiveTime}</div>
        `;
        
        conversationList.appendChild(conversationItem);
    });
}

// Render messages for a conversation
function renderMessages(phoneNumber) {
    if (!messages[phoneNumber] || messages[phoneNumber].length === 0) {
        messageContainer.innerHTML = '<div class="empty-state"><p>No messages in this conversation</p></div>';
        return;
    }
    
    messageContainer.innerHTML = '';
    
    messages[phoneNumber].forEach(message => {
        const isOutgoing = message.type === 'outgoing';
        const messageTime = message.timestamp ? formatTime(message.timestamp.toDate()) : 'Just now';
        let messageContent = '';
        
        if (message.type === 'text') {
            messageContent = message.text?.body || 'Empty message';
        } else if (message.type === 'interactive') {
            const interactive = message.interactive;
            if (interactive.type === 'button_reply') {
                messageContent = `[Button] ${interactive.button_reply?.title || interactive.button_reply?.id}`;
            } else if (interactive.type === 'list_reply') {
                messageContent = `[List Selection] ${interactive.list_reply?.title || interactive.list_reply?.id}`;
            } else {
                messageContent = `[Interactive: ${interactive.type}]`;
            }
        } else {
            messageContent = `[${message.type}]`;
        }
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isOutgoing ? 'message-outgoing' : 'message-incoming'}`;
        messageElement.innerHTML = `
            <div class="message-content">${messageContent}</div>
            <div class="message-time">${messageTime}</div>
        `;
        
        messageContainer.appendChild(messageElement);
    });
    
    // Scroll to bottom
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

// Update user details panel
function updateUserDetails(conversation) {
    userDetailsContent.style.display = 'block';
    userName.textContent = conversation.profileName || 'Unknown';
    userPhone.textContent = conversation.id;
    lastActive.textContent = formatTime(conversation.lastActive, true);
    businessType.textContent = conversation.lastBusinessType ? 
        conversation.lastBusinessType.replace('biz_', '').replace('_', ' ') : 'Unknown';
    userStatus.textContent = conversation.status || 'Active';
    
    // Load notes (in a real app, this would come from Firestore)
    userNotes.value = conversation.notes || '';
}

// Save user notes
function saveUserNotes() {
    if (!selectedConversation) return;
    
    const notes = userNotes.value;
    
    // In a real implementation, this would save to Firestore
    db.collection('users').doc(selectedConversation).update({
        notes: notes,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        alert('Notes saved successfully');
    }).catch(error => {
        console.error('Error saving notes:', error);
        alert('Failed to save notes');
    });
}

// Send a message
function sendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText || !selectedConversation) return;
    
    // In a real implementation, this would send via WhatsApp API
    // For now, we'll just simulate it by adding to Firestore
    db.collection('whatsapp_logs').add({
        from: selectedConversation,
        to: 'YOUR_PHONE_NUMBER_ID',
        type: 'text',
        text: { body: messageText },
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        direction: 'outgoing'
    }).then(() => {
        messageInput.value = '';
    }).catch(error => {
        console.error('Error sending message:', error);
        alert('Failed to send message');
    });
}

// Helper functions
function formatTime(timestamp, fullDate = false) {
    if (!timestamp) return 'Unknown';
    
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    
    if (fullDate) {
        return date.toLocaleString();
    }
    
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString();
    }
}

function truncate(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function clearConversations() {
    conversationList.innerHTML = '<div class="empty-state"><p>Sign in to view conversations</p></div>';
    messageContainer.innerHTML = '<div class="empty-state"><p>Select a conversation to view messages</p></div>';
    currentChatName.textContent = 'Select a conversation';
    currentChatNumber.textContent = '';
    userDetailsContent.style.display = 'none';
    messageInputContainer.style.display = 'none';
    transferBtn.disabled = true;
    aiBtn.disabled = true;
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);