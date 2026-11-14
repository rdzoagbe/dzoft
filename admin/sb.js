/* Minimal Supabase client (auth + REST) for the private back-office.
   The key below is the public "anon" key: it is meant to be in the browser.
   Data stays private through row level security: only the owner role can read it. */
(function (global) {
  var URL = 'https://rzghbvmszbjlqkdjzpxc.supabase.co';
  var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6Z2hidm1zemJqbHFrZGp6cHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMDQ0MTEsImV4cCI6MjEwODU4MDQxMX0.LtN4aeyRY8Xf7s6vmoLU1QfRl_aCXOdtyAGSYdgHkZM';
  // The client space and the request form keep their own session, apart from the private space.
  var STORE = global.RD_STORE || 'rd-admin-session';
  var ADMIN = 'https://rdzoagbe.github.io/dzoft/admin/';
  var PORTAL = 'https://rdzoagbe.github.io/dzoft/espace/';

  // SECURITY: this admin and other GitHub Pages projects share one origin, so keep third-party scripts off it and move the admin to a dedicated origin before considering session storage hardened.
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
  function claims() {
    var s = getSession(); if (!s || !s.access_token) return {};
    try {
      var p = s.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(p + '==='.slice((p.length + 3) % 4)));
    } catch (e) { return {}; }
  }
  // Second factors accepted for the 8-hour check: authenticator-app code or a passkey (WebAuthn).
  var SECOND_FACTORS = ['totp', 'mfa/totp', 'mfa/webauthn', 'webauthn'];
  function mfaFresh(maxAgeSeconds) {
    var p = claims(), now = Date.now() / 1000;
    if (p.aal !== 'aal2' || !Array.isArray(p.amr)) return false;
    return p.amr.some(function (entry) {
      var at = Number(entry && entry.timestamp);
      return entry && SECOND_FACTORS.indexOf(entry.method) >= 0 && Number.isFinite(at) && at <= now + 120 && now - at <= maxAgeSeconds;
    });
  }

  /* WebAuthn helpers: Supabase sends and expects binary fields as base64url text. */
  function fromB64url(v) {
    var b = String(v || '').replace(/-/g, '+').replace(/_/g, '/'); b += '==='.slice((b.length + 3) % 4);
    var bin = atob(b), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  function toB64url(buf) {
    var bytes = new Uint8Array(buf), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function creationOptions(pk, discoverable) {
    var o = JSON.parse(JSON.stringify(pk));
    o.user = o.user || {};
    // A name is required by the browser: show the account e-mail if the server left it blank.
    if (!o.user.name) o.user.name = (claims().email || 'DZOFT');
    if (!o.user.displayName) o.user.displayName = o.user.name;
    // Built-in authenticators first (Face ID, fingerprint, Windows Hello), with the user verified.
    o.authenticatorSelection = Object.assign({}, o.authenticatorSelection || {}, { userVerification: 'required', residentKey: discoverable ? 'required' : 'preferred', requireResidentKey: !!discoverable });
    if (global.PublicKeyCredential && typeof PublicKeyCredential.parseCreationOptionsFromJSON === 'function') return PublicKeyCredential.parseCreationOptionsFromJSON(o);
    o.challenge = fromB64url(o.challenge); o.user.id = fromB64url(o.user.id);
    (o.excludeCredentials || []).forEach(function (c) { c.id = fromB64url(c.id); });
    return o;
  }
  function requestOptions(pk) {
    var o = JSON.parse(JSON.stringify(pk));
    o.userVerification = 'required';
    if (global.PublicKeyCredential && typeof PublicKeyCredential.parseRequestOptionsFromJSON === 'function') return PublicKeyCredential.parseRequestOptionsFromJSON(o);
    o.challenge = fromB64url(o.challenge);
    (o.allowCredentials || []).forEach(function (c) { c.id = fromB64url(c.id); });
    return o;
  }
  function credentialJSON(cred, create) {
    if (typeof cred.toJSON === 'function') return cred.toJSON();
    var r = cred.response, out = { id: cred.id, rawId: cred.id, type: 'public-key', clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {}, authenticatorAttachment: cred.authenticatorAttachment || undefined };
    out.response = create
      ? { attestationObject: toB64url(r.attestationObject), clientDataJSON: toB64url(r.clientDataJSON) }
      : { authenticatorData: toB64url(r.authenticatorData), clientDataJSON: toB64url(r.clientDataJSON), signature: toB64url(r.signature), userHandle: r.userHandle ? toB64url(r.userHandle) : undefined };
    return out;
  }

  var sb = {
    ADMIN: ADMIN, PORTAL: PORTAL,
    session: getSession,
    signIn: function (email, password) {
      return req('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email, password: password } }).then(keep);
    },
    signUp: function (email, password, back) {
      return req('/auth/v1/signup?redirect_to=' + encodeURIComponent(back || ADMIN), { method: 'POST', body: { email: email, password: password } });
    },
    recover: function (email, back) {
      return req('/auth/v1/recover?redirect_to=' + encodeURIComponent(back || ADMIN), { method: 'POST', body: { email: email } });
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
    // Navigation only: the admin page and RLS still enforce owner access and MFA.
    routeOwner: function () {
      return sb.me().then(function (user) {
        if (!user || !user.app_metadata || user.app_metadata.dzoft_owner !== true) return false;
        var current = getSession();
        if (!current || !current.access_token || !current.refresh_token) return false;
        // Write before removing the client copy. Never put credentials in the URL.
        localStorage.setItem('rd-admin-session', JSON.stringify(current));
        if (STORE !== 'rd-admin-session') localStorage.removeItem(STORE);
        localStorage.removeItem('rd-espace');
        global.location.replace(new global.URL('../admin/', global.location.href).href);
        return true;
      });
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
    /* Client space: database functions reached with the client's secret link, never with a login. */
    rpc: function (name, args, signedIn) {
      if (!signedIn) return req('/rest/v1/rpc/' + name, { method: 'POST', body: args || {} });
      return token().then(function (t) { return req('/rest/v1/rpc/' + name, { method: 'POST', token: t, body: args || {} }); });
    },
    /* Passwordless device sign-in (Supabase Auth Passkeys, experimental).
       A passkey is a first-factor sign-in. It does NOT automatically satisfy
       an enrolled AAL2/TOTP factor. The server, never local browser state,
       decides which permissions and verification are required. */
    devicePasskey: {
      supported: function () {
        return !!(global.isSecureContext && global.PublicKeyCredential &&
          global.navigator && navigator.credentials &&
          navigator.credentials.create && navigator.credentials.get);
      },
      signIn: function () {
        if (!sb.devicePasskey.supported()) return Promise.reject(new Error('WebAuthn is unavailable on this device.'));
        return req('/auth/v1/passkeys/authentication/options', {
          method: 'POST', body: {}
        }).then(function (c) {
          if (!c || !c.challenge_id || !c.options) throw new Error('Passkey challenge unavailable.');
          return navigator.credentials.get({ publicKey: requestOptions(c.options) }).then(function (credential) {
            if (!credential) throw new Error('No device credential selected.');
            return req('/auth/v1/passkeys/authentication/verify', {
              method: 'POST', body: { challenge_id: c.challenge_id, credential: credentialJSON(credential, false) }
            });
          });
        }).then(function (d) {
          if (!d || !d.access_token || !d.refresh_token || !d.user) {
            throw new Error('Passkey sign-in did not produce a verified session.');
          }
          return keep(d);
        });
      },
      register: function () {
        if (!sb.devicePasskey.supported()) return Promise.reject(new Error('WebAuthn is unavailable on this device.'));
        if (!getSession() || !mfaFresh(12 * 60 * 60)) {
          return Promise.reject(new Error('Complete the account verification step before adding a passkey.'));
        }
        return token().then(function (t) {
          return req('/auth/v1/passkeys/registration/options', { method: 'POST', token: t, body: {} });
        }).then(function (c) {
          if (!c || !c.challenge_id || !c.options) throw new Error('Passkey registration challenge unavailable.');
          return navigator.credentials.create({ publicKey: creationOptions(c.options, true) }).then(function (credential) {
            if (!credential) throw new Error('No device credential registered.');
            return token().then(function (t) {
              return req('/auth/v1/passkeys/registration/verify', {
                method: 'POST', token: t,
                body: { challenge_id: c.challenge_id, credential: credentialJSON(credential, true) }
              });
            });
          });
        });
      },
      list: function () {
        return token().then(function (t) {
          if (!t) throw new Error('Sign in to view your devices.');
          return req('/auth/v1/passkeys', { token: t });
        }).then(function (rows) { return Array.isArray(rows) ? rows : []; });
      },
      remove: function (passkeyId) {
        if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(passkeyId || ''))) {
          return Promise.reject(new Error('Invalid device identifier.'));
        }
        if (!mfaFresh(12 * 60 * 60)) {
          return Promise.reject(new Error('Verify your account before removing a device.'));
        }
        return token().then(function (t) {
          return req('/auth/v1/passkeys/' + encodeURIComponent(passkeyId), { method: 'DELETE', token: t });
        });
      }
    },
    /* Two-step sign-in (TOTP code from an authenticator app). */
    aal: function () {
      return claims().aal || '';
    },
    mfaFresh: mfaFresh,
    mfa: {
      enroll: function () { return token().then(function (t) { return req('/auth/v1/factors', { method: 'POST', token: t, body: { factor_type: 'totp', friendly_name: 'DZOFT ' + Date.now() } }); }); },
      challenge: function (fid) { return token().then(function (t) { return req('/auth/v1/factors/' + fid + '/challenge', { method: 'POST', token: t, body: {} }); }); },
      verify: function (fid, cid, code) { return token().then(function (t) { return req('/auth/v1/factors/' + fid + '/verify', { method: 'POST', token: t, body: { challenge_id: cid, code: code } }); }).then(keep); },
      remove: function (fid) { return token().then(function (t) { return req('/auth/v1/factors/' + fid, { method: 'DELETE', token: t }); }); },
      /* Passkey as second factor (WebAuthn): Face ID, fingerprint, Windows Hello or a security key.
         Same Supabase endpoints as the code, with a browser ceremony between challenge and verify. */
      passkey: {
        supported: function () {
          return !!(global.PublicKeyCredential && global.navigator && navigator.credentials && navigator.credentials.create && global.isSecureContext);
        },
        enroll: function (name) {
          return token().then(function (t) { return req('/auth/v1/factors', { method: 'POST', token: t, body: { factor_type: 'webauthn', friendly_name: name } }); });
        },
        /* Runs challenge, browser prompt and verify for one WebAuthn factor; keeps the aal2 session. */
        use: function (fid) {
          var rp = { rpId: global.location.hostname, rpOrigins: [global.location.origin] };
          return token().then(function (t) {
            return req('/auth/v1/factors/' + fid + '/challenge', { method: 'POST', token: t, body: { webauthn: rp } });
          }).then(function (c) {
            var w = c && c.webauthn, pk = w && w.credential_options && w.credential_options.publicKey;
            if (!pk) throw new Error('Clé d’accès non disponible pour ce compte.');
            var create = w.type === 'create';
            var options = create ? creationOptions(pk) : requestOptions(pk);
            var run = create ? navigator.credentials.create({ publicKey: options }) : navigator.credentials.get({ publicKey: options });
            return run.then(function (cred) {
              if (!cred) throw new Error('Aucune clé d’accès reçue.');
              return token().then(function (t) {
                return req('/auth/v1/factors/' + fid + '/verify', { method: 'POST', token: t, body: {
                  challenge_id: c.id,
                  webauthn: { type: w.type, rpId: rp.rpId, rpOrigins: rp.rpOrigins, credential_response: credentialJSON(cred, create) }
                } });
              });
            });
          }).then(keep);
        }
      }
    },
    /* Server function (e-mails to clients), called with the signed-in session. */
    fn: function (name, body) {
      return token().then(function (t) { return req('/functions/v1/' + name, { method: 'POST', token: t, body: body || {} }); });
    },
    /* Private file storage (bucket client-files). */
    files: {
      list: function (prefix) {
        return token().then(function (t) { return req('/storage/v1/object/list/client-files', { method: 'POST', token: t, body: { prefix: prefix, limit: 200, offset: 0, sortBy: { column: 'created_at', order: 'desc' } } }); });
      },
      upload: function (path, file) {
        return token().then(function (t) {
          return fetch(URL + '/storage/v1/object/client-files/' + path.split('/').map(encodeURIComponent).join('/'), {
            method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + t, 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' }, body: file
          }).then(function (r) { return r.text().then(function (x) { if (!r.ok) { var d = {}; try { d = JSON.parse(x); } catch (e) {} var err = new Error(d.message || d.error || ('Erreur ' + r.status)); err.status = r.status; throw err; } return x; }); });
        });
      },
      link: function (path, download) {
        return token().then(function (t) { return req('/storage/v1/object/sign/client-files/' + path.split('/').map(encodeURIComponent).join('/'), { method: 'POST', token: t, body: download ? { expiresIn: 600, download: true } : { expiresIn: 600 } }); })
          .then(function (d) { return URL + '/storage/v1' + (d.signedURL || d.signedUrl); });
      },
      remove: function (path) {
        return token().then(function (t) { return req('/storage/v1/object/client-files', { method: 'DELETE', token: t, body: { prefixes: [path] } }); });
      }
    },
    /* Public: lets a site visitor drop a request, without reading anything back. */
    submitLead: function (row, signedIn) {
      if (!signedIn) return req('/rest/v1/leads', { method: 'POST', body: row, prefer: 'return=minimal' });
      return token().then(function (t) { return req('/rest/v1/leads', { method: 'POST', token: t, body: row, prefer: 'return=minimal' }); });
    }
  };
  global.RDsb = sb;
})(window);

