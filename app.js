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
const chatWindowFooter = document.getElementById('chat-window-footer');
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
    .onSnapshot(snapshot => {
      console.log('📡 Firestore connected. Docs:', snapshot.size);
      conversations = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const onboarding = data.onboarding || {};
        
        conversations.push({
          id: doc.id,
          phone: doc.id,
          name: onboarding.name?.value || 'Unknown',
          lastMessage: data.lastMessage || 'No messages yet',
          lastActive: onboarding.lastActive?.toDate() || new Date(),
          status: data.status || 'active',
          aiEnabled: data.aiEnabled !== false,
          onboardingStage: onboarding.stage || 'none',
          onboardingCompleted: onboarding.completed || false,
          businessType: onboarding.businessType?.value || 'Unknown',
          profilePhoto: data.photoURL || 'https://picsum.photos/id/103/50'
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
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessageFromInput();
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

// Select conversation and load messages
async function selectConversation(phoneNumber) {
  selectedConversation = phoneNumber;

  // Update UI for selected conversation
  document.querySelectorAll('.chat-tile').forEach(item => {
    item.classList.toggle('active', item.dataset.phone === phoneNumber);
  });

  // Find conversation data
  const conversation = conversations.find(c => c.id === phoneNumber);
  if (conversation) {
    chatTitle.textContent = conversation.name || maskPhoneNumber(phoneNumber);
    chatSubtitle.textContent = `Last seen ${timeSince(conversation.lastActive)} ago`;
    document.getElementById('chat-profile-image').src = conversation.profilePhoto;
    chatWindowFooter.style.display = 'flex';
  }

  // Setup AI toggle
  setupAIToggle(phoneNumber);

  // Load messages
  chatWindowContents.innerHTML = '<div class="loading-state"><p>Loading messages...</p></div>';
  if (unsubscribeMessages) unsubscribeMessages();
  loadMessagesForConversation(phoneNumber);
}

// Setup AI toggle with Firestore sync
async function setupAIToggle(phoneNumber) {
  if (!aiToggle) return;

  const userRef = db.collection('users').doc(phoneNumber);
  const userDoc = await userRef.get();

  // Initialize if doesn't exist
  if (!userDoc.exists) {
    await userRef.set({ 
      aiEnabled: true,
      status: 'ai'
    }, { merge: true });
  }

  // Set initial toggle state
  const userData = userDoc.data() || {};
  aiToggle.checked = userData.aiEnabled !== false;
  updateAIToggleColor(aiToggle.checked);

  // Handle toggle changes
  aiToggle.onchange = async () => {
    const newState = aiToggle.checked;
    updateAIToggleColor(newState);
    await userRef.update({ 
      aiEnabled: newState,
      status: newState ? 'ai' : 'assigned'
    });
  };
}

function updateAIToggleColor(enabled) {
  const slider = document.querySelector('.slider');
  if (slider) {
    slider.style.backgroundColor = enabled ? '#2ecc71' : '#e74c3c';
  }
}

// Load messages for a conversation
async function loadMessagesForConversation(phoneNumber) {
  try {
    // Clear existing messages
    messages[phoneNumber] = [];

    // Get incoming messages (from user)
    const incomingQuery = db.collection('whatsapp_logs')
      .where('from', '==', phoneNumber)
      .orderBy('timestamp', 'asc');

    const incomingSnapshot = await incomingQuery.get();
    incomingSnapshot.forEach(doc => {
      addMessageToState(phoneNumber, doc.data(), 'incoming');
    });

    // Get outgoing messages (to user)
    const outgoingQuery = db.collection('whatsapp_logs')
      .where('to', '==', phoneNumber)
      .orderBy('timestamp', 'asc');

    const outgoingSnapshot = await outgoingQuery.get();
    outgoingSnapshot.forEach(doc => {
      addMessageToState(phoneNumber, doc.data(), 'outgoing');
    });

    // Sort all messages by timestamp
    messages[phoneNumber].sort((a, b) => a.timestamp - b.timestamp);
    renderMessages(phoneNumber);

    // Setup real-time listener for new messages
    unsubscribeMessages = db.collection('whatsapp_logs')
      .where('from', '==', phoneNumber)
      .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            addMessageToState(phoneNumber, change.doc.data(), 'incoming');
            renderMessages(phoneNumber);
          }
        });
      });

  } catch (error) {
    console.error('❌ Error loading messages:', error);
    chatWindowContents.innerHTML = '<div class="empty-state"><p>Error loading messages. Please try again.</p></div>';
  }
}

