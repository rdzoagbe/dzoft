/* Minimal Supabase client (auth + REST) for the private back-office.
   The key below is the public "anon" key: it is meant to be in the browser.
   Data stays private through row level security: only the owner e-mail can read it. */
(function (global) {
  var URL = 'https://rzghbvmszbjlqkdjzpxc.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6Z2hidm1zemJqbHFrZGp6cHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMDQ0MTEsImV4cCI6MjEwODU4MDQxMX0.LtN4aeyRY8Xf7s6vmoLU1QfRl_aCXOdtyAGSYdgHkZM';
  var OWNER = 'roland.dzoagbe@hotmail.com';
  var STORE = 'rd-admin-session';
  var ADMIN = 'https://rdzoagbe.github.io/rd-creations/admin/';

  function getSession() { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return null; } }
  function setSession(s) {
    try {
      if (s) localStorage.setItem(STORE, JSON.stringify(s)); else localStorage.removeItem(STORE);
    } catch (e) {}
  }
  function keep(r) {
    var s = { access_token: r.access_token, refresh_token: r.refresh_token,
              expires_at: Math.floor(Date.now() / 1000) + (r.expires_in || 3600), user: r.user || null };
    setSession(s); return s;
  }
  function req(path, opt) {
    opt = opt || {};
    var h = { apikey: KEY, 'Content-Type': 'application/json' };
    h.Authorization = 'Bearer ' + (opt.token || KEY);
    if (opt.prefer) h.Prefer = opt.prefer;
    return fetch(URL + path, { method: opt.method || 'GET', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined })
      .then(function (r) {
        return r.text().then(function (t) {
          var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { d = t; }
          if (!r.ok) {
            var msg = (d && (d.msg || d.message || d.error_description || d.error)) || ('Erreur ' + r.status);
            var err = new Error(msg); err.status = r.status; throw err;
          }
          return d;
        });
      });
  }
  function refresh(s) {
    return req('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token } }).then(keep);
  }
  function token() {
    var s = getSession();
    if (!s) return Promise.resolve(null);
    if (s.expires_at - 60 > Date.now() / 1000) return Promise.resolve(s.access_token);
    return refresh(s).then(function (n) { return n.access_token; }, function () { setSession(null); return null; });
  }

  var sb = {
    OWNER: OWNER, ADMIN: ADMIN,
    session: getSession,
    signIn: function (email, password) {
      return req('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email, password: password } }).then(keep);
    },
    signUp: function (email, password) {
      return req('/auth/v1/signup?redirect_to=' + encodeURIComponent(ADMIN), { method: 'POST', body: { email: email, password: password } });
    },
    recover: function (email) {
      return req('/auth/v1/recover?redirect_to=' + encodeURIComponent(ADMIN), { method: 'POST', body: { email: email } });
    },
    setPassword: function (password) {
      return token().then(function (t) { return req('/auth/v1/user', { method: 'PUT', token: t, body: { password: password } }); });
    },
    signOut: function () {
      var s = getSession(); setSession(null);
      if (s) return req('/auth/v1/logout', { method: 'POST', token: s.access_token }).catch(function () {});
      return Promise.resolve();
    },
    /* Reads a session returned in the URL after a confirmation or reset e-mail. */
    fromUrl: function () {
      var h = global.location.hash.replace(/^#/, '');
      if (h.indexOf('access_token=') < 0) return null;
      var p = {}; h.split('&').forEach(function (kv) { var i = kv.indexOf('='); p[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1)); });
      keep({ access_token: p.access_token, refresh_token: p.refresh_token, expires_in: +p.expires_in || 3600 });
      history.replaceState(null, '', global.location.pathname + global.location.search);
      return p.type || 'signin';
    },
    me: function () {
      return token().then(function (t) { return t ? req('/auth/v1/user', { token: t }) : null; });
    },
    /* Table access through PostgREST. q is the query string after the table name. */
    select: function (table, q) {
      return token().then(function (t) { return req('/rest/v1/' + table + (q ? '?' + q : ''), { token: t }); });
    },
    insert: function (table, row) {
      return token().then(function (t) { return req('/rest/v1/' + table, { method: 'POST', token: t, body: row, prefer: 'return=representation' }); })
        .then(function (d) { return d && d[0]; });
    },
    update: function (table, id, row) {
      return token().then(function (t) {
        return req('/rest/v1/' + table + '?id=eq.' + encodeURIComponent(id), { method: 'PATCH', token: t, body: row, prefer: 'return=representation' });
      }).then(function (d) { return d && d[0]; });
    },
    remove: function (table, id) {
      return token().then(function (t) { return req('/rest/v1/' + table + '?id=eq.' + encodeURIComponent(id), { method: 'DELETE', token: t }); });
    },
    /* Public: lets a site visitor drop a request, without reading anything back. */
    submitLead: function (row) {
      return req('/rest/v1/leads', { method: 'POST', body: row, prefer: 'return=minimal' });
    }
  };
  global.RDsb = sb;
})(window);
