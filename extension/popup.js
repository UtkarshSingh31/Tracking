// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const userIdInput = document.getElementById('userId');
  const emailInput = document.getElementById('email');
  const saveBtn = document.getElementById('save');
  const status = document.getElementById('status');
  const serverUrl = 'http://localhost:5000'; // Change to your deployed URL

  // Load any existing credentials
  chrome.storage.local.get(['userId'], (data) => {
      if (data.userId) {
          userIdInput.value = data.userId;
          checkExistingCredentials(data.userId);
      }
  });

  async function checkExistingCredentials(userId) {
      try {
          const response = await fetch(`${serverUrl}/get-email?user_id=${userId}`);
          if (response.ok) {
              const data = await response.json();
              emailInput.value = data.email || '';
          }
      } catch (error) {
          console.log('Error fetching email:', error);
      }
  }

  saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const userId = userIdInput.value.trim();
      const email = emailInput.value.trim();

      // Validation
      if (!userId || !email) {
          showStatus('Please fill in all fields', 'red');
          return;
      }

      if (!validateEmail(email)) {
          showStatus('Invalid email format', 'red');
          return;
      }

      try {
          // Save to database
          const response = await fetch(`${serverUrl}/save-credentials`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                  user_id: userId,
                  email: email
              })
          });

          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
          }

          // Store user ID locally for future sessions
          await chrome.storage.local.set({ userId });
          
          showStatus('Credentials saved successfully!', 'green');
          setTimeout(() => window.close(), 1500);

      } catch (error) {
          console.error('Save failed:', error);
          showStatus('Failed to save credentials. Check console.', 'red');
      }
  });

  function validateEmail(email) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(email);
  }

  function showStatus(message, color) {
      status.textContent = message;
      status.style.color = color;
      setTimeout(() => {
          status.textContent = '';
          status.style.color = 'inherit';
      }, 3000);
  }
});