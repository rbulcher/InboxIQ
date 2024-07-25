import { Storage } from "./storage.js";
import {
	getEmailThreadIdFromPage,
	getEmails,
	getNumberOfUnreadEmails,
} from "./utils/emailUtil.js";
import { callOpenAIAPI, callOpenAIChatAPI } from "./utils/openAiUtil.js";
import {
	initializeSubscription,
	updateUserStatusDisplay,
	getUserSubscriptionStatus,
} from "./utils/subscriptionUtil.js";

document.addEventListener("DOMContentLoaded", function () {
	initializePopup();
	initializeSubscription();
	chrome.storage.sync.get(["emailUnreadCount"], function (result) {
		if (result.emailUnreadCount) {
			updateBadge(true);
		}
	});
});

async function updateBadge(isEnabled) {
	if (isEnabled) {
		try {
			const unreadCount = await getNumberOfUnreadEmails();
			const badgeText = unreadCount > 99 ? "99+" : unreadCount.toString();
			chrome.action.setBadgeText({ text: badgeText });
			chrome.action.setBadgeBackgroundColor({ color: "#73a6fa" });
		} catch (error) {
			console.error("Error fetching unread count:", error);
			chrome.action.setBadgeText({ text: "!" });
			chrome.action.setBadgeBackgroundColor({ color: "#ff0000" });
		}
	} else {
		chrome.action.setBadgeText({ text: "" });
	}
}

async function initializeConversationLifetime() {
	const lifetimeSelect = document.getElementById("conversationLifetime");
	const currentLifetime = await Storage.getConversationLifetime();

	// Ensure a valid option is selected
	if (lifetimeSelect.querySelector(`option[value="${currentLifetime}"]`)) {
		lifetimeSelect.value = currentLifetime.toString();
	} else {
		lifetimeSelect.value = "24"; // Default to 24 hours if the stored value is not in the options
		await Storage.setConversationLifetime(24);
	}

	lifetimeSelect.addEventListener("change", async () => {
		const selectedLifetime = parseInt(lifetimeSelect.value);
		await Storage.setConversationLifetime(selectedLifetime);
		await deleteExpiredConversations();
		updateConversationList();
	});
}

async function deleteExpiredConversations() {
	await Storage.deleteExpiredConversations();
}
async function updateMessageInfo() {
	const status = await getUserSubscriptionStatus();
	const messageCount = await Storage.getMessageCount();
	let messageLimit;
	switch (status) {
		case "Free":
			messageLimit = 5;
			break;
		case "Pro":
			messageLimit = Infinity;
			break;
		default:
			messageLimit = 5;
	}

	const messagesRemaining =
		messageLimit === Infinity
			? "Unlimited"
			: Math.max(0, messageLimit - messageCount);

	const lastMessageTime = await Storage.getEarliestMessageTime();
	const refreshTime = calculateRefreshTime(lastMessageTime);

	document.getElementById(
		"messagesRemaining"
	).textContent = `Messages Remaining: ${messagesRemaining}`;
	document.getElementById(
		"messageRefresh"
	).textContent = `Message Refresh: ${refreshTime}`;
}

function calculateRefreshTime(lastMessageTime) {
	if (!lastMessageTime) return "24hr";

	const now = Date.now();
	const refreshDate = new Date(lastMessageTime);
	refreshDate.setHours(refreshDate.getHours() + 24);

	const timeDiff = refreshDate - now;
	if (timeDiff <= 0) return "0hr";

	const hours = Math.floor(timeDiff / (1000 * 60 * 60));
	return `${hours}hr`;
}

async function handleMessageLimitError() {
	const lastMessageTime = await Storage.getEarliestMessageTime();
	const refreshTime = calculateRefreshTime(lastMessageTime);
	const message =
		refreshTime === "1hr"
			? `You have reached the message limit. It will refresh in ${refreshTime}, or you can upgrade to Pro for less than a cup of coffee ($5 USD).`
			: `You have reached the message limit. It will refresh in ${refreshTime}s, or you can upgrade to Pro for less than a cup of coffee ($5 USD).`;
	alert(message);
	settingsPanel.classList.toggle("open");
}

