(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.YouTubePlayerErrors = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MESSAGES = {
    2: "YouTube menolak permintaan ini karena ID video atau parameter tidak valid. Periksa tautan lalu muat kembali.",
    5: "Video tidak dapat diputar oleh pemutar HTML5 saat ini. Coba perbarui browser atau muat ulang video.",
    100: "Video tidak tersedia. Video mungkin privat, telah dihapus, atau tidak dapat ditemukan.",
    101: "Pemilik video menonaktifkan pemutaran di situs lain. Coba buka video langsung di YouTube.",
    150: "Pemilik video menonaktifkan pemutaran di situs lain. Coba buka video langsung di YouTube.",
    153: "YouTube tidak menerima identitas/referrer untuk pemutar ini. Buka website melalui HTTP/HTTPS lalu coba lagi."
  };

  function getMessage(code) {
    const normalizedCode = Number(code);
    return MESSAGES[normalizedCode]
      || `YouTube tidak dapat memutar video ini (kode ${String(code)}). Periksa koneksi atau coba video lain.`;
  }

  return { getMessage };
});
