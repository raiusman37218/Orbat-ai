const fs = require('fs');

const css = fs.readFileSync('resolvo_style.css', 'utf8');

// Find CSS variables (:root or variables)
const rootMatches = css.match(/:root\s*\{[\s\S]*?\}/gi) || [];
console.log('Found :root blocks:', rootMatches.length);
if (rootMatches.length > 0) {
  console.log('Root variables:\n', rootMatches[0].slice(0, 1500));
}

// Find button styles
const buttonRules = [];
const ruleRegex = /([^{}]+)\{([^{}]+)\}/g;
let match;
while ((match = ruleRegex.exec(css)) !== null) {
  const selector = match[1].trim();
  const declarations = match[2].trim();
  if (/\bbutton\b|\bhero\b|\bcard\b|\bsection-title\b|\bmain-container\b/i.test(selector)) {
    buttonRules.push({ selector, declarations: declarations.slice(0, 200) });
  }
}

console.log('\nRelevant UI classes found:', buttonRules.length);
buttonRules.slice(0, 15).forEach(r => {
  console.log(`\n${r.selector} {\n  ${r.declarations}\n}`);
});

