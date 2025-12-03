/**
 * Centralized native binary loader for node-webcodecs
 * Uses node-gyp-build for automatic prebuild discovery
 * Supports Node.js, Bun, and other runtimes
 */

import path from 'path';

// node-gyp-build handles:
// - Finding prebuilds in prebuilds/ directory
// - NAPI version compatibility
// - Platform/arch detection (darwin-arm64, linux-x64, etc.)
// - libc variant detection (glibc vs musl)
// - Fallback to build/Release for local development
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodeGypBuild = require('node-gyp-build');

let native: any;
try {
  // Pass the package root directory (parent of dist/)
  native = nodeGypBuild(path.join(__dirname, '..'));
} catch (error) {
  // Store error to throw when native is actually accessed
  // This allows the module to load even if native isn't available
  native = new Proxy({}, {
    get() {
      throw error;
    }
  });
}

export { native };
