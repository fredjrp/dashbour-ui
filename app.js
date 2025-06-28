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

// DOM Elements (safe access)
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

// App state
let currentUser = null;
let selectedConversation = null;
let conversations = [];
let messages = {};
let unsubscribeConversations = null;
let unsubscribeMessages = null;

// App entry point
function initApp() {
  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      if (authButton) authButton.textContent = 'Sign Out';
      setupRealTimeListeners();
    } else {
      currentUser = null;
      if (authButton) authButton.textContent = 'Sign In';
      if (unsubscribeConversations) unsubscribeConversations();
      if (unsubscribeMessages) unsubscribeMessages();
      clearConversations();
    }
  });

  if (authButton) {
    authButton.addEventListener('click', () => {
      if (currentUser) {
        auth.signOut();
      } else {
        auth.signInWithEmailAndPassword('juniorokovagng@gmail.com', 'mlnkbjvhcgxfzd')
          .catch(error => {
            console.error('❌ Authentication failed:', error);
            alert('Login error: ' + error.message);
          });
      }
    });
  }

  if (conversationList) {
    conversationList.addEventListener('click', (e) => {
      const item = e.target.closest('.conversation-item');
      if (item) {
        const phone = item.dataset.phone;
        selectConversation(phone);
      }
    });
  }

  if (sendButton) sendButton.addEventListener('click', sendMessage);
  if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  if (transferBtn) transferBtn.addEventListener('click', transferToHuman);
  if (aiBtn) aiBtn.addEventListener('click', switchToAI);
  if (saveNotes) saveNotes.addEventListener('click', saveUserNotes);
}

// Real-time Firestore listener
function setupRealTimeListeners() {
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
          lastActive: data.lastActive?.toDate ? data.lastActive.toDate() : new Date(data.lastActive || Date.now())
        });
      });
      renderConversations();
    }, error => console.error('❌ Firestore listener error:', error));
}

// Render UI: Conversations
function renderConversations() {
  if (!conversationList) return;
  conversationList.innerHTML = conversations.length ? '' : '<div class="empty-state"><p>No conversations found</p></div>';

  conversations.forEach(convo => {
    const last = convo.lastMessage || 'No messages yet';
    const lastSeen = formatTime(convo.lastActive);
    const item = document.createElement('div');
    item.className = `conversation-item ${selectedConversation === convo.id ? 'active' : ''}`;
    item.dataset.phone = convo.id;
    item.innerHTML = `
      <div class="conversation-avatar">${(convo.profileName || '?')[0].toUpperCase()}</div>
      <div class="conversation-info">
        <div class="conversation-name">${convo.profileName || convo.id}</div>
        <div class="conversation-preview">${truncate(last, 30)}</div>
      </div>
      <div class="conversation-time">${lastSeen}</div>
    `;
    conversationList.appendChild(item);
  });
}

// Select a conversation
function selectConversation(phoneNumber) {
  selectedConversation = phoneNumber;
  if (!phoneNumber) return;

  document.querySelectorAll('.conversation-item').forEach(el =>
    el.classList.toggle('active', el.dataset.phone === phoneNumber)
  );

  const convo = conversations.find(c => c.id === phoneNumber);
  if (convo) {
    if (currentChatName) currentChatName.textContent = convo.profileName || 'Unknown';
    if (currentChatNumber) currentChatNumber.textContent = convo.id;
    updateUserDetails(convo);
  } else {
    currentChatName.textContent = phoneNumber;
    currentChatNumber.textContent = phoneNumber;
  }

  if (messageInputContainer) messageInputContainer.style.display = 'flex';
  [messageInput, sendButton, transferBtn, aiBtn].forEach(el => el && (el.disabled = false));

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
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp || Date.now())
        });
      });
      renderMessages(phoneNumber);
    }, err => console.error('❌ Message load error:', err));
}

