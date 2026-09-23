(function () {
  var pending = null;
  var scriptStarted = false;

  window.RufflePlayer = window.RufflePlayer || {};
  window.RufflePlayer.config = {
    publicPath: "/emu/assets/ruffle/",
    polyfills: false,
    autoplay: "on",
    unmuteOverlay: "visible",
    splashScreen: true,
    letterbox: "on",
    warnOnUnsupportedContent: true,
    showSwfDownload: false,
    allowScriptAccess: false,
    allowNetworking: "none",
    logLevel: "error",
  };

  function validRomPath(value) {
    return /^\/emu\/roms\/[A-Za-z0-9._-]+$/.test(value);
  }

  function fail(message) {
    var box = document.getElementById("game");
    box.textContent = "";
    var note = document.createElement("p");
    note.textContent = message;
    box.appendChild(note);
  }

  function play() {
    if (!pending || !window.RufflePlayer || !window.RufflePlayer.newest) return;
    var ruffle = window.RufflePlayer.newest();
    var box = document.getElementById("game");
    box.textContent = "";
    var player = ruffle.createPlayer();
    box.appendChild(player);
    var options = {
      allowNetworking: "none",
      allowScriptAccess: false,
      autoplay: "on",
      unmuteOverlay: "visible",
      letterbox: "on",
    };
    if (pending.buffer instanceof ArrayBuffer) {
      options.data = pending.buffer;
      options.swfFileName = typeof pending.filename === "string" && pending.filename ? pending.filename : "movie.swf";
    } else if (typeof pending.rom === "string" && validRomPath(pending.rom)) {
      options.url = pending.rom;
    } else {
      return;
    }
    var result = player.load(options);
    if (result && typeof result.catch === "function") {
      result.catch(function (err) {
        fail(err && err.message ? err.message : "This SWF did not start.");
      });
    }
  }

  function ensurePlayer() {
    if (window.RufflePlayer && window.RufflePlayer.newest) {
      play();
      return;
    }
    if (scriptStarted) return;
    scriptStarted = true;
    var script = document.createElement("script");
    script.src = "/emu/assets/ruffle/ruffle.js";
    script.onload = play;
    script.onerror = function () {
      fail("Ruffle did not load.");
    };
    document.body.appendChild(script);
  }

  window.addEventListener("message", function (ev) {
    if (ev.origin !== location.origin) return;
    var data = ev.data || {};
    if (data.type !== "boot") return;
    pending = data;
    ensurePlayer();
  });

  if (window.parent !== window) {
    window.parent.postMessage({ type: "emu-ready" }, location.origin);
  }

  window.addEventListener("keydown", function (event) {
    if (
      event.key === "ArrowUp" ||
      event.key === "ArrowDown" ||
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === " "
    ) {
      event.preventDefault();
    }
  }, true);
})();
