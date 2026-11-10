import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const tpl = readFileSync(join(dir, 'template.html'), 'utf8');
const data = readFileSync(join(dir, 'data.json'), 'utf8');
// Re-serialise to compact JSON, then escape "</" so the JSON cannot close the script tag.
const json = JSON.stringify(JSON.parse(data)).replace(/<\//g, '<\\/');
writeFileSync(join(dir, 'index.html'), tpl.replace('__DATA__', () => json));
console.log('index.html written,', (json.length / 1024).toFixed(0), 'KB of data');
