import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes, createCipheriv } from 'node:crypto';
import { createResearchIndex } from '../research-core.js';

const [input, output, secretFile] = process.argv.slice(2);
if (!input || !output || !secretFile || !process.env.RESEARCH_PASSWORD) throw Error('Usage: RESEARCH_PASSWORD=... node scripts/seal-research.mjs input.json output.js private-secret-file');
const data = JSON.parse(await readFile(input, 'utf8'));
createResearchIndex(data);
const key = randomBytes(32), iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
cipher.setAAD(Buffer.from('research-snapshot-v1'));
const encrypted = Buffer.concat([cipher.update(JSON.stringify({ password: process.env.RESEARCH_PASSWORD, data })), cipher.final(), cipher.getAuthTag()]);
await writeFile(secretFile, key.toString('hex'), { mode: 0o600, flag: 'wx' });
await writeFile(output, '// AES-GCM sealed content. RESEARCH_SECRET is stored only on the server.\nexport default ' + JSON.stringify({ iv: iv.toString('base64url'), ciphertext: encrypted.toString('base64url') }) + ';\n');
console.log(`Sealed ${data.records.length} research summaries; secret saved outside the repository.`);
