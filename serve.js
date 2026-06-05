// 로컬 미리보기 서버:  node serve.js  ->  http://localhost:8731
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, 'docs');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json' };
http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (req.url === '/' || req.url === '') p = path.join(root, 'index.html');
  fs.readFile(p, (e, b) => {
    if (e) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
    res.end(b);
  });
}).listen(8731, () => console.log('대시보드 미리보기: http://localhost:8731'));
