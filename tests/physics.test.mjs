import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGame, takeShot } from "./support/game.mjs";

test("the dotted guide predicts actual contact with static and moving surfaces", () => {
  const a = loadGame();
  for (let n = 0; n < 40; n++)
    for (const extended of [false, true])
      for (const angle of [-1.27, -0.74, -0.21, 0.15, 0.69, 1.31]) {
        const g = a.fresh(n, 0, 0);
        for (let j = 0; j < 97; j++) a.step(g, a.DT);
        g.angle = angle;
        if (extended) g.power = 3;
        const before = structuredClone(g),
          predicted = a.preview(g);
        assert.deepEqual(g, before, "forecast changed the live stage");
        assert.ok(predicted.marks.length <= (extended ? 3 : 1));
        a.shoot(g);
        const b = g.balls[0];
        b.contactMarks = [];
        for (
          let j = 0;
          j < (extended ? 520 : 210) &&
          g.active &&
          b.contactMarks.length < (extended ? 3 : 1);
          j++
        )
          a.step(g, a.DT);
        const actual = b.contactMarks.slice(0, extended ? 3 : 1);
        assert.equal(
          actual.length,
          predicted.marks.length,
          a.titles[n] + " contact count",
        );
        actual.forEach((mark, i) =>
          mark.forEach((v, j) =>
            assert.ok(
              Math.abs(v - predicted.marks[i][j]) < 0.001,
              a.titles[n] + " contact " + i,
            ),
          ),
        );
      }
});

test("high-speed pearls rebound off thin bricks and moving bumpers transfer their velocity", () => {
  const a = loadGame();
  const shape = {
    x: 200,
    y: 200,
    bx: 200,
    by: 200,
    r: 5,
    hx: 30,
    hy: 0,
    perm: true,
  };
  const b = a.newBall(202, 143, 0, 1400);
  const hit = a.collision(b, shape, 0, 0.09);
  assert.ok(hit && hit.at > 0 && hit.at < 0.09);
  assert.equal(hit.ny, -1);
  const still = a.newBall(250, 200, -490, 0);
  const moving = { ...shape, vx: 125, vy: 0 };
  const impact = a.collision(still, moving, 0, 0.04);
  assert.ok(impact && impact.nx === 1);
  const bounce = (q) => {
    const g = a.fresh(0, 0, 0);
    g.p = [];
    g.o = [q];
    const ball = a.newBall(243, 200, -490, 0);
    a.flight(g, ball, a.DT, true);
    return ball.vx;
  };
  assert.ok(bounce(moving) > bounce(shape) + 85);
});

test("each performer changes the shot by the advertised amount", () => {
  const a = loadGame();
  // Pip grants exactly three extended launches after the power shot.
  const sight = a.fresh(10, 0, 1);
  a.activate(
    sight,
    sight.p.find((p) => p.type === "g"),
  );
  sight.p.forEach((q) => {
    if (q.type === "g") q.type = "b";
  });
  for (const expected of [2, 1, 0]) {
    let angle;
    for (const value of [-1.3, -0.9, -0.4, 0.23, 0.8, 1.29]) {
      sight.angle = value;
      if (a.preview(sight).marks.length > 1) {
        angle = value;
        break;
      }
    }
    assert.ok(Number.isFinite(angle));
    takeShot(a, sight, angle);
    assert.equal(sight.power, expected);
  }
  assert.ok(a.preview(sight).marks.length <= 1);
  const basket = a.fresh(0, 1, 1);
  basket.active = true;
  a.activate(basket, basket.p[0]);
  assert.equal(a.basketW(basket), 174);
  for (const expected of [2, 1, 0]) {
    basket.active = true;
    basket.balls = [a.newBall(25, 629, 0, 22)];
    a.step(basket, a.DT);
    assert.equal(basket.power, expected);
    assert.equal(a.basketW(basket), expected ? 174 : 87);
  }
  const split = a.fresh(12, 2, 1);
  a.shoot(split);
  a.activate(split, split.p[6], split.balls[0]);
  assert.equal(split.balls.length, 3);
  split.balls[0].y = 632;
  a.step(split, a.DT);
  assert.equal(split.balls.length, 2);
  assert.ok(split.active);
  const water = a.fresh(15, 3, 1);
  a.shoot(water);
  a.activate(water, water.p[16]);
  const swimmer = water.balls[0];
  Object.assign(swimmer, { x: 31, y: 568, vx: 0, vy: 150 });
  a.step(water, a.DT);
  assert.ok(swimmer.vy < 0 && swimmer.rescued);
  Object.assign(swimmer, { x: 31, y: 568, vx: 0, vy: 150 });
  a.step(water, a.DT);
  assert.ok(swimmer.vy > 0);
  const echo = a.fresh(20, 4, 1),
    emitter = echo.p.find((q) => q.type === "g");
  echo.active = true;
  echo.balls = [];
  a.hit(echo, emitter);
  const near = echo.p.filter(
    (q) => Math.hypot(q.x - emitter.x, q.y - emitter.y) < 100,
  );
  const far = echo.p.find(
    (q) => q.type === "b" && Math.hypot(q.x - emitter.x, q.y - emitter.y) > 245,
  );
  a.step(echo, a.DT);
  assert.ok(echo.active, "pulse must finish after the last pearl drains");
  while (echo.active) a.step(echo, a.DT);
  assert.ok(near.every((q) => q.gone));
  assert.ok(!far.gone);
  const meteor = a.fresh(25, 5, 1);
  a.activate(meteor, meteor.p[32]);
  a.shoot(meteor);
  assert.equal(meteor.balls[0].r, 12);
  assert.equal(meteor.balls[0].pierce, 6);
  assert.equal(meteor.power, 0);
  const lane = meteor.p.slice(0, 7).map((q, i) => ({
    ...q,
    id: i,
    x: 300,
    bx: 300,
    y: 105 + i * 60,
    by: 105 + i * 60,
    type: "b",
  }));
  meteor.p = lane;
  meteor.o = [];
  const heavy = meteor.balls[0];
  Object.assign(heavy, { x: 300, y: 75, vx: 0, vy: 360 });
  let sixth = false;
  for (let j = 0; j < 360 && !lane[6].hit; j++) {
    a.step(meteor, a.DT);
    if (heavy.pierced?.size === 6) sixth = true;
  }
  assert.ok(sixth && lane.every((p) => p.hit));
  assert.equal(heavy.pierce, 0);
  assert.equal(heavy.r, 7);
  assert.ok(heavy.vy < 0);
  const garden = a.fresh(30, 6, 1);
  a.shoot(garden);
  a.activate(garden, garden.p[6]);
  let bud = garden.balls[0];
  Object.assign(bud, { x: 305, y: a.vineY(305) - 8, vx: 0, vy: 280 });
  a.step(garden, a.DT);
  assert.ok(bud.vy < 0 && garden.vinePluck);
  const link = a.fresh(39, 7, 1);
  a.activate(link, link.p[14]);
  const group = link.linked.slice();
  assert.equal(group.length, 5);
  a.hit(link, link.p[group[2]]);
  assert.equal(link.linked.length, 0);
  assert.equal(link.pegsLit, 5);
  assert.ok(group.every((i) => link.p[i].hit));
});

