// Simple emoji picker implementation
document.addEventListener('DOMContentLoaded', () => {
  const emojiBtn = document.getElementById('emoji-btn');
  const emojiPicker = document.getElementById('emoji-picker');
  const messageInput = document.getElementById('message-input');
  
  // Basic emoji list
  const emojis = ['😀', '😊', '😂', '❤️', '👍', '👎', '🔥', '🎉', '🤔', '😢'];
  
  // Create emoji picker content
  emojiPicker.innerHTML = `
    <div class="emoji-picker-header">Select Emoji</div>
    <div class="emoji-container">
      ${emojis.map(emoji => `
        <span class="emoji-option">${emoji}</span>
      `).join('')}
    </div>
  `;
  
  // Toggle emoji picker
  emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    emojiPicker.style.display = emojiPicker.style.display === 'block' ? 'none' : 'block';
  });
  
  // Insert emoji into input
  emojiPicker.addEventListener('click', (e) => {
    if (e.target.classList.contains('emoji-option')) {
      messageInput.value += e.target.textContent;
      emojiPicker.style.display = 'none';
    }
  });
  
  // Close picker when clicking outside
  document.addEventListener('click', () => {
    emojiPicker.style.display = 'none';
  });
});