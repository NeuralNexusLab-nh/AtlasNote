import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon', '.woff2':'font/woff2', '.json':'application/json', '.webmanifest':'application/manifest+json', '.txt':'text/plain; charset=utf-8' };
// Use the production host policy locally too, including worker and error responses.
const { headers: headerRules } = JSON.parse(await fs.readFile(path.join(root, 'edgeone.json'), 'utf8'));
const securityHeaders = headerRules.find(rule => rule.source === '/*').headers;
const aliases = { '/dashboard':'dashboard.html', '/notes':'notes.html', '/note':'note.html', '/edit':'edit.html', '/new':'edit.html', '/settings':'settings.html', '/trash':'trash.html', '/docs':'docs.html', '/privacy':'privacy.html', '/terms':'terms.html' };
const server = http.createServer(async (req,res) => {
  for (const { key, value } of securityHeaders) {
    // This preview listens on HTTP loopback only. HTTPS upgrade/HSTS belong to the production host.
    if (key === 'Strict-Transport-Security') continue;
    res.setHeader(key, key === 'Content-Security-Policy' ? value.replace(/; upgrade-insecure-requests$/, '') : value);
  }
  res.setHeader('Cache-Control','no-cache');
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
  let pathname; try { pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  const relative = aliases[pathname] || (pathname === '/' ? 'index.html' : pathname.slice(1));
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep) || relative.split(/[\\/]/).some(p => p.startsWith('.')) || /^(tools|test|node_modules)(\/|\\|$)/.test(relative) || ['package.json','README.md','LICENSE','NOTICE'].includes(relative)) { res.writeHead(404).end(); return; }
  try { const bytes = await fs.readFile(target); res.setHeader('Content-Type',types[path.extname(target)] || 'application/octet-stream'); res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : bytes); }
  catch { res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'}); res.end('<!doctype html><title>404 — AtlasNote</title><h1>404</h1><a href="/">AtlasNote</a>'); }
});
const port = Number(process.env.PORT || 4321);
server.listen(port,'127.0.0.1',() => console.log(`AtlasNote local preview: http://127.0.0.1:${port}`));
