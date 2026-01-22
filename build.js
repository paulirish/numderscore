const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['lib/digitgrouper-core.js'],
  bundle: true,
  outfile: 'dist/digitgrouper.browser.js',
  format: 'iife',
  globalName: 'DigitGrouper',
  platform: 'browser',
  minify: true,
  sourcemap: true,
  external: ['fs'], // Ignore 'fs' as we patched it or it's conditional
}).then(() => {
    console.log('Build complete: dist/digitgrouper.browser.js');
}).catch(() => process.exit(1));
