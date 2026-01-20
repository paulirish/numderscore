const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const testHtmlPath = path.join(__dirname, 'test.html');
  await page.goto(`file://${testHtmlPath}`);

  // Wait for font to load and canvas to be drawn
  // The test.html has logic that writes "Detected..." to the pre tag when done.
  const resultSelector = '#canvas-test-container pre';
  await page.waitForSelector(resultSelector);

  // Wait a bit more to ensure rendering is stable (though waitForSelector should be enough)
  await page.waitForTimeout(500);

  const canvasElement = await page.$('#canvas-test-container canvas');
  if (!canvasElement) {
    console.error('Canvas element not found');
    process.exit(1);
  }

  await canvasElement.screenshot({ path: 'golden.png' });
  console.log('golden.png created');

  await browser.close();
})();
