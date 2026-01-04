const opentype = require('opentype.js');
const fs = require('fs');

const fontPathOrig = 'out/Times-New-Roman-orig.ttf';
const fontPathPatched = process.argv[2] || 'out/Times-New-Roman-DG.ttf';

function loadFont(path) {
    if (!fs.existsSync(path)) {
        console.error(`File not found: ${path}`);
        process.exit(1);
    }
    const buffer = fs.readFileSync(path);
    return opentype.parse(buffer.buffer);
}

const NAME_IDS = {
    0: 'copyright',
    1: 'fontFamily',
    2: 'fontSubfamily',
    3: 'uniqueID',
    4: 'fullName',
    5: 'version',
    6: 'postScriptName',
    7: 'trademark',
    8: 'manufacturer',
    9: 'designer',
    10: 'description',
    11: 'urlVendor',
    12: 'urlDesigner',
    13: 'licenseDescription',
    14: 'licenseInfoURL',
    16: 'preferredFamily',
    17: 'preferredSubfamily',
    18: 'compatibleFull',
    19: 'sampleText',
    20: 'postScriptCIDFindfontName',
    21: 'wwsFamilyName',
    22: 'wwsSubfamilyName',
    23: 'lightBackgroundPalette',
    24: 'darkBackgroundPalette',
    25: 'variationsPostScriptNamePrefix'
};

function getGlyphName(font, id) {
    if (id < 0 || id >= font.glyphs.length) return `ID:${id}(OUT_OF_BOUNDS)`;
    const glyph = font.glyphs.get(id);
    if (glyph && glyph.name) return glyph.name;
    return `ID:${id}`;
}

function getGlyphNames(font, coverage) {
    if (!coverage) return 'none';
    let ids = [];
    if (coverage.glyphs) ids = coverage.glyphs;
    else if (coverage.ranges) {
        coverage.ranges.forEach(r => {
            for (let id = r.start; id <= r.end; id++) ids.push(id);
        });
    } else if (Array.isArray(coverage)) ids = coverage;
    
    if (ids.length === 0) return '[]';

    const names = ids.slice(0, 8).map(id => getGlyphName(font, id));
    return `[${names.join(', ')}${ids.length > 8 ? '...' : ''}]`;
}

function printLookup(font, lookup, index) {
    console.log(`\nLookup ${index} (Type ${lookup.lookupType}):`);
    
    lookup.subtables.forEach((sub, subIdx) => {
        if (lookup.lookupType === 5 || lookup.lookupType === 6) {
            const backtrack = sub.backtrackCoverage || sub.backtrackCoverages || [];
            const input = sub.inputCoverage || sub.coverages || [];
            const lookahead = sub.lookaheadCoverage || sub.lookaheadCoverages || [];
            const records = sub.lookupRecords || [];

            if (sub.substFormat === 3) {
                if (backtrack.length) console.log(`    Backtrack: ${backtrack.map(c => getGlyphNames(font, c)).join(' | ')}`);
                console.log(`    Input:     ${input.map(c => getGlyphNames(font, c)).join(' | ')}`);
                if (lookahead.length) console.log(`    Lookahead: ${lookahead.map(c => getGlyphNames(font, c)).join(' | ')}`);
                
                records.forEach(r => {
                    console.log(`      @ index ${r.sequenceIndex}: apply Lookup ${r.lookupListIndex}`);
                });
            } else if (sub.substFormat === 1 || sub.substFormat === 2) {
                console.log(`    (Contextual Subtable Format ${sub.substFormat})`);
                if (sub.coverage) console.log(`    Coverage: ${getGlyphNames(font, sub.coverage)}`);
                if (records.length) {
                    records.forEach(r => {
                        console.log(`      @ index ${r.sequenceIndex}: apply Lookup ${r.lookupListIndex}`);
                    });
                }
            }
        } else if (lookup.lookupType === 1) {
            let coverage = [];
            if (sub.coverage) {
                if (sub.coverage.glyphs) coverage = sub.coverage.glyphs;
                else if (sub.coverage.ranges) {
                    sub.coverage.ranges.forEach(r => {
                        for (let id = r.start; id <= r.end; id++) coverage.push(id);
                    });
                }
            }
            if (coverage.length > 0) {
                const firstId = coverage[0];
                const firstSubId = sub.substFormat === 1 ? firstId + (sub.deltaGlyphId || 0) : (sub.substitute ? sub.substitute[0] : firstId);
                console.log(`  Single Sub: [${getGlyphName(font, firstId)}...] -> [${getGlyphName(font, firstSubId)}...] (${coverage.length} glyphs)`);
                for (let g = 0; g < Math.min(coverage.length, 5); g++) {
                    const id = coverage[g];
                    const sid = sub.substFormat === 1 ? id + (sub.deltaGlyphId || 0) : (sub.substitute ? sub.substitute[g] : id);
                    console.log(`    ${getGlyphName(font, id)} -> ${getGlyphName(font, sid)}`);
                }
                if (coverage.length > 5) console.log('    ...');
            }
        } else if (lookup.lookupType === 8) {
             console.log(`    (Reverse Chain Contextual Substitution)`);
             const backtrack = sub.backtrackCoverage || sub.backtrackCoverages || [];
             const lookahead = sub.lookaheadCoverage || sub.lookaheadCoverages || [];
             const input = sub.coverage;
             const substitutes = sub.substitute || sub.substitutes || [];

             if (backtrack.length) console.log(`    Backtrack: ${backtrack.map(c => getGlyphNames(font, c)).join(' | ')}`);
             console.log(`    Input:     ${getGlyphNames(font, input)}`);
             if (lookahead.length) console.log(`    Lookahead: ${lookahead.map(c => getGlyphNames(font, c)).join(' | ')}`);
             if (substitutes.length > 0) {
                 console.log(`    Substitutes: ${substitutes.slice(0, 5).map(id => getGlyphName(font, id)).join(', ')}${substitutes.length > 5 ? '...' : ''}`);
             }
        } else {
            console.log(`    (Lookup Type ${lookup.lookupType} not fully detailed)`);
        }
    });
}

