/* ============================================================
   DABALICOSTER — UI partagée : formats, toasts, modales,
   confirmations, sparklines, badges (composants ui/)
   ============================================================ */
const UI = (() => {

  /* ---------- Formats ---------- */
  const CURRENCY_SIGN = { XOF: 'F', EUR: '€', USD: '$', GBP: '£' };

  function groupDigits(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  }
  function money(n) {
    const cur = (Store.getParams().devise || 'XOF');
    const sign = CURRENCY_SIGN[cur] || 'F';
    if (!isFinite(n)) n = 0;
    return groupDigits(n) + ' ' + sign;
  }
  function num(n, d = 2) {
    if (!isFinite(n)) n = 0;
    const r = Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
    return String(r).replace('.', ',');
  }
  function pct(n, d = 1) { return num(n, d) + '\u202f%'; }
  function dateFR(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function initials(u) {
    return ((u.prenom || '?')[0] + (u.nom || '')[0] || '?').toUpperCase();
  }

  /* ---------- Badge Food Cost ---------- */
  function fcBadge(fcPct, target) {
    let cls = 'fc-ok';
    if (fcPct > target * 1.25) cls = 'fc-bad';
    else if (fcPct > target) cls = 'fc-warn';
    return '<span class="badge ' + cls + '">FC ' + pct(fcPct) + '</span>';
  }

  /* ---------- Sparkline SVG ---------- */
  function sparkline(values, opts) {
    opts = opts || {};
    const w = opts.w || 96, h = opts.h || 28;
    if (!values || values.length < 2) return '';
    const min = Math.min(...values), max = Math.max(...values);
    const span = (max - min) || 1;
    const pad = 3;
    const pts = values.map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return [x, y];
    });
    const color = opts.color || '#B8873A';
    const line = pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const area = line + ' ' + pts[pts.length - 1][0].toFixed(1) + ',' + (h - pad) + ' ' + pts[0][0].toFixed(1) + ',' + (h - pad);
    const last = pts[pts.length - 1];
    return '<svg class="sparkline" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' +
      '<polygon points="' + area + '" fill="' + color + '" opacity="0.12"/>' +
      '<polyline points="' + line + '" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="2.4" fill="' + color + '"/></svg>';
  }

  /* ---------- Toasts ---------- */
  function ensureToastHost() {
    let host = document.getElementById('toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toast-host';
      document.body.appendChild(host);
    }
    return host;
  }
  function toast(msg, type, ms) {
    type = type || 'ok';
    const host = ensureToastHost();
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML = '<span class="toast-dot"></span><span>' + msg + '</span>';
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 350);
    }, ms || 3200);
  }

  /* ---------- Modale générique ---------- */
  function modal(opts) {
    // opts : { title, body (HTML), wide, onMount(root), actions:[{label, class, value}] }
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML =
        '<div class="modal-card' + (opts.wide ? ' modal-wide' : '') + '" role="dialog" aria-modal="true">' +
        '  <div class="modal-head">' +
        '    <h3>' + (opts.title || '') + '</h3>' +
        '    <button type="button" class="modal-close" aria-label="Fermer">✕</button>' +
        '  </div>' +
        '  <div class="modal-body">' + (opts.body || '') + '</div>' +
        '  <div class="modal-actions"></div>' +
        '</div>';
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('open'));

      const close = (value) => {
        overlay.classList.remove('open');
        setTimeout(() => { overlay.remove(); resolve(value); }, 220);
        document.removeEventListener('keydown', onKey);
      };
      const onKey = (e) => { if (e.key === 'Escape') close(null); };
      document.addEventListener('keydown', onKey);
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(null); });
      overlay.querySelector('.modal-close').addEventListener('click', () => close(null));

      const actionsEl = overlay.querySelector('.modal-actions');
      (opts.actions || []).forEach(a => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn ' + (a.class || 'btn-ghost');
        b.textContent = a.label;
        b.addEventListener('click', () => {
          if (a.onClick) { const keep = a.onClick(overlay); if (keep === true) return; }
          close(a.value !== undefined ? a.value : true);
        });
        actionsEl.appendChild(b);
      });
      if (opts.onMount) opts.onMount(overlay, close);
      const first = overlay.querySelector('input, select, textarea');
      if (first) setTimeout(() => first.focus(), 120);
    });
  }

  /* ---------- Confirmation (actions destructives) ---------- */
  function confirmDialog(message, opts) {
    opts = opts || {};
    return modal({
      title: opts.title || 'Confirmation',
      body: '<p class="confirm-text">' + message + '</p>',
      actions: [
        { label: opts.cancelLabel || 'Annuler', class: 'btn-ghost', value: false },
        { label: opts.okLabel || 'Confirmer', class: opts.danger ? 'btn-danger' : 'btn-primary', value: true },
      ],
    });
  }

  /* ---------- Fil d'Ariane ---------- */
  function breadcrumb(items) {
    // items : [{label, href?}] — dernier non cliquable
    const parts = items.map((it, i) => {
      const last = i === items.length - 1;
      const sep = i > 0 ? '<span class="crumb-sep">›</span>' : '';
      const mob = it.hideMobile ? ' crumb-hide-mobile' : '';
      return sep + (last || !it.href
        ? '<span class="crumb crumb-current' + (last ? '' : mob) + '" aria-current="page">' + esc(it.label) + '</span>'
        : '<a class="crumb' + mob + '" href="' + it.href + '">' + esc(it.label) + '</a>');
    });
    return '<nav class="breadcrumb" aria-label="Fil d\u2019Ariane">' + parts.join('') + '</nav>';
  }

  /* ---------- Bouton « Retour » (historique réel) ---------- */
  function backButton(fallback) {
    return '<button type="button" class="btn-back" data-back="' + (fallback || 'app.html') + '" title="Retour">← Retour</button>';
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-back]');
    if (!b) return;
    if (history.length > 1) history.back();
    else location.href = b.getAttribute('data-back');
  });

  return {
    money, num, pct, dateFR, esc, initials,
    fcBadge, sparkline, toast, modal, confirmDialog, breadcrumb, backButton,
    CURRENCY_SIGN,
  };
})();
