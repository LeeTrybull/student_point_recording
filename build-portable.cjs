const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'dist');
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace('  <link rel="stylesheet" href="styles.css">',()=>`  <style>${fs.readFileSync(path.join(root,'styles.css'),'utf8')}</style>`);
html=html.replace('  <link rel="icon" href="favicon.svg" type="image/svg+xml">','');
const scripts=[];
for(const source of ['vendor/xlsx.full.min.js','data.js','app.js']) {
  const script=fs.readFileSync(path.join(root,source),'utf8').replace(/<\/script/gi,'<\\/script').replace(/<!--/g,'<\\!--').replace(/<script/gi,'<\\x73cript');
  html=html.replace(`  <script defer src="${source}"></script>`,'');
  scripts.push(`<script>${script}</script>`);
}
const bodyEnd=html.lastIndexOf('</body>');
html=html.slice(0,bodyEnd)+scripts.join('\n')+'\n'+html.slice(bodyEnd);
fs.writeFileSync(path.join(__dirname,'学生积分管理系统.html'),html);
console.log('已生成离线单文件：学生积分管理系统.html');
