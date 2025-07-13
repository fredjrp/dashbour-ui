// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBQIwJzAzqcz2mKnZyNIDA6Nm3dnsEVJOU",
  authDomain: "ai-assistant-6fa6f.firebaseapp.com",
  projectId: "ai-assistant-6fa6f",
  storageBucket: "ai-assistant-6fa6f.appspot.com",
  messagingSenderId: "959657907969",
  appId: "1:959657907969:web:886b643c098435865bed00",
  measurementId: "G-SL0YLWT2TX"
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
const connectionStatus = document.getElementById('connection-status');
const searchInput = document.getElementById('search-input');
const aiToggle = document.getElementById('ai-toggle-checkbox');

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

// Firestore listener for conversations
function setupRealTimeListeners() {
  unsubscribeConversations = db.collection('users')
    .orderBy('onboarding.lastActive', 'desc')
    .limit(100)
    .onSnapshot(handleConversationSnapshot, handleFirestoreError);
}

function handleConversationSnapshot(snapshot) {
  console.log('📡 Firestore connected. Docs:', snapshot.size);
  conversations = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const onboarding = data.onboarding || {};
    
    conversations.push({
      id: doc.id,
      phone: doc.id,
      name: data.name || onboarding.name || 'Unknown',
      lastMessage: data.lastMessage || 'No messages yet',
      lastActive: data.lastActive?.toDate() || onboarding.lastActive?.toDate() || new Date(),
      status: data.status || 'active',
      aiEnabled: data.aiEnabled !== false,
      onboardingStage: onboarding.stage || 'none',
      onboardingCompleted: onboarding.completed || false,
      profilePhoto: data.photoURL || 'https://picsum.photos/id/103/50'
    });
  });

  renderConversations();
  updateConnectionStatus(true);
}

function handleFirestoreError(error) {
  console.error('❌ Firestore error:', error);
  updateConnectionStatus(false);
}

// Event listeners
function setupEventListeners() {
  // Conversation selection
  chatsList.addEventListener('click', (e) => {
    const chatItem = e.target.closest('.chat-tile');
    if (chatItem) {
      selectConversation(chatItem.dataset.phone);
    }
  });

  // Message sending
  document.getElementById('send-button').addEventListener('click', sendMessageFromInput);
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessageFromInput();
  });

  // Search functionality
  searchInput.addEventListener('input', filterConversations);
}

function filterConversations(e) {
  const searchTerm = e.target.value.toLowerCase();
  document.querySelectorAll('.chat-tile').forEach(chat => {
    const matches = chat.dataset.chatName.toLowerCase().includes(searchTerm) ||
      chat.querySelector('.chat-tile-subtitle span').textContent.toLowerCase().includes(searchTerm);
    chat.style.display = matches ? 'flex' : 'none';
  });
}

// Select conversation and load messages
async function selectConversation(phoneNumber) {
  selectedConversation = phoneNumber;
  updateSelectedConversationUI(phoneNumber);
  
  // Load messages
  chatWindowContents.innerHTML = '<div class="loading-state"><p>Loading messages...</p></div>';
  if (unsubscribeMessages) unsubscribeMessages();
  await loadMessagesForConversation(phoneNumber);
}

function updateSelectedConversationUI(phoneNumber) {
  // Update UI for selected conversation
  document.querySelectorAll('.chat-tile').forEach(item => {
    item.classList.toggle('active', item.dataset.phone === phoneNumber);
  });

  // Find and display conversation data
  const conversation = conversations.find(c => c.id === phoneNumber);
  if (conversation) {
    chatTitle.textContent = conversation.name || maskPhoneNumber(phoneNumber);
    chatSubtitle.textContent = `Last seen ${timeSince(conversation.lastActive)} ago`;
    document.getElementById('chat-profile-image').src = conversation.profilePhoto;
  }
}

// Load messages for a conversation
async function loadMessagesForConversation(phoneNumber) {
  try {
    messages[phoneNumber] = [];
    
    // Combined query for all messages involving this user
    const query = db.collection('whatsapp_logs')
      .where('userId', '==', phoneNumber)
      .orderBy('timestamp', 'asc');

    const snapshot = await query.get();
    snapshot.forEach(doc => {
      const data = doc.data();
      addMessageToState(phoneNumber, data, data.direction);
    });

    renderMessages(phoneNumber);
    setupMessageListener(phoneNumber);
  } catch (error) {
    console.error('❌ Error loading messages:', error);
    showErrorMessage('Error loading messages. Please try again.');
  }
}

function setupMessageListener(phoneNumber) {
  unsubscribeMessages = db.collection('whatsapp_logs')
    .where('userId', '==', phoneNumber)
    .orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          addMessageToState(phoneNumber, data, data.direction);
          renderMessages(phoneNumber);
        }
      });
    }, handleFirestoreError);
}

