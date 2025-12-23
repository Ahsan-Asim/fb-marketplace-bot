const { chromium } = require('playwright');
const fs = require('fs');
const config = require('./config');
const chairKeywords = ['chair', 'chairs', 'stuhl', 'stühle'];

// Maximum messages to send in a run
const MAX_MESSAGES = 20;
let messagesSent = 0;

(async () => {
  let browser;
  try {
    console.log('🔹 Launching browser...');
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();

    // Load saved cookies
    if (!fs.existsSync('cookies.json')) {
      console.log('⚠️ cookies.json not found. Please login manually first.');
      return;
    }
    const cookies = JSON.parse(fs.readFileSync('cookies.json', 'utf-8'));
    await context.addCookies(cookies);
    console.log('✅ Cookies loaded. Logged in successfully.');

    const page = await context.newPage();
    await page.goto(config.marketplaceURL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000); // wait for full page load

    console.log(`🔹 Waiting for Marketplace page to fully load...`);
    await page.waitForSelector('input[placeholder="Search Marketplace"]', { state: 'visible', timeout: 120000 });
    console.log('✅ Marketplace fully loaded.');

    await page.waitForTimeout(2000);

    // Search for listings
    await page.fill('input[placeholder="Search Marketplace"]', config.keyword);
    await page.keyboard.press('Enter');
    console.log(`🔹 Waiting for search results to fully load...`);
    await page.waitForTimeout(2000);

    await page.waitForSelector('a[role="link"][href*="/item/"]', { state: 'visible', timeout: 60000 });
    const listings = await page.$$eval('a[role="link"][href*="/item/"]', links =>
      links.map(link => link.href)
    );

    if (listings.length === 0) {
      console.log('⚠️ No listings found.');
      return;
    }
    console.log(`✅ Found ${listings.length} listings.`);

    // Loop through listings
    for (let i = 0; i < listings.length; i++) {
      if (messagesSent >= MAX_MESSAGES) {
        console.log(`⚠️ Maximum message limit of ${MAX_MESSAGES} reached. Stopping.`);
        break;
      }

      const url = listings[i];
      console.log(`🔹 Opening listing ${i + 1}: ${url}`);

      try {
        const listingPage = await context.newPage();
        await listingPage.goto(url, { waitUntil: 'domcontentloaded' });

        // Wait for message button
        const messageButton = await listingPage.$('div[aria-label="Message"], a[href*="/messages/"]');
        if (!messageButton) {
          console.log(`⚠️ No message button found for listing ${i + 1}. Skipping...`);
          await listingPage.close();
          continue;
        }

        // Click message button
        await messageButton.click();
        await listingPage.waitForTimeout(3000);

        // Wait for modal
        const modal = await listingPage.waitForSelector('div[role="dialog"]', { state: 'visible', timeout: 60000 });
        if (!modal) {
          console.log(`⚠️ Message modal did not appear for listing ${i + 1}. Skipping...`);
          await listingPage.close();
          continue;
        }

        // Wait for textarea
        const messageBox = await modal.waitForSelector('textarea[dir="ltr"]', { state: 'visible', timeout: 60000 });
        if (!messageBox) {
          console.log(`⚠️ Message box not found in modal for listing ${i + 1}. Skipping...`);
          await listingPage.close();
          continue;
        }

        await messageBox.click({ clickCount: 1 });

        // Type message human-like
        for (const char of config.message) {
          await listingPage.keyboard.type(char, { delay: Math.floor(Math.random() * 100) + 10 });
        }

        // Send message
        const sendButton = await modal.$('button[aria-label="Send message"], div[aria-label="Send message"]');
        if (sendButton) {
          await sendButton.click();
          console.log('✅ Message sent by clicking Send button');
        } else {
          console.log('⚠️ Send button not found, message may not be sent');
        }

        messagesSent++; // increment counter after sending
        console.log(`✅ Message sent for listing ${i + 1}. Total sent: ${messagesSent}`);

        await listingPage.close();

        // Random human-like delay
        const delay = Math.floor(Math.random() * 7000) + 3000; // 3-10s
        await page.waitForTimeout(delay);
        await page.waitForTimeout(2000);

      } catch (err) {
        console.log(`❌ Failed for listing ${i + 1}:`, err.message);
      }
    }

    console.log(`🎉 Messaging process completed. Total messages sent: ${messagesSent}`);
    await browser.close();

  } catch (err) {
    console.log('❌ Unexpected error:', err.message);
    if (browser) await browser.close();
  }
})();
