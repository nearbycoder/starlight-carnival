import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadGame, memoryStorage, takeShot } from "./support/game.mjs";

const routes = JSON.parse(
  readFileSync(new URL("./fixtures/three-star-routes.json", import.meta.url)),
);
const points = (g) =>
  g.pegPoints +
  50 * g.banks +
  125 * g.distant +
  100 * g.chainMilestones +
  350 * g.catches +
  g.pocket;

test("all 40 authored boards have clear moving geometry and reproducible seeded casts", () => {
  const a = loadGame();
  assert.equal(a.titles.length, 40);
  assert.equal(new Set(a.titles).size, 40);
  const layouts = new Set();
  for (let n = 0; n < 40; n++) {
    const { p, o } = a.board(n),
      expected = a.assignments[n].map((group) => group.length);
    const counts = (ps) =>
      ["o", "g", "s"].map((type) => ps.filter((q) => q.type === type).length);
    assert.deepEqual(counts(p), expected);
    assert.ok(expected[0] && expected[1]);
    layouts.add(JSON.stringify(p.map((q) => [q.bx, q.by])));
    for (const seed of [0, 1, 73921, 4294967295]) {
      const seeded = a.board(n, seed).p;
      assert.deepEqual(counts(seeded), expected);
      assert.deepEqual(
        seeded.map((q) => q.type),
        a.board(n, seed).p.map((q) => q.type),
      );
      assert.deepEqual(
        seeded.map((q) => [q.bx, q.by, q.hx, q.r]),
        p.map((q) => [q.bx, q.by, q.hx, q.r]),
      );
    }
    for (let phase = 0; phase < 164; phase++) {
      for (const q of [...p, ...o]) a.moveObj(q, phase * 0.269);
      for (let i = 0; i < p.length; i++) {
        const q = p[i];
        assert.ok(
          q.x - q.hx - q.r >= 0 &&
            q.x + q.hx + q.r <= 600 &&
            q.y - q.r > 42 &&
            q.y + q.r < 605,
        );
        // A standard pearl needs room between the underside of the lowest
        // moving peg and Juniper's bridge, including near either tip.
        if (q.y > 510)
          for (let x = 149; x <= 451; x += 3) {
            const dx = Math.max(0, Math.abs(x - q.x) - q.hx),
              reach = q.r + 14;
            if (dx <= reach)
              assert.ok(
                a.vineY(x) - q.y - q.hy - Math.sqrt(reach ** 2 - dx ** 2) > 1,
                a.titles[n] + " leaves no pearl-width gap above the vine",
              );
          }
        for (const other of [...p.slice(i + 1), ...o]) {
          const dx = Math.max(0, Math.abs(q.x - other.x) - q.hx - other.hx);
          const dy = Math.max(0, Math.abs(q.y - other.y) - q.hy - other.hy);
          assert.ok(
            Math.hypot(dx, dy) >= q.r + other.r - 0.1,
            a.titles[n] +
              " overlap " +
              q.id +
              "/" +
              other.id +
              " at phase " +
              phase,
          );
        }
      }
    }
  }
  assert.equal(layouts.size, 40);
});

test("every campaign ticket earns all three medals by launching ordinary shots", () => {
  const storage = memoryStorage(),
    a = loadGame(storage);
  assert.equal(routes.length, 40);
  a.enableProgress();
  for (const route of routes) {
    const n = route.mission - 1;
    assert.equal(a.unlocked(), n);
    const g = a.enter(n, Math.floor(n / 5));
    for (const [angle, wait] of route.launches) {
      assert.ok(!g.finished);
      takeShot(a, g, angle, wait);
      assert.equal(g.score, points(g), a.titles[n] + " receipt");
    }
    assert.equal(g.shots, route.launches.length);
    assert.equal(g.score, route.score, a.titles[n]);
    assert.equal(a.remaining(g), 0);
    assert.ok(g.finished && g.final);
    assert.equal(a.runMedals(g), 7, a.titles[n] + " tickets");
    assert.equal(a.missionMedals(n), 7);
    assert.equal(a.resumeTicket(), null);
  }
  const loaded = loadGame(storage);
  assert.deepEqual(loaded.save.stars, Array(40).fill(3));
  assert.equal(loaded.unlocked(), 39);
});

