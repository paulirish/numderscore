/* FYI!!!!!!!! 
   You need to go into DevTools Experiments and enable "Allow extensions to load custom stylesheets" 
   */

// For debugging purposes.
// const moarPapyrus = `
//   .platform-mac,
//   :host-context(.platform-mac),
//   .platform-windows,
//   :host-context(.platform-windows),
//   .platform-linux,
//   :host-context(.platform-linux),
//   body,
//   :root,
//   .monospace,
//   .source-code {
//       font-family: 'Papyrus' !important;
//       --monospace-font-family: 'Papyrus' !important;
//       --source-code-font-family: 'Papyrus' !important;
//   }

//   /*# sourceURL=numder_papyrus.css */
// `;
// chrome.devtools.panels.applyStyleSheet(moarPapyrus);

fetch(chrome.runtime.getURL('numder_style.css'))
  .then(r => r.text())
  .then(styleSheetText => {
    const extPrefix = chrome.runtime.getURL('');
    const adjusted = styleSheetText.replaceAll(` url('fonts/`, ` url('${extPrefix}fonts/`);
    chrome.devtools.panels.applyStyleSheet(adjusted);
  });

/**
 * monospace: FYI the 3 selectors all successfully target MOST monospace font elements. (But not all):
 *    - :host-context(.platform-XXX)
 *    - .monospace
 *    - .source-code
 *
 * sans: only the host-context seems neccessary for all sans-serif updates.
 */
chrome.devtools.panels.applyStyleSheet(`
  .platform-mac,
  :host-context(.platform-mac),
  .platform-windows,
  :host-context(.platform-windows),
  .platform-linux,
  :host-context(.platform-linux),
  body,
  :root {
      font-family: 'Roboto' !important;
  }
  :root,
  .monospace,
  .source-code {
      --monospace-font-family: 'Droid Sans Mono' !important;
      --source-code-font-family: 'Droid Sans Mono' !important;
  }

  /*# sourceURL=numder_devtools.css */
`);

// WELLLLLLLLLL this code is nice and all but its monitoring the numder_devtools.html document.. which.. doesn't have much going on.
// function checkElementForShadowRoot(element) {
//   if (element.shadowRoot && element.shadowRoot.adoptedStyleSheets.length > 0) {
//     console.log('Found ShadowRoot with adoptedStyleSheets:', element);

//      const targetStylesheet = root.adoptedStyleSheets.at(-1);
//     targetStylesheet.insertRule(moarPapyrus);
//   }
// }

// function checkElementAndChildren(element) {
//   checkElementForShadowRoot(element);
//   element.querySelectorAll('*').forEach(checkElementForShadowRoot);
// }

// function handleAddedNodes(addedNodes) {
//   addedNodes.forEach(node => {
//     if (node.nodeType === Node.ELEMENT_NODE) {
//       checkElementAndChildren(node);
//     }
//   });
// }

// const observer = new MutationObserver((mutations) => {
//   for (let mutation of mutations) handleAddedNodes(mutation.addedNodes);
// });
// observer.observe(document.documentElement, {
//   childList: true,
//   subtree: true
// });
// checkElementAndChildren(document.documentElement);

// // observer.disconnect();
