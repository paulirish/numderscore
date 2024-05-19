'use strict';

function injectScript(file) {
    var el = document.createElement('script');
    el.setAttribute('src', file);
    document.body.appendChild(el);
}
// injectScript( chrome.runtime.getURL('numder_injected.js'), 'body');

function injectStyles(file) {
    var el = document.createElement('link');
    el.rel = 'stylesheet'
    el.setAttribute('href', file);
    document.body.appendChild(el);
}

// The manifest could add this declaratively, but it puts it in the head and we want it later, for overriding
injectStyles( chrome.runtime.getURL('numder_style.css'), 'body');


