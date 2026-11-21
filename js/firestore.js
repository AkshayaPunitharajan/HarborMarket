// Firebase Auth + Firestore over plain REST (jQuery Ajax). No Firebase SDK.
const FB = (() => {
  const C = window.CFG;
  const DB = `https://firestore.googleapis.com/v1/projects/${C.projectId}/databases/(default)/documents`;
  const AUTH = 'https://identitytoolkit.googleapis.com/v1/accounts:';
  let sess = JSON.parse(localStorage.getItem('sess') || 'null');

  // ---- JSON <-> Firestore typed values ----
  const enc = v => v === null ? { nullValue: null }
    : typeof v === 'boolean' ? { booleanValue: v }
    : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
    : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } }
    : typeof v === 'object' ? { mapValue: { fields: fields(v) } }
    : { stringValue: String(v) };
  const fields = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, enc(v)]));
  const dec = f => { const k = Object.keys(f)[0], v = f[k];
    return k === 'integerValue' ? +v : k === 'nullValue' ? null
      : k === 'arrayValue' ? (v.values || []).map(dec)
      : k === 'mapValue' ? obj(v.fields || {}) : v; };
  const obj = f => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, dec(v)]));
  const doc = d => ({ id: d.name.split('/').pop(), ...obj(d.fields || {}) });

  const call = (url, type, data, auth = true) => $.ajax({
    url, type, contentType: 'application/json', data: data && JSON.stringify(data),
    headers: auth && sess ? { Authorization: 'Bearer ' + sess.idToken } : {}
  }).catch(x => {
    const m = x.responseJSON?.error?.message || 'Request failed';
    if (x.status === 401) { localStorage.removeItem('sess'); sess = null; }
    throw new Error(m);
  });

  const save = r => { sess = { idToken: r.idToken, uid: r.localId, email: r.email }; localStorage.setItem('sess', JSON.stringify(sess)); return sess; };
  const authCall = (a, body) => call(`${AUTH}${a}?key=${C.apiKey}`, 'POST', body, false);

  return {
    user: () => sess,
    isAdmin: () => !!sess && sess.email.toLowerCase() === C.adminEmail.toLowerCase(),
    signUp: (email, password) => authCall('signUp', { email, password, returnSecureToken: true }).then(save),
    signIn: (email, password) => authCall('signInWithPassword', { email, password, returnSecureToken: true }).then(save),
    reset: email => authCall('sendOobCode', { requestType: 'PASSWORD_RESET', email }),
    signOut: () => { localStorage.removeItem('sess'); sess = null; },

    create: (col, id, data) => call(`${DB}/${col}?documentId=${encodeURIComponent(id)}`, 'POST', { fields: fields(data) }).then(doc),
    get: (col, id) => call(`${DB}/${col}/${encodeURIComponent(id)}`, 'GET').then(doc),
    update: (col, id, data) => call(`${DB}/${col}/${encodeURIComponent(id)}?` +
      Object.keys(data).map(k => 'updateMask.fieldPaths=' + k).join('&'), 'PATCH', { fields: fields(data) }).then(doc),
    remove: (col, id) => call(`${DB}/${col}/${encodeURIComponent(id)}`, 'DELETE'),
    // equality filters + offset/limit pagination via runQuery
    query: (col, { where = [], limit = 500, offset = 0, select } = {}) => {
      const f = where.map(([k, v]) => ({ fieldFilter: { field: { fieldPath: k }, op: 'EQUAL', value: enc(v) } }));
      const q = { from: [{ collectionId: col }], limit, offset };
      if (select) q.select = { fields: select.map(fieldPath => ({ fieldPath })) };
      if (f.length) q.where = f.length === 1 ? f[0] : { compositeFilter: { op: 'AND', filters: f } };
      return call(`${DB}:runQuery`, 'POST', { structuredQuery: q }).then(r => r.filter(x => x.document).map(x => doc(x.document)));
    },
    all: col => FB.query(col, { limit: 1000 })
  };
})();
