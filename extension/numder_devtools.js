chrome.devtools.panels.applyStyleSheet(`

.platform-mac,
:host-context(.platform-mac),
.platform-windows,
:host-context(.platform-windows),
.platform-linux,
:host-context(.platform-linux),
body,
:root,
.monospace,
.source-code {
    font-family: 'Papyrus' !important;
    --monospace-font-family: 'Papyrus' !important;
    --source-code-font-family: 'Papyrus' !important;
}

`);
