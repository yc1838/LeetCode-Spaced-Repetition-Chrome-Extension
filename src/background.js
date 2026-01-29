/**
 * LeetCode EasyRepeat - Background Service Worker
 * Handles events that persist beyond the lifecycle of a single page or popup.
 */

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handler: Open Options Page
    if (request.action === "openOptions") {
        console.log("[Background] Opening Options Page.");
        chrome.runtime.openOptionsPage();
        return true;
    }

    // Handler: Proxy Fetch
    if (request.action === "proxyFetch") {
        const { url, options } = request;
        console.log(`[Background] ---------------------------------------------------`);
        console.log(`[Background] PROXY FETCH START`);
        console.log(`[Background] URL: ${url}`);
        console.log(`[Background] Method: ${options.method || 'GET'}`);
        console.log(`[Background] Headers Sent:`, options.headers);

        fetch(url, options)
            .then(async (response) => {
                console.log(`[Background] PROXY FETCH RESPONSE`);
                console.log(`[Background] Status: ${response.status} ${response.statusText}`);

                const text = await response.text();
                // We consider it a "success" if the network call completed, 
                // even if the API returned 404/500 to let the caller handle logic.
                const result = {
                    success: true,
                    ok: response.ok,
                    status: response.status,
                    data: text
                };
                console.log(`[Background] Body Length: ${text.length}`);
                console.log(`[Background] ---------------------------------------------------`);
                sendResponse(result);
            })
            .catch((error) => {
                console.error(`[Background] PROXY FETCH ERROR:`, error.message);
                console.log(`[Background] ---------------------------------------------------`);
                sendResponse({ success: false, error: error.message });
            });

        return true; // Keep channel open for async response
    }

    // Future: Handle other background tasks (e.g. daily reminders, alarms)
});

console.log("[Background] Service Worker Loaded.");
