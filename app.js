let currentAgent = '';
let currentChatId = '';
let chatData = {};

function setAgent() {
  currentAgent = document.getElementById('agentName').value.trim();
  if (currentAgent) {
    loadChats();
  }
}

function loadChats() {
  db.collection('users').onSnapshot(snapshot => {
    const chatList = document.getElementById('chatList');
    chatList.innerHTML = '';
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.closed && (!data.assignedTo || data.assignedTo === currentAgent)) {
        const li = document.createElement('li');
        li.textContent = `${data.profileName || doc.id} (${doc.id})`;
        li.onclick = () => openChat(doc.id);
        chatList.appendChild(li);
      }
    });
  });
}

function openChat(chatId) {
  currentChatId = chatId;
  chatData = {};
  document.getElementById('chatBox').innerHTML = '';
  document.getElementById('chatHeader').textContent = `Chat with ${chatId}`;

  db.collection('users').doc(chatId).set({ assignedTo: currentAgent }, { merge: true });

  db.collection('whatsapp_logs')
    .where('from', '==', chatId)
    .orderBy('timestamp')
    .onSnapshot(snapshot => {
      const chatBox = document.getElementById('chatBox');
      chatBox.innerHTML = '';
      snapshot.forEach(doc => {
        const msg = doc.data();
        const div = document.createElement('div');
        div.textContent = `${msg.type === 'text' ? msg.message.text?.body : '[Interactive]'}`;
        chatBox.appendChild(div);
      });
    });
}

function sendAgentReply() {
  const text = document.getElementById('messageInput').value.trim();
  if (!text || !currentChatId) return;

  fetch('/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: currentChatId, message: text })
  });

  document.getElementById('messageInput').value = '';
}

function closeChat() {
  if (currentChatId) {
    db.collection('users').doc(currentChatId).update({
      closed: true,
      closedBy: currentAgent
    });
  }
}

function returnToBot() {
  if (currentChatId) {
    db.collection('users').doc(currentChatId).update({
      assignedTo: null,
      closed: false
    });
  }
}