const summarizeBtn = document.getElementById("summarize");
const copyBtn = document.getElementById("copy-btn");
const resultEl = document.getElementById("result");
const summaryTypeEl = document.getElementById("summary-type");

summarizeBtn.addEventListener("click", async () => {
    try {
        resultEl.innerHTML = '<div class="loading"><div class="loader"></div></div>';

        const summaryType = summaryTypeEl.value;
        const { geminiApiKey } = await chrome.storage.sync.get(["geminiApiKey"]);

        if (!geminiApiKey) {
            resultEl.textContent = "Please set your Gemini API key in the options.";
            return;
        }

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
            resultEl.textContent = "No active tab found.";
            return;
        }

        if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:")) {
            resultEl.textContent = "This page cannot be summarized. Open a regular website page and try again.";
            return;
        }

        let response;
        try {
            response = await chrome.tabs.sendMessage(tab.id, { type: "GET_ARTICLE_TEXT" });
        } catch (err) {
            resultEl.textContent = "Unable to read this page. Reload the page and try again.";
            return;
        }

        const text = response?.text;
        if (!text) {
            resultEl.textContent = "Could not extract article text.";
            return;
        }

        const summary = await getGeminiSummary(text, summaryType, geminiApiKey);
        resultEl.textContent = summary;
    } catch (error) {
        resultEl.textContent = "Error: " + (error?.message || "Unknown error");
    }
});

async function getGeminiSummary(rawText, summaryType, geminiApiKey) {
    const max = 2000;
    const text = rawText.length > max ? rawText.slice(0, max) + "..." : rawText;

    const promptMap = {
        brief: `Summarize in 2-3 sentences:\n\n${text}`,
        detailed: `Give a detailed summary:\n\n${text}`,
        bullets: `Summarize in 5-7 bullet points (start each line with "-"):\n\n${text}`
    };

    const prompt = promptMap[summaryType] || promptMap.brief;

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2 }
            })
        }
    );

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || "Request failed");
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No summary returned.";
}

copyBtn.addEventListener("click", () => {
    const resultText = resultEl.innerText;

    if (!resultText || resultText.trim() === "") {
        return;
    }

    navigator.clipboard.writeText(resultText).then(() => {
        const originalText = copyBtn.innerText;
        copyBtn.innerText = "Copied!";
        setTimeout(() => {
            copyBtn.innerText = originalText;
        }, 2000);
    }).catch((err) => {
        alert("Failed to copy: " + err);
    });
});
