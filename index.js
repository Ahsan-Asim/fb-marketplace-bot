const { chromium } = require('playwright');
require('dotenv').config();

(async () => {
  // Launch browser
  const browser = await chromium.launch({ headless: false }); // headless: false -> see browser
  const context = await browser.newContext();
  const page = await context.newPage();

  // Go to Facebook login page
  await page.goto('https://www.facebook.com/login');

  console.log('Browser launched. Please log in manually.');

  // Wait until user logs in manually
  await page.waitForTimeout(120000); // 60 seconds for login

  // Save cookies for future runs
  const cookies = await context.cookies();
  const fs = require('fs');
  fs.writeFileSync('cookies.json', JSON.stringify(cookies, null, 2));

  console.log('Cookies saved! You can now reuse login.');

  // Close browser
  await browser.close();
})();
