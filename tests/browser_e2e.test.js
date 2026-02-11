/**
 * End-to-End Browser Tests for Chrome Extension
 *
 * Tests the extension in a real Chrome browser using Puppeteer.
 * Verifies:
 * - Extension loads correctly
 * - Backfill from history works
 * - Drill generation works with API keys
 * - UI interactions function properly
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Test configuration
const EXTENSION_PATH = path.resolve(__dirname, '../dist');
const TEST_TIMEOUT = 60000; // 60 seconds

describe('Chrome Extension E2E Tests', () => {
    let browser;
    let extensionPage;
    let serviceWorkerTarget;

    beforeAll(async () => {
        // Check if extension is built
        if (!fs.existsSync(EXTENSION_PATH)) {
            throw new Error('Extension not built. Run "npm run build" first.');
        }

        // Launch Chrome with extension loaded
        // Try to use system Chrome first, fallback to bundled Chromium
        const launchOptions = {
            headless: false, // Must be false for extensions
            args: [
                `--disable-extensions-except=${EXTENSION_PATH}`,
                `--load-extension=${EXTENSION_PATH}`,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        };

        // Try to find Chrome executable
        const possiblePaths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
            '/usr/bin/google-chrome', // Linux
            '/usr/bin/chromium-browser', // Linux Chromium
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' // Windows 32-bit
        ];

        for (const chromePath of possiblePaths) {
            if (fs.existsSync(chromePath)) {
                launchOptions.executablePath = chromePath;
                console.log(`Using Chrome at: ${chromePath}`);
                break;
            }
        }

        try {
            browser = await puppeteer.launch(launchOptions);
        } catch (error) {
            console.error('Failed to launch browser:', error.message);
            console.log('\nTroubleshooting:');
            console.log('1. Make sure Chrome is installed');
            console.log('2. Run: npm run build');
            console.log('3. If on Linux, install: sudo apt-get install chromium-browser');
            throw error;
        }

        // Wait for extension to load and service worker to start
        console.log('Waiting for service worker to start...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Try to find service worker, retry if not found
        let retries = 5;
        while (retries > 0 && !serviceWorkerTarget) {
            const targets = await browser.targets();
            serviceWorkerTarget = targets.find(
                target => target.type() === 'service_worker'
            );

            if (!serviceWorkerTarget) {
                console.log(`Service worker not found, retrying... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                retries--;
            }
        }

        if (!serviceWorkerTarget) {
            const targets = await browser.targets();
            console.error('Available targets:', targets.map(t => ({ type: t.type(), url: t.url() })));
            console.error('\nExtension may not have loaded. Check:');
            console.error('1. manifest.json is valid');
            console.error('2. Extension built successfully (npm run build)');
            console.error('3. No errors in dist/background.js');
            throw new Error('Extension service worker not found. Make sure the extension loaded correctly.');
        }

        console.log('Extension loaded successfully');
        console.log('Service worker URL:', serviceWorkerTarget.url());
    }, TEST_TIMEOUT);

    afterAll(async () => {
        if (browser) {
            await browser.close();
        }
    });

    describe('Extension Loading', () => {
        test('should load extension service worker', async () => {
            expect(serviceWorkerTarget).toBeDefined();
            expect(serviceWorkerTarget.type()).toBe('service_worker');
        });

        test('should have background script loaded', async () => {
            const worker = await serviceWorkerTarget.worker();
            expect(worker).toBeDefined();
        });
    });

    describe('Module Loading', () => {
        test('should load SkillMatrix module', async () => {
            const worker = await serviceWorkerTarget.worker();

            const hasSkillMatrix = await worker.evaluate(() => {
                return typeof self.SkillMatrix !== 'undefined' &&
                       typeof self.SkillMatrix.SkillMatrix !== 'undefined';
            });

            expect(hasSkillMatrix).toBe(true);
        });

        test('should load LLMGateway module', async () => {
            const worker = await serviceWorkerTarget.worker();

            const hasLLMGateway = await worker.evaluate(() => {
                return typeof self.LLMGateway !== 'undefined';
            });

            expect(hasLLMGateway).toBe(true);
        });

        test('should load DrillGenerator module', async () => {
            const worker = await serviceWorkerTarget.worker();

            const hasDrillGenerator = await worker.evaluate(() => {
                return typeof self.DrillGenerator !== 'undefined';
            });

            expect(hasDrillGenerator).toBe(true);
        });

        test('should load GeminiClient module', async () => {
            const worker = await serviceWorkerTarget.worker();

            const hasGeminiClient = await worker.evaluate(() => {
                return typeof self.GeminiClient !== 'undefined';
            });

            expect(hasGeminiClient).toBe(true);
        });

        test('should load OpenAIClient module', async () => {
            const worker = await serviceWorkerTarget.worker();

            const hasOpenAIClient = await worker.evaluate(() => {
                return typeof self.OpenAIClient !== 'undefined';
            });

            expect(hasOpenAIClient).toBe(true);
        });
    });

    describe('Backfill from History', () => {
        test('should initialize SkillMatrix', async () => {
            const worker = await serviceWorkerTarget.worker();

            const result = await worker.evaluate(async () => {
                const matrix = new self.SkillMatrix.SkillMatrix();
                await matrix.init();
                return {
                    initialized: matrix.initialized,
                    hasDNA: !!matrix.dna,
                    skillCount: Object.keys(matrix.dna?.skills || {}).length
                };
            });

            expect(result.initialized).toBe(true);
            expect(result.hasDNA).toBe(true);
            expect(result.skillCount).toBeGreaterThan(0);
        });

        test('should handle backfill request', async () => {
            const worker = await serviceWorkerTarget.worker();

            // Set up test data
            await worker.evaluate(async () => {
                await chrome.storage.local.set({
                    problems: {
                        'two-sum': {
                            slug: 'two-sum',
                            title: 'Two Sum',
                            difficulty: 'Easy',
                            topics: ['Array', 'Hash Table'],
                            history: [
                                { date: new Date().toISOString(), rating: 3, status: 'Accepted' }
                            ]
                        }
                    }
                });
            });

            // Trigger backfill
            const result = await worker.evaluate(async () => {
                return new Promise((resolve) => {
                    chrome.runtime.sendMessage(
                        { action: 'backfillHistory' },
                        (response) => resolve(response)
                    );
                });
            });

            expect(result.success).toBe(true);
            expect(result.count).toBeGreaterThanOrEqual(1);
        }, TEST_TIMEOUT);
    });

    describe('Drill Generation', () => {
        test('should detect API key presence', async () => {
            const worker = await serviceWorkerTarget.worker();

            // Set up test API key
            await worker.evaluate(async () => {
                await chrome.storage.local.set({
                    keys: { openai: 'test-api-key-12345' },
                    selectedModelId: 'gpt-4o',
                    aiProvider: 'cloud'
                });
            });

            const hasApiKey = await worker.evaluate(async () => {
                if (typeof self.LLMGateway === 'undefined') return false;
                const key = await self.LLMGateway.getApiKey();
                return !!key;
            });

            expect(hasApiKey).toBe(true);
        });

        test('should have DrillGenerator available', async () => {
            const worker = await serviceWorkerTarget.worker();

            const hasDrillGenerator = await worker.evaluate(() => {
                return typeof self.DrillGenerator !== 'undefined' &&
                       typeof self.DrillGenerator.generateFromWeakSkills === 'function';
            });

            expect(hasDrillGenerator).toBe(true);
        });
    });

    describe('Options Page', () => {
        test('should open options page', async () => {
            const page = await browser.newPage();

            // Get extension ID
            const extensionId = serviceWorkerTarget.url().split('/')[2];
            const optionsUrl = `chrome-extension://${extensionId}/dist/src/options/options.html`;

            await page.goto(optionsUrl, { waitUntil: 'networkidle0' });

            const title = await page.title();
            expect(title).toBeTruthy();

            await page.close();
        });

        test('should have backfill button', async () => {
            const page = await browser.newPage();

            const extensionId = serviceWorkerTarget.url().split('/')[2];
            const optionsUrl = `chrome-extension://${extensionId}/dist/src/options/options.html`;

            await page.goto(optionsUrl, { waitUntil: 'networkidle0' });

            // Look for backfill button (adjust selector based on actual HTML)
            const hasBackfillButton = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.some(btn =>
                    btn.textContent.toLowerCase().includes('backfill') ||
                    btn.textContent.toLowerCase().includes('history')
                );
            });

            expect(hasBackfillButton).toBe(true);

            await page.close();
        });

        test('should have drill generation button', async () => {
            const page = await browser.newPage();

            const extensionId = serviceWorkerTarget.url().split('/')[2];
            const optionsUrl = `chrome-extension://${extensionId}/dist/src/options/options.html`;

            await page.goto(optionsUrl, { waitUntil: 'networkidle0' });

            const hasDrillButton = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.some(btn =>
                    btn.textContent.toLowerCase().includes('drill') ||
                    btn.textContent.toLowerCase().includes('generate')
                );
            });

            expect(hasDrillButton).toBe(true);

            await page.close();
        });
    });

    describe('Popup', () => {
        test('should open popup', async () => {
            const page = await browser.newPage();

            const extensionId = serviceWorkerTarget.url().split('/')[2];
            const popupUrl = `chrome-extension://${extensionId}/dist/src/popup/popup.html`;

            await page.goto(popupUrl, { waitUntil: 'networkidle0' });

            const title = await page.title();
            expect(title).toBeTruthy();

            await page.close();
        });
    });
});
