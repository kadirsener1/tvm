const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'iptv_super_secret_key_change_this';
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// =====================
// MIDDLEWARE
// =====================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// =====================
// DATABASE
// =====================
function getDefaultDB() {
    return {
        admin: {
            username: 'admin',
            password: bcrypt.hashSync('admin123', 10)
        },
        users: [],
        channels: [],
        categories: [],
        links: [],
        settings: {
            siteName: 'IPTV Panel',
            maxLinksPerUser: 50
        }
    };
}

function loadDB() {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        if (!fs.existsSync(DB_FILE)) {
            const def = getDefaultDB();
            fs.writeFileSync(DB_FILE, JSON.stringify(def, null, 2));
            return def;
        }
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.error('DB load error:', e);
        return getDefaultDB();
    }
}

function saveDB(db) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error('DB save error:', e);
    }
}

let db = loadDB();

// =====================
// AUTH MIDDLEWARE
// =====================
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Token gerekli' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Geçersiz token' });
    }
}

function adminMiddleware(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin yetkisi gerekli' });
    next();
}

// =====================
// M3U SERVE - THE KEY ENDPOINT
// IPTV players hit this URL directly
// =====================
app.get('/m3u/:token', (req, res) => {
    const { token } = req.params;
    const link = db.links.find(l => l.token === token);

    if (!link) {
        return res.status(404).type('text/plain').send('#EXTM3U\n# Link bulunamadi veya suresi dolmus');
    }

    // Check if user is banned
    const user = db.users.find(u => u.id === link.userId);
    if (user && user.banned) {
        return res.status(403).type('text/plain').send('#EXTM3U\n# Hesabiniz engellenmis');
    }

    // Build fresh M3U from current channels (always up-to-date)
    const selectedCats = link.categories || [];
    const channels = db.channels.filter(c =>
        c.status === 'active' && selectedCats.includes(c.category)
    ).sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));

    let m3u = '#EXTM3U\n';
    channels.forEach(c => {
        let line = '#EXTINF:-1';
        if (c.epgId) line += ` tvg-id="${c.epgId}"`;
        line += ` tvg-name="${c.name}"`;
        if (c.logo) line += ` tvg-logo="${c.logo}"`;
        if (c.category) line += ` group-title="${c.category}"`;
        line += `,${c.name}`;
        m3u += line + '\n' + c.url + '\n';
    });

    // Update stats
    link.dlCount = (link.dlCount || 0) + 1;
    link.lastAccess = Date.now();
    link.channelCount = channels.length;
    saveDB(db);

    // Serve as M3U file
    res.set({
        'Content-Type': 'audio/x-mpegurl; charset=utf-8',
        'Content-Disposition': `inline; filename="playlist-${token.substring(0, 8)}.m3u"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    res.send(m3u);
});

// Also serve with .m3u extension for compatibility
app.get('/m3u/:token.m3u', (req, res) => {
    req.params.token = req.params.token.replace('.m3u', '');
    // Redirect to the main handler
    res.redirect(`/m3u/${req.params.token}`);
});

// =====================
// AUTH ROUTES
// =====================
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });

    // Check admin
    if (username.toLowerCase() === db.admin.username.toLowerCase()) {
        if (!bcrypt.compareSync(password, db.admin.password)) {
            return res.status(401).json({ error: 'Şifre hatalı' });
        }
        const token = jwt.sign({ role: 'admin', username: db.admin.username }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({ token, role: 'admin', username: db.admin.username });
    }

    // Check user
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Şifre hatalı' });
    if (user.banned) return res.status(403).json({ error: 'Hesabınız engellenmiş' });

    const token = jwt.sign({ role: 'user', userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, role: 'user', userId: user.id, username: user.username });
});

app.post('/api/auth/register', (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'Tüm alanlar gerekli' });
    if (username.length < 3) return res.status(400).json({ error: 'Kullanıcı adı en az 3 karakter' });
    if (password.length < 4) return res.status(400).json({ error: 'Şifre en az 4 karakter' });

    if (username.toLowerCase() === db.admin.username.toLowerCase()) {
        return res.status(400).json({ error: 'Bu isim kullanılamaz' });
    }
    if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        return res.status(400).json({ error: 'Bu kullanıcı adı alınmış' });
    }
    if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        return res.status(400).json({ error: 'Bu e-posta kayıtlı' });
    }

    const user = {
        id: uuidv4(),
        username,
        email,
        password: bcrypt.hashSync(password, 10),
        createdAt: Date.now(),
        downloads: 0,
        banned: false
    };
    db.users.push(user);
    saveDB(db);

    const token = jwt.sign({ role: 'user', userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, role: 'user', userId: user.id, username: user.username });
});

// =====================
// ADMIN: CHANNELS
// =====================
app.get('/api/channels', authMiddleware, (req, res) => {
    res.json(db.channels);
});

app.post('/api/channels', authMiddleware, adminMiddleware, (req, res) => {
    const { name, url, category, logo, epgId, status, order } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'Ad ve URL gerekli' });

    const channel = {
        id: uuidv4(),
        name, url,
        category: category || '',
        logo: logo || '',
        epgId: epgId || '',
        status: status || 'active',
        order: order || 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    db.channels.push(channel);
    saveDB(db);
    res.json(channel);
});

app.put('/api/channels/:id', authMiddleware, adminMiddleware, (req, res) => {
    const idx = db.channels.findIndex(c => c.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Kanal bulunamadı' });

    const { name, url, category, logo, epgId, status, order } = req.body;
    db.channels[idx] = {
        ...db.channels[idx],
        name: name ?? db.channels[idx].name,
        url: url ?? db.channels[idx].url,
        category: category ?? db.channels[idx].category,
        logo: logo ?? db.channels[idx].logo,
        epgId: epgId ?? db.channels[idx].epgId,
        status: status ?? db.channels[idx].status,
        order: order ?? db.channels[idx].order,
        updatedAt: Date.now()
    };
    saveDB(db);
    res.json(db.channels[idx]);
});

app.delete('/api/channels/:id', authMiddleware, adminMiddleware, (req, res) => {
    const idx = db.channels.findIndex(c => c.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Bulunamadı' });
    db.channels.splice(idx, 1);
    saveDB(db);
    res.json({ success: true });
});

app.post('/api/channels/bulk-delete', authMiddleware, adminMiddleware, (req, res) => {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ error: 'ID listesi gerekli' });
    db.channels = db.channels.filter(c => !ids.includes(c.id));
    saveDB(db);
    res.json({ success: true, deleted: ids.length });
});

app.post('/api/channels/bulk-import', authMiddleware, adminMiddleware, (req, res) => {
    const { channels, category } = req.body;
    if (!channels || !channels.length) return res.status(400).json({ error: 'Kanal listesi gerekli' });

    let added = 0;
    const existingCats = new Set(db.categories.map(c => c.name.toLowerCase()));

    channels.forEach(ch => {
        const cat = category || ch.group || '';

        // Auto-create category
        if (cat && !existingCats.has(cat.toLowerCase())) {
            db.categories.push({
                id: uuidv4(),
                name: cat,
                icon: 'fas fa-folder',
                color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
            });
            existingCats.add(cat.toLowerCase());
        }

        db.channels.push({
            id: uuidv4(),
            name: ch.name || 'Bilinmeyen',
            url: ch.url,
            category: cat,
            logo: ch.logo || '',
            epgId: ch.epgId || '',
            status: 'active',
            order: 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
        added++;
    });

    saveDB(db);
    res.json({ success: true, added });
});

app.post('/api/channels/toggle/:id', authMiddleware, adminMiddleware, (req, res) => {
    const ch = db.channels.find(c => c.id === req.params.id);
    if (!ch) return res.status(404).json({ error: 'Bulunamadı' });
    ch.status = ch.status === 'active' ? 'inactive' : 'active';
    ch.updatedAt = Date.now();
    saveDB(db);
    res.json(ch);
});

// =====================
// ADMIN: CATEGORIES
// =====================
app.get('/api/categories', authMiddleware, (req, res) => {
    const cats = db.categories.map(c => {
        const count = db.channels.filter(ch => ch.category === c.name).length;
        return { ...c, channelCount: count };
    });
    res.json(cats);
});

app.post('/api/categories', authMiddleware, adminMiddleware, (req, res) => {
    const { name, icon, color } = req.body;
    if (!name) return res.status(400).json({ error: 'İsim gerekli' });
    if (db.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        return res.status(400).json({ error: 'Bu kategori zaten var' });
    }
    const cat = { id: uuidv4(), name, icon: icon || 'fas fa-folder', color: color || '#1da1f2' };
    db.categories.push(cat);
    saveDB(db);
    res.json(cat);
});

app.put('/api/categories/:id', authMiddleware, adminMiddleware, (req, res) => {
    const idx = db.categories.findIndex(c => c.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'Bulunamadı' });
    const oldName = db.categories[idx].name;
    const { name, icon, color } = req.body;

    db.categories[idx] = {
        ...db.categories[idx],
        name: name ?? db.categories[idx].name,
        icon: icon ?? db.categories[idx].icon,
        color: color ?? db.categories[idx].color
    };

    // Rename in channels
    if (name && oldName !== name) {
        db.channels.forEach(ch => { if (ch.category === oldName) ch.category = name; });
        db.links.forEach(l => { l.categories = (l.categories || []).map(c => c === oldName ? name : c); });
    }
    saveDB(db);
    res.json(db.categories[idx]);
});

app.delete('/api/categories/:id', authMiddleware, adminMiddleware, (req, res) => {
    const cat = db.categories.find(c => c.id === req.params.id);
    if (!cat) return res.status(404).json({ error: 'Bulunamadı' });
    db.categories = db.categories.filter(c => c.id !== req.params.id);
    db.channels.forEach(ch => { if (ch.category === cat.name) ch.category = ''; });
    saveDB(db);
    res.json({ success: true });
});

// =====================
// ADMIN: USERS
// =====================
app.get('/api/users', authMiddleware, adminMiddleware, (req, res) => {
    const users = db.users.map(u => {
        const userLinks = db.links.filter(l => l.userId === u.id);
        const totalDl = userLinks.reduce((s, l) => s + (l.dlCount || 0), 0);
        return {
            id: u.id, username: u.username, email: u.email,
            createdAt: u.createdAt, banned: u.banned,
            linkCount: userLinks.length, downloads: totalDl
        };
    });
    res.json(users);
});

app.post('/api/users/:id/toggle-ban', authMiddleware, adminMiddleware, (req, res) => {
    const user = db.users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'Bulunamadı' });
    user.banned = !user.banned;
    saveDB(db);
    res.json({ success: true, banned: user.banned });
});

app.delete('/api/users/:id', authMiddleware, adminMiddleware, (req, res) => {
    db.users = db.users.filter(u => u.id !== req.params.id);
    db.links = db.links.filter(l => l.userId !== req.params.id);
    saveDB(db);
    res.json({ success: true });
});

// =====================
// ADMIN: STATS
// =====================
app.get('/api/stats', authMiddleware, adminMiddleware, (req, res) => {
    const totalDl = db.links.reduce((s, l) => s + (l.dlCount || 0), 0);
    res.json({
        channels: db.channels.length,
        categories: db.categories.length,
        users: db.users.length,
        links: db.links.length,
        downloads: totalDl,
        activeChannels: db.channels.filter(c => c.status === 'active').length
    });
});

// =====================
// ADMIN: EXPORT M3U
// =====================
app.get('/api/export', authMiddleware, adminMiddleware, (req, res) => {
    const { category, status } = req.query;
    let channels = db.channels.filter(c => {
        return (!category || c.category === category) && (!status || c.status === status);
    });
    channels.sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));

    let m3u = '#EXTM3U\n';
    channels.forEach(c => {
        let line = '#EXTINF:-1';
        if (c.epgId) line += ` tvg-id="${c.epgId}"`;
        line += ` tvg-name="${c.name}"`;
        if (c.logo) line += ` tvg-logo="${c.logo}"`;
        if (c.category) line += ` group-title="${c.category}"`;
        line += `,${c.name}`;
        m3u += line + '\n' + c.url + '\n';
    });

    res.json({ m3u, count: channels.length });
});

// =====================
// ADMIN: SETTINGS
// =====================
app.post('/api/admin/change-password', authMiddleware, adminMiddleware, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!bcrypt.compareSync(currentPassword, db.admin.password)) {
        return res.status(400).json({ error: 'Mevcut şifre hatalı' });
    }
    if (!newPassword || newPassword.length < 4) {
        return res.status(400).json({ error: 'Yeni şifre en az 4 karakter' });
    }
    db.admin.password = bcrypt.hashSync(newPassword, 10);
    saveDB(db);
    res.json({ success: true });
});

// =====================
// ADMIN: BACKUP
// =====================
app.get('/api/backup', authMiddleware, adminMiddleware, (req, res) => {
    res.json({ ...db, _backupDate: new Date().toISOString() });
});

app.post('/api/restore', authMiddleware, adminMiddleware, (req, res) => {
    const data = req.body;
    if (data.channels) db.channels = data.channels;
    if (data.categories) db.categories = data.categories;
    if (data.users) db.users = data.users;
    if (data.links) db.links = data.links;
    if (data.admin) db.admin = data.admin;
    saveDB(db);
    res.json({ success: true });
});

app.post('/api/clear-all', authMiddleware, adminMiddleware, (req, res) => {
    db.channels = [];
    db.categories = [];
    db.users = [];
    db.links = [];
    saveDB(db);
    res.json({ success: true });
});

// =====================
// USER: CATEGORIES (public for logged-in users)
// =====================
app.get('/api/user/categories', authMiddleware, (req, res) => {
    const cats = db.categories.map(c => {
        const count = db.channels.filter(ch => ch.category === c.name && ch.status === 'active').length;
        return { id: c.id, name: c.name, icon: c.icon, color: c.color, channelCount: count };
    });
    res.json(cats);
});

// =====================
// USER: GENERATE M3U LINK
// =====================
app.post('/api/user/generate', authMiddleware, (req, res) => {
    if (req.user.role !== 'user') return res.status(403).json({ error: 'Kullanıcı yetkisi gerekli' });

    const { categories } = req.body;
    if (!categories || !categories.length) return res.status(400).json({ error: 'Kategori seçin' });

    const user = db.users.find(u => u.id === req.user.userId);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    if (user.banned) return res.status(403).json({ error: 'Hesap engelli' });

    // Count channels
    const channels = db.channels.filter(c => c.status === 'active' && categories.includes(c.category));
    if (!channels.length) return res.status(400).json({ error: 'Seçili kategorilerde aktif kanal yok' });

    const token = uuidv4().replace(/-/g, '').substring(0, 16);

    const link = {
        id: uuidv4(),
        userId: user.id,
        username: user.username,
        token,
        categories,
        channelCount: channels.length,
        createdAt: Date.now(),
        dlCount: 0,
        lastAccess: null
    };
    db.links.push(link);
    user.downloads = (user.downloads || 0) + 1;
    saveDB(db);

    // Build the M3U URL
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const m3uUrl = `${protocol}://${host}/m3u/${token}`;

    res.json({
        ...link,
        m3uUrl,
        m3uUrlDirect: `${protocol}://${host}/m3u/${token}.m3u`
    });
});

