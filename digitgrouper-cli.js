const fs = require('fs');
const { processFont, generateFontFace } = require('./digitgrouper.js');

const defaultFontPath = 'out/Times-New-Roman.ttf';
const defaultOutPath = 'out/Times-New-Roman-JS.ttf';

async function main() {
    const args = process.argv.slice(2);
    let fontPath = defaultFontPath;
    let outPath = defaultOutPath;

    if (args.length >= 2) {
        fontPath = args[0];
        outPath = args[1];
    } else if (args.length === 1) {
        console.log('Usage: node digitgrouper-cli.js [input_font] [output_font]');
        console.log('Using default paths...');
    }

    console.log(`Loading ${fontPath}...`);
    if (!fs.existsSync(fontPath)) {
        console.error(`File not found: ${fontPath}`);
        return;
    }

    const buffer = fs.readFileSync(fontPath);
    // Convert Buffer to ArrayBuffer
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    try {
        const outArrayBuffer = processFont(arrayBuffer);

        console.log(`Saving to ${outPath}...`);
        fs.writeFileSync(outPath, Buffer.from(outArrayBuffer));

        // Also log the generated @font-face rule for convenience
        const fontName = outPath.split('/').pop().replace(/\.[^/.]+$/, "");
        console.log('\nGenerated @font-face rule:');
        console.log(generateFontFace(fontName, outPath));

        console.log('Done.');
    } catch (err) {
        console.error('Error processing font:', err);
    }
}

main().catch(err => console.error(err));
