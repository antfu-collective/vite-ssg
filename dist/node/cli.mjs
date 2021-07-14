import {
  __require
} from "../chunk-SO7PDUCV.mjs";

// src/node/cli.ts
import yargs from "yargs";

// src/node/build.ts
import { join, dirname } from "path";
import chalk2 from "chalk";
import fs from "fs-extra";
import { build as viteBuild, resolveConfig } from "vite";
import { renderToString } from "@vue/server-renderer";
import { JSDOM, VirtualConsole } from "jsdom";

// src/node/preload-links.ts
function renderPreloadLinks(document, modules, manifest) {
  const seen = new Set();
  const preloadLinks = [];
  Array.from(modules).forEach((id) => {
    const files = manifest[id] || [];
    files.forEach((file) => {
      if (!preloadLinks.includes(file))
        preloadLinks.push(file);
    });
  });
  if (preloadLinks) {
    preloadLinks.forEach((file) => {
      if (!seen.has(file)) {
        seen.add(file);
        renderPreloadLink(document, file);
      }
    });
  }
}
function renderPreloadLink(document, file) {
  if (file.endsWith(".js")) {
    appendLink(document, {
      rel: "modulepreload",
      crossOrigin: "",
      href: file
    });
  } else if (file.endsWith(".css")) {
    appendLink(document, {
      rel: "stylesheet",
      href: file
    });
  }
}
var createLink = (document) => document.createElement("link");
var setAttrs = (el, attrs) => {
  const keys = Object.keys(attrs);
  for (const key of keys)
    el.setAttribute(key, attrs[key]);
};
function appendLink(document, attrs) {
  const exits = document.head.querySelector(`link[href='${attrs.file}']`);
  if (exits)
    return;
  const link = createLink(document);
  setAttrs(link, attrs);
  document.head.appendChild(link);
}

// src/node/utils.ts
import chalk from "chalk";
function buildLog(text, count) {
  console.log(`
${chalk.gray("[vite-ssg]")} ${chalk.yellow(text)}${count ? chalk.blue(` (${count})`) : ""}`);
}
function getSize(str) {
  return `${(str.length / 1024).toFixed(2)}kb`;
}
function routesToPaths(routes) {
  if (!routes)
    return ["/"];
  const paths = new Set();
  const getPaths = (routes2, prefix = "") => {
    prefix = prefix.replace(/\/$/g, "");
    for (const route of routes2) {
      if (route.path) {
        paths.add(prefix && !route.path.startsWith("/") ? `${prefix}/${route.path}` : route.path);
      }
      if (Array.isArray(route.children))
        getPaths(route.children, route.path);
    }
  };
  getPaths(routes);
  return [...paths];
}

