const fs = require('fs');
const c = JSON.parse(fs.readFileSync('content.json', 'utf8'));
console.log('Keys in content.json:', Object.keys(c));
console.log('imageBadges keys:', Object.keys(c.imageBadges || {}));
