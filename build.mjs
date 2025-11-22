import * as esbuild from 'esbuild';

console.log('Building backend with esbuild...');
await esbuild.build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: 'dist/index.js',
  packages: 'external', // Don't bundle any node_modules - load at runtime
  minify: false,
  sourcemap: true,
  logLevel: 'info',
});

console.log('✓ Backend build complete!');
