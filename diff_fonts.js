const opentype = require('opentype.js');
const fs = require('fs');

const fontPathOrig = 'out/Times-New-Roman.ttf';
const fontPathPatched = 'out/Times-New-Roman-DG.ttf';

function loadFont(path) {
    const buffer = fs.readFileSync(path);
    return opentype.parse(buffer.buffer);
}

function compareObjects(obj1, obj2, path = '') {
    const keys1 = Object.keys(obj1 || {});
    const keys2 = Object.keys(obj2 || {});
    const allKeys = new Set([...keys1, ...keys2]);

    for (const key of allKeys) {
        const currentPath = path ? `${path}.${key}` : key;
        const val1 = obj1 ? obj1[key] : undefined;
        const val2 = obj2 ? obj2[key] : undefined;

        if (typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null) {
            compareObjects(val1, val2, currentPath);
        } else if (val1 !== val2) {
            console.log(`Difference at ${currentPath}:`);
            console.log(`  Original: ${JSON.stringify(val1)}`);
            console.log(`  Patched:  ${JSON.stringify(val2)}`);
        }
    }
}

try {
    const fontOrig = loadFont(fontPathOrig);
    const fontPatched = loadFont(fontPathPatched);

    console.log(`Comparing tables for:\n  ${fontPathOrig}\n  ${fontPathPatched}\n`);

    const tableKeysOrig = Object.keys(fontOrig.tables);
    const tableKeysPatched = Object.keys(fontPatched.tables);

    const addedTables = tableKeysPatched.filter(k => !tableKeysOrig.includes(k));
    const removedTables = tableKeysOrig.filter(k => !tableKeysPatched.includes(k));
    const commonTables = tableKeysOrig.filter(k => tableKeysPatched.includes(k));

    if (addedTables.length) console.log('Added tables:', addedTables);
    if (removedTables.length) console.log('Removed tables:', removedTables);

    for (const tableName of commonTables) {
        const t1 = fontOrig.tables[tableName];
        const t2 = fontPatched.tables[tableName];

        // Skip binary data or large blobs if they are too noisy, 
        // but for now let's just see what we get.
        // opentype.js often parses these into nice objects.
        
        // We might want to specially handle GSUB as that's where the magic is
        if (tableName === 'gsub') {
            console.log('\n--- GSUB Table Differences ---');
            // GSUB can be very deep, let's look at features
            const f1 = t1.features || [];
            const f2 = t2.features || [];
            
            const f1Tags = f1.map(f => f.tag);
            const f2Tags = f2.map(f => f.tag);
            
            const addedFeatures = f2Tags.filter(t => !f1Tags.includes(t));
            console.log('Added GSUB features:', addedFeatures);
            
            // Log details of added features
            addedFeatures.forEach(tag => {
                const feature = f2.find(f => f.tag === tag);
                console.log(`Feature ${tag}:`, JSON.stringify(feature, null, 2));
            });
        } else if (tableName === 'name') {
            // Check for name changes (family name, etc.)
            const n1 = t1;
            const n2 = t2;
            // opentype.js parses 'name' table into an object where keys are often language IDs or property names
            // but it depends on the version. Let's just compare them.
        }
    }

} catch (err) {
    console.error('Error comparing fonts:', err);
}
