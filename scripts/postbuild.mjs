import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const indexPath = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const notFoundPath = fileURLToPath(new URL('../dist/404.html', import.meta.url));

async function ensure404() {
  await copyFile(indexPath, notFoundPath);
}

async function main() {
  await ensure404();
}

main().catch((error) => {
  console.error('Postbuild step failed', error);
  process.exitCode = 1;
});