// =====================
// USER: MY LINKS
// =====================
app.get('/api/user/links', authMiddleware, (req, res) => {
    if (req.user.role !== 'user') return res.status(403).json({ error: 'Yetkisiz' });

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');

    const links = db.links
        .filter(l => l.userId === req.user.userId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(l => {
            // Recalculate channel count
            const count = db.channels.filter(c => c.status === 'active' && (l.categories || []).includes(c.category)).length;
            return {
                ...l,
                channelCount: count,
                m3uUrl: `${protocol}://${host}/m3u/${l.token}`
            };
        });

    res.json(links);
});

app.delete('/api/user/links/:id', authMiddleware, (req, res) => {
    if (req.user.role !== 'user') return res.status(403).json({ error: 'Yetkisiz' });
    const link = db.links.find(l => l.id === req.params.id && l.userId === req.user.userId);
    if (!link) return res.status(404).json({ error: 'Bulunamadı' });
    db.links = db.links.filter(l => l.id !== req.params.id);
    saveDB(db);
    res.json({ success: true });
});

// =====================
// USER: STATS
// =====================
app.get('/api/user/stats', authMiddleware, (req, res) => {
    if (req.user.role !== 'user') return res.status(403).json({ error: 'Yetkisiz' });
    const myLinks = db.links.filter(l => l.userId === req.user.userId);
    const totalDl = myLinks.reduce((s, l) => s + (l.dlCount || 0), 0);
    res.json({
        categories: db.categories.length,
        channels: db.channels.filter(c => c.status === 'active').length,
        myLinks: myLinks.length,
        myDownloads: totalDl
    });
});

// =====================
// USER: PROFILE
// =====================
app.get('/api/user/profile', authMiddleware, (req, res) => {
    if (req.user.role !== 'user') return res.status(403).json({ error: 'Yetkisiz' });
    const user = db.users.find(u => u.id === req.user.userId);
    if (!user) return res.status(404).json({ error: 'Bulunamadı' });
    res.json({ id: user.id, username: user.username, email: user.email, createdAt: user.createdAt });
});

app.post('/api/user/change-password', authMiddleware, (req, res) => {
    if (req.user.role !== 'user') return res.status(403).json({ error: 'Yetkisiz' });
    const { currentPassword, newPassword } = req.body;
    const user = db.users.find(u => u.id === req.user.userId);
    if (!user) return res.status(404).json({ error: 'Bulunamadı' });
    if (!bcrypt.compareSync(currentPassword, user.password)) return res.status(400).json({ error: 'Mevcut şifre hatalı' });
    if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'Min 4 karakter' });
    user.password = bcrypt.hashSync(newPassword, 10);
    saveDB(db);
    res.json({ success: true });
});

