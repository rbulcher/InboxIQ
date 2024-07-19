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
    }
  };