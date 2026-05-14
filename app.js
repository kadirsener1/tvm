(function(){
'use strict';

const API = '';
let TOKEN = localStorage.getItem('iv_token') || '';
let ROLE = localStorage.getItem('iv_role') || '';
let USERNAME = localStorage.getItem('iv_username') || '';

// =====================
// API HELPER
// =====================
async function api(method, url, body = null) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (TOKEN) opts.headers['Authorization'] = `Bearer ${TOKEN}`;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(API + url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Hata oluştu');
    return data;
}

// =====================
// UTILS
// =====================
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = t => { if (!t) return ''; const d = document.createElement('div'); d.textContent = t; return d.innerHTML; };
const fdt = ts => new Date(ts).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function toast(m, t = 'i') {
    const c = $('#toasts'), ic = { s: 'fa-check-circle', e: 'fa-exclamation-circle', w: 'fa-exclamation-triangle', i: 'fa-info-circle' };
    const el = document.createElement('div'); el.className = `toast ${t}`;
    el.innerHTML = `<i class="fas ${ic[t]}"></i><span>${m}</span>`;
    c.appendChild(el); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 200); }, 3000);
}

function dlFile(content, name) {
    const b = new Blob([content], { type: 'application/x-mpegURL' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

function cpText(t) {
    navigator.clipboard.writeText(t).then(() => toast('Kopyalandı!', 's')).catch(() => {
        const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast('Kopyalandı!', 's');
    });
}

function setTheme(t) { document.documentElement.setAttribute('data-theme', t); localStorage.setItem('iv_theme', t); $$('.tb').forEach(b => b.classList.toggle('active', b.dataset.theme === t)); }
$$('.tb').forEach(b => b.addEventListener('click', () => { setTheme(b.dataset.theme); toast('Tema değişti', 's'); }));

// =====================
// AUTH
// =====================
$$('.atab').forEach(t => t.addEventListener('click', () => {
    $$('.atab').forEach(x => x.classList.remove('active')); $$('.aform').forEach(x => x.classList.remove('active'));
    t.classList.add('active'); $(`#${t.dataset.tab}Form`).classList.add('active');
}));

$('#loginForm').addEventListener('submit', async e => {
    e.preventDefault(); $('#lErr').textContent = '';
    try {
        const data = await api('POST', '/api/auth/login', { username: $('#lUser').value.trim(), password: $('#lPass').value });
        TOKEN = data.token; ROLE = data.role; USERNAME = data.username;
        localStorage.setItem('iv_token', TOKEN); localStorage.setItem('iv_role', ROLE); localStorage.setItem('iv_username', USERNAME);
        if (ROLE === 'admin') showAdmin(); else showUser();
        toast('Giriş başarılı!', 's');
    } catch (e) { $('#lErr').textContent = e.message; }
});

$('#registerForm').addEventListener('submit', async e => {
    e.preventDefault(); $('#rErr').textContent = '';
    const p1 = $('#rPass').value, p2 = $('#rPass2').value;
    if (p1 !== p2) { $('#rErr').textContent = 'Şifreler eşleşmiyor!'; return; }
    try {
        const data = await api('POST', '/api/auth/register', { username: $('#rUser').value.trim(), email: $('#rEmail').value.trim(), password: p1 });
        TOKEN = data.token; ROLE = data.role; USERNAME = data.username;
        localStorage.setItem('iv_token', TOKEN); localStorage.setItem('iv_role', ROLE); localStorage.setItem('iv_username', USERNAME);
        showUser(); toast('Kayıt başarılı!', 's');
    } catch (e) { $('#rErr').textContent = e.message; }
});

function logout() {
    TOKEN = ''; ROLE = ''; USERNAME = '';
    localStorage.removeItem('iv_token'); localStorage.removeItem('iv_role'); localStorage.removeItem('iv_username');
    $('#adminPanel').classList.add('hidden'); $('#userPanel').classList.add('hidden'); $('#authScreen').classList.remove('hidden');
    toast('Çıkış yapıldı', 'i');
}
$('#aOut').addEventListener('click', logout); $('#uOut').addEventListener('click', logout);

function showAdmin() {
    $('#authScreen').classList.add('hidden'); $('#userPanel').classList.add('hidden'); $('#adminPanel').classList.remove('hidden');
    rAdmDash(); $('#loginForm').reset(); $('#registerForm').reset();
}
function showUser() {
    $('#authScreen').classList.add('hidden'); $('#adminPanel').classList.add('hidden'); $('#userPanel').classList.remove('hidden');
    $('#uName').textContent = USERNAME; $('#uNameT').textContent = USERNAME; $('#uWel').textContent = USERNAME;
    rUsrHome(); $('#loginForm').reset(); $('#registerForm').reset();
}

// Check session
async function checkSession() {
    if (!TOKEN) return;
    try {
        if (ROLE === 'admin') { await api('GET', '/api/stats'); showAdmin(); }
        else { await api('GET', '/api/user/stats'); showUser(); }
    } catch (e) { logout(); }
}

// =====================
// NAVIGATION
// =====================
const aTitles = { 'a-dash': 'Dashboard', 'a-ch': 'Kanallar', 'a-add': 'Kanal Ekle', 'a-cat': 'Kategoriler', 'a-imp': 'M3U İçe Aktar', 'a-exp': 'M3U Dışa Aktar', 'a-users': 'Kullanıcılar', 'a-set': 'Ayarlar' };
const uTitles = { 'u-home': 'Ana Sayfa', 'u-dl': 'M3U İndir', 'u-links': 'Linklerim', 'u-prof': 'Profilim' };

function aNav(p) {
    $('#aSB').querySelectorAll('.ni').forEach(n => n.classList.remove('active')); $$('#aCnt .pg').forEach(x => x.classList.remove('active'));
    $(`#aSB .ni[data-p="${p}"]`)?.classList.add('active'); $(`#pg-${p}`)?.classList.add('active');
    $('#aTT').textContent = aTitles[p] || ''; $('#aSB').classList.remove('open');
    if (p === 'a-dash') rAdmDash(); if (p === 'a-ch') rAdmCh(); if (p === 'a-add') pAdmAdd();
    if (p === 'a-cat') rAdmCats(); if (p === 'a-imp') rImpCS(); if (p === 'a-exp') rAExpF();
    if (p === 'a-users') rUList();
}
function uNav(p) {
    $('#uSB').querySelectorAll('.ni').forEach(n => n.classList.remove('active')); $$('#userPanel .cnt .pg').forEach(x => x.classList.remove('active'));
    $(`#uSB .ni[data-p="${p}"]`)?.classList.add('active'); $(`#pg-${p}`)?.classList.add('active');
    $('#uTT').textContent = uTitles[p] || ''; $('#uSB').classList.remove('open');
    if (p === 'u-home') rUsrHome(); if (p === 'u-dl') rUsrDl(); if (p === 'u-links') rUsrLinks(); if (p === 'u-prof') rUsrProf();
}

$('#aSB').querySelectorAll('.ni').forEach(n => n.addEventListener('click', e => { e.preventDefault(); aNav(n.dataset.p); }));
$('#uSB').querySelectorAll('.ni').forEach(n => n.addEventListener('click', e => { e.preventDefault(); uNav(n.dataset.p); }));
$$('.qab').forEach(b => b.addEventListener('click', () => { const g = b.dataset.g; if (g?.startsWith('u-')) uNav(g); }));

$('#aMT').addEventListener('click', () => $('#aSB').classList.toggle('open'));
$('#aSBX').addEventListener('click', () => $('#aSB').classList.remove('open'));
$('#uMT').addEventListener('click', () => $('#uSB').classList.toggle('open'));
$('#uSBX').addEventListener('click', () => $('#uSB').classList.remove('open'));

// =====================
// ADMIN DASHBOARD
// =====================
async function rAdmDash() {
    try {
        const stats = await api('GET', '/api/stats');
        $('#aStats').innerHTML = `
            <div class="sc c1"><div class="si"><i class="fas fa-tv"></i></div><div class="sx"><h3>${stats.channels}</h3><p>Kanal</p></div></div>
            <div class="sc c2"><div class="si"><i class="fas fa-folder"></i></div><div class="sx"><h3>${stats.categories}</h3><p>Kategori</p></div></div>
            <div class="sc c3"><div class="si"><i class="fas fa-users"></i></div><div class="sx"><h3>${stats.users}</h3><p>Kullanıcı</p></div></div>
            <div class="sc c4"><div class="si"><i class="fas fa-download"></i></div><div class="sx"><h3>${stats.downloads}</h3><p>İndirme</p></div></div>`;

        const ch = await api('GET', '/api/channels');
        const recent = [...ch].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);
        $('#aRec').innerHTML = recent.length ? recent.map(c => `<div class="rr"><div class="rl">${esc(c.name).charAt(0)}</div><span class="rn">${esc(c.name)}</span><span class="rc">${esc(c.category || '—')}</span></div>`).join('') : '<p style="color:var(--t3)">—</p>';

        const cats = await api('GET', '/api/categories');
        const gc = {}; ch.forEach(c => { const g = c.category || '—'; gc[g] = (gc[g] || 0) + 1; });
        const mx = Math.max(...Object.values(gc), 1);
        const cc = {}; cats.forEach(c => cc[c.name] = c.color);
        $('#aChart').innerHTML = Object.entries(gc).sort((a, b) => b[1] - a[1]).map(([n, v]) => `<div class="br"><div class="bl"><span>${esc(n)}</span><span>${v}</span></div><div class="bt"><div class="bf" style="width:${v / mx * 100}%;background:${cc[n] || 'var(--ac)'}"></div></div></div>`).join('') || '<p style="color:var(--t3)">—</p>';
    } catch (e) { toast(e.message, 'e'); }
}

// =====================
// ADMIN CHANNELS
// =====================
let allChannels = [], aP = 1, aSel = new Set();

async function rAdmCh() {
    try {
        allChannels = await api('GET', '/api/channels');
        const cats = await api('GET', '/api/categories');
        $('#aFC').innerHTML = '<option value="">Tümü</option>' + cats.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
        renderChPage();
    } catch (e) { toast(e.message, 'e'); }
}

function renderChPage() {
    const sr = ($('#aSrch')?.value || '').toLowerCase(), fc = $('#aFC')?.value || '', fs = $('#aFS')?.value || '';
    let f = allChannels.filter(c => (c.name.toLowerCase().includes(sr) || c.url.toLowerCase().includes(sr) || (c.category || '').toLowerCase().includes(sr)) && (!fc || c.category === fc) && (!fs || c.status === fs));
    f.sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));
    const pp = 20, tp = Math.ceil(f.length / pp) || 1; if (aP > tp) aP = tp;
    const pg = f.slice((aP - 1) * pp, aP * pp);

    $('#aChL').innerHTML = pg.length ? pg.map(c => `<div class="cc${c.status === 'inactive' ? ' off' : ''}"><input type="checkbox" class="ccb" data-id="${c.id}"${aSel.has(c.id) ? ' checked' : ''}>${c.logo ? `<img src="${esc(c.logo)}" class="cl" onerror="this.outerHTML='<div class=cp>${esc(c.name).charAt(0)}</div>'">` : `<div class="cp">${esc(c.name).charAt(0)}</div>`}<div class="ci"><div class="cn">${esc(c.name)}</div><div class="cm">${c.category ? `<span><i class="fas fa-folder"></i>${esc(c.category)}</span>` : ''}</div><div class="cu">${esc(c.url)}</div></div><span class="cb ${c.status === 'active' ? 'bon' : 'boff'}">${c.status === 'active' ? 'Aktif' : 'Pasif'}</span><div class="ca"><button class="btn sm ol _e" data-id="${c.id}"><i class="fas fa-edit"></i></button><button class="btn sm ol _t" data-id="${c.id}"><i class="fas fa-${c.status === 'active' ? 'toggle-on' : 'toggle-off'}"></i></button><button class="btn sm dn _d" data-id="${c.id}"><i class="fas fa-trash"></i></button></div></div>`).join('') : '<p style="text-align:center;color:var(--t3);padding:26px">Kanal yok.</p>';

    let ph = ''; if (tp > 1) { ph += `<button${aP === 1 ? ' disabled' : ''} data-p="${aP - 1}"><i class="fas fa-chevron-left"></i></button>`; for (let i = 1; i <= tp; i++) { if (tp <= 7 || i === 1 || i === tp || Math.abs(i - aP) <= 1) ph += `<button class="${i === aP ? 'active' : ''}" data-p="${i}">${i}</button>`; else if (Math.abs(i - aP) === 2) ph += `<button disabled>…</button>`; } ph += `<button${aP === tp ? ' disabled' : ''} data-p="${aP + 1}"><i class="fas fa-chevron-right"></i></button>`; }
    $('#aPag').innerHTML = ph;

    $$('.ccb').forEach(cb => cb.addEventListener('change', () => { cb.checked ? aSel.add(cb.dataset.id) : aSel.delete(cb.dataset.id); }));
    $$('._e').forEach(b => b.addEventListener('click', () => openMod(b.dataset.id)));
    $$('._t').forEach(b => b.addEventListener('click', async () => { try { await api('POST', `/api/channels/toggle/${b.dataset.id}`); rAdmCh(); toast('Değiştirildi', 's'); } catch (e) { toast(e.message, 'e'); } }));
    $$('._d').forEach(b => b.addEventListener('click', async () => { if (!confirm('Sil?')) return; try { await api('DELETE', `/api/channels/${b.dataset.id}`); aSel.delete(b.dataset.id); rAdmCh(); toast('Silindi', 's'); } catch (e) { toast(e.message, 'e'); } }));
    $$('#aPag button:not([disabled])').forEach(b => b.addEventListener('click', () => { aP = parseInt(b.dataset.p); renderChPage(); }));
}

