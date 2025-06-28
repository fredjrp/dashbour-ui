// ✅ Firebase Config
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

// ✅ Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// ✅ DOM References
const conversationList = document.getElementById('conversation-list');
const messageContainer = document.getElementById('message-container');
const currentChatName = document.getElementById('current-chat-name');
const currentChatNumber = document.getElementById('current-chat-number');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messageInputContainer = document.getElementById('message-input-container');

// ✅ Static user for now
const selectedPhoneNumber = "254703738935";

// ✅ Auto Load on DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  loadUserConversation(selectedPhoneNumber);
});

// ✅ Load Specific User Conversation
function loadUserConversation(phone) {
  console.log("📥 Fetching user:", phone);

  db.collection('users').doc(phone).get()
    .then(doc => {
      if (!doc.exists) {
        conversationList.innerHTML = `<p>User ${phone} not found.</p>`;
        return;
      }

      const userData = doc.data();
      console.log("✅ User found:", userData);

      currentChatName.textContent = userData.profileName || "Unknown User";
      currentChatNumber.textContent = phone;

      conversationList.innerHTML = `
        <div class="conversation-item active">
          <div class="conversation-avatar">${(userData.profileName || "?").charAt(0)}</div>
          <div class="conversation-info">
            <div class="conversation-name">${userData.profileName || phone}</div>
            <div class="conversation-preview">${userData.lastMessage || "No preview"}</div>
          </div>
        </div>
      `;

      messageInputContainer.style.display = 'flex';
      messageInput.disabled = false;
      sendButton.disabled = false;

      subscribeToMessages(phone);
    })
    .catch(error => {
      console.error("❌ Error fetching user:", error);
      conversationList.innerHTML = `<p>Error loading user.</p>`;
    });
}

// ✅ Subscribe to Messages in Real-Time
function subscribeToMessages(phone) {
  console.log("📨 Subscribing to messages for:", phone);

  db.collection('whatsapp_logs')
    .where('from', '==', phone)
    .orderBy('timestamp')
    .onSnapshot(snapshot => {
      if (snapshot.empty) {
        messageContainer.innerHTML = `<p>No messages yet for ${phone}</p>`;
        return;
      }

      messageContainer.innerHTML = "";

      snapshot.forEach(doc => {
        const msg = doc.data();
        const isOutgoing = msg.direction === 'outgoing';
        const time = formatTime(msg.timestamp?.toDate?.() || new Date());

        let content = '[Message]';
        if (msg.type === 'text') {
          content = msg.text?.body || msg.message?.text?.body || '[Empty text]';
        } else if (msg.type === 'interactive') {
          content = `[Interactive] ${JSON.stringify(msg.interactive || msg.message?.interactive || {})}`;
        }

        const div = document.createElement('div');
        div.className = `message ${isOutgoing ? 'message-outgoing' : 'message-incoming'}`;
        div.innerHTML = `
          <div class="message-content">${content}</div>
          <div class="message-time">${time}</div>
        `;
        messageContainer.appendChild(div);
      });

      messageContainer.scrollTop = messageContainer.scrollHeight;
    }, error => {
      console.error("❌ Error loading messages:", error);
      messageContainer.innerHTML = `<p>Error loading messages</p>`;
    });
}

// ✅ Optional: Send Message Stub (UI only)
sendButton.addEventListener('click', () => {
  const messageText = messageInput.value.trim();
  if (!messageText) return;

  console.log("📤 Simulated send:", messageText);
  messageInput.value = '';
});

function formatTime(date) {
  return new Date(date).toLocaleTimeString();
}
