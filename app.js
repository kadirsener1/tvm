(function(){
'use strict';

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
    if (TOKEN) opts.headers['Authorization'] = 'Bearer ' + TOKEN;
    if (body) opts.body = JSON.stringify(body);

    let res;
    try {
        res = await fetch(url, opts);
    } catch (e) {
        throw new Error('Sunucuya bağlanılamadı');
    }

    let data;
    try {
        data = await res.json();
    } catch (e) {
        if (!res.ok) throw new Error('Sunucu hatası: ' + res.status);
        return {};
    }

    if (!res.ok) {
        throw new Error(data.error || 'Hata: ' + res.status);
    }
    return data;
}

// =====================
// UTILS
// =====================
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function esc(t) {
    if (!t) return '';
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
}

function fdt(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('tr-TR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function toast(m, t = 'i') {
    const c = $('#toasts');
    const icons = { s: 'fa-check-circle', e: 'fa-exclamation-circle', w: 'fa-exclamation-triangle', i: 'fa-info-circle' };
    const el = document.createElement('div');
    el.className = 'toast ' + t;
    el.innerHTML = '<i class="fas ' + (icons[t] || icons.i) + '"></i><span>' + m + '</span>';
    c.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, 3000);
}

function dlFile(content, name) {
    const b = new Blob([content], { type: 'application/x-mpegURL' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
}

function cpText(t) {
    if (!t) return;
    navigator.clipboard.writeText(t)
        .then(() => toast('Kopyalandı!', 's'))
        .catch(() => {
            const ta = document.createElement('textarea');
            ta.value = t;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            toast('Kopyalandı!', 's');
        });
}

// =====================
// THEME
// =====================
function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('iv_theme', t);
    $$('.tb').forEach(b => b.classList.toggle('active', b.dataset.theme === t));
}

$$('.tb').forEach(b => b.addEventListener('click', () => {
    setTheme(b.dataset.theme);
    toast('Tema değişti', 's');
}));

// =====================
// AUTH
// =====================
$$('.atab').forEach(t => t.addEventListener('click', () => {
    $$('.atab').forEach(x => x.classList.remove('active'));
    $$('.aform').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const form = $('#' + t.dataset.tab + 'Form');
    if (form) form.classList.add('active');
}));

$('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('#lErr').textContent = '';
    const username = $('#lUser').value.trim();
    const password = $('#lPass').value;
    if (!username || !password) {
        $('#lErr').textContent = 'Tüm alanları doldurun';
        return;
    }
    try {
        const data = await api('POST', '/api/auth/login', { username, password });
        TOKEN = data.token;
        ROLE = data.role;
        USERNAME = data.username;
        localStorage.setItem('iv_token', TOKEN);
        localStorage.setItem('iv_role', ROLE);
        localStorage.setItem('iv_username', USERNAME);
        if (ROLE === 'admin') showAdmin();
        else showUser();
        toast('Giriş başarılı!', 's');
    } catch (e) {
        $('#lErr').textContent = e.message;
    }
});

$('#registerForm').addEventListener('submit', async e => {
    e.preventDefault();
    $('#rErr').textContent = '';
    const username = $('#rUser').value.trim();
    const email = $('#rEmail').value.trim();
    const p1 = $('#rPass').value;
    const p2 = $('#rPass2').value;
    if (!username || !email || !p1) {
        $('#rErr').textContent = 'Tüm alanları doldurun';
        return;
    }
    if (p1 !== p2) {
        $('#rErr').textContent = 'Şifreler eşleşmiyor!';
        return;
    }
    try {
        const data = await api('POST', '/api/auth/register', { username, email, password: p1 });
        TOKEN = data.token;
        ROLE = data.role;
        USERNAME = data.username;
        localStorage.setItem('iv_token', TOKEN);
        localStorage.setItem('iv_role', ROLE);
        localStorage.setItem('iv_username', USERNAME);
        showUser();
        toast('Kayıt başarılı!', 's');
    } catch (e) {
        $('#rErr').textContent = e.message;
    }
});

function logout() {
    TOKEN = '';
    ROLE = '';
    USERNAME = '';
    localStorage.removeItem('iv_token');
    localStorage.removeItem('iv_role');
    localStorage.removeItem('iv_username');
    $('#adminPanel').classList.add('hidden');
    $('#userPanel').classList.add('hidden');
    $('#authScreen').classList.remove('hidden');
    // Reset forms
    $('#loginForm').reset();
    $('#registerForm').reset();
    $('#lErr').textContent = '';
    $('#rErr').textContent = '';
    toast('Çıkış yapıldı', 'i');
}

$('#aOut').addEventListener('click', logout);
$('#uOut').addEventListener('click', logout);

function showAdmin() {
    $('#authScreen').classList.add('hidden');
    $('#userPanel').classList.add('hidden');
    $('#adminPanel').classList.remove('hidden');
    $('#loginForm').reset();
    $('#registerForm').reset();
    $('#lErr').textContent = '';
    $('#rErr').textContent = '';
    aNav('a-dash');
}

function showUser() {
    $('#authScreen').classList.add('hidden');
    $('#adminPanel').classList.add('hidden');
    $('#userPanel').classList.remove('hidden');
    $('#uName').textContent = USERNAME;
    $('#uNameT').textContent = USERNAME;
    $('#uWel').textContent = USERNAME;
    $('#loginForm').reset();
    $('#registerForm').reset();
    $('#lErr').textContent = '';
    $('#rErr').textContent = '';
    uNav('u-home');
}

async function checkSession() {
    if (!TOKEN || !ROLE) return;
    try {
        if (ROLE === 'admin') {
            await api('GET', '/api/stats');
            showAdmin();
        } else if (ROLE === 'user') {
            await api('GET', '/api/user/stats');
            showUser();
        } else {
            logout();
        }
    } catch (e) {
        // Token expired or invalid — silently logout
        console.log('Session expired:', e.message);
        TOKEN = '';
        ROLE = '';
        USERNAME = '';
        localStorage.removeItem('iv_token');
        localStorage.removeItem('iv_role');
        localStorage.removeItem('iv_username');
        // Don't show error toast, just stay on login screen
    }
}

// =====================
// ADMIN NAVIGATION
// =====================
const aTitles = {
    'a-dash': 'Dashboard', 'a-ch': 'Kanallar', 'a-add': 'Kanal Ekle',
    'a-cat': 'Kategoriler', 'a-imp': 'M3U İçe Aktar', 'a-exp': 'M3U Dışa Aktar',
    'a-users': 'Kullanıcılar', 'a-set': 'Ayarlar'
};

function aNav(p) {
    $('#aSB').querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
    $$('#aCnt .pg').forEach(x => x.classList.remove('active'));
    const navEl = $('#aSB .ni[data-p="' + p + '"]');
    const pgEl = $('#pg-' + p);
    if (navEl) navEl.classList.add('active');
    if (pgEl) pgEl.classList.add('active');
    $('#aTT').textContent = aTitles[p] || '';
    $('#aSB').classList.remove('open');

    // Load data for each page
    switch (p) {
        case 'a-dash': rAdmDash(); break;
        case 'a-ch': rAdmCh(); break;
        case 'a-add': pAdmAdd(); break;
        case 'a-cat': rAdmCats(); break;
        case 'a-imp': rImpCS(); break;
        case 'a-exp': rAExpF(); break;
        case 'a-users': rUList(); break;
    }
}

$('#aSB').querySelectorAll('.ni').forEach(n => {
    n.addEventListener('click', e => { e.preventDefault(); aNav(n.dataset.p); });
});

$('#aMT').addEventListener('click', () => $('#aSB').classList.toggle('open'));
$('#aSBX').addEventListener('click', () => $('#aSB').classList.remove('open'));

// =====================
// USER NAVIGATION
// =====================
const uTitles = {
    'u-home': 'Ana Sayfa', 'u-dl': 'M3U İndir',
    'u-links': 'Linklerim', 'u-prof': 'Profilim'
};

function uNav(p) {
    $('#uSB').querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
    $$('#userPanel .cnt .pg').forEach(x => x.classList.remove('active'));
    const navEl = $('#uSB .ni[data-p="' + p + '"]');
    const pgEl = $('#pg-' + p);
    if (navEl) navEl.classList.add('active');
    if (pgEl) pgEl.classList.add('active');
    $('#uTT').textContent = uTitles[p] || '';
    $('#uSB').classList.remove('open');

    switch (p) {
        case 'u-home': rUsrHome(); break;
        case 'u-dl': rUsrDl(); break;
        case 'u-links': rUsrLinks(); break;
        case 'u-prof': rUsrProf(); break;
    }
}

$('#uSB').querySelectorAll('.ni').forEach(n => {
    n.addEventListener('click', e => { e.preventDefault(); uNav(n.dataset.p); });
});

$$('.qab').forEach(b => b.addEventListener('click', () => {
    const g = b.dataset.g;
    if (g && g.startsWith('u-')) uNav(g);
}));

$('#uMT').addEventListener('click', () => $('#uSB').classList.toggle('open'));
$('#uSBX').addEventListener('click', () => $('#uSB').classList.remove('open'));

// =====================
// ADMIN DASHBOARD
// =====================
async function rAdmDash() {
    try {
        const stats = await api('GET', '/api/stats');
        $('#aStats').innerHTML =
            '<div class="sc c1"><div class="si"><i class="fas fa-tv"></i></div><div class="sx"><h3>' + stats.channels + '</h3><p>Kanal</p></div></div>' +
            '<div class="sc c2"><div class="si"><i class="fas fa-folder"></i></div><div class="sx"><h3>' + stats.categories + '</h3><p>Kategori</p></div></div>' +
            '<div class="sc c3"><div class="si"><i class="fas fa-users"></i></div><div class="sx"><h3>' + stats.users + '</h3><p>Kullanıcı</p></div></div>' +
            '<div class="sc c4"><div class="si"><i class="fas fa-download"></i></div><div class="sx"><h3>' + stats.downloads + '</h3><p>İndirme</p></div></div>';

        const ch = await api('GET', '/api/channels');
        const recent = ch.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);
        $('#aRec').innerHTML = recent.length
            ? recent.map(c => '<div class="rr"><div class="rl">' + esc(c.name).charAt(0) + '</div><span class="rn">' + esc(c.name) + '</span><span class="rc">' + esc(c.category || '—') + '</span></div>').join('')
            : '<p style="color:var(--t3);font-size:12px">Henüz kanal eklenmemiş.</p>';

        const cats = await api('GET', '/api/categories');
        const gc = {};
        ch.forEach(c => { const g = c.category || '—'; gc[g] = (gc[g] || 0) + 1; });
        const mx = Math.max(...Object.values(gc), 1);
        const cc = {};
        cats.forEach(c => cc[c.name] = c.color);
        $('#aChart').innerHTML = Object.entries(gc).sort((a, b) => b[1] - a[1]).map(([n, v]) =>
            '<div class="br"><div class="bl"><span>' + esc(n) + '</span><span>' + v + '</span></div><div class="bt"><div class="bf" style="width:' + (v / mx * 100) + '%;background:' + (cc[n] || 'var(--ac)') + '"></div></div></div>'
        ).join('') || '<p style="color:var(--t3);font-size:12px">Veri yok.</p>';

    } catch (e) {
        console.error('Dashboard error:', e);
        toast('Dashboard yüklenemedi: ' + e.message, 'e');
    }
}

