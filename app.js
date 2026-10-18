(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const elements = {
    form: $("video-form"),
    urlInput: $("youtube-url"),
    loadButton: $("load-button"),
    inputError: $("input-error"),
    modeDescription: $("mode-description"),
    playerFrame: $("player-frame"),
    status: $("playback-status"),
    statusText: $("status-text"),
    playerMessage: $("player-message"),
    messageText: $("message-text"),
    videoTitle: $("video-title"),
    videoSubtitle: $("video-subtitle"),
    youtubeLink: $("youtube-link"),
    playToggle: $("play-toggle"),
    playToggleLabel: $("play-toggle-label"),
    playIcon: document.querySelector(".icon-play"),
    pauseIcon: document.querySelector(".icon-pause"),
    restartButton: $("restart-button"),
    resetButton: $("reset-button"),
    replayButton: $("replay-button"),
    muteButton: $("mute-button"),
    volumeOnIcon: document.querySelector(".volume-on-icon"),
    volumeOffIcon: document.querySelector(".volume-off-icon"),
    volumeControl: $("volume-control"),
    volumeCaption: $("volume-caption"),
    fullscreenButton: $("fullscreen-button")
  };

  const STORAGE_URL = "vidora:last-url:v1";
  const STORAGE_MODE = "vidora:playback-mode:v1";
  const MODE_DESCRIPTIONS = {
    once: "Video diputar satu kali, lalu berhenti. Tidak ada pemutaran ulang otomatis.",
    loop: "Saat video selesai, pemutar kembali ke awal dan melanjutkan putaran berikutnya.",
    manual: "Video berhenti setelah selesai. Tombol Putar ulang akan tersedia untukmu."
  };
  const STATUS_LABELS = {
    ready: "Siap",
    loading: "Memuat",
    playing: "Sedang diputar",
    paused: "Dijeda",
    looping: "Mengulang",
    ended: "Selesai",
    error: "Gagal"
  };

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (_error) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (_error) {
      // Pemutaran tetap berfungsi bila penyimpanan browser dinonaktifkan.
    }
  }

  function validMode(mode) {
    return window.PlaybackController.MODES.includes(mode);
  }

  let currentMode = readStorage(STORAGE_MODE);
  if (!validMode(currentMode)) currentMode = "once";

  let player = null;
  let playerReady = false;
  let playerGeneration = 0;
  let currentVideoId = "";
  let initialPlayerVideoId = "";
  let currentStatus = "ready";
  let hasPlayerError = false;
  let playerErrorKind = "";
  let networkDisconnected = !navigator.onLine;
  let loadRequestId = 0;
  let playerReadyTimer = null;
  let youtubeApiPromise = null;
  let lastNonZeroVolume = 80;

  function setStatus(state) {
    currentStatus = state;
    elements.status.dataset.state = state;
    elements.statusText.textContent = STATUS_LABELS[state] || "Siap";
  }

  function showMessage(message, kind = "info") {
    elements.messageText.textContent = message;
    elements.playerMessage.dataset.kind = kind;
    elements.playerMessage.setAttribute("role", kind === "error" ? "alert" : "status");
    elements.playerMessage.setAttribute("aria-live", kind === "error" ? "assertive" : "polite");
    elements.playerMessage.hidden = !message;
  }

  function clearMessage() {
    elements.playerMessage.hidden = true;
    elements.messageText.textContent = "";
    delete elements.playerMessage.dataset.kind;
  }

  function showInputError(message) {
    elements.inputError.textContent = message;
    elements.inputError.hidden = false;
    elements.urlInput.setAttribute("aria-invalid", "true");
  }

  function clearInputError() {
    elements.inputError.textContent = "";
    elements.inputError.hidden = true;
    elements.urlInput.removeAttribute("aria-invalid");
  }

  function selectedMode() {
    return currentMode;
  }

  function getPlayerState() {
    if (!player || !playerReady) return null;
    try {
      return player.getPlayerState();
    } catch (_error) {
      return null;
    }
  }

  function getYouTubeStates() {
    return window.YT && window.YT.PlayerState ? window.YT.PlayerState : {};
  }

  function isEnded() {
    const states = getYouTubeStates();
    return getPlayerState() === states.ENDED;
  }

  function updateVideoDetails() {
    if (!currentVideoId) return;

    let title = "Video YouTube";
    if (player && playerReady) {
      try {
        const details = player.getVideoData();
        if (details && typeof details.title === "string" && details.title.trim()) {
          title = details.title.trim();
        }
      } catch (_error) {
        // Judul dapat belum tersedia saat video baru di-cue.
      }
    }

    elements.videoTitle.textContent = title;
    elements.videoSubtitle.textContent = `ID video · ${currentVideoId}`;
    elements.youtubeLink.href = `https://www.youtube.com/watch?v=${encodeURIComponent(currentVideoId)}`;
    elements.youtubeLink.hidden = false;
  }

  function updateVolumeControls() {
    if (!player || !playerReady) return;
    try {
      const volume = Math.max(0, Math.min(100, Number(player.getVolume()) || 0));
      const isMuted = Boolean(player.isMuted()) || volume === 0;
      elements.volumeControl.value = String(volume);
      elements.volumeCaption.textContent = isMuted ? "Suara dibisukan" : `Volume ${volume}%`;
      elements.muteButton.setAttribute("aria-pressed", String(isMuted));
      elements.muteButton.setAttribute("aria-label", isMuted ? "Nyalakan suara" : "Matikan suara");
      elements.muteButton.title = isMuted ? "Nyalakan suara" : "Matikan suara";
      elements.volumeOnIcon.hidden = isMuted;
      elements.volumeOffIcon.hidden = !isMuted;
      if (volume > 0) lastNonZeroVolume = volume;
    } catch (_error) {
      // Sebagian implementasi player belum menyediakan status volume di frame awal.
    }
  }

  function updateControls() {
    const available = Boolean(player && playerReady && currentVideoId);
    const controls = [
      elements.playToggle,
      elements.restartButton,
      elements.resetButton,
      elements.muteButton,
      elements.volumeControl,
      elements.fullscreenButton
    ];
    controls.forEach((control) => { control.disabled = !available; });

    const states = getYouTubeStates();
    const state = getPlayerState();
    const isPlaying = state === states.PLAYING || state === states.BUFFERING;
    elements.playIcon.hidden = isPlaying;
    elements.pauseIcon.hidden = !isPlaying;
    elements.playToggleLabel.textContent = isPlaying
      ? "Jeda"
      : (state === states.ENDED && currentMode === "manual" ? "Putar ulang" : "Putar");
    elements.playToggle.setAttribute("aria-label", isPlaying ? "Jeda video" : "Putar video");

    const showReplay = available && currentMode === "manual" && state === states.ENDED;
    elements.replayButton.hidden = !showReplay;
    elements.replayButton.disabled = !available;

    if (available) updateVolumeControls();
  }

  function setModeDescription() {
    elements.modeDescription.textContent = MODE_DESCRIPTIONS[currentMode];
    document.querySelectorAll('input[name="playback-mode"]').forEach((input) => {
      input.checked = input.value === currentMode;
    });
  }

  function markPlaybackError(message, kind = "player") {
    hasPlayerError = true;
    playerErrorKind = kind;
    playbackController.cancelPending();
    if (playerReadyTimer !== null) {
      window.clearTimeout(playerReadyTimer);
      playerReadyTimer = null;
    }
    setStatus("error");
    showMessage(message, "error");
    updateControls();
  }

  function restartFromBeginning(options = {}) {
    if (!player || !playerReady || !currentVideoId) return;
    playbackController.cancelPending();

    const states = getYouTubeStates();
    const state = getPlayerState();
    try {
      if (state !== states.UNSTARTED && state !== states.CUED && state !== -1 && state !== 5) {
        player.seekTo(0, true);
      }
      player.playVideo();
      setStatus("loading");
      if (!options.fromLoop) showMessage("Memulai video dari awal…", "info");
    } catch (_error) {
      markPlaybackError("Tidak dapat memulai video. Coba muat ulang tautan atau gunakan kontrol YouTube di dalam pemutar.");
    }
  }

  const playbackController = new window.PlaybackController({
    mode: currentMode,
    delay: 350,
    restart: () => {
      if (!playerReady || !currentVideoId || selectedMode() !== "loop") return;
      restartFromBeginning({ fromLoop: true });
    },
    onLoopPending: () => {
      setStatus("looping");
      showMessage("Video selesai. Putaran berikutnya akan segera dimulai…", "info");
    },
    onFinished: (mode) => {
      setStatus("ended");
      if (mode === "manual") {
        showMessage("Video selesai. Tekan Putar ulang jika ingin menontonnya lagi.", "info");
      } else {
        showMessage("Video selesai. Mode Putar sekali tidak akan memulai ulang otomatis.", "info");
      }
      updateControls();
    }
  });

  function onPlayerError(event) {
    const code = event && event.data;
    markPlaybackError(window.YouTubePlayerErrors.getMessage(code), "video");
  }

  function onPlayerStateChange(event) {
    if (!event) return;
    const states = getYouTubeStates();
    const state = event.data;
    updateControls();

    if (networkDisconnected) return;

    if (state === states.PLAYING) {
      hasPlayerError = false;
      playerErrorKind = "";
      playbackController.cancelPending();
      setStatus("playing");
      clearMessage();
      updateVideoDetails();
    } else if (state === states.PAUSED) {
      setStatus("paused");
      updateVideoDetails();
    } else if (state === states.ENDED) {
      updateVideoDetails();
      playbackController.handleEnded();
      updateControls();
    } else if (state === states.BUFFERING) {
      setStatus("loading");
      showMessage("Video sedang dimuat. Pemutaran akan berlanjut saat siap.", "info");
    } else if (state === states.CUED) {
      if (!hasPlayerError) {
        setStatus("ready");
        showMessage("Video siap diputar. Tekan Putar untuk memulai.", "info");
      }
    } else if (state === states.UNSTARTED || state === -1) {
      if (!hasPlayerError) setStatus("ready");
    }
  }

  function onPlayerReady(event) {
    playerReady = true;
    if (playerReadyTimer !== null) {
      window.clearTimeout(playerReadyTimer);
      playerReadyTimer = null;
    }
    hasPlayerError = false;
    playerErrorKind = "";

    const readyPlayer = event && event.target ? event.target : player;
    if (currentVideoId && currentVideoId !== initialPlayerVideoId) {
      try {
        readyPlayer.cueVideoById({ videoId: currentVideoId, startSeconds: 0 });
      } catch (_error) {
        markPlaybackError("Video tidak dapat dimuat. Periksa koneksi internet lalu coba lagi.", "network");
        return;
      }
    }

    updateVideoDetails();
    updateControls();
    setStatus("ready");
    showMessage("Video siap diputar. Tekan Putar untuk memulai.", "info");
  }

  function onAutoplayBlocked() {
    setStatus("paused");
    showMessage("Browser membatasi pemutaran otomatis. Tekan Putar pada kontrol YouTube untuk melanjutkan.", "info");
  }

  function recreateUnreadyPlayer(YT, videoId) {
    const oldPlayer = player;
    playerGeneration += 1;
    player = null;
    playerReady = false;

    if (playerReadyTimer !== null) {
      window.clearTimeout(playerReadyTimer);
      playerReadyTimer = null;
    }
    if (oldPlayer && typeof oldPlayer.destroy === "function") {
      try { oldPlayer.destroy(); } catch (_error) { /* Iframe yang gagal masih dapat dihapus di bawah. */ }
    }

    let mount = document.getElementById("player-target");
    if (!mount || mount.tagName === "IFRAME") {
      if (mount) mount.remove();
      mount = document.createElement("div");
      mount.id = "player-target";
      mount.title = "Pemutar video YouTube";
      elements.playerFrame.appendChild(mount);
    }
    createPlayer(YT, videoId);
  }

  function createPlayer(YT, videoId) {
    initialPlayerVideoId = videoId;
    playerReady = false;
    const generation = ++playerGeneration;
    const playerVars = {
      autoplay: 0,
      controls: 1,
      disablekb: 0,
      enablejsapi: 1,
      fs: 1,
      playsinline: 1,
      rel: 0
    };
    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
      playerVars.origin = window.location.origin;
    }

    player = new YT.Player("player-target", {
      width: "100%",
      height: "100%",
      videoId,
      playerVars,
      events: {
        onReady: (event) => {
          if (generation !== playerGeneration) {
            if (event && event.target && typeof event.target.destroy === "function") event.target.destroy();
            return;
          }
          onPlayerReady(event);
        },
        onStateChange: (event) => {
          if (generation === playerGeneration) onPlayerStateChange(event);
        },
        onError: (event) => {
          if (generation === playerGeneration) onPlayerError(event);
        },
        onAutoplayBlocked: () => {
          if (generation === playerGeneration) onAutoplayBlocked();
        }
      }
    });

    playerReadyTimer = window.setTimeout(() => {
      playerReadyTimer = null;
      if (generation === playerGeneration && !playerReady && currentVideoId) {
        markPlaybackError("Pemutar YouTube belum merespons. Periksa koneksi internet dan coba muat video lagi.", "network");
      }
    }, 20000);
  }

  function ensureYouTubeAPI() {
    if (window.YT && typeof window.YT.Player === "function") {
      return Promise.resolve(window.YT);
    }
    if (youtubeApiPromise) return youtubeApiPromise;

    youtubeApiPromise = new Promise((resolve, reject) => {
      let settled = false;
      let timer = null;
      let script = document.querySelector("script[data-youtube-iframe-api]");
      const previousCallback = window.onYouTubeIframeAPIReady;

      const finish = (error, api) => {
        if (settled) return;
        settled = true;
        if (timer !== null) window.clearTimeout(timer);
        if (script) script.removeEventListener("error", onScriptError);
        if (window.onYouTubeIframeAPIReady === apiCallback) {
          window.onYouTubeIframeAPIReady = previousCallback || undefined;
        }
        if (error) reject(error);
        else resolve(api);
      };

      const onScriptError = () => {
        finish(new Error("YouTube IFrame Player API tidak dapat diunduh. Periksa koneksi internet atau coba lagi."));
      };

      const apiCallback = () => {
        if (typeof previousCallback === "function") {
          try { previousCallback(); } catch (_error) { /* Callback pihak lain tidak menghalangi player. */ }
        }
        if (window.YT && typeof window.YT.Player === "function") {
          finish(null, window.YT);
        } else {
          finish(new Error("YouTube IFrame Player API gagal diinisialisasi. Coba muat video lagi."));
        }
      };

      window.onYouTubeIframeAPIReady = apiCallback;
      const shouldAppend = !script;
      if (shouldAppend) {
        script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        script.dataset.youtubeIframeApi = "true";
      }
      script.addEventListener("error", onScriptError, { once: true });
      timer = window.setTimeout(() => {
        finish(new Error("Koneksi ke YouTube terlalu lama atau diblokir. Periksa internet, lalu coba lagi."));
      }, 18000);
      if (shouldAppend) document.head.appendChild(script);
    }).catch((error) => {
      youtubeApiPromise = null;
      const script = document.querySelector("script[data-youtube-iframe-api]");
      if (script && !(window.YT && typeof window.YT.Player === "function")) script.remove();
      throw error;
    });

    return youtubeApiPromise;
  }

  async function loadVideo(event) {
    if (event) event.preventDefault();
    clearInputError();

    const parsed = window.YouTubeUrlParser.parseYouTubeUrl(elements.urlInput.value);
    if (!parsed.ok) {
      showInputError(parsed.error);
      elements.urlInput.focus();
      return;
    }

    const requestId = ++loadRequestId;
    currentVideoId = parsed.videoId;
    writeStorage(STORAGE_URL, elements.urlInput.value.trim());
    playbackController.cancelPending();
    hasPlayerError = false;
    playerErrorKind = "";
    elements.playerFrame.classList.add("has-video");
    elements.videoTitle.textContent = "Memuat video YouTube…";
    elements.videoSubtitle.textContent = `ID video · ${currentVideoId}`;
    elements.youtubeLink.href = parsed.canonicalUrl;
    elements.youtubeLink.hidden = false;
    clearMessage();
    setStatus("loading");

    if (!navigator.onLine || networkDisconnected) {
      markPlaybackError("Tidak ada koneksi internet. Sambungkan kembali lalu tekan Muat untuk mencoba lagi.", "network");
      return;
    }

    showMessage("Menyiapkan pemutar resmi YouTube…", "info");
    try {
      const YT = await ensureYouTubeAPI();
      if (requestId !== loadRequestId) return;

      if (!player) {
        createPlayer(YT, currentVideoId);
      } else if (playerReady) {
        player.cueVideoById({ videoId: currentVideoId, startSeconds: 0 });
        updateControls();
        setStatus("ready");
        showMessage("Video siap diputar. Tekan Putar untuk memulai.", "info");
        updateVideoDetails();
      } else {
        // Jika iframe lama macet saat inisialisasi, buat instance baru untuk percobaan ini.
        recreateUnreadyPlayer(YT, currentVideoId);
      }
    } catch (error) {
      if (requestId !== loadRequestId) return;
      const message = error && error.message
        ? error.message
        : "YouTube tidak dapat dihubungi. Periksa koneksi lalu coba lagi.";
      markPlaybackError(message, "network");
    }
  }

  function changeMode(mode) {
    if (!validMode(mode) || mode === currentMode) return;
    currentMode = mode;
    writeStorage(STORAGE_MODE, mode);
    setModeDescription();

    const endedNow = isEnded();
    playbackController.setMode(mode, { isEnded: endedNow });
    updateControls();

    if (!endedNow && currentStatus === "ended") {
      setStatus("ready");
    }
  }

  function togglePlayPause() {
    if (!player || !playerReady || !currentVideoId) return;
    const states = getYouTubeStates();
    const state = getPlayerState();
    try {
      if (state === states.PLAYING || state === states.BUFFERING) {
        playbackController.cancelPending();
        player.pauseVideo();
      } else if (state === states.ENDED) {
        restartFromBeginning();
      } else {
        player.playVideo();
      }
    } catch (_error) {
      markPlaybackError("Kontrol pemutaran tidak merespons. Coba gunakan kontrol di dalam player YouTube.");
    }
  }

  function resetPlayback() {
    if (!player || !playerReady || !currentVideoId) return;
    playbackController.cancelPending();
    hasPlayerError = false;
    playerErrorKind = "";
    try {
      player.stopVideo();
      player.cueVideoById({ videoId: currentVideoId, startSeconds: 0 });
      setStatus("ready");
      showMessage("Pemutaran dihentikan dan video direset ke awal.", "info");
      updateControls();
    } catch (_error) {
      markPlaybackError("Video tidak dapat direset. Coba muat kembali tautannya.");
    }
  }

  function toggleMute() {
    if (!player || !playerReady) return;
    try {
      const volume = Number(player.getVolume()) || 0;
      if (player.isMuted() || volume === 0) {
        player.unMute();
        player.setVolume(lastNonZeroVolume || 60);
      } else {
        lastNonZeroVolume = volume;
        player.mute();
      }
      updateVolumeControls();
    } catch (_error) {
      showMessage("Pengaturan suara tidak tersedia. Gunakan kontrol volume di dalam player YouTube.", "info");
    }
  }

  function setVolume(value) {
    if (!player || !playerReady) return;
    const volume = Math.max(0, Math.min(100, Number(value) || 0));
    try {
      if (volume > 0) {
        lastNonZeroVolume = volume;
        player.unMute();
      }
      player.setVolume(volume);
      updateVolumeControls();
    } catch (_error) {
      showMessage("Pengaturan volume tidak tersedia. Gunakan kontrol di dalam player YouTube.", "info");
    }
  }

  async function toggleFullscreen() {
    if (!player || !playerReady) return;
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
    if (fullscreenElement) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) {
        try { await exit.call(document); } catch (_error) { /* Fullscreen dapat ditutup dengan Escape. */ }
      }
      return;
    }

    const request = elements.playerFrame.requestFullscreen || elements.playerFrame.webkitRequestFullscreen;
    if (request) {
      try {
        await request.call(elements.playerFrame);
      } catch (_error) {
        showMessage("Fullscreen ditolak browser. Gunakan tombol layar penuh pada player YouTube.", "info");
      }
    } else {
      showMessage("Browser ini tidak mendukung fullscreen dari tombol ini. Gunakan kontrol YouTube di dalam video.", "info");
    }
  }

  elements.form.addEventListener("submit", loadVideo);
  elements.urlInput.addEventListener("input", clearInputError);
  elements.playToggle.addEventListener("click", togglePlayPause);
  elements.restartButton.addEventListener("click", () => restartFromBeginning());
  elements.resetButton.addEventListener("click", resetPlayback);
  elements.replayButton.addEventListener("click", () => restartFromBeginning());
  elements.muteButton.addEventListener("click", toggleMute);
  elements.volumeControl.addEventListener("input", (event) => setVolume(event.currentTarget.value));
  elements.fullscreenButton.addEventListener("click", toggleFullscreen);
  document.querySelectorAll('input[name="playback-mode"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) changeMode(input.value);
    });
  });

  window.addEventListener("offline", () => {
    networkDisconnected = true;
    loadRequestId += 1;
    markPlaybackError("Koneksi internet terputus. Video mungkin berhenti; sambungkan kembali untuk melanjutkan.", "network");
  });

  window.addEventListener("online", () => {
    networkDisconnected = false;
    if (playerErrorKind === "network") {
      hasPlayerError = false;
      playerErrorKind = "";
      const states = getYouTubeStates();
      const state = getPlayerState();
      if (state === states.PLAYING) {
        setStatus("playing");
        showMessage("Koneksi kembali.", "info");
      } else if (state === states.PAUSED) {
        setStatus("paused");
        showMessage("Koneksi kembali. Tekan Putar jika ingin melanjutkan.", "info");
      } else if (state === states.ENDED) {
        playbackController.handleEnded();
      } else {
        setStatus("ready");
        showMessage("Koneksi kembali. Tekan Muat untuk mencoba memuat video lagi.", "info");
      }
      updateControls();
    }
  });

  elements.urlInput.value = readStorage(STORAGE_URL) || "";
  setModeDescription();
  updateControls();
  setStatus("ready");
  if (elements.urlInput.value) {
    showMessage("Tautan terakhir dipulihkan dari perangkat ini. Tekan Muat untuk memuatnya kembali.", "info");
  }
  if (networkDisconnected) {
    markPlaybackError("Tidak ada koneksi internet. Sambungkan kembali untuk memuat video YouTube.", "network");
  }
})();
