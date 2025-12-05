import { chromium } from 'playwright-core';
import * as fs from 'fs';
import * as path from 'path';

export async function runAutomation(url: string, onLog: (msg: string) => void, userDataDir?: string, outputDir?: string) {
    const log = (msg: string) => {
        console.log(msg);
        if (onLog) onLog(msg);
    };

    // Use provided userDataDir or default to local folder (for dev)
    const finalUserDataDir = userDataDir || path.join(__dirname, 'user_data');
    const finalOutputDir = outputDir || __dirname;

    // Launch with persistent context and anti-bot args
    const context = await chromium.launchPersistentContext(finalUserDataDir, {
        headless: false,
        channel: 'chrome', // Try to use system Chrome
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list',
            '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ],
        viewport: null // Let browser decide window size
    });

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    // Anti-detection script
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });
    });

    try {
        log('Navigating to NotebookLM...');
        await page.goto('https://notebooklm.google.com/');

        // Check if login is needed
        log('Please log in to Google if you haven\'t already.');
        log('Waiting for "New Notebook" button or main interface...');

        // Wait for the "New Notebook" button or similar indicator of being logged in
        try {
            // Look for English or Japanese "New Notebook", "Create new", etc.
            // User reported: "新規作成", "ノートブックを新規作成"
            await page.waitForSelector('text=/New Notebook|新しいノートブック|新規作成|ノートブックを新規作成/', { timeout: 120000 });
        } catch (e) {
            log('Timed out waiting for "New Notebook". Please login manually in the browser window.');
            log('If you are blocked by "This browser is not secure", try closing and running again, or use the Remote Debugging method.');
            // Keep open for user to see
            await page.waitForTimeout(10000);
            return;
        }

        log('Logged in. Creating new notebook...');
        await page.click('text=/New Notebook|新しいノートブック|新規作成|ノートブックを新規作成/');

        // Wait for notebook to open. 
        await page.waitForSelector('text=/Add source|ソースを追加/');

        log(`Adding source: ${url}`);
        // Click "Website" or "Link" source option.
        // Use exact match to avoid matching description text like "PDF、ウェブサイト、テキスト..."
        await page.click('text=/^Website$|^ウェブサイト$|^Webサイト$/', { force: true });

        // Wait for input field
        // Fallback: Click the placeholder text directly to focus, then type
        // This handles cases where the input is obscured or hard to select
        const placeholderText = page.locator('text=/URL を貼り付け|Paste URL/');
        await placeholderText.first().click({ force: true });

        // Type the URL character by character
        await page.waitForTimeout(500);
        await page.keyboard.type(url, { delay: 10 });
        await page.waitForTimeout(500);

        // Wait a bit for validation
        await page.waitForTimeout(2000);

        // Click "Insert" (挿入)
        // The button in the screenshot says "挿入". 
        // We wait for it to be enabled.
        const insertButton = page.locator('text=/^Insert$|^挿入$/');
        await insertButton.waitFor({ state: 'visible', timeout: 10000 });
        // Sometimes it takes a moment to become enabled
        await page.waitForTimeout(1000);
        await insertButton.click();

        log('Waiting for source to be processed...');

        // Wait for "Video Overview" (動画解説) button in Studio section
        // The user wants to click "動画解説", then select "ペーパークラフト", then "生成"
        await page.waitForSelector('text=/動画解説|Video Overview/', { timeout: 120000 });

        log('Opening Video Overview...');
        // Wait a bit for the UI to settle after the button appears
        await page.waitForTimeout(5000);
        await page.click('text=/動画解説|Video Overview/');

        try {
            log('Attempting to select Visual Style: Papercraft...');
            // Try to find Papercraft with a shorter timeout. 
            // If generation started automatically, this might not appear, which is fine.
            await page.waitForSelector('text=/ペーパークラフト|Papercraft/', { timeout: 10000 });
            await page.click('text=/ペーパークラフト|Papercraft/');
            log('Selected Papercraft style.');

            log('Clicking Generate...');
            // Click "Generate" (生成)
            await page.click('text=/^Generate$|^生成$/');
        } catch (e) {
            log('Style selection or Generate button not found. Assuming video generation started automatically or style is already applied.');
        }

        log('Waiting for video generation (this can take 5+ minutes)...');

        // Polling loop to find the download button
        const startTime = Date.now();
        const maxWaitTime = 20 * 60 * 1000; // 20 minutes

        let downloaded = false;

        while (Date.now() - startTime < maxWaitTime) {
            try {
                // Get all "More options" buttons (English and Japanese)
                // Google apps often use "More options", "その他のオプション", "その他の操作", "メニュー", "もっと見る"
                const menuButtons = page.locator('button[aria-label*="More options"], button[aria-label*="その他の"], button[aria-label="Menu"], button[aria-label="メニュー"], button[aria-label="もっと見る"]');
                const count = await menuButtons.count();
                log(`Found ${count} menu buttons.`);

                if (count > 0) {
                    // Iterate from the last button backwards
                    for (let i = count - 1; i >= 0; i--) {
                        const button = menuButtons.nth(i);
                        log(`Clicking menu button ${i + 1}...`);
                        await button.click();

                        // Check if "Download" is visible
                        const downloadBtn = page.locator('text=/Download|ダウンロード/');
                        // Wait a short moment for menu animation
                        await page.waitForTimeout(500);

                        if (await downloadBtn.isVisible()) {
                            log(`Download button found in menu item ${i + 1}. Downloading...`);
                            const downloadPromise = page.waitForEvent('download');
                            await downloadBtn.click();
                            const download = await downloadPromise;

                            // Extract filename from URL
                            let filename = 'video_overview.mp4';
                            try {
                                const urlObj = new URL(url);
                                const pathname = urlObj.pathname;
                                const basename = path.basename(pathname);
                                if (basename && basename.length > 0 && basename !== '/') {
                                    // Remove extension from URL filename if present and add .mp4
                                    const nameWithoutExt = path.parse(basename).name;
                                    filename = `${nameWithoutExt}.mp4`;
                                }
                            } catch (e) {
                                log(`Could not parse URL for filename, using default: ${e}`);
                            }

                            const savePath = path.join(finalOutputDir, filename);
                            await download.saveAs(savePath);
                            log(`Saved video to ${savePath}`);
                            downloaded = true;
                            break;
                        } else {
                            log(`Download button NOT found in menu item ${i + 1}. Closing menu.`);
                            // Close menu
                            await page.keyboard.press('Escape');
                            await page.waitForTimeout(500);
                        }
                    }
                } else {
                    log('No "More options" buttons found.');
                }

                if (downloaded) break;

            } catch (e) {
                log(`Error during polling: ${e}`);
            }

            // Wait before retrying
            log(`Still waiting... (Elapsed: ${Math.floor((Date.now() - startTime) / 1000)}s)`);
            await page.waitForTimeout(10000); // Check every 10 seconds
        }

        if (!downloaded) {
            throw new Error('Timed out waiting for video download button.');
        }

    } catch (error) {
        console.error('An error occurred:', error);
        log(`Error: ${error}`);
        throw error; // Re-throw so the caller knows it failed
    } finally {
        // Do not close browser immediately so user can see what happened
        // await context.close(); 
    }
}

// CLI usage (only if run directly)
if (require.main === module) {
    const url = process.argv[2];
    if (url) {
        runAutomation(url, console.log).catch(console.error);
    } else {
        console.log('Usage: ts-node notebooklm_bot.ts <URL>');
    }
}
