#!/bin/bash
set -e

echo "Building frontend with Vite..."
vite build --config vite.config.ts

echo "Building backend with Node.js build script..."
node build.mjs

echo "✓ Build complete!"
