const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

(async () => {
  // Dynamic import for ESM-only module
  const { default: pixelmatch } = await import('pixelmatch');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const testHtmlPath = path.join(__dirname, 'test.html');
  await page.goto(`file://${testHtmlPath}`);

  // Wait for font to load and canvas to be drawn
  const resultSelector = '#canvas-test-container pre';
  await page.waitForSelector(resultSelector);

  // Wait a bit more for stability
  await page.waitForTimeout(500);

  const canvasElement = await page.$('#canvas-test-container canvas');
  if (!canvasElement) {
    console.error('Canvas element not found');
    process.exit(1);
  }

  const screenshotPath = 'test_screenshot.png';
  await canvasElement.screenshot({ path: screenshotPath });

  // Compare with golden
  const goldenPath = 'golden.png';
  if (!fs.existsSync(goldenPath)) {
    console.error('Golden image not found');
    process.exit(1);
  }

  const img1 = PNG.sync.read(fs.readFileSync(goldenPath));
  const img2 = PNG.sync.read(fs.readFileSync(screenshotPath));
  const { width, height } = img1;
  const diff = new PNG({ width, height });

  const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });

  if (numDiffPixels > 0) {
    console.error(`Test failed: ${numDiffPixels} pixels differ`);
    fs.writeFileSync('diff.png', PNG.sync.write(diff));
    // Don't exit yet, check logic too
  } else {
    console.log('Test passed: Screenshots match');
  }

  // Check the text content for "PASSED" (logic test from the HTML)
  const textContent = await page.evaluate(() => {
    return document.querySelector('#canvas-test-container pre').textContent;
  });

  // Clean up test screenshot
  fs.unlinkSync(screenshotPath);
  await browser.close();

  if (!textContent.includes('PASSED: Larger gaps detected at grouping positions!')) {
      console.error('Test failed: Logic check in HTML failed.');
      console.error('Output:', textContent);
      process.exit(1);
  } else {
      console.log('Test passed: Logic check in HTML passed');
      console.log('Output:', textContent);
  }

  if (numDiffPixels > 0) {
      process.exit(1);
  }
})();
