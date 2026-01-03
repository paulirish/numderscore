const opentype = require('opentype.js');
const fs = require('fs');

const fontPathOrig = 'out/Times-New-Roman.ttf';
const fontPathPatched = 'out/Times-New-Roman-DG.ttf';

function loadFont(path) {
    const buffer = fs.readFileSync(path);
    return opentype.parse(buffer.buffer);
}

try {
    const fontOrig = loadFont(fontPathOrig);
    const fontPatched = loadFont(fontPathPatched);

    const g2 = fontPatched.tables.gsub;
    const g1 = fontOrig.tables.gsub;

    if (g2) {
        const l1Count = (g1.lookups || []).length;
        const l2 = g2.lookups || [];
        
        console.log(`--- New Lookups ---`);
        
        for (let i = l1Count; i < l2.length; i++) {
            const lookup = l2[i];
            console.log(`
Lookup ${i} (Type ${lookup.lookupType}):`);
            
            lookup.subtables.forEach((sub, subIdx) => {
                if (lookup.lookupType === 5 || lookup.lookupType === 6) {
                    const getGlyphNames = (coverage) => {
                        if (!coverage) return 'none';
                        let ids = [];
                        if (coverage.glyphs) ids = coverage.glyphs;
                        else if (coverage.ranges) {
                            coverage.ranges.forEach(r => {
                                for (let id = r.start; id <= r.end; id++) ids.push(id);
                            });
                        } else if (Array.isArray(coverage)) ids = coverage;
                        
                        const names = ids.slice(0, 5).map(id => fontPatched.glyphs.get(id).name);
                        return `[${names.join(', ')}${ids.length > 5 ? '...' : ''}]`;
                    };

                    if (sub.substFormat === 3) {
                        const backtrack = sub.backtrackCoverages || [];
                        const input = sub.coverages || [];
                        const lookahead = sub.lookaheadCoverages || [];
                        const records = sub.lookupRecords || [];

                        if (backtrack.length) console.log(`    Backtrack: ${backtrack.map(getGlyphNames).join(' | ')}`);
                        console.log(`    Input:     ${input.map(getGlyphNames).join(' | ')}`);
                        if (lookahead.length) console.log(`    Lookahead: ${lookahead.map(getGlyphNames).join(' | ')}`);
                        
                        records.forEach(r => {
                            console.log(`      @ index ${r.sequenceIndex}: apply Lookup ${r.lookupListIndex}`);
                        });
                    } else {
                        console.log(`    (Contextual Subtable Format ${sub.substFormat})`);
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
                    const firstId = coverage[0];
                    const firstSubId = sub.substFormat === 1 ? firstId + (sub.deltaGlyphId || 0) : sub.substitute[0];
                    console.log(`  Single Sub: [${fontPatched.glyphs.get(firstId).name}...] -> [${fontPatched.glyphs.get(firstSubId).name}...] (${coverage.length} glyphs)`);
                }
            });
        }
    }
} catch (err) {
    console.log('Error:', err);
}
