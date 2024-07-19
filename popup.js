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
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        const isGmailDomain = tab.url.startsWith('https://mail.google.com');
        const hasOpenEmail = /#inbox\/[^/]+/.test(tab.url);
    
        if (isGmailDomain && hasOpenEmail) {
            const hasConversation = await conversationExists();
            if (hasConversation) {
                const conversation = await Storage.getCurrentConversation();
                displayConversation(conversation);
                showChatInput();
            } else {
                showSummarizeButton();
            }
        } else {
            showExistingConversations();
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

    async function checkGmailDomain() {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        const currentUrl = tab.url;
        const isGmailDomain = currentUrl.startsWith('https://mail.google.com');
        const hasOpenEmail = /#inbox\/[^/]+/.test(currentUrl);
    
        if (isGmailDomain && hasOpenEmail) {
            handleGmailEmailThread(currentUrl);
        } else {
            handleNonGmailOrInbox();
        }
    }
    
    async function handleGmailEmailThread(url) {
        const threadId = getEmailThreadIdFromUrl(url);
        const conversation = await Storage.getConversationById(threadId);
    
        if (conversation) {
            await Storage.setCurrentConversation(conversation);
            displayConversation(conversation);
            showChatInput();
        } else {
            showSummarizeButton();
        }
        updateConversationList();
    }
    
    async function handleNonGmailOrInbox() {
        const conversations = await Storage.getConversations();
        
        if (conversations.length > 0) {
            const latestConversation = conversations[conversations.length - 1];
            await Storage.setCurrentConversation(latestConversation);
            displayConversation(latestConversation);
            showChatInput();
            gmailPopup.style.display = 'none';
        } else {
            chatWindow.innerHTML = '';
            summarizeButton.style.display = 'none';
            chatInputArea.style.display = 'none';
            gmailPopup.textContent = "Navigate to Gmail and open an email to start a new conversation.";
            gmailPopup.style.display = 'block';
        }
        updateConversationList();
    }

    function showExistingConversations() {
        Storage.getConversations().then(conversations => {
            if (conversations.length > 0) {
                chatWindow.innerHTML = '<div class="ai-message">Select a conversation from the sidebar to view its contents.</div>';
                showChatInput();
            } else {
                chatWindow.innerHTML = '<div class="ai-message">No existing conversations. Start a new one in Gmail.</div>';
            }
        });
    }

    async function updateConversationList() {
        const conversationList = document.getElementById('conversationList');
        conversationList.innerHTML = '';
        
        const conversations = await Storage.getConversations();
        const currentConversation = await Storage.getCurrentConversation();
        
        conversations.forEach(conv => {
            const item = document.createElement('div');
            item.className = 'conversation-item';
            if (currentConversation && conv.id === currentConversation.id) {
                item.classList.add('active');
            }
            
            const titleSpan = document.createElement('span');
            titleSpan.className = 'conversation-title';
            const idString = String(conv.id);
            titleSpan.textContent = `Conversation -  ${idString.slice(-4)}`;
            item.appendChild(titleSpan);
    
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            deleteButton.innerHTML = '&#x2715;';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteConversation(conv.id);
            });
            item.appendChild(deleteButton);
    
            item.addEventListener('click', () => loadConversation(conv.id));
            conversationList.appendChild(item);
        });
    }
    
    async function deleteConversation(id) {
        if (confirm('Are you sure you want to delete this conversation?')) {
            await Storage.deleteConversation(id);
            updateConversationList();
            const currentConv = await Storage.getCurrentConversation();
            if (!currentConv || currentConv.id === id) {
                chatWindow.innerHTML = '';
                showSummarizeButton();
            }
        }
    }

    async function loadConversation(conversationId) {
        const conversation = await Storage.getConversationById(conversationId);
        if (conversation) {
            await Storage.setCurrentConversation(conversation);
            displayConversation(conversation);
            showChatInput();
            updateConversationList();
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
            const threadId = getEmailThreadIdFromUrl(tab.url);
            let conversation = await Storage.getConversationById(threadId);
    
            if (!conversation) {
                const summary = "This is a placeholder for the email summary.";
                conversation = await Storage.createConversation(summary);
                
                const aiResponse = "This is a placeholder for the AI response to the summary.";
                conversation.messages.push({role: 'assistant', content: aiResponse});
                await Storage.updateConversation(conversation);
            }
    
            await Storage.setCurrentConversation(conversation);
            displayConversation(conversation);
            showChatInput();
            updateConversationList();
        } else {
            alert("Please open an email in Gmail to start a new conversation.");
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

    async function sendMessage() {
        const userMessage = userInput.value.trim();
        if (userMessage) {
            const conversation = await Storage.getCurrentConversation();
            if (!conversation) {
                alert("No active conversation. Please start a new conversation in Gmail.");
                return;
            }
    
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
    }

    loginButton.addEventListener('click', login);
    logoutButton.addEventListener('click', logout);
    summarizeButton.addEventListener('click', summarizeEmail);
    sendButton.addEventListener('click', sendMessage);

    userInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
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