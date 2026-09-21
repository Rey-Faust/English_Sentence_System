import {build} from 'esbuild';
import {cp,mkdir,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
await Promise.all([
 build({entryPoints:['src-app.js'],outfile:'dist/app.js',bundle:true,format:'iife',minify:true,target:['es2020']}),
 build({entryPoints:['src-cloud.js'],outfile:'dist/cloud.js',bundle:true,format:'iife',minify:true,target:['es2020']})
]);