// src/node/build.ts
function DefaultIncludedRoutes(paths) {
  return paths.filter((i) => !i.includes(":") && !i.includes("*"));
}
async function build(cliOptions = {}) {
  const mode = process.env.MODE || process.env.NODE_ENV || "production";
  const config = await resolveConfig({}, "build", mode);
  const cwd = process.cwd();
  const root = config.root || cwd;
  const ssgOut = join(root, ".vite-ssg-temp");
  const outDir = config.build.outDir || "dist";
  const out = join(root, outDir);
  const {
    script = "sync",
    mock = false,
    entry = await detectEntry(root),
    formatting = null,
    buildCjs = false,
    includedRoutes = DefaultIncludedRoutes,
    onBeforePageRender,
    onPageRendered,
    onFinished
  } = Object.assign({}, config.ssgOptions || {}, cliOptions);
  if (fs.existsSync(ssgOut))
    await fs.remove(ssgOut);
  const ssrConfig = {
    build: {
      ssr: join(root, entry),
      outDir: ssgOut,
      minify: false,
      cssCodeSplit: false
    }
  };
  buildLog("Build for client...");
  await viteBuild({
    build: {
      ssrManifest: true,
      rollupOptions: {
        input: {
          app: join(root, "./index.html")
        }
      }
    }
  });
  buildLog("Build for server...");
  process.env.VITE_SSG = "true";
  await viteBuild(ssrConfig);
  let outputFile = join(ssgOut, "main.js");
  if (buildCjs === true) {
    let pos = outputFile.lastIndexOf(".");
    outputFile = outputFile.substr(0, pos < 0 ? outputFile.length : pos) + ".cjs";
    await fs.rename(join(ssgOut, "main.js"), outputFile);
  }
  const ssrManifest = JSON.parse(await fs.readFile(join(out, "ssr-manifest.json"), "utf-8"));
  const { createApp } = __require(outputFile);
  let indexHTML = await fs.readFile(join(out, "index.html"), "utf-8");
  const { routes, initialState } = await createApp(false);
  let routesPaths = await includedRoutes(routesToPaths(routes));
  routesPaths = Array.from(new Set(routesPaths));
  indexHTML = rewriteScripts(indexHTML, script);
  buildLog("Rendering Pages...", routesPaths.length);
  if (mock) {
    const virtualConsole = new VirtualConsole();
    const jsdom = new JSDOM("", { url: "http://localhost", virtualConsole });
    global.window = jsdom.window;
    Object.assign(global, jsdom.window);
  }
  await Promise.all(routesPaths.map(async (route) => {
    const { app, router, head } = await createApp(false);
    if (router) {
      await router.push(route);
      await router.isReady();
    }
    const transformedIndexHTML = await (onBeforePageRender == null ? void 0 : onBeforePageRender(route, indexHTML)) || indexHTML;
    const ctx = {};
    const appHTML = await renderToString(app, ctx);
    const renderedHTML = renderHTML({ indexHTML: transformedIndexHTML, appHTML, initialState });
    const jsdom = new JSDOM(renderedHTML);
    renderPreloadLinks(jsdom.window.document, ctx.modules || new Set(), ssrManifest);
    head == null ? void 0 : head.updateDOM(jsdom.window.document);
    const html = jsdom.serialize();
    const transformed = await (onPageRendered == null ? void 0 : onPageRendered(route, html)) || html;
    const formatted = format(transformed, formatting);
    const relativeRoute = (route.endsWith("/") ? `${route}index` : route).replace(/^\//g, "");
    const filename = `${relativeRoute}.html`;
    await fs.ensureDir(join(out, dirname(relativeRoute)));
    await fs.writeFile(join(out, filename), formatted, "utf-8");
    config.logger.info(`${chalk2.dim(`${outDir}/`)}${chalk2.cyan(filename)}	${chalk2.dim(getSize(formatted))}`);
  }));
  await fs.remove(ssgOut);
  console.log(`
${chalk2.gray("[vite-ssg]")} ${chalk2.green("Build finished.")}`);
  onFinished == null ? void 0 : onFinished();
}
function rewriteScripts(indexHTML, mode) {
  if (!mode || mode === "sync")
    return indexHTML;
  return indexHTML.replace(/<script type="module" /g, `<script type="module" ${mode} `);
}
function renderHTML({ indexHTML, appHTML, initialState }) {
  return indexHTML.replace('<div id="app"></div>', `<div id="app" data-server-rendered="true">${appHTML}</div>

<script>window.__INITIAL_STATE__=${initialState}<\/script>`);
}
function format(html, formatting) {
  if (formatting === "minify") {
    return __require("html-minifier").minify(html, {
      collapseWhitespace: true,
      caseSensitive: true,
      collapseInlineTagWhitespace: true,
      minifyJS: true,
      minifyCSS: true
    });
  } else if (formatting === "prettify") {
    return __require("prettier").format(html, { semi: false, parser: "html" });
  }
  return html;
}
async function detectEntry(root) {
  const scriptSrcReg = /<script(?:.*?)src=["'](.+?)["'](?!<)(?:.*)\>(?:[\n\r\s]*?)(?:<\/script>)/img;
  const html = await fs.readFile(join(root, "index.html"), "utf-8");
  const scripts = [...html.matchAll(scriptSrcReg)];
  const [, entry] = scripts.find((matchResult) => {
    const [script] = matchResult;
    const [, scriptType] = script.match(/.*\stype=(?:'|")?([^>'"\s]+)/i) || [];
    return scriptType === "module";
  }) || [];
  return entry || "src/main.ts";
}

// src/node/cli.ts
yargs.scriptName("vite-ssg").usage("$0 [args]").command("build", "Build SSG", (args) => args.option("script", {
  choices: ["sync", "async", "defer", "async defer"],
  describe: "Rewrites script loading timing"
}).option("mock", {
  type: "boolean",
  describe: "Mock browser globals (window, document, etc.) for SSG"
}), async (args) => {
  await build(args);
}).showHelpOnFail(false).help().argv;
