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

export async function getEmails(threadId) {
    function decodeBase64(base64Url) {
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const padding = '='.repeat((4 - base64.length % 4) % 4);
        const base64Padded = base64 + padding;
        const rawData = atob(base64Padded);
        return decodeURIComponent(escape(rawData));
    }

    function extractTextFromHTML(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        
        // Remove script and style elements
        const scripts = doc.getElementsByTagName('script');
        const styles = doc.getElementsByTagName('style');
        for (let i = scripts.length - 1; i >= 0; i--) {
            scripts[i].parentNode.removeChild(scripts[i]);
        }
        for (let i = styles.length - 1; i >= 0; i--) {
            styles[i].parentNode.removeChild(styles[i]);
        }
    
        // Get the text content
        const text = doc.body.textContent || doc.body.innerText || "";
        
        // Normalize whitespace
        return text.replace(/\s+/g, ' ').trim();
    }

    function cleanContent(content) {
        let cleaned = content.replace(/\s+/g, ' ').trim();
        cleaned = cleaned.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '');
        
        const endMarkers = ['best,', 'sincerely,', 'regards,', 'thanks,', 'thank you,', 'cheers,', 'wrote:', 'join by phone', 'privacy statement', 'privacy and cookie policy'];
        for (let marker of endMarkers) {
            const index = cleaned.toLowerCase().indexOf(marker);
            if (index > 0) {
                cleaned = cleaned.substring(0, index);
            }
        }

        cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
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
                data.messages.forEach((msg) => {
                    let headers = {};
                    msg.payload.headers.forEach(header => {
                        headers[header.name.toLowerCase()] = header.value;
                    });
                
                    let body = "";
                    if (msg.payload.mimeType === 'multipart/alternative' && msg.payload.parts) {
                        const textPart = msg.payload.parts.find(part => part.mimeType === 'text/plain');
                        const htmlPart = msg.payload.parts.find(part => part.mimeType === 'text/html');
                        if (textPart && textPart.body.data) {
                            body = decodeBase64(textPart.body.data);
                        } else if (htmlPart && htmlPart.body.data) {
                            const htmlContent = decodeBase64(htmlPart.body.data);
                            body = extractTextFromHTML(htmlContent);
                        }
                    } else if (msg.payload.body && msg.payload.body.data) {
                        body = decodeBase64(msg.payload.body.data);
                        if (msg.payload.mimeType === 'text/html') {
                            body = extractTextFromHTML(body);
                        }
                    }
                
                    body = cleanContent(body);
                
                    threadContent += `From: ${headers.from || 'Unknown'}\n`;
                    threadContent += `To: ${headers.to || 'Unknown'}\n`;
                    threadContent += `Subject: ${headers.subject || 'No Subject'}\n`;
                    threadContent += `Body: ${body}\n\n`;
                });

                if (threadContent.trim() === "") {
                    throw new Error("No email content found");
                }

                resolve(threadContent);
            } catch (error) {
                reject(error);
            }
        });
    });
}