$('#aSrch')?.addEventListener('input', () => { aP = 1; renderChPage(); });
$('#aFC')?.addEventListener('change', () => { aP = 1; renderChPage(); });
$('#aFS')?.addEventListener('change', () => { aP = 1; renderChPage(); });
$('#aSelA')?.addEventListener('click', () => { allChannels.length === aSel.size ? aSel.clear() : allChannels.forEach(c => aSel.add(c.id)); renderChPage(); });
$('#aDelS')?.addEventListener('click', async () => {
    if (!aSel.size) return toast('Seçim yok', 'w');
    if (!confirm(`${aSel.size} kanal silinecek?`)) return;
    try { await api('POST', '/api/channels/bulk-delete', { ids: [...aSel] }); aSel.clear(); rAdmCh(); toast('Silindi', 's'); } catch (e) { toast(e.message, 'e'); }
});

// Add channel
async function pAdmAdd() {
    $('#aChEI').value = ''; $('#aChF').reset(); $('#aChSB').innerHTML = '<i class="fas fa-save"></i> Kaydet'; $('#aChCB').style.display = 'none';
    try { const cats = await api('GET', '/api/categories'); $('#aChC').innerHTML = '<option value="">Seçin</option>' + cats.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join(''); } catch (e) { }
}

$('#aChF').addEventListener('submit', async e => {
    e.preventDefault();
    const d = { name: $('#aChN').value.trim(), url: $('#aChU').value.trim(), category: $('#aChC').value, logo: $('#aChL').value.trim(), epgId: $('#aChE').value.trim(), status: $('#aChS').value, order: parseInt($('#aChO').value) || 0 };
    const eI = $('#aChEI').value;
    try {
        if (eI) { await api('PUT', `/api/channels/${eI}`, d); toast('Güncellendi', 's'); }
        else { await api('POST', '/api/channels', d); toast('Eklendi', 's'); }
        pAdmAdd();
    } catch (e) { toast(e.message, 'e'); }
});
$('#aChCB').addEventListener('click', pAdmAdd);

