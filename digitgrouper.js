const fs = require('fs');
// Using vendored opentype.js with Type 8 support patched in
const opentype = require('./lib/opentype-patched.js');

const fontPath = 'out/Times-New-Roman-orig.ttf';
const outPath = 'out/Times-New-Roman-JS.ttf';

async function main() {
    console.log(`Loading ${fontPath}...`);
    if (!fs.existsSync(fontPath)) {
        console.error(`File not found: ${fontPath}`);
        return;
    }
    const buffer = fs.readFileSync(fontPath);
    const font = opentype.parse(buffer.buffer);

    // 1. Identify digits
    const digits = '0123456789'.split('');
    const digitIndices = digits.map(d => font.charToGlyphIndex(d));
    const commaIndex = font.charToGlyphIndex(',');
    const commaGlyph = font.glyphs.get(commaIndex);

    console.log('Digit indices:', digitIndices);
    console.log('Comma index:', commaIndex);

    // 2. Create capture_L glyphs (copies of digits)
    const captureLIndices = [];
    digits.forEach((d, i) => {
        const origIdx = digitIndices[i];
        const origGlyph = font.glyphs.get(origIdx);

        // Clone path
        const newPath = new opentype.Path();
        if (origGlyph.path) {
            newPath.commands = JSON.parse(JSON.stringify(origGlyph.path.commands));
            newPath.fill = origGlyph.path.fill;
            newPath.stroke = origGlyph.path.stroke;
            newPath.strokeWidth = origGlyph.path.strokeWidth;
        }

        const newGlyph = new opentype.Glyph({
            name: `capture_L_d${d}`,
            advanceWidth: origGlyph.advanceWidth,
            path: newPath,
            unicode: undefined // Internal use
        });

        const newIdx = font.glyphs.length;
        font.glyphs.glyphs[newIdx] = newGlyph;
        font.glyphs.length++;
        captureLIndices.push(newIdx);
    });
    console.log('Created capture_L glyphs:', captureLIndices);

    // 3. Create group_L glyphs (composite: digit + comma)
    const groupLIndices = [];
    digits.forEach((d, i) => {
        const origIdx = digitIndices[i];
        const origGlyph = font.glyphs.get(origIdx);

        const newGlyph = new opentype.Glyph({
            name: `group_L_d${d}`,
            advanceWidth: origGlyph.advanceWidth + commaGlyph.advanceWidth,
            unicode: undefined
        });

        // Some environments prefer paths over components in glyf
        // But components are more efficient.
        newGlyph.components = [
            { glyphIndex: origIdx, dx: 0, dy: 0, xScale: 1, yScale: 1, rotation: 0 },
            { glyphIndex: commaIndex, dx: origGlyph.advanceWidth, dy: 0, xScale: 1, yScale: 1, rotation: 0 }
        ];

        const newIdx = font.glyphs.length;
        font.glyphs.glyphs[newIdx] = newGlyph;
        font.glyphs.length++;

        groupLIndices.push(newIdx);
    });
    console.log('Created group_L glyphs:', groupLIndices);

    // 4. Construct GSUB
    if (!font.tables.gsub) {
        font.tables.gsub = {
            version: 1,
            scripts: [],
            features: [],
            lookups: []
        };
    }
    const gsub = font.tables.gsub;

    // Helper to add lookup
    function addLookup(lookup) {
        gsub.lookups.push(lookup);
        return gsub.lookups.length - 1;
    }

    // Lookup 0: CAPTURE (Type 1: Single Substitution)
    // sub @digits by @capture_L
    const lookupCaptureIdx = addLookup({
        lookupType: 1,
        lookupFlag: 0,
        subtables: [{
            substFormat: 2,
            coverage: { format: 1, glyphs: digitIndices },
            substitute: captureLIndices
        }]
    });

    // Lookup 1: GROUP_DIGITS (Type 8: Reverse Chaining Contextual Single Substitution)
    // rsub @capture_L @capture_L @capture_L' @capture_L @capture_L by @group_L
    const lookupGroupIdx = addLookup({
        lookupType: 8,
        lookupFlag: 0,
        subtables: [{
            substFormat: 1,
            coverage: { format: 1, glyphs: captureLIndices },
            backtrackCoverage: [
                { format: 1, glyphs: captureLIndices },
                { format: 1, glyphs: captureLIndices }
            ],
            lookaheadCoverage: [
                { format: 1, glyphs: captureLIndices },
                { format: 1, glyphs: captureLIndices }
            ],
            substitutes: groupLIndices
        }]
    });

    // Lookup 2: REFLOW (Type 1: Single Substitution)
    // sub @capture_L by @digits
    const lookupReflowIdx = addLookup({
        lookupType: 1,
        lookupFlag: 0,
        subtables: [{
            substFormat: 2,
            coverage: { format: 1, glyphs: captureLIndices },
            substitute: digitIndices
        }]
    });

    // Feature: calt and friends
    const featureTags = ['calt', 'dgcd', 'dgco', 'dgdd', 'dgdo', 'dgsp', 'dgun'];
    
    featureTags.forEach(tag => {
        let feat = gsub.features.find(f => f.tag === tag);
        if (!feat) {
            feat = {
                tag: tag,
                feature: { featureParams: 0, lookupListIndexes: [] }
            };
            gsub.features.push(feat);
        }
        feat.feature.lookupListIndexes = [lookupCaptureIdx, lookupGroupIdx, lookupReflowIdx];
    });

    console.log(`Configured features [${featureTags.join(', ')}] with lookups [${[lookupCaptureIdx, lookupGroupIdx, lookupReflowIdx].join(', ')}]`);

    // Ensure all scripts use these features
    const featureIndices = featureTags.map(tag => gsub.features.findIndex(f => f.tag === tag));

    if (gsub.scripts.length === 0) {
        // Add a default script if none exists
        gsub.scripts.push({
            tag: 'DFLT',
            script: {
                defaultLangSys: { reqFeatureIndex: 65535, featureIndices: featureIndices },
                langSysRecords: []
            }
        });
    } else {
        gsub.scripts.forEach(s => {
            const ls = s.script.defaultLangSys;
            if (ls) {
                if (!ls.featureIndices) ls.featureIndices = [];
                featureIndices.forEach(idx => {
                    if (!ls.featureIndices.includes(idx)) ls.featureIndices.push(idx);
                });
            }
            if (s.script.langSysRecords) {
                s.script.langSysRecords.forEach(r => {
                    if (!r.langSys.featureIndices) r.langSys.featureIndices = [];
                    featureIndices.forEach(idx => {
                        if (!r.langSys.featureIndices.includes(idx)) r.langSys.featureIndices.push(idx);
                    });
                });
            }
        });
    }

    // 5. Save
    console.log(`Saving to ${outPath}...`);
    // Workaround for potential opentype.js issues with manually added glyphs
    if (!font._push) font._push = function() {};

    const outBuffer = font.toArrayBuffer();
    fs.writeFileSync(outPath, Buffer.from(outBuffer));
    console.log('Done.');
}

main().catch(err => console.error(err));