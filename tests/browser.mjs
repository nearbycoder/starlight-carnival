// Run the downloadable HTML in an isolated Chrome profile. Node and Chrome
// communicate over a private pipe. No server, browser driver or npm install.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const gameUrl = new URL("../play/index.html", import.meta.url);
const captureDir = fileURLToPath(new URL("../captures/", import.meta.url));
const capture = process.argv.includes("--captures");
const chrome = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  process.env.PROGRAMFILES &&
    join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  ...process.env.PATH.split(delimiter).flatMap((dir) =>
    ["chromium", "chromium-browser", "google-chrome"].map((name) =>
      join(dir, name),
    ),
  ),
].find((path) => path && existsSync(path));
if (!chrome) throw Error("Set CHROME_BIN to a Chrome or Chromium executable.");
const profile = await mkdtemp(join(tmpdir(), "starlight-test-"));
const browser = spawn(
  chrome,
  [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-pipe",
    "--disable-extensions",
    "--user-data-dir=" + profile,
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] },
);
const closed = new Promise((resolve) => browser.once("close", resolve));
const pending = new Map(),
  errors = [];
let session,
  sequence = 0,
  buffer = "";
browser.stdio[4].setEncoding("utf8");
browser.stdio[4].on("data", (chunk) => {
  buffer += chunk;
  let cut;
  while ((cut = buffer.indexOf("\0")) !== -1) {
    const message = JSON.parse(buffer.slice(0, cut));
    buffer = buffer.slice(cut + 1);
    if (message.method === "Runtime.exceptionThrown")
      errors.push(
        message.params.exceptionDetails.exception?.description ||
          message.params.exceptionDetails.text,
      );
    const reply = pending.get(message.id);
    if (reply) {
      pending.delete(message.id);
      reply(message);
    }
  }
});
function command(method, params = {}, target = session) {
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(Error("Timed out waiting for " + method));
    }, 18000);
    pending.set(id, (message) => {
      clearTimeout(timeout);
      if (message.error) reject(Error(message.error.message));
      else resolve(message.result);
    });
    browser.stdio[3].write(
      JSON.stringify({ id, method, params, sessionId: target }) + "\0",
    );
  });
}
async function evaluate(fn, arg = null) {
  const expression =
    typeof fn === "string"
      ? fn
      : "(" + fn.toString() + ")(" + JSON.stringify(arg) + ")";
  const response = await command("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails)
    throw Error(
      response.exceptionDetails.exception?.description ||
        response.exceptionDetails.text,
    );
  return response.result.value;
}
async function ready(expr) {
  for (let i = 0; i < 120; i++) {
    if (await evaluate(expr)) return;
    await delay(50);
  }
  throw Error("Game did not reach " + expr);
}
async function viewport(width, height, mobile = false) {
  await command("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
}
async function key(key, code) {
  for (const type of ["keyDown", "keyUp"])
    await command("Input.dispatchKeyEvent", { type, key, code });
}
async function point(id) {
  return evaluate((id) => {
    render();
    const r = regions.find((r) => r.id === id);
    if (!r) throw Error("Missing control " + id);
    return { x: (r.x + r.w / 2) * scale, y: (r.y + r.h / 2) * scale - scrollY };
  }, id);
}
async function screenshot(name) {
  if (!capture) return;
  await evaluate("render()");
  const { data } = await command("Page.captureScreenshot", { format: "png" });
  await writeFile(join(captureDir, name + ".png"), Buffer.from(data, "base64"));
}
try {
  const { targetId } = await command("Target.createTarget", {
    url: "about:blank",
  });
  ({ sessionId: session } = await command("Target.attachToTarget", {
    targetId,
    flatten: true,
  }));
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Network.enable");
  await command("Network.setBlockedURLs", {
    urls: ["*://fonts.googleapis.com/*", "*://fonts.gstatic.com/*"],
  });
  await viewport(1280, 800);
  await command("Page.navigate", { url: gameUrl.href });
  await ready('typeof screenDescription==="function" && regions.length>0');
  if (capture) await mkdir(captureDir, { recursive: true });

  await key("Enter", "Enter");
  await ready('screen==="play" && game.n===0');
  await ready('document.querySelector("[data-action=fire]") !== null');
  await key("i", "KeyI");
  assert.match(
    await evaluate('document.querySelector("#announcer").textContent'),
    /sun/i,
  );
  await key(" ", "Space");
  assert.ok(await evaluate("game.active"));
  await key("f", "KeyF");
  assert.ok(await evaluate("game.fast"));
  await key("Escape", "Escape");
  await ready('modal==="pause"');
  const frozen = await evaluate("game.time");
  await delay(160);
  assert.equal(await evaluate("game.time"), frozen);
  assert.equal(
    await evaluate(
      'document.querySelector("#access").getAttribute("aria-modal")',
    ),
    "true",
  );
  console.log("Keyboard aiming, firing, shot speed and pause passed offline.");

  await viewport(390, 844, true);
  await command("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 1,
  });
  await evaluate("playing=false;start(false);render()");
  async function touch(type, where) {
    await command("Input.dispatchTouchEvent", {
      type,
      touchPoints: where ? [where] : [],
    });
  }
  const initial = await evaluate("game.angle");
  await touch("touchStart", { x: 175, y: 360 });
  await touch("touchMove", { x: 245, y: 391 });
  await touch("touchEnd");
  assert.notEqual(await evaluate("game.angle"), initial);
  assert.equal(await evaluate("game.shots"), 0);
  await touch("touchStart", await point("fire"));
  await touch("touchEnd");
  assert.equal(await evaluate("game.shots"), 1);
  const pearl = await evaluate("game.balls[0]");
  await viewport(844, 390, true);
  await evaluate("resize();render()");
  assert.deepEqual(await evaluate("game.balls[0]"), pearl);

  if (capture) {
    // Capture the stage as distributed online after first verifying the
    // downloaded version can start and play with external fonts blocked.
    await command("Network.setBlockedURLs", { urls: [] });
    await command("Page.reload", { ignoreCache: true });
    await ready('typeof render==="function" && regions.length>0');
    await evaluate("document.fonts.ready");
    await viewport(1440, 900);
    await evaluate('playing=false;go("title");render()');
    await screenshot("title");
  }
  await viewport(1440, 900);
  await command("Emulation.setTouchEmulationEnabled", { enabled: false });
  await evaluate("openMap(0);mapScroll=0;render();window.captured=new Map();");
  await screenshot("campaign-map");
  const routes = JSON.parse(
    await readFile(
      new URL("./fixtures/three-star-routes.json", import.meta.url),
    ),
  );
  for (const route of routes) {
    const n = route.mission - 1;
    await evaluate((n) => {
      if (unlocked() !== n) throw Error("Broken campaign link " + n);
      mode = 0;
      chosen = n;
      hero = Math.floor(n / 5);
      start(false);
      render();
    }, n);
    if (n % 5 === 4) await screenshot("world-" + (Math.floor(n / 5) + 1));
    const result = await evaluate(
      ({ launches, capture }) => {
        const g = game;
        function remember(name) {
          if (capture && !captured.has(name))
            captured.set(name, {
              g: structuredClone(g),
              particles: structuredClone(particles),
              clock,
            });
        }
        for (const [angle, wait] of launches) {
          while (g.settle > 0) step(g, DT);
          for (let i = 0; i < wait; i++) step(g, DT);
          g.angle = angle;
          if (g.h === 0 && g.power > 0) remember("power-1");
          if (!shoot(g)) throw Error("Launch refused");
          let ticks = 0;
          while (g.active && ticks++ < 10000) {
            step(g, DT);
            ageParticles(particles, DT);
            clock += DT;
            if (g.h === 1 && g.power && g.balls.some((b) => b.y > 330))
              remember("power-2");
            if (
              g.h === 2 &&
              g.balls.length >= 3 &&
              g.balls.every((b) => b.age > 0.17)
            ) {
              remember("power-3");
              remember("multiball");
            }
            if (g.h === 3 && g.power && g.balls.some((b) => b.y > 495))
              remember("power-4");
            if (g.h === 4 && g.ring?.t > 0.19 && g.ring.t < 0.3)
              remember("power-5");
            if (g.h === 5 && g.balls.some((b) => b.pierce > 0 && b.y > 130))
              remember("power-6");
            if (g.h === 6 && g.power && g.balls.some((b) => b.y > 450))
              remember("power-7");
            if (g.h === 7 && g.linked.length >= 3) remember("power-8");
            if (g.n === 39 && !g.final && litLanternPanes(g))
              remember("lantern-rekindled");
            if (
              g.catchAt &&
              g.time - g.catchAt > 0.08 &&
              g.time - g.catchAt < 0.3 &&
              !g.final
            )
              remember("bucket-catch");
            if (
              g.n === 39 &&
              g.final &&
              g.balls.length &&
              g.time - g.finalAt > 0.24
            )
              remember("finale");
          }
          if (g.active) throw Error("Unsettled pearl");
        }
        return [g.final, g.score, save.stars[g.n]];
      },
      { launches: route.launches, capture },
    );
    assert.deepEqual(result, [true, route.score, 3], "Mission " + (n + 1));
    if (n === 4) await screenshot("comet-restoration");
  }
  await screenshot("ending");
  const stored = await evaluate('localStorage.getItem("starlight.v1")');
  await evaluate("openEncore();seekEncore(encore.source.ticks*.56|0);render()");
  await screenshot("encore");
  await evaluate("seekEncore(encore.source.ticks);closeEncore();render()");
  assert.equal(await evaluate('localStorage.getItem("starlight.v1")'), stored);
  await evaluate("openReceipt()");
  await screenshot("score-receipt");
  if (capture) {
    const names = await evaluate("[...captured.keys()]");
    assert.equal(names.length, 12);
    for (const name of names) {
      await evaluate((name) => {
        const frame = captured.get(name);
        game = frame.g;
        clock = frame.clock;
        particles.forEach((p, i) => Object.assign(p, frame.particles[i]));
        modal = "";
        screen = "play";
      }, name);
      await screenshot(name);
    }
    await evaluate('modal="settings";settingsTab="display"');
    await screenshot("settings-display");
    await evaluate('settingsTab="audio"');
    await screenshot("settings-audio");
    await evaluate('modal="";openMap(0);souvenirWorld=5;modal="souvenir"');
    await screenshot("restoration-postcard");
  }
  assert.deepEqual(errors, []);
  console.log(
    "All 40 three-star routes, campaign unlocks, mobile controls, resize and final-shot replay passed.",
  );
  if (capture) console.log("Screenshots saved to " + captureDir);
} finally {
  browser.kill();
  await closed;
  await rm(profile, { recursive: true, force: true, maxRetries: 3 });
}