// Edit modal
async function openMod(id) {
    const c = allChannels.find(x => x.id === id); if (!c) return;
    try { const cats = await api('GET', '/api/categories'); $('#eC').innerHTML = '<option value="">Seçin</option>' + cats.map(x => `<option value="${esc(x.name)}"${x.name === c.category ? ' selected' : ''}>${esc(x.name)}</option>`).join(''); } catch (e) { }
    $('#eI').value = c.id; $('#eN').value = c.name; $('#eU').value = c.url; $('#eL').value = c.logo || ''; $('#eE').value = c.epgId || ''; $('#eS').value = c.status; $('#eO').value = c.order || 0;
    $('#edMod').classList.remove('hidden');
}
function closeMod() { $('#edMod').classList.add('hidden'); }
$('#mX').addEventListener('click', closeMod); $('#mCa').addEventListener('click', closeMod); $('.mbg')?.addEventListener('click', closeMod);
$('#edFrm').addEventListener('submit', async e => {
    e.preventDefault();
    try { await api('PUT', `/api/channels/${$('#eI').value}`, { name: $('#eN').value.trim(), url: $('#eU').value.trim(), category: $('#eC').value, logo: $('#eL').value.trim(), epgId: $('#eE').value.trim(), status: $('#eS').value, order: parseInt($('#eO').value) || 0 }); closeMod(); rAdmCh(); toast('Güncellendi', 's'); } catch (e) { toast(e.message, 'e'); }
});

