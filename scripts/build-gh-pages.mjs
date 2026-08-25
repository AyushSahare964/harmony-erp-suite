import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const rootDir = process.cwd();
const outputPublicDir = path.join(rootDir, ".output", "public");
const assetsDir = path.join(outputPublicDir, "assets");
const distDir = path.join(rootDir, "dist-gh-pages");

console.log("=== Building VetOS ERP for GitHub Pages ===");

// 1. Run build
console.log("Running vite build...");
execSync("npm run build", { stdio: "inherit", cwd: rootDir });

// 2. Find asset files
if (!fs.existsSync(assetsDir)) {
  console.error("Assets directory not found at:", assetsDir);
  process.exit(1);
}

const assetFiles = fs.readdirSync(assetsDir);
const mainJs = assetFiles.find((f) => f.startsWith("index-") && f.endsWith(".js"));
const mainCss = assetFiles.find((f) => f.startsWith("styles-") && f.endsWith(".css"));

if (!mainJs || !mainCss) {
  console.error("Could not find mainJs or mainCss in assets:", assetFiles);
  process.exit(1);
}

console.log(`Found bundle: JS = ${mainJs}, CSS = ${mainCss}`);

// 3. Create index.html
const indexHtmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>VetOS ERP — Veterinary Clinic Management Suite</title>
    <meta name="description" content="Role-based ERP for veterinary clinics: appointments, OPD, lab, boarding, pharmacy, billing and finance." />
    <meta property="og:title" content="VetOS ERP — Veterinary Clinic Management Suite" />
    <meta property="og:description" content="Role-based ERP for veterinary clinics: appointments, OPD, lab, boarding, pharmacy, billing and finance." />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="stylesheet" href="./assets/${mainCss}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />
    <link rel="icon" href="./favicon.ico" type="image/x-icon" />
    <!-- SPA redirect resolver for GitHub Pages -->
    <script type="text/javascript">
      (function(l) {
        if (l.search[1] === '/' ) {
          var decoded = l.search.slice(1).split('&').map(function(s) { 
            return s.replace(/~and~/g, '&')
          }).join('?');
          window.history.replaceState(null, null,
              l.pathname.slice(0, -1) + decoded + l.hash
          );
        }
      }(window.location))
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./assets/${mainJs}"></script>
  </body>
</html>
`;

// 4. Create 404.html (for GitHub Pages SPA routing)
const notFoundHtmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>VetOS ERP</title>
    <!-- SPA redirect for GitHub Pages (https://github.com/rafgraph/spa-github-pages) -->
    <script type="text/javascript">
      var pathSegmentsToKeep = 1;
      var l = window.location;
      l.replace(
        l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
        l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') + '/?/' +
        l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~') +
        (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
        l.hash
      );
    </script>
  </head>
  <body>
  </body>
</html>
`;

// Write to .output/public
fs.writeFileSync(path.join(outputPublicDir, "index.html"), indexHtmlContent, "utf-8");
fs.writeFileSync(path.join(outputPublicDir, "404.html"), notFoundHtmlContent, "utf-8");
fs.writeFileSync(path.join(outputPublicDir, ".nojekyll"), "", "utf-8");

// Copy .output/public to dist-gh-pages
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.cpSync(outputPublicDir, distDir, { recursive: true });

console.log("Successfully generated GitHub Pages static distribution in dist-gh-pages/");
