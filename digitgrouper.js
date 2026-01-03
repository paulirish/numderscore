const fs = require('fs');
const path = require('path');

// --- Patch opentype.js to support GSUB Type 8 ---
// Since opentype.js does not support writing GSUB Type 8, we monkey-patch it.
// We load the module source, inject the patch, and eval/compile it.

let opentype;
try {
    const opentypePath = require.resolve('opentype.js');
    let opentypeSource = fs.readFileSync(opentypePath, 'utf8');

    if (!opentypeSource.includes('subtableMakers[8] = function')) {
        console.log('Patching opentype.js to support GSUB Type 8...');
        // We insert the Type 8 maker before makeGsubTable definition
        const anchor = 'function makeGsubTable(gsub) {';
        const patchCode = `
	subtableMakers[8] = function makeLookup8(subtable) {
	    check.assert(subtable.substFormat === 1, 'Lookup type 8 substFormat must be 1.');
        return new table.Table('reverseChainContextSingleSubstTable', [
            {name: 'substFormat', type: 'USHORT', value: 1},
            {name: 'coverage', type: 'TABLE', value: new table.Coverage(subtable.coverage)}
        ].concat(table.tableList('backtrackCoverage', subtable.backtrackCoverage, function(coverage) {
             return new table.Coverage(coverage);
        }))
        .concat(table.tableList('lookaheadCoverage', subtable.lookaheadCoverage, function(coverage) {
             return new table.Coverage(coverage);
        }))
        .concat(table.ushortList('substitute', subtable.substitutes)));
    };
`;
        if (opentypeSource.includes(anchor)) {
            opentypeSource = opentypeSource.replace(anchor, patchCode + '\n' + anchor);

            // We can overwrite the file or load from string.
            // Overwriting ensures subsequent requires work, but might be unsafe in some envs.
            // Loading from string is safer.
            const Module = require('module');
            const m = new Module(opentypePath, module.parent);
            m.filename = opentypePath;
            m.paths = Module._nodeModulePaths(path.dirname(opentypePath));
            m._compile(opentypeSource, opentypePath);
            opentype = m.exports;

        } else {
            console.warn('Could not find injection point in opentype.js. Type 8 lookup writing might fail.');
            opentype = require('opentype.js');
        }
    } else {
        opentype = require('opentype.js');
    }
} catch (e) {
    console.warn('Failed to patch opentype.js:', e);
    try {
        opentype = require('opentype.js');
    } catch (e2) {
        console.error('Could not load opentype.js. Make sure it is installed.');
        process.exit(1);
    }
}

const fontPath = 'out/Times-New-Roman.ttf';
const outPath = 'out/Times-New-Roman-JS.ttf';

async function main() {
    console.log(`Loading ${fontPath}...`);
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
        newPath.commands = JSON.parse(JSON.stringify(origGlyph.path.commands));
        newPath.fill = origGlyph.path.fill;
        newPath.stroke = origGlyph.path.stroke;
        newPath.strokeWidth = origGlyph.path.strokeWidth;

        const newGlyph = new opentype.Glyph({
            name: `capture_L_d${d}`,
            unicode: -1,
            advanceWidth: origGlyph.advanceWidth,
            path: newPath
        });

        // Add to glyph set directly
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
            unicode: -1,
            advanceWidth: origGlyph.advanceWidth + commaGlyph.advanceWidth
        });

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

    // Lookup: CAPTURE (Type 1: Single Substitution)
    // sub @digits by @capture_L
    const lookupCaptureIdx = addLookup({
        lookupType: 1,
        lookupFlag: 0,
        subtables: [{
            substFormat: 2, // Format 2: Coverage + GlyphIDs
            coverage: {
                format: 1,
                glyphs: digitIndices
            },
            substitute: captureLIndices
        }]
    });

    // Lookup: GROUP_DIGITS (Type 8: Reverse Chaining Contextual Single Substitution)
    // rsub @capture_L @capture_L @capture_L' @capture_L @capture_L by @group_L
    // Backtrack (Right): capture_L, capture_L
    // Lookahead (Left): capture_L, capture_L
    const lookupGroupIdx = addLookup({
        lookupType: 8,
        lookupFlag: 0,
        subtables: [{
            substFormat: 1,
            coverage: {
                format: 1,
                glyphs: captureLIndices
            },
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

    // Feature: calt
    const featureCalt = {
        tag: 'calt',
        feature: {
            featureParams: 0,
            lookupListIndexes: [lookupCaptureIdx, lookupGroupIdx]
        }
    };

    const featureCaltIdx = gsub.features.length;
    gsub.features.push(featureCalt);

    console.log(`Added calt feature (idx ${featureCaltIdx}) pointing to lookups [${lookupCaptureIdx}, ${lookupGroupIdx}]`);

    // Add feature to all scripts
    if (gsub.scripts) {
        gsub.scripts.forEach(script => {
            const scriptTable = script.script;
            if (scriptTable) {
                // Ensure featureIndices exist
                if (scriptTable.defaultLangSys) {
                     if (!scriptTable.defaultLangSys.featureIndices) {
                         scriptTable.defaultLangSys.featureIndices = [];
                     }
                    scriptTable.defaultLangSys.featureIndices.push(featureCaltIdx);
                }
                if (scriptTable.langSysRecords) {
                    scriptTable.langSysRecords.forEach(l => {
                        if (!l.langSys.featureIndices) {
                            l.langSys.featureIndices = [];
                        }
                        l.langSys.featureIndices.push(featureCaltIdx);
                    });
                }
            }
        });
    }

    // 5. Save
    console.log(`Saving to ${outPath}...`);
    // Ensure _push dummy exists to avoid potential internal errors if any
    if (!font._push) {
        font._push = function() {};
    }

    const outBuffer = font.toArrayBuffer();
    fs.writeFileSync(outPath, Buffer.from(outBuffer));
    console.log('Done.');
}

main().catch(err => console.error(err));
