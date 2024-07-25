import { getUserSubscriptionStatus } from "./utils/subscriptionUtil.js";

export const Storage = {
	// Get all conversations
	getConversations: async () => {
		const result = await chrome.storage.local.get("conversations");
		return result.conversations || [];
	},

	// Save conversations
	saveConversations: async (conversations) => {
		return chrome.storage.local.set({ conversations });
	},
	clearConversations: async () => {
		await chrome.storage.local.set({ conversations: [] });
		await Storage.setCurrentConversation(null);
	},

	// Create a new conversation
	createConversation: async (emailData, summary, subject, threadId) => {
		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true,
		});
		const conversation = {
			id: String(threadId),
			subject: subject, // Add this line
			//messages: [{ role: "system", content: "Email summary: " + summary }],
			messages: [
				{ role: "user", content: emailData },
				{ role: "system", content: "Email summary: " + summary },
			],
			createdAt: Date.now(), // Add timestamp at creation
		};
		await Storage.updateConversation(conversation);
		return conversation;
	},
	setConversationLifetime: async (hours) => {
		return chrome.storage.sync.set({ conversationLifetime: hours });
	},

	getConversationLifetime: async () => {
		const result = await chrome.storage.sync.get("conversationLifetime");
		return result.conversationLifetime || 24; // Default to 24 hours if not set
	},
	deleteExpiredConversations: async () => {
		const lifetime = await Storage.getConversationLifetime();
		//const expirationTime = Date.now() - lifetime * 60 * 60 * 1000;
		// For testing: if lifetime is 1, treat it as 1 minute, otherwise as hours
		const expirationTime =
			lifetime === 1
				? Date.now() - 60 * 1000 // 1 minute
				: Date.now() - lifetime * 60 * 60 * 1000; // hours
		const conversations = await Storage.getConversations();

		const updatedConversations = conversations.filter(
			(conv) => conv.createdAt > expirationTime
		);

		if (updatedConversations.length !== conversations.length) {
			await Storage.saveConversations(updatedConversations);
			return true; // Conversations were deleted
		}
		return false; // No conversations were deleted
	},
	// Get the current conversation
	getCurrentConversation: async () => {
		const result = await chrome.storage.local.get("currentConversation");
		return result.currentConversation || null;
	},

	// Set the current conversation
	setCurrentConversation: async (conversation) => {
		return chrome.storage.local.set({ currentConversation: conversation });
	},

	// Get a conversation by ID
	getConversationById: async (id) => {
		const conversations = await Storage.getConversations();
		return conversations.find((conv) => conv.id === id) || null;
	},

	// Update an existing conversation or add a new one
	updateConversation: async (updatedConversation) => {
		const conversations = await Storage.getConversations();
		const index = conversations.findIndex(
			(c) => c.id === updatedConversation.id
		);
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
		conversations = conversations.filter((conv) => conv.id !== id);
		await Storage.saveConversations(conversations);
		const currentConv = await Storage.getCurrentConversation();
		if (currentConv && currentConv.id === id) {
			await Storage.setCurrentConversation(null);
		}
	},
	getUserStatus: async () => {
		const userStatus = getUserSubscriptionStatus();
		return userStatus;
	},
	setUserStatus: async (status) => {
		return chrome.storage.sync.set({ userStatus: status });
	},
	recordMessage: async () => {
		const now = Date.now();
		const result = await chrome.storage.local.get("messageTimestamps");
		let timestamps = result.messageTimestamps || [];

		// Add the new message timestamp
		timestamps.push(now);

		// Keep only the timestamps within the last 24 hours
		const oneDayAgo = now - 24 * 60 * 60 * 1000;
		timestamps = timestamps.filter((timestamp) => timestamp > oneDayAgo);

		await chrome.storage.local.set({ messageTimestamps: timestamps });
		return timestamps;
	},
	canSendMessage: async () => {
		const status = await Storage.getUserStatus();
		const result = await chrome.storage.local.get("messageTimestamps");
		let timestamps = result.messageTimestamps || [];

		const messageLimit = status === "Free" ? 5 : Infinity;

		const now = Date.now();
		const oneDayAgo = now - 24 * 60 * 60 * 1000;
		timestamps = timestamps.filter((timestamp) => timestamp > oneDayAgo);

		// Update the stored timestamps
		await chrome.storage.local.set({ messageTimestamps: timestamps });

		return timestamps.length < messageLimit;
	},

	getMessageCount: async () => {
		const now = Date.now();
		const result = await chrome.storage.local.get("messageTimestamps");
		const timestamps = result.messageTimestamps || [];
		const oneDayAgo = now - 24 * 60 * 60 * 1000;
		return timestamps.filter((timestamp) => timestamp > oneDayAgo).length;
	},

	getEarliestMessageTime: async () => {
		const result = await chrome.storage.local.get("messageTimestamps");
		const timestamps = result.messageTimestamps || [];
		return timestamps.length > 0 ? Math.min(...timestamps) : null;
	},

	// Clear all message timestamps (useful for testing or resetting)
	clearMessageTimestamps: async () => {
		return chrome.storage.local.remove("messageTimestamps");
	},
};
