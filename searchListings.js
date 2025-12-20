const { chromium } = require('playwright');
const fs = require('fs');
const config = require('./config');

(async () => {
  let browser, page;

  try {
    console.log('🔹 Launching browser...');
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();

    // Load saved cookies
    if (fs.existsSync('cookies.json')) {
      const cookies = JSON.parse(fs.readFileSync('cookies.json', 'utf-8'));
      await context.addCookies(cookies);
      console.log('✅ Cookies loaded. Logged in successfully.');
    } else {
      console.log('⚠️ cookies.json not found. Please login manually first.');
      return;
    }

    page = await context.newPage();
    console.log('🔹 Navigating to Facebook Marketplace...');
    await page.goto(config.marketplaceURL, { waitUntil: 'domcontentloaded' });

    console.log(`🔹 Searching for "${config.keyword}"...`);
    // Enter search keyword
    const searchSelector = 'input[placeholder="Search Marketplace"]';
    await page.fill(searchSelector, config.keyword);
    await page.keyboard.press('Enter');

    // Wait for results
    await page.waitForTimeout(5000);

    console.log('🔹 Collecting listings...');
    // Get all listing links visible on page
    const listings = await page.$$eval('a[role="link"][href*="/item/"]', links =>
      links.map(link => link.href)
    );

    if (listings.length === 0) {
      console.log('⚠️ No listings found for this keyword.');
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

        // Extract title/description
        const title = await listingPage.$eval('h1', el => el.innerText).catch(() => '');
        const description = await listingPage.$eval('[data-testid="marketplace-feed-item-description"]', el => el.innerText).catch(() => '');

        const text = (title + ' ' + description).toLowerCase();
        const minQtyStr = `${config.minQuantity} chair`;

        if (text.includes(minQtyStr)) {
          console.log(`✅ Listing passed filter (≥${config.minQuantity} chairs).`);
        } else {
          console.log(`⚠️ Listing skipped (less than ${config.minQuantity} chairs).`);
        }

        await listingPage.close();
      } catch (err) {
        console.log(`❌ Failed to process listing ${i + 1}:`, err.message);
      }

      // Random delay between listings (simulate human)
      const delay = Math.floor(Math.random() * 5000) + 3000;
      await page.waitForTimeout(delay);
    }

    console.log('🎉 Step 3 completed: Marketplace search and filter done.');

    await browser.close();
  } catch (err) {
    console.log('❌ Unexpected error:', err.message);
    if (browser) await browser.close();
  }
})();
