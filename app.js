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
const analyticsCharts = {
    conversationsOverTime: null,
    statusDistribution: null,
    businessTypeDistribution: null,
    responseTimeTrends: null
};

// Initialize FirebaseUI
const uiConfig = {
  signInSuccessUrl: '/',
  signInOptions: [
    firebase.auth.EmailAuthProvider.PROVIDER_ID,
    firebase.auth.GoogleAuthProvider.PROVIDER_ID
  ],
  tosUrl: '/terms-of-service',
  privacyPolicyUrl: '/privacy-policy',
  signInFlow: 'popup'
};
const ui = new firebaseui.auth.AuthUI(firebase.auth());

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
const authButton = document.getElementById('auth-button');
const userDetailsContent = document.getElementById('user-details-content');
const userName = document.getElementById('user-name');
const userPhone = document.getElementById('user-phone');
const lastActive = document.getElementById('last-active');
const businessType = document.getElementById('business-type');
const userStatus = document.getElementById('user-status');
const userNotes = document.getElementById('user-notes');
const saveNotes = document.getElementById('save-notes');
const filterBusinessType = document.getElementById('filter-business-type');
const filterStatus = document.getElementById('filter-status');
const searchInput = document.getElementById('search-input');
const agentSelect = document.getElementById('agent-select');
const analyticsContainer = document.getElementById('analytics-container');
const toggleAnalyticsBtn = document.getElementById('toggle-analytics-btn');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');

// State variables
let currentUser = null;
let selectedConversation = null;
let conversations = [];
let messages = {};
let agents = [];
let unsubscribeConversations = null;
let unsubscribeMessages = null;
let unsubscribeAgents = null;
let analyticsData = {
  totalConversations: 0,
  messagesToday: 0,
  avgResponseTime: 0,
  businessTypeDistribution: {}
};

// Agent Control Functions
async function assignToAgent(phoneNumber, agentId) {
  try {
    const response = await fetch('https://aisassistantdvdhs.onrender.com/agent-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign', phoneNumber, agentId }),
    });
    if (!response.ok) throw new Error('Assignment failed');
    
    // Update local state immediately
    const conversation = conversations.find(c => c.id === phoneNumber);
    if (conversation) {
      conversation.assignedAgent = agentId;
      conversation.status = 'assigned';
      conversation.aiEnabled = false;
      renderConversations();
      if (phoneNumber === selectedConversation) {
        updateUserDetails(conversation);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Assignment error:', error);
    showErrorToast('Failed to assign agent');
    return false;
  }
}

async function toggleAI(phoneNumber) {
  try {
    const response = await fetch('https://your-render-app.onrender.com/agent-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_ai', phoneNumber }),
    });
    if (!response.ok) throw new Error('AI toggle failed');
    
    // Update local state immediately
    const conversation = conversations.find(c => c.id === phoneNumber);
    if (conversation) {
      conversation.aiEnabled = !conversation.aiEnabled;
      conversation.status = conversation.aiEnabled ? 'ai' : 'assigned';
      conversation.assignedAgent = conversation.aiEnabled ? null : conversation.assignedAgent;
      renderConversations();
      if (phoneNumber === selectedConversation) {
        updateUserDetails(conversation);
      }
    }
    
    return true;
  } catch (error) {
    console.error('AI toggle error:', error);
    showErrorToast('Failed to toggle AI');
    return false;
  }
}

