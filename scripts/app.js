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
const connectivityNotification = document.getElementById('connectivity-notification');
const connectionStatus = document.getElementById('connection-status');
const logoutBtn = document.getElementById('logout-btn');
const searchInput = document.getElementById('search-input');

// State variables
let currentUser = null;
let selectedChat = null;
let chats = [];
let messages = [];
let unsubscribeChats = null;
let unsubscribeMessages = null;

// Initialize the app
function initApp() {
  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      document.getElementById('profile-image').src = user.photoURL || 'https://picsum.photos/id/10/50';
      setupRealTimeListeners();
      setupEventListeners();
    } else {
      // User not logged in, redirect to login
      window.location.href = 'login.html';
    }
  });
}

// Set up real-time listeners
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
          lastUpdated: chat.lastUpdated?.toDate()
        });
      });
      renderChatsList();
      updateConnectionStatus(true);
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

  // Logout
  logoutBtn.addEventListener('click', () => {
    auth.signOut();
  });

  // Search functionality
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    document.querySelectorAll('.chat-tile').forEach(chat => {
      const matches = chat.dataset.chatName.toLowerCase().includes(searchTerm) || 
                     chat.dataset.lastMessage?.toLowerCase().includes(searchTerm);
      chat.style.display = matches ? 'flex' : 'none';
    });
  });
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
  }
  
  // Clear previous messages and unsubscribe
  chatWindowContents.innerHTML = '<div class="loading-state"><p>Loading messages...</p></div>';
  if (unsubscribeMessages) unsubscribeMessages();
  
  // Load messages for this chat
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
    
    const chatItem = document.createElement('div');
    chatItem.className = `chat-tile ${selectedChat === chat.id ? 'active' : ''}`;
    chatItem.dataset.chatId = chat.id;
    chatItem.dataset.chatName = chat.name || '';
    chatItem.dataset.lastMessage = lastMessage;
    
    chatItem.innerHTML = `
      <img src="${chat.photoURL || 'https://picsum.photos/id/103/50'}" alt="" class="chat-tile-avatar">
      <div class="chat-tile-details">
        <div class="chat-tile-title">
          <span>${chat.name || 'New Chat'}</span>
          <span>${lastUpdated}</span>
        </div>
        <div class="chat-tile-subtitle">
          <span>${truncate(lastMessage, 30)}</span>
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
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message-group ${isCurrentUser ? 'current-user' : ''}`;
    
    messageElement.innerHTML = `
      ${!isCurrentUser ? `<img src="${msg.senderPhotoURL || 'https://picsum.photos/50'}" alt="" class="chat-message-avatar">` : ''}
      <div class="chat-messages">
        <div class="chat-message-container">
          <div class="chat-message chat-message-first">
            ${!isCurrentUser ? `<div class="chat-message-sender">${msg.senderName || 'Unknown'}</div>` : ''}
            ${msg.text}
            <span class="chat-message-time">${formatTime(msg.timestamp)}</span>
          </div>
        </div>
      </div>
    `;
    chatWindowContents.appendChild(messageElement);
  });

  // Scroll to bottom
  chatWindowContents.scrollTop = chatWindowContents.scrollHeight;
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
    status: 'sent'
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
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    })
    .catch(error => {
      console.error('Error sending message:', error);
    });

  messageInput.value = '';
}

// Update connection status UI
function updateConnectionStatus(connected) {
  if (connected) {
    connectivityNotification.style.display = 'none';
    connectionStatus.textContent = 'Connected to Firebase';
  } else {
    connectivityNotification.style.display = 'flex';
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