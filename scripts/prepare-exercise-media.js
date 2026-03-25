const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SOURCE_ROOT = '/tmp/exercises-dataset-analysis';
const DEFAULT_TARGET_ROOT = path.join(PROJECT_ROOT, 'exercise-media');
const MEDIA_FOLDERS = ['images', 'videos'];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function countFiles(dirPath) {
  return fs.readdirSync(dirPath, { withFileTypes: true }).reduce((total, entry) => {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return total + countFiles(entryPath);
    }
    return total + 1;
  }, 0);
}

function copyMediaFolder(sourceRoot, targetRoot, folderName) {
  const sourcePath = path.join(sourceRoot, folderName);
  const targetPath = path.join(targetRoot, folderName);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing source folder: ${sourcePath}`);
  }

  ensureDir(targetRoot);
  fs.rmSync(targetPath, { recursive: true, force: true });
  fs.cpSync(sourcePath, targetPath, { recursive: true });

  return {
    folderName,
    sourcePath,
    targetPath,
    fileCount: countFiles(targetPath),
  };
}

function main() {
  const sourceRoot = path.resolve(process.argv[2] || process.env.EXERCISE_DATASET_ROOT || DEFAULT_SOURCE_ROOT);
  const targetRoot = path.resolve(process.argv[3] || process.env.EXERCISE_MEDIA_ROOT || DEFAULT_TARGET_ROOT);

  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`Source dataset root not found: ${sourceRoot}`);
  }

  const copied = MEDIA_FOLDERS.map(folderName => copyMediaFolder(sourceRoot, targetRoot, folderName));

  console.log(JSON.stringify({
    sourceRoot,
    targetRoot,
    copied,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exitCode = 1;
}
