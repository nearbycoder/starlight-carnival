// Exercise the script shipped to players. Only browser startup and drawing are
// stubbed here. Integration tests can drive the same file in a real browser.
import { readFileSync } from "node:fs";
import { compileFunction } from "node:vm";

const html = readFileSync(
  new URL("../../play/index.html", import.meta.url),
  "utf8",
);
const [, script] = html.match(/<script>([\s\S]+?)<\/script>/);
const bindings = {
  window: { addEventListener() {}, scrollTo() {} },
  innerWidth: 1280,
  innerHeight: 800,
  devicePixelRatio: 1,
  scrollY: 0,
  matchMedia: () => ({ matches: false }),
  requestAnimationFrame() {},
  getComputedStyle: () => ({ getPropertyValue: () => "0" }),
  location: new URL("https://example.test/starlight/play/"),
};
const canvas = {
  getContext: () => ({}),
  addEventListener() {},
  style: {},
  classList: { toggle() {} },
};
const document = {
  querySelector: () => canvas,
  getElementById: () => ({ addEventListener() {} }),
  addEventListener() {},
  fonts: { load: () => Promise.resolve() },
};
export function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}
const factory = compileFunction(
  script +
    `
  quiet = true;
  return {
    fresh, step, shoot, preview, board, moveObj, remaining, newBall,
    powerStatus, releasePearl, hit, addScore, basketW, bucket, vineY,
    finish, activate, collision, flight, missionMedals, runMedals,
    medalCount, goalMet, objectiveValue, resumeTicket, challengeLink,
    screenDescription, lanternPane, litLanternPanes,
    readSave, persist, unlocked, assignments, goals, ballsStart,
    optional, titles, powers, DT, save,
    enableProgress() { quiet = false; },
    enter(mission, performer, ticketMode = 0, resume = false) {
      chosen = mission;
      hero = performer;
      mode = ticketMode;
      quiet = false;
      if (resume) boardEntry(false);
      else start(false);
      return game;
    }
  };`,
  [...Object.keys(bindings), "document", "localStorage"],
);
export function loadGame(storage = memoryStorage()) {
  return factory(...Object.values(bindings), document, storage);
}
export function takeShot(api, g, angle, wait = 0) {
  while (g.settle > 0) api.step(g, api.DT);
  for (let i = 0; i < wait; i++) api.step(g, api.DT);
  g.angle = angle;
  if (!api.shoot(g)) throw Error("Launch refused");
  for (let t = 0; t < 15000 && g.active; t++) api.step(g, api.DT);
  if (g.active) throw Error("Shot never settled in " + api.titles[g.n]);
  return g;
}
