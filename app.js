// Firebase Configuration (Replace with your actual config)
const firebaseConfig = {
    apiKey: "AIzaSyD...", // Get this from your Firebase project settings
    authDomain: "housingfreeop.firebaseapp.com",
    projectId: "housingfreeop",
    storageBucket: "housingfreeop.appspot.com",
    messagingSenderId: "108251682562221048520", // From your credentials
    appId: "1:369472820914:android:d3fc9f7fad54ed3fa91bab" // Get from Firebase project settings
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// DOM Elements
const agentSwitcher = document.querySelector('.agent-switcher');
const agentDropdown = document.querySelector('.agent-dropdown');
const userItems = document.querySelectorAll('.user-item');
const chatMessages = document.querySelector('.chat-messages');
const chatInput = document.querySelector('.chat-input textarea');
const sendBtn = document.querySelector('.send-btn');
const templateBtn = document.getElementById('template-btn');
const templatesModal = document.getElementById('templates-modal');
const closeModal = document.querySelector('.close-modal');
const sendTemplateBtns = document.querySelectorAll('.send-template');
const refreshBtn = document.getElementById('refresh-btn');

// Event Listeners
agentSwitcher.addEventListener('click', () => {
    agentDropdown.classList.toggle('show');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!agentSwitcher.contains(e.target) && !agentDropdown.contains(e.target)) {
        agentDropdown.classList.remove('show');
    }
});

// User selection
userItems.forEach(user => {
    user.addEventListener('click', () => {
        userItems.forEach(u => u.classList.remove('active'));
        user.classList.add('active');
        loadUserChat(user);
    });
});

// Send message
sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Template modal
templateBtn.addEventListener('click', () => {
    templatesModal.classList.add('show');
    loadTemplates();
});

closeModal.addEventListener('click', () => {
    templatesModal.classList.remove('show');
});

// Send template
sendTemplateBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const template = e.target.closest('.template-item');
        sendTemplate(template);
    });
});

// Refresh data
refreshBtn.addEventListener('click', refreshData);

// Functions
function loadUserChat(userElement) {
    // In a real app, this would fetch chat history from Firebase
    const phoneNumber = userElement.querySelector('.user-info h3').textContent;
    console.log(`Loading chat for ${phoneNumber}`);
    
    // Update chat header
    document.querySelector('.chat-user .user-info h3').textContent = phoneNumber;
    
    // Clear current messages
    chatMessages.innerHTML = '';
    
    // Simulate loading messages from Firebase
    // Replace this with actual Firebase query
    db.collection('chats').doc(phoneNumber).collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get()
        .then(snapshot => {
            snapshot.forEach(doc => {
                const message = doc.data();
                addMessageToChat(message);
            });
        })
        .catch(error => {
            console.error("Error loading messages:", error);
        });
}

function addMessageToChat(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.direction}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const messageP = document.createElement('p');
    messageP.textContent = message.text;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-time';
    timeSpan.textContent = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    contentDiv.appendChild(messageP);
    contentDiv.appendChild(timeSpan);
    messageDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessage() {
    const messageText = chatInput.value.trim();
    if (!messageText) return;
    
    const activeUser = document.querySelector('.user-item.active');
    if (!activeUser) {
        alert('Please select a user first');
        return;
    }
    
    const phoneNumber = activeUser.querySelector('.user-info h3').textContent;
    
    // Create message object
    const message = {
        text: messageText,
        direction: 'sent',
        timestamp: new Date().toISOString()
    };
    
    // Add to UI immediately
    addMessageToChat(message);
    chatInput.value = '';
    
    // Send to backend
    axios.post('/send', {
        phone: phoneNumber,
        message: messageText
    })
    .then(response => {
        console.log('Message sent successfully:', response.data);
        
        // In a real app, you might want to update the message status in Firebase
        // db.collection('chats').doc(phoneNumber).collection('messages').add({
        //     ...message,
        //     status: 'delivered'
        // });
    })
    .catch(error => {
        console.error('Error sending message:', error);
        alert('Failed to send message');
    });
}

function loadTemplates() {
    // Fetch templates from backend
    axios.get('/templates')
        .then(response => {
            const templates = response.data;
            const templateList = document.querySelector('.template-list');
            templateList.innerHTML = '';
            
            templates.forEach(template => {
                const templateItem = document.createElement('div');
                templateItem.className = 'template-item';
                
                templateItem.innerHTML = `
                    <div class="template-header">
                        <h3>${template.name}</h3>
                        <span class="template-category">${template.category}</span>
                    </div>
                    <div class="template-content">
                        <p>${template.content}</p>
                    </div>
                    <div class="template-actions">
                        <button class="btn btn-secondary">Preview</button>
                        <button class="btn btn-green send-template">Send</button>
                    </div>
                `;
                
                templateList.appendChild(templateItem);
            });
            
            // Re-attach event listeners to new buttons
            document.querySelectorAll('.send-template').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const template = e.target.closest('.template-item');
                    sendTemplate(template);
                });
            });
        })
        .catch(error => {
            console.error('Error loading templates:', error);
            alert('Failed to load templates');
        });
}

function sendTemplate(templateElement) {
    const activeUser = document.querySelector('.user-item.active');
    if (!activeUser) {
        alert('Please select a user first');
        return;
    }
    
    const phoneNumber = activeUser.querySelector('.user-info h3').textContent;
    const templateName = templateElement.querySelector('h3').textContent;
    
    axios.post('/template', {
        phone: phoneNumber,
        template: templateName
    })
    .then(response => {
        console.log('Template sent successfully:', response.data);
        templatesModal.classList.remove('show');
        alert('Template sent!');
    })
    .catch(error => {
        console.error('Error sending template:', error);
        alert('Failed to send template');
    });
}

function refreshData() {
    // In a real app, this would refresh user list and active chat
    console.log('Refreshing data...');
    
    // Example: Refresh user list from Firebase
    db.collection('users').where('active', '==', true).get()
        .then(snapshot => {
            const userList = document.querySelector('.user-list');
            userList.innerHTML = '';
            
            snapshot.forEach(doc => {
                const user = doc.data();
                const userItem = document.createElement('div');
                userItem.className = 'user-item';
                
                userItem.innerHTML = `
                    <div class="user-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="user-info">
                        <h3>${user.phone}</h3>
                        <p>Last active: ${formatLastActive(user.lastActive)}</p>
                    </div>
                    ${user.unread ? '<div class="user-badge">'+user.unread+'</div>' : ''}
                `;
                
                userItem.addEventListener('click', () => {
                    document.querySelectorAll('.user-item').forEach(u => u.classList.remove('active'));
                    userItem.classList.add('active');
                    loadUserChat(userItem);
                });
                
                userList.appendChild(userItem);
            });
        })
        .catch(error => {
            console.error("Error refreshing users:", error);
        });
}

function formatLastActive(timestamp) {
    // Format the timestamp for display
    // This is a simplified version - in a real app you'd use a library like moment.js
    const now = new Date();
    const lastActive = timestamp.toDate();
    const diffMinutes = Math.floor((now - lastActive) / (1000 * 60));
    
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    // Load initial data
    refreshData();
    
    // Set first user as active by default (remove in production)
    if (userItems.length > 0) {
        userItems[0].click();
    }
});