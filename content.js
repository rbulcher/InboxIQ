chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	console.log("Message received in content script:", request);

	if (request.action === "getThreadId") {
		// Find the main email container
		const mainEmailContainer = document.querySelector(".adn.ads");

		if (mainEmailContainer) {
			// Look for the thread ID within the main email container
			const threadElement = mainEmailContainer.querySelector(
				"[data-legacy-thread-id]"
			);
			if (threadElement) {
				const threadId = threadElement.getAttribute("data-legacy-thread-id");
				console.log("Thread ID found:", threadId);
				sendResponse({ threadId: threadId });
			} else {
				// If not found in the main container, try to find it in the h2 element
				const h2Element = document.querySelector("h2[data-legacy-thread-id]");
				if (h2Element) {
					const threadId = h2Element.getAttribute("data-legacy-thread-id");
					console.log("Thread ID found in h2:", threadId);
					sendResponse({ threadId: threadId });
				} else {
					console.log("Thread ID not found");
					sendResponse({ error: "Thread ID not found" });
				}
			}
		} else {
			console.log("Main email container not found");
			sendResponse({ error: "Main email container not found" });
		}
	} else if (request.action === "scrapeEmails") {
		const emails = scrapeGmailThread();
		sendResponse({ emails: emails });
	} else {
		console.log("Unknown request:", request);
		sendResponse({ error: "Unknown request" });
	}
	return true;
});

function scrapeGmailThread() {
	const expandAllButton = document.querySelector('[aria-label="Expand all"]');
	if (expandAllButton) {
		expandAllButton.click();
	}

	function cleanContent(content) {
		let cleaned = content.replace(/\s+/g, " ").trim();

		cleaned = cleaned.replace(
			/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
			""
		);

		// Remove lines starting with '>'
		cleaned = cleaned.replace(/^>.*/gm, "");

		cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, "");

		// Remove common signature markers and everything after them
		const endMarkers = [
			"best,",
			"sincerely,",
			"regards,",
			"cheers,",
			"thanks,",
			"thank you,",
			"join by phone",
			"privacy statement",
			"privacy and cookie policy",
			"confidentiality notice",
			"this email and any files transmitted with it",
		];
		for (let marker of endMarkers) {
			const index = cleaned.toLowerCase().indexOf(marker);
			if (index > 0) {
				cleaned = cleaned.substring(0, index);
			}
		}

		// Remove repeated newlines and spaces
		cleaned = cleaned.replace(/(\r\n|\n|\r){2,}/gm, "\n");
		cleaned = cleaned.replace(/\s+/g, " ");

		// Remove any remaining lines that are just whitespace
		cleaned = cleaned
			.split("\n")
			.filter((line) => line.trim() !== "")
			.join("\n");

		return cleaned.trim();
	}

	const emails = [];
	const emailContainers = document.querySelectorAll(".gs");

	emailContainers.forEach((container, index) => {
		const from = container.querySelector(".gD").getAttribute("email");
		const subject = document.querySelector("h2.hP").textContent;
		const date = container.querySelector(".g3").textContent;

		const bodyElement = container.querySelector(".a3s.aiL");
		let body = bodyElement ? bodyElement.innerText : "";
		body = cleanContent(body);

		// Only add the email if the body is not empty after cleaning
		if (body.trim() !== "") {
			emails.push({
				index: index + 1,
				from: from,
				subject: subject,
				date: date,
				body: body,
			});
		}
	});

	return emails;
}
