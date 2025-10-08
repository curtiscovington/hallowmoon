import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

async function syncManifest(version) {
  const manifestPath = resolve(root, 'public/manifest.webmanifest');
  const content = await readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(content);
  if (manifest.version !== version) {
    manifest.version = version;
    await writeFile(
      manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf-8'
    );
  }
}

async function syncVersionModule(version) {
  const modulePath = resolve(root, 'src/version.ts');
  const source = `export const APP_VERSION = '${version}';\n`;
  await writeFile(modulePath, source, 'utf-8');
}

async function main() {
  const packageJsonPath = resolve(root, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
  const version = packageJson.version;
  await Promise.all([syncManifest(version), syncVersionModule(version)]);
  console.log(`Version synchronised: ${version}`);
}

main().catch((error) => {
  console.error('Failed to synchronise version', error);
  process.exitCode = 1;
});