// =====================
// ADMIN CATEGORIES
// =====================
async function rAdmCats() {
    try {
        const cats = await api('GET', '/api/categories');
        $('#aCatL').innerHTML = cats.length ? cats.map(c => `<div class="ccd"><div class="cci" style="background:${c.color || 'var(--ac)'}"><i class="${c.icon || 'fas fa-folder'}"></i></div><div class="ccf"><h4>${esc(c.name)}</h4><p>${c.channelCount} kanal</p></div><div class="cca"><button class="btn sm ol _ce" data-id="${c.id}"><i class="fas fa-edit"></i></button><button class="btn sm dn _cd" data-id="${c.id}"><i class="fas fa-trash"></i></button></div></div>`).join('') : '<p style="color:var(--t3);padding:18px">Yok.</p>';

        $$('._ce').forEach(b => b.addEventListener('click', () => {
            const c = cats.find(x => x.id === b.dataset.id); if (!c) return;
            $('#aCatEI').value = c.id; $('#aCatN').value = c.name; $('#aCatIc').value = c.icon || ''; $('#aCatCo').value = c.color || '#1da1f2';
            $('#aCatSB').innerHTML = '<i class="fas fa-save"></i>'; $('#aCatCB').style.display = 'inline-flex';
        }));
        $$('._cd').forEach(b => b.addEventListener('click', async () => {
            if (!confirm('Sil?')) return;
            try { await api('DELETE', `/api/categories/${b.dataset.id}`); rAdmCats(); toast('Silindi', 's'); } catch (e) { toast(e.message, 'e'); }
        }));
    } catch (e) { toast(e.message, 'e'); }
}

