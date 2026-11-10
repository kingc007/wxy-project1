import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const tpl = readFileSync(join(dir, 'template.html'), 'utf8');
const data = JSON.stringify(JSON.parse(readFileSync(join(dir, 'data.json'), 'utf8'))).replace(/<\//g, '<\\/');
if (!tpl.includes('__DATA__')) throw new Error('template has no __DATA__ marker');
writeFileSync(join(dir, 'index.html'), tpl.replace('__DATA__', () => data));
console.log('wrote index.html');