// Render messages
function renderMessages(phoneNumber) {
  if (!messageContainer) return;
  const msgList = messages[phoneNumber];
  if (!msgList?.length) {
    messageContainer.innerHTML = '<div class="empty-state"><p>No messages in this conversation</p></div>';
    return;
  }

  messageContainer.innerHTML = '';

  msgList.forEach(msg => {
    const isOut = msg.direction === 'outgoing';
    const time = formatTime(msg.timestamp);
    let content = '';

    if (msg.type === 'text') {
      content = msg.text?.body || msg.message?.text?.body || msg.message?.body || '[Text]';
    } else if (msg.type === 'interactive') {
      const int = msg.interactive || msg.message?.interactive;
      if (int?.type === 'button_reply') {
        content = `[Button] ${int.button_reply?.title || int.button_reply?.id}`;
      } else if (int?.type === 'list_reply') {
        content = `[List] ${int.list_reply?.title || int.list_reply?.id}`;
      } else {
        content = `[Interactive] ${JSON.stringify(int).slice(0, 100)}...`;
      }
    } else if (msg.message) {
      content = `[${msg.type}] ${JSON.stringify(msg.message).slice(0, 100)}...`;
    } else {
      content = `[Unknown: ${msg.type}]`;
    }

    const el = document.createElement('div');
    el.className = `message ${isOut ? 'message-outgoing' : 'message-incoming'}`;
    el.innerHTML = `<div class="message-content">${content}</div><div class="message-time">${time}</div>`;
    messageContainer.appendChild(el);
  });

  messageContainer.scrollTop = messageContainer.scrollHeight;
}

// Update user profile panel
function updateUserDetails(convo) {
  if (!userDetailsContent) return;
  userDetailsContent.style.display = 'block';
  if (userName) userName.textContent = convo.profileName || 'Unknown';
  if (userPhone) userPhone.textContent = convo.id;
  if (lastActive) lastActive.textContent = formatTime(convo.lastActive, true);
  if (businessType) businessType.textContent = convo.lastBusinessType?.replace('biz_', '').replace('_', ' ') || 'Not specified';
  if (userStatus) userStatus.textContent = convo.status || 'active';
  if (userNotes) userNotes.value = convo.notes || '';
}

// Send message
function sendMessage() {
  const text = messageInput?.value.trim();
  if (!text || !selectedConversation) return;
  console.log(`📤 Sending message to ${selectedConversation}:`, text);
  messageInput.value = '';
}

// Transfer buttons
function transferToHuman() {
  if (!selectedConversation) return;
  alert(`Conversation transferred to human.`);
  transferBtn.disabled = true;
  aiBtn.disabled = false;
}

function switchToAI() {
  if (!selectedConversation) return;
  alert(`Conversation switched to AI.`);
  transferBtn.disabled = false;
  aiBtn.disabled = true;
}

// Save user notes
function saveUserNotes() {
  if (!selectedConversation) return;
  const notes = userNotes?.value;
  db.collection('users').doc(selectedConversation).update({
    notes,
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => alert('✅ Notes saved.')).catch(err => alert('❌ Failed to save notes: ' + err.message));
}

// Helpers
function formatTime(ts, full = false) {
  if (!ts) return 'Unknown';
  const d = ts instanceof Date ? ts : new Date(ts);
  return full ? d.toLocaleString() : d.toLocaleTimeString();
}

function truncate(text, max) {
  return text?.length > max ? text.slice(0, max) + '...' : text;
}

function clearConversations() {
  if (conversationList) conversationList.innerHTML = '<div class="empty-state"><p>Sign in to view conversations</p></div>';
  if (messageContainer) messageContainer.innerHTML = '<div class="empty-state"><p>Select a conversation</p></div>';
  if (currentChatName) currentChatName.textContent = 'Select a conversation';
  if (currentChatNumber) currentChatNumber.textContent = '';
  if (userDetailsContent) userDetailsContent.style.display = 'none';
  if (messageInputContainer) messageInputContainer.style.display = 'none';
  [transferBtn, aiBtn].forEach(btn => btn && (btn.disabled = true));
}

// Start app
document.addEventListener('DOMContentLoaded', initApp);
