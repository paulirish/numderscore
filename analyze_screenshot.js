const Tesseract = require('tesseract.js');
const path = require('path');

const screenshotPath = path.join(__dirname, 'test_screenshot.png');

Tesseract.recognize(
  screenshotPath,
  'eng',
  { logger: m => console.log(m) }
).then(({ data: { text } }) => {
  console.log('OCR Result:');
  console.log(text);
});
