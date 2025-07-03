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

// DOM elements
const chatsList = document.getElementById('chats-list');
const chatWindowContents = document.getElementById('chat-window-contents');
const messageInput = document.getElementById('message-input');
const chatTitle = document.getElementById('chat-title');
const chatSubtitle = document.getElementById('chat-subtitle');
const chatWindowFooter = document.getElementById('chat-window-footer');
const connectionStatus = document.getElementById('connection-status');
const searchInput = document.getElementById('search-input');

// State variables
let selectedConversation = null;
let conversations = [];
let messages = {};
let unsubscribeConversations = null;
let unsubscribeMessages = null;

// Initialize the app
function initApp() {
  setupRealTimeListeners();
  setupEventListeners();
}

// Set up real-time Firestore listeners
function setupRealTimeListeners() {
  // Listen to users collection in Firestore
  unsubscribeConversations = db.collection('users')
    .orderBy('lastActive', 'desc')
    .limit(100)
    .onSnapshot(snapshot => {
      conversations = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        
        let lastActiveDate;
        if (data.lastActive && typeof data.lastActive.toDate === 'function') {
          lastActiveDate = data.lastActive.toDate();
        } else {
          lastActiveDate = new Date(); // fallback value
        }

        conversations.push({
          id: doc.id,
          ...data,
          lastActive: lastActiveDate,
          assignedAgent: data.assignedAgent || null,
          status: data.status || 'active',
          aiEnabled: data.aiEnabled !== false
        });
      });
      renderConversations();
      updateConnectionStatus(true);
    }, error => {
      console.error('Conversations listener error:', error);
      updateConnectionStatus(false);
    });
}

// Set up event listeners
function setupEventListeners() {
  // Chat selection
  chatsList.addEventListener('click', (e) => {
    const chatItem = e.target.closest('.chat-tile');
    if (chatItem) {
      selectConversation(chatItem.dataset.phone);
    }
  });

  // Search functionality
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    document.querySelectorAll('.chat-tile').forEach(chat => {
      const matches = chat.dataset.chatName.toLowerCase().includes(searchTerm) || 
                     chat.querySelector('.chat-tile-subtitle span').textContent.toLowerCase().includes(searchTerm);
      chat.style.display = matches ? 'flex' : 'none';
    });
  });
}

// Select conversation and load messages from Firestore
function selectConversation(phoneNumber) {
  selectedConversation = phoneNumber;
  
  document.querySelectorAll('.chat-tile').forEach(item => {
    item.classList.toggle('active', item.dataset.phone === phoneNumber);
  });
  
  const conversation = conversations.find(c => c.id === phoneNumber);
  if (conversation) {
    chatTitle.textContent = conversation.profileName || 'Unknown';
    chatSubtitle.textContent = `You and 69 others`; // Default as in your design
    document.getElementById('chat-profile-image').src = conversation.photoURL || 'https://picsum.photos/id/103/50';
    chatWindowFooter.style.display = 'flex';
  }
  
  chatWindowContents.innerHTML = '<div class="loading-state"><p>Loading messages...</p></div>';
  if (unsubscribeMessages) unsubscribeMessages();
  
  // Load messages from Firestore
  unsubscribeMessages = db.collection('messages')
    .where('conversationId', '==', phoneNumber)
    .orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
      messages[phoneNumber] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        messages[phoneNumber].push({
          id: doc.id,
          ...data,
          direction: data.senderId === phoneNumber ? 'incoming' : 'outgoing',
          timestamp: data.timestamp?.toDate() || new Date()
        });
      });
      renderMessages(phoneNumber);
    }, error => {
      console.error('Messages listener error:', error);
    });
}

// Render conversations list
function renderConversations() {
  chatsList.innerHTML = conversations.length ? '' : 
    '<div class="empty-state"><p>No conversations found</p></div>';
  
  conversations.forEach(conversation => {
    const lastMessage = conversation.lastMessage || 'No messages yet';
    const lastActiveTime = formatTime(conversation.lastActive);
    
    const chatItem = document.createElement('div');
    chatItem.className = `chat-tile ${selectedConversation === conversation.id ? 'active' : ''}`;
    chatItem.dataset.phone = conversation.id;
    chatItem.dataset.chatName = conversation.profileName || '';
    chatItem.innerHTML = `
      <img src="${conversation.photoURL || 'https://picsum.photos/id/103/50'}" alt="" class="chat-tile-avatar">
      <div class="chat-tile-details">
        <div class="chat-tile-title">
          <span>${conversation.profileName || conversation.id}</span>
          <span>${lastActiveTime}</span>
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

// Render messages
function renderMessages(phoneNumber) {
  if (!messages[phoneNumber]?.length) {
    chatWindowContents.innerHTML = '<div class="empty-state"><p>No messages in this conversation</p></div>';
    return;
  }

  chatWindowContents.innerHTML = '';
  let currentDate = null;

  messages[phoneNumber].forEach(msg => {
    // Add date separator if needed
    const messageDate = formatDate(msg.timestamp);
    if (messageDate !== currentDate) {
      currentDate = messageDate;
      const dateElement = document.createElement('div');
      dateElement.className = 'datestamp-container';
      dateElement.innerHTML = `<span class="datestamp">${currentDate}</span>`;
      chatWindowContents.appendChild(dateElement);
    }

    const isOutgoing = msg.direction === 'outgoing';
    const messageTime = formatTime(msg.timestamp);
    let messageContent = msg.text || msg.content || '[Message]';

    // Message group container
    const messageGroup = document.createElement('div');
    messageGroup.className = `chat-message-group ${isOutgoing ? 'outgoing' : ''}`;
    
    messageGroup.innerHTML = `
      ${!isOutgoing ? `<img src="${msg.senderPhotoURL || 'https://picsum.photos/50'}" alt="" class="chat-message-avatar">` : ''}
      <div class="chat-messages">
        <div class="chat-message-container">
          <div class="chat-message chat-message-first">
            ${!isOutgoing ? `<div class="chat-message-sender">${msg.senderName || 'Unknown'}</div>` : ''}
            ${messageContent}
            <span class="chat-message-time">${messageTime}</span>
          </div>
          ${isOutgoing ? `<div class="message-status">${msg.status || 'sent'}</div>` : ''}
        </div>
      </div>
    `;
    chatWindowContents.appendChild(messageGroup);
  });

  // Scroll to bottom
  chatWindowContents.scrollTop = chatWindowContents.scrollHeight;
}

// Update connection status UI
function updateConnectionStatus(connected) {
  const notification = document.querySelector('.connectivity-notification');
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
