const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DIST = path.join(__dirname, 'dist');

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.webp': 'image/webp',
};

http.createServer((req, res) => {
  let filePath = path.join(DIST, req.url.split('?')[0]);
  if (filePath.endsWith('/')) filePath += 'index.html';

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err || fs.statSync(filePath).isDirectory()) filePath = path.join(DIST, 'index.html');
    fs.readFile(filePath, (err2, data) => {
      if (err2) { res.writeHead(500); res.end('Error'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      res.end(data);
    });
  });
}).listen(PORT, '0.0.0.0', () => console.log(`Frontend serving on port ${PORT}`));