$('#aCatF').addEventListener('submit', async e => {
    e.preventDefault();
    const eI = $('#aCatEI').value, d = { name: $('#aCatN').value.trim(), icon: $('#aCatIc').value.trim() || 'fas fa-folder', color: $('#aCatCo').value };
    try {
        if (eI) { await api('PUT', `/api/categories/${eI}`, d); toast('Güncellendi', 's'); }
        else { await api('POST', '/api/categories', d); toast('Eklendi', 's'); }
        $('#aCatF').reset(); $('#aCatEI').value = ''; $('#aCatSB').innerHTML = '<i class="fas fa-plus"></i>'; $('#aCatCB').style.display = 'none'; $('#aCatCo').value = '#1da1f2';
        rAdmCats();
    } catch (e) { toast(e.message, 'e'); }
});
$('#aCatCB').addEventListener('click', () => { $('#aCatF').reset(); $('#aCatEI').value = ''; $('#aCatSB').innerHTML = '<i class="fas fa-plus"></i>'; $('#aCatCB').style.display = 'none'; $('#aCatCo').value = '#1da1f2'; });
$$('.ih').forEach(h => h.addEventListener('click', () => { $('#aCatIc').value = h.dataset.i; }));

// =====================
// ADMIN IMPORT
// =====================
function parseM3U(t) { const ls = t.split('\n').map(l => l.trim()).filter(Boolean); const r = []; let cur = null; for (const l of ls) { if (l.startsWith('#EXTINF')) { cur = {}; cur.epgId = ga(l, 'tvg-id'); const tn = ga(l, 'tvg-name'); cur.logo = ga(l, 'tvg-logo'); cur.group = ga(l, 'group-title'); const ci = l.lastIndexOf(','); cur.name = tn || (ci >= 0 ? l.substring(ci + 1).trim() : '') || '?'; } else if (l.startsWith('#')) continue; else if (cur) { cur.url = l; r.push({ ...cur }); cur = null; } } return r; }
function ga(l, a) { const m = l.match(new RegExp(`${a}="([^"]*)"`, 'i')); return m ? m[1] : ''; }