// Helper to add message to state
function addMessageToState(phoneNumber, messageData, direction) {
  if (!messages[phoneNumber]) messages[phoneNumber] = [];
  
  // Skip duplicates
  if (messages[phoneNumber].some(msg => msg.id === messageData.messageId)) return;

  const timestamp = messageData.timestamp?.toDate 
    ? messageData.timestamp.toDate() 
    : new Date(messageData.timestamp || Date.now());

  messages[phoneNumber].push({
    id: messageData.messageId || `gen-${Date.now()}`,
    ...messageData,
    direction,
    timestamp
  });
}

// Render conversation list
function renderConversations() {
  chatsList.innerHTML = conversations.length ? '' : '<div class="empty-state"><p>No conversations found</p></div>';

  conversations.forEach(conversation => {
    const chatItem = document.createElement('div');
    chatItem.className = `chat-tile ${selectedConversation === conversation.id ? 'active' : ''}`;
    chatItem.dataset.phone = conversation.id;
    chatItem.dataset.chatName = conversation.name;

    chatItem.innerHTML = `
      <img src="${conversation.profilePhoto}" alt="" class="chat-tile-avatar">
      <div class="chat-tile-details">
        <div class="chat-tile-title">
          <span>${conversation.name || maskPhoneNumber(conversation.id)}</span>
          <span>${formatTime(conversation.lastActive)}</span>
        </div>
        <div class="chat-tile-subtitle">
          <span>${truncate(conversation.lastMessage, 30)}</span>
          <span class="chat-tile-status ${conversation.onboardingCompleted ? 'completed' : 'pending'}">
            ${conversation.onboardingCompleted ? '✓' : '…'}
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
    
    const messageGroup = document.createElement('div');
    messageGroup.className = `chat-message-group ${isOutgoing ? 'outgoing' : ''}`;
    messageGroup.innerHTML = `
      ${!isOutgoing ? `<img src="${msg.senderPhotoURL || 'https://picsum.photos/50'}" alt="" class="chat-message-avatar">` : ''}
      <div class="chat-messages">
        <div class="chat-message-container">
          <div class="chat-message chat-message-first">
            ${!isOutgoing ? `<div class="chat-message-sender">${msg.senderName || 'Customer'}</div>` : ''}
            ${formatMessageContent(msg)}
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

// Format different message types
function formatMessageContent(msg) {
  if (msg.message?.text?.body) {
    return `<div class="wa-text-message">${escapeHTML(msg.message.text.body)}</div>`;
  }
  
  if (msg.message?.interactive?.list_reply) {
    const reply = msg.message.interactive.list_reply;
    return `
      <div class="wa-interactive-reply">
        <div class="wa-button-title">${escapeHTML(reply.title)}</div>
        ${reply.description ? `<div class="wa-button-description">${escapeHTML(reply.description)}</div>` : ''}
      </div>`;
  }
  
  if (msg.message?.interactive?.button_reply) {
    const reply = msg.message.interactive.button_reply;
    return `
      <div class="wa-interactive-reply">
        <div class="wa-button-title">${escapeHTML(reply.title)}</div>
      </div>`;
  }
  
  return `<div class="wa-unknown-message">[${msg.message?.type || 'unknown'} message]</div>`;
}

// Send message from input
async function sendMessageFromInput() {
  const text = messageInput.value.trim();
  if (!text || !selectedConversation) return;

  try {
    // Optimistically add to UI
    const tempId = `temp-${Date.now()}`;
    const now = new Date();
    messages[selectedConversation] = messages[selectedConversation] || [];
    messages[selectedConversation].push({
      id: tempId,
      to: selectedConversation,
      message: { text: { body: text } },
      direction: 'outgoing',
      timestamp: now,
      status: 'sending'
    });
    renderMessages(selectedConversation);
    messageInput.value = '';

    // Send to backend
    const response = await fetch('https://aisassistantdvdhs.onrender.com/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: selectedConversation,
        type: 'text',
        text: text
      })
    });

    const result = await response.json();
    handleSendResult(result, tempId);
  } catch (error) {
    handleSendError(error);
  }
}

function handleSendResult(result, tempId) {
  if (result.success) {
    const sentMessage = messages[selectedConversation].find(m => m.id === tempId);
    if (sentMessage) {
      sentMessage.status = 'sent';
      sentMessage.id = result.messageId;
      renderMessages(selectedConversation);
    }
  } else {
    throw new Error(result.error || 'Failed to send');
  }
}

function handleSendError(error) {
  console.error('❌ Message send failed:', error);
  const failedMessage = messages[selectedConversation].find(m => m.id.startsWith('temp-'));
  if (failedMessage) {
    failedMessage.status = 'failed';
    renderMessages(selectedConversation);
  }
}

// Utility functions
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

  for (let interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count > 0) return `${count} ${interval.label}${count !== 1 ? 's' : ''}`;
  }
  return 'just now';
}

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

function updateConnectionStatus(connected) {
  connectionStatus.textContent = connected ? 'Connected' : 'Disconnected';
  connectionStatus.style.color = connected ? '#2ecc71' : '#e74c3c';
}

function showErrorMessage(message) {
  chatWindowContents.innerHTML = `<div class="empty-state"><p>${message}</p></div>`;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initApp);
