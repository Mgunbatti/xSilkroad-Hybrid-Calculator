const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),messages=JSON.parse(fs.readFileSync(path.join(root,'locales/en.json')));
fs.writeFileSync(path.join(root,'i18n-en.js'),'/* Generated from locales/en.json by scripts/sync-english.cjs. */\n(function(root){const messages='+JSON.stringify(messages,null,2)+';\nif(typeof module===\'object\'&&module.exports)module.exports=messages;else root.SilkroadEnglish=messages;})(globalThis);\n');