// =====================
// ADMIN CHANNELS
// =====================
let allChannels = [];
let aPage = 1;
let aSel = new Set();
const PER_PAGE = 20;

async function rAdmCh() {
    try {
        allChannels = await api('GET', '/api/channels');
        const cats = await api('GET', '/api/categories');
        $('#aFC').innerHTML = '<option value="">Tüm Kategoriler</option>' + cats.map(c => '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>').join('');
        renderChPage();
    } catch (e) {
        toast('Kanallar yüklenemedi: ' + e.message, 'e');
    }
}

function renderChPage() {
    const sr = ($('#aSrch') ? $('#aSrch').value : '').toLowerCase();
    const fc = $('#aFC') ? $('#aFC').value : '';
    const fs = $('#aFS') ? $('#aFS').value : '';

    let filtered = allChannels.filter(c => {
        const matchSearch = c.name.toLowerCase().includes(sr) || c.url.toLowerCase().includes(sr) || (c.category || '').toLowerCase().includes(sr);
        const matchCat = !fc || c.category === fc;
        const matchSt = !fs || c.status === fs;
        return matchSearch && matchCat && matchSt;
    });

    filtered.sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));

    const totalPages = Math.ceil(filtered.length / PER_PAGE) || 1;
    if (aPage > totalPages) aPage = totalPages;
    const pageItems = filtered.slice((aPage - 1) * PER_PAGE, aPage * PER_PAGE);

    if (pageItems.length) {
        $('#aChL').innerHTML = pageItems.map(c => {
            const initial = esc(c.name).charAt(0);
            return '<div class="cc' + (c.status === 'inactive' ? ' off' : '') + '">' +
                '<input type="checkbox" class="ccb" data-id="' + c.id + '"' + (aSel.has(c.id) ? ' checked' : '') + '>' +
                (c.logo
                    ? '<img src="' + esc(c.logo) + '" class="cl" onerror="this.outerHTML=\'<div class=cp>' + initial + '</div>\'">'
                    : '<div class="cp">' + initial + '</div>') +
                '<div class="ci">' +
                    '<div class="cn">' + esc(c.name) + '</div>' +
                    '<div class="cm">' + (c.category ? '<span><i class="fas fa-folder"></i> ' + esc(c.category) + '</span>' : '') + '</div>' +
                    '<div class="cu">' + esc(c.url) + '</div>' +
                '</div>' +
                '<span class="cb ' + (c.status === 'active' ? 'bon' : 'boff') + '">' + (c.status === 'active' ? 'Aktif' : 'Pasif') + '</span>' +
                '<div class="ca">' +
                    '<button class="btn sm ol _e" data-id="' + c.id + '" title="Düzenle"><i class="fas fa-edit"></i></button>' +
                    '<button class="btn sm ol _t" data-id="' + c.id + '" title="Durum"><i class="fas fa-' + (c.status === 'active' ? 'toggle-on' : 'toggle-off') + '"></i></button>' +
                    '<button class="btn sm dn _d" data-id="' + c.id + '" title="Sil"><i class="fas fa-trash"></i></button>' +
                '</div>' +
            '</div>';
        }).join('');
    } else {
        $('#aChL').innerHTML = '<p style="text-align:center;color:var(--t3);padding:30px">Kanal bulunamadı.</p>';
    }

    // Pagination
    let pagHtml = '';
    if (totalPages > 1) {
        pagHtml += '<button' + (aPage === 1 ? ' disabled' : '') + ' data-p="' + (aPage - 1) + '"><i class="fas fa-chevron-left"></i></button>';
        for (let i = 1; i <= totalPages; i++) {
            if (totalPages <= 7 || i === 1 || i === totalPages || Math.abs(i - aPage) <= 1) {
                pagHtml += '<button class="' + (i === aPage ? 'active' : '') + '" data-p="' + i + '">' + i + '</button>';
            } else if (Math.abs(i - aPage) === 2) {
                pagHtml += '<button disabled>…</button>';
            }
        }
        pagHtml += '<button' + (aPage === totalPages ? ' disabled' : '') + ' data-p="' + (aPage + 1) + '"><i class="fas fa-chevron-right"></i></button>';
    }
    $('#aPag').innerHTML = pagHtml;

    // Bind events
    $$('.ccb').forEach(cb => cb.addEventListener('change', () => {
        cb.checked ? aSel.add(cb.dataset.id) : aSel.delete(cb.dataset.id);
    }));
    $$('._e').forEach(b => b.addEventListener('click', () => openMod(b.dataset.id)));
    $$('._t').forEach(b => b.addEventListener('click', async () => {
        try {
            await api('POST', '/api/channels/toggle/' + b.dataset.id);
            await rAdmCh();
            toast('Durum değiştirildi', 's');
        } catch (e) { toast(e.message, 'e'); }
    }));
    $$('._d').forEach(b => b.addEventListener('click', async () => {
        if (!confirm('Bu kanalı silmek istediğinize emin misiniz?')) return;
        try {
            await api('DELETE', '/api/channels/' + b.dataset.id);
            aSel.delete(b.dataset.id);
            await rAdmCh();
            toast('Kanal silindi', 's');
        } catch (e) { toast(e.message, 'e'); }
    }));
    $$('#aPag button:not([disabled])').forEach(b => b.addEventListener('click', () => {
        aPage = parseInt(b.dataset.p);
        renderChPage();
    }));
}

