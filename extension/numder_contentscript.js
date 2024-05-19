'use strict';


// The manifest could add this CSS declaratively, but it puts it in the head and we want it later, for overriding
injectStyles( chrome.runtime.getURL('numder_style.css'), 'body');


// `monospace` can't be replaced with @font-face rules, so we change those rules to point to 'Roboto Mono' 
//  Note: Roboto Mono is definitely different than the system monospace font.
function replaceMonospaceFont() {
  for (const styleSheet of document.styleSheets) {
    try {
      for (const rule of styleSheet.cssRules) {
        if (rule.style && rule.style.fontFamily === 'monospace') {
          // Found a rule with 'monospace', replace it
          rule.style.fontFamily = '"Roboto Mono", "Thanks Numderscore", monospace'; 
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
    document.body.appendChild(el);
}

function injectScript(file) {
    var el = document.createElement('script');
    el.setAttribute('src', file);
    document.body.appendChild(el);
}