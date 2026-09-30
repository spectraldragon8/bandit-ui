(() => {
  'use strict';

  const STORAGE_KEY = 'gtm-custom-music-v1';
  const MOD_TAG = '[Bandit Custom Music]';

  const SLOTS = [
    { id: 'menu',     label: 'Lobby Music',   original: 'Main Menu Theme' },
    { id: 'training', label: 'Training',      original: 'Training Inspiration' },
    { id: 'olif',     label: "Olif's Theme", original: "Olif's Theme" },
    { id: 'dai',      label: "Dai's Theme",  original: "Dai's Theme" },
    { id: 'emy',      label: "Emy's Theme",  original: "Emy's Theme" },
  ];

  let preview = null;
  let managerSeen = null;

  function readConfig() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      return {};
    }
  }

  function writeConfig(config) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  function cloneTrack(track) {
    return track ? {
      url: track.url,
      name: track.name,
      dvol: track.dvol
    } : null;
  }

  function filenameToName(url) {
    try {
      const file = decodeURIComponent(
        new URL(url).pathname.split('/').pop() || 'Custom Track'
      );

      return file
        .replace(/\.mp3$/i, '')
        .replace(/[_-]+/g, ' ')
        .trim() || 'Custom Track';
    } catch (err) {
      return 'Custom Track';
    }
  }

  function normalizeGitHubUrl(input) {
    let value = String(input || '').trim();

    if (!value) return '';

    let u;

    try {
      u = new URL(value);
    } catch (err) {
      throw new Error('That is not a valid URL.');
    }

    if (u.protocol !== 'https:') {
      throw new Error('Use an https:// GitHub URL.');
    }

    /*
      Accept normal GitHub file URLs too.

      Example:

      https://github.com/user/repo/blob/main/music/song.mp3

      becomes:

      https://raw.githubusercontent.com/user/repo/main/music/song.mp3
    */
    if (u.hostname === 'github.com') {
      const p = u.pathname.split('/').filter(Boolean);

      if (
        p.length >= 5 &&
        (p[2] === 'blob' || p[2] === 'raw')
      ) {
        const owner = p[0];
        const repo = p[1];
        const branch = p[3];
        const rest = p.slice(4).join('/');

        value =
          `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rest}`;

        u = new URL(value);
      }
    }

    if (u.hostname !== 'raw.githubusercontent.com') {
      throw new Error(
        'Use a raw GitHub file URL from raw.githubusercontent.com.'
      );
    }

    if (!/\.mp3$/i.test(u.pathname)) {
      throw new Error('The GitHub file must end in .mp3.');
    }

    return u.href;
  }

  function getManager() {
    const manager =
      window._$bG &&
      window._$bG.music;

    if (manager) {
      managerSeen = manager;
      rememberDefaults(manager);
    }

    return manager || managerSeen;
  }

  function rememberDefaults(manager) {
    if (!manager || manager.__customMusicDefaults) return;

    const defaults = {};

    for (const id of ['training', 'olif', 'dai', 'emy']) {
      defaults[id] = cloneTrack(
        manager._$2Q &&
        manager._$2Q[id]
      );
    }

    defaults.menu = {
      url:
        typeof manager.URL === 'function'
          ? manager.URL('/tracks/BanditRIPMainMenuLoop2.mp3')
          : '/tracks/BanditRIPMainMenuLoop2.mp3',

      name: 'Main Menu Theme',
      dvol: 1,
    };

    manager.__customMusicDefaults = defaults;
  }

  function applyOverrides(manager) {
    if (!manager || !manager._$2Q) return;

    rememberDefaults(manager);

    const config = readConfig();

    for (const slot of SLOTS) {
      const base =
        manager.__customMusicDefaults[slot.id];

      if (!base) continue;

      const custom = config[slot.id];

      if (custom && custom.url) {
        manager._$2Q[slot.id] = {
          url: custom.url,
          name:
            custom.name ||
            filenameToName(custom.url),

          dvol:
            base.dvol == null
              ? 1
              : base.dvol,
        };
      } else {
        manager._$2Q[slot.id] =
          cloneTrack(base);
      }
    }
  }

  function disposeLoadedTrack(manager, id) {
    if (
      !manager ||
      !manager._$lZ ||
      !manager._$lZ[id]
    ) {
      return;
    }

    try {
      manager._$lZ[id].stop();
    } catch (err) {}

    try {
      manager._$lZ[id].unload();
    } catch (err) {}

    delete manager._$lZ[id];
  }

  function updatePlayingText(manager) {
    if (!manager || !manager._$2Q) return;

    const id = manager._$q5;
    const track = manager._$2Q[id];

    if (!track || !track.name) return;

    const label =
      document.querySelector('.fgm-playing');

    if (label) {
      label.textContent =
        'Playing: ' + track.name;
    }
  }

  function refreshLive(changedIds) {
    const manager = getManager();

    if (!manager) return;

    const current = manager._$q5;

    for (const id of changedIds) {
      disposeLoadedTrack(manager, id);
    }

    applyOverrides(manager);

    if (
      changedIds.includes(current) &&
      typeof manager._$1Z === 'function'
    ) {
      manager._$1Z(current);
    }

    updatePlayingText(manager);
  }

  function patchMusicEngine() {
    if (
      !window._$17 ||
      !window._$17.prototype
    ) {
      return false;
    }

    const proto = window._$17.prototype;

    if (proto.__customMusicPatched) {
      return true;
    }

    proto.__customMusicPatched = true;

    const originalPlay = proto._$1Z;

    if (typeof originalPlay === 'function') {
      proto._$1Z = function(id) {
        managerSeen = this;

        rememberDefaults(this);
        applyOverrides(this);

        const result =
          originalPlay.apply(this, arguments);

        updatePlayingText(this);

        return result;
      };
    }

    const originalSelect = proto._$3p;

    if (typeof originalSelect === 'function') {
      proto._$3p = function(id) {
        managerSeen = this;

        rememberDefaults(this);
        applyOverrides(this);

        const result =
          originalSelect.apply(this, arguments);

        updatePlayingText(this);

        return result;
      };
    }

    console.info(
      MOD_TAG,
      'music engine patched'
    );

    return true;
  }

  function stopPreview() {
    if (!preview) return;

    try {
      preview.stop();
    } catch (err) {}

    try {
      preview.unload();
    } catch (err) {}

    preview = null;
  }

  function previewUrl(url, button) {
    stopPreview();

    if (typeof window.Howl !== 'function') {
      setStatus(
        'Howler.js is not available yet.',
        true
      );
      return;
    }

    preview = new window.Howl({
      src: [url],

      volume: 0.18,

      /*
        html5 mode is better for remotely
        hosted user music because it streams
        instead of decoding the entire MP3 first.
      */
      html5: true,

      loop: false,

      onload: () => {
        if (button) {
          button.textContent = 'Stop';
        }
      },

      onplayerror: () => {
        setStatus(
          'Preview failed. Check that the Raw URL is public.',
          true
        );
      },

      onloaderror: () => {
        setStatus(
          'Could not load that MP3. Check the Raw GitHub URL.',
          true
        );
      },

      onend: () => {
        if (button) {
          button.textContent = 'Test';
        }

        stopPreview();
      },

      onstop: () => {
        if (button) {
          button.textContent = 'Test';
        }
      },
    });

    preview.play();
  }

  function css() {
    if (
      document.getElementById('bcm-style')
    ) {
      return;
    }

    const style =
      document.createElement('style');

    style.id = 'bcm-style';

    style.textContent = `
      #bcm-button {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 2147483000;

        border:
          1px solid rgba(255,255,255,.25);

        border-radius: 8px;

        padding: 9px 12px;

        background:
          rgba(12,12,16,.88);

        color: #f4f4f4;

        font:
          700 12px/1.2 Arial,
          sans-serif;

        letter-spacing: .08em;

        cursor: pointer;

        box-shadow:
          0 6px 24px rgba(0,0,0,.35);

        backdrop-filter:
          blur(8px);
      }

      #bcm-button:hover {
        background:
          rgba(28,28,35,.96);
      }

      #bcm-overlay {
        position: fixed;
        inset: 0;

        z-index: 2147483001;

        display: flex;

        align-items: center;
        justify-content: center;

        padding: 24px;

        background:
          rgba(0,0,0,.68);

        font-family:
          Arial,
          sans-serif;
      }

      #bcm-panel {
        width:
          min(900px, 96vw);

        max-height: 90vh;

        overflow: auto;

        color: #eee;

        background: #111318;

        border:
          1px solid #343842;

        border-radius: 12px;

        box-shadow:
          0 24px 80px
          rgba(0,0,0,.65);
      }

      .bcm-head {
        display: flex;

        align-items: center;
        justify-content: space-between;

        padding:
          18px 20px;

        border-bottom:
          1px solid #2b2f37;
      }

      .bcm-title {
        font-size: 20px;
        font-weight: 800;
      }

      .bcm-close {
        border: 0;

        background:
          transparent;

        color: #aaa;

        font-size: 24px;

        cursor: pointer;
      }

      .bcm-help {
        padding:
          14px 20px;

        color: #b7bbc5;

        font-size: 13px;

        line-height: 1.5;

        border-bottom:
          1px solid #252932;
      }

      .bcm-help code {
        color: #e4e7ee;
      }

      .bcm-list {
        padding:
          6px 20px;
      }

      .bcm-row {
        padding:
          14px 0;

        border-bottom:
          1px solid #232730;
      }

      .bcm-row:last-child {
        border-bottom: 0;
      }

      .bcm-label {
        margin-bottom:
          7px;

        font-size:
          14px;

        font-weight:
          800;
      }

      .bcm-original {
        margin-left:
          8px;

        color:
          #777e8b;

        font-size:
          11px;

        font-weight:
          400;
      }

      .bcm-grid {
        display:
          grid;

        grid-template-columns:
          minmax(130px,.65fr)
          minmax(300px,2fr)
          auto
          auto;

        gap: 8px;
      }

      .bcm-grid input {
        min-width: 0;

        box-sizing:
          border-box;

        width: 100%;

        padding:
          9px 10px;

        color:
          #f0f2f5;

        background:
          #191c22;

        border:
          1px solid #343945;

        border-radius:
          6px;

        outline: none;
      }

      .bcm-grid input:focus {
        border-color:
          #747c8d;
      }

      .bcm-grid button,
      .bcm-actions button {
        border:
          1px solid #3b414d;

        border-radius:
          6px;

        padding:
          8px 11px;

        color:
          #e8eaee;

        background:
          #22262e;

        cursor:
          pointer;
      }

      .bcm-grid button:hover,
      .bcm-actions button:hover {
        background:
          #2d323c;
      }

      .bcm-actions {
        display:
          flex;

        align-items:
          center;

        gap:
          8px;

        padding:
          16px 20px;

        border-top:
          1px solid #2b2f37;
      }

      .bcm-actions .bcm-save {
        margin-left:
          auto;

        background:
          #e7e9ee;

        color:
          #111318;

        border-color:
          #e7e9ee;

        font-weight:
          800;
      }

      .bcm-actions .bcm-save:hover {
        background:
          #fff;
      }

      #bcm-status {
        flex: 1;

        color:
          #8fd09c;

        font-size:
          12px;
      }

      #bcm-status.error {
        color:
          #ff8585;
      }

      @media (max-width: 720px) {
        .bcm-grid {
          grid-template-columns:
            1fr auto auto;
        }

        .bcm-grid .bcm-name {
          grid-column:
            1 / -1;
        }
      }
    `;

    (
      document.head ||
      document.documentElement
    ).appendChild(style);
  }

  function setStatus(
    message,
    error = false
  ) {
    const el =
      document.getElementById(
        'bcm-status'
      );

    if (!el) return;

    el.textContent =
      message || '';

    el.classList.toggle(
      'error',
      !!error
    );
  }

  function openEditor() {
    if (
      document.getElementById(
        'bcm-overlay'
      )
    ) {
      return;
    }

    css();
    stopPreview();

    const config =
      readConfig();

    const overlay =
      document.createElement('div');

    overlay.id =
      'bcm-overlay';

    const rows =
      SLOTS.map((slot) => {
        const saved =
          config[slot.id] || {};

        return `
          <div
            class="bcm-row"
            data-id="${slot.id}"
          >
            <div class="bcm-label">
              ${slot.label}

              <span class="bcm-original">
                default:
                ${slot.original}
              </span>
            </div>

            <div class="bcm-grid">
              <input
                class="bcm-name"
                type="text"
                maxlength="80"
                placeholder="Track name (optional)"
                value="${escapeAttr(saved.name || '')}"
              >

              <input
                class="bcm-url"
                type="text"
                spellcheck="false"
                placeholder="https://raw.githubusercontent.com/user/repo/main/song.mp3"
                value="${escapeAttr(saved.url || '')}"
              >

              <button
                class="bcm-test"
                type="button"
              >
                Test
              </button>

              <button
                class="bcm-clear"
                type="button"
              >
                Clear
              </button>
            </div>
          </div>
        `;
      }).join('');

    overlay.innerHTML = `
      <div
        id="bcm-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Custom Music"
      >
        <div class="bcm-head">
          <div class="bcm-title">
            Custom Music
          </div>

          <button
            class="bcm-close"
            type="button"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div class="bcm-help">
          Upload an
          <code>.mp3</code>
          to a public GitHub repository,
          open the file,
          click <b>Raw</b>,
          and paste that URL here.

          Normal
          <code>
            github.com/.../blob/...
          </code>
          links are also accepted
          and converted automatically.

          Settings are stored only
          in this browser's
          <code>localStorage</code>.
        </div>

        <div class="bcm-list">
          ${rows}
        </div>

        <div class="bcm-actions">
          <span id="bcm-status"></span>

          <button
            class="bcm-reset"
            type="button"
          >
            Reset all
          </button>

          <button
            class="bcm-save"
            type="button"
          >
            Save & Apply
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(
      overlay
    );

    const close = () => {
      stopPreview();

      overlay.remove();

      document.removeEventListener(
        'keydown',
        onKey,
        true
      );
    };

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();

        close();
      }
    };

    document.addEventListener(
      'keydown',
      onKey,
      true
    );

    overlay
      .querySelector('.bcm-close')
      .addEventListener(
        'click',
        close
      );

    overlay.addEventListener(
      'mousedown',
      (event) => {
        if (
          event.target === overlay
        ) {
          close();
        }
      }
    );

    overlay
      .querySelectorAll(
        '.bcm-clear'
      )
      .forEach((button) => {
        button.addEventListener(
          'click',
          () => {
            const row =
              button.closest(
                '.bcm-row'
              );

            row
              .querySelector(
                '.bcm-name'
              )
              .value = '';

            row
              .querySelector(
                '.bcm-url'
              )
              .value = '';

            setStatus(
              'Cleared in the editor. Click Save & Apply.'
            );
          }
        );
      });

    overlay
      .querySelectorAll(
        '.bcm-test'
      )
      .forEach((button) => {
        button.addEventListener(
          'click',
          () => {
            if (preview) {
              stopPreview();

              overlay
                .querySelectorAll(
                  '.bcm-test'
                )
                .forEach(
                  (b) =>
                    b.textContent =
                      'Test'
                );

              return;
            }

            const row =
              button.closest(
                '.bcm-row'
              );

            try {
              const url =
                normalizeGitHubUrl(
                  row
                    .querySelector(
                      '.bcm-url'
                    )
                    .value
                );

              if (!url) {
                throw new Error(
                  'Paste an MP3 URL first.'
                );
              }

              row
                .querySelector(
                  '.bcm-url'
                )
                .value = url;

              previewUrl(
                url,
                button
              );

              setStatus(
                'Previewing.'
              );
            } catch (err) {
              setStatus(
                err.message ||
                String(err),
                true
              );
            }
          }
        );
      });

    overlay
      .querySelector(
        '.bcm-reset'
      )
      .addEventListener(
        'click',
        () => {
          overlay
            .querySelectorAll(
              '.bcm-row'
            )
            .forEach((row) => {
              row
                .querySelector(
                  '.bcm-name'
                )
                .value = '';

              row
                .querySelector(
                  '.bcm-url'
                )
                .value = '';
            });

          setStatus(
            'All slots cleared in the editor. Click Save & Apply.'
          );
        }
      );

    overlay
      .querySelector(
        '.bcm-save'
      )
      .addEventListener(
        'click',
        () => {
          const next = {};
          const changed = [];
          const old =
            readConfig();

          try {
            overlay
              .querySelectorAll(
                '.bcm-row'
              )
              .forEach((row) => {
                const id =
                  row.dataset.id;

                const name =
                  row
                    .querySelector(
                      '.bcm-name'
                    )
                    .value
                    .trim();

                const url =
                  normalizeGitHubUrl(
                    row
                      .querySelector(
                        '.bcm-url'
                      )
                      .value
                  );

                if (url) {
                  row
                    .querySelector(
                      '.bcm-url'
                    )
                    .value = url;

                  next[id] = {
                    url,

                    name:
                      name ||
                      filenameToName(
                        url
                      ),
                  };
                }

                const before =
                  JSON.stringify(
                    old[id] ||
                    null
                  );

                const after =
                  JSON.stringify(
                    next[id] ||
                    null
                  );

                if (
                  before !== after
                ) {
                  changed.push(id);
                }
              });

            writeConfig(next);

            refreshLive(
              changed
            );

            setStatus(
              changed.length
                ? 'Saved and applied.'
                : 'No changes.'
            );
          } catch (err) {
            setStatus(
              err.message ||
              String(err),
              true
            );
          }
        }
      );
  }

  function escapeAttr(value) {
    return String(value)
      .replace(
        /&/g,
        '&amp;'
      )
      .replace(
        /"/g,
        '&quot;'
      )
      .replace(
        /</g,
        '&lt;'
      )
      .replace(
        />/g,
        '&gt;'
      );
  }

  function installButton() {
    if (
      document.getElementById(
        'bcm-button'
      ) ||
      !document.body
    ) {
      return;
    }

    css();

    const button =
      document.createElement(
        'button'
      );

    button.id =
      'bcm-button';

    button.type =
      'button';

    button.textContent =
      '♫ MUSIC';

    button.title =
      'Custom Bandit.RIP music';

    button.addEventListener(
      'click',
      (event) => {
        event.preventDefault();
        event.stopPropagation();

        openEditor();
      }
    );

    document.body.appendChild(
      button
    );
  }

  /*
    game.js is normally loaded by the
    time DOMContentLoaded fires.

    Retry briefly in case Bandit's
    script timing changes later.
  */
  let attempts = 0;

  const timer =
    setInterval(
      () => {
        attempts += 1;

        const patched =
          patchMusicEngine();

        if (
          patched ||
          attempts >= 200
        ) {
          clearInterval(
            timer
          );
        }
      },
      50
    );

  patchMusicEngine();

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      installButton,
      {
        once: true
      }
    );
  } else {
    installButton();
  }

  /*
    Small console API in case you
    ever want to control the mod
    manually.
  */
  window.BanditCustomMusic = {
    open:
      openEditor,

    get:
      readConfig,

    clear() {
      localStorage.removeItem(
        STORAGE_KEY
      );

      refreshLive(
        SLOTS.map(
          (slot) => slot.id
        )
      );
    },
  };
})();
