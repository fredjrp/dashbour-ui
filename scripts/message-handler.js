// Handle message reactions
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('reaction-button')) {
    const messageElement = e.target.closest('.chat-message-group');
    const messageId = messageElement.dataset.messageId;
    showReactionPicker(messageElement, messageId);
  }
  
  if (e.target.classList.contains('interactive-button')) {
    handleInteractiveButtonClick(e.target);
  }
});

function showReactionPicker(element, messageId) {
  // In a real app, you would show an emoji picker here
  // and then save the reaction to Firestore
  console.log('React to message:', messageId);
}

function handleInteractiveButtonClick(button) {
  const buttonId = button.dataset.id;
  const messageElement = button.closest('.interactive-message');
  
  // Mark button as selected
  button.classList.add('selected');
  
  // In a real app, you would send this response to Firestore
  console.log('Button clicked:', buttonId);
  
  // Disable other buttons
  messageElement.querySelectorAll('.interactive-button').forEach(btn => {
    if (btn !== button) {
      btn.disabled = true;
    }
  });
}