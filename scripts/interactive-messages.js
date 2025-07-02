// Handle interactive WhatsApp messages (buttons, lists, etc.)
document.addEventListener('DOMContentLoaded', () => {
  // Handle button clicks in interactive messages
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('interactive-button')) {
      handleInteractiveButtonClick(e.target);
    }
  });

  // Render interactive message buttons
  window.renderInteractiveMessage = (msg) => {
    if (!msg.interactive) return msg.text;
    
    if (msg.interactive.type === 'button_reply') {
      return `
        <div class="interactive-message">
          <p>${msg.text}</p>
          <div class="interactive-buttons">
            ${msg.interactive.buttons.map(btn => `
              <button class="interactive-button" data-id="${btn.id}">${btn.title}</button>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    return msg.text;
  };

  function handleInteractiveButtonClick(button) {
    const buttonId = button.dataset.id;
    const messageElement = button.closest('.interactive-message');
    
    // Mark button as selected
    button.classList.add('selected');
    button.innerHTML += ' ✓';
    
    // Disable other buttons
    messageElement.querySelectorAll('.interactive-button').forEach(btn => {
      if (btn !== button) {
        btn.disabled = true;
      }
    });

    // In a real app, you would send this to your backend
    console.log('Button selected:', buttonId);
    
    // Simulate sending response to Firestore
    if (window.selectedChat) {
      const db = firebase.firestore();
      db.collection('chats').doc(window.selectedChat).collection('messages').add({
        text: `Response: ${button.textContent.replace(' ✓', '')}`,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        senderId: 'user-response',
        isButtonResponse: true,
        buttonId: buttonId
      });
    }
  }
});