function showErrorToast(message) {
  const toast = document.createElement('div');
  toast.className = 'error-toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Initialize the app
function initApp() {
  auth.onAuthStateChanged(user => {
    if (user) {
      console.log('User signed in:', user.email || 'Anonymous');
      currentUser = user;
      authButton.textContent = 'Sign Out';

      document.getElementById('auth-container').style.display = 'none';
      document.getElementById('app-container').style.display = 'flex';

      setupRealTimeListeners();
      loadAnalyticsData();
    } else {
      // Show auth UI
      document.getElementById('auth-container').style.display = 'flex';
      document.getElementById('app-container').style.display = 'none';

      // Hide forms initially
      document.getElementById('login-form').style.display = 'none';
      document.getElementById('signup-form').style.display = 'none';
    }
  });

  // Toggle between login and signup views
  document.getElementById('show-login').addEventListener('click', () => {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('signup-form').style.display = 'none';
  });

  document.getElementById('show-signup').addEventListener('click', () => {
    document.getElementById('signup-form').style.display = 'block';
    document.getElementById('login-form').style.display = 'none';
  });

  // Sign In handler
  document.getElementById('login-button').addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    firebase.auth().signInWithEmailAndPassword(email, password)
      .then(userCredential => {
        afterAuth(userCredential.user);
      })
      .catch(error => {
        document.getElementById('login-error').textContent = error.message;
      });
  });

  // Sign Up handler
  document.getElementById('signup-button').addEventListener('click', () => {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    firebase.auth().createUserWithEmailAndPassword(email, password)
      .then(userCredential => {
        afterAuth(userCredential.user);
      })
      .catch(error => {
        document.getElementById('signup-error').textContent = error.message;
      });
  });

  // Logout handler
  authButton.addEventListener('click', () => {
    if (currentUser) {
      firebase.auth().signOut();
    }
  });
}

// Handle post-auth UI setup
function afterAuth(user) {
  currentUser = user;
  document.getElementById('auth-container').style.display = 'none';
  document.getElementById('app-container').style.display = 'flex';
  authButton.textContent = 'Sign Out';

  setupRealTimeListeners();
  loadAnalyticsData();
}

  conversationList.addEventListener('click', (e) => {
      const conversationItem = e.target.closest('.conversation-item');
      if (conversationItem) {
          const phoneNumber = conversationItem.dataset.phone;
          selectConversation(phoneNumber);
      }
  });

  sendButton.addEventListener('click', sendMessage);
  messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
  });

  document.getElementById('transfer-btn').addEventListener('click', async () => {
      const agentId = document.getElementById('agent-select').value;
      if (selectedConversation && agentId) {
          await assignToAgent(selectedConversation, agentId);
      }
  });

  document.getElementById('ai-btn').addEventListener('click', async () => {
      if (selectedConversation) {
          await toggleAI(selectedConversation);
      }
  });

  saveNotes.addEventListener('click', saveUserNotes);
  filterBusinessType.addEventListener('change', applyFilters);
  filterStatus.addEventListener('change', applyFilters);
  searchInput.addEventListener('input', applyFilters);
  agentSelect.addEventListener('change', updateAgentAssignment);
  toggleAnalyticsBtn.addEventListener('click', toggleAnalytics);
}

// Set up real-time Firestore listeners
function setupRealTimeListeners() {
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
                  lastActive: data.lastActive?.toDate ? data.lastActive.toDate() : new Date(data.lastActive || Date.now()),
                  assignedAgent: data.assignedAgent || null,
                  status: data.status || 'active',
                  aiEnabled: data.aiEnabled !== false // Default to true if not set
              });
          });
          analyticsData.totalConversations = conversations.length;
          updateBusinessTypeDistribution();
          renderConversations();
      }, error => {
          console.error('Conversations listener error:', error);
      });
      
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

// Load analytics data
function loadAnalyticsData() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  db.collection('whatsapp_logs')
      .where('timestamp', '>=', yesterday)
      .get()
      .then(snapshot => {
          analyticsData.messagesToday = snapshot.size;
          renderAnalytics();
      });
  
  db.collection('response_times')
      .get()
      .then(snapshot => {
          let total = 0;
          let count = 0;
          snapshot.forEach(doc => {
              total += doc.data().time;
              count++;
          });
          analyticsData.avgResponseTime = count > 0 ? Math.round(total / count) : 0;
          renderAnalytics();
      });
}

function updateBusinessTypeDistribution() {
  analyticsData.businessTypeDistribution = {};
  conversations.forEach(conv => {
      const type = conv.lastBusinessType || 'unknown';
      analyticsData.businessTypeDistribution[type] = (analyticsData.businessTypeDistribution[type] || 0) + 1;
  });
  renderAnalytics();
}