// Helper to add message to state with proper formatting
function addMessageToState(phoneNumber, messageData, direction) {
  if (!messages[phoneNumber]) messages[phoneNumber] = [];
  
  // Skip if message already exists
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
    
    // Format message content based on type
    let messageContent = formatMessageContent(msg);

    const messageGroup = document.createElement('div');
    messageGroup.className = `chat-message-group ${isOutgoing ? 'outgoing' : ''}`;
    messageGroup.innerHTML = `
      ${!isOutgoing ? `<img src="${msg.senderPhotoURL || 'https://picsum.photos/50'}" alt="" class="chat-message-avatar">` : ''}
      <div class="chat-messages">
        <div class="chat-message-container">
          <div class="chat-message chat-message-first">
            ${!isOutgoing ? `<div class="chat-message-sender">${msg.senderName || 'Customer'}</div>` : ''}
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
  
  if (msg.message?.image) {
    return `
      <div class="wa-media-message">
        <img src="${msg.message.image.link}" alt="Sent image">
        ${msg.message.image.caption ? `<div class="wa-media-caption">${escapeHTML(msg.message.image.caption)}</div>` : ''}
      </div>`;
  }
  
  if (msg.message?.location) {
    return `
      <div class="wa-location-message">
        <div class="wa-location-title">${escapeHTML(msg.message.location.name || 'Location')}</div>
        <div class="wa-location-address">${escapeHTML(msg.message.location.address || '')}</div>
        <a href="https://maps.google.com/?q=${msg.message.location.latitude},${msg.message.location.longitude}" target="_blank">
          <img src="https://maps.googleapis.com/maps/api/staticmap?center=${msg.message.location.latitude},${msg.message.location.longitude}&zoom=15&size=300x150&markers=color:red%7C${msg.message.location.latitude},${msg.message.location.longitude}" alt="Location">
        </a>
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
    
    // Update status in UI
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
  } catch (error) {
    console.error('❌ Message send failed:', error);
    // Update status to failed
    const failedMessage = messages[selectedConversation].find(m => m.id.startsWith('temp-'));
    if (failedMessage) {
      failedMessage.status = 'failed';
      renderMessages(selectedConversation);
    }
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

// Initialize on load
document.addEventListener('DOMContentLoaded', initApp);

const emojiIcon = document.querySelector('img[src="icons/emoji.svg"]');
const messageDropdown = document.getElementById('message-type-dropdown');
const typeSelect = document.getElementById('message-type');
const fieldsContainer = document.getElementById('message-fields');
const sendButton = document.getElementById('send-custom-message');

// 🎯 Toggle dropdown on emoji icon click
emojiIcon.addEventListener('click', (e) => {
  e.stopPropagation();
  messageDropdown.classList.toggle('hidden');

  // Position near emoji icon
  const rect = emojiIcon.getBoundingClientRect();
  messageDropdown.style.left = `${rect.left}px`;
  messageDropdown.style.bottom = `${window.innerHeight - rect.top + 10}px`;

  renderFields(typeSelect.value);
});

let hideDropdownTimeout;

// When user clicks *anywhere* on the document
document.addEventListener('click', (e) => {
  const isInsideDropdown = messageDropdown.contains(e.target);
  const isEmojiIcon = emojiIcon.contains(e.target);

  // If click is outside both the emoji icon and the dropdown
  if (!isInsideDropdown && !isEmojiIcon) {
    hideDropdownTimeout = setTimeout(() => {
      messageDropdown.classList.add('hidden');
    }, 2000); // ⏱ Delayed hide
  } else {
    clearTimeout(hideDropdownTimeout); // ❌ Cancel hide if clicked inside
    messageDropdown.classList.remove('hidden'); // ✅ Make sure it's visible
  }
});


// 🧩 Change input fields on type selection
typeSelect.addEventListener('change', () => {
  renderFields(typeSelect.value);
});

// 🧩 Render message input fields based on type
function renderFields(type) {
  let html = '';
  if (type === 'text') {
    html = `<input type="text" id="text-body" placeholder="Message text" />`;
  } else if (type === 'image') {
    html = `
      <input type="text" id="image-link" placeholder="Image URL" />
      <input type="text" id="image-caption" placeholder="Caption (optional)" />
    `;
  } else if (type === 'location') {
    html = `
      <input type="text" id="location-lat" placeholder="Latitude" />
      <input type="text" id="location-lng" placeholder="Longitude" />
      <input type="text" id="location-name" placeholder="Name (optional)" />
      <input type="text" id="location-address" placeholder="Address (optional)" />
    `;
  } else if (type === 'interactive') {
    html = `
      <input type="text" id="button-body" placeholder="Prompt text (e.g. Choose one)" />
      <input type="text" id="button-1" placeholder="Button 1 Title" />
      <input type="text" id="button-2" placeholder="Button 2 Title" />
    `;
  }
  fieldsContainer.innerHTML = html;
}

// 🟢 Send custom message
sendButton.addEventListener('click', async () => {
  if (!selectedConversation) {
    alert('❌ No conversation selected.');
    return;
  }
  
  const to = selectedConversation;
  const type = typeSelect.value;
  const payload = { to, type };

  if (type === 'text') {
    payload.text = { body: document.getElementById('text-body').value };
  } else if (type === 'image') {
    payload.image = {
      link: document.getElementById('image-link').value,
      caption: document.getElementById('image-caption').value
    };
  } else if (type === 'location') {
    payload.location = {
      latitude: parseFloat(document.getElementById('location-lat').value),
      longitude: parseFloat(document.getElementById('location-lng').value),
      name: document.getElementById('location-name').value,
      address: document.getElementById('location-address').value
    };
  } else if (type === 'interactive') {
    payload.interactive = {
      type: 'button',
      body: { text: document.getElementById('button-body').value },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'btn1', title: document.getElementById('button-1').value } },
          { type: 'reply', reply: { id: 'btn2', title: document.getElementById('button-2').value } }
        ]
      }
    };
  }

  try {
    // Show loading state
    sendButton.disabled = true;
    sendButton.textContent = 'Sending...';

    const res = await fetch('https://aisassistantdvdhs.onrender.com/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    
    if (result.success) {
      alert('✅ Message sent!');
      messageDropdown.classList.add('hidden');
      
      // Add to local messages
      const now = new Date();
      messages[selectedConversation] = messages[selectedConversation] || [];
      messages[selectedConversation].push({
        id: result.messageId || `gen-${Date.now()}`,
        to: selectedConversation,
        message: payload,
        direction: 'outgoing',
        timestamp: now,
        status: 'sent'
      });
      renderMessages(selectedConversation);
    } else {
      alert('❌ Failed to send: ' + (result.error || 'Unknown error'));
    }
  } catch (err) {
    console.error('Error sending message:', err);
    alert('❌ Error sending message');
  } finally {
    // Reset button state
    sendButton.disabled = false;
    sendButton.textContent = 'Send';
  }
});