$$('.itab').forEach(t => t.addEventListener('click', () => { $$('.itab').forEach(x => x.classList.remove('active')); $$('.itc').forEach(x => x.classList.remove('active')); t.classList.add('active'); $(`#iT-${t.dataset.t}`).classList.add('active'); }));

async function rImpCS() { try { const cats = await api('GET', '/api/categories'); $('#iCS').innerHTML = '<option value="">Orijinal grubu kullan</option>' + cats.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join(''); } catch (e) { } }

const dz = $('#dz');
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); }); dz.addEventListener('dragleave', () => dz.classList.remove('over'));
dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); if (e.dataTransfer.files[0]) rdF(e.dataTransfer.files[0]); });
$('#m3uF').addEventListener('change', e => { if (e.target.files[0]) rdF(e.target.files[0]); });
function rdF(f) { const r = new FileReader(); r.onload = e => shPV(parseM3U(e.target.result)); r.readAsText(f); }
$('#iPTB').addEventListener('click', () => { const t = $('#m3uT').value.trim(); if (!t) return toast('Boş', 'w'); shPV(parseM3U(t)); });
$('#iFUB').addEventListener('click', async () => { const u = $('#m3uU').value.trim(); if (!u) return toast('URL yok', 'w'); try { const r = await fetch(u); shPV(parseM3U(await r.text())); } catch (e) { toast('Hata', 'e'); } });

let pvArr = [];
function shPV(list) { pvArr = list; if (!list.length) { toast('Kanal yok', 'w'); $('#iPV').classList.add('hidden'); return; } $('#iPV').classList.remove('hidden'); $('#pvC').textContent = list.length; $('#pvL').innerHTML = list.map((c, i) => `<div class="pvi"><input type="checkbox" checked data-i="${i}" class="pvc"><span class="pvn">${esc(c.name)}</span>${c.group ? `<span class="pvg">${esc(c.group)}</span>` : ''}</div>`).join(''); toast(`${list.length} kanal`, 's'); }
$('#pvSA').addEventListener('click', () => $$('.pvc').forEach(c => c.checked = true));
$('#pvDA').addEventListener('click', () => $$('.pvc').forEach(c => c.checked = false));
$('#pvIB').addEventListener('click', async () => {
    const idxs = []; $$('.pvc').forEach(cb => { if (cb.checked) idxs.push(parseInt(cb.dataset.i)); });
    if (!idxs.length) return toast('Seçim yok', 'w');
    const channels = idxs.map(i => pvArr[i]).filter(Boolean);
    try { const r = await api('POST', '/api/channels/bulk-import', { channels, category: $('#iCS').value }); $('#iPV').classList.add('hidden'); pvArr = []; toast(`${r.added} kanal eklendi!`, 's'); } catch (e) { toast(e.message, 'e'); }
});

// =====================
// ADMIN EXPORT
// =====================
async function rAExpF() { try { const cats = await api('GET', '/api/categories'); $('#aEC').innerHTML = '<option value="">Tümü</option>' + cats.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join(''); } catch (e) { } }
$('#aGM').addEventListener('click', async () => {
    try {
        const r = await api('GET', `/api/export?category=${$('#aEC').value}&status=${$('#aES').value}`);
        $('#aMO').value = r.m3u; $('#aDM').classList.remove('hidden'); $('#aCM').classList.remove('hidden');
        toast(`${r.count} kanal`, 's');
    } catch (e) { toast(e.message, 'e'); }
});
$('#aDM').addEventListener('click', () => dlFile($('#aMO').value, 'admin-playlist.m3u'));
$('#aCM').addEventListener('click', () => cpText($('#aMO').value));

