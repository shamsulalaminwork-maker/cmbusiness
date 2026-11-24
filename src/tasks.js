/* Task Manager module. Receives helpers from app.js through the context object C. */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PAL = ['#3b5bdb', '#0c8599', '#2f9e44', '#e8590c', '#9c36b5', '#d6336c', '#5f3dc4', '#495057'];
const PRI = { high: ['High', 'hi'], med: ['Medium', 'md'], low: ['Low', 'lo'] };
const RANK = { high: 0, med: 1, low: 2 };

export function tasksModule(C) {
  const { $, uid, esc, ICON, persist, pushPage, closePage, openSheet, ask, toast, todayISO, shareText, saveImg, loadImg, delImg, resizeImage, autosize } = C;
  const D = () => C.db();
  const me = () => D().settings.me;
  let who = 'all', showDone = false, showDoneLong = false;

  /* ---------- small helpers ---------- */
  const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
  const short = iso => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MON[m - 1]}`; };
  const person = id => D().people.find(p => p.id === id);
  const pcolor = id => { const i = D().people.findIndex(p => p.id === id); return i < 0 ? '#adb5bd' : PAL[i % PAL.length]; };
  const first = p => (p ? p.name.trim().split(/\s+/)[0] : 'Unassigned');
  const av = id => { const p = person(id); return `<span class="av" style="background:${pcolor(id)}">${p ? esc(p.name.trim()[0] || '?').toUpperCase() : '?'}</span>`; };
  const whenText = iso => { const d = new Date(iso); return `${d.getDate()} ${MON[d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  function dueInfo(t) {
    if (!t.due) return null;
    const td = todayISO();
    const lab = t.due === td ? 'Today' : t.due === addDays(td, 1) ? 'Tomorrow' : t.due === addDays(td, -1) ? 'Yesterday' : short(t.due);
    return { lab, over: !t.done && t.due < td, today: !t.done && t.due === td };
  }
  const cmp = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || RANK[a.priority] - RANK[b.priority] || (a.created || '').localeCompare(b.created || '');
  const match = t => who === 'all' || t.assignee === (who === 'me' ? me() : who);
  const progress = t => { const n = t.steps.length, d = t.steps.filter(s => s.done).length; return { n, d, pct: n ? Math.round(d * 100 / n) : (t.done ? 100 : 0) }; };
  const people = () => D().people;
  const chipsHTML = (sel, none = true) => (none ? `<button type="button" class="chip tap ${sel === '' ? 'on' : ''}" data-v=""><span class="av" style="background:#adb5bd">?</span>Unassigned</button>` : '') +
    people().map(p => `<button type="button" class="chip tap ${sel === p.id ? 'on' : ''}" data-v="${p.id}">${av(p.id)}${esc(first(p))}${p.id === me() ? ' (me)' : ''}</button>`).join('');

  /* ---------- cards ---------- */
  function metaHTML(t) {
    const di = dueInfo(t), bits = [];
    bits.push(`<span class="who">${av(t.assignee)}${esc(first(person(t.assignee)))}</span>`);
    if (di) bits.push(`<span class="dpill ${di.over ? 'bad' : di.today ? 'today' : ''}">${di.lab}</span>`);
    bits.push(`<span class="prio ${PRI[t.priority][1]}" title="${PRI[t.priority][0]} priority"></span>`);
    if (t.client) bits.push(`<span class="mi">${esc(t.client)}</span>`);
    if (t.link) bits.push(`<span class="mi">${ICON.link}${esc(t.link.no)}</span>`);
    if (t.comments.length) bits.push(`<span class="mi">${ICON.msg}${t.comments.length}</span>`);
    if (t.files.length) bits.push(`<span class="mi">${ICON.image}${t.files.length}</span>`);
    return bits.join('');
  }
  const dailyCard = (t, i) => `<div class="card task tap ${t.done ? 'done' : ''}" data-id="${t.id}" style="animation-delay:${Math.min(i, 8) * 35}ms">
    <button class="cb tap ${t.done ? 'on' : ''}" data-a="ck" aria-label="Complete">${ICON.check}</button>
    <div class="tx"><div class="tt">${esc(t.title)}</div><div class="tm">${metaHTML(t)}</div></div></div>`;
  function longCard(t, i) {
    const p = progress(t), next = t.steps.find(s => !s.done), di = dueInfo(t);
    return `<div class="card long tap ${t.done ? 'done' : ''}" data-id="${t.id}" style="animation-delay:${Math.min(i, 8) * 35}ms">
      <div class="top"><div class="tt">${esc(t.title)}</div><b class="pc">${p.pct}%</b></div>
      <div class="bar"><i style="width:${p.pct}%"></i></div>
      <div class="tm">${p.n ? `<span>${p.d} of ${p.n} steps</span>` : '<span>No steps yet</span>'}<span class="who">${av(t.assignee)}${esc(first(person(t.assignee)))}</span>${di ? `<span class="dpill ${di.over ? 'bad' : ''}">${di.lab}</span>` : ''}<span class="prio ${PRI[t.priority][1]}"></span></div>
      ${next && !t.done ? `<div class="next">Next: ${esc(next.text)}</div>` : ''}</div>`;
  }
  const whoSeg = () => {
    const sp = who !== 'all' && who !== 'me' ? person(who) : null;
    return `<div class="seg" id="wseg"><button data-w="all" class="${who === 'all' ? 'on' : ''}">Everyone</button><button data-w="me" class="${who === 'me' ? 'on' : ''}">Mine</button>${sp ? `<button data-w="${sp.id}" class="on">${esc(first(sp))}</button>` : ''}</div>`;
  };
  function fab(fn, label) {
    const f = document.createElement('button'); f.className = 'fab tap'; f.innerHTML = ICON.plus; f.setAttribute('aria-label', label); f.onclick = fn;
    $('#app').appendChild(f);
  }
  function toggle(t, card) {
    t.done = !t.done; t.doneAt = t.done ? new Date().toISOString() : '';
    persist();
    if (t.done) { card.classList.add('done', 'completing'); card.querySelector('.cb').classList.add('on'); setTimeout(() => C.renderTab(), 330); }
    else C.renderTab();
  }

  /* ---------- Daily tab ---------- */
  function tDaily(v) {
    const all = D().tasks.filter(t => t.kind === 'daily' && match(t)), td = todayISO();
    const open = all.filter(t => !t.done).sort(cmp), done = all.filter(t => t.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
    const groups = [['Overdue', open.filter(t => t.due && t.due < td), 'bad'], ['Today', open.filter(t => t.due === td), ''], ['Upcoming', open.filter(t => t.due > td), ''], ['No date', open.filter(t => !t.due), '']];
    const none = !D().tasks.some(t => t.kind === 'daily');
    v.innerHTML = `<div class="lt"><h1>Daily Tasks</h1></div>${whoSeg()}` +
      groups.filter(g => g[1].length).map(([l, list, c]) => `<div class="secth ${c}"><span>${l}</span><span>${list.length}</span></div>${list.map(dailyCard).join('')}`).join('') +
      (done.length ? `<button class="link tap full" data-a="sd">${showDone ? 'Hide' : 'Show'} completed (${done.length})</button>${showDone ? done.map(dailyCard).join('') : ''}` : '') +
      (!open.length && !done.length ? `<div class="empty">${none ? 'No tasks yet.<br>Tap + to add the first one.' : 'No tasks for this view.'}</div>` : '') +
      (none ? `<button class="btn sec full tap" data-a="sample">Try it with sample tasks</button>` : '');
    v.onclick = e => {
      const w = e.target.closest('[data-w]'); if (w) { who = w.dataset.w; return C.renderTab(); }
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'sd') { showDone = !showDone; return C.renderTab(); }
      if (a === 'sample') return addSamples();
      const c = e.target.closest('[data-id]'); if (!c) return;
      const t = D().tasks.find(x => x.id === c.dataset.id);
      if (a === 'ck') toggle(t, c); else openEditor(t);
    };
    fab(() => quickAdd(), 'New task');
  }

  /* ---------- Long term tab ---------- */
  function tLong(v) {
    const all = D().tasks.filter(t => t.kind === 'long' && match(t));
    const open = all.filter(t => !t.done).sort(cmp), done = all.filter(t => t.done);
    v.innerHTML = `<div class="lt"><h1>Long Term</h1></div>${whoSeg()}` +
      open.map(longCard).join('') +
      (done.length ? `<button class="link tap full" data-a="sd">${showDoneLong ? 'Hide' : 'Show'} completed (${done.length})</button>${showDoneLong ? done.map(longCard).join('') : ''}` : '') +
      (!all.length ? '<div class="empty">No long term activities yet.<br>Tap + to plan one with steps.</div>' : '');
    v.onclick = e => {
      const w = e.target.closest('[data-w]'); if (w) { who = w.dataset.w; return C.renderTab(); }
      if (e.target.closest('[data-a="sd"]')) { showDoneLong = !showDoneLong; return C.renderTab(); }
      const c = e.target.closest('[data-id]'); if (c) openEditor(D().tasks.find(x => x.id === c.dataset.id));
    };
    fab(() => openEditor(null, 'long'), 'New activity');
  }

  /* ---------- Team tab ---------- */
  function tTeam(v) {
    const hasSample = people().some(p => p.sample) || D().tasks.some(t => t.sample);
    v.innerHTML = `<div class="lt"><h1>Team</h1><button class="btn sm tap" id="np">${ICON.plus}Add</button></div>` +
      people().map((p, i) => {
        const mine = D().tasks.filter(t => t.assignee === p.id && !t.done), over = mine.filter(t => t.due && t.due < todayISO()).length;
        return `<div class="card prod tap" data-id="${p.id}" style="animation-delay:${Math.min(i, 8) * 35}ms"><span class="av big" style="background:${pcolor(p.id)}">${esc(p.name.trim()[0] || '?').toUpperCase()}</span>
        <div class="t"><b>${esc(p.name)}${p.id === me() ? ' <span class="you">You</span>' : ''}</b><small>${mine.length} open${over ? ` · <span class="badtxt">${over} overdue</span>` : ''}${p.phone ? ' · ' + esc(p.phone) : ''}</small></div>
        <button class="ib gray tap" data-e="${p.id}" aria-label="Edit">${ICON.pencil}</button></div>`;
      }).join('') +
      `<p class="hint">Tap a person to see their tasks. Everyone listed here can be assigned tasks.</p>` +
      (hasSample ? `<button class="btn sec full tap" id="rs" style="margin-top:14px">${ICON.trash}Remove sample data</button>` : '');
    $('#np', v).onclick = () => editPerson();
    const rs = $('#rs', v);
    if (rs) rs.onclick = () => ask('Remove sample data?', 'Sample people and sample tasks will be deleted. Your own entries stay.', 'Remove', () => {
      const ids = people().filter(p => p.sample).map(p => p.id);
      D().tasks = D().tasks.filter(t => !t.sample); D().people = people().filter(p => !p.sample);
      D().tasks.forEach(t => { if (ids.includes(t.assignee)) t.assignee = ''; });
      if (!person(who) && who !== 'all' && who !== 'me') who = 'all';
      persist(); C.renderTab(); toast('Sample data removed');
    });
    v.onclick = e => {
      const ed = e.target.closest('[data-e]'); if (ed) return editPerson(person(ed.dataset.e));
      const c = e.target.closest('[data-id]'); if (c) { who = c.dataset.id === me() ? 'me' : c.dataset.id; C.switchTab('daily'); }
    };
  }
  function editPerson(p) {
    const n = p ? { ...p } : { id: uid(), name: '', phone: '' };
    openSheet(`<h3>${p ? 'Edit person' : 'Add person'}</h3>
      <label class="l">Name</label><input id="pn" value="${esc(n.name)}" placeholder="e.g. Nusrat">
      <div class="gap"></div><label class="l">Phone (optional)</label><input id="pph" inputmode="tel" value="${esc(n.phone)}" placeholder="+8801...">
      <label class="sw"><input type="checkbox" id="pm" ${n.id === me() ? 'checked' : ''}>This is me</label>
      <div class="gap"></div><div class="row"><div>${p && people().length > 1 ? '<button class="btn line full tap" id="pdl">Delete</button>' : ''}</div><div><button class="btn full tap" id="ps">Save</button></div></div>`, (s, e) => {
      setTimeout(() => { if (!p) $('#pn', s).focus(); }, 380);
      $('#ps', s).onclick = () => {
        n.name = $('#pn', s).value.trim(); n.phone = $('#pph', s).value.trim();
        if (!n.name) return toast('Enter a name');
        if (p) Object.assign(p, n); else people().push(n);
        if ($('#pm', s).checked) D().settings.me = n.id; else if (D().settings.me === n.id) D().settings.me = people().find(x => x.id !== n.id)?.id || n.id;
        persist(); e.close(); C.renderTab();
      };
      const dl = $('#pdl', s);
      if (dl) dl.onclick = () => { e.close(); setTimeout(() => ask('Delete ' + first(p) + '?', 'Their tasks stay but become unassigned.', 'Delete', () => {
        D().tasks.forEach(t => { if (t.assignee === p.id) t.assignee = ''; t.steps.forEach(st => { if (st.assignee === p.id) st.assignee = ''; }); });
        D().people = people().filter(x => x.id !== p.id);
        if (D().settings.me === p.id) D().settings.me = people()[0].id;
        if (who === p.id) who = 'all';
        persist(); C.renderTab();
      }), 150); };
    });
  }

  /* ---------- quick add ---------- */
  function quickAdd() {
    let a = me(), due = todayISO();
    openSheet(`<h3>New task</h3>
      <input id="qt" placeholder="What needs to be done?" autocomplete="off">
      <div class="gap"></div><label class="l">Assign to</label><div class="chips" id="qw"></div>
      <div class="gap"></div><label class="l">Due</label>
      <div class="chips" id="qd"><button type="button" class="chip t tap" data-d="0">Today</button><button type="button" class="chip t tap" data-d="1">Tomorrow</button><button type="button" class="chip t tap" data-d="">No date</button></div>
      <div style="margin-top:8px"><input id="qdt" type="date"></div>
      <div class="gap"></div><div class="row"><div><button class="btn line full tap" id="qm">More details</button></div><div><button class="btn full tap" id="qa">Add task</button></div></div>`, (s, e) => {
      const drawW = () => { $('#qw', s).innerHTML = chipsHTML(a); };
      const drawD = () => {
        $('#qdt', s).value = due;
        const td = todayISO();
        $('#qd', s).querySelectorAll('.chip').forEach(c => { const v = c.dataset.d; c.classList.toggle('on', v === '' ? !due : due === addDays(td, +v)); });
      };
      drawW(); drawD();
      $('#qw', s).onclick = ev => { const c = ev.target.closest('[data-v]'); if (c) { a = c.dataset.v; drawW(); } };
      $('#qd', s).onclick = ev => { const c = ev.target.closest('[data-d]'); if (c) { due = c.dataset.d === '' ? '' : addDays(todayISO(), +c.dataset.d); drawD(); } };
      $('#qdt', s).onchange = ev => { due = ev.target.value; drawD(); };
      setTimeout(() => $('#qt', s).focus(), 380);
      const make = () => ({ title: $('#qt', s).value.trim(), assignee: a, due });
      $('#qa', s).onclick = () => {
        const m = make(); if (!m.title) return toast('Write the task first');
        D().tasks.unshift(blank('daily', m)); persist(); e.close(); C.renderTab(); toast('Task added');
      };
      $('#qt', s).onkeydown = ev => { if (ev.key === 'Enter') $('#qa', s).click(); };
      $('#qm', s).onclick = () => { const m = make(); e.close(); setTimeout(() => openEditor(null, 'daily', m), 150); };
    });
  }
  const blank = (kind, over = {}) => ({ id: uid(), kind, title: '', assignee: me(), due: '', priority: 'med', client: '', link: null, notes: '', comments: [], files: [], steps: [], done: false, doneAt: '', created: new Date().toISOString(), by: me(), ...over });

  /* ---------- full editor ---------- */
  function openEditor(task, kindHint, prefill) {
    const isNew = !task;
    const n = task ? JSON.parse(JSON.stringify(task)) : blank(kindHint || 'daily', prefill || {});
    const snap = () => JSON.stringify({ ...n, comments: 0 });
    const s0 = snap();
    const cache = {}, pending = {}, removed = [];
    const dirty = () => snap() !== s0 || Object.keys(pending).length || removed.length;
    pushPage({
      title: isNew ? (n.kind === 'long' ? 'New activity' : 'New task') : (n.kind === 'long' ? 'Activity' : 'Task'),
      beforeClose(entry) {
        if (dirty()) { ask('Discard changes?', 'Your edits have not been saved.', 'Discard', () => closePage(entry)); return false; }
        return true;
      },
      build(entry) {
        const b = entry.body, long = () => n.kind === 'long';
        const docs = C.db().invoices;
        const clients = [...new Set(docs.map(d => d.customer).filter(Boolean))];
        b.innerHTML = `<div class="seg" id="kseg"><button data-k="daily">Daily task</button><button data-k="long">Long term</button></div>
        <div class="card"><label class="l">Title</label><input id="tt" value="${esc(n.title)}" placeholder="${long() ? 'e.g. Launch NFC card page' : 'e.g. Send quotation to client'}" autocomplete="off">
          <div class="gap"></div><label class="l">Assigned to</label><div class="chips" id="who"></div>
          <div class="gap"></div><label class="l" id="dl"></label><input id="td" type="date" value="${n.due}">
          <div class="chips" id="dq" style="margin-top:8px"><button type="button" class="chip t tap" data-d="0">Today</button><button type="button" class="chip t tap" data-d="1">Tomorrow</button><button type="button" class="chip t tap" data-d="7">Next week</button><button type="button" class="chip t tap" data-d="">Clear</button></div>
          <div class="gap"></div><label class="l">Priority</label>
          <div class="seg pri" id="pr" style="margin:0">${Object.entries(PRI).map(([k, [l, c]]) => `<button data-p="${k}" class="${c}">${l}</button>`).join('')}</div></div>
        <div id="stepsec"></div>
        <div class="card"><label class="l">Client or lead (optional)</label><input id="tc" list="cl" value="${esc(n.client)}" placeholder="Who is this about?"><datalist id="cl">${clients.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
          <div class="gap"></div><div id="lnk"></div></div>
        <div class="card"><label class="l">Notes</label><textarea id="tn" placeholder="Details, what to say, links...">${esc(n.notes)}</textarea></div>
        <div class="card"><label class="l">Photos</label><div class="thumbs" id="ph" style="margin-top:0"></div>
          <label class="btn sec full tap" for="pf" style="margin:0">${ICON.image}Add photo</label><input type="file" id="pf" accept="image/*" multiple class="hid"></div>
        <div id="cmsec"></div>`;
        const drawKind = () => {
          b.querySelectorAll('#kseg button').forEach(x => x.classList.toggle('on', x.dataset.k === n.kind));
          $('#dl', b).textContent = long() ? 'Target date' : 'Due date';
          $('#stepsec', b).classList.toggle('hid', !long());
          if (!isNew) entry.el.querySelector('h1').textContent = long() ? 'Activity' : 'Task';
        };
        const drawWho = () => { $('#who', b).innerHTML = chipsHTML(n.assignee); };
        const drawDue = () => {
          $('#td', b).value = n.due; const td = todayISO();
          $('#dq', b).querySelectorAll('.chip').forEach(c => { const v = c.dataset.d; c.classList.toggle('on', v === '' ? false : n.due === addDays(td, +v)); });
        };
        const drawPri = () => $('#pr', b).querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.p === n.priority));
        const drawLink = () => {
          $('#lnk', b).innerHTML = n.link
            ? `<label class="l">Linked document</label><div class="pick tap" data-a="open"><div><b>${esc(n.link.no)}</b><span>${esc(n.link.type === 'quotation' ? 'Quotation' : 'Invoice')} · ${esc(n.link.customer)}</span></div><button class="ib gray tap" data-a="unlink" aria-label="Remove link">${ICON.trash}</button></div>`
            : `<button class="btn sec full tap" data-a="link">${ICON.link}Link an invoice or quotation</button>`;
        };
        const drawSteps = () => {
          const p = progress(n);
          $('#stepsec', b).innerHTML = `<div class="card"><div class="top" style="display:flex;justify-content:space-between;margin-bottom:8px"><label class="l" style="margin:0">Steps</label><b>${p.d} of ${p.n} done</b></div>
            <div class="bar"><i style="width:${p.pct}%"></i></div><div class="gap"></div>
            ${n.steps.map(s => `<div class="step ${s.done ? 'on' : ''}" data-s="${s.id}"><button class="cb tap ${s.done ? 'on' : ''}" data-a="sck" aria-label="Done">${ICON.check}</button><input class="sx" value="${esc(s.text)}" placeholder="Step">
              <button class="ib gray tap sd" data-a="sdet" aria-label="Step details">${s.assignee ? av(s.assignee) : ICON.cal}</button></div>${s.due ? `<div class="sdue">${short(s.due)}</div>` : ''}`).join('')}
            <div class="row" style="margin-top:6px"><div><input id="ns" placeholder="Add a step" autocomplete="off"></div><div style="flex:none"><button class="btn sm tap" id="nsb">${ICON.plus}Add</button></div></div></div>
            <label class="sw" style="margin:0 2px 14px"><input type="checkbox" id="dn" ${n.done ? 'checked' : ''}>Mark whole activity as complete</label>`;
          const addStep = () => { const t = $('#ns', b).value.trim(); if (!t) return; n.steps.push({ id: uid(), text: t, done: false, assignee: '', due: '' }); n.done = false; drawSteps(); $('#ns', b).focus(); };
          $('#nsb', b).onclick = addStep;
          $('#ns', b).onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } };
          $('#dn', b).onchange = e => { n.done = e.target.checked; n.doneAt = n.done ? new Date().toISOString() : ''; };
        };
        const drawFiles = () => {
          $('#ph', b).innerHTML = n.files.map(f => `<div class="th2" data-f="${f.id}">${(pending[f.id] || cache[f.id]) ? `<img src="${pending[f.id] || cache[f.id]}" alt="">` : `<span class="ph">${ICON.image}</span>`}<button class="x tap" data-a="fx" aria-label="Remove">×</button></div>`).join('');
        };
        const drawComments = () => {
          if (isNew) { $('#cmsec', b).innerHTML = ''; return; }
          $('#cmsec', b).innerHTML = `<div class="secth"><span>Comments</span><span>${n.comments.length}</span></div>
            ${n.comments.map(c => `<div class="cmt"><div class="ch">${av(c.by)}<b>${esc(first(person(c.by)))}</b><small>${whenText(c.at)}</small></div><div class="cx">${esc(c.text)}</div></div>`).join('')}
            <div class="row"><div><input id="cn" placeholder="Write an update" autocomplete="off"></div><div style="flex:none"><button class="btn sm tap" id="cs">${ICON.send}Post</button></div></div>`;
          const post = () => {
            const t = $('#cn', b).value.trim(); if (!t) return;
            const c = { id: uid(), by: me(), text: t, at: new Date().toISOString() };
            n.comments.push(c); task.comments.push(c); persist(); drawComments(); toast('Comment added');
          };
          $('#cs', b).onclick = post;
          $('#cn', b).onkeydown = e => { if (e.key === 'Enter') post(); };
        };
        drawKind(); drawWho(); drawDue(); drawPri(); drawLink(); if (long()) drawSteps(); drawFiles(); drawComments();
        n.files.forEach(async f => { cache[f.id] = await loadImg('att_' + f.id); drawFiles(); });
        autosize($('#tn', b)); $('#tn', b).oninput = e => { n.notes = e.target.value; autosize(e.target); };
        $('#tt', b).oninput = e => { n.title = e.target.value; };
        $('#tc', b).oninput = e => { n.client = e.target.value; };
        $('#kseg', b).onclick = e => { const k = e.target.closest('[data-k]'); if (!k || k.dataset.k === n.kind) return; n.kind = k.dataset.k; drawKind(); if (long()) drawSteps(); };
        $('#who', b).onclick = e => { const c = e.target.closest('[data-v]'); if (c) { n.assignee = c.dataset.v; drawWho(); } };
        $('#td', b).onchange = e => { n.due = e.target.value; drawDue(); };
        $('#dq', b).onclick = e => { const c = e.target.closest('[data-d]'); if (c) { n.due = c.dataset.d === '' ? '' : addDays(todayISO(), +c.dataset.d); drawDue(); } };
        $('#pr', b).onclick = e => { const c = e.target.closest('[data-p]'); if (c) { n.priority = c.dataset.p; drawPri(); } };
        $('#lnk', b).onclick = e => {
          const a = e.target.closest('[data-a]')?.dataset.a;
          if (a === 'unlink') { n.link = null; drawLink(); }
          else if (a === 'open') C.openDoc(n.link.id);
          else if (a === 'link') pickDoc(d => { n.link = { id: d.id, no: d.no, type: d.type, customer: d.customer }; if (!n.client.trim()) { n.client = d.customer; $('#tc', b).value = d.customer; } drawLink(); });
        };
        $('#stepsec', b).onclick = e => {
          const row = e.target.closest('[data-s]'), a = e.target.closest('[data-a]')?.dataset.a; if (!row) return;
          const s = n.steps.find(x => x.id === row.dataset.s);
          if (a === 'sck') { s.done = !s.done; n.done = n.steps.length > 0 && n.steps.every(x => x.done); n.doneAt = n.done ? new Date().toISOString() : ''; drawSteps(); }
          else if (a === 'sdet') stepSheet(s, del => { if (del) n.steps = n.steps.filter(x => x !== s); drawSteps(); });
        };
        $('#stepsec', b).oninput = e => { const row = e.target.closest('[data-s]'); if (row && e.target.classList.contains('sx')) n.steps.find(x => x.id === row.dataset.s).text = e.target.value; };
        $('#pf', b).onchange = async e => {
          for (const f of e.target.files) {
            try { const id = uid(); pending[id] = await resizeImage(f, 1000); n.files.push({ id, name: f.name || 'photo' }); } catch (err) { toast('Could not read that photo'); }
          }
          e.target.value = ''; drawFiles();
        };
        $('#ph', b).onclick = e => {
          const t = e.target.closest('[data-f]'); if (!t) return;
          const id = t.dataset.f;
          if (e.target.closest('[data-a="fx"]')) { n.files = n.files.filter(f => f.id !== id); if (pending[id]) delete pending[id]; else removed.push(id); return drawFiles(); }
          const src = pending[id] || cache[id]; if (src) openSheet(`<img src="${src}" alt="" style="width:100%;border-radius:12px;display:block">`);
        };
        entry.right.innerHTML = isNew ? '' : `<button class="ib tap" id="tsh" aria-label="Send">${ICON.send}</button><button class="ib tap" id="tdl" aria-label="Delete">${ICON.trash}</button>`;
        if (!isNew) {
          $('#tsh', entry.right).onclick = () => {
            shareText(`Task: ${n.title}\nAssigned to: ${first(person(n.assignee))}\n${n.due ? (long() ? 'Target: ' : 'Due: ') + short(n.due) + '\n' : ''}Priority: ${PRI[n.priority][0]}${n.client ? '\nClient: ' + n.client : ''}${n.notes ? '\n\n' + n.notes : ''}${long() && n.steps.length ? '\n\nSteps:\n' + n.steps.map(s => (s.done ? '[x] ' : '[ ] ') + s.text).join('\n') : ''}`, n.title).then(ok => { if (!C.isNative) toast(ok ? 'Task text copied' : 'Could not copy'); });
          };
          $('#tdl', entry.right).onclick = () => ask('Delete this task?', n.title, 'Delete', () => {
            D().tasks = D().tasks.filter(t => t !== task); n.files.forEach(f => delImg('att_' + f.id)); persist(); closePage(entry); C.renderTab(); toast('Task deleted');
          });
        }
        entry.foot.classList.remove('hid');
        entry.foot.innerHTML = `<button class="btn full tap" id="sv">${ICON.check}Save</button>`;
        $('#sv', entry.foot).onclick = async () => {
          n.title = n.title.trim(); if (!n.title) return toast('Give the task a title');
          n.steps = n.steps.filter(s => s.text.trim()); n.steps.forEach(s => { s.text = s.text.trim(); });
          n.client = n.client.trim();
          for (const id of Object.keys(pending)) await saveImg('att_' + id, pending[id]);
          for (const id of removed) await delImg('att_' + id);
          if (isNew) D().tasks.unshift(n); else Object.assign(task, n);
          persist(); closePage(entry); C.renderTab(); toast(isNew ? 'Task added' : 'Task saved');
        };
        if (isNew && !n.title) setTimeout(() => $('#tt', b).focus(), 420);
      }
    });
  }
  function stepSheet(s, done) {
    openSheet(`<h3>Step details</h3><label class="l">Assigned to</label><div class="chips" id="sw"></div>
      <div class="gap"></div><label class="l">Date (optional)</label><input id="sdd" type="date" value="${s.due}">
      <div class="gap"></div><div class="row"><div><button class="btn line full tap" id="sdl">Delete step</button></div><div><button class="btn full tap" id="sok">Done</button></div></div>`, (sh, e) => {
      const draw = () => { $('#sw', sh).innerHTML = chipsHTML(s.assignee); };
      draw();
      $('#sw', sh).onclick = ev => { const c = ev.target.closest('[data-v]'); if (c) { s.assignee = c.dataset.v; draw(); } };
      $('#sdd', sh).onchange = ev => { s.due = ev.target.value; };
      $('#sok', sh).onclick = () => { e.close(); done(false); };
      $('#sdl', sh).onclick = () => { e.close(); done(true); };
    });
  }
  function pickDoc(pick) {
    const list = [...C.db().invoices].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.no.localeCompare(a.no));
    openSheet(`<h3>Link a document</h3><input id="dq" placeholder="Search by client or number"><div class="gap"></div><div id="dlst"></div>`, (s, e) => {
      const draw = () => {
        const q = $('#dq', s).value.trim().toLowerCase();
        const f = list.filter(d => !q || (d.customer + ' ' + d.no).toLowerCase().includes(q)).slice(0, 40);
        $('#dlst', s).innerHTML = f.map(d => `<div class="pick tap" data-id="${d.id}"><div><b>${esc(d.no)} · ${esc(d.customer)}</b><span>${d.type === 'quotation' ? 'Quotation' : 'Invoice'} · ${esc(d.date)}</span></div></div>`).join('') || '<p>No documents found.</p>';
      };
      draw(); $('#dq', s).oninput = draw;
      $('#dlst', s).onclick = ev => { const c = ev.target.closest('[data-id]'); if (c) { const d = list.find(x => x.id === c.dataset.id); e.close(); pick(d); } };
    });
  }

  /* ---------- sample data ---------- */
  function addSamples() {
    const td = todayISO(), mk = n => ({ id: uid(), name: n, phone: '', sample: true });
    const [a, b, c] = ['Rafi', 'Nusrat', 'Tanvir'].map(mk);
    people().push(a, b, c);
    const s = (text, done = false) => ({ id: uid(), text, done, assignee: '', due: '' });
    const T = (kind, title, o) => D().tasks.push({ ...blank(kind, { title, sample: true }), ...o });
    T('daily', 'Send revised quotation to the client', { assignee: b.id, due: td, priority: 'high', client: 'Sample Client Ltd' });
    T('daily', 'Call client about the delayed delivery', { assignee: a.id, due: addDays(td, -1), priority: 'high', client: 'Sample Traders' });
    T('daily', 'Collect payment for the pending invoice', { assignee: me(), due: td, priority: 'med' });
    T('daily', 'Confirm sample approval with the printing vendor', { assignee: c.id, due: addDays(td, 1), priority: 'med' });
    T('daily', 'Reply to new Facebook page inquiries', { assignee: b.id, due: td, priority: 'low' });
    T('long', 'Launch the NFC card product page', { assignee: me(), due: addDays(td, 21), priority: 'high', steps: [s('Finalize design', true), s('Write product copy', true), s('Set up payment method'), s('Test on 3 phones'), s('Publish and announce')] });
    T('long', 'Onboard a new printing vendor', { assignee: a.id, due: addDays(td, 30), priority: 'med', steps: [s('Collect price list', true), s('Request 2 sample prints'), s('Agree payment terms')] });
    persist(); C.renderTab(); toast('Sample tasks added');
  }

  /* ---------- summary for Home ---------- */
  function summary() {
    const td = todayISO(), open = D().tasks.filter(t => !t.done && t.kind === 'daily');
    return { today: open.filter(t => t.due === td).length, over: open.filter(t => t.due && t.due < td).length, open: open.length, long: D().tasks.filter(t => !t.done && t.kind === 'long').length };
  }
  function setWho(w) { who = w; }

  return {
    tabs: [['daily', 'Daily', ICON.tasks], ['long', 'Long Term', ICON.flag], ['team', 'Team', ICON.users]],
    views: { daily: tDaily, long: tLong, team: tTeam },
    summary, setWho
  };
}