// Select conversation and load messages
function selectConversation(phoneNumber) {
  selectedConversation = phoneNumber;
  
  document.querySelectorAll('.conversation-item').forEach(item => {
      item.classList.toggle('active', item.dataset.phone === phoneNumber);
  });
  
  const conversation = conversations.find(c => c.id === phoneNumber);
  if (conversation) {
      currentChatName.textContent = conversation.profileName || 'Unknown';
      currentChatNumber.textContent = conversation.id;
      updateUserDetails(conversation);
      
      if (agentSelect.value !== conversation.assignedAgent) {
          agentSelect.value = conversation.assignedAgent || '';
      }
      
      // Update AI button state
      aiBtn.innerHTML = conversation.aiEnabled !== false ? 
          '<i class="fas fa-robot"></i><span>AI Mode (ON)</span>' : 
          '<i class="fas fa-robot"></i><span>AI Mode (OFF)</span>';
      aiBtn.classList.toggle('active', conversation.aiEnabled !== false);
  } else {
      currentChatName.textContent = phoneNumber;
      currentChatNumber.textContent = phoneNumber;
  }
  
  messageInputContainer.style.display = 'flex';
  [messageInput, sendButton, transferBtn, aiBtn].forEach(el => el.disabled = false);
  
  messageContainer.innerHTML = '';
  if (unsubscribeMessages) unsubscribeMessages();
  
  loadMessagesForConversation(phoneNumber);
}