async function updateConversationList() {
	const conversationList = document.getElementById("conversationList");
	conversationList.innerHTML = "";

	const conversations = await Storage.getConversations();
	const currentConversation = await Storage.getCurrentConversation();

	conversations.forEach((conv) => {
		const item = document.createElement("div");
		item.className = "conversation-item";
		if (currentConversation && conv.id === currentConversation.id) {
			item.classList.add("active");
		}

		const titleSpan = document.createElement("span");
		titleSpan.className = "conversation-title";
		const title = conv.subject
			? conv.subject.split(" ").slice(0, 3).join(" ") + "..."
			: `Conversation - ${String(conv.id).slice(-4)}`;
		titleSpan.textContent = title;
		item.appendChild(titleSpan);

		const deleteButton = document.createElement("button");
		deleteButton.className = "delete-button";
		deleteButton.innerHTML = "&#x2715;";
		deleteButton.addEventListener("click", (e) => {
			e.stopPropagation();
			deleteConversation(conv.id);
		});
		item.appendChild(deleteButton);

		item.addEventListener("click", () => loadConversation(conv.id));
		conversationList.appendChild(item);
	});
}

async function deleteConversation(id) {
	if (confirm("Are you sure you want to delete this conversation?")) {
		await Storage.deleteConversation(id);
		updateConversationList();
		const currentConv = await Storage.getCurrentConversation();
		if (!currentConv || currentConv.id === id) {
			chatWindow.innerHTML = "";
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

function formatAIResponse(response) {
	// Convert markdown to HTML
	let formattedResponse = marked.parse(response);

	// Wrap the response in a div to apply highlighting
	let tempDiv = document.createElement("div");
	tempDiv.innerHTML = formattedResponse;

	// Apply syntax highlighting
	tempDiv.querySelectorAll("pre code").forEach((block) => {
		hljs.highlightBlock(block);
	});

	return tempDiv.innerHTML;
}

function displayConversation(conversation) {
	chatWindow.innerHTML = "";

	// slice(1) is to ignore the prompt message
	conversation.messages.slice(1).forEach((message) => {
		if (message.role !== "system") {
			const messageElement = document.createElement("div");
			messageElement.className = `message ${
				message.role === "assistant" ? "ai-message" : "user-message"
			}`;

			if (message.role === "assistant") {
				messageElement.innerHTML = formatAIResponse(message.content);
			} else {
				messageElement.textContent = message.content;
			}

			chatWindow.appendChild(messageElement);
		}
	});

	chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showChatInput() {
	summarizeButton.style.display = "none";
	chatInputArea.style.display = "flex";
}

async function initializePopup() {
	const mainContainer = document.getElementById("mainContainer");
	const settingsButton = document.getElementById("settingsButton");
	const settingsPanel = document.getElementById("settingsPanel");
	const apiKeyInput = document.getElementById("apiKey");
	const sendButton = document.getElementById("sendButton");
	const userInput = document.getElementById("userInput");
	const gmailPopup = document.getElementById("gmailPopup");
	const inputArea = document.getElementById("inputArea");
	const summarizeButton = document.getElementById("summarizeButton");
	const chatInputArea = document.getElementById("chatInputArea");
	const chatWindow = document.getElementById("chatWindow");
	const toggleApiKey = document.getElementById("toggleApiKey");
	const emailUnreadCount = document.getElementById("emailUnreadCount");
	const deleteAllButton = document.getElementById("deleteAllButton");
	deleteAllButton.addEventListener("click", deleteAllConversations);

	mainContainer.style.display = "flex";

	getUserInfo();
	checkGmailDomain();

	await updateUserStatusDisplay();
	await initializeConversationLifetime();
	await deleteExpiredConversations();

	function getUserInfo() {
		chrome.identity.getAuthToken({ interactive: true }, function (token) {
			if (chrome.runtime.lastError) {
				console.error(chrome.runtime.lastError);
				updateSettingsTitle(null);
				return;
			}

			fetch("https://www.googleapis.com/oauth2/v1/userinfo?alt=json", {
				headers: { Authorization: `Bearer ${token}` },
			})
				.then((response) => response.json())
				.then((data) => {
					if (data.name) {
						updateSettingsTitle(data.name);
					} else if (data.email) {
						const userName = data.email.split("@")[0];
						updateSettingsTitle(userName);
					} else {
						console.log("User information not available");
						updateSettingsTitle(null);
					}
				})
				.catch((error) => {
					console.error("Error fetching user info:", error);
					updateSettingsTitle(null);
				});
		});
	}

	emailUnreadCount.addEventListener("change", function () {
		const isEnabled = this.checked;
		chrome.storage.sync.set({ emailUnreadCount: isEnabled }, function () {
			console.log("Email Unread Count setting saved:", isEnabled);
			updateBadge(isEnabled);
		});
	});

	async function deleteAllConversations() {
		if (confirm("Are you sure you want to delete all conversations?")) {
			await Storage.clearConversations();
			updateConversationList();
			chatWindow.innerHTML = "";
			showSummarizeButton();
		}
	}

	// Load saved Email Unread Count setting
	chrome.storage.sync.get(["emailUnreadCount"], function (result) {
		if (result.emailUnreadCount !== undefined) {
			emailUnreadCount.checked = result.emailUnreadCount;
			updateBadge(result.emailUnreadCount);
		}
	});

	function updateSettingsTitle(userName) {
		const settingsTitle = document.getElementById("settingsTitle");
		if (userName) {
			settingsTitle.textContent = `Hello, ${userName}`;
		} else {
			settingsTitle.textContent = "Settings";
		}
	}

	toggleApiKey.addEventListener("click", function () {
		if (apiKeyInput.type === "password") {
			apiKeyInput.type = "text";
			toggleApiKey.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye-off">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>`;
		} else {
			apiKeyInput.type = "password";
			toggleApiKey.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>`;
		}
	});

	document
		.getElementById("settingsPanel")
		.addEventListener("click", function (event) {
			event.stopPropagation();
		});

	function showSummarizeButton() {
		summarizeButton.style.display = "block";
		chatInputArea.style.display = "none";
	}

	async function checkGmailDomain() {
		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true,
		});
		const currentUrl = tab.url;
		const isGmailDomain = currentUrl.startsWith("https://mail.google.com");
		const hasOpenEmail =
			/#inbox\/[^/]+/.test(tab.url) ||
			/#imp\/[^/]+/.test(tab.url) ||
			/#starred\/[^/]+/.test(tab.url) ||
			/#spam\/[^/]+/.test(tab.url) ||
			/#search\/[^/]+\/[^/]+/.test(tab.url);

		if (isGmailDomain && hasOpenEmail) {
			handleGmailEmailThread();
		} else {
			handleNonGmailOrInbox();
		}
	}

	async function handleGmailEmailThread() {
		try {
			const response = await getEmailThreadIdFromPage();
			if (response && response.threadId) {
				const threadId = response.threadId;
				const conversation = await Storage.getConversationById(threadId);

				if (conversation) {
					await Storage.setCurrentConversation(conversation);
					displayConversation(conversation);
					showChatInput();
				} else {
					showSummarizeButton();
				}
				updateConversationList();
			} else {
				console.error("No thread ID received");
				showSummarizeButton();
			}
		} catch (error) {
			console.error("Error handling Gmail email thread:", error);
			showSummarizeButton();
		}
	}

	async function handleNonGmailOrInbox() {
		const conversations = await Storage.getConversations();

		if (conversations.length > 0) {
			const latestConversation = conversations[conversations.length - 1];
			await Storage.setCurrentConversation(latestConversation);
			displayConversation(latestConversation);
			showChatInput();
			gmailPopup.style.display = "none";
		} else {
			chatWindow.innerHTML = "";
			summarizeButton.style.display = "none";
			chatInputArea.style.display = "none";
			gmailPopup.textContent =
				"Navigate to Gmail and open an email to start a new conversation.";
			gmailPopup.style.display = "block";
		}
		updateConversationList();
	}

	async function summarizeEmail() {
		//check if api key is set
		if (!apiKeyInput.value) {
			alert("Please enter your OpenAI API key in the settings.");
			return;
		}
		if (await Storage.canSendMessage()) {
			const [tab] = await chrome.tabs.query({
				active: true,
				currentWindow: true,
			});

			if (tab.url.startsWith("https://mail.google.com")) {
				try {
					const response = await getEmailThreadIdFromPage();
					if (response && response.threadId) {
						const threadId = response.threadId;
						let conversation = await Storage.getConversationById(threadId);

						if (!conversation) {
							const emailData = await getEmails(threadId);

							// Create a new element to display the streaming summary
							const summaryElement = document.createElement("div");
							summaryElement.className = "message ai-message";
							chatWindow.appendChild(summaryElement);

							// Send email content to AI Provider, get streaming response
							const stream = await callOpenAIAPI(emailData.content);
							let summary = "";

							for await (const chunk of stream) {
								summary += chunk;
								summaryElement.innerHTML = formatAIResponse(summary);
								chatWindow.scrollTop = chatWindow.scrollHeight;
							}

							conversation = await Storage.createConversation(
								emailData.content,
								summary,
								emailData.subject,
								threadId
							);

							conversation.messages.push({
								role: "assistant",
								content: summary,
							});
							await Storage.updateConversation(conversation);
							await Storage.recordMessage();
							await updateMessageInfo();
						}

						await Storage.setCurrentConversation(conversation);
						displayConversation(conversation);
						showChatInput();
						updateConversationList();
					} else {
						throw new Error("No thread ID received");
					}
				} catch (error) {
					if (error.message === "HTTP error! status: 429") {
						alert(
							"API rate limit exceeded. Please visit openai and view your api key usage."
						);
					}
				}
			} else {
				alert("Please open an email in Gmail to start a new conversation.");
			}
		} else {
			handleMessageLimitError();
		}
	}

	async function sendMessage() {
		//check if api key is set
		if (!apiKeyInput.value) {
			alert("Please enter your OpenAI API key in the settings.");
			return;
		}
		const userMessage = userInput.value.trim();
		if (userMessage) {
			if (await Storage.canSendMessage()) {
				const conversation = await Storage.getCurrentConversation();
				if (!conversation) {
					alert(
						"No active conversation. Please start a new conversation in Gmail."
					);
					return;
				}

				// Add user message to conversation
				conversation.messages.push({ role: "user", content: userMessage });
				await Storage.updateConversation(conversation);
				displayConversation(conversation);
				userInput.value = "";

				try {
					// Create a new AI message element
					const aiMessageElement = document.createElement("div");
					aiMessageElement.className = "message ai-message";
					chatWindow.appendChild(aiMessageElement);

					// Call OpenAI API with streaming
					const stream = await callOpenAIChatAPI(conversation.messages);
					let aiResponse = "";

					for await (const chunk of stream) {
						aiResponse += chunk;
						aiMessageElement.innerHTML = formatAIResponse(aiResponse);
						chatWindow.scrollTop = chatWindow.scrollHeight;
					}

					// Add AI response to conversation
					conversation.messages.push({
						role: "assistant",
						content: aiResponse,
					});
					await Storage.updateConversation(conversation);
					await Storage.recordMessage();
					await updateMessageInfo();
					updateConversationList();
				} catch (error) {
					console.error("Error getting AI response:", error);
					alert("Error getting AI response. Please try again.");
				}
			} else {
				handleMessageLimitError();
			}
		}
	}
	summarizeButton.addEventListener("click", summarizeEmail);
	sendButton.addEventListener("click", sendMessage);

	userInput.addEventListener("keydown", function (e) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	});

	settingsButton.addEventListener("click", function () {
		//set user status
		updateUserStatusDisplay();
		updateMessageInfo();
		//reset message timers for testing
		settingsPanel.classList.toggle("open");
	});

	document.addEventListener("click", function (event) {
		if (
			!settingsPanel.contains(event.target) &&
			!settingsButton.contains(event.target)
		) {
			settingsPanel.classList.remove("open");
		}
	});

	chrome.storage.sync.get(["apiKey"], function (result) {
		if (result.apiKey) {
			apiKeyInput.value = result.apiKey;
		}
	});

	apiKeyInput.addEventListener("change", function () {
		chrome.storage.sync.set({ apiKey: apiKeyInput.value }, function () {
			console.log("API key saved");
		});
	});
}
