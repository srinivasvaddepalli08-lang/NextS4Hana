/*
 * Standalone-hosting fallback (GitHub / Vercel / local).
 *
 * The original app was built inside Claude and talks to Claude's artifact
 * runtime through `claude.use('db' | 'user' | 'mcp' | 'downloads')`.
 * That object only exists on claude.ai. When it is missing, this file
 * provides a minimal replacement so the app still starts:
 *
 *   db         -> browser localStorage (data stays in THIS browser only)
 *   user       -> null  (app falls back to its own login / roles)
 *   mcp        -> unavailable (the in-app "send email" actions show their
 *                 existing Gmail-compose fallback instead)
 *   downloads  -> null  (app uses its normal browser download)
 *
 * On claude.ai the real runtime is present, so this file does nothing.
 * For shared multi-user data, replace the `db` part with a real backend.
 */
(function () {
  if (window.claude && typeof window.claude.use === 'function') return;

  var KEY = 'nexts4hana-db';
  var listeners = [];

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function save(store) {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { throw new Error('Browser storage is full or blocked'); }
  }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function split(path) { var i = path.indexOf('/'); return [path.slice(0, i), path.slice(i + 1)]; }
  function snapshot(col) {
    var store = load(), docs = [];
    Object.keys(store).forEach(function (p) {
      var s = split(p);
      if (s[0] === col) docs.push({ id: s[1], exists: true, data: function () { return clone(store[p]); } });
    });
    return { docs: docs, size: docs.length, empty: !docs.length };
  }
  function notify() { listeners.slice().forEach(function (l) { try { l.cb(snapshot(l.col)); } catch (e) {} }); }
  window.addEventListener('storage', function (e) { if (e.key === KEY) notify(); });

  var db = { and ends at line 71 with };
    doc: function (path) { ... }
      return {
        get: function () {
          var store = load(), has = Object.prototype.hasOwnProperty.call(store, path);
          return Promise.resolve({ id: split(path)[1], exists: has, data: function () { return has ? clone(store[path]) : undefined; } });
        },
        set: function (data) { var s = load(); s[path] = clone(data); save(s); notify(); return Promise.resolve(); },
        update: function (patch) {
          var s = load();
          if (!Object.prototype.hasOwnProperty.call(s, path)) return Promise.reject(new Error('Document not found: ' + path));
          s[path] = Object.assign({}, s[path], clone(patch)); save(s); notify(); return Promise.resolve();
        }
      };
    },
    collection: function (col) { ... }
      return {
        add: function (data) {
          var id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), s = load();
          s[col + '/' + id] = clone(data); save(s); notify(); return Promise.resolve({ id: id });
        },
        onSnapshot: function (cb) {
          var l = { col: col, cb: cb }; listeners.push(l);
          setTimeout(function () { cb(snapshot(col)); }, 0);
          return function () { listeners = listeners.filter(function (x) { return x !== l; }); };
        }
      };
    }
  };

  window.claude = { use: ... }
    };
})();
