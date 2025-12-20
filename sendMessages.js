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

    console.log(`🔹 Searching for "${config.keyword}"...`);
    await page.fill('input[placeholder="Search Marketplace"]', config.keyword);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(5000);

    // Collect listing links
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
        await listingPage.waitForTimeout(3000);

        // Click "Message Seller" button
        const messageButton = await listingPage.$('div[aria-label="Message"]') || await listingPage.$('a[href*="/messages/"]');

        if (messageButton) {
          await messageButton.click();
          await listingPage.waitForTimeout(2000);

          // Type message character by character
          for (const char of config.message) {
            await listingPage.keyboard.type(char, { delay: Math.floor(Math.random() * 100) + 50 }); // 50-150ms
          }

          await listingPage.keyboard.press('Enter');
          console.log(`✅ Message sent for listing ${i + 1}.`);
        } else {
          console.log(`⚠️ Message button not found for listing ${i + 1}.`);
        }

        await listingPage.close();
      } catch (err) {
        console.log(`❌ Failed to send message for listing ${i + 1}:`, err.message);
      }

      // Random human-like delay
      const delay = Math.floor(Math.random() * 7000) + 3000; // 3-10s
      await page.waitForTimeout(delay);
    }

    console.log('🎉 Step 4 completed: Messages sent.');
    await browser.close();

  } catch (err) {
    console.log('❌ Unexpected error:', err.message);
    if (browser) await browser.close();
  }
})();
