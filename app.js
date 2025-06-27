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

try {
  firebase.initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully");
} catch (err) {
  console.error("Firebase initialization error:", err);
}

const db = firebase.firestore();
const auth = firebase.auth();

// Debug Firestore connection
db.collection('users').limit(1).get()
  .then(snap => {
    console.log(`Firestore test: Found ${snap.size} users`);
  })
  .catch(err => {
    console.error("Firestore connection error:", err);
  });

// Enhanced setupRealTimeListeners
function setupRealTimeListeners() {
  console.log("Setting up listeners...");
  
  // Users collection
  unsubscribeConversations = db.collection('users')
    .orderBy('lastActive', 'desc')
    .limit(50)
    .onSnapshot(
      snapshot => {
        console.log(`Received ${snapshot.size} user documents`);
        
        if (snapshot.empty) {
          renderEmptyState("No conversations found", "Check if users collection exists in Firestore");
          return;
        }

        conversations = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          conversations.push({
            id: doc.id,
            name: data.profileName || `User ${doc.id}`,
            lastMessage: data.lastMessage || "No messages yet",
            lastActive: data.lastActive?.toDate?.() || new Date(),
            businessType: data.lastBusinessType || "unknown",
            status: data.status || "active"
          });
        });
        
        renderConversations();
        
        // Auto-select first conversation if none selected
        if (!selectedConversation && conversations.length > 0) {
          selectConversation(conversations[0].id);
        }
      },
      error => {
        console.error("Users listener error:", error);
        renderEmptyState("Error loading conversations", error.message);
      }
    );
}

// New helper function
function renderEmptyState(title, message) {
  conversationList.innerHTML = `
    <div class="empty-state">
      <i class="fas fa-exclamation-triangle"></i>
      <h3>${title}</h3>
      <p>${message}</p>
      <button id="refresh-btn" class="refresh-button">
        <i class="fas fa-sync-alt"></i> Refresh
      </button>
    </div>
  `;
  
  document.getElementById('refresh-btn')?.addEventListener('click', setupRealTimeListeners);
}

// Initialize the app
function initApp() {
  auth.onAuthStateChanged(user => {
    if (user) {
      console.log("User signed in:", user.email);
      currentUser = user;
      authButton.textContent = 'Sign Out';
      setupRealTimeListeners();
    } else {
      console.log("No user signed in");
      currentUser = null;
      authButton.textContent = 'Sign In';
      clearConversations();
    }
  });


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
            auth.signInWithEmailAndPassword('juniorokovagng@gmail.com', 'mlnkbjvhcgxfzd')
                .catch(error => {
                    console.error('Authentication error:', error);
                    alert('Authentication failed: ' + error.message);
                });
        }
    });

    // Conversation selection
    conversationList.addEventListener('click', (e) => {
        const conversationItem = e.target.closest('.conversation-item');
        if (conversationItem) {
            const phoneNumber = conversationItem.dataset.phone;
            selectConversation(phoneNumber);
        }
    });

    // Message sending
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Transfer/AI buttons
    transferBtn.addEventListener('click', transferToHuman);
    aiBtn.addEventListener('click', switchToAI);
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
                    ...data,
                    // Convert lastActive to Date if it's a timestamp
                    lastActive: data.lastActive?.toDate ? data.lastActive.toDate() : new Date(data.lastActive || Date.now())
                });
            });
            renderConversations();
        }, error => {
            console.error('Conversations listener error:', error);
        });
}

// Select conversation and load messages
function selectConversation(phoneNumber) {
    selectedConversation = phoneNumber;
    
    // Update UI
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.toggle('active', item.dataset.phone === phoneNumber);
    });
    
    const conversation = conversations.find(c => c.id === phoneNumber);
    if (conversation) {
        currentChatName.textContent = conversation.profileName || 'Unknown';
        currentChatNumber.textContent = conversation.id;
        updateUserDetails(conversation);
    } else {
        currentChatName.textContent = phoneNumber;
        currentChatNumber.textContent = phoneNumber;
    }
    
    // Show message input
    messageInputContainer.style.display = 'flex';
    [messageInput, sendButton, transferBtn, aiBtn].forEach(el => el.disabled = false);
    
    // Clear and load messages
    messageContainer.innerHTML = '';
    if (unsubscribeMessages) unsubscribeMessages();
    
    unsubscribeMessages = db.collection('whatsapp_logs')
        .where('from', '==', phoneNumber)
        .orderBy('timestamp', 'asc')
        .onSnapshot(snapshot => {
            messages[phoneNumber] = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                messages[phoneNumber].push({
                    id: doc.id,
                    ...data,
                    // Convert timestamp to Date
                    timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp || Date.now())
                });
            });
            renderMessages(phoneNumber);
        }, error => {
            console.error('Messages listener error:', error);
        });
}