// =====================
// ADMIN USERS
// =====================
async function rUList() {
    try {
        const users = await api('GET', '/api/users');
        const q = ($('#uSrch')?.value || '').toLowerCase();
        const f = users.filter(u => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
        $('#uList').innerHTML = f.length ? f.map(u => `<div class="uc${u.banned ? ' off' : ''}"><div class="uav">${u.username.charAt(0).toUpperCase()}</div><div class="ui"><h4>${esc(u.username)}</h4><p>${esc(u.email)} · ${fdt(u.createdAt)}</p></div><div class="us"><span><i class="fas fa-link"></i>${u.linkCount}</span><span><i class="fas fa-download"></i>${u.downloads}</span></div><div class="ua"><button class="btn sm ${u.banned ? 'su' : 'ol'} _ub" data-id="${u.id}"><i class="fas fa-${u.banned ? 'unlock' : 'ban'}"></i></button><button class="btn sm dn _ud" data-id="${u.id}"><i class="fas fa-trash"></i></button></div></div>`).join('') : '<p style="color:var(--t3);padding:18px">Yok.</p>';
        $$('._ub').forEach(b => b.addEventListener('click', async () => { try { await api('POST', `/api/users/${b.dataset.id}/toggle-ban`); rUList(); toast('Güncellendi', 's'); } catch (e) { toast(e.message, 'e'); } }));
        $$('._ud').forEach(b => b.addEventListener('click', async () => { if (!confirm('Sil?')) return; try { await api('DELETE', `/api/users/${b.dataset.id}`); rUList(); toast('Silindi', 's'); } catch (e) { toast(e.message, 'e'); } }));
    } catch (e) { toast(e.message, 'e'); }
}
$('#uSrch')?.addEventListener('input', rUList);

// =====================
// ADMIN SETTINGS
// =====================
$('#aPF').addEventListener('submit', async e => {
    e.preventDefault();
    try { await api('POST', '/api/admin/change-password', { currentPassword: $('#aCP').value, newPassword: $('#aNP').value }); $('#aPF').reset(); toast('Güncellendi', 's'); } catch (e) { toast(e.message, 'e'); }
});
$('#aBK').addEventListener('click', async () => {
    try { const d = await api('GET', '/api/backup'); dlFile(JSON.stringify(d, null, 2), `backup-${new Date().toISOString().slice(0, 10)}.json`); toast('İndirildi', 's'); } catch (e) { toast(e.message, 'e'); }
});
$('#aRS').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = async ev => {
        try { const d = JSON.parse(ev.target.result); if (!confirm('Üzerine yaz?')) return; await api('POST', '/api/restore', d); rAdmDash(); toast('Yüklendi!', 's'); } catch (e) { toast('Hata', 'e'); }
    }; r.readAsText(f); e.target.value = '';
});
$('#aCA').addEventListener('click', async () => {
    if (!confirm('TÜM VERİLER silinecek!')) return;
    try { await api('POST', '/api/clear-all'); rAdmDash(); toast('Silindi', 's'); } catch (e) { toast(e.message, 'e'); }
});

// =====================
// USER HOME
// =====================
async function rUsrHome() {
    try {
        const s = await api('GET', '/api/user/stats');
        $('#uStats').innerHTML = `
            <div class="sc c1"><div class="si"><i class="fas fa-folder"></i></div><div class="sx"><h3>${s.categories}</h3><p>Kategori</p></div></div>
            <div class="sc c2"><div class="si"><i class="fas fa-tv"></i></div><div class="sx"><h3>${s.channels}</h3><p>Kanal</p></div></div>
            <div class="sc c3"><div class="si"><i class="fas fa-download"></i></div><div class="sx"><h3>${s.myDownloads}</h3><p>İndirmem</p></div></div>
            <div class="sc c4"><div class="si"><i class="fas fa-link"></i></div><div class="sx"><h3>${s.myLinks}</h3><p>Linkim</p></div></div>`;
    } catch (e) { toast(e.message, 'e'); }
}

// =====================
// USER DOWNLOAD - KEY PART
// =====================
async function rUsrDl() {
    try {
        const cats = await api('GET', '/api/user/categories');
        $('#uCatSel').innerHTML = cats.length ? cats.map(c => `<div class="csc" data-cat="${esc(c.name)}"><div class="csci" style="background:${c.color || 'var(--ac)'}"><i class="${c.icon || 'fas fa-folder'}"></i></div><div class="cscf"><h4>${esc(c.name)}</h4><p>${c.channelCount} kanal</p></div><div class="csck"><i class="fas fa-check"></i></div></div>`).join('') : '<p style="color:var(--t3)">Kategori yok.</p>';
        $$('.csc').forEach(c => c.addEventListener('click', () => c.classList.toggle('sel')));
        $('#uPV').classList.add('hidden');
    } catch (e) { toast(e.message, 'e'); }
}

