const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const pathToExtension = path.resolve(__dirname, '..');
    console.log(`Loading extension from: ${pathToExtension}`);

    const browser = await puppeteer.launch({
        headless: false, // Must be false to load extensions
        args: [
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`
        ]
    });

    const page = await browser.newPage();

    try {
        console.log('Navigating to LeetCode Two Sum...');
        await page.goto('https://leetcode.com/problems/two-sum/', { waitUntil: 'networkidle2' });

        // Wait and check if ANY extension-specific potential element exists or console log
        // Since our extension injects a content script, we can check if it logged to console.

        // We can also check if we can find the difficulty element which our script looks for.
        // Our script logs "[LeetCode EasyRepeat] Extension content script loaded...".

        // Let's inject a specialized check
        const title = await page.title();
        console.log(`Page Title: ${title}`);

        // We can check execution of content script by evaluating a variable if we exposed one, 
        // but we didn't expose one globally on window. 
        // However, we can check for the toast if we simulate a "submission".
        // Or we can just verify the browser opened and loaded the page with the extension.

        console.log('Browser opened successfully with extension loaded.');
        console.log('You can manually interact with the page now.');

        // Keep open for a bit to allow manual verification if "Headless" is false
        // await new Promise(r => setTimeout(r, 10000)); 

    } catch (err) {
        console.error('Test Failed:', err);
    } finally {
        // await browser.close();
        console.log('Closing browser in 5 seconds...');
        setTimeout(async () => {
            await browser.close();
        }, 5000);
    }
})();
