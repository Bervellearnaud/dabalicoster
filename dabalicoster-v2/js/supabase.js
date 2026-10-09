/* ============================================================
   DABALICOSTER V2 — Client Supabase minimal (fetch, sans SDK)
   Projet : lbeugbapmruljmekokhj
   La clé publishable est une clé PUBLIQUE par conception :
   son exposition côté navigateur est normale et sûre.
   ============================================================ */
const Supabase = (() => {

  const URL = 'https://lbeugbapmruljmekokhj.supabase.co';
  const KEY = 'sb_publishable_hGyOH6LNDDRqO7UKBGPkIg_y7gtyowh';

  async function http(path, opts) {
    opts = opts || {};
    const headers = { apikey: KEY, Authorization: 'Bearer ' + KEY };
    if (opts.headers) Object.assign(headers, opts.headers);
    if (opts.body !== undefined && opts.body !== null) headers['Content-Type'] = 'application/json';
    if (opts.prefer) headers['Prefer'] = opts.prefer;
    const res = await fetch(URL + path, {
      method: opts.method || 'GET',
      headers,
      body: (opts.body !== undefined && opts.body !== null) ? JSON.stringify(opts.body) : undefined,
    });
    const txt = await res.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
    if (!res.ok) {
      const msg = (data && data.message) ? data.message : ('HTTP ' + res.status);
      const err = new Error(msg);
      err.status = res.status;
      err.payload = data;
      throw err;
    }
    return data;
  }

  /* Appel de fonction SQL (SECURITY DEFINER) : /rest/v1/rpc/<nom> */
  const rpc = (fn, params) => http('/rest/v1/rpc/' + fn, { method: 'POST', body: params || {} });

  /* Lecture PostgREST : select('ingredients', 'id=eq.xxx&order=nom') */
  const select = (table, query) => http('/rest/v1/' + table + (query ? '?' + query : ''));

  const insert = (table, rows) => http('/rest/v1/' + table, { method: 'POST', body: rows, prefer: 'return=minimal' });

  /* Upsert par clé primaire (Prefer resolution=merge-upsert-duplicates) */
  const upsert = (table, rows) => http('/rest/v1/' + table, {
    method: 'POST', body: rows, prefer: 'return=minimal,resolution=merge-upsert-duplicates',
  });

  const update = (table, query, patch) => http('/rest/v1/' + table + '?' + query, { method: 'PATCH', body: patch, prefer: 'return=minimal' });

  const del = (table, query) => http('/rest/v1/' + table + '?' + query, { method: 'DELETE', prefer: 'return=minimal' });

  /* true si l'erreur provient d'une exception SQL (raise exception) */
  function sqlMessage(err) {
    return err && err.message ? err.message : String(err);
  }
  /* true si l'erreur est réseau (Supabase injoignable) */
  function isNetworkError(err) {
    return !err || !err.status || /fetch|network|failed/i.test(err.message || '');
  }

  return { URL, KEY, http, rpc, select, insert, upsert, update, del, sqlMessage, isNetworkError };
})();
