// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyD...",
    authDomain: "housingfreeop.firebaseapp.com",
    projectId: "housingfreeop",
    storageBucket: "housingfreeop.appspot.com",
    messagingSenderId: "108251682562221048520",
    appId: "1:369472820914:android:d3fc9f7fad54ed3fa91bab"
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

document.addEventListener('click', (e) => {
    if (!agentSwitcher.contains(e.target) && !agentDropdown.contains(e.target)) {
        agentDropdown.classList.remove('show');
    }
});

// Functions
async function ensureUserExists(phoneNumber) {
    const userRef = db.collection('users').doc(phoneNumber);
    const chatRef = db.collection('chats').doc(phoneNumber);
    
    try {
        // Check if user exists
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            await userRef.set({
                phone: phoneNumber,
                active: true,
                lastActive: new Date(),
                greeted: false,
                createdAt: new Date()
            });
            console.log(`Created new user: ${phoneNumber}`);
        }

        // Ensure chats collection exists
        const chatDoc = await chatRef.get();
        if (!chatDoc.exists) {
            await chatRef.set({ initialized: true });
            console.log(`Created chat document for: ${phoneNumber}`);
        }
        
        return true;
    } catch (error) {
        console.error("Error ensuring user exists:", error);
        return false;
    }
}

async function loadUserChat(userElement) {
    const phoneNumber = userElement.querySelector('.user-info h3').textContent;
    
    // Ensure user exists before loading chat
    const userExists = await ensureUserExists(phoneNumber);
    if (!userExists) {
        alert('Failed to initialize user data');
        return;
    }

    document.querySelector('.chat-user .user-info h3').textContent = phoneNumber;
    chatMessages.innerHTML = '';
    
    try {
        // Load messages with real-time updates
        db.collection('chats').doc(phoneNumber).collection('messages')
            .orderBy('timestamp', 'desc')
            .limit(10)
            .onSnapshot(snapshot => {
                chatMessages.innerHTML = ''; // Clear existing messages
                snapshot.forEach(doc => {
                    const message = doc.data();
                    addMessageToChat(message);
                });
                
                // Update last seen when loading chat
                db.collection('users').doc(phoneNumber).update({
                    lastActive: new Date(),
                    unread: 0 // Reset unread count
                });
            });
    } catch (error) {
        console.error("Error loading messages:", error);
    }
}

function addMessageToChat(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.from === 'agent' ? 'sent' : 'received'}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const messageP = document.createElement('p');
    messageP.textContent = message.message;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-time';
    timeSpan.textContent = new Date(message.timestamp?.toDate() || message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    contentDiv.appendChild(messageP);
    contentDiv.appendChild(timeSpan);
    messageDiv.appendChild(contentDiv);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage() {
    const messageText = chatInput.value.trim();
    if (!messageText) return;
    
    const activeUser = document.querySelector('.user-item.active');
    if (!activeUser) {
        alert('Please select a user first');
        return;
    }
    
    const phoneNumber = activeUser.querySelector('.user-info h3').textContent;
    
    try {
        // Ensure user exists before sending
        await ensureUserExists(phoneNumber);
        
        // Create message object
        const message = {
            from: 'agent',
            message: messageText,
            timestamp: new Date(),
            status: 'sending'
        };
        
        // Add to UI immediately
        addMessageToChat(message);
        chatInput.value = '';
        
        // Save to Firebase first
        await db.collection('chats').doc(phoneNumber).collection('messages').add(message);
        
        // Then send via WhatsApp API
        const response = await axios.post('/send', {
            phone: phoneNumber,
            message: messageText
        });
        
        console.log('Message sent successfully:', response.data);
        
        // Update message status in Firebase
        const messagesRef = db.collection('chats').doc(phoneNumber).collection('messages');
        const query = await messagesRef.where('timestamp', '==', message.timestamp).get();
        query.forEach(doc => {
            doc.ref.update({ status: 'delivered' });
        });
        
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message');
    }
}

async function refreshData() {
    try {
        // Get active users with real-time updates
        db.collection('users')
            .where('active', '==', true)
            .orderBy('lastActive', 'desc')
            .onSnapshot(snapshot => {
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
                    
                    userItem.addEventListener('click', async () => {
                        document.querySelectorAll('.user-item').forEach(u => u.classList.remove('active'));
                        userItem.classList.add('active');
                        await loadUserChat(userItem);
                    });
                    
                    userList.appendChild(userItem);
                });
                
                // Auto-select first user if none selected
                if (!document.querySelector('.user-item.active') && userList.firstChild) {
                    userList.firstChild.click();
                }
            });
    } catch (error) {
        console.error("Error refreshing users:", error);
    }
}

// Helper functions
function formatLastActive(timestamp) {
    if (!timestamp) return 'never';
    
    const now = new Date();
    const lastActive = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffMinutes = Math.floor((now - lastActive) / (1000 * 60));
    
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Set up real-time listeners
    refreshData();
    
    // Message sending
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Templates
    templateBtn.addEventListener('click', () => {
        templatesModal.classList.add('show');
        loadTemplates();
    });
    
    closeModal.addEventListener('click', () => {
        templatesModal.classList.remove('show');
    });
    
    // Refresh button
    refreshBtn.addEventListener('click', refreshData);
});

// Template functions (unchanged from your original)
async function loadTemplates() {
    try {
        const response = await axios.get('/templates');
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
        
        // Re-attach event listeners
        document.querySelectorAll('.send-template').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const template = e.target.closest('.template-item');
                sendTemplate(template);
            });
        });
    } catch (error) {
        console.error('Error loading templates:', error);
        alert('Failed to load templates');
    }
}

async function sendTemplate(templateElement) {
    const activeUser = document.querySelector('.user-item.active');
    if (!activeUser) {
        alert('Please select a user first');
        return;
    }
    
    const phoneNumber = activeUser.querySelector('.user-info h3').textContent;
    const templateName = templateElement.querySelector('h3').textContent;
    
    try {
        await ensureUserExists(phoneNumber);
        const response = await axios.post('/template', {
            phone: phoneNumber,
            template: templateName
        });
        
        console.log('Template sent successfully:', response.data);
        templatesModal.classList.remove('show');
        
        // Add template message to chat history
        const templateContent = templateElement.querySelector('.template-content p').textContent;
        await db.collection('chats').doc(phoneNumber).collection('messages').add({
            from: 'agent',
            message: `[Template: ${templateName}] ${templateContent}`,
            timestamp: new Date(),
            status: 'delivered'
        });
        
    } catch (error) {
        console.error('Error sending template:', error);
        alert('Failed to send template');
    }
}