$('#aSrch').addEventListener('input', () => { aPage = 1; renderChPage(); });
$('#aFC').addEventListener('change', () => { aPage = 1; renderChPage(); });
$('#aFS').addEventListener('change', () => { aPage = 1; renderChPage(); });

$('#aSelA').addEventListener('click', () => {
    if (allChannels.length === aSel.size) aSel.clear();
    else allChannels.forEach(c => aSel.add(c.id));
    renderChPage();
});

$('#aDelS').addEventListener('click', async () => {
    if (!aSel.size) return toast('Önce kanal seçin', 'w');
    if (!confirm(aSel.size + ' kanal silinecek. Emin misiniz?')) return;
    try {
        await api('POST', '/api/channels/bulk-delete', { ids: Array.from(aSel) });
        aSel.clear();
        await rAdmCh();
        toast('Seçili kanallar silindi', 's');
    } catch (e) { toast(e.message, 'e'); }
});

// =====================
// ADMIN ADD CHANNEL
// =====================
async function pAdmAdd() {
    $('#aChEI').value = '';
    $('#aChF').reset();
    $('#aChSB').innerHTML = '<i class="fas fa-save"></i> Kaydet';
    $('#aChCB').style.display = 'none';
    try {
        const cats = await api('GET', '/api/categories');
        $('#aChC').innerHTML = '<option value="">Kategori Seçin</option>' + cats.map(c => '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>').join('');
    } catch (e) {
        console.error('Categories load error:', e);
    }
}

