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
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// DOM Elements
const chatsList = document.getElementById('chats-list');
const chatWindowContents = document.getElementById('chat-window-contents');
const messageInput = document.getElementById('message-input');
const chatTitle = document.getElementById('chat-title');
const chatSubtitle = document.getElementById('chat-subtitle');
const chatWindowFooter = document.getElementById('chat-window-footer');
const connectionStatus = document.getElementById('connection-status');
const searchInput = document.getElementById('search-input');
const aiToggleBtn = document.getElementById('ai-toggle-btn');
const settingsModal = document.getElementById('settings-modal');
const contactInfoModal = document.getElementById('contact-info-modal');

// State variables
let currentUser = null;
let selectedChat = null;
let chats = [];
let messages = [];
let unsubscribeChats = null;
let unsubscribeMessages = null;
let aiEnabled = false;

// Initialize the app
function initApp() {
  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      setupRealTimeListeners();
      setupEventListeners();
      updateConnectionStatus(true);
    } else {
      // Handle unauthorized access
      window.location.href = 'login.html';
    }
  });
}

// Set up real-time Firestore listeners
function setupRealTimeListeners() {
  // Listen for chats where current user is a participant
  unsubscribeChats = db.collection('chats')
    .where('participants', 'array-contains', currentUser.uid)
    .orderBy('lastUpdated', 'desc')
    .onSnapshot(snapshot => {
      chats = [];
      snapshot.forEach(doc => {
        const chat = doc.data();
        chats.push({
          id: doc.id,
          ...chat,
          lastUpdated: chat.lastUpdated?.toDate(),
          aiEnabled: chat.aiEnabled || false
        });
      });
      renderChatsList();
    }, error => {
      console.error('Chats listener error:', error);
      updateConnectionStatus(false);
    });
}

// Set up event listeners
function setupEventListeners() {
  // Chat selection
  chatsList.addEventListener('click', (e) => {
    const chatItem = e.target.closest('.chat-tile');
    if (chatItem) {
      selectChat(chatItem.dataset.chatId);
    }
  });

  // Message sending
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && messageInput.value.trim()) {
      sendMessage();
    }
  });

  // AI toggle
  aiToggleBtn.addEventListener('click', toggleAI);

  // Settings button
  document.getElementById('settings-btn').addEventListener('click', openSettings);
  document.querySelector('#settings-modal .close-modal').addEventListener('click', closeSettings);

  // Contact info button
  document.getElementById('contact-info-btn').addEventListener('click', openContactInfo);
  document.querySelector('#contact-info-modal .close-modal').addEventListener('click', closeContactInfo);

  // Other navigation buttons
  document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());
}

// Select a chat and load its messages
function selectChat(chatId) {
  selectedChat = chatId;
  const chat = chats.find(c => c.id === chatId);
  
  // Update UI
  document.querySelectorAll('.chat-tile').forEach(item => {
    item.classList.toggle('active', item.dataset.chatId === chatId);
  });
  
  if (chat) {
    chatTitle.textContent = chat.name || 'Group Chat';
    chatSubtitle.textContent = `${chat.participants.length} participants`;
    document.getElementById('chat-profile-image').src = chat.photoURL || 'https://picsum.photos/id/103/50';
    chatWindowFooter.style.display = 'flex';
    aiEnabled = chat.aiEnabled;
    updateAIToggleButton();
  }
  
  // Load messages
  chatWindowContents.innerHTML = '<div class="loading-state"><p>Loading messages...</p></div>';
  if (unsubscribeMessages) unsubscribeMessages();
  
  unsubscribeMessages = db.collection('chats')
    .doc(chatId)
    .collection('messages')
    .orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
      messages = [];
      snapshot.forEach(doc => {
        const message = doc.data();
        messages.push({
          id: doc.id,
          ...message,
          timestamp: message.timestamp?.toDate()
        });
      });
      renderMessages();
    });
}

// Render chats list
function renderChatsList() {
  if (chats.length === 0) {
    chatsList.innerHTML = '<div class="empty-state"><p>No conversations yet</p></div>';
    return;
  }

  chatsList.innerHTML = '';
  chats.forEach(chat => {
    const lastMessage = chat.lastMessage || 'No messages yet';
    const lastUpdated = formatTime(chat.lastUpdated);
    const unreadCount = chat.unreadCount ? `<span class="unread-badge">${chat.unreadCount}</span>` : '';
    
    const chatItem = document.createElement('div');
    chatItem.className = `chat-tile ${selectedChat === chat.id ? 'active' : ''}`;
    chatItem.dataset.chatId = chat.id;
    chatItem.dataset.chatName = chat.name || '';
    
    chatItem.innerHTML = `
      <img src="${chat.photoURL || 'https://picsum.photos/id/103/50'}" alt="" class="chat-tile-avatar">
      <div class="chat-tile-details">
        <div class="chat-tile-title">
          <span>${chat.name || 'New Chat'}</span>
          <span>${lastUpdated}</span>
        </div>
        <div class="chat-tile-subtitle">
          <span>${truncate(lastMessage, 30)}</span>
          ${unreadCount}
          <span class="chat-tile-menu">
            <img src="icons/pin.svg" alt="" class="pin">
          </span>
        </div>
      </div>
    `;
    chatsList.appendChild(chatItem);
  });
}

