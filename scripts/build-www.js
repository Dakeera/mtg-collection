// Copies the shared web files into www/ for the Android wrapper. The website itself is served straight from the repo root.
const fs=require('fs'),path=require('path'),root=path.join(__dirname,'..'),out=path.join(root,'www');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(path.join(out,'icons'),{recursive:true});
for(const f of ['index.html','features.js','manifest.webmanifest','sw.js','icons/icon-192.png','icons/icon-512.png','icons/nav-generate.png','icons/nav-collection.png','icons/nav-decks.svg','icons/nav-add.svg','icons/nav-generate-orb.svg','icons/nav-more.svg'])fs.copyFileSync(path.join(root,f),path.join(out,f));
console.log('www ready');