$('#aChF').addEventListener('submit', async e => {
    e.preventDefault();
    const data = {
        name: $('#aChN').value.trim(),
        url: $('#aChU').value.trim(),
        category: $('#aChC').value,
        logo: $('#aChL').value.trim(),
        epgId: $('#aChE').value.trim(),
        status: $('#aChS').value,
        order: parseInt($('#aChO').value) || 0
    };

    if (!data.name || !data.url) return toast('Ad ve URL gerekli', 'w');

    const editId = $('#aChEI').value;
    try {
        if (editId) {
            await api('PUT', '/api/channels/' + editId, data);
            toast('Kanal güncellendi', 's');
        } else {
            await api('POST', '/api/channels', data);
            toast('Kanal eklendi', 's');
        }
        pAdmAdd();
    } catch (e) { toast(e.message, 'e'); }
});

$('#aChCB').addEventListener('click', () => pAdmAdd());

// =====================
// EDIT MODAL
// =====================
async function openMod(id) {
    const c = allChannels.find(x => x.id === id);
    if (!c) return;

    try {
        const cats = await api('GET', '/api/categories');
        $('#eC').innerHTML = '<option value="">Seçin</option>' + cats.map(x =>
            '<option value="' + esc(x.name) + '"' + (x.name === c.category ? ' selected' : '') + '>' + esc(x.name) + '</option>'
        ).join('');
    } catch (e) { console.error(e); }

    $('#eI').value = c.id;
    $('#eN').value = c.name;
    $('#eU').value = c.url;
    $('#eL').value = c.logo || '';
    $('#eE').value = c.epgId || '';
    $('#eS').value = c.status;
    $('#eO').value = c.order || 0;
    $('#edMod').classList.remove('hidden');
}