// Load messages for a conversation
async function loadMessagesForConversation(phoneNumber) {
  try {
      const query = db.collection('whatsapp_logs')
          .where('from', '==', phoneNumber)
          .orderBy('timestamp', 'asc');
      
      const snapshot = await query.get();
      
      messages[phoneNumber] = [];
      snapshot.forEach(doc => {
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
      console.error('Error loading messages:', error);
      messageContainer.innerHTML = '<div class="empty-state"><p>Error loading messages. Please try again.</p></div>';
  }
}

// Render conversations list
function renderConversations() {
  conversationList.innerHTML = conversations.length ? '' : 
      '<div class="empty-state"><p>No conversations found</p></div>';
  
  const filteredConversations = applyFilters();
  
  filteredConversations.forEach(conversation => {
      const lastMessage = conversation.lastMessage || 'No messages yet';
      const lastActiveTime = formatTime(conversation.lastActive);
      const agent = conversation.assignedAgent ? 
          agents.find(a => a.id === conversation.assignedAgent) : null;
      
      const conversationItem = document.createElement('div');
      conversationItem.className = `conversation-item ${selectedConversation === conversation.id ? 'active' : ''}`;
      conversationItem.dataset.phone = conversation.id;
      conversationItem.innerHTML = `
          <div class="conversation-avatar">
              ${conversation.profileName ? conversation.profileName.charAt(0).toUpperCase() : '?'}
          </div>
          <div class="conversation-info">
              <div class="conversation-name">${conversation.profileName || conversation.id}</div>
              <div class="conversation-preview">${truncate(lastMessage, 30)}</div>
              ${agent ? `<div class="conversation-agent">Agent: ${agent.name}</div>` : ''}
          </div>
          <div class="conversation-meta">
              <div class="conversation-time">${lastActiveTime}</div>
              <div class="conversation-status ${conversation.status}">${conversation.status}</div>
          </div>
      `;
      conversationList.appendChild(conversationItem);
  });
}

function applyFilters() {
  const businessTypeFilter = filterBusinessType.value;
  const statusFilter = filterStatus.value;
  const searchTerm = searchInput.value.toLowerCase();
  
  return conversations.filter(conversation => {
      const matchesBusinessType = !businessTypeFilter || 
          (conversation.lastBusinessType || '').includes(businessTypeFilter);
      const matchesStatus = !statusFilter || 
          (conversation.status || 'active') === statusFilter;
      const matchesSearch = !searchTerm || 
          (conversation.profileName || '').toLowerCase().includes(searchTerm) ||
          conversation.id.includes(searchTerm) ||
          (conversation.lastMessage || '').toLowerCase().includes(searchTerm);
          
      return matchesBusinessType && matchesStatus && matchesSearch;
  });
}

// Render messages in the message container
function renderMessages(phoneNumber) {
  if (!messages[phoneNumber]?.length) {
      messageContainer.innerHTML = '<div class="empty-state"><p>No messages in this conversation</p></div>';
      return;
  }

  messageContainer.innerHTML = '';

  messages[phoneNumber].forEach(msg => {
      const isOutgoing = msg.direction === 'outgoing';
      const messageTime = formatTime(msg.timestamp);
      let messageContent = '';

      if (msg.type === 'text') {
          messageContent = msg.text?.body || msg.message?.text?.body || msg.message?.body || '[Text]';
      } else if (msg.type === 'interactive') {
          const interactive = msg.interactive || msg.message?.interactive;
          if (interactive?.type === 'button_reply') {
              messageContent = `[Button] ${interactive.button_reply?.title || interactive.button_reply?.id}`;
          } else if (interactive?.type === 'list_reply') {
              messageContent = `[List] ${interactive.list_reply?.title || interactive.list_reply?.id}`;
          } else {
              messageContent = `[Interactive] ${JSON.stringify(interactive).slice(0, 100)}...`;
          }
      } else if (msg.message) {
          messageContent = `[${msg.type}] ${JSON.stringify(msg.message).slice(0, 100)}...`;
      } else {
          messageContent = `[Unknown message type: ${msg.type}]`;
      }

      const messageElement = document.createElement('div');
      messageElement.className = `message ${isOutgoing ? 'message-outgoing' : 'message-incoming'}`;
      messageElement.innerHTML = `
          <div class="message-content">${messageContent}</div>
          <div class="message-time">${messageTime}</div>
          ${isOutgoing ? `<div class="message-status">${msg.status || 'sent'}</div>` : ''}
      `;
      messageContainer.appendChild(messageElement);
  });

  messageContainer.scrollTop = messageContainer.scrollHeight;
}

// Update user details panel
function updateUserDetails(conversation) {
  userDetailsContent.style.display = 'block';
  userName.textContent = conversation.profileName || 'Unknown';
  userPhone.textContent = conversation.id;
  lastActive.textContent = formatTime(conversation.lastActive, true);
  businessType.textContent = conversation.lastBusinessType ? 
      conversation.lastBusinessType.replace('biz_', '').replace('_', ' ') : 'Not specified';
  userStatus.textContent = conversation.status || 'active';
  userNotes.value = conversation.notes || '';
  
  // Update AI button state
  aiBtn.innerHTML = conversation.aiEnabled !== false ? 
      '<i class="fas fa-robot"></i><span>AI Mode (ON)</span>' : 
      '<i class="fas fa-robot"></i><span>AI Mode (OFF)</span>';
  aiBtn.classList.toggle('active', conversation.aiEnabled !== false);
}

// Render agent select dropdown
function renderAgentSelect() {
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

// Update agent assignment
function updateAgentAssignment() {
  if (!selectedConversation) return;
  
  const agentId = agentSelect.value;
  db.collection('users').doc(selectedConversation).update({
      assignedAgent: agentId || null,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
      console.log('Agent assignment updated');
  }).catch(error => {
      console.error('Error updating agent assignment:', error);
      showErrorToast('Failed to update agent assignment');
  });
}

// Save user notes
function saveUserNotes() {
  if (!selectedConversation) return;
  const notes = userNotes.value;
  
  db.collection('users').doc(selectedConversation).update({
      notes: notes,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
      console.log('Notes saved successfully');
  }).catch(error => {
      console.error('Error saving notes:', error);
      showErrorToast('Failed to save notes');
  });
}

// Send message
function sendMessage() {
  const messageText = messageInput.value.trim();
  if (!messageText || !selectedConversation) return;
  
  const tempId = 'temp-' + Date.now();
  const tempMessage = {
      id: tempId,
      from: selectedConversation,
      direction: 'outgoing',
      type: 'text',
      text: { body: messageText },
      timestamp: new Date(),
      status: 'sending'
  };
  
  if (!messages[selectedConversation]) messages[selectedConversation] = [];
  messages[selectedConversation].push(tempMessage);
  renderMessages(selectedConversation);
  
  messageInput.value = '';
  
  setTimeout(() => {
      const messageIndex = messages[selectedConversation].findIndex(m => m.id === tempId);
      if (messageIndex !== -1) {
          messages[selectedConversation][messageIndex].status = 'delivered';
          renderMessages(selectedConversation);
      }
      
      db.collection('whatsapp_logs').add({
          from: currentUser.uid,
          to: selectedConversation,
          direction: 'outgoing',
          type: 'text',
          text: { body: messageText },
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          status: 'delivered'
      });
  }, 1000);
}

// Initialize charts
function initializeCharts() {
  Object.values(analyticsCharts).forEach(chart => {
      if (chart) chart.destroy();
  });

  const statusCounts = {
      active: 0,
      assigned: 0,
      ai: 0,
      closed: 0
  };

  const businessTypeCounts = {
      housing: 0,
      rental: 0,
      sale: 0,
      commercial: 0,
      unknown: 0
  };

  conversations.forEach(conv => {
      statusCounts[conv.status] = (statusCounts[conv.status] || 0) + 1;
      
      const bizType = conv.lastBusinessType ? 
          conv.lastBusinessType.replace('biz_', '').toLowerCase() : 'unknown';
      if (businessTypeCounts.hasOwnProperty(bizType)) {
          businessTypeCounts[bizType]++;
      } else {
          businessTypeCounts.unknown++;
      }
  });

  const responseTimes = [5, 3, 7, 4, 6, 5, 4]; // Sample data

  document.getElementById('total-conversations').textContent = conversations.length;
  document.getElementById('active-conversations').textContent = statusCounts.active;
  document.getElementById('avg-response-time').textContent = `${Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)} min`;
  document.getElementById('closed-conversations').textContent = statusCounts.closed;

  // Conversations Over Time Chart
  const conversationsCtx = document.getElementById('conversations-chart').getContext('2d');
  analyticsCharts.conversationsOverTime = new Chart(conversationsCtx, {
      type: 'line',
      data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
              label: 'Conversations',
              data: [12, 19, 8, 15, 22, 18, 14],
              backgroundColor: 'rgba(37, 211, 102, 0.2)',
              borderColor: 'rgba(37, 211, 102, 1)',
              borderWidth: 2,
              tension: 0.3,
              fill: true
          }]
      },
      options: getChartOptions('Conversations per day')
  });

  // Status Distribution Chart
  const statusCtx = document.getElementById('status-distribution-chart').getContext('2d');
  analyticsCharts.statusDistribution = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
          labels: ['Active', 'Assigned', 'AI Mode', 'Closed'],
          datasets: [{
              data: Object.values(statusCounts),
              backgroundColor: [
                  'rgba(76, 175, 80, 0.7)',
                  'rgba(255, 152, 0, 0.7)',
                  'rgba(52, 183, 241, 0.7)',
                  'rgba(158, 158, 158, 0.7)'
              ],
              borderColor: [
                  'rgba(76, 175, 80, 1)',
                  'rgba(255, 152, 0, 1)',
                  'rgba(52, 183, 241, 1)',
                  'rgba(158, 158, 158, 1)'
              ],
              borderWidth: 1
          }]
      },
      options: getChartOptions('Conversation status distribution', true)
  });

  // Business Type Distribution Chart
  const businessCtx = document.getElementById('business-type-chart').getContext('2d');
  analyticsCharts.businessTypeDistribution = new Chart(businessCtx, {
      type: 'pie',
      data: {
          labels: ['Housing', 'Rental', 'Sale', 'Commercial', 'Unknown'],
          datasets: [{
              data: Object.values(businessTypeCounts),
              backgroundColor: [
                  'rgba(18, 140, 126, 0.7)',
                  'rgba(37, 211, 102, 0.7)',
                  'rgba(220, 248, 198, 0.7)',
                  'rgba(52, 183, 241, 0.7)',
                  'rgba(158, 158, 158, 0.7)'
              ],
              borderColor: [
                  'rgba(18, 140, 126, 1)',
                  'rgba(37, 211, 102, 1)',
                  'rgba(220, 248, 198, 1)',
                  'rgba(52, 183, 241, 1)',
                  'rgba(158, 158, 158, 1)'
              ],
              borderWidth: 1
          }]
      },
      options: getChartOptions('Business type distribution', true)
  });

  // Response Time Trends Chart
  const responseCtx = document.getElementById('response-time-chart').getContext('2d');
  analyticsCharts.responseTimeTrends = new Chart(responseCtx, {
      type: 'line',
      data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
              label: 'Avg Response Time (minutes)',
              data: responseTimes,
              backgroundColor: 'rgba(52, 183, 241, 0.2)',
              borderColor: 'rgba(52, 183, 241, 1)',
              borderWidth: 2,
              tension: 0.3,
              fill: true
          }]
      },
      options: getChartOptions('Response time trends (minutes)')
  });
}

