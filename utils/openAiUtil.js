const apiKeyInput = document.getElementById("apiKey");

export async function callOpenAIAPI(content) {
	const apiKey = apiKeyInput.value;
	const response = await fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: "gpt-4o-mini",
			messages: [
				{
					role: "system",
					content:
						"Summarize the following email or emails in the thread. Please give 2-3 main points, and any key speakers if there are any:",
				},
				{ role: "user", content: content },
			],
			temperature: 1,
			max_tokens: 256,
			top_p: 1,
			frequency_penalty: 0,
			presence_penalty: 0,
			stream: true,
		}),
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder("utf-8");
	let buffer = "";

	return {
		async *[Symbol.asyncIterator]() {
			while (true) {
				const { done, value } = await reader.read();
				if (done) return;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop();

				for (const line of lines) {
					if (line.startsWith("data: ")) {
						const data = line.slice(6);
						if (data === "[DONE]") return;
						try {
							const parsed = JSON.parse(data);
							const content = parsed.choices[0]?.delta?.content;
							if (content) yield content;
						} catch (error) {
							console.error("Error parsing JSON:", error);
						}
					}
				}
			}
		},
	};
}

export async function callOpenAIChatAPI(messages) {
	const apiKey = apiKeyInput.value;
	const response = await fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: "gpt-4o-mini",
			messages: messages,
			temperature: 1,
			max_tokens: 256,
			top_p: 1,
			frequency_penalty: 0,
			presence_penalty: 0,
			stream: true,
		}),
	});

	if (!response.ok) {
		throw new Error(`HTTP error! status: ${response.status}`);
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder("utf-8");
	let buffer = "";

	return {
		async *[Symbol.asyncIterator]() {
			while (true) {
				const { done, value } = await reader.read();
				if (done) return;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop();

				for (const line of lines) {
					if (line.startsWith("data: ")) {
						const data = line.slice(6);
						if (data === "[DONE]") return;
						try {
							const parsed = JSON.parse(data);
							const content = parsed.choices[0]?.delta?.content;
							if (content) yield content;
						} catch (error) {
							console.error("Error parsing JSON:", error);
						}
					}
				}
			}
		},
	};
}