test("split sparks find clear launch points even on bricks and in tight clusters", () => {
  const a = loadGame();
  for (let n = 0; n < 40; n++)
    for (const time of [0, 1.9, 4.75, 12.3]) {
      const g = a.fresh(n, 2, 1);
      for (const q of [...g.p, ...g.o]) a.moveObj(q, time);
      for (const q of g.p.filter((p) => p.type === "g")) {
        g.balls = [];
        a.activate(g, q);
        assert.equal(g.balls.length, 2);
        for (const b of g.balls) {
          assert.ok(b.x - b.r >= 0 && b.x + b.r <= 600);
          for (const v of [...g.p, ...g.o]) {
            const dx = Math.max(0, Math.abs(b.x - v.x) - v.hx),
              dy = Math.max(0, Math.abs(b.y - v.y) - v.hy);
            assert.ok(
              Math.hypot(dx, dy) >= b.r + v.r - 0.01,
              a.titles[n] + " spark starts inside peg " + v.id,
            );
          }
        }
      }
    }
});

test("final pockets count every pearl, including simultaneous landings, before results", () => {
  const a = loadGame(),
    g = a.fresh(10, 2, 1);
  a.shoot(g);
  const oranges = g.p.filter((q) => q.type === "o");
  oranges.forEach((q) => a.hit(g, q));
  assert.ok(g.final && g.active && !g.finished);
  const before = g.score;
  g.balls = [
    a.newBall(35, 629, 0, 50),
    a.newBall(303, 630, 0, 55),
    a.newBall(475, 410, 0, 2),
  ];
  a.step(g, a.DT);
  assert.ok(!g.finished);
  assert.deepEqual(g.pockets, [1, 0, 1, 0, 0]);
  g.balls[0].x = 422;
  g.balls[0].y = 630;
  a.step(g, a.DT);
  assert.ok(g.finished && !g.active);
  assert.deepEqual(g.pockets, [1, 0, 1, 1, 0]);
  assert.equal(g.pocket, 8500);
  assert.equal(g.score, before + 8500);
  assert.equal(g.extraBalls, 1);
  assert.equal(g.catches, 0);
});

test("a house return and its recovery probes cannot award false points or catches", () => {
  const a = loadGame(),
    g = a.fresh(6, 1, 1);
  a.shoot(g);
  const b = g.balls[0];
  const before = g.score;
  a.releasePearl(g, b);
  assert.equal(g.score, before);
  assert.equal(g.pegsLit, 0);
  Object.assign(b, { x: 295, y: 120, age: 33, lastPegAge: 0, vx: 0, vy: 0 });
  const stock = g.stock;
  a.step(g, a.DT);
  assert.ok(b.recallAt !== undefined);
  for (let i = 0; i < 45 && g.active; i++) a.step(g, a.DT);
  assert.equal(g.stock, stock + 1);
  assert.equal(g.score, before);
  assert.equal(g.catches, 0);
  assert.equal(g.pocket, 0);
});

test("Juniper's vine rolls repeated coral rebounds clear of the drain without a house return", () => {
  const a = loadGame(),
    g = a.fresh(17, 6, 2);
  takeShot(a, g, 0.9797042948752641, 127);
  const start = g.time;
  takeShot(a, g, 1.2655633194884284, 37);
  assert.equal(g.houseReturns || 0, 0);
  assert.ok(g.time - start < 19);
  assert.ok(!g.active);
});

test("each linked sun uses the multiplier earned by the preceding sun", () => {
  const a = loadGame();
  const linked = a.fresh(35, 7, 0),
    separate = structuredClone(linked);
  const targets = linked.p.filter((q) => q.type === "o").map((q) => q.id);
  // Light one target before the link, crossing a multiplier boundary inside it.
  a.hit(linked, linked.p[targets[0]]);
  a.hit(separate, separate.p[targets[0]]);
  linked.linked = targets.slice(1);
  a.hit(linked, linked.p[targets[1]]);
  for (const id of targets.slice(1)) a.hit(separate, separate.p[id]);
  assert.equal(linked.score, separate.score);
  assert.equal(linked.pegPoints, separate.pegPoints);
  assert.equal(linked.mult, 5);
  assert.ok(linked.final);
});