$('#uGen').addEventListener('click', async () => {
    const selCats = []; $$('.csc.sel').forEach(c => selCats.push(c.dataset.cat));
    if (!selCats.length) return toast('Kategori seçin', 'w');

    try {
        const link = await api('POST', '/api/user/generate', { categories: selCats });
        $('#uLO').value = link.m3uUrl;
        $('#uES').innerHTML = `<span><i class="fas fa-tv"></i> ${link.channelCount} kanal</span><span><i class="fas fa-folder"></i> ${selCats.length} kategori</span><span><i class="fas fa-fingerprint"></i> ${link.token.substring(0, 8)}</span>`;
        $('#uPV').classList.remove('hidden');
        toast(`${link.channelCount} kanallık M3U linki oluşturuldu!`, 's');
    } catch (e) { toast(e.message, 'e'); }
});

$('#uDLF').addEventListener('click', () => {
    const url = $('#uLO').value; if (!url) return;
    window.open(url, '_blank');
    toast('İndiriliyor...', 's');
});
$('#uCpL').addEventListener('click', () => cpText($('#uLO').value));
$('#uCpLB').addEventListener('click', () => cpText($('#uLO').value));

// =====================
// USER LINKS
// =====================
async function rUsrLinks() {
    try {
        const links = await api('GET', '/api/user/links');
        const cats = await api('GET', '/api/user/categories');
        const cc = {}; cats.forEach(c => cc[c.name] = c.color);

        $('#uLL').innerHTML = links.length ? links.map(l => `<div class="lc">
            <div class="lct"><h4><i class="fas fa-link"></i> #${l.token.substring(0, 8)}</h4><span class="lcd">${fdt(l.createdAt)}</span></div>
            <div class="lcc">${(l.categories || []).map(c => `<span class="lcg" style="background:${cc[c] || 'var(--ac)'}">${esc(c)}</span>`).join('')}</div>
            <div class="lcs"><span><i class="fas fa-tv"></i> ${l.channelCount} kanal</span><span><i class="fas fa-download"></i> ${l.dlCount || 0} indirme</span>${l.lastAccess ? `<span><i class="fas fa-clock"></i> ${fdt(l.lastAccess)}</span>` : ''}</div>
            <div class="lcl"><input type="text" value="${esc(l.m3uUrl)}" readonly><button class="btn sm pr _lc" data-url="${esc(l.m3uUrl)}"><i class="fas fa-copy"></i></button></div>
            <div class="lca"><button class="btn sm dn _lr" data-id="${l.id}"><i class="fas fa-trash"></i> Sil</button></div>
        </div>`).join('') : '<p style="color:var(--t3);padding:18px">Henüz link yok.</p>';

        $$('._lc').forEach(b => b.addEventListener('click', () => cpText(b.dataset.url)));
        $$('._lr').forEach(b => b.addEventListener('click', async () => {
            if (!confirm('Sil?')) return;
            try { await api('DELETE', `/api/user/links/${b.dataset.id}`); rUsrLinks(); toast('Silindi', 's'); } catch (e) { toast(e.message, 'e'); }
        }));
    } catch (e) { toast(e.message, 'e'); }
}

// =====================
// USER PROFILE
// =====================
async function rUsrProf() {
    try {
        const p = await api('GET', '/api/user/profile');
        $('#uProf').innerHTML = `<div class="fg"><label>Kullanıcı</label><input type="text" value="${esc(p.username)}" disabled></div><div class="fg"><label>E-posta</label><input type="email" value="${esc(p.email)}" disabled></div><div class="fg"><label>Kayıt</label><input type="text" value="${fdt(p.createdAt)}" disabled></div>`;
    } catch (e) { toast(e.message, 'e'); }
}

$('#uPF').addEventListener('submit', async e => {
    e.preventDefault();
    const np = $('#uNP').value, np2 = $('#uNP2').value;
    if (np !== np2) return toast('Şifreler eşleşmiyor', 'e');
    try { await api('POST', '/api/user/change-password', { currentPassword: $('#uCP').value, newPassword: np }); $('#uPF').reset(); toast('Güncellendi', 's'); } catch (e) { toast(e.message, 'e'); }
});

// =====================
// INIT
// =====================
setTheme(localStorage.getItem('iv_theme') || 'dark');
checkSession();

})();
