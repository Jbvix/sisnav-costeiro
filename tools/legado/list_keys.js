
const fs = require('fs');
try {
    const raw = fs.readFileSync('maritimo_mare_meteo.json', 'utf8');
    const data = JSON.parse(raw);
    console.log(Object.keys(data.ports).join('\n'));
} catch (e) {
    console.error(e);
}
