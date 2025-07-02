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
const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');

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
      initEmojiPicker();
      updateConnectionStatus(true);
    } else {
      window.location.href = 'login.html';
    }
  });
}

// Set up real-time Firestore listeners
function setupRealTimeListeners() {
  // For Firestore index error, either create the index or use simpler query:
  unsubscribeChats = db.collection('chats')
    .where('participants', 'array-contains', currentUser.uid)
    // .orderBy('lastUpdated', 'desc') // Remove if index not created
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
      // Sort locally if not using orderBy
      chats.sort((a, b) => b.lastUpdated - a.lastUpdated);
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
    if (chatItem) selectChat(chatItem.dataset.chatId);
  });

  // Message sending
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && messageInput.value.trim()) sendMessage();
  });

  // AI toggle
  aiToggleBtn?.addEventListener('click', toggleAI);

  // Settings
  document.getElementById('settings-btn')?.addEventListener('click', openSettings);
  document.querySelector('#settings-modal .close-modal')?.addEventListener('click', closeSettings);

  // Contact info
  document.getElementById('contact-info-btn')?.addEventListener('click', openContactInfo);
  document.querySelector('#contact-info-modal .close-modal')?.addEventListener('click', closeContactInfo);

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', () => auth.signOut());

  // Close modals when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettings();
    if (e.target === contactInfoModal) closeContactInfo();
    if (e.target === emojiPicker) emojiPicker.style.display = 'none';
  });
}

// Initialize emoji picker
function initEmojiPicker() {
  if (!emojiBtn || !emojiPicker) return;

  const emojis = ['😀', '😊', '😂', '❤️', '👍', '👎', '🔥', '🎉', '🤔', '😢'];
  emojiPicker.innerHTML = `
    <div class="emoji-picker-header">Select Emoji</div>
    <div class="emoji-container">
      ${emojis.map(emoji => `<span class="emoji-option">${emoji}</span>`).join('')}
    </div>
  `;

  emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.style.display = emojiPicker.style.display === 'block' ? 'none' : 'block';
  });

  emojiPicker.addEventListener('click', (e) => {
    if (e.target.classList.contains('emoji-option')) {
      messageInput.value += e.target.textContent;
      emojiPicker.style.display = 'none';
    }
  });
}

// Chat selection and message loading
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

// Render functions
function renderChatsList() {
  chatsList.innerHTML = chats.length ? '' : '<div class="empty-state"><p>No conversations yet</p></div>';
  
  chats.forEach(chat => {
    const lastMessage = chat.lastMessage || 'No messages yet';
    const lastUpdated = formatTime(chat.lastUpdated);
    const unreadCount = chat.unreadCount ? `<span class="unread-badge">${chat.unreadCount}</span>` : '';
    
    const chatItem = document.createElement('div');
    chatItem.className = `chat-tile ${selectedChat === chat.id ? 'active' : ''}`;
    chatItem.dataset.chatId = chat.id;
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

function renderMessages() {
  if (messages.length === 0) {
    chatWindowContents.innerHTML = '<div class="empty-state"><p>No messages in this chat</p></div>';
    return;
  }

  chatWindowContents.innerHTML = '';
  let currentDate = null;

  messages.forEach(msg => {
    const messageDate = formatDate(msg.timestamp);
    if (messageDate !== currentDate) {
      currentDate = messageDate;
      chatWindowContents.innerHTML += `
        <div class="datestamp-container">
          <span class="datestamp">${currentDate}</span>
        </div>
      `;
    }

    const isCurrentUser = msg.senderId === currentUser.uid;
    const isAIResponse = msg.isAIResponse || false;
    const isUnresponded = msg.isUnresponded || false;
    
    chatWindowContents.innerHTML += `
      <div class="chat-message-group ${isCurrentUser ? 'current-user' : ''}">
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
              ${msg.type === 'interactive' ? renderInteractiveMessage(msg) : msg.text}
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
      </div>
    `;
  });

  // Add event listeners for interactive messages
  document.querySelectorAll('.interactive-button').forEach(button => {
    button.addEventListener('click', (e) => {
      const buttonId = e.target.dataset.id;
      e.target.classList.add('selected');
      e.target.innerHTML += ' ✓';
      console.log('Button selected:', buttonId);
      // Add your button response handling here
    });
  });

  chatWindowContents.scrollTop = chatWindowContents.scrollHeight;
}

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

function renderReactions(reactions) {
  return `
    <div class="message-reactions">
      ${Object.entries(reactions).map(([emoji, users]) => `
        <span class="reaction">${emoji} ${users.length}</span>
      `).join('')}
    </div>
  `;
}

// Message handling
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

  db.collection('chats')
    .doc(selectedChat)
    .collection('messages')
    .add(newMessage)
    .then(() => {
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

// AI toggle
function toggleAI() {
  if (!selectedChat) return;
  aiEnabled = !aiEnabled;
  updateAIToggleButton();
  db.collection('chats')
    .doc(selectedChat)
    .update({ aiEnabled: aiEnabled });
}

function updateAIToggleButton() {
  if (!aiToggleBtn) return;
  aiToggleBtn.classList.toggle('ai-toggle-on', aiEnabled);
  aiToggleBtn.classList.toggle('ai-toggle-off', !aiEnabled);
}

// Modal functions
function openSettings() {
  loadUserStats();
  settingsModal.style.display = 'block';
}

function closeSettings() {
  settingsModal.style.display = 'none';
}

function openContactInfo() {
  if (!selectedChat) return;
  loadContactStats();
  contactInfoModal.style.display = 'block';
}

function closeContactInfo() {
  contactInfoModal.style.display = 'none';
}

function loadUserStats() {
  if (!currentUser) return;
  document.getElementById('settings-username').textContent = currentUser.displayName || 'User';
  document.getElementById('settings-userphone').textContent = currentUser.phoneNumber || 'No phone number';
  
  // Simulate loading stats
  document.getElementById('response-rate-value').textContent = '85%';
  document.getElementById('response-rate-bar').style.width = '85%';
  document.getElementById('avg-response-time').textContent = '2.5 min';
}

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

// Helper functions
function updateConnectionStatus(connected) {
  const notification = document.getElementById('connectivity-notification');
  if (notification) {
    notification.style.display = connected ? 'none' : 'flex';
    connectionStatus.textContent = connected ? 'Connected to chats' : 'Connection lost. Reconnecting...';
  }
}

function formatDate(date) {
  return date?.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) || '';
}

function formatTime(date) {
  return date?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '';
}

function truncate(text, maxLength) {
  return text?.length > maxLength ? text.substring(0, maxLength) + '...' : text || '';
}

// Initialize the app
document.addEventListener('DOMContentLoaded', initApp);
