import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
function walk(path) {
  for (const entry of readdirSync(path,{withFileTypes:true})) {
    const file = `${path}/${entry.name}`;
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith('.mjs')) {
      const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
      if(result.status!==0) process.exit(result.status ?? 1);
    }
  }
}
for (const path of ['services','packages','scripts','tests']) walk(path);
console.log('Sintaxis de módulos verificada.');
