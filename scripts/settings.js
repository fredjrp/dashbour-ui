// Handle settings modal and user analytics
document.addEventListener('DOMContentLoaded', () => {
  const settingsModal = document.getElementById('settings-modal');
  const closeModal = document.querySelector('#settings-modal .close-modal');
  
  // Open settings modal
  window.openSettings = () => {
    loadUserStats();
    settingsModal.style.display = 'block';
  };

  // Close settings modal
  closeModal.addEventListener('click', () => {
    settingsModal.style.display = 'none';
  });

  // Load user statistics
  function loadUserStats() {
    const user = firebase.auth().currentUser;
    if (user) {
      document.getElementById('settings-username').textContent = user.displayName || 'User';
      document.getElementById('settings-userphone').textContent = user.phoneNumber || 'No phone number';
      
      // Simulate loading analytics from Firestore
      const db = firebase.firestore();
      db.collection('userStats').doc(user.uid).get()
        .then(doc => {
          if (doc.exists) {
            const data = doc.data();
            document.getElementById('response-rate-value').textContent = `${data.responseRate || 85}%`;
            document.getElementById('response-rate-bar').style.width = `${data.responseRate || 85}%`;
            document.getElementById('avg-response-time').textContent = 
              `${data.avgResponseTime || 2.5} min`;
          }
        })
        .catch(error => {
          console.error('Error loading stats:', error);
          // Default values
          document.getElementById('response-rate-value').textContent = '85%';
          document.getElementById('response-rate-bar').style.width = '85%';
          document.getElementById('avg-response-time').textContent = '2.5 min';
        });
    }
  }

  // Close modal when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.style.display = 'none';
    }
  });
});