function closeMod() { $('#edMod').classList.add('hidden'); }
$('#mX').addEventListener('click', closeMod);
$('#mCa').addEventListener('click', closeMod);
$('.mbg').addEventListener('click', closeMod);

$('#edFrm').addEventListener('submit', async e => {
    e.preventDefault();
    const id = $('#eI').value;
    try {
        await api('PUT', '/api/channels/' + id, {
            name: $('#eN').value.trim(),
            url: $('#eU').value.trim(),
            category: $('#eC').value,
            logo: $('#eL').value.trim(),
            epgId: $('#eE').value.trim(),
            status: $('#eS').value,
            order: parseInt($('#eO').value) || 0
        });
        closeMod();
        await rAdmCh();
        toast('Kanal güncellendi', 's');
    } catch (e) { toast(e.message, 'e'); }
});

// =====================
// ADMIN CATEGORIES
// =====================
async function rAdmCats() {
    try {
        const cats = await api('GET', '/api/categories');
        if (cats.length) {
            $('#aCatL').innerHTML = cats.map(c =>
                '<div class="ccd">' +
                    '<div class="cci" style="background:' + (c.color || 'var(--ac)') + '"><i class="' + (c.icon || 'fas fa-folder') + '"></i></div>' +
                    '<div class="ccf"><h4>' + esc(c.name) + '</h4><p>' + (c.channelCount || 0) + ' kanal</p></div>' +
                    '<div class="cca">' +
                        '<button class="btn sm ol _ce" data-id="' + c.id + '"><i class="fas fa-edit"></i></button>' +
                        '<button class="btn sm dn _cd" data-id="' + c.id + '"><i class="fas fa-trash"></i></button>' +
                    '</div>' +
                '</div>'
            ).join('');
        } else {
            $('#aCatL').innerHTML = '<p style="color:var(--t3);padding:20px">Henüz kategori eklenmemiş.</p>';
        }

        $$('._ce').forEach(b => b.addEventListener('click', () => {
            const c = cats.find(x => x.id === b.dataset.id);
            if (!c) return;
            $('#aCatEI').value = c.id;
            $('#aCatN').value = c.name;
            $('#aCatIc').value = c.icon || '';
            $('#aCatCo').value = c.color || '#1da1f2';
            $('#aCatSB').innerHTML = '<i class="fas fa-save"></i> Güncelle';
            $('#aCatCB').style.display = 'inline-flex';
        }));

        $$('._cd').forEach(b => b.addEventListener('click', async () => {
            if (!confirm('Bu kategoriyi silmek istediğinize emin misiniz?')) return;
            try {
                await api('DELETE', '/api/categories/' + b.dataset.id);
                await rAdmCats();
                toast('Kategori silindi', 's');
            } catch (e) { toast(e.message, 'e'); }
        }));
    } catch (e) {
        toast('Kategoriler yüklenemedi: ' + e.message, 'e');
    }
}

$('#aCatF').addEventListener('submit', async e => {
    e.preventDefault();
    const editId = $('#aCatEI').value;
    const data = {
        name: $('#aCatN').value.trim(),
        icon: $('#aCatIc').value.trim() || 'fas fa-folder',
        color: $('#aCatCo').value
    };

    if (!data.name) return toast('Kategori adı gerekli', 'w');

    try {
        if (editId) {
            await api('PUT', '/api/categories/' + editId, data);
            toast('Kategori güncellendi', 's');
        } else {
            await api('POST', '/api/categories', data);
            toast('Kategori eklendi', 's');
        }
        resetCatForm();
        await rAdmCats();
    } catch (e) { toast(e.message, 'e'); }
});

function resetCatForm() {
    $('#aCatF').reset();
    $('#aCatEI').value = '';
    $('#aCatSB').innerHTML = '<i class="fas fa-plus"></i> Ekle';
    $('#aCatCB').style.display = 'none';
    $('#aCatCo').value = '#1da1f2';
}

$('#aCatCB').addEventListener('click', resetCatForm);

$$('.ih').forEach(h => h.addEventListener('click', () => {
    $('#aCatIc').value = h.dataset.i;
}));

// =====================
// ADMIN IMPORT
// =====================
function parseM3U(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const result = [];
    let cur = null;
    for (const line of lines) {
        if (line.startsWith('#EXTINF')) {
            cur = {};
            cur.epgId = getAttr(line, 'tvg-id');
            const tvgName = getAttr(line, 'tvg-name');
            cur.logo = getAttr(line, 'tvg-logo');
            cur.group = getAttr(line, 'group-title');
            const commaIdx = line.lastIndexOf(',');
            cur.name = tvgName || (commaIdx >= 0 ? line.substring(commaIdx + 1).trim() : '') || 'Bilinmeyen';
        } else if (line.startsWith('#')) {
            continue;
        } else if (cur) {
            cur.url = line;
            result.push(Object.assign({}, cur));
            cur = null;
        }
    }
    return result;
}

function getAttr(line, attr) {
    const m = line.match(new RegExp(attr + '="([^"]*)"', 'i'));
    return m ? m[1] : '';
}

