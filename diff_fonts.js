const opentype = require('opentype.js');
const fs = require('fs');

const fontPathOrig = 'out/Times-New-Roman.ttf';
const fontPathPatched = process.argv[2] || 'out/Times-New-Roman-DG.ttf';

function loadFont(path) {
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

try {
    const fontOrig = loadFont(fontPathOrig);
    const fontPatched = loadFont(fontPathPatched);

    console.log(`Comparing fonts:\n  Orig:    ${fontPathOrig}\n  Patched: ${fontPathPatched}\n`);

    const g1 = fontOrig.tables.gsub;
    const g2 = fontPatched.tables.gsub;

    if (g2) {
        const f1Tags = (g1.features || []).map(f => f.tag);
        const f2Tags = (g2.features || []).map(f => f.tag);
        
        console.log('--- GSUB Features ---');
        console.log('Original features:', f1Tags.join(', ') || '(none)');
        
        const caltInOrig = f1Tags.includes('calt');
        console.log(`Original has 'calt' feature: ${caltInOrig}`);

        const newFeatures = f2Tags.filter(t => !f1Tags.includes(t));
        console.log('Added Features:', newFeatures.join(', '));

        const l1Count = (g1.lookups || []).length;
        const l2 = g2.lookups || [];
        
        console.log(`\n--- Lookups (Original: ${l1Count}, Patched: ${l2.length}) ---`);
        
        for (let i = l1Count; i < l2.length; i++) {
            const lookup = l2[i];
            console.log(`\nLookup ${i} (Type ${lookup.lookupType}):`);
            
            lookup.subtables.forEach((sub, subIdx) => {
                let coverage = [];
                if (sub.coverage) {
                    if (sub.coverage.glyphs) {
                        coverage = sub.coverage.glyphs;
                    } else if (sub.coverage.ranges) {
                        sub.coverage.ranges.forEach(r => {
                            for (let id = r.start; id <= r.end; id++) coverage.push(id);
                        });
                    } else if (Array.isArray(sub.coverage)) {
                        coverage = sub.coverage;
                    }
                }

                if (lookup.lookupType === 1) { // Single Substitution
                    for (let g = 0; g < Math.min(coverage.length, 10); g++) {
                        const origId = coverage[g];
                        let subId;
                        if (sub.substFormat === 1) {
                            subId = origId + (sub.deltaGlyphId || 0);
                        } else {
                            subId = sub.substitute[g];
                        }
                        const origGlyph = fontPatched.glyphs.get(origId);
                        const subGlyph = fontPatched.glyphs.get(subId);
                        console.log(`  ${origGlyph ? origGlyph.name : origId} -> ${subGlyph ? subGlyph.name : subId}`);
                    }
                    if (coverage.length > 10) console.log(`  ... and ${coverage.length - 10} more`);
                } else if (lookup.lookupType === 5) { // Contextual Substitution
                    console.log(`  Contextual subtable (Format ${sub.substFormat})`);
                }
            });
        }
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

} catch (err) {
    console.log('Error:', err);
}
