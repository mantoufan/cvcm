(function () {
  var params = new URLSearchParams(location.search);
  var core = params.get("core") || "nes";
  var name = params.get("name") || "Game";
  var rom = params.get("rom") || "";
  var booted = false;
  window.EJS_player = "#game";
  window.EJS_core = core;
  window.EJS_pathtodata = "/emu/assets/";
  window.EJS_gameName = name;
  window.EJS_color = "#c83f79";
  window.EJS_startOnLoaded = true;
  window.EJS_threads = false;
  window.EJS_volume = 0.45;
  window.EJS_language = params.get("lang") || "en-US";

  function validRomPath(value) {
    return /^\/emu\/roms\/[A-Za-z0-9._-]+$/.test(value);
  }

  function boot() {
    if (booted || !window.EJS_gameUrl) return;
    booted = true;
    var script = document.createElement("script");
    script.src = "/emu/assets/loader.js";
    document.body.appendChild(script);
  }

  window.addEventListener("message", function (ev) {
    if (ev.origin !== location.origin) return;
    var data = ev.data || {};
    if (data.type === "boot") {
      if (Array.isArray(data.cheats)) window.EJS_cheats = data.cheats;
      if (typeof data.name === "string") window.EJS_gameName = data.name;
      if (typeof data.core === "string") window.EJS_core = data.core;
      if (data.buffer instanceof ArrayBuffer) {
        window.EJS_gameUrl = URL.createObjectURL(new Blob([data.buffer]));
      } else if (typeof data.rom === "string" && validRomPath(data.rom)) {
        window.EJS_gameUrl = data.rom;
      }
      boot();
    }
  });

  if (validRomPath(rom)) {
    window.EJS_gameUrl = rom;
    boot();
  }
  if (window.parent !== window) {
    window.parent.postMessage({ type: "emu-ready" }, location.origin);
  }

  // Arrow keys and Space scroll the parent page once the iframe cannot scroll further.
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
