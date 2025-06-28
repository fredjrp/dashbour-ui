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

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// WhatsApp number to load
const targetPhoneNumber = "254703738935";

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
const userDetailsContent = document.getElementById('user-details-content');
const userName = document.getElementById('user-name');
const userPhone = document.getElementById('user-phone');
const lastActive = document.getElementById('last-active');
const businessType = document.getElementById('business-type');
const userStatus = document.getElementById('user-status');
const userNotes = document.getElementById('user-notes');
const saveNotes = document.getElementById('save-notes');

let messages = {};
let unsubscribeMessages = null;

// Initialize app
function initApp() {
  loadTargetConversation();
  sendButton.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  transferBtn.addEventListener('click', transferToHuman);
  aiBtn.addEventListener('click', switchToAI);
  saveNotes.addEventListener('click', saveUserNotes);
}

// Load one specific conversation
function loadTargetConversation() {
  db.collection('users').doc(targetPhoneNumber).get().then(doc => {
    if (doc.exists) {
      const data = doc.data();
      const conversation = {
        id: doc.id,
        ...data,
        lastActive: data.lastActive?.toDate ? data.lastActive.toDate() : new Date(data.lastActive || Date.now())
      };

      renderSingleConversation(conversation);
      selectConversation(conversation);
    } else {
      conversationList.innerHTML = `<p>No data found for ${targetPhoneNumber}</p>`;
    }
  }).catch(err => {
    console.error("🔥 Error loading conversation:", err);
    conversationList.innerHTML = `<p>Error loading user</p>`;
  });
}

function renderSingleConversation(conversation) {
  const lastMessage = conversation.lastMessage || 'No messages yet';
  const lastActiveTime = formatTime(conversation.lastActive);
  const item = document.createElement('div');
  item.className = 'conversation-item active';
  item.dataset.phone = conversation.id;
  item.innerHTML = `
    <div class="conversation-avatar">${(conversation.profileName || '?')[0].toUpperCase()}</div>
    <div class="conversation-info">
      <div class="conversation-name">${conversation.profileName || conversation.id}</div>
      <div class="conversation-preview">${truncate(lastMessage, 30)}</div>
    </div>
    <div class="conversation-time">${lastActiveTime}</div>
  `;
  conversationList.appendChild(item);
}

function selectConversation(conversation) {
  currentChatName.textContent = conversation.profileName || 'Unknown';
  currentChatNumber.textContent = conversation.id;
  updateUserDetails(conversation);

  messageInputContainer.style.display = 'flex';
  [messageInput, sendButton, transferBtn, aiBtn].forEach(el => el.disabled = false);

  if (unsubscribeMessages) unsubscribeMessages();

  unsubscribeMessages = db.collection('whatsapp_logs')
    .where('from', '==', conversation.id)
    .orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
      messages[conversation.id] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        messages[conversation.id].push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp || Date.now())
        });
      });
      renderMessages(conversation.id);
    }, err => console.error('🔥 Message fetch error:', err));
}

function renderMessages(phoneNumber) {
  const msgList = messages[phoneNumber];
  if (!msgList?.length) {
    messageContainer.innerHTML = '<div class="empty-state"><p>No messages yet</p></div>';
    return;
  }

  messageContainer.innerHTML = '';
  msgList.forEach(msg => {
    const isOut = msg.direction === 'outgoing';
    const time = formatTime(msg.timestamp);
    let content = '[Unknown]';

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
    }

    const el = document.createElement('div');
    el.className = `message ${isOut ? 'message-outgoing' : 'message-incoming'}`;
    el.innerHTML = `<div class="message-content">${content}</div><div class="message-time">${time}</div>`;
    messageContainer.appendChild(el);
  });

  messageContainer.scrollTop = messageContainer.scrollHeight;
}

function updateUserDetails(convo) {
  userDetailsContent.style.display = 'block';
  userName.textContent = convo.profileName || 'Unknown';
  userPhone.textContent = convo.id;
  lastActive.textContent = formatTime(convo.lastActive, true);
  businessType.textContent = convo.lastBusinessType?.replace('biz_', '').replace('_', ' ') || 'Not specified';
  userStatus.textContent = convo.status || 'active';
  userNotes.value = convo.notes || '';
}

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;
  console.log("📤 Would send message:", text);
  messageInput.value = '';
}

function transferToHuman() {
  alert("Conversation transferred to human");
  transferBtn.disabled = true;
  aiBtn.disabled = false;
}

function switchToAI() {
  alert("Switched to AI mode");
  transferBtn.disabled = false;
  aiBtn.disabled = true;
}

function saveUserNotes() {
  const notes = userNotes.value;
  db.collection('users').doc(targetPhoneNumber).update({
    notes,
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    alert('✅ Notes saved');
  }).catch(err => {
    alert('❌ Error saving notes: ' + err.message);
  });
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

document.addEventListener('DOMContentLoaded', initApp);
