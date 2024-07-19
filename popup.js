document.addEventListener('DOMContentLoaded', async function() {
    const loginContainer = document.getElementById('loginContainer');
    const mainContainer = document.getElementById('mainContainer');
    const settingsButton = document.getElementById('settingsButton');
    const settingsPanel = document.getElementById('settingsPanel');
    const logoutButton = document.getElementById('logoutButton');
    const apiKeyInput = document.getElementById('apiKey');
    const loginButton = document.getElementById('loginButton');
    const sendButton = document.getElementById('sendButton');
    const userInput = document.getElementById('userInput');
    const gmailPopup = document.getElementById('gmailPopup');
    const inputArea = document.getElementById('inputArea');
  
    function showLoginScreen() {
      loginContainer.style.display = 'flex';
      mainContainer.style.display = 'none';
      settingsPanel.classList.remove('open');
    }
  
    function showMainScreen() {
      loginContainer.style.display = 'none';
      mainContainer.style.display = 'flex';
      checkGmailDomain(); // Check Gmail domain when main screen is shown
    }
  
    function checkGmailDomain() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          const currentUrl = tabs[0].url;
          const isGmailDomain = currentUrl.startsWith('https://mail.google.com');
          const hasOpenEmail = /#inbox\/[^/]+/.test(currentUrl);
      
          if (isGmailDomain && hasOpenEmail) {
            inputArea.classList.remove('disabled');
            userInput.disabled = false;
            sendButton.disabled = false;
            userInput.placeholder = "Summarize email or thread...";
            gmailPopup.style.display = 'none';
          } else if (isGmailDomain) {
            inputArea.classList.add('disabled');
            userInput.disabled = true;
            sendButton.disabled = true;
            userInput.placeholder = "Open an email / thread to get started";
            gmailPopup.textContent = "Open an email / thread to use this tool";
            gmailPopup.style.display = 'block';
          } else {
            inputArea.classList.add('disabled');
            userInput.disabled = true;
            sendButton.disabled = true;
            userInput.placeholder = "Navigate to Gmail to get started";
            gmailPopup.textContent = "Navigate to Gmail to use this tool";
            gmailPopup.style.display = 'block';
          }
        });
      }

    // Check Gmail domain when popup opens
    checkGmailDomain();

    // Recheck Gmail domain when tab URL changes
    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
      if (changeInfo.status === 'complete') {
        checkGmailDomain();
      }
    });
  
    async function checkAuthStatus() {
      try {
        const token = await new Promise((resolve, reject) => {
          chrome.identity.getAuthToken({ interactive: false }, function(token) {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(token);
            }
          });
        });
        
        if (token) {
          const userInfo = await fetchUserInfo(token);
          showMainScreen();
          return userInfo;
        } else {
          showLoginScreen();
          return null;
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        showLoginScreen();
        return null;
      }
    }
  
    async function login() {
      try {
        const token = await new Promise((resolve, reject) => {
          chrome.identity.getAuthToken({ interactive: true }, function(token) {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(token);
            }
          });
        });
        
        const userInfo = await fetchUserInfo(token);
        showMainScreen();
        return userInfo;
      } catch (error) {
        console.error('Error during login:', error);
        return null;
      }
    }
  
    async function fetchUserInfo(token) {
      const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }
      return response.json();
    }
  
    async function logout() {
      try {
        await new Promise((resolve, reject) => {
          chrome.identity.clearAllCachedAuthTokens(function() {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
        showLoginScreen();
      } catch (error) {
        console.error('Error during logout:', error);
      }
    }
  
    loginButton.addEventListener('click', login);
    logoutButton.addEventListener('click', logout);
  
    settingsButton.addEventListener('click', function() {
      settingsPanel.classList.toggle('open');
    });
  
    document.addEventListener('click', function(event) {
      if (!settingsPanel.contains(event.target) && !settingsButton.contains(event.target)) {
        settingsPanel.classList.remove('open');
      }
    });
  
    chrome.storage.sync.get(['apiKey'], function(result) {
      if (result.apiKey) {
        apiKeyInput.value = result.apiKey;
      }
    });
  
    apiKeyInput.addEventListener('change', function() {
      chrome.storage.sync.set({apiKey: apiKeyInput.value}, function() {
        console.log('API key saved');
      });
    });
  
    // Initial auth check
    checkAuthStatus();
  });