import {build} from 'esbuild';
import {cp,mkdir} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
await build({entryPoints:['src-cloud.js'],outfile:'dist/cloud.js',bundle:true,format:'iife',minify:true});