$$('.itab').forEach(t => t.addEventListener('click', () => {
    $$('.itab').forEach(x => x.classList.remove('active'));
    $$('.itc').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const el = $('#iT-' + t.dataset.t);
    if (el) el.classList.add('active');
}));

async function rImpCS() {
    try {
        const cats = await api('GET', '/api/categories');
        $('#iCS').innerHTML = '<option value="">Orijinal grup bilgisini kullan</option>' + cats.map(c => '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>').join('');
    } catch (e) { console.error(e); }
}

// File upload
const dz = $('#dz');
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
dz.addEventListener('dragleave', () => dz.classList.remove('over'));
dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); });
$('#m3uF').addEventListener('change', e => { if (e.target.files[0]) readFile(e.target.files[0]); });

function readFile(f) {
    const reader = new FileReader();
    reader.onload = e => showPreview(parseM3U(e.target.result));
    reader.readAsText(f);
}

$('#iPTB').addEventListener('click', () => {
    const text = $('#m3uT').value.trim();
    if (!text) return toast('İçerik yapıştırın', 'w');
    showPreview(parseM3U(text));
});

$('#iFUB').addEventListener('click', async () => {
    const url = $('#m3uU').value.trim();
    if (!url) return toast('URL girin', 'w');
    try {
        toast('İndiriliyor...', 'i');
        const res = await fetch(url);
        const text = await res.text();
        showPreview(parseM3U(text));
    } catch (e) { toast('İndirilemedi: ' + e.message, 'e'); }
});

let parsedChannels = [];

function showPreview(list) {
    parsedChannels = list;
    if (!list.length) {
        toast('Kanal bulunamadı', 'w');
        $('#iPV').classList.add('hidden');
        return;
    }
    $('#iPV').classList.remove('hidden');
    $('#pvC').textContent = list.length;
    $('#pvL').innerHTML = list.map((c, i) =>
        '<div class="pvi"><input type="checkbox" checked data-i="' + i + '" class="pvc"><span class="pvn">' + esc(c.name) + '</span>' +
        (c.group ? '<span class="pvg">' + esc(c.group) + '</span>' : '') + '</div>'
    ).join('');
    toast(list.length + ' kanal bulundu', 's');
}

$('#pvSA').addEventListener('click', () => $$('.pvc').forEach(c => c.checked = true));
$('#pvDA').addEventListener('click', () => $$('.pvc').forEach(c => c.checked = false));

$('#pvIB').addEventListener('click', async () => {
    const indices = [];
    $$('.pvc').forEach(cb => { if (cb.checked) indices.push(parseInt(cb.dataset.i)); });
    if (!indices.length) return toast('En az bir kanal seçin', 'w');

    const channels = indices.map(i => parsedChannels[i]).filter(Boolean);
    try {
        const result = await api('POST', '/api/channels/bulk-import', { channels, category: $('#iCS').value });
        $('#iPV').classList.add('hidden');
        parsedChannels = [];
        toast(result.added + ' kanal eklendi!', 's');
    } catch (e) { toast(e.message, 'e'); }
});

// =====================
// ADMIN EXPORT
// =====================
async function rAExpF() {
    try {
        const cats = await api('GET', '/api/categories');
        $('#aEC').innerHTML = '<option value="">Tüm Kategoriler</option>' + cats.map(c => '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>').join('');
    } catch (e) { console.error(e); }
}

