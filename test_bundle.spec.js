const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const http = require('http');
const handler = require('serve-handler');

// Helper to start a static server
const startServer = async () => {
    const server = http.createServer((request, response) => {
        return handler(request, response, { public: '.' });
    });

    return new Promise((resolve) => {
        server.listen(0, () => {
            const port = server.address().port;
            resolve({ server, port });
        });
    });
};

test('DigitGrouper browser bundle works', async ({ page }) => {
    const { server, port } = await startServer();
    const url = `http://localhost:${port}/test_bundle.html`;

    try {
        await page.goto(url);

        // Wait for the test to complete
        const statusDiv = page.locator('#status');
        await expect(statusDiv).toHaveAttribute('data-result', 'success', { timeout: 10000 });

        const text = await statusDiv.textContent();
        expect(text).toBe('Success');

    } finally {
        server.close();
    }
});
