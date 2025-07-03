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

// DOM elements
const chatsList = document.getElementById('chats-list');
const chatWindowContents = document.getElementById('chat-window-contents');
const messageInput = document.getElementById('message-input');
const chatTitle = document.getElementById('chat-title');
const chatSubtitle = document.getElementById('chat-subtitle');
const chatWindowFooter = document.getElementById('chat-window-footer');
const connectionStatus = document.getElementById('connection-status');
const searchInput = document.getElementById('search-input');

// State
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

// Firestore listener
function setupRealTimeListeners() {
  unsubscribeConversations = db.collection('users')
    .orderBy('lastActive', 'desc')
    .limit(100)
    .onSnapshot(snapshot => {
      console.log('📡 Firestore connected. Docs:', snapshot.size);
      conversations = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        console.log('➡️ Doc:', doc.id, data);

        let lastActive = null;
        if (data.lastActive && typeof data.lastActive.toDate === 'function') {
          lastActive = data.lastActive.toDate();
        } else if (data.lastActive instanceof Date) {
          lastActive = data.lastActive;
        }

        conversations.push({
          id: doc.id,
          profileName: data.profileName || doc.id,
          photoURL: data.photoURL || null,
          lastMessage: data.lastMessage || 'No messages yet',
          lastActive: lastActive,
          assignedAgent: data.assignedAgent || null,
          status: data.status || 'active',
          aiEnabled: data.aiEnabled !== false
        });
      });

      renderConversations();
      updateConnectionStatus(true);
    }, error => {
      console.error('❌ Firestore listener error:', error);
      updateConnectionStatus(false);
    });
}

// Event listeners
function setupEventListeners() {
  chatsList.addEventListener('click', (e) => {
    const chatItem = e.target.closest('.chat-tile');
    if (chatItem) {
      selectConversation(chatItem.dataset.phone);
    }
  });

  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    document.querySelectorAll('.chat-tile').forEach(chat => {
      const matches = chat.dataset.chatName.toLowerCase().includes(searchTerm) ||
        chat.querySelector('.chat-tile-subtitle span').textContent.toLowerCase().includes(searchTerm);
      chat.style.display = matches ? 'flex' : 'none';
    });
  });
}

// Select and render messages
function selectConversation(phoneNumber) {
  selectedConversation = phoneNumber;

  document.querySelectorAll('.chat-tile').forEach(item => {
    item.classList.toggle('active', item.dataset.phone === phoneNumber);
  });

  const conversation = conversations.find(c => c.id === phoneNumber);
  if (conversation) {
    chatTitle.textContent = maskPhoneNumber(conversation.id);
    if (conversation.lastActive) {
  const timeAgo = timeSince(conversation.lastActive);
  chatSubtitle.textContent = `Last seen ${timeAgo} ago`;
  } else {
  chatSubtitle.textContent = `Last seen recently`;
  }
    const initials = getInitials(conversation.profileName || conversation.id);
document.getElementById('chat-profile-image').src = conversation.photoURL || `https://ui-avatars.com/api/?name=${initials}&background=random&bold=true&size=40`;
    chatWindowFooter.style.display = 'flex';
  }

  chatWindowContents.innerHTML = '<div class="loading-state"><p>Loading messages...</p></div>';
  if (unsubscribeMessages) unsubscribeMessages();

  // ✅ Load messages from whatsapp_logs, not messages collection
  loadMessagesForConversation(phoneNumber);
}

async function loadMessagesForConversation(phoneNumber) {
  try {
    const incomingQuery = db.collection('whatsapp_logs')
      .where('from', '==', phoneNumber)
      .orderBy('timestamp', 'asc');

    const incomingSnapshot = await incomingQuery.get();

    messages[phoneNumber] = [];
    incomingSnapshot.forEach(doc => {
      const data = doc.data();
      messages[phoneNumber].push({
        id: doc.id,
        ...data,
        direction: 'incoming',
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp || Date.now())
      });
    });

    const outgoingSnapshot = await db.collection('whatsapp_logs')
      .where('to', '==', phoneNumber)
      .get();

    outgoingSnapshot.forEach(doc => {
      const data = doc.data();
      messages[phoneNumber].push({
        id: doc.id,
        ...data,
        direction: 'outgoing',
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp || Date.now())
      });
    });

    messages[phoneNumber].sort((a, b) => a.timestamp - b.timestamp);
    renderMessages(phoneNumber);

    // Live updates: listen to new incoming messages
    unsubscribeMessages = db.collection('whatsapp_logs')
      .where('from', '==', phoneNumber)
      .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const newMessage = {
              id: change.doc.id,
              ...data,
              direction: 'incoming',
              timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp || Date.now())
            };

            if (!messages[phoneNumber].some(msg => msg.id === newMessage.id)) {
              messages[phoneNumber].push(newMessage);
              messages[phoneNumber].sort((a, b) => a.timestamp - b.timestamp);
              renderMessages(phoneNumber);
            }
          }
        });
      });

  } catch (error) {
    console.error('❌ Error loading messages from whatsapp_logs:', error);
    chatWindowContents.innerHTML = '<div class="empty-state"><p>Error loading messages. Please try again.</p></div>';
  }
}


// Render conversation tiles
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
          <span>${maskPhoneNumber(conversation.id)}</span>
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

// Render chat messages
function renderMessages(phoneNumber) {
  if (!messages[phoneNumber]?.length) {
    chatWindowContents.innerHTML = '<div class="empty-state"><p>No messages in this conversation</p></div>';
    return;
  }

  chatWindowContents.innerHTML = '';
  let currentDate = null;

  messages[phoneNumber].forEach(msg => {
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
let messageContent = '[Message]';

if (msg.message?.text?.body) {
  messageContent = `
    <div class="wa-text-message">
      ${escapeHTML(msg.message.text.body)}
    </div>`;
} else if (msg.message?.interactive?.list_reply) {
  const reply = msg.message.interactive.list_reply;
  messageContent = `
    <div class="wa-interactive-reply">
      <div class="wa-button-title">${escapeHTML(reply.title)}</div>
      ${reply.description ? `<div class="wa-button-description">${escapeHTML(reply.description)}</div>` : ''}
    </div>`;
}

// Fallbacks
else if (msg.message?.type) {
  messageContent = `[${msg.message.type} message]`;
}


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

  chatWindowContents.scrollTop = chatWindowContents.scrollHeight;
}

// Connection status
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

function getInitials(name) {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}


function escapeHTML(str) {
  return str?.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") || '';
}

function maskPhoneNumber(number) {
  if (!number || number.length < 9) return number;
  return number.slice(0, 4) + '***' + number.slice(-4);
}

function timeSince(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
    { label: 'second', seconds: 1 }
  ];

  for (let i = 0; i < intervals.length; i++) {
    const interval = intervals[i];
    const count = Math.floor(seconds / interval.seconds);
    if (count > 0) return `${count} ${interval.label}${count !== 1 ? 's' : ''}`;
  }

  return 'just now';
}


// Utilities
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

// Run on load
document.addEventListener('DOMContentLoaded', initApp);