// Helper function for chart options
function getChartOptions(title, isDoughnut = false) {
  const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
          legend: {
              position: isDoughnut ? 'right' : 'top',
              labels: {
                  color: '#333',
                  font: {
                      family: 'Inter',
                      size: 12
                  },
                  usePointStyle: isDoughnut,
                  padding: isDoughnut ? 20 : 0
              }
          },
          tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleFont: {
                  family: 'Inter',
                  size: 14,
                  weight: 'bold'
              },
              bodyFont: {
                  family: 'Inter',
                  size: 12
              },
              callbacks: {
                  label: function(context) {
                      if (isDoughnut) {
                          const label = context.label || '';
                          const value = context.raw || 0;
                          const total = context.dataset.data.reduce((a, b) => a + b, 0);
                          const percentage = Math.round((value / total) * 100);
                          return `${label}: ${value} (${percentage}%)`;
                      }
                      return `${context.dataset.label}: ${context.raw}`;
                  }
              }
          },
          title: {
              display: !!title,
              text: title,
              font: {
                  family: 'Inter',
                  size: 14,
                  weight: 'bold'
              },
              padding: {
                  top: 10,
                  bottom: 20
              }
          }
      }
  };

  if (!isDoughnut) {
      baseOptions.scales = {
          x: {
              grid: {
                  display: false
              },
              ticks: {
                  color: '#666'
              }
          },
          y: {
              beginAtZero: true,
              grid: {
                  color: 'rgba(0, 0, 0, 0.05)'
              },
              ticks: {
                  color: '#666'
              }
          }
      };
  }

  return baseOptions;
}

