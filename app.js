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

// Target user
const targetPhoneNumber = "254703738935";

// DOM Elements
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

// App Init
function initApp() {
  loadOrCreateUser();
  sendButton.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') sendMessage();
  });
  transferBtn.addEventListener('click', transferToHuman);
  aiBtn.addEventListener('click', switchToAI);
  saveNotes.addEventListener('click', saveUserNotes);
}

// Load user or create if not exists
function loadOrCreateUser() {
  const userRef = db.collection('users').doc(targetPhoneNumber);
  userRef.get().then(doc => {
    if (!doc.exists) {
      return userRef.set({
        profileName: "Fred Auto",
        lastActive: firebase.firestore.FieldValue.serverTimestamp(),
        status: "active",
        notes: "",
        lastMessage: "This is a test message"
      }).then(() => userRef.get());
    } else {
      return doc;
    }
  }).then(doc => {
    const data = doc.data();
    const conversation = {
      id: doc.id,
      ...data,
      lastActive: data.lastActive?.toDate ? data.lastActive.toDate() : new Date()
    };
    renderSingleConversation(conversation);
    selectConversation(conversation);
  }).catch(error => {
    console.error("Error loading or creating user:", error);
    conversationList.innerHTML = "<p>⚠️ Failed to load user</p>";
  });
}

function renderSingleConversation(convo) {
  const item = document.createElement('div');
  item.className = 'conversation-item active';
  item.dataset.phone = convo.id;
  item.innerHTML = `
    <div class="conversation-avatar">${(convo.profileName || '?')[0].toUpperCase()}</div>
    <div class="conversation-info">
      <div class="conversation-name">${convo.profileName || convo.id}</div>
      <div class="conversation-preview">${truncate(convo.lastMessage || '', 30)}</div>
    </div>
    <div class="conversation-time">${formatTime(convo.lastActive)}</div>
  `;
  conversationList.innerHTML = "";
  conversationList.appendChild(item);
}

function selectConversation(convo) {
  currentChatName.textContent = convo.profileName || "User";
  currentChatNumber.textContent = convo.id;
  updateUserDetails(convo);

  messageInputContainer.style.display = 'flex';
  [messageInput, sendButton, transferBtn, aiBtn].forEach(el => el.disabled = false);

  if (unsubscribeMessages) unsubscribeMessages();
  unsubscribeMessages = db.collection('whatsapp_logs')
    .where('from', '==', convo.id)
    .orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
      messages[convo.id] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        messages[convo.id].push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date()
        });
      });
      renderMessages(convo.id);
    });
}

function renderMessages(phoneNumber) {
  const list = messages[phoneNumber];
  if (!list?.length) {
    messageContainer.innerHTML = '<div class="empty-state"><p>No messages found</p></div>';
    return;
  }

  messageContainer.innerHTML = '';
  list.forEach(msg => {
    const isOut = msg.direction === 'outgoing';
    const time = formatTime(msg.timestamp);
    let content = '[Unknown]';

    if (msg.type === 'text') {
      content = msg.text?.body || msg.message?.text?.body || '[Text]';
    } else if (msg.type === 'interactive') {
      const i = msg.interactive || msg.message?.interactive;
      content = `[${i?.type}] ${JSON.stringify(i).slice(0, 50)}...`;
    }

    const div = document.createElement('div');
    div.className = `message ${isOut ? 'message-outgoing' : 'message-incoming'}`;
    div.innerHTML = `<div class="message-content">${content}</div><div class="message-time">${time}</div>`;
    messageContainer.appendChild(div);
  });

  messageContainer.scrollTop = messageContainer.scrollHeight;
}

function updateUserDetails(c) {
  userDetailsContent.style.display = 'block';
  userName.textContent = c.profileName || 'User';
  userPhone.textContent = c.id;
  lastActive.textContent = formatTime(c.lastActive, true);
  businessType.textContent = c.lastBusinessType || 'Not specified';
  userStatus.textContent = c.status || 'active';
  userNotes.value = c.notes || '';
}

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;
  console.log("Would send:", text);
  messageInput.value = '';
}

function transferToHuman() {
  alert("Transferred to human");
  transferBtn.disabled = true;
  aiBtn.disabled = false;
}

function switchToAI() {
  alert("Switched to AI");
  aiBtn.disabled = true;
  transferBtn.disabled = false;
}

function saveUserNotes() {
  const notes = userNotes.value;
  db.collection('users').doc(targetPhoneNumber).update({
    notes,
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    alert("✅ Notes saved");
  }).catch(err => {
    alert("❌ Failed to save notes");
  });
}

function formatTime(date, full = false) {
  const d = date instanceof Date ? date : new Date(date);
  return full ? d.toLocaleString() : d.toLocaleTimeString();
}

function truncate(text, max) {
  return text.length > max ? text.slice(0, max) + "..." : text;
}

document.addEventListener('DOMContentLoaded', initApp);
