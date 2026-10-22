import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync } from 'node:fs';
if (existsSync('.env')) { console.log('.env ya existe; se conserva.'); process.exit(0); }
const password = randomBytes(24).toString('base64url');
writeFileSync('.env', `HOST=127.0.0.1\nPORT=3000\nDATABASE_PATH=./data/ingenia.sqlite\nPRESENTER_PASSWORD=${password}\nCOOKIE_SECURE=false\nTOKEN_TTL_SECONDS=28800\n`, { mode: 0o600, flag: 'wx' });
console.log('Configuración creada. Contraseña del conferencista guardada en .env (PRESENTER_PASSWORD).');
