export async function getEmailThreadIdFromPage() {
	try {
		const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
		if (tabs.length === 0) {
			throw new Error("No active tab found");
		}
		const tab = tabs[0];
		const response = await chrome.tabs.sendMessage(tab.id, {
			action: "getThreadId",
		});
		console.log("Received response:", response);
		return response;
	} catch (error) {
		console.error("Error in getEmailThreadIdFromPage:", error);
		throw error;
	}
}

export async function getNumberOfUnreadEmails() {
	return new Promise((resolve, reject) => {
		chrome.identity.getAuthToken({ interactive: true }, async function (token) {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
				return;
			}

			try {
				const response = await fetch(
					"https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread%20in:Inbox",
					{
						headers: {
							Authorization: `Bearer ${token}`,
							Accept: "application/json",
						},
					}
				);

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				const data = await response.json();
				resolve(data.resultSizeEstimate);
			} catch (error) {
				reject(error);
			}
		});
	});
}

export async function getEmails(threadId) {
	function decodeBase64(base64Url) {
		const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
		const padding = "=".repeat((4 - (base64.length % 4)) % 4);
		const base64Padded = base64 + padding;
		const rawData = atob(base64Padded);
		return decodeURIComponent(escape(rawData));
	}

	function cleanContent(content) {
		let cleaned = content.replace(/\s+/g, " ").trim();
		cleaned = cleaned.replace(
			/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
			""
		);

		//replace any line that starts with > with empty string
		cleaned = cleaned.replace(/^>.*/gm, "");

		const endMarkers = [
			"best,",
			"sincerely,",
			"regards,",
			"cheers,",
			"join by phone",
			"privacy statement",
			"privacy and cookie policy",
		];
		for (let marker of endMarkers) {
			const index = cleaned.toLowerCase().indexOf(marker);
			if (index > 0) {
				cleaned = cleaned.substring(0, index);
			}
		}

		cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, "");
		return cleaned.trim();
	}

	return new Promise((resolve, reject) => {
		chrome.identity.getAuthToken({ interactive: true }, async function (token) {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
				return;
			}

			try {
				const response = await fetch(
					`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
					{
						headers: {
							Authorization: `Bearer ${token}`,
							Accept: "application/json",
						},
					}
				);

				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}

				const data = await response.json();

				if (!data.messages || data.messages.length === 0) {
					throw new Error("No messages found in the thread");
				}

				let threadContent = "";
				let subject = "No Subject";
				data.messages.forEach((msg) => {
					let headers = {};
					msg.payload.headers.forEach((header) => {
						headers[header.name.toLowerCase()] = header.value;
					});

					if (subject === "No Subject" && headers.subject) {
						subject = headers.subject;
					}
					// Helper function to recursively find the first text/plain part
					function findTextPart(parts) {
						for (const part of parts) {
							if (part.mimeType === "text/plain") {
								return part;
							} else if (part.parts && part.parts.length > 0) {
								const nestedPart = findTextPart(part.parts);
								if (nestedPart) {
									return nestedPart;
								}
							}
						}
						return null;
					}

					let body = "";
					if (msg.payload.parts && msg.payload.parts.length > 0) {
						const textPart = findTextPart(msg.payload.parts);
						if (textPart && textPart.body && textPart.body.data) {
							const base64Url = textPart.body.data;
							//let bodyText = Buffer.from(base64Url, "base64").toString().trim();
							let bodyText = decodeBase64(base64Url).trim();
							let sentIndex = bodyText.indexOf("Sent:");
							if (sentIndex > 0) {
								bodyText = bodyText.substring(0, sentIndex);
							}
							body += bodyText + "\n";
						}
					} else {
						// If there are no parts, try to get the body directly
						if (
							msg.payload.body &&
							msg.payload.body.size > 0 &&
							msg.payload.body.data
						) {
							//process html and get the text
							if (msg.payload.mimeType === "text/html") {
								let base64Text = msg.payload.body.data;
								//const decodedBody = Buffer.from(base64Url, "base64").toString();
								let decodedBody = decodeBase64(base64Text);
								let extractTextFromHTML = (html) => {
									const doc = new DOMParser().parseFromString(
										html,
										"text/html"
									);
									const scripts = doc.getElementsByTagName("script");
									const styles = doc.getElementsByTagName("style");
									for (let i = scripts.length - 1; i >= 0; i--) {
										scripts[i].parentNode.removeChild(scripts[i]);
									}
									for (let i = styles.length - 1; i >= 0; i--) {
										styles[i].parentNode.removeChild(styles[i]);
									}
									const text = doc.body.textContent || doc.body.innerText || "";
									return text.replace(/\s+/g, " ").trim();
								};

								let cleaned = extractTextFromHTML(decodedBody);
								cleaned = cleaned.replace(/\s+/g, " ").trim();
								cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, "");
								body += cleaned.trim() + "\n";
							} else {
								let base64Text = msg.payload.body.data;
								let decodedBody = decodeBase64(base64Text);
								body += decodedBody.trim() + "\n";
							}
						}
					}

					body = cleanContent(body);

					threadContent += `From: ${headers.from || "Unknown"}\n`;
					threadContent += `To: ${headers.to || "Unknown"}\n`;
					threadContent += `Subject: ${headers.subject || "No Subject"}\n`;
					threadContent += `Body: ${body}\n\n`;
				});

				if (threadContent.trim() === "") {
					throw new Error("No email content found");
				}

				resolve({ content: threadContent, subject: subject });
			} catch (error) {
				reject(error);
			}
		});
	});
}