// =====================
// M3U DOWNLOAD (direct file download)
// =====================
app.get('/download/:token', (req, res) => {
    const link = db.links.find(l => l.token === req.params.token);
    if (!link) return res.status(404).send('Link bulunamadı');

    const channels = db.channels.filter(c => c.status === 'active' && (link.categories || []).includes(c.category));
    channels.sort((a, b) => (a.order || 0) - (b.order || 0));

    let m3u = '#EXTM3U\n';
    channels.forEach(c => {
        let line = '#EXTINF:-1';
        if (c.epgId) line += ` tvg-id="${c.epgId}"`;
        line += ` tvg-name="${c.name}"`;
        if (c.logo) line += ` tvg-logo="${c.logo}"`;
        if (c.category) line += ` group-title="${c.category}"`;
        line += `,${c.name}`;
        m3u += line + '\n' + c.url + '\n';
    });

    link.dlCount = (link.dlCount || 0) + 1;
    link.lastAccess = Date.now();
    saveDB(db);

    res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="playlist-${link.token.substring(0, 8)}.m3u"`
    });
    res.send(m3u);
});

// =====================
// CATCH ALL - Serve SPA
// =====================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// =====================
// START
// =====================
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║       IPTV Panel - Backend Server        ║
╠══════════════════════════════════════════╣
║  URL:   http://localhost:${PORT}             ║
║  Admin: admin / admin123                 ║
║  M3U:   http://localhost:${PORT}/m3u/{token} ║
╚══════════════════════════════════════════╝
    `);
});
