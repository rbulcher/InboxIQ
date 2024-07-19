import { Storage } from './storage.js';

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
    const summarizeButton = document.getElementById('summarizeButton');
    const chatInputArea = document.getElementById('chatInputArea');
    const chatWindow = document.getElementById('chatWindow');

    function getEmailThreadIdFromUrl(url) {
        const match = url.match(/#inbox\/([^/]+)/);
        return match ? match[1] : Date.now().toString();
    }

    async function conversationExists() {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        const threadId = getEmailThreadIdFromUrl(tab.url);
        const conversations = await Storage.getConversations();
        return conversations.some(conv => conv.id === threadId);
    }

    async function initializeChat() {
        const hasConversation = await conversationExists();
        if (hasConversation) {
            const conversation = await Storage.getCurrentConversation();
            displayConversation(conversation);
            showChatInput();
        } else {
            showSummarizeButton();
        }
        updateConversationList();
    }

    function showSummarizeButton() {
        summarizeButton.style.display = 'block';
        chatInputArea.style.display = 'none';
    }

    function showChatInput() {
        summarizeButton.style.display = 'none';
        chatInputArea.style.display = 'flex';
    }

    function showLoginScreen() {
        loginContainer.style.display = 'flex';
        mainContainer.style.display = 'none';
        settingsPanel.classList.remove('open');
    }

    function showMainScreen() {
        loginContainer.style.display = 'none';
        mainContainer.style.display = 'flex';
        checkGmailDomain();
    }

    function checkGmailDomain() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            const currentUrl = tabs[0].url;
            const isGmailDomain = currentUrl.startsWith('https://mail.google.com');
            const hasOpenEmail = /#inbox\/[^/]+/.test(currentUrl);
        
            if (isGmailDomain && hasOpenEmail) {
                inputArea.classList.remove('disabled');
                gmailPopup.style.display = 'none';
                initializeChat();
            } else if (isGmailDomain) {
                inputArea.classList.add('disabled');
                showSummarizeButton();
                gmailPopup.textContent = "Open an email / thread to use this tool";
                gmailPopup.style.display = 'block';
            } else {
                inputArea.classList.add('disabled');
                showSummarizeButton();
                gmailPopup.textContent = "Navigate to Gmail to use this tool";
                gmailPopup.style.display = 'block';
            }
        });
    }

    function updateConversationList() {
        const conversationList = document.getElementById('conversationList');
        conversationList.innerHTML = '';
        
        Storage.getConversations().then(conversations => {
            conversations.forEach(conv => {
                const item = document.createElement('div');
                item.className = 'conversation-item';
                
                const titleSpan = document.createElement('span');
                const idString = String(conv.id);
                titleSpan.textContent = `Conversation ${idString.slice(0, 8)}...`;
                item.appendChild(titleSpan);
    
                const deleteButton = document.createElement('button');
                deleteButton.className = 'delete-button';
                deleteButton.innerHTML = '&#x2715;'; // X symbol
                deleteButton.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering the conversation load
                    deleteConversation(conv.id);
                });
                item.appendChild(deleteButton);
    
                item.addEventListener('click', () => loadConversation(conv.id));
                conversationList.appendChild(item);
            });
        });
    }
    
    async function deleteConversation(id) {
        if (confirm('Are you sure you want to delete this conversation?')) {
            await Storage.deleteConversation(id);
            updateConversationList();
            // If the deleted conversation was the current one, clear the chat window
            const currentConv = await Storage.getCurrentConversation();
            if (!currentConv || currentConv.id === id) {
                document.getElementById('chatWindow').innerHTML = '';
                showSummarizeButton();
            }
        }
    }

    async function loadConversation(conversationId) {
        const conversations = await Storage.getConversations();
        const conversation = conversations.find(conv => conv.id === conversationId);
        if (conversation) {
            displayConversation(conversation);
            showChatInput();
        }
    }

    function displayConversation(conversation) {
        chatWindow.innerHTML = '';
        conversation.messages.forEach(message => {
            if (message.role !== 'system') {
                const messageElement = document.createElement('div');
                messageElement.className = `message ${message.role === 'assistant' ? 'ai-message' : 'user-message'}`;
                messageElement.textContent = message.content;
                chatWindow.appendChild(messageElement);
            }
        });
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    async function summarizeEmail() {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        
        if (tab.url.startsWith('https://mail.google.com') && /#inbox\/[^/]+/.test(tab.url)) {
            const summary = "This is a placeholder for the email summary.";
            
            const conversation = await Storage.createConversation(summary);
            displayConversation(conversation);
            
            const aiResponse = "This is a placeholder for the AI response to the summary.";
            conversation.messages.push({role: 'assistant', content: aiResponse});
            await Storage.updateConversation(conversation);
            displayConversation(conversation);

            showChatInput();
            updateConversationList();
        } else {
            alert("Please open an email in Gmail to summarize.");
        }
    }

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
    summarizeButton.addEventListener('click', summarizeEmail);

    sendButton.addEventListener('click', async function() {
        const userMessage = userInput.value.trim();
        if (userMessage) {
            const conversation = await Storage.getCurrentConversation();
            conversation.messages.push({role: 'user', content: userMessage});
            await Storage.updateConversation(conversation);
            displayConversation(conversation);
            userInput.value = '';
            
            const aiResponse = "This is a placeholder for the AI response.";
            conversation.messages.push({role: 'assistant', content: aiResponse});
            await Storage.updateConversation(conversation);
            displayConversation(conversation);
            updateConversationList();
        }
    });

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

    checkGmailDomain();
    checkAuthStatus();
});