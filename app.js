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
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
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
const transferBtn = document.getElementById('transfer-btn');
const agentSelect = document.getElementById('agent-select');
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
let agents = [];
let unsubscribeConversations = null;
let unsubscribeMessages = null;
let unsubscribeAgents = null;
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
      // Attempt auto sign-in for development/testing
      auth.signInWithEmailAndPassword("juniorokovagng@gmail.com", "mlnkbjvhcgxfzd")
        .then(userCredential => {
          currentUser = userCredential.user;
          setupRealTimeListeners();
          setupEventListeners();
          initEmojiPicker();
          updateConnectionStatus(true);
        })
        .catch(error => {
          console.error("Auto-login failed:", error.message);
          window.location.href = 'index.html';
        });
    }
  });
}

// Set up real-time Firestore listeners
function setupRealTimeListeners() {
  // Listen to users collection for conversations
  unsubscribeConversations = db.collection('users')
    .orderBy('lastActive', 'desc')
    .limit(100)
    .onSnapshot(snapshot => {
      conversations = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        conversations.push({
          id: doc.id,
          ...data,
          lastActive: data.lastActive?.toDate() || new Date(),
          assignedAgent: data.assignedAgent || null,
          status: data.status || 'active',
          aiEnabled: data.aiEnabled !== false
        });
      });
      renderConversations();
    }, error => {
      console.error('Conversations listener error:', error);
      updateConnectionStatus(false);
    });

  // Listen to active agents
  unsubscribeAgents = db.collection('agents')
    .where('active', '==', true)
    .onSnapshot(snapshot => {
      agents = [];
      snapshot.forEach(doc => {
        agents.push({
          id: doc.id,
          ...doc.data()
        });
      });
      renderAgentSelect();
    });
}

// Set up event listeners
function setupEventListeners() {
  // Chat selection
  chatsList.addEventListener('click', (e) => {
    const chatItem = e.target.closest('.chat-tile');
    if (chatItem) selectConversation(chatItem.dataset.phone);
  });

  // Message sending
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && messageInput.value.trim()) sendMessage();
  });

  // Search functionality
  searchInput.addEventListener('input', applyFilters);

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

  // Agent transfer
  transferBtn?.addEventListener('click', transferConversation);

  // Save notes
  saveNotes?.addEventListener('click', saveUserNotes);

  // Close modals when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettings();
    if (e.target === contactInfoModal) closeContactInfo();
    if (e.target === emojiPicker) emojiPicker.style.display = 'none';
  });
}

// Select conversation and load messages
function selectConversation(phoneNumber) {
  selectedConversation = phoneNumber;
  
  document.querySelectorAll('.chat-tile').forEach(item => {
    item.classList.toggle('active', item.dataset.phone === phoneNumber);
  });
  
  const conversation = conversations.find(c => c.id === phoneNumber);
  if (conversation) {
    chatTitle.textContent = conversation.profileName || 'Unknown';
    chatSubtitle.textContent = phoneNumber;
    updateUserDetails(conversation);
    chatWindowFooter.style.display = 'flex';
    aiEnabled = conversation.aiEnabled;
    updateAIToggleButton();
    
    // Update agent select
    if (agentSelect) {
      agentSelect.value = conversation.assignedAgent || '';
    }
  }
  
  // Load messages
  chatWindowContents.innerHTML = '<div class="loading-state"><p>Loading messages...</p></div>';
  if (unsubscribeMessages) unsubscribeMessages();
  
  unsubscribeMessages = db.collection('whatsapp_logs')
    .where('conversationId', '==', phoneNumber)
    .orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
      messages[phoneNumber] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        messages[phoneNumber].push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate() || new Date(),
          direction: data.senderId === currentUser.uid ? 'outgoing' : 'incoming'
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
    '<div class="empty-state"><p>No conversations yet</p></div>';
  
  const filteredConversations = applyFilters();
  
  filteredConversations.forEach(conversation => {
    const lastMessage = conversation.lastMessage || 'No messages yet';
    const lastActiveTime = formatTime(conversation.lastActive);
    const agent = conversation.assignedAgent ? 
      agents.find(a => a.id === conversation.assignedAgent) : null;
    
    const chatItem = document.createElement('div');
    chatItem.className = `chat-tile ${selectedConversation === conversation.id ? 'active' : ''}`;
    chatItem.dataset.phone = conversation.id;
    chatItem.innerHTML = `
      <img src="${conversation.photoURL || 'https://picsum.photos/id/103/50'}" alt="" class="chat-tile-avatar">
      <div class="chat-tile-details">
        <div class="chat-tile-title">
          <span>${conversation.profileName || conversation.id}</span>
          <span>${lastActiveTime}</span>
        </div>
        <div class="chat-tile-subtitle">
          <span>${truncate(lastMessage, 30)}</span>
          <span class="chat-tile-status ${conversation.status}">${conversation.status}</span>
        </div>
        ${agent ? `<div class="chat-tile-agent">Agent: ${agent.name}</div>` : ''}
      </div>
    `;
    chatsList.appendChild(chatItem);
  });
}

