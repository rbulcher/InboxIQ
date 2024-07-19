function getEmailThreadIdFromUrl(url) {
    const match = url.match(/#inbox\/([^/]+)/);
    return match ? match[1] : Date.now().toString();
}

export const Storage = {
    // Get all conversations
    getConversations: async () => {
        const result = await chrome.storage.local.get('conversations');
        return result.conversations || [];
    },

    // Save conversations
    saveConversations: async (conversations) => {
        return chrome.storage.local.set({ conversations });
    },

    // Create a new conversation
    createConversation: async (summary) => {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        const threadId = getEmailThreadIdFromUrl(tab.url);
        const conversation = {
            id: String(threadId), // Ensure id is stored as a string
            messages: [
                { role: 'system', content: 'Email summary: ' + summary }
            ]
        };
        await Storage.updateConversation(conversation);
        return conversation;
    },

    // Get the current conversation
    getCurrentConversation: async () => {
        const result = await chrome.storage.local.get('currentConversation');
        return result.currentConversation || null;
    },

    // Set the current conversation
    setCurrentConversation: async (conversation) => {
        return chrome.storage.local.set({ currentConversation: conversation });
    },

    // Get a conversation by ID
    getConversationById: async (id) => {
        const conversations = await Storage.getConversations();
        return conversations.find(conv => conv.id === id) || null;
    },

    // Update an existing conversation or add a new one
    updateConversation: async (updatedConversation) => {
        const conversations = await Storage.getConversations();
        const index = conversations.findIndex(c => c.id === updatedConversation.id);
        if (index !== -1) {
            conversations[index] = updatedConversation;
        } else {
            conversations.push(updatedConversation);
        }
        await Storage.saveConversations(conversations);
        await Storage.setCurrentConversation(updatedConversation);
    },

    // Delete a conversation
    deleteConversation: async (id) => {
        let conversations = await Storage.getConversations();
        conversations = conversations.filter(conv => conv.id !== id);
        await Storage.saveConversations(conversations);
        const currentConv = await Storage.getCurrentConversation();
        if (currentConv && currentConv.id === id) {
            await Storage.setCurrentConversation(null);
        }
    },

    // Save auth token (with simple encryption)
    saveAuthToken: async (token) => {
        const encryptedToken = token ? btoa(token) : null; // Basic encryption, use a more secure method in production
        return chrome.storage.local.set({ authToken: encryptedToken });
    },

    // Get auth token (with simple decryption)
    getAuthToken: async () => {
        const result = await chrome.storage.local.get('authToken');
        return result.authToken ? atob(result.authToken) : null;
    },

    // Save user state
    saveUserState: async (state) => {
        return chrome.storage.local.set({ userState: state });
    },

    // Get user state
    getUserState: async () => {
        const result = await chrome.storage.local.get('userState');
        return result.userState;
    },
};