function getEmailThreadIdFromUrl(url) {
    const match = url.match(/#inbox\/([^/]+)/);
    return match ? match[1] : Date.now().toString();
}

export const Storage = {
    // Save conversations
    saveConversation: async (conversation) => {
        const conversations = await Storage.getConversations();
        conversations.push(conversation);
        return chrome.storage.local.set({ conversations });
    },

    // Get all conversations
    getConversations: async () => {
        const result = await chrome.storage.local.get('conversations');
        return result.conversations || [];
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
        await Storage.saveConversation(conversation);
        return conversation;
    },

    // Get the current (most recent) conversation
    getCurrentConversation: async () => {
        const conversations = await Storage.getConversations();
        return conversations[conversations.length - 1] || null;
    },

    // Update an existing conversation
    updateConversation: async (updatedConversation) => {
        const conversations = await Storage.getConversations();
        const index = conversations.findIndex(c => c.id === updatedConversation.id);
        if (index !== -1) {
            conversations[index] = updatedConversation;
            return chrome.storage.local.set({ conversations });
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
    deleteConversation: async (id) => {
        let conversations = await Storage.getConversations();
        conversations = conversations.filter(conv => conv.id !== id);
        return chrome.storage.local.set({ conversations });
    },
};