const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_MEDIA_ROOT = path.join(PROJECT_ROOT, 'exercise-media');
const DEFAULT_HOST = process.env.EXERCISE_MEDIA_HOST || '0.0.0.0';
const DEFAULT_PORT = Number(process.env.EXERCISE_MEDIA_PORT || 8788);

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.mp4') return 'video/mp4';
  if (extension === '.json') return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

function resolveRequestPath(mediaRoot, requestPath = '/') {
  const normalizedPath = decodeURIComponent(String(requestPath || '/').split('?')[0]);
  const relativePath = normalizedPath.replace(/^\/+/g, '');
  const absolutePath = path.resolve(mediaRoot, relativePath);

  if (!absolutePath.startsWith(path.resolve(mediaRoot))) {
    return null;
  }

  return absolutePath;
}

function listLocalUrls(host, port) {
  const urls = new Set([`http://127.0.0.1:${port}`]);

  if (host !== '0.0.0.0' && host !== '::') {
    urls.add(`http://${host}:${port}`);
    return Array.from(urls);
  }

  Object.values(os.networkInterfaces()).forEach(interfaceList => {
    (interfaceList || []).forEach(entry => {
      if (entry.family !== 'IPv4' || entry.internal) return;
      urls.add(`http://${entry.address}:${port}`);
    });
  });

  return Array.from(urls);
}

function createExerciseMediaServer({ mediaRoot = DEFAULT_MEDIA_ROOT } = {}) {
  return http.createServer((request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true, mediaRoot }));
      return;
    }

    const filePath = resolveRequestPath(mediaRoot, request.url || '/');
    if (!filePath) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Forbidden');
      return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': getContentType(filePath),
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    fs.createReadStream(filePath).pipe(response);
  });
}

function startServer() {
  const mediaRoot = path.resolve(process.argv[2] || process.env.EXERCISE_MEDIA_ROOT || DEFAULT_MEDIA_ROOT);
  const host = process.env.EXERCISE_MEDIA_HOST || DEFAULT_HOST;
  const port = Number(process.env.EXERCISE_MEDIA_PORT || DEFAULT_PORT);

  if (!fs.existsSync(mediaRoot)) {
    throw new Error(`Media root not found: ${mediaRoot}`);
  }

  const server = createExerciseMediaServer({ mediaRoot });
  server.listen(port, host, () => {
    console.log(JSON.stringify({
      mediaRoot,
      urls: listLocalUrls(host, port),
    }, null, 2));
  });
}

if (require.main === module) {
  try {
    startServer();
  } catch (error) {
    console.error(error.message || String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  createExerciseMediaServer,
  getContentType,
  resolveRequestPath,
};