$('#aGM').addEventListener('click', async () => {
    try {
        const cat = $('#aEC').value;
        const st = $('#aES').value;
        const result = await api('GET', '/api/export?category=' + encodeURIComponent(cat) + '&status=' + encodeURIComponent(st));
        $('#aMO').value = result.m3u;
        $('#aDM').classList.remove('hidden');
        $('#aCM').classList.remove('hidden');
        toast(result.count + ' kanallık M3U oluşturuldu', 's');
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
        const query = ($('#uSrch') ? $('#uSrch').value : '').toLowerCase();
        const filtered = users.filter(u => u.username.toLowerCase().includes(query) || u.email.toLowerCase().includes(query));

        if (filtered.length) {
            $('#uList').innerHTML = filtered.map(u =>
                '<div class="uc' + (u.banned ? ' off' : '') + '">' +
                    '<div class="uav">' + u.username.charAt(0).toUpperCase() + '</div>' +
                    '<div class="ui"><h4>' + esc(u.username) + '</h4><p>' + esc(u.email) + ' · ' + fdt(u.createdAt) + '</p></div>' +
                    '<div class="us"><span><i class="fas fa-link"></i> ' + u.linkCount + '</span><span><i class="fas fa-download"></i> ' + u.downloads + '</span></div>' +
                    '<div class="ua">' +
                        '<button class="btn sm ' + (u.banned ? 'su' : 'ol') + ' _ub" data-id="' + u.id + '" title="' + (u.banned ? 'Engeli Kaldır' : 'Engelle') + '"><i class="fas fa-' + (u.banned ? 'unlock' : 'ban') + '"></i></button>' +
                        '<button class="btn sm dn _ud" data-id="' + u.id + '" title="Sil"><i class="fas fa-trash"></i></button>' +
                    '</div>' +
                '</div>'
            ).join('');
        } else {
            $('#uList').innerHTML = '<p style="color:var(--t3);padding:20px">Kullanıcı bulunamadı.</p>';
        }

        $$('._ub').forEach(b => b.addEventListener('click', async () => {
            try {
                await api('POST', '/api/users/' + b.dataset.id + '/toggle-ban');
                await rUList();
                toast('Durum güncellendi', 's');
            } catch (e) { toast(e.message, 'e'); }
        }));

        $$('._ud').forEach(b => b.addEventListener('click', async () => {
            if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;
            try {
                await api('DELETE', '/api/users/' + b.dataset.id);
                await rUList();
                toast('Kullanıcı silindi', 's');
            } catch (e) { toast(e.message, 'e'); }
        }));
    } catch (e) {
        toast('Kullanıcılar yüklenemedi: ' + e.message, 'e');
    }
}

$('#uSrch').addEventListener('input', () => rUList());

// =====================
// ADMIN SETTINGS
// =====================
$('#aPF').addEventListener('submit', async e => {
    e.preventDefault();
    try {
        await api('POST', '/api/admin/change-password', {
            currentPassword: $('#aCP').value,
            newPassword: $('#aNP').value
        });
        $('#aPF').reset();
        toast('Şifre güncellendi', 's');
    } catch (e) { toast(e.message, 'e'); }
});

$('#aBK').addEventListener('click', async () => {
    try {
        const data = await api('GET', '/api/backup');
        dlFile(JSON.stringify(data, null, 2), 'iptv-backup-' + new Date().toISOString().slice(0, 10) + '.json');
        toast('Yedek indirildi', 's');
    } catch (e) { toast(e.message, 'e'); }
});

$('#aRS').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
        try {
            const data = JSON.parse(ev.target.result);
            if (!confirm('Mevcut veriler üzerine yazılacak. Devam?')) return;
            await api('POST', '/api/restore', data);
            rAdmDash();
            toast('Yedek yüklendi!', 's');
        } catch (e) { toast('Geçersiz dosya: ' + e.message, 'e'); }
    };
    reader.readAsText(file);
    e.target.value = '';
});

$('#aCA').addEventListener('click', async () => {
    if (!confirm('TÜM VERİLER silinecek! Emin misiniz?')) return;
    if (!confirm('Bu işlem geri alınamaz! Devam?')) return;
    try {
        await api('POST', '/api/clear-all');
        rAdmDash();
        toast('Tüm veriler silindi', 's');
    } catch (e) { toast(e.message, 'e'); }
});

// =====================
// USER HOME
// =====================
async function rUsrHome() {
    try {
        const stats = await api('GET', '/api/user/stats');
        $('#uStats').innerHTML =
            '<div class="sc c1"><div class="si"><i class="fas fa-folder"></i></div><div class="sx"><h3>' + stats.categories + '</h3><p>Kategori</p></div></div>' +
            '<div class="sc c2"><div class="si"><i class="fas fa-tv"></i></div><div class="sx"><h3>' + stats.channels + '</h3><p>Kanal</p></div></div>' +
            '<div class="sc c3"><div class="si"><i class="fas fa-download"></i></div><div class="sx"><h3>' + stats.myDownloads + '</h3><p>İndirmem</p></div></div>' +
            '<div class="sc c4"><div class="si"><i class="fas fa-link"></i></div><div class="sx"><h3>' + stats.myLinks + '</h3><p>Linkim</p></div></div>';
    } catch (e) {
        toast('Veriler yüklenemedi: ' + e.message, 'e');
    }
}

// =====================
// USER DOWNLOAD
// =====================
let lastGeneratedLink = null;

async function rUsrDl() {
    try {
        const cats = await api('GET', '/api/user/categories');
        if (cats.length) {
            $('#uCatSel').innerHTML = cats.map(c =>
                '<div class="csc" data-cat="' + esc(c.name) + '">' +
                    '<div class="csci" style="background:' + (c.color || 'var(--ac)') + '"><i class="' + (c.icon || 'fas fa-folder') + '"></i></div>' +
                    '<div class="cscf"><h4>' + esc(c.name) + '</h4><p>' + c.channelCount + ' kanal</p></div>' +
                    '<div class="csck"><i class="fas fa-check"></i></div>' +
                '</div>'
            ).join('');
        } else {
            $('#uCatSel').innerHTML = '<p style="color:var(--t3)">Henüz kategori eklenmemiş.</p>';
        }

        $$('.csc').forEach(card => {
            card.addEventListener('click', () => card.classList.toggle('sel'));
        });

        $('#uPV').classList.add('hidden');
        lastGeneratedLink = null;
    } catch (e) {
        toast('Kategoriler yüklenemedi: ' + e.message, 'e');
    }
}

