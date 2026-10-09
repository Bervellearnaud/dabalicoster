/* ============================================================
   DABALICOSTER V2 — Test de bout en bout Supabase
   Usage : node tools/test_supabase.mjs
   (à lancer APRÈS avoir collé setup.sql + seed_data.sql)
   ============================================================ */
const URL = 'https://lbeugbapmruljmekokhj.supabase.co';
const KEY = 'sb_publishable_hGyOH6LNDDRqO7UKBGPkIg_y7gtyowh';
const ADMIN = '00000000-0000-4000-8000-000000000003';

async function http(path, opts = {}) {
  const headers = { apikey: KEY, Authorization: 'Bearer ' + KEY };
  if (opts.body) headers['Content-Type'] = 'application/json';
  if (opts.prefer) headers['Prefer'] = opts.prefer;
  const res = await fetch(URL + path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const txt = await res.text();
  let data = null; try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  if (!res.ok) { const e = new Error((data && data.message) || ('HTTP ' + res.status)); e.status = res.status; throw e; }
  return data;
}
const rpc = (fn, params) => http('/rest/v1/rpc/' + fn, { method: 'POST', body: params });

let pass = 0, fail = 0;
function check(label, ok, extra = '') {
  if (ok) { pass++; console.log('  ✓ ' + label + (extra ? ' — ' + extra : '')); }
  else { fail++; console.log('  ✗ ÉCHEC : ' + label + (extra ? ' — ' + extra : '')); }
}

console.log('=== DABALICOSTER V2 — test Supabase ===\n');

// 0. Santé
const health = await http('/auth/v1/health');
check('Module Auth GoTrue opérationnel', health && health.name === 'GoTrue');

// 1. Connexion compte démo (bcrypt en base)
const chef = await rpc('login_user', { p_email: 'chef@dabalicoster.ci', p_pwd: 'chef2026' });
check('login_user(chef) → 1 ligne, rôle chef', chef && chef.length === 1 && chef[0].role === 'chef', chef && chef[0] ? 'id ' + chef[0].id : '');
const bad = await rpc('login_user', { p_email: 'chef@dabalicoster.ci', p_pwd: 'mauvais' });
check('login_user(mauvais mdp) → 0 ligne', Array.isArray(bad) && bad.length === 0);
const stag = await rpc('account_status', { p_email: 'stagiaire@dabalicoster.ci' });
check('account_status(stagiaire) → suspendu', stag === 'suspendu', String(stag));

// 2. Inscription réelle → la ligne DOIT apparaître en base
const stamp = Date.now();
const mail = `test.${stamp}@dabalicoster.ci`;
let created = null;
try {
  const rows = await rpc('register_user', { p_prenom: 'Test', p_nom: 'Automatique', p_email: mail, p_contact: null, p_pwd: 'test2026', p_role: 'utilisateur' });
  created = rows && rows[0];
} catch (e) { console.log('  ! register_user :', e.message); }
check('register_user → compte créé en base', !!created, created ? 'id ' + created.id : '');
const dup = await rpc('register_user', { p_prenom: 'Test', p_nom: 'Doublon', p_email: mail, p_contact: null, p_pwd: 'test2026', p_role: 'utilisateur' }).then(() => null).catch(e => e.message);
check('register_user(doublon) → refusé', !!dup && /déjà utilisé/i.test(dup), String(dup));
const weak = await rpc('register_user', { p_prenom: 'T', p_nom: 'F', p_email: `weak.${stamp}@x.ci`, p_contact: null, p_pwd: 'abc', p_role: 'utilisateur' }).then(() => null).catch(e => e.message);
check('register_user(mdp faible) → refusé', !!weak && /6 caractères/i.test(weak), String(weak));
const elev = await rpc('register_user', { p_prenom: 'T', p_nom: 'F', p_email: `adm.${stamp}@x.ci`, p_contact: null, p_pwd: 'test2026', p_role: 'administrateur' }).then(() => null).catch(e => e.message);
check('register_user(rôle admin) → auto-élévation refusée', !!elev && /Administrateur/i.test(elev), String(elev));

// 3. Le nouveau compte est visible en lecture directe (Table Editor équivalent)
const direct = await http('/rest/v1/utilisateurs?email=eq.' + mail + '&select=id,email,role,statut').catch(e => ({ err: e.message }));
check('SELECT direct utilisateurs bloqué par RLS', !!(direct && direct.err), direct && direct.err ? direct.err.slice(0, 60) : '');

// 4. Reconnexion du compte créé
const relog = await rpc('login_user', { p_email: mail, p_pwd: 'test2026' });
check('login_user(compte créé) → OK', relog && relog.length === 1);

// 5. Admin : liste, suppression
const list = await rpc('admin_list_users', { p_caller_id: ADMIN });
check('admin_list_users(admin) → liste complète', Array.isArray(list) && list.length >= 5, list ? list.length + ' comptes' : '');
const listDeny = await rpc('admin_list_users', { p_caller_id: created ? created.id : ADMIN }).then(() => null).catch(e => e.message);
check('admin_list_users(non-admin) → refusé', !!listDeny && /refusé/i.test(listDeny), String(listDeny));
if (created) {
  const del = await rpc('admin_delete_user', { p_caller_id: ADMIN, p_id: created.id });
  check('admin_delete_user → compte de test purgé', del === true);
}

// 6. Données métier seedées
const ings = await http('/rest/v1/ingredients?select=id');
check('18 ingrédients seedés', ings && ings.length === 18, ings ? ings.length + '' : '');
const couts = await http('/rest/v1/v_cout_recettes?select=nom,cout_portion,food_cost_pct&order=nom');
check('Vue v_cout_recettes → 4 recettes calculées', couts && couts.length === 4);
if (couts && couts.length) {
  const poulet = couts.find(r => /Poulet/i.test(r.nom));
  check('Coût portion poulet ≈ 3 120 F (±3 %)', poulet && Math.abs(+poulet.cout_portion - 3120) / 3120 < 0.03, poulet ? (+poulet.cout_portion).toFixed(0) + ' F / FC ' + (+poulet.food_cost_pct).toFixed(1) + ' %' : '');
}
const alertes = await http('/rest/v1/v_alertes_prix?select=nom');
check('Vue v_alertes_prix → 5 alertes', alertes && alertes.length === 5, alertes ? alertes.map(a => a.nom).join(', ') : '');

// 7. Écriture métier anonyme (policy démo) : insert + delete ingrédient
const tmpId = crypto.randomUUID();
await http('/rest/v1/ingredients', { method: 'POST', prefer: 'return=minimal', body: [{ id: tmpId, nom: ' Ingrédient test ' + stamp, categorie: 'Test', unite: 'kg', prix_unitaire: 1, fournisseur: null, nutrition: null }] });
const found = await http('/rest/v1/ingredients?id=eq.' + tmpId + '&select=id');
check('INSERT anon ingrédients (policy démo) → OK', found && found.length === 1);
await http('/rest/v1/ingredients?id=eq.' + tmpId, { method: 'DELETE' });
const gone = await http('/rest/v1/ingredients?id=eq.' + tmpId + '&select=id');
check('DELETE anon ingrédients → OK', gone && gone.length === 0);

console.log('\n=== RÉSULTAT : ' + pass + ' réussite(s), ' + fail + ' échec(s) ===');
process.exit(fail ? 1 : 0);
