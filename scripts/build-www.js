// Copies the shared web files into www/ for the Android wrapper. The website itself is served straight from the repo root.
const fs=require('fs'),path=require('path'),root=path.join(__dirname,'..'),out=path.join(root,'www');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(path.join(out,'icons'),{recursive:true});
for(const f of ['index.html','features.js','manifest.webmanifest','sw.js','icons/icon-192.png','icons/icon-512.png'])fs.copyFileSync(path.join(root,f),path.join(out,f));
console.log('www ready');
