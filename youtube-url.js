(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.YouTubeUrlParser = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
  const YOUTUBE_HOST_PATTERN = /^(?:(?:www|m|music)\.)?youtube\.com$/i;
  const NOCOOKIE_HOST_PATTERN = /^(?:www\.)?youtube-nocookie\.com$/i;
  const SHORT_HOST_PATTERN = /^(?:www\.)?youtu\.be$/i;

  function failure(message) {
    return { ok: false, error: message };
  }

  function decodeSegment(segment) {
    try {
      return decodeURIComponent(segment);
    } catch (_error) {
      return segment;
    }
  }

  function parseYouTubeUrl(value) {
    if (typeof value !== "string" || value.trim() === "") {
      return failure("Masukkan URL video YouTube terlebih dahulu.");
    }

    const input = value.trim();
    if (input.length > 2048) {
      return failure("URL terlalu panjang. Periksa kembali tautan YouTube-mu.");
    }

    // Memudahkan input tanpa skema, misalnya youtube.com/watch?v=...
    const normalizedInput = input.startsWith("//")
      ? `https:${input}`
      : /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(input)
        ? input
        : `https://${input}`;

    let url;
    try {
      url = new URL(normalizedInput);
    } catch (_error) {
      return failure("Format URL tidak dikenali. Masukkan tautan YouTube yang valid.");
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return failure("Gunakan tautan YouTube dengan protokol http:// atau https://.");
    }
    if (url.username || url.password || url.port) {
      return failure("URL tersebut bukan tautan YouTube standar yang valid.");
    }

    const hostname = url.hostname.toLowerCase();
    const isShortLink = SHORT_HOST_PATTERN.test(hostname);
    const isYouTube = YOUTUBE_HOST_PATTERN.test(hostname);
    const isNoCookie = NOCOOKIE_HOST_PATTERN.test(hostname);
    if (!isShortLink && !isYouTube && !isNoCookie) {
      return failure("Domain tidak didukung. Gunakan youtube.com, youtu.be, atau URL embed YouTube.");
    }

    const segments = url.pathname.split("/").filter(Boolean).map(decodeSegment);
    let videoId = "";

    if (isShortLink) {
      videoId = segments[0] || "";
    } else if (isNoCookie) {
      if (segments[0] === "embed") videoId = segments[1] || "";
    } else if (segments[0] === "watch" || url.pathname === "/watch/") {
      videoId = url.searchParams.get("v") || "";
    } else if (["embed", "shorts", "live", "v", "e"].includes(segments[0])) {
      videoId = segments[1] || "";
    }

    if (!videoId) {
      return failure("URL YouTube harus mengarah ke halaman video, tautan pendek, atau URL embed.");
    }
    if (!VIDEO_ID_PATTERN.test(videoId)) {
      return failure("ID video pada URL tidak valid. Periksa kembali tautan YouTube-mu.");
    }

    return {
      ok: true,
      videoId,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`
    };
  }

  return { parseYouTubeUrl };
});