// Render messages in chat window
function renderMessages() {
  if (messages.length === 0) {
    chatWindowContents.innerHTML = '<div class="empty-state"><p>No messages in this chat</p></div>';
    return;
  }

  chatWindowContents.innerHTML = '';
  let currentDate = null;

  messages.forEach(msg => {
    // Add date separator if needed
    const messageDate = formatDate(msg.timestamp);
    if (messageDate !== currentDate) {
      currentDate = messageDate;
      const dateElement = document.createElement('div');
      dateElement.className = 'datestamp-container';
      dateElement.innerHTML = `<span class="datestamp">${currentDate}</span>`;
      chatWindowContents.appendChild(dateElement);
    }

    // Create message element
    const isCurrentUser = msg.senderId === currentUser.uid;
    const isAIResponse = msg.isAIResponse || false;
    const isUnresponded = msg.isUnresponded || false;
    
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message-group ${isCurrentUser ? 'current-user' : ''}`;
    
    // Handle interactive messages (buttons)
    let messageContent = msg.text;
    if (msg.type === 'interactive') {
      messageContent = renderInteractiveMessage(msg);
    }
    
    messageElement.innerHTML = `
      ${!isCurrentUser ? `
        <img src="${msg.senderPhotoURL || 'https://picsum.photos/50'}" alt="" class="chat-message-avatar">
      ` : ''}
      <div class="chat-messages">
        <div class="chat-message-container">
          <div class="chat-message chat-message-first">
            ${!isCurrentUser ? `
              <div class="chat-message-sender">
                ${msg.senderName || 'Unknown'}
                ${isAIResponse ? '<span class="ai-tag">AI</span>' : ''}
              </div>
            ` : ''}
            ${messageContent}
            ${isUnresponded ? '<span class="unresponded-tag">!</span>' : ''}
            <span class="chat-message-time">${formatTime(msg.timestamp)}</span>
          </div>
          ${msg.reactions ? renderReactions(msg.reactions) : ''}
        </div>
      </div>
      ${isCurrentUser ? `
        <div class="message-actions">
          <div class="reaction-button">+</div>
        </div>
      ` : ''}
    `;
    chatWindowContents.appendChild(messageElement);
  });

  // Scroll to bottom
  chatWindowContents.scrollTop = chatWindowContents.scrollHeight;
}

// Render interactive message (buttons)
function renderInteractiveMessage(msg) {
  if (!msg.interactive) return msg.text;
  
  if (msg.interactive.type === 'button_reply') {
    return `
      <div class="interactive-message">
        <p>${msg.text}</p>
        <div class="interactive-buttons">
          ${msg.interactive.buttons.map(btn => `
            <button class="interactive-button" data-id="${btn.id}">${btn.title}</button>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  return msg.text;
}

// Render message reactions
function renderReactions(reactions) {
  return `
    <div class="message-reactions">
      ${Object.entries(reactions).map(([emoji, users]) => `
        <span class="reaction">${emoji} ${users.length}</span>
      `).join('')}
    </div>
  `;
}

// Send a new message
function sendMessage() {
  if (!selectedChat || !messageInput.value.trim()) return;

  const messageText = messageInput.value.trim();
  const newMessage = {
    text: messageText,
    senderId: currentUser.uid,
    senderName: currentUser.displayName || 'You',
    senderPhotoURL: currentUser.photoURL,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    status: 'sent',
    isAIResponse: aiEnabled
  };

  // Add to Firestore
  db.collection('chats')
    .doc(selectedChat)
    .collection('messages')
    .add(newMessage)
    .then(() => {
      // Update last message in chat document
      db.collection('chats')
        .doc(selectedChat)
        .update({
          lastMessage: messageText,
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
          aiEnabled: aiEnabled
        });
    });

  messageInput.value = '';
}

// Toggle AI mode
function toggleAI() {
  if (!selectedChat) return;
  
  aiEnabled = !aiEnabled;
  updateAIToggleButton();
  
  // Update in Firestore
  db.collection('chats')
    .doc(selectedChat)
    .update({
      aiEnabled: aiEnabled
    });
}

function updateAIToggleButton() {
  aiToggleBtn.classList.toggle('ai-toggle-on', aiEnabled);
  aiToggleBtn.classList.toggle('ai-toggle-off', !aiEnabled);
}

// Modal functions
function openSettings() {
  // Load user stats
  loadUserStats();
  settingsModal.style.display = 'block';
}

function closeSettings() {
  settingsModal.style.display = 'none';
}

function openContactInfo() {
  if (!selectedChat) return;
  
  // Load contact stats
  loadContactStats();
  contactInfoModal.style.display = 'block';
}

function closeContactInfo() {
  contactInfoModal.style.display = 'none';
}

// Load user statistics
function loadUserStats() {
  // In a real app, you would fetch these from Firestore
  document.getElementById('settings-username').textContent = currentUser.displayName || 'User';
  document.getElementById('settings-userphone').textContent = currentUser.phoneNumber || 'No phone number';
  document.getElementById('response-rate-value').textContent = '85%';
  document.getElementById('response-rate-bar').style.width = '85%';
  document.getElementById('avg-response-time').textContent = '2.5 min';
}

// Load contact statistics
function loadContactStats() {
  if (!selectedChat) return;
  
  const chat = chats.find(c => c.id === selectedChat);
  if (chat) {
    document.getElementById('contact-name').textContent = chat.name || 'Contact';
    document.getElementById('contact-phone').textContent = chat.phone || 'No phone number';
    document.getElementById('messages-sent').textContent = messages.length;
    document.getElementById('contact-response-rate').textContent = '75%';
  }
}

// Update connection status UI
function updateConnectionStatus(connected) {
  const notification = document.getElementById('connectivity-notification');
  if (connected) {
    notification.style.display = 'none';
    connectionStatus.textContent = 'Connected to chats';
  } else {
    notification.style.display = 'flex';
    connectionStatus.textContent = 'Connection lost. Reconnecting...';
  }
}

// Helper functions
function formatDate(date) {
  if (!date) return '';
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function truncate(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
