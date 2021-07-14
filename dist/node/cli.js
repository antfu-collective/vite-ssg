"use strict"; function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _chunk3FHQZVYOjs = require('../chunk-3FHQZVYO.js');

// src/node/cli.ts
var _yargs = require('yargs'); var _yargs2 = _interopRequireDefault(_yargs);

// src/node/build.ts
var _path = require('path');
var _chalk = require('chalk'); var _chalk2 = _interopRequireDefault(_chalk);
var _fsextra = require('fs-extra'); var _fsextra2 = _interopRequireDefault(_fsextra);
var _vite = require('vite');
var _serverrenderer = require('@vue/server-renderer');
var _jsdom = require('jsdom');

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

function buildLog(text, count) {
  console.log(`
${_chalk2.default.gray("[vite-ssg]")} ${_chalk2.default.yellow(text)}${count ? _chalk2.default.blue(` (${count})`) : ""}`);
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
  const config = await _vite.resolveConfig.call(void 0, {}, "build", mode);
  const cwd = process.cwd();
  const root = config.root || cwd;
  const ssgOut = _path.join.call(void 0, root, ".vite-ssg-temp");
  const outDir = config.build.outDir || "dist";
  const out = _path.join.call(void 0, root, outDir);
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
  if (_fsextra2.default.existsSync(ssgOut))
    await _fsextra2.default.remove(ssgOut);
  const ssrConfig = {
    build: {
      ssr: _path.join.call(void 0, root, entry),
      outDir: ssgOut,
      minify: false,
      cssCodeSplit: false
    }
  };
  buildLog("Build for client...");
  await _vite.build.call(void 0, {
    build: {
      ssrManifest: true,
      rollupOptions: {
        input: {
          app: _path.join.call(void 0, root, "./index.html")
        }
      }
    }
  });
  buildLog("Build for server...");
  process.env.VITE_SSG = "true";
  await _vite.build.call(void 0, ssrConfig);
  let outputFile = _path.join.call(void 0, ssgOut, "main.js");
  if (buildCjs === true) {
    let pos = outputFile.lastIndexOf(".");
    outputFile = outputFile.substr(0, pos < 0 ? outputFile.length : pos) + ".cjs";
    await _fsextra2.default.rename(_path.join.call(void 0, ssgOut, "main.js"), outputFile);
  }
  const ssrManifest = JSON.parse(await _fsextra2.default.readFile(_path.join.call(void 0, out, "ssr-manifest.json"), "utf-8"));
  const { createApp } = _chunk3FHQZVYOjs.__require.call(void 0, outputFile);
  let indexHTML = await _fsextra2.default.readFile(_path.join.call(void 0, out, "index.html"), "utf-8");
  const { routes, initialState } = await createApp(false);
  let routesPaths = await includedRoutes(routesToPaths(routes));
  routesPaths = Array.from(new Set(routesPaths));
  indexHTML = rewriteScripts(indexHTML, script);
  buildLog("Rendering Pages...", routesPaths.length);
  if (mock) {
    const virtualConsole = new (0, _jsdom.VirtualConsole)();
    const jsdom = new (0, _jsdom.JSDOM)("", { url: "http://localhost", virtualConsole });
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
    const appHTML = await _serverrenderer.renderToString.call(void 0, app, ctx);
    const renderedHTML = renderHTML({ indexHTML: transformedIndexHTML, appHTML, initialState });
    const jsdom = new (0, _jsdom.JSDOM)(renderedHTML);
    renderPreloadLinks(jsdom.window.document, ctx.modules || new Set(), ssrManifest);
    head == null ? void 0 : head.updateDOM(jsdom.window.document);
    const html = jsdom.serialize();
    const transformed = await (onPageRendered == null ? void 0 : onPageRendered(route, html)) || html;
    const formatted = format(transformed, formatting);
    const relativeRoute = (route.endsWith("/") ? `${route}index` : route).replace(/^\//g, "");
    const filename = `${relativeRoute}.html`;
    await _fsextra2.default.ensureDir(_path.join.call(void 0, out, _path.dirname.call(void 0, relativeRoute)));
    await _fsextra2.default.writeFile(_path.join.call(void 0, out, filename), formatted, "utf-8");
    config.logger.info(`${_chalk2.default.dim(`${outDir}/`)}${_chalk2.default.cyan(filename)}	${_chalk2.default.dim(getSize(formatted))}`);
  }));
  await _fsextra2.default.remove(ssgOut);
  console.log(`
${_chalk2.default.gray("[vite-ssg]")} ${_chalk2.default.green("Build finished.")}`);
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
    return _chunk3FHQZVYOjs.__require.call(void 0, "html-minifier").minify(html, {
      collapseWhitespace: true,
      caseSensitive: true,
      collapseInlineTagWhitespace: true,
      minifyJS: true,
      minifyCSS: true
    });
  } else if (formatting === "prettify") {
    return _chunk3FHQZVYOjs.__require.call(void 0, "prettier").format(html, { semi: false, parser: "html" });
  }
  return html;
}
async function detectEntry(root) {
  const scriptSrcReg = /<script(?:.*?)src=["'](.+?)["'](?!<)(?:.*)\>(?:[\n\r\s]*?)(?:<\/script>)/img;
  const html = await _fsextra2.default.readFile(_path.join.call(void 0, root, "index.html"), "utf-8");
  const scripts = [...html.matchAll(scriptSrcReg)];
  const [, entry] = scripts.find((matchResult) => {
    const [script] = matchResult;
    const [, scriptType] = script.match(/.*\stype=(?:'|")?([^>'"\s]+)/i) || [];
    return scriptType === "module";
  }) || [];
  return entry || "src/main.ts";
}

// src/node/cli.ts
_yargs2.default.scriptName("vite-ssg").usage("$0 [args]").command("build", "Build SSG", (args) => args.option("script", {
  choices: ["sync", "async", "defer", "async defer"],
  describe: "Rewrites script loading timing"
}).option("mock", {
  type: "boolean",
  describe: "Mock browser globals (window, document, etc.) for SSG"
}), async (args) => {
  await build(args);
}).showHelpOnFail(false).help().argv;