// Render conversations list
function renderConversations() {
    conversationList.innerHTML = conversations.length ? '' : 
        '<div class="empty-state"><p>No conversations found</p></div>';
    
    conversations.forEach(conversation => {
        const lastMessage = conversation.lastMessage || 'No messages yet';
        const lastActiveTime = formatTime(conversation.lastActive);
        
        const conversationItem = document.createElement('div');
        conversationItem.className = `conversation-item ${selectedConversation === conversation.id ? 'active' : ''}`;
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
    if (!messages[phoneNumber]?.length) {
        messageContainer.innerHTML = '<div class="empty-state"><p>No messages in this conversation</p></div>';
        return;
    }
    
    messageContainer.innerHTML = '';
    
    messages[phoneNumber].forEach(msg => {
        const isOutgoing = msg.direction === 'outgoing';
        const messageTime = formatTime(msg.timestamp);
        let messageContent = '';
        
        // Handle different message types from your webhook structure
        if (msg.type === 'text') {
    messageContent =
      msg.text?.body ||
      msg.message?.text?.body ||
      msg.message?.body || // sometimes stored flat
      '[Text]';
} else if (msg.type === 'interactive') {
    const interactive = msg.interactive || msg.message?.interactive;
    if (interactive?.type === 'button_reply') {
        messageContent = `[Button] ${interactive.button_reply?.title || interactive.button_reply?.id}`;
    } else if (interactive?.type === 'list_reply') {
        messageContent = `[List] ${interactive.list_reply?.title || interactive.list_reply?.id}`;
    } else {
        messageContent = `[Interactive] ${JSON.stringify(interactive).slice(0, 100)}...`;
    }
} else if (msg.message) {
    // fallback for unknown structure
    messageContent = `[${msg.type}] ${JSON.stringify(msg.message).slice(0, 100)}...`;
} else {
    messageContent = `[Unknown message type: ${msg.type}]`;
}

        else if (msg.type === 'interactive') {
            const interactive = msg.interactive || msg.message?.interactive;
            if (interactive?.type === 'button_reply') {
                messageContent = `[Button] ${interactive.button_reply?.title || interactive.button_reply?.id}`;
            } 
            else if (interactive?.type === 'list_reply') {
                messageContent = `[List] ${interactive.list_reply?.title || interactive.list_reply?.id}`;
            }
        }
        else if (msg.message) {
            // Fallback to show raw message structure
            messageContent = `[${msg.type}] ${JSON.stringify(msg.message).slice(0, 100)}...`;
        }
        else {
            messageContent = `[Unknown message type: ${msg.type}]`;
        }

        const messageElement = document.createElement('div');
        messageElement.className = `message ${isOutgoing ? 'message-outgoing' : 'message-incoming'}`;
        messageElement.innerHTML = `
            <div class="message-content">${messageContent}</div>
            <div class="message-time">${messageTime}</div>
        `;
        messageContainer.appendChild(messageElement);
    });
    
    messageContainer.scrollTop = messageContainer.scrollHeight;
}

// Update user details panel
function updateUserDetails(conversation) {
    userDetailsContent.style.display = 'block';
    userName.textContent = conversation.profileName || 'Unknown';
    userPhone.textContent = conversation.id;
    lastActive.textContent = formatTime(conversation.lastActive, true);
    businessType.textContent = conversation.lastBusinessType ? 
        conversation.lastBusinessType.replace('biz_', '').replace('_', ' ') : 'Not specified';
    userStatus.textContent = conversation.status || 'active';
    userNotes.value = conversation.notes || '';
}

// Transfer to human agent
function transferToHuman() {
    if (!selectedConversation) return;
    alert(`Conversation with ${selectedConversation} transferred to human agent`);
    transferBtn.disabled = true;
    aiBtn.disabled = false;
}

// Switch to AI mode
function switchToAI() {
    if (!selectedConversation) return;
    alert(`Conversation with ${selectedConversation} switched to AI mode`);
    transferBtn.disabled = false;
    aiBtn.disabled = true;
}

// Save user notes
function saveUserNotes() {
    if (!selectedConversation) return;
    const notes = userNotes.value;
    
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

// Send message (simulated for UI)
function sendMessage() {
    const messageText = messageInput.value.trim();
    if (!messageText || !selectedConversation) return;
    
    // In a real implementation, this would send via your webhook
    console.log("Would send message:", messageText);
    messageInput.value = '';
}

// Helper functions
function formatTime(timestamp, fullDate = false) {
    if (!timestamp) return 'Unknown';
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return fullDate ? date.toLocaleString() : date.toLocaleTimeString();
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

// Initialize the app
document.addEventListener('DOMContentLoaded', initApp);
