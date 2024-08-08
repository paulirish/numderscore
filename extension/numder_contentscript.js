'use strict';


// The manifest could add this CSS declaratively, but it puts it in the head and we want it later, for overriding
injectStyles( chrome.runtime.getURL('numder_style.css'), 'body');


// `monospace` can't be replaced with @font-face rules, so we change those rules to point to 'Roboto Mono' 
//  Note: Roboto Mono is definitely different than the system monospace font.
function replaceMonospaceFont() {
  for (const styleSheet of document.styleSheets) {

    if (styleSheet?.href.includes('numder_style.css')) continue;

    try {
      for (const rule of styleSheet.cssRules) {

        // https://drafts.csswg.org/css-fonts-4/#generic-font-families can't have quotes around them. But the matching is case insensitive.
        if (rule.style?.fontFamily) {
          // Exclude anything with a quote, so we're mostly with just generic families.
          const families = rule.style?.fontFamily.split(',');
          const monospaceIndex = families.findIndex(f => f.toLowerCase().trim() === 'monospace');
          if (monospaceIndex >= 0) {
            // We found a rule with 'monospace', replace it
            // The Roboto Mono has the digits, but need 'monospace' as fallback for the letter glyphs, because we use unicode-range.
            families.splice(monospaceIndex, 1, ['"Roboto Mono"', '"Thanks Numderscore"', 'monospace']);
            rule.style.fontFamily = families.join(',');
          }
        }
      }
    } catch (err) {
      // Ignore errors that are  mainly CORS issues for external stylesheets
    }
  }
}

window.addEventListener('load', _ => setTimeout(replaceMonospaceFont, 50));


function injectStyles(file) {
    var el = document.createElement('link');
    el.rel = 'stylesheet'
    el.setAttribute('href', file);
    (document.body ?? document.head).appendChild(el);
}

function injectScript(file) {
    var el = document.createElement('script');
    el.setAttribute('src', file);
    (document.body ?? document.head).appendChild(el);
}