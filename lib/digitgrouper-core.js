const opentype = require('./opentype-patched.js');

function processFont(arrayBuffer) {
    const font = opentype.parse(arrayBuffer);

    const digits = '0123456789'.split('');
    const digitIndices = digits.map(d => font.charToGlyphIndex(d));

    // Get metrics for underscore positioning
    const xIndex = font.charToGlyphIndex('x');
    const xGlyph = font.glyphs.get(xIndex);
    const xBox = xGlyph.getBoundingBox();
    const height_of_x = xBox.y2 - xBox.y1;

    const underscoreIndex = font.charToGlyphIndex('_');
    const underscoreGlyph = font.glyphs.get(underscoreIndex);
    const underscoreBox = underscoreGlyph.getBoundingBox();
    const underscore_ymax = underscoreBox.y2;
    const separator_width = underscoreGlyph.advanceWidth;

    const commaIndex = font.charToGlyphIndex(',');
    const commaGlyph = font.glyphs.get(commaIndex);
    // patcher.py uses comma width as the default gap size for non-monospace fonts
    const gap_size = commaGlyph.advanceWidth;


    function createFlattenedGlyph(name, origIdx, widthAdd = 0, hasUnderscore = false) {
        const origGlyph = font.glyphs.get(origIdx);

        // Start with a clone of the original path
        const newPath = new opentype.Path();

        // If we are grouping, we shift the digit to the right by the gap size (widthAdd)
        // to make room for the underscore on the left.
        const digitShiftX = hasUnderscore ? widthAdd : 0;

        if (origGlyph.path && origGlyph.path.commands) {
            const digitCommands = JSON.parse(JSON.stringify(origGlyph.path.commands));
            if (digitShiftX !== 0) {
                digitCommands.forEach(cmd => {
                    if ('x' in cmd) cmd.x += digitShiftX;
                    if ('y' in cmd) cmd.y += 0;
                    if ('x1' in cmd) cmd.x1 += digitShiftX;
                    if ('y1' in cmd) cmd.y1 += 0;
                    if ('x2' in cmd) cmd.x2 += digitShiftX;
                    if ('y2' in cmd) cmd.y2 += 0;
                });
            }
            newPath.commands = digitCommands;
        }

        if (hasUnderscore && underscoreGlyph.path && underscoreGlyph.path.commands) {
            // Implement patcher.py logic for underscore positioning
            // x_shift = (abs(gap_size) - separator_width) // 2
            let x_shift = (widthAdd - separator_width) / 2;

            // y_shift = -(height_of_x / 10) - underscore_ymax
            const y_shift = -(height_of_x / 10) - underscore_ymax;

            // x_scale = 0.75
            const x_scale = 0.75;

            // x_shift += (separator_width * x_scale) * x_scale / 4
            x_shift += (separator_width * x_scale) * x_scale / 4;

            const underscoreCommands = JSON.parse(JSON.stringify(underscoreGlyph.path.commands));
            underscoreCommands.forEach(cmd => {
                // Apply scaling
                if ('x' in cmd) cmd.x = cmd.x * x_scale;
                if ('x1' in cmd) cmd.x1 = cmd.x1 * x_scale;
                if ('x2' in cmd) cmd.x2 = cmd.x2 * x_scale;

                // Apply translation
                if ('x' in cmd) cmd.x += x_shift;
                if ('y' in cmd) cmd.y += y_shift;

                if ('x1' in cmd) cmd.x1 += x_shift;
                if ('y1' in cmd) cmd.y1 += y_shift;

                if ('x2' in cmd) cmd.x2 += x_shift;
                if ('y2' in cmd) cmd.y2 += y_shift;
            });
            newPath.commands.push(...underscoreCommands);
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

    const groupLIndices = digits.map(d => createFlattenedGlyph(`group_L_d${d}`, font.charToGlyphIndex(d), gap_size, true));

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
    // Matches patcher.py logic: Backtrack 2, Input 1, Lookahead 2.
    // Lookahead only sees digits (captureLIndices) to avoid recursive grouping.
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
                { format: 1, glyphs: captureLIndices },
                { format: 1, glyphs: captureLIndices }
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
                lookaheadCoverage: [{ format: 1, glyphs: captureLIndices }],
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

    if (!font._push) font._push = function() {};
    return font.toArrayBuffer();
}

function generateFontFace(fontFamily, fontUrl, fontWeight = 400) {
  return `@font-face {
  font-family: '${fontFamily}';
  font-weight: ${fontWeight};
  src: url('${fontUrl}');
}`;
}

module.exports = {
    processFont,
    generateFontFace
};