// Toggle analytics view
function toggleAnalytics() {
  const isVisible = analyticsContainer.style.display === 'grid';
  analyticsContainer.style.display = isVisible ? 'none' : 'grid';
  toggleAnalyticsBtn.innerHTML = `<i class="fas fa-chart-line"></i><span>${isVisible ? 'Show' : 'Hide'} Analytics</span>`;
  
  if (!isVisible) {
      renderAnalytics();
  }
}

// Render analytics dashboard
function renderAnalytics() {
  if (analyticsContainer.style.display === 'grid') {
      initializeCharts();
  }
  analyticsContainer.innerHTML = `
      <div class="analytics-card">
          <h3>Total Conversations</h3>
          <div class="analytics-value">${analyticsData.totalConversations}</div>
      </div>
      <div class="analytics-card">
          <h3>Messages Today</h3>
          <div class="analytics-value">${analyticsData.messagesToday}</div>
      </div>
      <div class="analytics-card">
          <h3>Avg Response Time</h3>
          <div class="analytics-value">${analyticsData.avgResponseTime}s</div>
      </div>
      <div class="analytics-card wide">
          <h3>Business Type Distribution</h3>
          <div class="business-distribution">
              ${Object.entries(analyticsData.businessTypeDistribution).map(([type, count]) => `
                  <div class="business-type">
                      <div class="business-type-label">${type.replace('biz_', '').replace('_', ' ')}</div>
                      <div class="business-type-bar" style="width: ${(count / analyticsData.totalConversations) * 100}%"></div>
                      <div class="business-type-count">${count}</div>
                  </div>
              `).join('')}
          </div>
      </div>
  `;
}

// Helper functions
function formatTime(timestamp, fullDate = false) {
  if (!timestamp) return 'Unknown';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return fullDate ? date.toLocaleString() : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function truncate(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function clearConversations() {
  conversationList.innerHTML = '<div class="empty-state"><p>Sign in to view conversations</p></div>';
  messageContainer.innerHTML = '<div class="empty-state"><p>Select a conversation to view messages</p></div>';
  currentChatName.textContent = 'Select a conversation';
  currentChatNumber.textContent = '';
  userDetailsContent.style.display = 'none';
  messageInputContainer.style.display = 'none';
  transferBtn.disabled = true;
  aiBtn.disabled = true;
  agentSelect.innerHTML = '<option value="">No agents available</option>';
}

// Initialize the app
document.addEventListener('DOMContentLoaded', initApp);
