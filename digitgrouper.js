const fs = require('fs');
// Using vendored opentype.js with Type 8 support patched in
const opentype = require('./lib/opentype-patched.js');

const fontPath = 'out/Times-New-Roman.ttf';
const outPath = 'out/Times-New-Roman-JS.ttf';

async function main() {
    console.log(`Loading ${fontPath}...`);
    if (!fs.existsSync(fontPath)) {
        console.error(`File not found: ${fontPath}`);
        return;
    }
    const buffer = fs.readFileSync(fontPath);
    const font = opentype.parse(buffer.buffer);

    const digits = '0123456789'.split('');
    const digitIndices = digits.map(d => font.charToGlyphIndex(d));
    const commaIndex = font.charToGlyphIndex(',');
    const commaGlyph = font.glyphs.get(commaIndex);

    function createFlattenedGlyph(name, origIdx, widthAdd = 0, hasComma = false) {
        const origGlyph = font.glyphs.get(origIdx);

        // Start with a clone of the original path
        const newPath = new opentype.Path();
        if (origGlyph.path && origGlyph.path.commands) {
            newPath.commands = JSON.parse(JSON.stringify(origGlyph.path.commands));
        }

        if (hasComma && commaGlyph.path && commaGlyph.path.commands) {
            // Offset the comma path to the right of the digit
            const dx = origGlyph.advanceWidth;
            const dy = 0;
            const commaCommands = JSON.parse(JSON.stringify(commaGlyph.path.commands));
            commaCommands.forEach(cmd => {
                if ('x' in cmd) cmd.x += dx;
                if ('y' in cmd) cmd.y += dy;
                if ('x1' in cmd) cmd.x1 += dx;
                if ('y1' in cmd) cmd.y1 += dy;
                if ('x2' in cmd) cmd.x2 += dx;
                if ('y2' in cmd) cmd.y2 += dy;
            });
            newPath.commands.push(...commaCommands);
        }

        const newGlyph = new opentype.Glyph({
            name: name,
            advanceWidth: origGlyph.advanceWidth + widthAdd,
            path: newPath,
            unicode: undefined
        });

        const idx = font.glyphs.length;
        font.glyphs.glyphs[idx] = newGlyph;
        font.glyphs.length++;
        return idx;
    }

    const captureLIndices = digits.map(d => createFlattenedGlyph(`capture_L_d${d}`, font.charToGlyphIndex(d)));
    // Use a larger width addition (2x comma width) to ensure gap detection works in test.html
    const groupLIndices = digits.map(d => createFlattenedGlyph(`group_L_d${d}`, font.charToGlyphIndex(d), commaGlyph.advanceWidth * 2, true));

    // For propagation
    const phase1LIndices = digits.map(d => createFlattenedGlyph(`phase1_L_d${d}`, font.charToGlyphIndex(d)));
    const phase2LIndices = digits.map(d => createFlattenedGlyph(`phase2_L_d${d}`, font.charToGlyphIndex(d)));

    if (!font.tables.gsub) {
        font.tables.gsub = { version: 1, scripts: [], features: [], lookups: [] };
    }
    const gsub = font.tables.gsub;

    function addLookup(lookup) {
        gsub.lookups.push(lookup);
        return gsub.lookups.length - 1;
    }

    // Lookup 0: CAPTURE
    const lookupCaptureIdx = addLookup({
        lookupType: 1, lookupFlag: 0,
        subtables: [{ substFormat: 2, coverage: { format: 1, glyphs: digitIndices }, substitute: captureLIndices }]
    });

    // Lookup 1: GROUP_DIGITS (Type 8)
    // Relaxed constraints to allow recursive grouping
    const allGlyphs = [...captureLIndices, ...groupLIndices];
    const lookupGroupIdx = addLookup({
        lookupType: 8, lookupFlag: 0,
        subtables: [{
            substFormat: 1,
            coverage: { format: 1, glyphs: captureLIndices },
            backtrackCoverage: [
                { format: 1, glyphs: captureLIndices },
                { format: 1, glyphs: captureLIndices }
            ],
            lookaheadCoverage: [
                { format: 1, glyphs: allGlyphs }, // Allow group glyphs in lookahead for chaining
                { format: 1, glyphs: allGlyphs },
                { format: 1, glyphs: allGlyphs }
            ],
            substitutes: groupLIndices
        }]
    });

    // Lookup: Phase Subs
    const lookupPhase1Idx = addLookup({
        lookupType: 1, lookupFlag: 0,
        subtables: [{ substFormat: 2, coverage: { format: 1, glyphs: captureLIndices }, substitute: phase1LIndices }]
    });
    const lookupPhase2Idx = addLookup({
        lookupType: 1, lookupFlag: 0,
        subtables: [{ substFormat: 2, coverage: { format: 1, glyphs: captureLIndices }, substitute: phase2LIndices }]
    });
    const lookupPhase3Idx = addLookup({
        lookupType: 1, lookupFlag: 0,
        subtables: [{ substFormat: 2, coverage: { format: 1, glyphs: captureLIndices }, substitute: groupLIndices }]
    });

    // Lookup: REFLOW (Type 6 Format 3)
    const lookupReflowIdx = addLookup({
        lookupType: 6, lookupFlag: 0,
        subtables: [
            {
                substFormat: 3,
                backtrackCoverage: [{ format: 1, glyphs: groupLIndices }],
                inputCoverage: [{ format: 1, glyphs: captureLIndices }],
                lookaheadCoverage: [],
                lookupRecords: [{ sequenceIndex: 0, lookupListIndex: lookupPhase1Idx }]
            },
            {
                substFormat: 3,
                backtrackCoverage: [{ format: 1, glyphs: phase1LIndices }],
                inputCoverage: [{ format: 1, glyphs: captureLIndices }],
                lookaheadCoverage: [],
                lookupRecords: [{ sequenceIndex: 0, lookupListIndex: lookupPhase2Idx }]
            },
            {
                substFormat: 3,
                backtrackCoverage: [{ format: 1, glyphs: phase2LIndices }],
                inputCoverage: [{ format: 1, glyphs: captureLIndices }],
                lookaheadCoverage: [{ format: 1, glyphs: captureLIndices }], // Ensure followed by digit to prevent trailing comma
                lookupRecords: [{ sequenceIndex: 0, lookupListIndex: lookupPhase3Idx }]
            }
        ]
    });

    // Lookup: FINAL
    const lookupFinalIdx = addLookup({
        lookupType: 1, lookupFlag: 0,
        subtables: [
            { substFormat: 2, coverage: { format: 1, glyphs: captureLIndices }, substitute: digitIndices },
            { substFormat: 2, coverage: { format: 1, glyphs: phase1LIndices }, substitute: digitIndices },
            { substFormat: 2, coverage: { format: 1, glyphs: phase2LIndices }, substitute: digitIndices }
        ]
    });

    const featureTags = ['calt', 'dgcd', 'dgco', 'dgdd', 'dgdo', 'dgsp', 'dgun'];
    const lookupsForFeatures = [lookupCaptureIdx, lookupGroupIdx, lookupReflowIdx, lookupFinalIdx];

    featureTags.forEach(tag => {
        let feat = gsub.features.find(f => f.tag === tag);
        if (!feat) {
            feat = { tag: tag, feature: { featureParams: 0, lookupListIndexes: [] } };
            gsub.features.push(feat);
        }
        feat.feature.lookupListIndexes = lookupsForFeatures;
    });

    const featureIndices = featureTags.map(tag => gsub.features.findIndex(f => f.tag === tag));

    gsub.scripts.forEach(s => {
        const ls = s.script.defaultLangSys;
        if (ls) {
            if (!ls.featureIndices) ls.featureIndices = [];
            featureIndices.forEach(idx => {
                if (!ls.featureIndices.includes(idx)) {
                    ls.featureIndices.push(idx);
                }
            });
            ls.featureIndexes = ls.featureIndices;
        }
        if (s.script.langSysRecords) {
            s.script.langSysRecords.forEach(r => {
                if (!r.langSys.featureIndices) r.langSys.featureIndices = [];
                featureIndices.forEach(idx => {
                    if (!r.langSys.featureIndices.includes(idx)) {
                        r.langSys.featureIndices.push(idx);
                    }
                });
                r.langSys.featureIndexes = r.langSys.featureIndices;
            });
        }
    });

    console.log(`Saving to ${outPath}...`);
    if (!font._push) font._push = function() {};
    const outBuffer = font.toArrayBuffer();
    fs.writeFileSync(outPath, Buffer.from(outBuffer));
    console.log('Done.');
}

main().catch(err => console.error(err));
