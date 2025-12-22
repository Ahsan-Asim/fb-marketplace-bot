const { chromium } = require('playwright');
const fs = require('fs');
const config = require('./config');

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

    console.log(`🔹 Waiting for Marketplace page to fully load...`);
    await page.waitForSelector('input[placeholder="Search Marketplace"]', { state: 'visible', timeout: 60000 });
    console.log('✅ Marketplace fully loaded.');

    // Search for listings
    await page.fill('input[placeholder="Search Marketplace"]', config.keyword);
    await page.keyboard.press('Enter');

    console.log(`🔹 Waiting for search results to fully load...`);
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

        // Small delay to let modal start opening
        await listingPage.waitForTimeout(1000);

        // Wait for the modal (dialog) to appear
        const modal = await listingPage.waitForSelector('div[role="dialog"]', { state: 'visible', timeout: 30000 });
        if (!modal) {
          console.log(`⚠️ Message modal did not appear for listing ${i + 1}. Skipping...`);
          await listingPage.close();
          continue;
        }

        // Wait for the textarea inside modal
        const messageBox = await modal.waitForSelector('textarea[dir="ltr"]', { state: 'visible', timeout: 30000 });
        if (!messageBox) {
          console.log(`⚠️ Message box not found in modal for listing ${i + 1}. Skipping...`);
          await listingPage.close();
          continue;
        }

        // Focus the textarea
        await messageBox.click({ clickCount: 1 });

        // Type message human-like
        for (const char of config.message) {
          await listingPage.keyboard.type(char, { delay: Math.floor(Math.random() * 100) + 50 });
        }

        // Send message
        await listingPage.keyboard.press('Enter');

        console.log(`✅ Message sent for listing ${i + 1}.`);
        await listingPage.close();

        // Random human-like delay between listings
        const delay = Math.floor(Math.random() * 7000) + 3000; // 3-10s
        await page.waitForTimeout(delay);

      } catch (err) {
        console.log(`❌ Failed for listing ${i + 1}:`, err.message);
      }
    }

    console.log('🎉 All possible messages sent successfully.');
    await browser.close();

  } catch (err) {
    console.log('❌ Unexpected error:', err.message);
    if (browser) await browser.close();
  }
})();
