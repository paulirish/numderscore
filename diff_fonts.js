const opentype = require('opentype.js');
const fs = require('fs');

const fontPathOrig = 'out/Times-New-Roman.ttf';
const fontPathPatched = process.argv[2] || 'out/Times-New-Roman-DG.ttf';

function loadFont(path) {
    const buffer = fs.readFileSync(path);
    return opentype.parse(buffer.buffer);
}

try {
    const fontOrig = loadFont(fontPathOrig);
    const fontPatched = loadFont(fontPathPatched);

    console.log(`Comparing fonts:\n  Orig:    ${fontPathOrig}\n  Patched: ${fontPathPatched}\n`);

    const g1 = fontOrig.tables.gsub;
    const g2 = fontPatched.tables.gsub;

    if (g2) {
        const f1Tags = (g1.features || []).map(f => f.tag);
        const f2Tags = (g2.features || []).map(f => f.tag);
        const newFeatures = f2Tags.filter(t => !f1Tags.includes(t));
        
        console.log('--- GSUB Features ---');
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
                            subId = origId + sub.deltaGlyphId;
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

    // Name table
    console.log('\n--- Name Table Changes ---');
    const n1 = fontOrig.names;
    const n2 = fontPatched.names;
    for (const key in n2) {
        const v1 = JSON.stringify(n1[key]);
        const v2 = JSON.stringify(n2[key]);
        if (v1 !== v2) {
            console.log(`${key}:`);
            console.log(`  Original: ${v1}`);
            console.log(`  Patched:  ${v2}`);
        }
    }

} catch (err) {
    console.log('Error:', err);
}