test("a settled Adventure shot resumes with its score, power, objects and moving phase", () => {
  for (const n of [0, 9, 14, 19, 24, 29, 34, 39]) {
    const storage = memoryStorage(),
      a = loadGame(storage);
    for (let i = 0; i < n; i++) a.save.stars[i] = 1;
    a.persist();
    const route = routes[n].launches;
    const g = a.enter(n, Math.floor(n / 5));
    takeShot(a, g, ...route[0]);
    const second = loadGame(storage),
      continued = second.enter(n, Math.floor(n / 5), 0, true);
    assert.equal(continued.shots, 1);
    assert.equal(continued.time, g.time);
    assert.equal(continued.stock, g.stock);
    assert.equal(continued.score, g.score);
    assert.equal(continued.power, g.power);
    assert.equal(continued.bestFormation, g.bestFormation);
    assert.deepEqual(continued.linked, g.linked);
    for (const launch of route.slice(1)) {
      takeShot(a, g, ...launch);
      takeShot(second, continued, ...launch);
      assert.deepEqual(
        [continued.score, continued.stock, continued.time, continued.final],
        [g.score, g.stock, g.time, g.final],
      );
    }
  }
});

test("legacy medals, separately earned ribbons and settings survive writes from two tabs", () => {
  const storage = memoryStorage();
  storage.setItem(
    "starlight.v1",
    JSON.stringify({ stars: [2, 2], best: [4000, 300], sound: false }),
  );
  const a = loadGame(storage),
    b = loadGame(storage);
  assert.equal(a.missionMedals(0), 3);
  assert.equal(a.missionMedals(1), 5);
  a.save.quality = "low";
  a.save.medals[2] = 3;
  a.save.stars[2] = 2;
  a.save.best[2] = 15900;
  a.persist();
  b.save.effects = 0.25;
  b.save.medals[2] = 5;
  b.save.stars[2] = 2;
  b.save.best[2] = 1300;
  b.persist();
  const c = loadGame(storage);
  assert.equal(c.missionMedals(2), 7);
  assert.equal(c.save.best[2], 15900);
  assert.equal(c.save.quality, "low");
  assert.equal(c.save.effects, 0.25);
  assert.deepEqual(c.save.stars.slice(0, 3), [2, 2, 3]);
});

test("bad storage and incomplete tickets fall back to a playable board", () => {
  const storage = memoryStorage();
  storage.setItem("starlight.v1", "{");
  storage.setItem(
    "starlight.intermission.v1",
    '{"n":0,"version":1,"h":0,"run":"cut"}',
  );
  for (const source of [
    storage,
    {
      getItem() {
        throw Error("disabled");
      },
      setItem() {
        throw Error("disabled");
      },
    },
  ]) {
    const a = loadGame(source);
    assert.equal(a.unlocked(), 0);
    assert.equal(a.resumeTicket(), null);
    assert.equal(a.save.sound, false);
    const g = a.enter(0, 0, 0, true);
    takeShot(a, g, 0.28);
    assert.ok(g.score >= 0);
    assert.doesNotThrow(a.persist);
  }
});