// Apply filters to conversations
function applyFilters() {
  const searchTerm = searchInput.value.toLowerCase();
  
  return conversations.filter(conversation => {
    return (conversation.profileName || '').toLowerCase().includes(searchTerm) ||
           conversation.id.includes(searchTerm) ||
           (conversation.lastMessage || '').toLowerCase().includes(searchTerm);
  });
}

// Render messages in chat window
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

// Update user details panel
function updateUserDetails(conversation) {
  if (!userDetailsContent) return;
  
  userDetailsContent.style.display = 'block';
  userName.textContent = conversation.profileName || 'Unknown';
  userPhone.textContent = conversation.id;
  lastActive.textContent = formatTime(conversation.lastActive, true);
  businessType.textContent = conversation.lastBusinessType || 'Not specified';
  userStatus.textContent = conversation.status || 'active';
  userNotes.value = conversation.notes || '';
}

// Render agent select dropdown
function renderAgentSelect() {
  if (!agentSelect) return;
  
  agentSelect.innerHTML = '<option value="">Unassigned</option>';
  agents.forEach(agent => {
    const option = document.createElement('option');
    option.value = agent.id;
    option.textContent = `${agent.name} (${agent.status || 'available'})`;
    option.disabled = agent.status !== 'available';
    agentSelect.appendChild(option);
  });
  
  if (selectedConversation) {
    const conversation = conversations.find(c => c.id === selectedConversation);
    if (conversation) {
      agentSelect.value = conversation.assignedAgent || '';
    }
  }
}

// Transfer conversation to another agent
async function transferConversation() {
  if (!selectedConversation || !agentSelect.value) return;
  
  try {
    await db.collection('users').doc(selectedConversation).update({
      assignedAgent: agentSelect.value,
      status: 'assigned',
      aiEnabled: false,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Update local state
    const conversation = conversations.find(c => c.id === selectedConversation);
    if (conversation) {
      conversation.assignedAgent = agentSelect.value;
      conversation.status = 'assigned';
      conversation.aiEnabled = false;
      renderConversations();
      updateUserDetails(conversation);
    }
  } catch (error) {
    console.error('Transfer error:', error);
  }
}

// Toggle AI mode
async function toggleAI() {
  if (!selectedConversation) return;
  
  try {
    const newAIState = !aiEnabled;
    await db.collection('users').doc(selectedConversation).update({
      aiEnabled: newAIState,
      status: newAIState ? 'ai' : 'assigned',
      assignedAgent: newAIState ? null : agentSelect.value,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Update local state
    aiEnabled = newAIState;
    const conversation = conversations.find(c => c.id === selectedConversation);
    if (conversation) {
      conversation.aiEnabled = newAIState;
      conversation.status = newAIState ? 'ai' : 'assigned';
      conversation.assignedAgent = newAIState ? null : agentSelect.value;
      renderConversations();
      updateUserDetails(conversation);
    }
    updateAIToggleButton();
  } catch (error) {
    console.error('AI toggle error:', error);
  }
}

// Update AI toggle button appearance
function updateAIToggleButton() {
  if (!aiToggleBtn) return;
  aiToggleBtn.classList.toggle('ai-toggle-on', aiEnabled);
  aiToggleBtn.classList.toggle('ai-toggle-off', !aiEnabled);
}

// Save user notes
async function saveUserNotes() {
  if (!selectedConversation) return;
  
  try {
    await db.collection('users').doc(selectedConversation).update({
      notes: userNotes.value,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Update local state
    const conversation = conversations.find(c => c.id === selectedConversation);
    if (conversation) {
      conversation.notes = userNotes.value;
    }
  } catch (error) {
    console.error('Save notes error:', error);
  }
}

// Send message
async function sendMessage() {
  const messageText = messageInput.value.trim();
  if (!messageText || !selectedConversation) return;
  
  try {
    // Add message to Firestore
    await db.collection('whatsapp_logs').add({
      conversationId: selectedConversation,
      senderId: currentUser.uid,
      senderName: currentUser.displayName || 'Agent',
      senderPhotoURL: currentUser.photoURL,
      text: messageText,
      direction: 'outgoing',
      status: 'sent',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Update conversation last message
    await db.collection('users').doc(selectedConversation).update({
      lastMessage: messageText,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    messageInput.value = '';
  } catch (error) {
    console.error('Send message error:', error);
  }
}

// Modal functions
function openSettings() {
  if (settingsModal) settingsModal.style.display = 'block';
}

function closeSettings() {
  if (settingsModal) settingsModal.style.display = 'none';
}

function openContactInfo() {
  if (contactInfoModal) contactInfoModal.style.display = 'block';
}

function closeContactInfo() {
  if (contactInfoModal) contactInfoModal.style.display = 'none';
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

// Update connection status UI
function updateConnectionStatus(connected) {
  const notification = document.getElementById('connectivity-notification');
  if (notification) {
    notification.style.display = connected ? 'none' : 'flex';
    connectionStatus.textContent = connected ? 'Connected to chats' : 'Connection lost. Reconnecting...';
  }
}

// Helper functions
function formatDate(date) {
  if (!date) return '';
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatTime(date, fullDate = false) {
  if (!date) return '';
  return fullDate ? 
    date.toLocaleString() : 
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function truncate(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Initialize the app
document.addEventListener('DOMContentLoaded', initApp);
