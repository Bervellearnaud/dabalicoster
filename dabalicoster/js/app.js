/* ============================================================
   DABALICOSTER — Application Chef / Administrateur
   Routeur hash : #/dashboard · #/ingredients · #/recettes
   #/recettes/:id · #/menus · #/parametres
   ============================================================ */
(function () {

  /* ---------- Garde : Chef ou Administrateur uniquement ---------- */
  const user = Auth.requireAuth(['chef', 'administrateur']);
  if (!user) return;

  const view = document.getElementById('view');
  const skeleton = document.getElementById('skeleton');
  const crumbSlot = document.getElementById('breadcrumb-slot');
  const deviseChip = document.getElementById('devise-chip');
  const params = () => Store.getParams();
  const pn = (v) => parseFloat(String(v).replace(',', '.')) || 0;

  /* ---------- Coquille ---------- */
  function setupShell() {
    document.getElementById('side-user').innerHTML =
      '<span class="avatar">' + (user.photo ? '<img src="' + UI.esc(user.photo) + '" alt="">' : UI.initials(user)) + '</span>' +
      '<span><strong>' + UI.esc(user.prenom + ' ' + user.nom) + '</strong><span>' + Auth.roleLabel(user.role) + '</span></span>';
    document.getElementById('btn-logout').addEventListener('click', () => Auth.logout());
    if (user.role === 'administrateur') document.getElementById('link-admin').hidden = false;
    deviseChip.textContent = params().devise;
  }

  function setCrumb(items) { crumbSlot.innerHTML = UI.breadcrumb(items); }
  function setSidebarActive(prefix) {
    document.querySelectorAll('.side-link[data-route]').forEach(a => {
      a.classList.toggle('active', a.dataset.route === prefix);
    });
  }
  function refreshDevise() { deviseChip.textContent = params().devise; }

  /* ---------- Helpers métier ---------- */
  function calc(recipe, ingredients, prixOverride) {
    const p = params();
    const cost = Core.recipeCost(recipe, ingredients);
    const portion = Core.portionCost(recipe, ingredients);
    const prix = prixOverride != null ? prixOverride : recipe.prix_vente_ht;
    return {
      cost, portion,
      fc: Core.foodCostPct(portion, prix),
      theo: Core.theoreticalPrice(portion, p.objectif_food_cost),
      marge: Core.marge(prix, portion),
      ttc: prix * (1 + p.tva / 100),
      objectif: p.objectif_food_cost,
    };
  }
  function fcClass(fc, obj) { return fc > obj * 1.25 ? 'bad' : fc > obj ? 'warn' : 'ok'; }

  function unitOptions(selected) {
    return Core.ALL_UNITS.map(u => '<option value="' + u + '"' + (u === selected ? ' selected' : '') + '>' + u + '</option>').join('');
  }
  function ingredientOptions(ingredients, selectedId) {
    return '<option value="">— Choisir —</option>' + ingredients.map(i =>
      '<option value="' + i.id + '"' + (i.id === selectedId ? ' selected' : '') + '>' + UI.esc(i.nom) + ' (' + i.unite + ')</option>'
    ).join('');
  }

  /* ============================================================
     TABLEAU DE BORD
     ============================================================ */
  function renderDashboard() {
    setCrumb([{ label: 'Application', href: '#/dashboard', hideMobile: true }, { label: 'Tableau de bord' }]);
    setSidebarActive('/dashboard');
    const ingredients = Store.getIngredients();
    const recipes = Store.getRecipes();
    const obj = params().objectif_food_cost;

    const costs = recipes.map(r => Core.portionCost(r, ingredients));
    const fcs = recipes.map(r => Core.foodCostPct(Core.portionCost(r, ingredients), r.prix_vente_ht));
    const avgCost = costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
    const avgFC = fcs.length ? fcs.reduce((a, b) => a + b, 0) / fcs.length : 0;
    const trends = ingredients.map(i => ({ ing: i, t: Core.priceTrend(i.historique) })).filter(x => x.t.alert);

    const fcNoteCls = avgFC <= obj ? 'ok' : avgFC <= obj * 1.25 ? 'warn' : 'bad';
    const fcNote = avgFC <= obj
      ? 'Sous l\u2019objectif de ' + UI.pct(obj) + ' ✓'
      : 'Au-dessus de l\u2019objectif de ' + UI.pct(obj) + ' ⚠';

    let html =
      '<div class="page-head"><div><h1>Bonjour ' + UI.esc(user.prenom) + ' 👋</h1>' +
      '<p>Vue d\u2019ensemble de votre coût matière — recalculée en temps réel.</p></div></div>' +
      '<div class="kpi-grid">' +
        '<div class="card kpi"><div class="kpi-ico">💰</div><small>Coût matière moyen</small><div class="kpi-val">' + UI.money(avgCost) + '</div><span class="kpi-note">par portion · ' + recipes.length + ' recette(s)</span></div>' +
        '<div class="card kpi"><div class="kpi-ico">📈</div><small>Food Cost moyen</small><div class="kpi-val">' + UI.pct(avgFC) + '</div><span class="kpi-note ' + fcNoteCls + '">' + fcNote + '</span></div>' +
        '<div class="card kpi"><div class="kpi-ico">📋</div><small>Recettes actives</small><div class="kpi-val">' + recipes.length + '</div><span class="kpi-note">' + ingredients.length + ' ingrédients au référentiel</span></div>' +
        '<div class="card kpi"><div class="kpi-ico">🚨</div><small>Alertes hausses de prix</small><div class="kpi-val" style="color:' + (trends.length ? 'var(--alerte)' : 'var(--ok)') + '">' + trends.length + '</div><span class="kpi-note">hausses &gt; 5 % sur 30 jours</span></div>' +
      '</div>' +
      '<div class="dash-grid">';

    // Food Cost par recette
    html += '<div class="card"><h3>Food Cost par recette</h3><p class="card-sub">Barres comparées à l\u2019objectif (trait vertical) — ' + UI.pct(obj) + '</p><div class="fc-bars">';
    if (!recipes.length) {
      html += '<div class="empty-state"><span class="big">📋</span>Aucune recette. Créez votre première fiche technique.</div>';
    } else {
      recipes.forEach((r, idx) => {
        const fc = fcs[idx];
        const cls = fcClass(fc, obj);
        const w = Core.clamp(fc / 80 * 100, 2, 100);
        html += '<div class="fc-bar-row"><span class="nm" title="' + UI.esc(r.nom) + '">' + UI.esc(r.nom) + '</span>' +
          '<div class="fc-track"><div class="fc-fill ' + cls + '" style="width:' + w.toFixed(1) + '%"></div>' +
          '<div class="fc-target-mark" style="left:' + (obj / 80 * 100).toFixed(1) + '%" title="Objectif ' + UI.pct(obj) + '"></div></div>' +
          '<b>' + UI.pct(fc) + '</b></div>';
      });
    }
    html += '</div></div>';

    // Alertes
    html += '<div class="card"><h3>Alertes de prix</h3><p class="card-sub">Hausse &gt; 5 % sur 30 jours — ancien → nouveau prix</p><div class="alert-list">';
    if (!trends.length) {
      html += '<div class="empty-state"><span class="big">✅</span>Aucune hausse significative sur 30 jours.</div>';
    } else {
      trends.sort((a, b) => b.t.pct - a.t.pct).forEach(({ ing, t }) => {
        html += '<div class="alert-item"><span class="nm">' + UI.esc(ing.nom) +
          '<small>' + UI.esc(ing.categorie) + ' · ' + UI.esc(ing.fournisseur || '—') + '</small></span>' +
          UI.sparkline((ing.historique || []).map(h => h.prix), { color: '#E86A1C', w: 84, h: 26 }) +
          '<span class="old-new">' + UI.money(t.old) + ' → <b>' + UI.money(t.now) + '</b><br>+' + UI.num(t.pct) + ' %</span></div>';
      });
    }
    html += '</div></div></div>';
    view.innerHTML = html;
  }

  /* ============================================================
     INGRÉDIENTS
     ============================================================ */
  let ingSearch = '';

  function renderIngredients() {
    setCrumb([{ label: 'Application', href: '#/dashboard', hideMobile: true }, { label: 'Ingrédients' }]);
    setSidebarActive('/ingredients');

    view.innerHTML =
      '<div class="page-head"><div><h1>Référentiel ingrédients</h1><p>Prix FCFA, unités, fournisseurs, historique et tendances 30 jours.</p></div>' +
      '<button class="btn btn-gold" id="btn-add-ing">+ Ajouter un ingrédient</button></div>' +
      '<div class="toolbar"><div class="search"><input type="search" id="ing-search" placeholder="Rechercher un ingrédient, une catégorie, un fournisseur…" value="' + UI.esc(ingSearch) + '"></div></div>' +
      '<div class="card" style="padding:0;"><div class="table-wrap"><table class="data" id="ing-table"></table></div></div>';

    document.getElementById('ing-search').addEventListener('input', (e) => {
      ingSearch = e.target.value;
      paintIngTable();
    });
    document.getElementById('btn-add-ing').addEventListener('click', () => ingredientModal(null));
    paintIngTable();
  }

  function paintIngTable() {
    const table = document.getElementById('ing-table');
    if (!table) return;
    const q = ingSearch.trim().toLowerCase();
    const list = Store.getIngredients().filter(i =>
      !q || (i.nom + ' ' + i.categorie + ' ' + (i.fournisseur || '')).toLowerCase().includes(q));

    let html = '<thead><tr><th>Ingrédient</th><th>Catégorie</th><th>Unité</th><th class="num">Prix unitaire</th>' +
      '<th>Fournisseur</th><th>Tendance 30 j</th><th></th></tr></thead><tbody>';
    if (!list.length) {
      html += '<tr><td colspan="7"><div class="empty-state"><span class="big">🧺</span>Aucun ingrédient ne correspond à la recherche.</div></td></tr>';
    }
    list.forEach(i => {
      const t = Core.priceTrend(i.historique);
      const cls = t.pct > 5 ? 'trend-up' : t.pct < -5 ? 'trend-down' : 'trend-flat';
      const arrow = t.pct > 0.05 ? '▲' : t.pct < -0.05 ? '▼' : '■';
      html += '<tr>' +
        '<td><strong>' + UI.esc(i.nom) + '</strong></td>' +
        '<td><span class="badge chip-cat">' + UI.esc(i.categorie) + '</span></td>' +
        '<td>' + UI.esc(i.unite) + '</td>' +
        '<td class="num"><strong>' + UI.money(i.prix_unitaire) + '</strong></td>' +
        '<td>' + UI.esc(i.fournisseur || '—') + '</td>' +
        '<td><div class="trend-cell">' + UI.sparkline((i.historique || []).map(h => h.prix), { color: cls === 'trend-up' ? '#E86A1C' : cls === 'trend-down' ? '#0A7A4B' : '#B8873A', w: 84, h: 24 }) +
        '<span class="trend-pct ' + cls + '">' + arrow + ' ' + UI.num(Math.abs(t.pct)) + ' %</span></div></td>' +
        '<td><div class="row-actions"><button class="btn btn-ghost btn-sm" data-edit="' + i.id + '">Modifier</button></div></td>' +
        '</tr>';
    });
    html += '</tbody>';
    table.innerHTML = html;
    table.querySelectorAll('[data-edit]').forEach(b =>
      b.addEventListener('click', () => {
        const ing = Store.getIngredients().find(x => x.id === b.dataset.edit);
        if (ing) ingredientModal(ing);
      }));
  }

  function ingredientModal(ing) {
    const editing = !!ing;
    const cats = [...new Set(Store.getIngredients().map(i => i.categorie))].sort();
    const body =
      '<div class="form-error" id="m-err"></div>' +
      '<div class="field"><label>Nom *</label><input id="f-nom" value="' + (editing ? UI.esc(ing.nom) : '') + '" placeholder="Ex. Tomate fraîche"></div>' +
      '<div class="field-row">' +
        '<div class="field"><label>Catégorie</label><input id="f-cat" list="cat-list" value="' + (editing ? UI.esc(ing.categorie) : '') + '" placeholder="Ex. Légumes">' +
        '<datalist id="cat-list">' + cats.map(c => '<option value="' + UI.esc(c) + '"></option>').join('') + '</datalist></div>' +
        '<div class="field"><label>Unité de prix *</label><select id="f-unite">' + unitOptions(editing ? ing.unite : 'kg') + '</select></div>' +
      '</div>' +
      '<div class="field-row">' +
        '<div class="field"><label>Prix unitaire (' + params().devise + ') *</label><input id="f-prix" type="number" min="0" step="1" value="' + (editing ? ing.prix_unitaire : '') + '"></div>' +
        '<div class="field"><label>Fournisseur</label><input id="f-fourn" value="' + (editing ? UI.esc(ing.fournisseur || '') : '') + '" placeholder="Ex. Marché de Cocody"></div>' +
      '</div>' +
      (editing ? '<p class="field-hint">Toute modification de prix recalcule instantanément les recettes et menus utilisant cet ingrédient.</p>' : '');

    UI.modal({
      title: editing ? 'Modifier — ' + ing.nom : 'Ajouter un ingrédient',
      body,
      actions: [
        { label: 'Annuler', class: 'btn-ghost', value: null },
        {
          label: editing ? 'Enregistrer' : 'Ajouter', class: 'btn-gold',
          onClick: (root) => {
            const nom = root.querySelector('#f-nom').value.trim();
            const cat = root.querySelector('#f-cat').value.trim() || 'Autre';
            const unite = root.querySelector('#f-unite').value;
            const prix = pn(root.querySelector('#f-prix').value);
            const fourn = root.querySelector('#f-fourn').value.trim();
            const err = root.querySelector('#m-err');
            if (!nom) { err.textContent = 'Le nom est obligatoire.'; err.classList.add('show'); return true; }
            if (prix < 0) { err.textContent = 'Le prix doit être positif.'; err.classList.add('show'); return true; }

            if (editing) {
              const oldPrice = ing.prix_unitaire;
              if (unite !== ing.unite || prix !== oldPrice) {
                // changement d'unité ou de prix => entrée dans l'historique
                Store.upsertIngredient({ id: ing.id, nom, categorie: cat, unite, fournisseur: fourn });
                Store.updateIngredientPrice(ing.id, prix);
                const usage = Store.usageCount(ing.id);
                UI.toast('Prix mis à jour — ' + usage.recettes + ' recette(s) et ' + usage.menus + ' menu(s) recalculés instantanément.', 'ok', 4200);
              } else {
                Store.upsertIngredient({ id: ing.id, nom, categorie: cat, unite, fournisseur: fourn });
                UI.toast('Ingrédient « ' + UI.esc(nom) + ' » enregistré.', 'ok');
              }
            } else {
              Store.upsertIngredient({ nom, categorie: cat, unite, prix_unitaire: prix, fournisseur: fourn });
              UI.toast('Ingrédient « ' + UI.esc(nom) + ' » ajouté au référentiel.', 'ok');
            }
            return false;
          },
        },
      ],
    }).then(() => paintIngTable());
  }

  /* ============================================================
     RECETTES
     ============================================================ */
  function renderRecipes() {
    setCrumb([{ label: 'Application', href: '#/dashboard', hideMobile: true }, { label: 'Recettes' }]);
    setSidebarActive('/recettes');
    const recipes = Store.getRecipes();
    const ingredients = Store.getIngredients();
    const obj = params().objectif_food_cost;

    let html = '<div class="page-head"><div><h1>Recettes</h1><p>Fiches techniques avec costing automatique — coût total et coût portion en direct.</p></div>' +
      '<button class="btn btn-gold" id="btn-new-recipe">+ Nouvelle recette</button></div>';

    if (!recipes.length) {
      html += '<div class="card"><div class="empty-state"><span class="big">📋</span>Aucune recette pour le moment. Créez votre première fiche technique.</div></div>';
    } else {
      html += '<div class="recipes-grid">';
      recipes.forEach(r => {
        const c = calc(r, ingredients);
        html += '<article class="card recipe-card" data-open="' + r.id + '" tabindex="0" role="link" aria-label="Ouvrir ' + UI.esc(r.nom) + '">' +
          UI.fcBadge(c.fc, obj) +
          '<h3>' + UI.esc(r.nom) + '</h3>' +
          '<div class="recipe-meta"><span class="badge chip-cat">' + UI.esc(r.categorie) + '</span><span>🍽 ' + r.portions + ' portions</span><span>⏱ ' + r.temps + ' min</span></div>' +
          '<div class="recipe-figs">' +
            '<div class="recipe-fig"><small>Coût / portion</small><strong>' + UI.money(c.portion) + '</strong></div>' +
            '<div class="recipe-fig"><small>Prix vente HT</small><strong>' + UI.money(r.prix_vente_ht) + '</strong></div>' +
          '</div></article>';
      });
      html += '</div>';
    }
    view.innerHTML = html;
    document.getElementById('btn-new-recipe').addEventListener('click', () => recipeModal());
    view.querySelectorAll('[data-open]').forEach(card => {
      const go = () => { location.hash = '#/recettes/' + card.dataset.open; };
      card.addEventListener('click', go);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    });
  }

  /* --- Modale création de recette avec lignes dynamiques --- */
  function recipeModal() {
    const ingredients = Store.getIngredients();
    let lignes = []; // { ingredient_id, quantite, unite }

    const cats = [...new Set(Store.getRecipes().map(r => r.categorie))].concat(['Plats', 'Grillades', 'Sauces & plats', 'Street food', 'Accompagnements', 'Desserts', 'Boissons', 'Entrées']);
    const catList = [...new Set(cats)].sort();

    const body =
      '<div class="form-error" id="m-err"></div>' +
      '<div class="field-row">' +
        '<div class="field"><label>Nom de la recette *</label><input id="f-nom" placeholder="Ex. Kedjenou de poulet"></div>' +
        '<div class="field"><label>Catégorie</label><input id="f-cat" list="rcat-list" placeholder="Ex. Plats"><datalist id="rcat-list">' + catList.map(c => '<option value="' + UI.esc(c) + '"></option>').join('') + '</datalist></div>' +
      '</div>' +
      '<div class="field-row-3">' +
        '<div class="field"><label>Portions *</label><input id="f-portions" type="number" min="1" step="1" value="4"></div>' +
        '<div class="field"><label>Temps (min)</label><input id="f-temps" type="number" min="0" step="5" value="45"></div>' +
        '<div class="field"><label>Prix vente HT</label><input id="f-prix" type="number" min="0" step="100" value="3000"></div>' +
      '</div>' +
      '<div class="field"><label>Ingrédients &amp; quantités</label><div id="m-lignes"></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="m-add-line" style="margin-top:8px;">+ Ajouter une ligne</button></div>' +
      '<div class="lines-total"><span>Coût recette — <span id="m-cost">0</span></span><span>Coût portion — <span id="m-portion">0</span></span></div>' +
      '<div class="field" style="margin-top:14px;"><label>Instructions</label><textarea id="f-instr" placeholder="Étapes de préparation…"></textarea></div>';

    UI.modal({
      title: 'Nouvelle recette',
      body, wide: true,
      onMount: (root) => {
        const lignesHost = root.querySelector('#m-lignes');
        function paintLines() {
          if (!lignes.length) {
            lignesHost.innerHTML = '<p class="field-hint" style="margin:6px 0;">Aucun ingrédient — ajoutez des lignes pour activer le costing.</p>';
          } else {
            lignesHost.innerHTML = '<table class="lines-table"><thead><tr><th>Ingrédient</th><th>Qté</th><th>Unité</th><th class="num">Coût</th><th></th></tr></thead><tbody>' +
              lignes.map((l, idx) => {
                const ing = ingredients.find(i => i.id === l.ingredient_id);
                const cost = ing ? Core.lineCost(l, ingredients) : 0;
                const compat = ing ? Core.compatibleUnits(ing.unite) : ['kg'];
                return '<tr><td><select data-line="' + idx + '" data-f="ing">' + ingredientOptions(ingredients, l.ingredient_id) + '</select></td>' +
                  '<td><input type="number" min="0" step="0.01" value="' + l.quantite + '" data-line="' + idx + '" data-f="qte"></td>' +
                  '<td><select data-line="' + idx + '" data-f="unite">' + compat.map(u => '<option' + (u === l.unite ? ' selected' : '') + '>' + u + '</option>').join('') + '</select></td>' +
                  '<td class="num">' + UI.money(cost) + '</td>' +
                  '<td><button type="button" class="line-del" data-del="' + idx + '" aria-label="Supprimer la ligne">🗑</button></td></tr>';
              }).join('') + '</tbody></table>';
          }
          // totaux en direct
          const tmp = { lignes, portions: Math.max(1, pn(root.querySelector('#f-portions').value)) };
          const cost = Core.recipeCost(tmp, ingredients);
          root.querySelector('#m-cost').textContent = UI.money(cost);
          root.querySelector('#m-portion').textContent = UI.money(cost / tmp.portions);

          lignesHost.querySelectorAll('select[data-f="ing"]').forEach(sel => sel.addEventListener('change', () => {
            const l = lignes[+sel.dataset.line];
            const ing = ingredients.find(i => i.id === sel.value);
            l.ingredient_id = sel.value;
            if (ing && !Core.compatibleUnits(ing.unite).includes(l.unite)) l.unite = ing.unite;
            paintLines();
          }));
          lignesHost.querySelectorAll('input[data-f="qte"]').forEach(inp => inp.addEventListener('input', () => {
            lignes[+inp.dataset.line].quantite = pn(inp.value);
            paintLines();
            const active = lignesHost.querySelector('input[data-line="' + inp.dataset.line + '"]');
            // ne pas perdre le focus pendant la saisie : on ne repeint que si besoin
          }));
          lignesHost.querySelectorAll('input[data-f="qte"]').forEach(inp => inp.addEventListener('change', paintLines));
          lignesHost.querySelectorAll('select[data-f="unite"]').forEach(sel => sel.addEventListener('change', () => {
            lignes[+sel.dataset.line].unite = sel.value;
            paintLines();
          }));
          lignesHost.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
            lignes.splice(+b.dataset.del, 1);
            paintLines();
          }));
        }
        root.querySelector('#m-add-line').addEventListener('click', () => {
          lignes.push({ ingredient_id: ingredients[0] ? ingredients[0].id : '', quantite: 1, unite: ingredients[0] ? ingredients[0].unite : 'kg' });
          paintLines();
        });
        root.querySelector('#f-portions').addEventListener('input', paintLines);
        paintLines();
      },
      actions: [
        { label: 'Annuler', class: 'btn-ghost', value: null },
        {
          label: 'Créer la recette', class: 'btn-gold',
          onClick: (root) => {
            const err = root.querySelector('#m-err');
            const nom = root.querySelector('#f-nom').value.trim();
            const portions = Math.max(1, Math.round(pn(root.querySelector('#f-portions').value)));
            const prix = pn(root.querySelector('#f-prix').value);
            if (!nom) { err.textContent = 'Le nom de la recette est obligatoire.'; err.classList.add('show'); return true; }
            if (!lignes.length) { err.textContent = 'Ajoutez au moins un ingrédient pour le costing.'; err.classList.add('show'); return true; }
            const clean = lignes.filter(l => l.ingredient_id && l.quantite > 0);
            if (!clean.length) { err.textContent = 'Chaque ligne doit avoir un ingrédient et une quantité supérieure à 0.'; err.classList.add('show'); return true; }
            const rec = Store.upsertRecipe({
              nom,
              categorie: root.querySelector('#f-cat').value.trim() || 'Plats',
              portions,
              temps: Math.max(0, Math.round(pn(root.querySelector('#f-temps').value))),
              prix_vente_ht: prix,
              instructions: root.querySelector('#f-instr').value.trim(),
              lignes: clean,
            });
            UI.toast('Recette « ' + UI.esc(nom) + ' » créée — costing calculé.', 'ok');
            setTimeout(() => { location.hash = '#/recettes/' + rec.id; }, 250);
            return false;
          },
        },
      ],
    });
  }

  /* ============================================================
     FICHE RECETTE : costing, lignes éditables, simulation, nutrition
     ============================================================ */
  function renderRecipeDetail(id) {
    const ingredients = Store.getIngredients();
    let recipe = Store.getRecipe(id);
    if (!recipe) { location.hash = '#/recettes'; return; }
    setCrumb([
      { label: 'Application', href: '#/dashboard', hideMobile: true },
      { label: 'Recettes', href: '#/recettes' },
      { label: recipe.nom },
    ]);
    setSidebarActive('/recettes');

    let simuPrix = Core.clamp(recipe.prix_vente_ht || 1000, 500, 20000);
    let simuObj = params().objectif_food_cost;

    view.innerHTML =
      '<div class="page-head">' +
        '<div><h1>' + UI.esc(recipe.nom) + '</h1><p><span class="badge chip-cat">' + UI.esc(recipe.categorie) + '</span> &nbsp;🍽 <span id="d-portions">' + recipe.portions + '</span> portions · ⏱ <span id="d-temps">' + recipe.temps + '</span> min</p></div>' +
        '<div style="display:flex;gap:10px;"><button class="btn btn-ghost" id="btn-edit-meta">✏️ Modifier la fiche</button>' +
        '<button class="btn btn-danger btn-sm" id="btn-del-recipe" style="align-self:center;">Supprimer</button></div>' +
      '</div>' +
      '<div class="kpi-strip" id="d-kpis"></div>' +
      '<div class="detail-grid">' +
        '<div style="display:grid;gap:18px;">' +
          '<div class="card"><h3>Ingrédients</h3><p class="card-sub">Coûts calculés en direct — conversions automatiques par famille d\u2019unités.</p>' +
            '<div id="d-lines"></div>' +
            '<button type="button" class="btn btn-ghost btn-sm" id="d-add-line" style="margin-top:10px;">+ Ajouter une ligne</button>' +
            '<div class="lines-total"><span>Coût recette — <span id="d-cost"></span></span><span>Coût portion — <span id="d-portion"></span></span></div>' +
          '</div>' +
          '<div class="card"><h3>Instructions</h3><p id="d-instr" style="margin-top:10px;font-size:14px;white-space:pre-line;"></p></div>' +
        '</div>' +
        '<div style="display:grid;gap:18px;">' +
          '<div class="card"><h3>Simulation temps réel</h3><p class="card-sub">Sans sauvegarde — ajustez, comparez, appliquez.</p><div class="simu-block" id="d-simu"></div></div>' +
          '<div class="card"><h3>Carte nutritionnelle</h3><p class="card-sub">Recalculée à chaque ajout / suppression / quantité / unité.</p><div id="d-nutri"></div></div>' +
        '</div>' +
      '</div>';

    /* ---- KPIs ---- */
    function paintKPIs() {
      recipe = Store.getRecipe(id);
      const c = calc(recipe, ingredients);
      const cls = fcClass(c.fc, c.objectif);
      document.getElementById('d-kpis').innerHTML =
        '<div class="kpi-mini"><small>Coût recette</small><strong>' + UI.money(c.cost) + '</strong></div>' +
        '<div class="kpi-mini"><small>Coût portion</small><strong>' + UI.money(c.portion) + '</strong></div>' +
        '<div class="kpi-mini"><small>Marge matière</small><strong style="color:' + (c.marge >= 0 ? 'var(--ok)' : 'var(--rouge)') + '">' + UI.money(c.marge) + '</strong></div>' +
        '<div class="kpi-mini"><small>Prix théorique</small><strong>' + UI.money(c.theo) + '</strong></div>' +
        '<div class="kpi-mini"><small>Prix TTC indicatif</small><strong>' + UI.money(c.ttc) + '</strong></div>' +
        '<div class="kpi-mini" style="grid-column:span 5;"><small>Food Cost actuel (prix ' + UI.money(recipe.prix_vente_ht) + ' · objectif ' + UI.pct(c.objectif) + ')</small>' +
        '<strong style="color:var(--' + (cls === 'ok' ? 'ok' : cls === 'warn' ? 'alerte' : 'rouge') + ')">' + UI.pct(c.fc) + '</strong></div>';
      document.getElementById('d-cost').textContent = UI.money(c.cost);
      document.getElementById('d-portion').textContent = UI.money(c.portion);
      document.getElementById('d-instr').textContent = recipe.instructions || '—';
      document.getElementById('d-portions').textContent = recipe.portions;
      document.getElementById('d-temps').textContent = recipe.temps;
    }

    /* ---- Lignes éditables ---- */
    function paintLines() {
      recipe = Store.getRecipe(id);
      const host = document.getElementById('d-lines');
      if (!recipe.lignes.length) {
        host.innerHTML = '<div class="empty-state"><span class="big">🧺</span>Aucun ingrédient. Ajoutez une ligne pour démarrer le costing.</div>';
      } else {
        host.innerHTML = '<table class="lines-table"><thead><tr><th>Ingrédient</th><th>Prix réf.</th><th>Qté</th><th>Unité</th><th class="num">Coût</th><th></th></tr></thead><tbody>' +
          recipe.lignes.map((l, idx) => {
            const ing = ingredients.find(i => i.id === l.ingredient_id);
            if (!ing) return '';
            const compat = Core.compatibleUnits(ing.unite);
            return '<tr><td><strong>' + UI.esc(ing.nom) + '</strong></td>' +
              '<td style="color:var(--texte-doux);">' + UI.money(ing.prix_unitaire) + ' / ' + ing.unite + '</td>' +
              '<td><input type="number" min="0" step="0.01" value="' + l.quantite + '" data-line="' + idx + '" data-f="qte" aria-label="Quantité"></td>' +
              '<td><select data-line="' + idx + '" data-f="unite" aria-label="Unité">' + compat.map(u => '<option' + (u === l.unite ? ' selected' : '') + '>' + u + '</option>').join('') + '</select></td>' +
              '<td class="num" id="lc-' + idx + '">' + UI.money(Core.lineCost(l, ingredients)) + '</td>' +
              '<td><button type="button" class="line-del" data-del="' + idx + '" aria-label="Supprimer">🗑</button></td></tr>';
          }).join('') + '</tbody></table>';
      }
      host.querySelectorAll('input[data-f="qte"]').forEach(inp => {
        inp.addEventListener('input', () => {
          const idx = +inp.dataset.line;
          recipe.lignes[idx].quantite = pn(inp.value);
          document.getElementById('lc-' + idx).textContent = UI.money(Core.lineCost(recipe.lignes[idx], ingredients));
          paintKPIs(); paintSimu(); paintNutri(); save();
        });
      });
      host.querySelectorAll('select[data-f="unite"]').forEach(sel => {
        sel.addEventListener('change', () => {
          const idx = +sel.dataset.line;
          recipe.lignes[idx].unite = sel.value;
          document.getElementById('lc-' + idx).textContent = UI.money(Core.lineCost(recipe.lignes[idx], ingredients));
          paintKPIs(); paintSimu(); paintNutri(); save();
        });
      });
      host.querySelectorAll('[data-del]').forEach(b => {
        b.addEventListener('click', async () => {
          const idx = +b.dataset.del;
          const ok = await UI.confirmDialog('Retirer « ' + UI.esc(ingredients.find(i => i.id === recipe.lignes[idx].ingredient_id).nom) + ' » de cette recette ?', { title: 'Supprimer la ligne', danger: true, okLabel: 'Retirer' });
          if (!ok) return;
          recipe.lignes.splice(idx, 1);
          save(); paintLines(); paintKPIs(); paintSimu(); paintNutri();
          UI.toast('Ligne supprimée — coûts et nutrition recalculés.', 'ok');
        });
      });
    }
    let saveTimer = null;
    function save() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => Store.upsertRecipe({ id: recipe.id, lignes: recipe.lignes }), 400);
    }

    document.getElementById('d-add-line').addEventListener('click', () => {
      const used = new Set(recipe.lignes.map(l => l.ingredient_id));
      const free = ingredients.filter(i => !used.has(i.id));
      if (!free.length) { UI.toast('Tous les ingrédients du référentiel sont déjà utilisés.', 'warn'); return; }
      const body =
        '<div class="field"><label>Ingrédient</label><select id="al-ing">' +
        free.map(i => '<option value="' + i.id + '" data-unite="' + i.unite + '">' + UI.esc(i.nom) + ' (' + i.unite + ' · ' + UI.money(i.prix_unitaire) + ')</option>').join('') +
        '</select></div>' +
        '<div class="field-row"><div class="field"><label>Quantité</label><input id="al-qte" type="number" min="0" step="0.01" value="1"></div>' +
        '<div class="field"><label>Unité</label><select id="al-unite"></select></div></div>' +
        '<p class="field-hint" id="al-cost"></p>';
      UI.modal({
        title: 'Ajouter un ingrédient', body,
        onMount: (root) => {
          const selIng = root.querySelector('#al-ing'), selU = root.querySelector('#al-unite'), qte = root.querySelector('#al-qte'), costEl = root.querySelector('#al-cost');
          function sync() {
            const ing = ingredients.find(i => i.id === selIng.value);
            selU.innerHTML = Core.compatibleUnits(ing.unite).map(u => '<option' + (u === ing.unite ? ' selected' : '') + '>' + u + '</option>').join('');
            preview();
          }
          function preview() {
            const ing = ingredients.find(i => i.id === selIng.value);
            const c = Core.ingredientCost(pn(qte.value), selU.value, ing.prix_unitaire, ing.unite);
            costEl.textContent = 'Coût de la ligne : ' + UI.money(isNaN(c) ? 0 : c);
          }
          selIng.addEventListener('change', sync);
          selU.addEventListener('change', preview);
          qte.addEventListener('input', preview);
          sync();
        },
        actions: [
          { label: 'Annuler', class: 'btn-ghost', value: null },
          {
            label: 'Ajouter', class: 'btn-gold',
            onClick: (root) => {
              const q = pn(root.querySelector('#al-qte').value);
              if (q <= 0) return true;
              recipe.lignes.push({
                ingredient_id: root.querySelector('#al-ing').value,
                quantite: q,
                unite: root.querySelector('#al-unite').value,
              });
              save(); paintLines(); paintKPIs(); paintSimu(); paintNutri();
              UI.toast('Ingrédient ajouté — costing et nutrition recalculés.', 'ok');
              return false;
            },
          },
        ],
      });
    });

    /* ---- Simulation ---- */
    function paintSimu() {
      recipe = Store.getRecipe(id);
      const c = calc(recipe, ingredients);
      const host = document.getElementById('d-simu');
      if (!host.querySelector('#sl-prix')) {
        host.innerHTML =
          '<div class="slider-field"><label>Prix de vente simulé (HT) <output id="out-prix"></output></label>' +
          '<input type="range" id="sl-prix" min="500" max="20000" step="100"></div>' +
          '<div class="slider-field"><label>Objectif Food Cost simulé <output id="out-obj"></output></label>' +
          '<input type="range" id="sl-obj" min="10" max="70" step="1"></div>' +
          '<div class="gauge-wrap"><div class="gauge-top"><strong id="g-fc"></strong><span>Food Cost simulé · cible <span id="g-target"></span></span></div>' +
          '<div class="gauge-track"><div class="gauge-fill" id="g-fill"></div><div class="fc-target-mark" id="g-mark"></div></div>' +
          '<div class="gauge-marks"><span>0 %</span><span>35 %</span><span>70 %+</span></div></div>' +
          '<div class="simu-figs"><div class="simu-fig"><small>Prix conseillé (objectif)</small><strong id="s-theo"></strong></div>' +
          '<div class="simu-fig"><small>Marge simulée</small><strong id="s-marge"></strong></div></div>' +
          '<button class="btn btn-gold" id="btn-apply" style="width:100%;">Appliquer le prix simulé</button>';
        const slP = host.querySelector('#sl-prix'), slO = host.querySelector('#sl-obj');
        slP.addEventListener('input', updateSimu);
        slO.addEventListener('input', updateSimu);
        host.querySelector('#btn-apply').addEventListener('click', () => {
          Store.upsertRecipe({ id: recipe.id, prix_vente_ht: simuPrix });
          UI.toast('Prix de vente appliqué : ' + UI.money(simuPrix) + ' — Food Cost mis à jour partout.', 'ok');
          paintKPIs();
        });
      }
      host.querySelector('#sl-prix').value = simuPrix;
      host.querySelector('#sl-obj').value = simuObj;
      updateSimu();
    }
    function updateSimu() {
      const host = document.getElementById('d-simu');
      const c = calc(recipe, ingredients);
      host.querySelector('#out-prix').textContent = UI.money(simuPrix);
      host.querySelector('#out-obj').textContent = UI.pct(simuObj, 0);
      const fcSim = Core.foodCostPct(c.portion, simuPrix);
      const cls = fcClass(fcSim, simuObj);
      host.querySelector('#g-fc').textContent = UI.pct(fcSim);
      host.querySelector('#g-fc').style.color = 'var(--' + (cls === 'ok' ? 'ok' : cls === 'warn' ? 'alerte' : 'rouge') + ')';
      host.querySelector('#g-target').textContent = UI.pct(simuObj, 0);
      const scaleMax = Math.max(70, Math.ceil(fcSim / 10) * 10);
      host.querySelector('#g-fill').style.width = Core.clamp(fcSim / scaleMax * 100, 1, 100) + '%';
      host.querySelector('#g-fill').style.background = cls === 'ok'
        ? 'linear-gradient(90deg,#2FA97C,#0A7A4B)'
        : cls === 'warn' ? 'linear-gradient(90deg,#F2A65A,#E86A1C)' : 'linear-gradient(90deg,#E07A6A,#C0392B)';
      host.querySelector('#g-mark').style.left = Core.clamp(simuObj / scaleMax * 100, 0, 100) + '%';
      host.querySelector('#s-theo').textContent = UI.money(Core.theoreticalPrice(c.portion, simuObj));
      const m = Core.marge(simuPrix, c.portion);
      host.querySelector('#s-marge').textContent = UI.money(m);
      host.querySelector('#s-marge').style.color = m >= 0 ? 'var(--ok)' : 'var(--rouge)';
    }
    document.getElementById('d-simu').addEventListener('input', (e) => {
      if (e.target.id === 'sl-prix') simuPrix = +e.target.value;
      if (e.target.id === 'sl-obj') simuObj = +e.target.value;
    });

    /* ---- Nutrition ---- */
    function paintNutri() {
      recipe = Store.getRecipe(id);
      const host = document.getElementById('d-nutri');
      const n = Core.recipeNutrition(recipe, ingredients);
      if (!n.available) {
        host.innerHTML = '<div class="nutri-unavailable"><span class="big">🥗</span><strong>Donnée nutritionnelle indisponible</strong>' +
          '<p style="font-size:13px;margin-top:6px;">Aucun des ingrédients de cette recette ne dispose de données nutritionnelles.</p></div>';
        return;
      }
      const t = n.totals;
      const rows = [
        { k: 'proteines', lbl: 'Protéines', unit: 'g' },
        { k: 'glucides', lbl: 'Glucides', unit: 'g' },
        { k: 'lipides', lbl: 'Lipides', unit: 'g' },
        { k: 'fibres', lbl: 'Fibres', unit: 'g' },
        { k: 'sucres', lbl: 'Sucres', unit: 'g' },
        { k: 'sodium', lbl: 'Sodium', unit: 'mg' },
      ];
      let html = '<div class="nutri-head"><div class="nutri-kcal"><strong>' + UI.num(t.calories, 0) + '</strong> <span>kcal / recette</span>' +
        '<div style="font-size:12px;color:var(--texte-doux);">' + UI.num(t.calories / Math.max(1, recipe.portions), 0) + ' kcal / portion</div></div>' +
        '<div class="nutri-per">Repères journaliers<br>(2 000 kcal)</div></div><div class="nutri-rows">';
      rows.forEach(r => {
        const v = t[r.k] || 0;
        const ref = Core.DAILY_REF[r.k];
        const p = Core.clamp(v / ref * 100, 0, 100);
        html += '<div class="nutri-row"><span class="lbl">' + r.lbl + '</span>' +
          '<div class="nutri-track"><div class="nutri-fill' + (v > ref ? ' over' : '') + '" style="width:' + p.toFixed(1) + '%"></div></div>' +
          '<span class="val"><b>' + UI.num(v, v >= 100 ? 0 : 1) + '</b> ' + r.unit + ' · ' + UI.pct(v / ref * 100, 0) + '</span></div>';
      });
      html += '</div>';
      if (n.missing.length) {
        html += '<div class="nutri-missing">⚠ Données partielles — sans information nutritionnelle : ' + n.missing.map(UI.esc).join(', ') + '.</div>';
      }
      host.innerHTML = html;
    }

    /* ---- Méta & suppression ---- */
    document.getElementById('btn-edit-meta').addEventListener('click', () => {
      const body =
        '<div class="field"><label>Nom *</label><input id="f-nom" value="' + UI.esc(recipe.nom) + '"></div>' +
        '<div class="field-row"><div class="field"><label>Catégorie</label><input id="f-cat" value="' + UI.esc(recipe.categorie) + '"></div>' +
        '<div class="field"><label>Temps (min)</label><input id="f-temps" type="number" min="0" value="' + recipe.temps + '"></div></div>' +
        '<div class="field-row"><div class="field"><label>Portions *</label><input id="f-portions" type="number" min="1" value="' + recipe.portions + '"></div>' +
        '<div class="field"><label>Prix vente HT</label><input id="f-prix" type="number" min="0" step="100" value="' + recipe.prix_vente_ht + '"></div></div>' +
        '<div class="field"><label>Instructions</label><textarea id="f-instr">' + UI.esc(recipe.instructions || '') + '</textarea></div>' +
        '<div class="form-error" id="m-err"></div>';
      UI.modal({
        title: 'Modifier la fiche', body,
        actions: [
          { label: 'Annuler', class: 'btn-ghost', value: null },
          {
            label: 'Enregistrer', class: 'btn-gold',
            onClick: (root) => {
              const nom = root.querySelector('#f-nom').value.trim();
              const portions = Math.max(1, Math.round(pn(root.querySelector('#f-portions').value)));
              if (!nom) { const e = root.querySelector('#m-err'); e.textContent = 'Le nom est obligatoire.'; e.classList.add('show'); return true; }
              Store.upsertRecipe({
                id: recipe.id, nom, categorie: root.querySelector('#f-cat').value.trim() || 'Plats',
                portions, temps: Math.max(0, Math.round(pn(root.querySelector('#f-temps').value))),
                prix_vente_ht: pn(root.querySelector('#f-prix').value),
                instructions: root.querySelector('#f-instr').value.trim(),
              });
              UI.toast('Fiche enregistrée.', 'ok');
              setTimeout(() => route(), 200);
              return false;
            },
          },
        ],
      });
    });
    document.getElementById('btn-del-recipe').addEventListener('click', async () => {
      const ok = await UI.confirmDialog('Supprimer définitivement la recette « ' + UI.esc(recipe.nom) + ' » ? Les menus qui la contiennent seront mis à jour.', { title: 'Supprimer la recette', danger: true, okLabel: 'Supprimer' });
      if (!ok) return;
      Store.deleteRecipe(recipe.id);
      UI.toast('Recette supprimée.', 'ok');
      location.hash = '#/recettes';
    });

    paintLines(); paintKPIs(); paintSimu(); paintNutri();
  }

  /* ============================================================
     MENU BUILDER
     ============================================================ */
  let builderLines = [];

  function menuFigures(lines) {
    const ingredients = Store.getIngredients();
    const recipes = Store.getRecipes();
    const obj = params().objectif_food_cost;
    let cout = 0, prix = 0;
    lines.forEach(l => {
      const r = recipes.find(x => x.id === l.recette_id);
      if (!r) return;
      cout += Core.portionCost(r, ingredients) * l.quantite;
      prix += (r.prix_vente_ht || 0) * l.quantite;
    });
    const fc = prix > 0 ? (cout / prix) * 100 : 0;
    return { cout, prix, fc, marge: prix - cout, minPrice: Core.theoreticalPrice(cout, obj), obj };
  }

  function renderMenus() {
    setCrumb([{ label: 'Application', href: '#/dashboard', hideMobile: true }, { label: 'Menus' }]);
    setSidebarActive('/menus');
    const recipes = Store.getRecipes();

    view.innerHTML =
      '<div class="page-head"><div><h1>Menu Builder</h1><p>Assemblez vos recettes : coût global du repas, prix conseillé et Food Cost du menu.</p></div></div>' +
      '<div class="menu-grid">' +
        '<div style="display:grid;gap:18px;">' +
          '<div class="card"><h3>Composition du menu</h3><p class="card-sub">Ajoutez des recettes avec leurs quantités (en portions servies).</p>' +
            '<div class="toolbar" style="margin-bottom:14px;"><select id="mb-pick" style="flex:1;padding:11px 13px;border-radius:10px;border:1px solid var(--bordure);background:#fff;font-family:inherit;">' +
            recipes.map(r => '<option value="' + r.id + '">' + UI.esc(r.nom) + '</option>').join('') + '</select>' +
            '<button class="btn btn-primary" id="mb-add">+ Ajouter</button></div>' +
            '<div id="mb-lines"></div>' +
          '</div>' +
          '<div class="card"><h3>Menus enregistrés</h3><p class="card-sub">Charger ou supprimer — les coûts suivent les prix du référentiel.</p><div class="saved-menus" id="mb-saved"></div></div>' +
        '</div>' +
        '<div class="card"><h3>Récapitulatif</h3><p class="card-sub">Objectif Food Cost : ' + UI.pct(params().objectif_food_cost) + '</p><div class="menu-summary" id="mb-summary"></div>' +
        '<button class="btn btn-gold" id="mb-save" style="width:100%;margin-top:16px;">💾 Enregistrer ce menu</button></div>' +
      '</div>';

    if (!recipes.length) {
      view.querySelector('#mb-pick').innerHTML = '<option value="">Aucune recette disponible</option>';
      view.querySelector('#mb-add').disabled = true;
    }
    document.getElementById('mb-add').addEventListener('click', () => {
      const id = document.getElementById('mb-pick').value;
      if (!id) return;
      const ex = builderLines.find(l => l.recette_id === id);
      if (ex) ex.quantite += 1; else builderLines.push({ recette_id: id, quantite: 1 });
      paintBuilder();
    });
    document.getElementById('mb-save').addEventListener('click', async () => {
      if (!builderLines.length) { UI.toast('Ajoutez au moins une recette au menu.', 'warn'); return; }
      const body = '<div class="field"><label>Nom du menu *</label><input id="mn-nom" placeholder="Ex. Formule Midi du Plateau"></div><div class="form-error" id="m-err"></div>';
      const res = await UI.modal({
        title: 'Enregistrer le menu', body,
        actions: [
          { label: 'Annuler', class: 'btn-ghost', value: null },
          {
            label: 'Enregistrer', class: 'btn-gold',
            onClick: (root) => {
              const nom = root.querySelector('#mn-nom').value.trim();
              if (!nom) { const e = root.querySelector('#m-err'); e.textContent = 'Le nom du menu est obligatoire.'; e.classList.add('show'); return true; }
              Store.addMenu(nom, Store.clone(builderLines));
              UI.toast('Menu « ' + UI.esc(nom) + ' » enregistré.', 'ok');
              return false;
            },
          },
        ],
      });
      if (res !== null) paintSaved();
    });
    paintBuilder(); paintSaved();
  }

  function paintBuilder() {
    const host = document.getElementById('mb-lines');
    if (!host) return;
    const recipes = Store.getRecipes();
    const ingredients = Store.getIngredients();
    if (!builderLines.length) {
      host.innerHTML = '<div class="empty-state"><span class="big">🍽️</span>Menu vide — ajoutez des recettes pour calculer le coût du repas.</div>';
    } else {
      host.innerHTML = builderLines.map((l, idx) => {
        const r = recipes.find(x => x.id === l.recette_id);
        if (!r) return '';
        const portion = Core.portionCost(r, ingredients);
        return '<div class="menu-line"><div><strong>' + UI.esc(r.nom) + '</strong>' +
          '<small>' + UI.money(portion) + ' / portion · ' + UI.money(r.prix_vente_ht) + ' prix HT</small></div>' +
          '<div class="qty-stepper"><button type="button" data-q="-" data-i="' + idx + '" aria-label="Moins">−</button><span>' + l.quantite + '</span><button type="button" data-q="+" data-i="' + idx + '" aria-label="Plus">+</button></div>' +
          '<strong style="min-width:96px;text-align:right;">' + UI.money(portion * l.quantite) + '</strong>' +
          '<button type="button" class="line-del" data-rm="' + idx + '" aria-label="Retirer">🗑</button></div>';
      }).join('');
      host.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
        const i = +b.dataset.i;
        builderLines[i].quantite = Math.max(1, builderLines[i].quantite + (b.dataset.q === '+' ? 1 : -1));
        paintBuilder();
      }));
      host.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
        builderLines.splice(+b.dataset.rm, 1);
        paintBuilder();
      }));
    }
    const f = menuFigures(builderLines);
    const cls = fcClass(f.fc, f.obj);
    document.getElementById('mb-summary').innerHTML =
      '<div class="sum-row"><span>Coût global du repas</span><b>' + UI.money(f.cout) + '</b></div>' +
      '<div class="sum-row"><span>Prix cumulé (HT)</span><b>' + UI.money(f.prix) + '</b></div>' +
      '<div class="sum-row"><span>Marge matière</span><b style="color:' + (f.marge >= 0 ? 'var(--ok)' : 'var(--rouge)') + '">' + UI.money(f.marge) + '</b></div>' +
      '<div class="sum-row"><span>Prix minimum conseillé <small>(objectif ' + UI.pct(f.obj) + ')</small></span><b>' + UI.money(f.minPrice) + '</b></div>' +
      '<div class="sum-row total"><span>Food Cost du menu ' + UI.fcBadge(f.fc, f.obj) + '</span><b>' + UI.pct(f.fc) + '</b></div>';
    paintSaved();
  }

  function paintSaved() {
    const host = document.getElementById('mb-saved');
    if (!host) return;
    const menus = Store.getMenus();
    if (!menus.length) {
      host.innerHTML = '<div class="empty-state"><span class="big">💾</span>Aucun menu enregistré.</div>';
      return;
    }
    host.innerHTML = menus.map(m => {
      const f = menuFigures(m.lignes || []);
      const nb = (m.lignes || []).reduce((s, l) => s + l.quantite, 0);
      return '<div class="saved-menu"><div><strong>' + UI.esc(m.nom) + '</strong>' +
        '<small>' + (m.lignes || []).length + ' recette(s) · ' + nb + ' portion(s) · coût ' + UI.money(f.cout) + ' · FC ' + UI.pct(f.fc) + '</small></div>' +
        '<div style="display:flex;gap:8px;"><button class="btn btn-ghost btn-sm" data-load="' + m.id + '">Charger</button>' +
        '<button class="btn btn-danger btn-sm" data-delm="' + m.id + '">Supprimer</button></div></div>';
    }).join('');
    host.querySelectorAll('[data-load]').forEach(b => b.addEventListener('click', () => {
      const m = Store.getMenus().find(x => x.id === b.dataset.load);
      builderLines = Store.clone(m.lignes || []);
      paintBuilder();
      UI.toast('Menu « ' + UI.esc(m.nom) + ' » chargé dans le builder.', 'ok');
    }));
    host.querySelectorAll('[data-delm]').forEach(b => b.addEventListener('click', async () => {
      const m = Store.getMenus().find(x => x.id === b.dataset.delm);
      const ok = await UI.confirmDialog('Supprimer le menu « ' + UI.esc(m.nom) + ' » ?', { title: 'Supprimer le menu', danger: true, okLabel: 'Supprimer' });
      if (!ok) return;
      Store.deleteMenu(m.id);
      UI.toast('Menu supprimé.', 'ok');
      paintSaved();
    }));
  }

  /* ============================================================
     PARAMÈTRES
     ============================================================ */
  function renderSettings() {
    setCrumb([{ label: 'Application', href: '#/dashboard', hideMobile: true }, { label: 'Paramètres' }]);
    setSidebarActive('/parametres');
    const p = params();

    view.innerHTML =
      '<div class="page-head"><div><h1>Paramètres</h1><p>Objectif Food Cost, TVA et devise d\u2019affichage — persistés après actualisation et reconnexion.</p></div></div>' +
      '<div class="settings-grid">' +
        '<div class="card"><h3>Paramètres de calcul</h3><p class="card-sub">Utilisés par tous les modules : tableau de bord, simulation, menus.</p>' +
          '<div class="field"><label>Objectif Food Cost (%)</label><input id="st-obj" type="number" min="5" max="80" step="1" value="' + p.objectif_food_cost + '"><p class="field-hint">Prix théorique = coût portion ÷ objectif. Alertes si dépassé.</p></div>' +
          '<div class="field"><label>TVA (%)</label><input id="st-tva" type="number" min="0" max="30" step="0.5" value="' + p.tva + '"><p class="field-hint">Utilisée pour le prix TTC indicatif des fiches recettes.</p></div>' +
          '<div class="field"><label>Devise d\u2019affichage</label><div class="devise-options">' +
            [['XOF', 'F'], ['EUR', '€'], ['USD', '$'], ['GBP', '£']].map(([code, sign]) =>
              '<label><input type="radio" name="devise" value="' + code + '"' + (p.devise === code ? ' checked' : '') + '><span class="opt"><span class="sign">' + sign + '</span>' + code + '</span></label>'
            ).join('') +
          '</div><p class="field-hint">Aucune conversion automatique : seules les valeurs saisies sont affichées dans la devise choisie.</p></div>' +
          '<button class="btn btn-gold" id="st-save">Enregistrer les paramètres</button>' +
        '</div>' +
        '<div class="card danger-zone"><h3>Zone de réinitialisation</h3><p class="card-sub">Restaure les données de démonstration (cuisine ivoirienne) : ingrédients, recettes, menus, comptes et paramètres.</p>' +
          '<button class="btn btn-danger" id="st-reset">🔄 Réinitialiser la démonstration</button>' +
          '<p class="field-hint" style="margin-top:12px;">Les comptes créés par inscription seront également supprimés.</p>' +
        '</div>' +
      '</div>';

    document.getElementById('st-save').addEventListener('click', () => {
      const obj = Core.clamp(pn(document.getElementById('st-obj').value), 5, 80);
      const tva = Core.clamp(pn(document.getElementById('st-tva').value), 0, 30);
      const devise = document.querySelector('input[name="devise"]:checked').value;
      Store.saveParams({ objectif_food_cost: obj, tva, devise });
      refreshDevise();
      UI.toast('Paramètres enregistrés — devise ' + devise + ', objectif ' + UI.pct(obj) + ', TVA ' + UI.num(tva) + ' %. Utilisés partout.', 'ok', 4200);
      route();
    });
    document.getElementById('st-reset').addEventListener('click', async () => {
      const ok = await UI.confirmDialog('Réinitialiser toutes les données de démonstration ? Cette action est irréversible.', { title: 'Réinitialisation', danger: true, okLabel: 'Réinitialiser' });
      if (!ok) return;
      Store.resetDemo();
      UI.toast('Démonstration réinitialisée.', 'ok');
      refreshDevise();
      route();
    });
  }

  /* ============================================================
     ROUTEUR
     ============================================================ */
  function route() {
    const hash = location.hash || '#/dashboard';
    const path = hash.replace(/^#/, '') || '/dashboard';
    const parts = path.split('/').filter(Boolean);
    refreshDevise();
    if (parts[0] === 'ingredients') return renderIngredients();
    if (parts[0] === 'recettes') {
      if (parts[1]) return renderRecipeDetail(parts[1]);
      return renderRecipes();
    }
    if (parts[0] === 'menus') return renderMenus();
    if (parts[0] === 'parametres') return renderSettings();
    return renderDashboard();
  }

  window.addEventListener('hashchange', route);

  /* ---------- Démarrage : skeleton puis rendu ---------- */
  setupShell();
  setTimeout(() => {
    skeleton.style.display = 'none';
    view.hidden = false;
    if (!location.hash) location.replace(location.pathname + '#/dashboard');
    route();
  }, 380);

})();