try {
    const fontOrig = loadFont(fontPathOrig);
    const fontPatched = loadFont(fontPathPatched);

    console.log(`Comparing fonts:\n  Orig:    ${fontPathOrig}\n  Patched: ${fontPathPatched}\n`);

    const g1 = fontOrig.tables.gsub || { features: [], lookups: [] };
    const g2 = fontPatched.tables.gsub || { features: [], lookups: [] };

    const f1Tags = (g1.features || []).map(f => f.tag);
    const f2Tags = (g2.features || []).map(f => f.tag);
    
    console.log('--- GSUB Features ---');
    console.log('Original features:', f1Tags.join(', ') || '(none)');
    
    const caltInOrig = f1Tags.includes('calt');
    console.log(`Original has 'calt' feature: ${caltInOrig}`);

    const newFeatures = f2Tags.filter(t => !f1Tags.includes(t));
    console.log('Added Features:', newFeatures.join(', '));

    const l1 = g1.lookups || [];
    const l2 = g2.lookups || [];
    
    console.log(`\n--- Lookups associated with added features in Patched Font ---`);
    
    const addedFeatures = g2.features.filter(f => newFeatures.includes(f.tag));
    const addedLookupIndices = new Set();
    addedFeatures.forEach(f => {
        if (f.feature && f.feature.lookupListIndexes) {
            f.feature.lookupListIndexes.forEach(idx => {
                addedLookupIndices.add(idx);
                // Also follow dependencies
                const follow = (i) => {
                    const l = l2[i];
                    if (!l) return;
                    l.subtables.forEach(s => {
                        if (s.lookupRecords) {
                            s.lookupRecords.forEach(r => {
                                if (!addedLookupIndices.has(r.lookupListIndex)) {
                                    addedLookupIndices.add(r.lookupListIndex);
                                    follow(r.lookupListIndex);
                                }
                            });
                        }
                    });
                };
                follow(idx);
            });
        }
    });

    if (addedLookupIndices.size > 0) {
        [...addedLookupIndices].sort((a,b) => a-b).forEach(idx => {
            if (l2[idx]) printLookup(fontPatched, l2[idx], idx);
        });
    } else {
        console.log('No lookups found for added features. Showing all lookups in patched font instead:');
        l2.forEach((l, idx) => printLookup(fontPatched, l, idx));
    }

    // Name table comparison
    console.log('\n--- Name Table Changes ---');
    const nt1 = fontOrig.tables.name;
    const nt2 = fontPatched.tables.name;

    if (nt1 && nt2) {
        const records1 = nt1.records || [];
        const records2 = nt2.records || [];

        function recordToKey(r) {
            return `${r.platformID}-${r.encodingID}-${r.languageID}-${r.nameID}`;
        }

        const map1 = new Map();
        records1.forEach(r => map1.set(recordToKey(r), r));
        
        const map2 = new Map();
        records2.forEach(r => map2.set(recordToKey(r), r));

        const allKeys = new Set([...map1.keys(), ...map2.keys()]);
        let changes = 0;

        for (const key of allKeys) {
            const r1 = map1.get(key);
            const r2 = map2.get(key);

            const v1 = r1 ? nt1.decodeString(r1.string, r1.platformID, r1.encodingID, r1.languageID) : undefined;
            const v2 = r2 ? nt2.decodeString(r2.string, r2.platformID, r2.encodingID, r2.languageID) : undefined;

            if (v1 !== v2) {
                changes++;
                const [plat, enc, lang, nameID] = key.split('-');
                const nameLabel = NAME_IDS[nameID] || nameID;
                
                console.log(`Record [Plat:${plat} Enc:${enc} Lang:${lang} NameID:${nameID} (${nameLabel})]`);
                if (v1 === undefined) console.log(`  Added: "${v2}"`);
                else if (v2 === undefined) console.log(`  Removed: "${v1}"`);
                else {
                    console.log(`  Original: "${v1}"`);
                    console.log(`  Patched:  "${v2}"`);
                }
            }
        }
        if (changes === 0) console.log('No changes detected in name table records.');
    } else {
        console.log('Could not retrieve name tables.');
    }

    // HMTX comparison
    console.log('\n--- Advance Widths ---');
    console.log(`Orig glyphs: ${fontOrig.glyphs.length}, Patched glyphs: ${fontPatched.glyphs.length}`);
    const addedGlyphs = [];
    for (let i = fontOrig.glyphs.length; i < fontPatched.glyphs.length; i++) {
        addedGlyphs.push(i);
    }
    if (addedGlyphs.length > 0) {
        console.log(`Widths of added glyphs (first 20):`);
        addedGlyphs.slice(0, 20).forEach(id => {
            const glyph = fontPatched.glyphs.get(id);
            console.log(`  ${getGlyphName(fontPatched, id)}: ${glyph ? glyph.advanceWidth : 'N/A'}`);
        });
    }

} catch (err) {
    console.log('Error:', err);
    console.error(err.stack);
}