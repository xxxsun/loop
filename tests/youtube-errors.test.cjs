const test = require("node:test");
const assert = require("node:assert/strict");
const { getMessage } = require("../youtube-errors.js");

test("kode 100 menjelaskan video privat, dihapus, atau tidak tersedia", () => {
  assert.match(getMessage(100), /privat/);
  assert.match(getMessage(100), /dihapus/);
});

test("kode 101 dan 150 menjelaskan pembatasan embed", () => {
  assert.match(getMessage(101), /menonaktifkan pemutaran/);
  assert.match(getMessage(150), /menonaktifkan pemutaran/);
});

test("kode 153 memberi arahan terkait origin atau referrer", () => {
  assert.match(getMessage(153), /referrer/);
  assert.match(getMessage(153), /HTTP\/HTTPS/);
});

test("kode pemutar lain dan kode tak dikenal memberi pesan yang berguna", () => {
  assert.match(getMessage(5), /HTML5/);
  assert.match(getMessage(999), /kode 999/);
});
