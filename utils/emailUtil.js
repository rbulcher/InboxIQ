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

export async function getEmails() {
	return new Promise((resolve, reject) => {
		chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
			if (tabs.length === 0) {
				reject(new Error("No active tab found"));
				return;
			}

			const tab = tabs[0];
			try {
				chrome.tabs.sendMessage(
					tab.id,
					{ action: "scrapeEmails" },
					(response) => {
						if (chrome.runtime.lastError) {
							reject(new Error(chrome.runtime.lastError.message));
							return;
						}

						if (response && response.emails) {
							const emails = response.emails;
							console.log(emails);
							const threadContent = emails
								.map(
									(email) =>
										`From: ${email.from}\n` +
										`Subject: ${email.subject}\n` +
										`Date: ${email.date}\n` +
										`Body: ${email.body}\n\n`
								)
								.join("");

							resolve({
								content: threadContent,
								subject: emails[0].subject,
							});
						} else {
							reject(new Error("Failed to scrape emails"));
						}
					}
				);
			} catch (error) {
				reject(error);
			}
		});
	});
}
function scrapeGmailThread() {
	function extractEmails() {
		const emails = [];

		const emailContainers = document.querySelectorAll(".gs");

		emailContainers.forEach((container, index) => {
			const from = container.querySelector(".gD").getAttribute("email");
			const subject = document.querySelector("h2.hP").textContent;
			const date = container.querySelector(".g3").textContent;

			const bodyElement = container.querySelector(".a3s.aiL");
			const body = bodyElement ? bodyElement.innerText : "";

			emails.push({
				index: index + 1,
				from: from,
				subject: subject,
				date: date,
				body: body,
			});
		});

		return emails;
	}

	const expandAllButton = document.querySelector('[aria-label="Expand all"]');
	if (expandAllButton) {
		expandAllButton.click();
	}

	return extractEmails();
}
