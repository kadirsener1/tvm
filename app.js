// ===== IPTV Panel - Full Application =====

(function () {
    'use strict';

    // ===== DATA STORE =====
    const DEFAULT_USER = { username: 'admin', password: 'admin123' };

    function getUser() {
        return JSON.parse(localStorage.getItem('iptv_user')) || { ...DEFAULT_USER };
    }

    function saveUser(user) {
        localStorage.setItem('iptv_user', JSON.stringify(user));
    }

    function getChannels() {
        return JSON.parse(localStorage.getItem('iptv_channels')) || [];
    }

    function saveChannels(channels) {
        localStorage.setItem('iptv_channels', JSON.stringify(channels));
    }

    function getTheme() {
        return localStorage.getItem('iptv_theme') || 'dark';
    }

    function saveTheme(theme) {
        localStorage.setItem('iptv_theme', theme);
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // ===== TOAST =====
    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<i class="${icons[type]}"></i><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ===== DOM REFS =====
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    // ===== LOGIN =====
    const loginScreen = $('#loginScreen');
    const mainPanel = $('#mainPanel');
    const loginForm = $('#loginForm');
    const loginError = $('#loginError');

    function checkSession() {
        const session = sessionStorage.getItem('iptv_logged_in');
        if (session === 'true') {
            showPanel();
        }
    }

    function showPanel() {
        loginScreen.classList.add('hidden');
        mainPanel.classList.remove('hidden');
        const user = getUser();
        $('#currentUser').textContent = user.username;
        updateDashboard();
        updateGroupFilters();
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = getUser();
        const username = $('#username').value.trim();
        const password = $('#password').value;

        if (username === user.username && password === user.password) {
            sessionStorage.setItem('iptv_logged_in', 'true');
            loginError.textContent = '';
            showPanel();
            showToast('Giriş başarılı!', 'success');
        } else {
            loginError.textContent = 'Kullanıcı adı veya şifre hatalı!';
            loginError.style.animation = 'none';
            loginError.offsetHeight; // reflow
            loginError.style.animation = 'fadeIn 0.3s ease';
        }
    });

    $('#logoutBtn').addEventListener('click', () => {
        sessionStorage.removeItem('iptv_logged_in');
        mainPanel.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        $('#username').value = '';
        $('#password').value = '';
        showToast('Çıkış yapıldı.', 'info');
    });

    // ===== NAVIGATION =====
    const navItems = $$('.nav-item');
    const pages = $$('.page');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateTo(page);
        });
    });

    function navigateTo(page) {
        navItems.forEach(n => n.classList.remove('active'));
        pages.forEach(p => p.classList.remove('active'));

        const navItem = $(`.nav-item[data-page="${page}"]`);
        const pageEl = $(`#page-${page}`);

        if (navItem) navItem.classList.add('active');
        if (pageEl) pageEl.classList.add('active');

        // Close sidebar on mobile
        $('.sidebar').classList.remove('open');

        // Refresh data based on page
        if (page === 'dashboard') updateDashboard();
        if (page === 'channels') renderChannels();
        if (page === 'addChannel') prepareAddForm();
        if (page === 'exportM3U') updateExportGroupFilter();
    }

    // ===== MOBILE MENU =====
    $('#menuToggle').addEventListener('click', () => {
        $('.sidebar').classList.toggle('open');
    });

    // Close sidebar when clicking overlay on mobile
    document.addEventListener('click', (e) => {
        const sidebar = $('.sidebar');
        const menuToggle = $('#menuToggle');
        if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });

    // ===== THEME =====
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        saveTheme(theme);
        $$('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === theme);
        });
    }

    $$('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            applyTheme(btn.dataset.theme);
            showToast('Tema değiştirildi.', 'success');
        });
    });

    // ===== DASHBOARD =====
    function updateDashboard() {
        const channels = getChannels();
        const groups = [...new Set(channels.map(c => c.group).filter(Boolean))];
        const active = channels.filter(c => c.status === 'active');
        const inactive = channels.filter(c => c.status === 'inactive');

        $('#statTotal').textContent = channels.length;
        $('#statGroups').textContent = groups.length;
        $('#statActive').textContent = active.length;
        $('#statInactive').textContent = inactive.length;

        // Recent channels
        const recent = [...channels].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5);
        const recentHtml = recent.length ? recent.map(ch => `
            <div class="recent-item">
                ${ch.logo
                ? `<img src="${ch.logo}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="no-logo" style="display:none">${ch.name.charAt(0)}</span>`
                : `<span class="no-logo">${ch.name.charAt(0)}</span>`}
                <span class="recent-item-name">${escapeHtml(ch.name)}</span>
                <span class="recent-item-group">${escapeHtml(ch.group || 'Grupsuz')}</span>
            </div>
        `).join('') : '<p style="color:var(--text-muted);font-size:14px;">Henüz kanal eklenmemiş.</p>';
        $('#recentChannels').innerHTML = recentHtml;

        // Group distribution
        const groupCounts = {};
        channels.forEach(ch => {
            const g = ch.group || 'Grupsuz';
            groupCounts[g] = (groupCounts[g] || 0) + 1;
        });

        const maxCount = Math.max(...Object.values(groupCounts), 1);
        const groupHtml = Object.entries(groupCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => `
            <div class="group-bar">
                <div class="group-bar-header">
                    <span class="group-bar-name">${escapeHtml(name)}</span>
                    <span class="group-bar-count">${count}</span>
                </div>
                <div class="group-bar-fill">
                    <div class="group-bar-fill-inner" style="width:${(count / maxCount * 100)}%"></div>
                </div>
            </div>
        `).join('');
        $('#groupDistribution').innerHTML = groupHtml || '<p style="color:var(--text-muted);font-size:14px;">Veri yok.</p>';
    }

    // ===== CHANNEL LIST =====
    let currentPage = 1;
    const perPage = 15;
    let selectedChannels = new Set();

    function renderChannels() {
        const channels = getChannels();
        const searchTerm = ($('#searchChannel')?.value || '').toLowerCase();
        const filterGroup = $('#filterGroup')?.value || '';
        const filterStatus = $('#filterStatus')?.value || '';

        let filtered = channels.filter(ch => {
            const matchSearch = ch.name.toLowerCase().includes(searchTerm) ||
                (ch.group || '').toLowerCase().includes(searchTerm) ||
                ch.url.toLowerCase().includes(searchTerm);
            const matchGroup = !filterGroup || ch.group === filterGroup;
            const matchStatus = !filterStatus || ch.status === filterStatus;
            return matchSearch && matchGroup && matchStatus;
        });

        // Sort by order, then name
        filtered.sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));

        const totalPages = Math.ceil(filtered.length / perPage) || 1;
        if (currentPage > totalPages) currentPage = totalPages;

        const start = (currentPage - 1) * perPage;
        const pageChannels = filtered.slice(start, start + perPage);

        const listHtml = pageChannels.length ? pageChannels.map(ch => `
            <div class="channel-card ${ch.status === 'inactive' ? 'inactive' : ''}" data-id="${ch.id}">
                <input type="checkbox" class="channel-checkbox" 
                    ${selectedChannels.has(ch.id) ? 'checked' : ''} 
                    data-id="${ch.id}">
                ${ch.logo
                ? `<img src="${ch.logo}" alt="" class="channel-logo" onerror="this.outerHTML='<div class=\\'channel-logo-placeholder\\'>${ch.name.charAt(0)}</div>'">`
                : `<div class="channel-logo-placeholder">${ch.name.charAt(0)}</div>`}
                <div class="channel-info">
                    <div class="channel-name">${escapeHtml(ch.name)}</div>
                    <div class="channel-meta">
                        ${ch.group ? `<span><i class="fas fa-layer-group"></i> ${escapeHtml(ch.group)}</span>` : ''}
                        ${ch.epgId ? `<span><i class="fas fa-book"></i> ${escapeHtml(ch.epgId)}</span>` : ''}
                        ${ch.order ? `<span><i class="fas fa-sort"></i> #${ch.order}</span>` : ''}
                    </div>
                    <div class="channel-url" title="${escapeHtml(ch.url)}">${escapeHtml(ch.url)}</div>
                </div>
                <span class="channel-status ${ch.status === 'active' ? 'status-active' : 'status-inactive'}">
                    ${ch.status === 'active' ? 'Aktif' : 'Pasif'}
                </span>
                <div class="channel-actions">
                    <button class="btn btn-xs btn-primary btn-edit" data-id="${ch.id}" title="Düzenle">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-xs btn-warning btn-toggle" data-id="${ch.id}" title="${ch.status === 'active' ? 'Pasif Yap' : 'Aktif Yap'}">
                        <i class="fas fa-${ch.status === 'active' ? 'toggle-on' : 'toggle-off'}"></i>
                    </button>
                    <button class="btn btn-xs btn-danger btn-delete" data-id="${ch.id}" title="Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('') : '<p style="text-align:center;color:var(--text-muted);padding:40px;">Kanal bulunamadı.</p>';

        $('#channelsList').innerHTML = listHtml;

        // Pagination
        let pagHtml = '';
        if (totalPages > 1) {
            pagHtml += `<button ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}"><i class="fas fa-chevron-left"></i></button>`;

            for (let i = 1; i <= totalPages; i++) {
                if (totalPages <= 7 || i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
                    pagHtml += `<button class="${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
                } else if (Math.abs(i - currentPage) === 2) {
                    pagHtml += `<button disabled>...</button>`;
                }
            }

            pagHtml += `<button ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}"><i class="fas fa-chevron-right"></i></button>`;
        }
        $('#pagination').innerHTML = pagHtml;

        // Bind events
        bindChannelEvents();
    }

    function bindChannelEvents() {
        // Checkboxes
        $$('.channel-checkbox').forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked) {
                    selectedChannels.add(cb.dataset.id);
                } else {
                    selectedChannels.delete(cb.dataset.id);
                }
            });
        });

        // Edit buttons
        $$('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(btn.dataset.id));
        });

        // Toggle buttons
        $$('.btn-toggle').forEach(btn => {
            btn.addEventListener('click', () => toggleChannel(btn.dataset.id));
        });

        // Delete buttons
        $$('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => deleteChannel(btn.dataset.id));
        });

        // Pagination
        $$('#pagination button:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                currentPage = parseInt(btn.dataset.page);
                renderChannels();
            });
        });
    }

    // Search & filter
    $('#searchChannel')?.addEventListener('input', () => {
        currentPage = 1;
        renderChannels();
    });

    $('#filterGroup')?.addEventListener('change', () => {
        currentPage = 1;
        renderChannels();
    });

    $('#filterStatus')?.addEventListener('change', () => {
        currentPage = 1;
        renderChannels();
    });

    // Select all
    $('#selectAllBtn')?.addEventListener('click', () => {
        const channels = getChannels();
        const allSelected = channels.length === selectedChannels.size;
        if (allSelected) {
            selectedChannels.clear();
        } else {
            channels.forEach(ch => selectedChannels.add(ch.id));
        }
        renderChannels();
    });

    // Delete selected
    $('#deleteSelectedBtn')?.addEventListener('click', () => {
        if (selectedChannels.size === 0) {
            showToast('Lütfen silinecek kanalları seçin.', 'warning');
            return;
        }
        if (confirm(`${selectedChannels.size} kanal silinecek. Emin misiniz?`)) {
            let channels = getChannels();
            channels = channels.filter(ch => !selectedChannels.has(ch.id));
            saveChannels(channels);
            selectedChannels.clear();
            renderChannels();
            updateGroupFilters();
            showToast('Seçili kanallar silindi.', 'success');
        }
    });

    // ===== CHANNEL CRUD =====
    function toggleChannel(id) {
        const channels = getChannels();
        const ch = channels.find(c => c.id === id);
        if (ch) {
            ch.status = ch.status === 'active' ? 'inactive' : 'active';
            saveChannels(channels);
            renderChannels();
            showToast(`${ch.name} ${ch.status === 'active' ? 'aktif' : 'pasif'} yapıldı.`, 'success');
        }
    }

    function deleteChannel(id) {
        const channels = getChannels();
        const ch = channels.find(c => c.id === id);
        if (ch && confirm(`"${ch.name}" kanalını silmek istediğinize emin misiniz?`)) {
            const updated = channels.filter(c => c.id !== id);
            saveChannels(updated);
            selectedChannels.delete(id);
            renderChannels();
            updateGroupFilters();
            showToast(`"${ch.name}" silindi.`, 'success');
        }
    }

    // ===== ADD CHANNEL FORM =====
    function prepareAddForm() {
        $('#editChannelId').value = '';
        $('#channelForm').reset();
        $('#saveChannelBtn').innerHTML = '<i class="fas fa-save"></i> Kaydet';
        $('#cancelEditBtn').style.display = 'none';
        updateGroupDatalist();
    }

    function updateGroupDatalist() {
        const channels = getChannels();
        const groups = [...new Set(channels.map(c => c.group).filter(Boolean))];
        const options = groups.map(g => `<option value="${g}">`).join('');
        $('#groupList').innerHTML = options;
        $('#editGroupList').innerHTML = options;
    }

    $('#channelForm')?.addEventListener('submit', (e) => {
        e.preventDefault();

        const id = $('#editChannelId').value;
        const channelData = {
            id: id || generateId(),
            name: $('#chName').value.trim(),
            url: $('#chUrl').value.trim(),
            group: $('#chGroup').value.trim(),
            logo: $('#chLogo').value.trim(),
            epgId: $('#chEpgId').value.trim(),
            status: $('#chStatus').value,
            order: parseInt($('#chOrder').value) || 0,
            notes: $('#chNotes').value.trim(),
            createdAt: id ? undefined : Date.now(),
            updatedAt: Date.now()
        };

        const channels = getChannels();

        if (id) {
            const index = channels.findIndex(c => c.id === id);
            if (index >= 0) {
                channelData.createdAt = channels[index].createdAt;
                channels[index] = channelData;
            }
            showToast(`"${channelData.name}" güncellendi.`, 'success');
        } else {
            channelData.createdAt = Date.now();
            channels.push(channelData);
            showToast(`"${channelData.name}" eklendi.`, 'success');
        }

        saveChannels(channels);
        prepareAddForm();
        updateGroupFilters();
    });

    $('#cancelEditBtn')?.addEventListener('click', () => {
        prepareAddForm();
    });

    // ===== EDIT MODAL =====
    function openEditModal(id) {
        const channels = getChannels();
        const ch = channels.find(c => c.id === id);
        if (!ch) return;

        updateGroupDatalist();

        $('#editId').value = ch.id;
        $('#editName').value = ch.name;
        $('#editUrl').value = ch.url;
        $('#editGroup').value = ch.group || '';
        $('#editLogo').value = ch.logo || '';
        $('#editEpgId').value = ch.epgId || '';
        $('#editStatus').value = ch.status || 'active';
        $('#editOrder').value = ch.order || 0;
        $('#editNotes').value = ch.notes || '';

        $('#editModal').classList.remove('hidden');
    }

    function closeEditModal() {
        $('#editModal').classList.add('hidden');
    }

    $('#modalClose')?.addEventListener('click', closeEditModal);
    $('#modalCancelBtn')?.addEventListener('click', closeEditModal);
    $('.modal-overlay')?.addEventListener('click', closeEditModal);

    $('#editForm')?.addEventListener('submit', (e) => {
        e.preventDefault();

        const id = $('#editId').value;
        const channels = getChannels();
        const index = channels.findIndex(c => c.id === id);

        if (index >= 0) {
            channels[index] = {
                ...channels[index],
                name: $('#editName').value.trim(),
                url: $('#editUrl').value.trim(),
                group: $('#editGroup').value.trim(),
                logo: $('#editLogo').value.trim(),
                epgId: $('#editEpgId').value.trim(),
                status: $('#editStatus').value,
                order: parseInt($('#editOrder').value) || 0,
                notes: $('#editNotes').value.trim(),
                updatedAt: Date.now()
            };

            saveChannels(channels);
            closeEditModal();
            renderChannels();
            updateGroupFilters();
            showToast(`"${channels[index].name}" güncellendi.`, 'success');
        }
    });

    // ===== GROUP FILTERS =====
    function updateGroupFilters() {
        const channels = getChannels();
        const groups = [...new Set(channels.map(c => c.group).filter(Boolean))].sort();

        const options = '<option value="">Tüm Gruplar</option>' +
            groups.map(g => `<option value="${g}">${g}</option>`).join('');

        if ($('#filterGroup')) $('#filterGroup').innerHTML = options;
        if ($('#exportGroup')) $('#exportGroup').innerHTML = options;

        updateGroupDatalist();
    }

    // ===== M3U PARSER =====
    function parseM3U(content) {
        const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
        const channels = [];
        let current = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith('#EXTINF')) {
                current = {};

                // Parse attributes
                const tvgId = extractAttr(line, 'tvg-id');
                const tvgName = extractAttr(line, 'tvg-name');
                const tvgLogo = extractAttr(line, 'tvg-logo');
                const groupTitle = extractAttr(line, 'group-title');

                // Parse name (after the last comma)
                const commaIdx = line.lastIndexOf(',');
                const name = commaIdx >= 0 ? line.substring(commaIdx + 1).trim() : '';

                current.name = tvgName || name || 'Bilinmeyen Kanal';
                current.epgId = tvgId || '';
                current.logo = tvgLogo || '';
                current.group = groupTitle || '';

            } else if (line.startsWith('#')) {
                // skip other comments
                continue;
            } else if (current) {
                // This is the URL line
                current.url = line;
                channels.push({ ...current });
                current = null;
            }
        }

        return channels;
    }

    function extractAttr(line, attr) {
        // Match both single and double quotes
        const regex = new RegExp(`${attr}="([^"]*)"`, 'i');
        const match = line.match(regex);
        if (match) return match[1];
        
        const regex2 = new RegExp(`${attr}='([^']*)'`, 'i');
        const match2 = line.match(regex2);
        return match2 ? match2[1] : '';
    }

    // ===== IMPORT M3U =====
    // Tabs
    $$('.import-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('.import-tab').forEach(t => t.classList.remove('active'));
            $$('.import-tab-content').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            $(`#importTab-${tab.dataset.tab}`).classList.add('active');
        });
    });

    // File upload
    const dropZone = $('#dropZone');
    const m3uFile = $('#m3uFile');

    dropZone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone?.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone?.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) handleM3UFile(file);
    });

    m3uFile?.addEventListener('change', (e) => {
        if (e.target.files[0]) handleM3UFile(e.target.files[0]);
    });

    function handleM3UFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const parsed = parseM3U(content);
            showImportPreview(parsed);
        };
        reader.readAsText(file);
    }

    // Text paste
    $('#parseTextBtn')?.addEventListener('click', () => {
        const text = $('#m3uText').value.trim();
        if (!text) {
            showToast('Lütfen M3U içeriği yapıştırın.', 'warning');
            return;
        }
        const parsed = parseM3U(text);
        showImportPreview(parsed);
    });

    // URL fetch
    $('#fetchUrlBtn')?.addEventListener('click', async () => {
        const url = $('#m3uUrl').value.trim();
        if (!url) {
            showToast('Lütfen bir URL girin.', 'warning');
            return;
        }

        try {
            showToast('İndiriliyor...', 'info');
            const response = await fetch(url);
            const text = await response.text();
            const parsed = parseM3U(text);
            showImportPreview(parsed);
        } catch (err) {
            showToast('URL\'den indirilemedi. CORS hatası olabilir.', 'error');
        }
    });

    let parsedChannels = [];

    function showImportPreview(channels) {
        parsedChannels = channels;
        const preview = $('#importPreview');

        if (channels.length === 0) {
            showToast('Hiç kanal bulunamadı. M3U formatını kontrol edin.', 'warning');
            preview.classList.add('hidden');
            return;
        }

        preview.classList.remove('hidden');
        $('#previewCount').textContent = channels.length;

        const html = channels.map((ch, i) => `
            <div class="preview-item">
                <input type="checkbox" checked data-index="${i}" class="preview-checkbox">
                <span class="preview-item-name">${escapeHtml(ch.name)}</span>
                ${ch.group ? `<span class="preview-item-group">${escapeHtml(ch.group)}</span>` : ''}
            </div>
        `).join('');

        $('#previewList').innerHTML = html;
        showToast(`${channels.length} kanal bulundu.`, 'success');
    }

    $('#importSelectAll')?.addEventListener('click', () => {
        $$('.preview-checkbox').forEach(cb => cb.checked = true);
    });

    $('#importDeselectAll')?.addEventListener('click', () => {
        $$('.preview-checkbox').forEach(cb => cb.checked = false);
    });

    $('#importSelectedBtn')?.addEventListener('click', () => {
        const selected = [];
        $$('.preview-checkbox').forEach(cb => {
            if (cb.checked) {
                selected.push(parseInt(cb.dataset.index));
            }
        });

        if (selected.length === 0) {
            showToast('Lütfen en az bir kanal seçin.', 'warning');
            return;
        }

        const channels = getChannels();
        let addedCount = 0;

        selected.forEach(idx => {
            const ch = parsedChannels[idx];
            if (ch) {
                channels.push({
                    id: generateId(),
                    name: ch.name,
                    url: ch.url,
                    group: ch.group || '',
                    logo: ch.logo || '',
                    epgId: ch.epgId || '',
                    status: 'active',
                    order: 0,
                    notes: '',
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                });
                addedCount++;
            }
        });

        saveChannels(channels);
        updateGroupFilters();
        $('#importPreview').classList.add('hidden');
        parsedChannels = [];

        showToast(`${addedCount} kanal başarıyla eklendi!`, 'success');
    });

    // ===== EXPORT M3U =====
    function updateExportGroupFilter() {
        updateGroupFilters();
    }

    $('#generateM3U')?.addEventListener('click', () => {
        const channels = getChannels();
        const filterGroup = $('#exportGroup').value;
        const filterStatus = $('#exportStatus').value;

        let filtered = channels.filter(ch => {
            const matchGroup = !filterGroup || ch.group === filterGroup;
            const matchStatus = !filterStatus || ch.status === filterStatus;
            return matchGroup && matchStatus;
        });

        filtered.sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));

        let m3u = '#EXTM3U\n';

        filtered.forEach(ch => {
            let extinf = '#EXTINF:-1';
            if (ch.epgId) extinf += ` tvg-id="${ch.epgId}"`;
            extinf += ` tvg-name="${ch.name}"`;
            if (ch.logo) extinf += ` tvg-logo="${ch.logo}"`;
            if (ch.group) extinf += ` group-title="${ch.group}"`;
            extinf += `,${ch.name}`;

            m3u += extinf + '\n';
            m3u += ch.url + '\n';
        });

        $('#m3uOutput').value = m3u;
        $('#downloadM3U').style.display = 'inline-flex';
        $('#copyM3U').style.display = 'inline-flex';

        showToast(`${filtered.length} kanal ile M3U oluşturuldu.`, 'success');
    });

    $('#downloadM3U')?.addEventListener('click', () => {
        const content = $('#m3uOutput').value;
        if (!content) return;

        const blob = new Blob([content], { type: 'application/x-mpegURL' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'playlist.m3u';
        a.click();
        URL.revokeObjectURL(url);

        showToast('M3U dosyası indirildi.', 'success');
    });

    $('#copyM3U')?.addEventListener('click', () => {
        const content = $('#m3uOutput').value;
        if (!content) return;

        navigator.clipboard.writeText(content).then(() => {
            showToast('M3U içeriği panoya kopyalandı.', 'success');
        }).catch(() => {
            // Fallback
            $('#m3uOutput').select();
            document.execCommand('copy');
            showToast('M3U içeriği panoya kopyalandı.', 'success');
        });
    });

    // ===== SETTINGS =====
    // Change password
    $('#changePasswordForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = getUser();
        const current = $('#currentPassword').value;
        const newPass = $('#newPassword').value;
        const confirm = $('#confirmPassword').value;

        if (current !== user.password) {
            showToast('Mevcut şifre hatalı!', 'error');
            return;
        }

        if (newPass !== confirm) {
            showToast('Yeni şifreler eşleşmiyor!', 'error');
            return;
        }

        if (newPass.length < 4) {
            showToast('Şifre en az 4 karakter olmalı!', 'error');
            return;
        }

        user.password = newPass;
        saveUser(user);
        $('#changePasswordForm').reset();
        showToast('Şifre başarıyla güncellendi.', 'success');
    });

    // Change username
    $('#changeUsernameForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = getUser();
        const newUsername = $('#newUsername').value.trim();
        const verifyPass = $('#verifyPassword').value;

        if (verifyPass !== user.password) {
            showToast('Şifre hatalı!', 'error');
            return;
        }

        if (newUsername.length < 3) {
            showToast('Kullanıcı adı en az 3 karakter olmalı!', 'error');
            return;
        }

        user.username = newUsername;
        saveUser(user);
        $('#currentUser').textContent = newUsername;
        $('#changeUsernameForm').reset();
        showToast('Kullanıcı adı güncellendi.', 'success');
    });

    // Delete all channels
    $('#deleteAllChannels')?.addEventListener('click', () => {
        if (confirm('TÜM KANALLARI silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) {
            if (confirm('Bu işlem geri alınamaz! Devam etmek istiyor musunuz?')) {
                saveChannels([]);
                selectedChannels.clear();
                updateGroupFilters();
                updateDashboard();
                showToast('Tüm kanallar silindi.', 'success');
            }
        }
    });

    // Reset app
    $('#resetApp')?.addEventListener('click', () => {
        if (confirm('Uygulama tamamen sıfırlanacak. Tüm veriler silinecek. Emin misiniz?')) {
            localStorage.removeItem('iptv_channels');
            localStorage.removeItem('iptv_user');
            localStorage.removeItem('iptv_theme');
            sessionStorage.removeItem('iptv_logged_in');
            location.reload();
        }
    });

    // Export backup
    $('#exportBackup')?.addEventListener('click', () => {
        const data = {
            channels: getChannels(),
            user: getUser(),
            theme: getTheme(),
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `iptv-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);

        showToast('Yedek dosyası indirildi.', 'success');
    });

    // Import backup
    $('#importBackup')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);

                if (confirm(`Yedek dosyasında ${data.channels?.length || 0} kanal bulundu. Mevcut veriler üzerine yazılacak. Devam?`)) {
                    if (data.channels) saveChannels(data.channels);
                    if (data.user) saveUser(data.user);
                    if (data.theme) applyTheme(data.theme);

                    updateGroupFilters();
                    updateDashboard();
                    showToast('Yedek başarıyla yüklendi!', 'success');
                }
            } catch (err) {
                showToast('Geçersiz yedek dosyası!', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    // ===== HELPERS =====
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ===== INIT =====
    function init() {
        applyTheme(getTheme());
        checkSession();
    }

    init();

})();
