const test = require("node:test");
const assert = require("node:assert/strict");
const { PlaybackController } = require("../playback-controller.js");

function createClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();

  return {
    setTimeoutFn(callback, delay) {
      const id = nextId++;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeoutFn(id) {
      timers.delete(id);
    },
    tick(milliseconds) {
      now += milliseconds;
      while (true) {
        const next = [...timers.entries()]
          .filter(([, timer]) => timer.at <= now)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        timers.delete(next[0]);
        next[1].callback();
      }
    }
  };
}

function createController(mode, clock, calls) {
  let controller;
  controller = new PlaybackController({
    mode,
    delay: 350,
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
    restart: () => calls.restarts.push(controller.mode),
    onFinished: (finishedMode) => calls.finished.push(finishedMode),
    onLoopPending: () => calls.loopPending.push(true)
  });
  return controller;
}

test("mode putar sekali selesai tanpa mulai ulang otomatis", () => {
  const clock = createClock();
  const calls = { restarts: [], finished: [], loopPending: [] };
  const controller = createController("once", clock, calls);

  assert.equal(controller.handleEnded(), "finished");
  clock.tick(1000);
  assert.deepEqual(calls.restarts, []);
  assert.deepEqual(calls.finished, ["once"]);
});

test("mode manual berhenti di akhir dan menyerahkan pemutaran ulang ke pengguna", () => {
  const clock = createClock();
  const calls = { restarts: [], finished: [], loopPending: [] };
  const controller = createController("manual", clock, calls);

  controller.handleEnded();
  clock.tick(1000);
  assert.deepEqual(calls.restarts, []);
  assert.deepEqual(calls.finished, ["manual"]);
});

test("mode loop menjadwalkan satu putaran berikutnya", () => {
  const clock = createClock();
  const calls = { restarts: [], finished: [], loopPending: [] };
  const controller = createController("loop", clock, calls);

  assert.equal(controller.handleEnded(), "loop-pending");
  assert.deepEqual(calls.loopPending, [true]);
  clock.tick(349);
  assert.deepEqual(calls.restarts, []);
  clock.tick(1);
  assert.deepEqual(calls.restarts, ["loop"]);
  assert.deepEqual(calls.finished, []);
});

test("beralih dari loop ke putar sekali saat video berjalan mencegah loop di akhir", () => {
  const clock = createClock();
  const calls = { restarts: [], finished: [], loopPending: [] };
  const controller = createController("loop", clock, calls);

  controller.setMode("once", { isEnded: false });
  controller.handleEnded();
  clock.tick(1000);
  assert.deepEqual(calls.restarts, []);
  assert.deepEqual(calls.finished, ["once"]);
});

test("beralih dari loop ke putar sekali saat selesai membatalkan restart tertunda", () => {
  const clock = createClock();
  const calls = { restarts: [], finished: [], loopPending: [] };
  const controller = createController("loop", clock, calls);

  controller.handleEnded();
  controller.setMode("once", { isEnded: true });
  clock.tick(1000);
  assert.deepEqual(calls.restarts, []);
  assert.deepEqual(calls.finished, ["once"]);
});

test("mengubah mode ke loop ketika video sudah selesai memulai loop", () => {
  const clock = createClock();
  const calls = { restarts: [], finished: [], loopPending: [] };
  const controller = createController("once", clock, calls);

  controller.setMode("loop", { isEnded: true });
  clock.tick(350);
  assert.deepEqual(calls.restarts, ["loop"]);
});

test("reset membatalkan loop yang masih tertunda", () => {
  const clock = createClock();
  const calls = { restarts: [], finished: [], loopPending: [] };
  const controller = createController("loop", clock, calls);

  controller.handleEnded();
  controller.cancelPending();
  clock.tick(1000);
  assert.deepEqual(calls.restarts, []);
});

test("mode yang tidak dikenal ditolak", () => {
  const clock = createClock();
  const calls = { restarts: [], finished: [], loopPending: [] };
  const controller = createController("once", clock, calls);
  assert.throws(() => controller.setMode("repeat-forever"), /tidak didukung/);
});
