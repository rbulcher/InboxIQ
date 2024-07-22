import { Storage } from "./storage.js";
import { getEmailThreadIdFromPage, getEmails } from "./utils/emailUtil.js";

document.addEventListener("DOMContentLoaded", function () {
	initializePopup();
});

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
	const aiProvider = document.getElementById("aiProvider");
	const emailUnreadCount = document.getElementById("emailUnreadCount");
	const deleteAllButton = document.getElementById("deleteAllButton");
	deleteAllButton.addEventListener("click", deleteAllConversations);

	mainContainer.style.display = "flex";

	await showMainScreen();
	getUserInfo();

	async function showMainScreen() {
        await checkGmailDomain();
        await initializeChat();
    }

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

	function updateBadge(isEnabled) {
		if (isEnabled) {
			// For now, we're setting a static "9+" as the badge text
			chrome.action.setBadgeText({ text: "9+" });
			chrome.action.setBadgeBackgroundColor({ color: "#73a6fa" });
		} else {
			chrome.action.setBadgeText({ text: "" });
		}
	}

	// Load saved Email Unread Count setting
	chrome.storage.sync.get(["emailUnreadCount"], function (result) {
		if (result.emailUnreadCount !== undefined) {
			emailUnreadCount.checked = result.emailUnreadCount;
			updateBadge(result.emailUnreadCount);
		}
	});

	aiProvider.addEventListener("change", function () {
		chrome.storage.sync.set({ aiProvider: this.value }, function () {
			console.log("AI Provider saved:", aiProvider.value);
		});
	});

	// Load saved AI Provider
	chrome.storage.sync.get(["aiProvider"], function (result) {
		if (result.aiProvider) {
			aiProvider.value = result.aiProvider;
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

	// Call this function when the popup opens
	getUserInfo();

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

	async function conversationExists() {
		try {
			const response = await getEmailThreadIdFromPage();
			if (response && response.threadId) {
				const threadId = response.threadId;
				const conversations = await Storage.getConversations();
				return conversations.some((conv) => conv.id === threadId);
			}
			return false;
		} catch (error) {
			console.error("Error checking if conversation exists:", error);
			return false;
		}
	}

	async function initializeChat() {
		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true,
		});
		const isGmailDomain = tab.url.startsWith("https://mail.google.com");
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
	}

	function showSummarizeButton() {
		summarizeButton.style.display = "block";
		chatInputArea.style.display = "none";
	}

	function showChatInput() {
		summarizeButton.style.display = "none";
		chatInputArea.style.display = "flex";
	}

	async function showMainScreen() {
		mainContainer.style.display = "flex";
		settingsPanel.classList.remove("open");
		await checkGmailDomain();
		await initializeChat();
	}

	async function checkGmailDomain() {
		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true,
		});
		const currentUrl = tab.url;
		const isGmailDomain = currentUrl.startsWith("https://mail.google.com");
		const hasOpenEmail = /#inbox\/[^/]+/.test(currentUrl);

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

	function showExistingConversations() {
		Storage.getConversations().then((conversations) => {
			if (conversations.length > 0) {
				chatWindow.innerHTML =
					'<div class="ai-message">Select a conversation from the sidebar to view its contents.</div>';
				showChatInput();
			}
		});
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
			const idString = String(conv.id);
			titleSpan.textContent = `Conversation -  ${idString.slice(-4)}`;
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

	function displayConversation(conversation) {
		chatWindow.innerHTML = "";

		conversation.messages.forEach((message) => {
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

	async function summarizeEmail() {
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
				const emailContent = await getEmails(threadId);
	  
				// Send email content to AI Provider, get response
				const summary = await callOpenAIAPI(emailContent);
	  
				conversation = await Storage.createConversation(summary);
	  
				conversation.messages.push({
				  role: "assistant",
				  content: formatAIResponse(summary),
				});
				await Storage.updateConversation(conversation);
			  }
	  
			  await Storage.setCurrentConversation(conversation);
			  displayConversation(conversation);
			  showChatInput();
			  updateConversationList();
			} else {
			  throw new Error("No thread ID received");
			}
		  } catch (error) {
			console.error("Error processing email:", error);
			alert("Error processing email. Please try again.");
		  }
		} else {
		  alert("Please open an email in Gmail to start a new conversation.");
		}
	  }

	async function callOpenAIAPI(content) {
		const apiKey = "sk-proj-SgxJVSFrhYft5uk42n7PT3BlbkFJkicCymErnQq3OI04wzWx";
		const response = await fetch('https://api.openai.com/v1/chat/completions', {
		  method: 'POST',
		  headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${apiKey}`
		  },
		  body: JSON.stringify({
			"model": "gpt-4o-mini",
			"messages": [
			  {"role": "system", "content": "Summarize the following email or emails in the thread. Please give 2-3 main points, and any key speakers if there are any:"},
			  {"role": "user", "content": content}
			],
			"temperature": 1,
			"max_tokens": 256,
			"top_p": 1,
			"frequency_penalty": 0,
			"presence_penalty": 0
		  })
		});
	  
		if (!response.ok) {
		  throw new Error(`HTTP error! status: ${response.status}`);
		}
	  
		const data = await response.json();
		return data.choices[0].message.content;
	  }

	  async function callOpenAIChatAPI(messages) {
		const apiKey = "sk-proj-SgxJVSFrhYft5uk42n7PT3BlbkFJkicCymErnQq3OI04wzWx";
		const response = await fetch('https://api.openai.com/v1/chat/completions', {
		  method: 'POST',
		  headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${apiKey}`
		  },
		  body: JSON.stringify({
			"model": "gpt-4o-mini",
			"messages": messages,
			"temperature": 1,
			"max_tokens": 256,
			"top_p": 1,
			"frequency_penalty": 0,
			"presence_penalty": 0
		  })
		});
	  
		if (!response.ok) {
		  throw new Error(`HTTP error! status: ${response.status}`);
		}
	  
		const data = await response.json();
		return data.choices[0].message.content;
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

	async function checkAuthStatus() {
		try {
			const token = await new Promise((resolve, reject) => {
				chrome.identity.getAuthToken({ interactive: false }, function (token) {
					if (chrome.runtime.lastError) {
						reject(chrome.runtime.lastError);
					} else {
						resolve(token);
					}
				});
			});

			if (token) {
				const userInfo = await fetchUserInfo(token);
				return userInfo;
			} else {
				return null;
			}
		} catch (error) {
			console.error("Error checking auth status:", error);
			return null;
		}
	}

	async function fetchUserInfo(token) {
		const response = await fetch(
			"https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
			{
				headers: { Authorization: `Bearer ${token}` },
			}
		);
		if (!response.ok) {
			throw new Error("Failed to fetch user info");
		}
		return response.json();
	}

	async function sendMessage() {
		const userMessage = userInput.value.trim();
		if (userMessage) {
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
			// Call OpenAI API
			const aiResponse = await callOpenAIChatAPI(conversation.messages);
	  
			// Add AI response to conversation
			conversation.messages.push({ role: "assistant", content: aiResponse });
			await Storage.updateConversation(conversation);
			displayConversation(conversation);
			updateConversationList();
		  } catch (error) {
			console.error("Error getting AI response:", error);
			alert("Error getting AI response. Please try again.");
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
