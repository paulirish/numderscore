

function replaceMonospaceFont() {
  for (const styleSheet of document.styleSheets) {
    try {
      // Iterate through all rules in the stylesheet
      for (const rule of styleSheet.cssRules) {
        if (rule.style && rule.style.fontFamily === 'monospace') {
          // Found a rule with 'monospace', replace it
          rule.style.fontFamily = 'MenloMono'; 
        }
      }
    } catch (err) {
      // Handle errors, mainly CORS issues for external stylesheets
      console.warn("Error accessing stylesheet:", err); 
    }
  }
}

window.addEventListener('load', _ => setTimeout(replaceMonospaceFont, 50));
