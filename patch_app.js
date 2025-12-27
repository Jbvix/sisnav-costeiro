
const fs = require('fs');

const FILE = 'js/App.js';
let content = fs.readFileSync(FILE, 'utf8');

// The exact string seen in debug output (lines 1658-1662)
const SEARCH =
    `        // Fallback Date: Use Current Time if empty set\r
        if (!dateVal) {\r
            const now = new Date();\r
            dateVal = now.toISOString(); // Approximation for calculation\r
        }`;

const REPLACE =
    `        // Fallback Date: REMOVED. Strict Check.\r
        if (!dateVal) {\r
             setTxt(\`disp-tide-\${type}\`, "-");\r
             setTxt(\`disp-wind-\${type}\`, "-");\r
             setTxt(\`disp-wx-\${type}\`, "-");\r
             return; \r
        }`;

if (content.includes(SEARCH)) {
    content = content.replace(SEARCH, REPLACE);
    fs.writeFileSync(FILE, content, 'utf8');
    console.log("PATCH APPLIED SUCCESSFULLY");
} else {
    // Try without \r just in case readFileSync normalized it depending on version (though usually it doesn't)
    const SEARCH_LF = SEARCH.replace(/\r/g, '');
    if (content.includes(SEARCH_LF)) {
        content = content.replace(SEARCH_LF, REPLACE.replace(/\r/g, ''));
        fs.writeFileSync(FILE, content, 'utf8');
        console.log("PATCH APPLIED SUCCESSFULLY (LF Mode)");
    } else {
        console.log("SEARCH STRING NOT FOUND");
        console.log("Expected length:", SEARCH.length);
        // console.log("Content slice:", content.substring(content.indexOf("Fallback Date"), content.indexOf("Fallback Date")+200));
    }
}