test("the six-ball scorebook keeps five real runs per mission across tabs and isolated modes", () => {
  const storage = memoryStorage();
  storage.setItem("starlight.v1", JSON.stringify({ attack: [940] }));
  const tabs = [loadGame(storage), loadGame(storage)];
  const runs = [{ id: "legacy", score: 940 }];
  for (let i = 0; i < 8; i++) {
    const a = tabs[i % 2],
      g = a.enter(0, i, 2);
    assert.equal(g.stock, 6);
    const previous = Math.max(...runs.map((r) => r.score));
    for (let j = 0; !g.finished && j < 28; j++)
      takeShot(a, g, -1.28 + ((i * 13 + j * 7) % 31) * 0.084);
    assert.ok(g.finished);
    assert.equal(g.previousBest, previous);
    assert.equal(g.record, g.score > previous);
    assert.match(
      a.screenDescription(),
      /Local best \d+\. Best shot \d+ points\. Best chain/,
    );
    assert.doesNotMatch(a.screenDescription(), /stars this run/);
    runs.push({ id: g.run, score: g.score });
  }
  const a = loadGame(storage);
  const expected = runs
    .map((r) => r.score)
    .sort((a, b) => b - a)
    .slice(0, 5);
  assert.deepEqual(
    a.save.ranks[0].map((r) => r.score),
    expected,
  );
  assert.equal(a.save.attack[0], expected[0]);
  assert.ok(a.save.ranks.slice(1).every((rows) => rows.length === 0));
  assert.ok(a.save.stars.every((n) => n === 0));
  for (const mode of [1, 3]) {
    const g = a.enter(0, 0, mode);
    for (let i = 0; !g.finished && i < 28; i++)
      takeShot(a, g, Math.sin(i) * 1.29);
    assert.ok(g.finished);
  }
  const loaded = loadGame(storage);
  assert.deepEqual(loaded.save.ranks, a.save.ranks);
  assert.equal(loaded.resumeTicket(), null);
});

test("each pane of the Last Lantern lights its own part of the midway", () => {
  const a = loadGame();
  for (const order of [
    [0, 2, 1],
    [2, 1, 0],
  ]) {
    const g = a.fresh(39, 7, 0);
    a.shoot(g);
    let mask = 0;
    assert.equal(a.litLanternPanes(g), mask);
    for (const pane of order) {
      const suns = g.p.filter(
        (q) => q.type === "o" && a.lanternPane(q) === pane,
      );
      assert.ok(suns.length);
      for (const sun of suns.slice(0, -1)) a.hit(g, sun);
      assert.equal(a.litLanternPanes(g), mask);
      a.hit(g, suns.at(-1));
      mask |= 1 << pane;
      assert.equal(a.litLanternPanes(g), mask);
      assert.equal(g.final, mask === 7);
    }
  }
});

test("formation objectives start over on launch and retain the best single shot", () => {
  const a = loadGame();
  const ribbon = a.fresh(1, 0, 0);
  a.shoot(ribbon);
  for (const id of [0, 1, 17, 18]) a.hit(ribbon, ribbon.p[id]);
  assert.equal(a.objectiveValue(ribbon), 2);
  ribbon.active = false;
  a.shoot(ribbon);
  for (const id of [2, 3, 4]) a.hit(ribbon, ribbon.p[id]);
  assert.equal(a.objectiveValue(ribbon), 3);
  assert.ok(!a.goalMet(ribbon));
  a.hit(ribbon, ribbon.p[5]);
  assert.ok(a.goalMet(ribbon));
  const boats = a.fresh(19, 3, 0);
  a.shoot(boats);
  for (const id of [0, 1, 2]) a.hit(boats, boats.p[id]);
  assert.equal(a.objectiveValue(boats), 1);
  a.hit(boats, boats.p[19]);
  assert.ok(a.goalMet(boats));
  const pendulum = a.fresh(7, 1, 0);
  a.shoot(pendulum);
  const pearl = pendulum.balls[0],
    suns = pendulum.p.filter((q) => q.type === "o");
  a.hit(pendulum, suns[0], pearl);
  assert.ok(!a.goalMet(pendulum));
  pearl.touchedPendulum = true;
  a.hit(pendulum, suns[1], pearl);
  assert.ok(a.goalMet(pendulum));
  const free = a.fresh(0, 0, 1);
  free.unlimited = true;
  assert.ok(!a.goalMet(free));
});

test("a shared seed of zero retains its target assignments and performer", () => {
  const a = loadGame();
  const g = a.fresh(13, 3, 3, 0),
    u = new URL(a.challengeLink(g));
  assert.deepEqual(Object.fromEntries(u.searchParams), {
    mode: "seeded",
    mission: "14",
    seed: "0",
    performer: "nori",
  });
  const other = a.fresh(
    Number(u.searchParams.get("mission")) - 1,
    3,
    3,
    Number(u.searchParams.get("seed")),
  );
  assert.deepEqual(g.p, other.p);
});
