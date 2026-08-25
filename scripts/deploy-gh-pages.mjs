import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist-gh-pages");

console.log("=== Deploying to gh-pages branch ===");

// 1. Build
execSync("node scripts/build-gh-pages.mjs", { stdio: "inherit", cwd: rootDir });

if (!fs.existsSync(distDir)) {
  console.error("dist-gh-pages not found");
  process.exit(1);
}

// 2. Initialize a temporary git repo inside dist-gh-pages or push directly
const tempGitDir = path.join(distDir, ".git");
if (fs.existsSync(tempGitDir)) {
  fs.rmSync(tempGitDir, { recursive: true, force: true });
}

// Initialize git inside dist-gh-pages
execSync("git init", { cwd: distDir, stdio: "inherit" });
execSync("git checkout -b gh-pages", { cwd: distDir, stdio: "inherit" });
execSync("git add -A", { cwd: distDir, stdio: "inherit" });
execSync('git commit -m "deploy: update GitHub Pages build"', { cwd: distDir, stdio: "inherit" });

// Get origin url
const originUrl = execSync("git config --get remote.origin.url", { cwd: rootDir }).toString().trim();
console.log(`Pushing to ${originUrl} gh-pages...`);
execSync(`git remote add origin ${originUrl}`, { cwd: distDir, stdio: "inherit" });
execSync("git push -f origin gh-pages", { cwd: distDir, stdio: "inherit" });

console.log("=== Successfully pushed gh-pages branch! ===");
