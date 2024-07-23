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
	} else {
		console.log("Unknown request:", request);
		sendResponse({ error: "Unknown request" });
	}
	return true;
});
