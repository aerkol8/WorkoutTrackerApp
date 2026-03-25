const { spawn } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const expoCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const userArgs = process.argv.slice(2);
const explicitHostModes = new Set(['--tunnel', '--lan', '--localhost', '--offline']);
const hasHostArg = userArgs.includes('--host') || userArgs.some(arg => arg.startsWith('--host='));
const hasExplicitHostMode = userArgs.some(arg => explicitHostModes.has(arg));
const expoArgs = ['expo', 'start', ...((hasHostArg || hasExplicitHostMode) ? [] : ['--host', 'localhost']), ...userArgs];
const mediaArgs = [path.join(projectRoot, 'scripts/serve-exercise-media.js')];

if (userArgs.includes('--tunnel')) {
  console.log('[media] Expo tunnel Metro icin calisir; local exercise media (:8788) yine ayni LAN veya public host gerektirir.');
}

function spawnChild(command, args, label) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  });

  child.on('error', (error) => {
    console.error(`[${label}] ${error.message || String(error)}`);
  });

  return child;
}

const mediaServer = spawnChild(process.execPath, mediaArgs, 'media');
const expo = spawnChild(expoCommand, expoArgs, 'expo');

function stopChild(child, signal = 'SIGTERM') {
  if (!child || child.killed) return;
  try {
    child.kill(signal);
  } catch (error) {
    // Process may already be closed.
  }
}

function shutdown(signal = 'SIGTERM') {
  stopChild(mediaServer, signal);
  stopChild(expo, signal);
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
  process.exit(0);
});

mediaServer.on('exit', (code) => {
  if (code && code !== 0) {
    console.warn('[media] local exercise media server exited early');
  }
});

expo.on('exit', (code, signal) => {
  stopChild(mediaServer, 'SIGTERM');
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code || 0);
});
