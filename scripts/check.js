'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let failed = false;

function collectJs(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git') continue;
      collectJs(full, out);
    } else if (name.endsWith('.js')) {
      out.push(full);
    }
  }
}

const jsFiles = [];
collectJs(root, jsFiles);

for (const f of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    console.log('OK   语法检查 ', path.relative(root, f));
  } catch (e) {
    failed = true;
    console.log('FAIL 语法检查 ', path.relative(root, f));
    console.log(String(e.stderr || e.message).trim());
  }
}

const htmlPath = path.join(root, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const appJs = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const refs = [...appJs.matchAll(/\$\('#([a-zA-Z0-9-]+)'\)/g)].map((m) => m[1]);
const missing = [...new Set(refs)].filter((id) => !htmlIds.has(id));
if (missing.length) {
  failed = true;
  console.log('FAIL index.html 缺少以下 id（被 js/app.js 引用）:');
  for (const id of missing) console.log('     #' + id);
} else {
  console.log('OK   index.html id 与 js/app.js 引用一致');
}

const required = ['css/style.css', 'functions/_middleware.js', 'functions/api/proxy.js'];
for (const r of required) {
  if (fs.existsSync(path.join(root, r))) {
    console.log('OK   存在 ', r);
  } else {
    failed = true;
    console.log('FAIL 缺少  ', r);
  }
}

if (failed) {
  console.log('\n检查未通过');
  process.exit(1);
} else {
  console.log('\n全部检查通过');
}
