/* Projects module: record what a job costs, set a profit margin, make a quotation from it,
   then record the real costs after delivery. Receives helpers from app.js through the context C. */
const MIN_MARGIN = 15;   // profit turns red below this

export function projectsModule(C) {
  const { $, uid, esc, ICON, persist, pushPage, closePage, openSheet, ask, toast, todayISO } = C;
  const D = () => C.db();
  const num = v => { const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };
  const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const money = n => r2(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const has = v => v !== '' && v !== null && v !== undefined;
  // a project counts as finished once real costs have been written in
  const isDone = p => calc(p).filled;

  /* ---------- the maths (margin is a share of the selling price) ---------- */
  const priceOf = (cost, m) => m >= 100 ? 0 : cost / (1 - m / 100);
  const lineEst = l => num(l.amt);   // every cost is the total amount paid for that line
  const itemCost = it => it.lines.reduce((s, l) => s + lineEst(l), 0);
  function calc(p) {
    const base = p.items.map(itemCost), sum = base.reduce((a, b) => a + b, 0);
    const shared = (p.shared || []).reduce((s, l) => s + num(l.amt), 0);
    const rows = p.items.map((it, i) => {
      const share = sum > 0 ? base[i] / sum : (p.items.length ? 1 / p.items.length : 0);
      const loaded = base[i] + shared * share, qty = num(it.qty);
      const m = has(it.margin) ? num(it.margin) : num(p.margin);
      const unit = has(it.price) ? num(it.price) : (qty > 0 ? r2(priceOf(loaded, m) / qty) : 0);
      const tot = r2(unit * qty), profit = tot - loaded;
      return { own: base[i], loaded, unit, tot, profit, pct: tot > 0 ? profit / tot * 100 : 0 };
    });
    const cost = rows.reduce((s, r) => s + r.loaded, 0), price = rows.reduce((s, r) => s + r.tot, 0);
    // actual: a line's real amount if filled in, otherwise its estimate
    let actual = 0, open = 0;
    const act = (l, est) => { if (has(l.actual)) return num(l.actual); open++; return est; };
    p.items.forEach(it => it.lines.forEach(l => { actual += act(l, lineEst(l)); }));
    (p.shared || []).forEach(l => { actual += act(l, num(l.amt)); });
    const filled = p.items.some(it => it.lines.some(l => has(l.actual))) || (p.shared || []).some(l => has(l.actual));
    return { rows, cost, price, profit: price - cost, pct: price > 0 ? (price - cost) / price * 100 : 0, actual, open, filled, aprofit: price - actual, apct: price > 0 ? (price - actual) / price * 100 : 0 };
  }
  const sigOf = p => JSON.stringify(calc(p).rows.map((r, i) => [p.items[i].name, p.items[i].qty, r.unit]));
  const blank = () => ({ id: uid(), name: '', client: '', status: 'costing', created: todayISO(), margin: '25', items: [], shared: [], notes: '', quoted: null, doneAt: '' });
  const blankItem = () => ({ id: uid(), pid: '', name: '', desc: '', qty: '', unit: 'Pcs', margin: '', price: '', lines: [] });
  const blankLine = () => ({ id: uid(), label: '', type: '', per: false, amt: '', actual: '' });
  const lineUsed = l => (l.label || '').trim() !== '' || has(l.amt) || has(l.actual);
  const padRows = (list, min) => { const t = list.filter(lineUsed), target = Math.max(min, t.length + 1); while (t.length < target) t.push(blankLine()); return t; };

  /* ---------- list tab ---------- */
  let showDone = false;
  const pill = p => `<span class="spill ${isDone(p) ? 's-delivered' : p.quoted ? 's-quoted' : ''}">${isDone(p) ? 'Finished' : p.quoted ? 'Quoted' : 'Draft'}</span>`;
  function card(p, i) {
    const c = calc(p), low = c.price > 0 && c.pct < MIN_MARGIN;
    return `<div class="card pj tap" data-id="${p.id}" style="animation-delay:${Math.min(i, 8) * 35}ms">
      <div class="top"><div><div class="nm">${esc(p.name || 'Untitled project')}</div><div class="meta">${esc(p.client || 'No client')} · ${p.items.length} item${p.items.length === 1 ? '' : 's'}${p.quoted ? ' · ' + esc(p.quoted.no) : ''}</div></div>${pill(p)}</div>
      <div class="pjn"><div><small>Cost</small><b>${money(c.cost)}</b></div><div><small>Quote</small><b>${money(c.price)}</b></div><div><small>Profit</small><b class="${low ? 'bad' : 'good'}">${money(isDone(p) && c.filled ? c.aprofit : c.profit)}</b><em>${r2(isDone(p) && c.filled ? c.apct : c.pct)}%</em></div></div></div>`;
  }
  function tList(v) {
    const all = D().projects, act = all.filter(p => !isDone(p)), done = all.filter(isDone);
    const sum = act.reduce((a, p) => { const c = calc(p); a.price += c.price; a.profit += c.profit; return a; }, { price: 0, profit: 0 });
    const list = (showDone ? done : act).slice().sort((a, b) => (b.created || '').localeCompare(a.created || ''));
    v.innerHTML = `<div class="lt"><h1>Projects</h1></div>
      <div class="sum"><div><small>Active quote value</small><b>${money(sum.price)} Tk</b></div><div class="due"><small>Expected profit</small><b class="good">${money(sum.profit)} Tk</b></div></div>
      <div class="seg"><button data-s="0" class="${showDone ? '' : 'on'}">Active (${act.length})</button><button data-s="1" class="${showDone ? 'on' : ''}">Finished (${done.length})</button></div>` +
      (list.map(card).join('') || `<div class="empty">${all.length ? 'Nothing here.' : 'No projects yet.<br>Tap + to cost your first job.'}</div>`);
    v.onclick = e => {
      const s = e.target.closest('[data-s]'); if (s) { showDone = s.dataset.s === '1'; return C.renderTab(); }
      const c = e.target.closest('[data-id]'); if (c) openEditor(D().projects.find(x => x.id === c.dataset.id));
    };
    const f = document.createElement('button'); f.className = 'fab tap'; f.innerHTML = ICON.plus; f.setAttribute('aria-label', 'New project'); f.onclick = () => openEditor(null);
    $('#app').appendChild(f);
  }

  /* ---------- profit tab ---------- */
  function tProfit(v) {
    const done = D().projects.filter(isDone).sort((a, b) => (b.doneAt || b.created || '').localeCompare(a.doneAt || a.created || ''));
    const rows = done.map(p => ({ p, c: calc(p) }));
    const sold = rows.reduce((s, r) => s + r.c.price, 0), est = rows.reduce((s, r) => s + r.c.profit, 0), real = rows.reduce((s, r) => s + (r.c.filled ? r.c.aprofit : r.c.profit), 0);
    const missing = rows.filter(r => !r.c.filled).length;
    v.innerHTML = `<div class="lt"><h1>Profit</h1></div>
      <div class="sum"><div><small>Finished value</small><b>${money(sold)} Tk</b></div><div class="due"><small>Real profit</small><b class="${real >= 0 ? 'good' : ''}">${money(real)} Tk</b></div></div>
      <p class="hint" style="margin-bottom:14px">Planned profit on these jobs was ${money(est)} Tk${sold > 0 ? ` (${r2(est / sold * 100)}%)` : ''}. ${missing ? `${missing} project${missing === 1 ? ' has' : 's have'} no real costs yet, so the plan is used.` : 'All real costs recorded.'}</p>` +
      (rows.map(({ p, c }, i) => {
        const diff = c.filled ? c.aprofit - c.profit : 0;
        return `<div class="card pj tap" data-id="${p.id}" style="animation-delay:${Math.min(i, 8) * 35}ms"><div class="top"><div><div class="nm">${esc(p.name || 'Untitled project')}</div><div class="meta">${esc(p.client || 'No client')}</div></div>${pill(p)}</div>
        <div class="pjn"><div><small>Planned</small><b>${money(c.profit)}</b></div><div><small>Real</small><b class="${c.filled ? (c.aprofit >= 0 ? 'good' : 'bad') : ''}">${c.filled ? money(c.aprofit) : 'not set'}</b></div><div><small>Difference</small><b class="${diff < 0 ? 'bad' : diff > 0 ? 'good' : ''}">${c.filled ? (diff > 0 ? '+' : '') + money(diff) : '-'}</b></div></div></div>`;
      }).join('') || '<div class="empty">Finished projects show here with planned and real profit.<br>Open a project, switch on Record real costs and fill in what you really paid.</div>');
    v.onclick = e => { const c = e.target.closest('[data-id]'); if (c) openEditor(D().projects.find(x => x.id === c.dataset.id)); };
  }

  /* ---------- editor ---------- */
  function openEditor(proj) {
    const isNew = !proj;
    const n = proj ? JSON.parse(JSON.stringify(proj)) : blank();
    if (!n.items.length) n.items.push(blankItem());   // start with one empty product to type into
    const itemUsed = it => (it.name || '').trim() !== '' || has(it.qty) || it.lines.some(lineUsed);
    const snap = () => JSON.stringify({ ...n, items: n.items.filter(itemUsed).map(it => ({ ...it, lines: it.lines.filter(lineUsed) })), shared: (n.shared || []).filter(lineUsed) });
    const s0 = snap();
    let showAct = isDone(n);
    pushPage({
      title: isNew ? 'New project' : (n.name || 'Project'),
      beforeClose(entry) {
        if (snap() !== s0) { ask('Discard changes?', 'Your edits have not been saved.', 'Discard', () => closePage(entry)); return false; }
        return true;
      },
      build(entry) {
        const b = entry.body, f = entry.foot;
        const clients = [...new Set([...D().invoices.map(d => d.customer), ...D().projects.map(p => p.client)].filter(Boolean))];
        f.classList.remove('hid');
        f.innerHTML = `<div class="pfs"><div><small>Cost</small><b id="fc"></b></div><div><small>Quote</small><b id="fq"></b></div><div><small>Profit</small><b id="fp"></b></div></div>
          <div class="row"><div><button class="btn line full tap" id="sv">${ICON.check}Save</button></div><div><button class="btn full tap" id="mq">${ICON.receipt}Quotation</button></div></div>`;

        const NAMES = ['Paper', 'Print', 'Plate', 'Binding', 'Packing'], MNAMES = ['Delivery', 'Design'];
        const lineHTML = (l, it, shared, k = 0) => `<div class="cl" data-l="${l.id}">
          <input class="cll" data-f="label" value="${esc(l.label)}" placeholder="${'e.g. ' + (shared ? MNAMES : NAMES)[k % (shared ? 2 : 5)]}" autocomplete="off">
          <div class="sfx"><input data-f="amt" inputmode="decimal" value="${esc(l.amt)}" placeholder="0"><i>Tk</i></div>
          ${showAct ? `<div class="sfx ac"><input data-f="actual" inputmode="decimal" value="${esc(l.actual)}" placeholder="plan ${money(num(l.amt))}"><i>real</i></div>` : ''}</div>`;
        const itemHTML = (it, i) => `<div class="card pit" data-i="${it.id}">
          <div class="ih"><b>${esc(it.name || 'Item')}</b><button class="ib danger tap" data-a="id" aria-label="Remove item">${ICON.trash}</button></div>
          <div class="row qrow2"><div><label class="l">Name</label><input data-f="name" value="${esc(it.name)}" placeholder="e.g. Notebook"></div>
            <div><label class="l">Qty</label><input data-f="qty" inputmode="decimal" value="${esc(it.qty)}"></div>
            <div><label class="l">Unit</label><input data-f="unit" value="${esc(it.unit)}" placeholder="Pcs"></div></div>
          <label class="l" style="margin-top:10px">Costs (add as many as you need)</label>
          <div class="cls" data-for="${it.id}">${it.lines.map((l, k) => lineHTML(l, it, false, k)).join('')}</div>
          <button class="chip t tap addc" data-a="addc" data-to="${it.id}">+ Add cost</button>
          <div class="cpp"><span>Cost per piece</span><b data-o="cpp"></b></div>
          <div class="pr3"><div><label class="l">Margin %</label><input data-f="margin" inputmode="decimal" value="${esc(it.margin)}"></div>
            <div><label class="l">Price per piece</label><div class="sfx"><input data-f="price" inputmode="decimal" value="${esc(it.price)}"><i>Tk</i></div></div>
            <div class="rd"><small>Total</small><b data-o="tot"></b></div></div>
          <div class="ir"><span data-o="cost"></span><span data-o="prof"></span></div></div>`;
        const draw = () => {
          n.items.forEach(it => { it.lines = padRows(it.lines, 5); }); n.shared = padRows(n.shared || [], 2);
          b.innerHTML = `<div class="card"><label class="l">Project name</label><input id="pn" value="${esc(n.name)}" placeholder="e.g. ABC Ltd. annual gifts" autocomplete="off">
            <div class="gap"></div><label class="l">Client</label><input id="pc" list="pcl" value="${esc(n.client)}" placeholder="Who is it for?" autocomplete="off"><datalist id="pcl">${clients.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
            <div class="gap"></div><div class="row"><div><label class="l">Profit margin %</label><input id="pm" inputmode="decimal" value="${esc(n.margin)}"></div>
              <div class="rd"><small>Markup on cost</small><b id="mu"></b></div></div>
            <p class="hint">Margin is your share of the selling price. At 25%, a job that costs 750 Tk is quoted at 1,000 Tk.</p>
            <div id="qw"></div></div>
          <div class="secth"><span>Product Cost</span><span>${n.items.length}</span></div>
          ${n.items.map(itemHTML).join('')}
          <button class="btn sec full tap" id="ap">${ICON.plus}Add product</button>
          <div class="secth" style="margin-top:18px"><span>Miscellaneous Cost</span></div>
          <div class="card"><p class="hint" style="margin:0 0 8px">Delivery, design or anything else for the whole job. It is spread over the products by cost.</p>
            <div class="cls" data-for="shared">${(n.shared || []).map((l, k) => lineHTML(l, null, true, k)).join('')}</div>
            <button class="chip t tap addc" data-a="addc" data-to="shared">+ Add cost</button></div>
          <div class="card" id="sum"></div>
          <div class="card"><label class="l">Notes</label><textarea id="nt" placeholder="Supplier names, deadlines, anything to remember">${esc(n.notes)}</textarea></div>
          ${isNew ? '' : `<div class="row"><div><button class="btn sec full tap" id="cp">${ICON.copy}Copy project</button></div><div><button class="btn sec full tap" id="dl">${ICON.trash}Delete</button></div></div>`}`;
          paint();
        };
        const setO = (root, k, t) => { const e = root.querySelector(`[data-o="${k}"]`); if (e) e.textContent = t; };
        const paint = () => {
          const c = calc(n), low = c.pct < MIN_MARGIN && c.price > 0;
          n.items.forEach((it, i) => {
            const root = b.querySelector(`[data-i="${it.id}"]`); if (!root) return; const r = c.rows[i];
            setO(root, 'tot', money(r.tot)); setO(root, 'cost', `Cost ${money(r.loaded)} Tk`);
            const pe = root.querySelector('[data-o="prof"]'); pe.textContent = `Profit ${money(r.profit)} Tk (${r2(r.pct)}%)`; pe.className = r.pct < MIN_MARGIN && r.tot > 0 ? 'bad' : 'good';
            const qn = num(it.qty);
            setO(root, 'cpp', qn > 0 && r.loaded > 0 ? money(r.loaded / qn) + ' Tk' : '-');
            const mi = root.querySelector('[data-f="margin"]'), pi = root.querySelector('[data-f="price"]');
            if (document.activeElement !== mi) mi.value = has(it.price) ? String(r2(r.pct)) : String(has(it.margin) ? it.margin : (n.margin || ''));
            if (document.activeElement !== pi) pi.value = has(it.price) ? it.price : (qn > 0 && r.loaded > 0 ? String(r.unit) : '');
            mi.classList.toggle('auto', !has(it.margin)); pi.classList.toggle('auto', !has(it.price));
            root.querySelector('.ih b').textContent = it.name || 'Item';
            it.lines.forEach(l => { const a = root.querySelector(`[data-l="${l.id}"] .ac input`); if (a) a.placeholder = 'plan ' + money(lineEst(l)); });
          });
          $('#fc', f).textContent = money(c.cost); $('#fq', f).textContent = money(c.price);
          const fp = $('#fp', f); fp.textContent = `${money(c.profit)} (${r2(c.pct)}%)`; fp.className = low ? 'bad' : 'good';
          const m = num(n.margin); $('#mu', b).textContent = m > 0 && m < 100 ? r2(m / (100 - m) * 100) + '%' : '-';
          const warn = n.quoted && sigOf(n) !== n.quoted.sig;
          $('#qw', b).innerHTML = n.quoted ? `<div class="note ${warn ? 'bad' : ''}">${warn ? `Prices changed since ${esc(n.quoted.no)} was made. Make a new quotation to match.` : `Quotation ${esc(n.quoted.no)} matches these prices.`}</div>` : '';
          $('#sum', b).innerHTML = `<label class="l">Summary</label>
            <div class="sr"><span>Planned cost</span><b>${money(c.cost)} Tk</b></div><div class="sr"><span>Quote price</span><b>${money(c.price)} Tk</b></div>
            <div class="sr"><span>Planned profit</span><b class="${low ? 'bad' : 'good'}">${money(c.profit)} Tk · ${r2(c.pct)}%</b></div>
            ${low ? `<p class="hint bad">Margin is under ${MIN_MARGIN}%. Raise the price or check the costs.</p>` : ''}
            <label class="sw" style="margin:12px 0 0"><input type="checkbox" id="sa" ${showAct ? 'checked' : ''}>Record real costs</label>
            ${showAct ? `<div class="sr" style="margin-top:8px"><span>Real cost</span><b>${money(c.actual)} Tk</b></div><div class="sr"><span>Real profit</span><b class="${c.aprofit < c.profit - 0.5 ? 'bad' : 'good'}">${money(c.aprofit)} Tk · ${r2(c.apct)}%</b></div>
            <p class="hint">${c.open ? `${c.open} cost line${c.open === 1 ? '' : 's'} still use the plan. Fill the "real Tk" box on each line you have paid.` : 'Every line has a real amount.'}</p>` : ''}
            <button class="link tap full" id="rd">Round prices up</button>`;
          $('#sa', b).onchange = e => { showAct = e.target.checked; draw(); };
          $('#rd', b).onclick = () => {
            const cc = calc(n); n.items.forEach((it, i) => { const u = cc.rows[i].unit; if (u > 0) { it.price = String(u >= 10 ? Math.ceil(u) : Math.ceil(u * 2) / 2); it.margin = ''; } });
            draw(); toast('Prices rounded up');
          };
        };
        const findItem = el => { const c = el.closest('[data-i]'); return c ? n.items.find(x => x.id === c.dataset.i) : null; };
        const findLine = (el) => {
          const row = el.closest('[data-l]'); if (!row) return null; const it = findItem(el);
          return { l: (it ? it.lines : n.shared).find(x => x.id === row.dataset.l), list: it ? it.lines : n.shared, row_: row };
        };
        b.addEventListener('input', e => {
          const t = e.target, fk = t.dataset.f;
          if (t.id === 'pn') { n.name = t.value; return; } if (t.id === 'pc') { n.client = t.value; return; }
          if (t.id === 'pm') { n.margin = t.value; return paint(); } if (t.id === 'nt') { n.notes = t.value; return; }
          if (!fk) return;
          const ln = findLine(t);
          if (ln) {
            ln.l[fk] = t.value;
            if (ln.list[ln.list.length - 1] === ln.l && lineUsed(ln.l)) {
              const it = findItem(t), nl = blankLine(); ln.list.push(nl);
              ln.row_.insertAdjacentHTML('afterend', lineHTML(nl, it, !it, ln.list.length - 1));
            }
            return paint();
          }
          const it = findItem(t); if (!it) return;
          it[fk] = t.value;
          if (fk === 'price' && t.value !== '') { it.margin = ''; b.querySelector(`[data-i="${it.id}"] [data-f="margin"]`).value = ''; }
          if (fk === 'margin' && t.value !== '') { it.price = ''; b.querySelector(`[data-i="${it.id}"] [data-f="price"]`).value = ''; }
          paint();
        });
        b.addEventListener('click', e => {
          const t = e.target;
          if (t.closest('#ap')) { n.items.push(blankItem()); draw(); const el = b.querySelector(`[data-i="${n.items[n.items.length - 1].id}"] [data-f="name"]`); if (el) el.focus(); return; }
          const a = t.closest('[data-a]')?.dataset.a; if (!a) return;
          if (a === 'addc') {
            const to = t.closest('[data-a]').dataset.to, shared = to === 'shared', it = shared ? null : n.items.find(x => x.id === to);
            const list = shared ? n.shared : it.lines, nl = blankLine(); list.push(nl);
            b.querySelector(`[data-for="${to}"]`).insertAdjacentHTML('beforeend', lineHTML(nl, it, shared, list.length - 1));
            const el = b.querySelector(`[data-l="${nl.id}"] [data-f="label"]`); if (el) el.focus(); return;
          }
          if (a === 'id') { const it = findItem(t); return ask('Remove ' + (it.name || 'this item') + '?', 'Its costs will be removed from this project.', 'Remove', () => { n.items.splice(n.items.indexOf(it), 1); draw(); }); }
        });
        const check = () => {
          if (!n.name.trim()) { toast('Give the project a name'); $('#pn', b).focus(); return false; }
          if (!n.items.some(itemUsed)) { toast('Add a product with its costs'); return false; }
          return true;
        };
        const save = () => {
          n.name = n.name.trim(); n.client = n.client.trim();
          n.items = n.items.filter(itemUsed); n.items.forEach(it => { it.lines = it.lines.filter(lineUsed); }); n.shared = (n.shared || []).filter(lineUsed);
          n.items.forEach(it => { if (!it.name.trim()) it.name = 'Item'; });
          const i = D().projects.findIndex(x => x.id === n.id);
          if (i >= 0) D().projects[i] = JSON.parse(JSON.stringify(n)); else D().projects.unshift(JSON.parse(JSON.stringify(n)));
          persist();
        };
        $('#sv', f).onclick = () => { if (!check()) return; save(); closePage(entry); C.renderTab(); toast('Project saved'); };
        $('#mq', f).onclick = () => {
          if (!check()) return;
          if (calc(n).rows.some(r => r.tot <= 0)) return toast('Fill the quantity and costs of every product first');
          save(); closePage(entry); C.renderTab(); setTimeout(() => C.quoteFrom(n.id), 350);
        };
        draw();
        if (isNew) setTimeout(() => $('#pn', b).focus(), 400);
        const del = () => b.querySelector('#dl'), cp = () => b.querySelector('#cp');
        b.addEventListener('click', e => {
          if (e.target.closest('#cp')) { const d = JSON.parse(JSON.stringify(n)); d.id = uid(); d.name = (d.name || 'Project') + ' (copy)'; d.status = 'costing'; d.quoted = null; d.doneAt = ''; d.created = todayISO(); d.items.forEach(it => { it.id = uid(); it.lines.forEach(l => { l.id = uid(); l.actual = ''; }); }); (d.shared || []).forEach(l => { l.id = uid(); l.actual = ''; }); D().projects.unshift(d); persist(); closePage(entry); C.renderTab(); toast('Copied. Open it to change the quantities'); }
          if (e.target.closest('#dl')) ask('Delete project?', `${n.name || 'This project'} and its costs will be removed.`, 'Delete', () => { D().projects = D().projects.filter(x => x.id !== n.id); persist(); closePage(entry); C.renderTab(); toast('Deleted'); });
        });
      }
    });
  }

  /* ---------- used by the quotation flow ---------- */
  function toDocItems(p) {
    const c = calc(p);
    return p.items.map((it, i) => ({ id: uid(), name: it.name, desc: it.desc || '', qty: String(num(it.qty)), unit: it.unit || '', price: String(c.rows[i].unit), total: String(c.rows[i].tot), flat: false }));
  }
  function markQuoted(doc) {
    const p = D().projects.find(x => x.id === doc.projectId); if (!p) return;
    p.quoted = { no: doc.no, docId: doc.id, at: new Date().toISOString(), sig: sigOf(p) };
    if (p.status === 'costing') p.status = 'quoted';
  }
  const summary = () => { const act = D().projects.filter(p => !isDone(p)); return { n: act.length, profit: act.reduce((s, p) => s + calc(p).profit, 0) }; };

  return {
    tabs: [['list', 'Projects', ICON.calc], ['profit', 'Profit', ICON.chart]],
    views: { list: tList, profit: tProfit },
    openEditor, toDocItems, markQuoted, summary, calc, money
  };
}
