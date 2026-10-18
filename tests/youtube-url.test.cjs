const test = require("node:test");
const assert = require("node:assert/strict");
const { parseYouTubeUrl } = require("../youtube-url.js");

const videoId = "dQw4w9WgXcQ";

test("menerima URL watch standar dan parameter tambahan", () => {
  const result = parseYouTubeUrl(`https://www.youtube.com/watch?v=${videoId}&t=30s&feature=share`);
  assert.equal(result.ok, true);
  assert.equal(result.videoId, videoId);
  assert.equal(result.canonicalUrl, `https://www.youtube.com/watch?v=${videoId}`);
});

test("menerima domain YouTube tanpa www dan skema yang dihilangkan", () => {
  const result = parseYouTubeUrl(`youtube.com/watch?v=${videoId}`);
  assert.equal(result.ok, true);
  assert.equal(result.videoId, videoId);
});

test("menerima youtu.be dengan parameter pelacakan", () => {
  const result = parseYouTubeUrl(`https://youtu.be/${videoId}?si=share-code`);
  assert.equal(result.ok, true);
  assert.equal(result.videoId, videoId);
});

test("menerima URL embed resmi dan youtube-nocookie", () => {
  assert.equal(parseYouTubeUrl(`https://www.youtube.com/embed/${videoId}?start=12`).videoId, videoId);
  assert.equal(parseYouTubeUrl(`https://www.youtube-nocookie.com/embed/${videoId}`).videoId, videoId);
});

test("menerima jalur Shorts, Live, dan mobile YouTube", () => {
  assert.equal(parseYouTubeUrl(`https://youtube.com/shorts/${videoId}`).videoId, videoId);
  assert.equal(parseYouTubeUrl(`https://m.youtube.com/live/${videoId}`).videoId, videoId);
});

test("menolak input kosong dan domain yang bukan YouTube", () => {
  assert.equal(parseYouTubeUrl("").ok, false);
  assert.match(parseYouTubeUrl(`https://youtube.com.attacker.example/watch?v=${videoId}`).error, /Domain tidak didukung/);
  assert.match(parseYouTubeUrl(`https://youtu.be.attacker.example/${videoId}`).error, /Domain tidak didukung/);
});

test("menolak protokol non-HTTP, kredensial URL, dan port khusus", () => {
  assert.equal(parseYouTubeUrl(`javascript://youtube.com/watch?v=${videoId}`).ok, false);
  assert.equal(parseYouTubeUrl(`https://user:pass@youtube.com/watch?v=${videoId}`).ok, false);
  assert.equal(parseYouTubeUrl(`https://youtube.com:8443/watch?v=${videoId}`).ok, false);
});

test("menolak ID video yang hilang atau tidak sesuai format", () => {
  assert.equal(parseYouTubeUrl("https://www.youtube.com/watch").ok, false);
  assert.equal(parseYouTubeUrl("https://youtu.be/not-a-video-id").ok, false);
  assert.equal(parseYouTubeUrl("https://www.youtube.com/channel/UC1234567890").ok, false);
});