$('#uGen').addEventListener('click', async () => {
    const selectedCats = [];
    $$('.csc.sel').forEach(c => selectedCats.push(c.dataset.cat));
    if (!selectedCats.length) return toast('En az bir kategori seçin', 'w');

    try {
        const link = await api('POST', '/api/user/generate', { categories: selectedCats });
        lastGeneratedLink = link;
        $('#uLO').value = link.m3uUrl;
        $('#uES').innerHTML =
            '<span><i class="fas fa-tv"></i> ' + link.channelCount + ' kanal</span>' +
            '<span><i class="fas fa-folder"></i> ' + selectedCats.length + ' kategori</span>' +
            '<span><i class="fas fa-fingerprint"></i> ' + link.token.substring(0, 8) + '</span>';
        $('#uPV').classList.remove('hidden');
        toast(link.channelCount + ' kanallık M3U linki oluşturuldu!', 's');
    } catch (e) { toast(e.message, 'e'); }
});

$('#uDLF').addEventListener('click', () => {
    if (!lastGeneratedLink) return;
    // Open download URL
    window.open('/download/' + lastGeneratedLink.token, '_blank');
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
        let cats = [];
        try { cats = await api('GET', '/api/user/categories'); } catch (e) {}
        const catColors = {};
        cats.forEach(c => catColors[c.name] = c.color);

        if (links.length) {
            $('#uLL').innerHTML = links.map(l =>
                '<div class="lc">' +
                    '<div class="lct"><h4><i class="fas fa-link"></i> Playlist #' + l.token.substring(0, 8) + '</h4><span class="lcd">' + fdt(l.createdAt) + '</span></div>' +
                    '<div class="lcc">' + (l.categories || []).map(c => '<span class="lcg" style="background:' + (catColors[c] || 'var(--ac)') + '">' + esc(c) + '</span>').join('') + '</div>' +
                    '<div class="lcs">' +
                        '<span><i class="fas fa-tv"></i> ' + l.channelCount + ' kanal</span>' +
                        '<span><i class="fas fa-download"></i> ' + (l.dlCount || 0) + ' indirme</span>' +
                        (l.lastAccess ? '<span><i class="fas fa-clock"></i> ' + fdt(l.lastAccess) + '</span>' : '') +
                    '</div>' +
                    '<div class="lcl"><input type="text" value="' + esc(l.m3uUrl) + '" readonly><button class="btn sm pr _lc" data-url="' + esc(l.m3uUrl) + '"><i class="fas fa-copy"></i></button></div>' +
                    '<div class="lca">' +
                        '<button class="btn sm su _ldl" data-token="' + l.token + '"><i class="fas fa-download"></i> İndir</button>' +
                        '<button class="btn sm dn _lrm" data-id="' + l.id + '"><i class="fas fa-trash"></i> Sil</button>' +
                    '</div>' +
                '</div>'
            ).join('');
        } else {
            $('#uLL').innerHTML = '<p style="color:var(--t3);padding:20px">Henüz bir link oluşturmadınız. "M3U İndir" sayfasından oluşturabilirsiniz.</p>';
        }

        $$('._lc').forEach(b => b.addEventListener('click', () => cpText(b.dataset.url)));
        $$('._ldl').forEach(b => b.addEventListener('click', () => {
            window.open('/download/' + b.dataset.token, '_blank');
            toast('İndiriliyor...', 's');
        }));
        $$('._lrm').forEach(b => b.addEventListener('click', async () => {
            if (!confirm('Bu linki silmek istediğinize emin misiniz?')) return;
            try {
                await api('DELETE', '/api/user/links/' + b.dataset.id);
                await rUsrLinks();
                toast('Link silindi', 's');
            } catch (e) { toast(e.message, 'e'); }
        }));
    } catch (e) {
        toast('Linkler yüklenemedi: ' + e.message, 'e');
    }
}

// =====================
// USER PROFILE
// =====================
async function rUsrProf() {
    try {
        const profile = await api('GET', '/api/user/profile');
        $('#uProf').innerHTML =
            '<div class="fg"><label>Kullanıcı Adı</label><input type="text" value="' + esc(profile.username) + '" disabled></div>' +
            '<div class="fg"><label>E-posta</label><input type="email" value="' + esc(profile.email) + '" disabled></div>' +
            '<div class="fg"><label>Kayıt Tarihi</label><input type="text" value="' + fdt(profile.createdAt) + '" disabled></div>';
    } catch (e) {
        toast('Profil yüklenemedi: ' + e.message, 'e');
    }
}

$('#uPF').addEventListener('submit', async e => {
    e.preventDefault();
    const np = $('#uNP').value;
    const np2 = $('#uNP2').value;
    if (np !== np2) return toast('Şifreler eşleşmiyor', 'e');
    try {
        await api('POST', '/api/user/change-password', {
            currentPassword: $('#uCP').value,
            newPassword: np
        });
        $('#uPF').reset();
        toast('Şifre güncellendi', 's');
    } catch (e) { toast(e.message, 'e'); }
});

// =====================
// INIT
// =====================
setTheme(localStorage.getItem('iv_theme') || 'dark');
checkSession();

})();
