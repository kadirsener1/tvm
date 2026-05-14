(function(){
'use strict';

/* ===========================
   DATA LAYER
   =========================== */
const DB={
    channels:()=>JSON.parse(localStorage.getItem('iptv_ch')||'[]'),
    saveChannels:d=>localStorage.setItem('iptv_ch',JSON.stringify(d)),
    categories:()=>JSON.parse(localStorage.getItem('iptv_cats')||'[]'),
    saveCats:d=>localStorage.setItem('iptv_cats',JSON.stringify(d)),
    theme:()=>localStorage.getItem('iptv_theme')||'dark',
    saveTheme:t=>localStorage.setItem('iptv_theme',t)
};

function uid(){return Date.now().toString(36)+Math.random().toString(36).substr(2,8)}
function esc(t){if(!t)return'';const d=document.createElement('div');d.textContent=t;return d.innerHTML}

/* ===========================
   TOAST
   =========================== */
function toast(msg,type='i'){
    const c=document.getElementById('toasts');
    const icons={s:'fa-check-circle',e:'fa-exclamation-circle',w:'fa-exclamation-triangle',i:'fa-info-circle'};
    const el=document.createElement('div');
    el.className=`toast ${type}`;
    el.innerHTML=`<i class="fas ${icons[type]}"></i><span>${msg}</span>`;
    c.appendChild(el);
    setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),250)},3000);
}

/* ===========================
   SELECTORS
   =========================== */
const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);

/* ===========================
   NAVIGATION
   =========================== */
const pageTitles={
    dashboard:'Dashboard',channels:'Kanallar',addChannel:'Kanal Ekle',
    categories:'Kategoriler',importM3U:'M3U İçe Aktar',exportM3U:'M3U İndir',settings:'Ayarlar'
};

function navigateTo(page){
    $$('.nav-item').forEach(n=>n.classList.remove('active'));
    $$('.page').forEach(p=>p.classList.remove('active'));
    const nav=$(`.nav-item[data-page="${page}"]`);
    const pg=$(`#page-${page}`);
    if(nav)nav.classList.add('active');
    if(pg)pg.classList.add('active');
    $('#topbarTitle').textContent=pageTitles[page]||'';
    $('#sidebar').classList.remove('open');
    if(page==='dashboard')refreshDashboard();
    if(page==='channels'){refreshCatFilters();renderChannels()}
    if(page==='addChannel')prepareAddForm();
    if(page==='categories')renderCategories();
    if(page==='importM3U')refreshImportCatSelect();
    if(page==='exportM3U')refreshExportFilters();
}

$$('.nav-item').forEach(n=>n.addEventListener('click',e=>{e.preventDefault();navigateTo(n.dataset.page)}));
$$('.qa-btn').forEach(b=>b.addEventListener('click',()=>navigateTo(b.dataset.go)));

// mobile menu
$('#menuToggle').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
$('#sidebarClose').addEventListener('click',()=>$('#sidebar').classList.remove('open'));
document.addEventListener('click',e=>{
    if(window.innerWidth<=768&&$('#sidebar').classList.contains('open')&&!$('#sidebar').contains(e.target)&&!$('#menuToggle').contains(e.target))
        $('#sidebar').classList.remove('open');
});

/* ===========================
   THEME
   =========================== */
function applyTheme(t){
    document.documentElement.setAttribute('data-theme',t);
    DB.saveTheme(t);
    $$('.theme-btn').forEach(b=>b.classList.toggle('active',b.dataset.theme===t));
}
$$('.theme-btn').forEach(b=>b.addEventListener('click',()=>{applyTheme(b.dataset.theme);toast('Tema değiştirildi','s')}));

/* ===========================
   DASHBOARD
   =========================== */
function refreshDashboard(){
    const ch=DB.channels(),cats=DB.categories();
    const groups=[...new Set(ch.map(c=>c.category).filter(Boolean))];
    const active=ch.filter(c=>c.status==='active');

    $('#statTotal').textContent=ch.length;
    $('#statCats').textContent=cats.length;
    $('#statActive').textContent=active.length;
    $('#statInactive').textContent=ch.length-active.length;
    $('#totalBadgeCount').textContent=ch.length;

    // Recent
    const recent=[...ch].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,6);
    $('#recentList').innerHTML=recent.length?recent.map(c=>`
        <div class="recent-row">
            <div class="r-logo">${c.logo?`<img src="${esc(c.logo)}" onerror="this.parentElement.textContent='${esc(c.name).charAt(0)}'">`:esc(c.name).charAt(0)}</div>
            <span class="r-name">${esc(c.name)}</span>
            <span class="r-cat">${esc(c.category||'—')}</span>
        </div>
    `).join(''):'<p style="color:var(--t3);font-size:13px">Henüz kanal eklenmemiş.</p>';

    // Chart
    const gc={};ch.forEach(c=>{const g=c.category||'Kategorisiz';gc[g]=(gc[g]||0)+1});
    const mx=Math.max(...Object.values(gc),1);
    const catColors={};cats.forEach(c=>catColors[c.name]=c.color);
    $('#catChart').innerHTML=Object.entries(gc).sort((a,b)=>b[1]-a[1]).map(([n,v])=>`
        <div class="bar-row">
            <div class="bar-label"><span>${esc(n)}</span><span>${v}</span></div>
            <div class="bar-track"><div class="bar-fill" style="width:${v/mx*100}%;background:${catColors[n]||'var(--accent)'}"></div></div>
        </div>
    `).join('')||'<p style="color:var(--t3);font-size:13px">Veri yok.</p>';
}

/* ===========================
   CATEGORIES
   =========================== */
function renderCategories(){
    const cats=DB.categories();
    const ch=DB.channels();
    $('#catList').innerHTML=cats.length?cats.map(c=>{
        const count=ch.filter(x=>x.category===c.name).length;
        return`
        <div class="cat-card">
            <div class="cat-icon" style="background:${c.color||'var(--accent)'}">
                <i class="${c.icon||'fas fa-folder'}"></i>
            </div>
            <div class="cat-info">
                <h4>${esc(c.name)}</h4>
                <p>${count} kanal</p>
            </div>
            <div class="cat-actions">
                <button class="btn btn-xs btn-outline cat-edit" data-id="${c.id}" title="Düzenle"><i class="fas fa-edit"></i></button>
                <button class="btn btn-xs btn-danger cat-del" data-id="${c.id}" title="Sil"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    }).join(''):'<p style="color:var(--t3);padding:20px">Henüz kategori eklenmemiş. Yukarıdan ekleyebilirsiniz.</p>';

    // bind
    $$('.cat-edit').forEach(b=>b.addEventListener('click',()=>editCategory(b.dataset.id)));
    $$('.cat-del').forEach(b=>b.addEventListener('click',()=>deleteCategory(b.dataset.id)));
}

$('#catForm').addEventListener('submit',e=>{
    e.preventDefault();
    const editId=$('#catEditId').value;
    const name=$('#catName').value.trim();
    const icon=$('#catIcon').value.trim()||'fas fa-folder';
    const color=$('#catColor').value;
    if(!name)return toast('Kategori adı gerekli','w');

    const cats=DB.categories();

    if(editId){
        const oldCat=cats.find(c=>c.id===editId);
        const oldName=oldCat?oldCat.name:'';
        const idx=cats.findIndex(c=>c.id===editId);
        if(idx>=0){
            cats[idx]={...cats[idx],name,icon,color};
            // Update channels with old category name
            if(oldName&&oldName!==name){
                const chs=DB.channels();
                chs.forEach(ch=>{if(ch.category===oldName)ch.category=name});
                DB.saveChannels(chs);
            }
        }
        toast('Kategori güncellendi','s');
    }else{
        if(cats.some(c=>c.name.toLowerCase()===name.toLowerCase()))return toast('Bu kategori zaten var','w');
        cats.push({id:uid(),name,icon,color});
        toast(`"${name}" kategorisi eklendi`,'s');
    }

    DB.saveCats(cats);
    $('#catForm').reset();$('#catEditId').value='';
    $('#catSaveBtn').innerHTML='<i class="fas fa-plus"></i> Ekle';
    $('#catCancelBtn').style.display='none';
    $('#catColor').value='#1da1f2';
    renderCategories();
});

$('#catCancelBtn').addEventListener('click',()=>{
    $('#catForm').reset();$('#catEditId').value='';
    $('#catSaveBtn').innerHTML='<i class="fas fa-plus"></i> Ekle';
    $('#catCancelBtn').style.display='none';
    $('#catColor').value='#1da1f2';
});

function editCategory(id){
    const cats=DB.categories();
    const c=cats.find(x=>x.id===id);
    if(!c)return;
    $('#catEditId').value=c.id;
    $('#catName').value=c.name;
    $('#catIcon').value=c.icon||'';
    $('#catColor').value=c.color||'#1da1f2';
    $('#catSaveBtn').innerHTML='<i class="fas fa-save"></i> Güncelle';
    $('#catCancelBtn').style.display='inline-flex';
    $('#catName').focus();
}

function deleteCategory(id){
    const cats=DB.categories();
    const c=cats.find(x=>x.id===id);
    if(!c)return;
    if(!confirm(`"${c.name}" kategorisini silmek istediğinize emin misiniz?`))return;
    const updated=cats.filter(x=>x.id!==id);
    DB.saveCats(updated);
    // Clear category from channels
    const chs=DB.channels();
    chs.forEach(ch=>{if(ch.category===c.name)ch.category=''});
    DB.saveChannels(chs);
    renderCategories();
    toast('Kategori silindi','s');
}

// Icon hints click
$$('.icon-hint').forEach(h=>h.addEventListener('click',()=>{
    $('#catIcon').value=h.dataset.icon;
    $('#catIcon').focus();
}));

/* ===========================
   CHANNEL CRUD
   =========================== */
function getCatOptions(selected=''){
    const cats=DB.categories();
    return '<option value="">Kategori Seçin</option>'+cats.map(c=>`<option value="${esc(c.name)}" ${c.name===selected?'selected':''}>${esc(c.name)}</option>`).join('');
}

function refreshCatFilters(){
    const cats=DB.categories();
    const opts='<option value="">Tüm Kategoriler</option>'+cats.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
    $('#filterCat').innerHTML=opts;
}

function prepareAddForm(){
    $('#chEditId').value='';
    $('#channelForm').reset();
    $('#chCategory').innerHTML=getCatOptions();
    $('#chSaveBtn').innerHTML='<i class="fas fa-save"></i> Kaydet';
    $('#chCancelBtn').style.display='none';
}

$('#channelForm').addEventListener('submit',e=>{
    e.preventDefault();
    const editId=$('#chEditId').value;
    const data={
        id:editId||uid(),
        name:$('#chName').value.trim(),
        url:$('#chUrl').value.trim(),
        category:$('#chCategory').value,
        logo:$('#chLogo').value.trim(),
        epgId:$('#chEpg').value.trim(),
        status:$('#chStatus').value,
        order:parseInt($('#chOrder').value)||0,
        updatedAt:Date.now()
    };
    if(!data.name||!data.url)return toast('Ad ve URL zorunlu','w');

    const channels=DB.channels();
    if(editId){
        const idx=channels.findIndex(c=>c.id===editId);
        if(idx>=0){data.createdAt=channels[idx].createdAt;channels[idx]=data}
        toast(`"${data.name}" güncellendi`,'s');
    }else{
        data.createdAt=Date.now();
        channels.push(data);
        toast(`"${data.name}" eklendi`,'s');
    }
    DB.saveChannels(channels);
    prepareAddForm();
    $('#totalBadgeCount').textContent=channels.length;
});

$('#chCancelBtn').addEventListener('click',()=>prepareAddForm());

// Channels list
let curPage=1;const perPage=20;
let selected=new Set();

function renderChannels(){
    const all=DB.channels();
    const search=($('#searchInput')?.value||'').toLowerCase();
    const fCat=$('#filterCat')?.value||'';
    const fStatus=$('#filterStatus')?.value||'';

    let filtered=all.filter(c=>{
        const ms=c.name.toLowerCase().includes(search)||(c.category||'').toLowerCase().includes(search)||c.url.toLowerCase().includes(search);
        const mc=!fCat||c.category===fCat;
        const mst=!fStatus||c.status===fStatus;
        return ms&&mc&&mst;
    });
    filtered.sort((a,b)=>(a.order||0)-(b.order||0)||a.name.localeCompare(b.name));

    const totalP=Math.ceil(filtered.length/perPage)||1;
    if(curPage>totalP)curPage=totalP;
    const start=(curPage-1)*perPage;
    const page=filtered.slice(start,start+perPage);

    const cats=DB.categories();
    const catColors={};cats.forEach(c=>catColors[c.name]=c.color);

    $('#channelList').innerHTML=page.length?page.map(c=>`
        <div class="ch-card ${c.status==='inactive'?'off':''}" data-id="${c.id}">
            <input type="checkbox" class="ch-cb" data-id="${c.id}" ${selected.has(c.id)?'checked':''}>
            ${c.logo?`<img src="${esc(c.logo)}" class="ch-logo" onerror="this.outerHTML='<div class=\\'ch-logo-ph\\'>${esc(c.name).charAt(0)}</div>'">`:`<div class="ch-logo-ph">${esc(c.name).charAt(0)}</div>`}
            <div class="ch-info">
                <div class="ch-name">${esc(c.name)}</div>
                <div class="ch-meta">
                    ${c.category?`<span><i class="fas fa-folder" style="color:${catColors[c.category]||'var(--accent)'}"></i> ${esc(c.category)}</span>`:''}
                    ${c.epgId?`<span><i class="fas fa-book"></i> ${esc(c.epgId)}</span>`:''}
                </div>
                <div class="ch-url" title="${esc(c.url)}">${esc(c.url)}</div>
            </div>
            <span class="ch-badge ${c.status==='active'?'badge-on':'badge-off'}">${c.status==='active'?'Aktif':'Pasif'}</span>
            <div class="ch-actions">
                <button class="btn btn-xs btn-outline ch-edit" data-id="${c.id}" title="Düzenle"><i class="fas fa-edit"></i></button>
                <button class="btn btn-xs btn-warn ch-toggle" data-id="${c.id}" title="Durum"><i class="fas fa-${c.status==='active'?'toggle-on':'toggle-off'}"></i></button>
                <button class="btn btn-xs btn-danger ch-del" data-id="${c.id}" title="Sil"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join(''):'<p style="text-align:center;color:var(--t3);padding:40px">Kanal bulunamadı.</p>';

    // Pagination
    let ph='';
    if(totalP>1){
        ph+=`<button ${curPage===1?'disabled':''} data-p="${curPage-1}"><i class="fas fa-chevron-left"></i></button>`;
        for(let i=1;i<=totalP;i++){
            if(totalP<=7||i===1||i===totalP||Math.abs(i-curPage)<=1){
                ph+=`<button class="${i===curPage?'active':''}" data-p="${i}">${i}</button>`;
            }else if(Math.abs(i-curPage)===2){
                ph+=`<button disabled>…</button>`;
            }
        }
        ph+=`<button ${curPage===totalP?'disabled':''} data-p="${curPage+1}"><i class="fas fa-chevron-right"></i></button>`;
    }
    $('#paginationBar').innerHTML=ph;

    bindChannelEvents();
}

function bindChannelEvents(){
    $$('.ch-cb').forEach(cb=>cb.addEventListener('change',()=>{cb.checked?selected.add(cb.dataset.id):selected.delete(cb.dataset.id)}));
    $$('.ch-edit').forEach(b=>b.addEventListener('click',()=>openEditModal(b.dataset.id)));
    $$('.ch-toggle').forEach(b=>b.addEventListener('click',()=>toggleCh(b.dataset.id)));
    $$('.ch-del').forEach(b=>b.addEventListener('click',()=>deleteCh(b.dataset.id)));
    $$('#paginationBar button:not([disabled])').forEach(b=>b.addEventListener('click',()=>{curPage=parseInt(b.dataset.p);renderChannels()}));
}

$('#searchInput')?.addEventListener('input',()=>{curPage=1;renderChannels()});
$('#filterCat')?.addEventListener('change',()=>{curPage=1;renderChannels()});
$('#filterStatus')?.addEventListener('change',()=>{curPage=1;renderChannels()});

$('#selectAllBtn').addEventListener('click',()=>{
    const ch=DB.channels();
    if(ch.length===selected.size){selected.clear()}else{ch.forEach(c=>selected.add(c.id))}
    renderChannels();
});

$('#deleteSelBtn').addEventListener('click',()=>{
    if(!selected.size)return toast('Kanal seçin','w');
    if(!confirm(`${selected.size} kanal silinecek. Emin misiniz?`))return;
    let ch=DB.channels().filter(c=>!selected.has(c.id));
    DB.saveChannels(ch);selected.clear();renderChannels();
    $('#totalBadgeCount').textContent=ch.length;
    toast('Seçili kanallar silindi','s');
});

function toggleCh(id){
    const ch=DB.channels();const c=ch.find(x=>x.id===id);
    if(c){c.status=c.status==='active'?'inactive':'active';DB.saveChannels(ch);renderChannels();toast(`${c.name} ${c.status==='active'?'aktif':'pasif'}`,'s')}
}

function deleteCh(id){
    const ch=DB.channels();const c=ch.find(x=>x.id===id);
    if(c&&confirm(`"${c.name}" silinsin mi?`)){
        DB.saveChannels(ch.filter(x=>x.id!==id));selected.delete(id);renderChannels();
        $('#totalBadgeCount').textContent=DB.channels().length;
        toast(`"${c.name}" silindi`,'s');
    }
}

/* ===========================
   EDIT MODAL
   =========================== */
function openEditModal(id){
    const ch=DB.channels();const c=ch.find(x=>x.id===id);if(!c)return;
    $('#edId').value=c.id;
    $('#edName').value=c.name;
    $('#edUrl').value=c.url;
    $('#edCategory').innerHTML=getCatOptions(c.category);
    $('#edLogo').value=c.logo||'';
    $('#edEpg').value=c.epgId||'';
    $('#edStatus').value=c.status||'active';
    $('#edOrder').value=c.order||0;
    $('#editModal').classList.remove('hidden');
}

function closeModal(){$('#editModal').classList.add('hidden')}
$('#modalX').addEventListener('click',closeModal);
$('#modalCancel').addEventListener('click',closeModal);
$('.modal-bg').addEventListener('click',closeModal);

$('#editForm').addEventListener('submit',e=>{
    e.preventDefault();
    const id=$('#edId').value;const ch=DB.channels();const idx=ch.findIndex(c=>c.id===id);
    if(idx>=0){
        ch[idx]={...ch[idx],
            name:$('#edName').value.trim(),
            url:$('#edUrl').value.trim(),
            category:$('#edCategory').value,
            logo:$('#edLogo').value.trim(),
            epgId:$('#edEpg').value.trim(),
            status:$('#edStatus').value,
            order:parseInt($('#edOrder').value)||0,
            updatedAt:Date.now()
        };
        DB.saveChannels(ch);closeModal();renderChannels();
        toast(`"${ch[idx].name}" güncellendi`,'s');
    }
});

/* ===========================
   M3U PARSER
   =========================== */
function parseM3U(text){
    const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
    const result=[];let cur=null;
    for(let i=0;i<lines.length;i++){
        const l=lines[i];
        if(l.startsWith('#EXTINF')){
            cur={};
            cur.epgId=getAttr(l,'tvg-id');
            const tvgName=getAttr(l,'tvg-name');
            cur.logo=getAttr(l,'tvg-logo');
            cur.group=getAttr(l,'group-title');
            const ci=l.lastIndexOf(',');
            cur.name=tvgName||(ci>=0?l.substring(ci+1).trim():'')||'Bilinmeyen';
        }else if(l.startsWith('#')){continue}
        else if(cur){cur.url=l;result.push({...cur});cur=null}
    }
    return result;
}

function getAttr(line,attr){
    const m=line.match(new RegExp(`${attr}="([^"]*)"`, 'i'));
    return m?m[1]:'';
}

/* ===========================
   IMPORT
   =========================== */
$$('.imp-tab').forEach(t=>t.addEventListener('click',()=>{
    $$('.imp-tab').forEach(x=>x.classList.remove('active'));
    $$('.imp-content').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');$(`#impTab-${t.dataset.tab}`).classList.add('active');
}));

function refreshImportCatSelect(){
    const cats=DB.categories();
    $('#importCategory').innerHTML='<option value="">Orijinal grup bilgisini kullan</option>'+cats.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
}

// File
const dz=$('#dropZone');const mf=$('#m3uFile');
dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('over')});
dz.addEventListener('dragleave',()=>dz.classList.remove('over'));
dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('over');if(e.dataTransfer.files[0])readFile(e.dataTransfer.files[0])});
mf.addEventListener('change',e=>{if(e.target.files[0])readFile(e.target.files[0])});

function readFile(f){
    const r=new FileReader();
    r.onload=e=>{showPreview(parseM3U(e.target.result))};
    r.readAsText(f);
}

// Text
$('#parseTextBtn').addEventListener('click',()=>{
    const t=$('#m3uText').value.trim();
    if(!t)return toast('İçerik yapıştırın','w');
    showPreview(parseM3U(t));
});

// URL
$('#fetchUrlBtn').addEventListener('click',async()=>{
    const url=$('#m3uUrl').value.trim();
    if(!url)return toast('URL girin','w');
    try{toast('İndiriliyor...','i');const r=await fetch(url);const t=await r.text();showPreview(parseM3U(t))}
    catch(e){toast('İndirilemedi (CORS hatası olabilir)','e')}
});

let parsedList=[];

function showPreview(list){
    parsedList=list;
    if(!list.length){toast('Kanal bulunamadı','w');$('#importPreview').classList.add('hidden');return}
    $('#importPreview').classList.remove('hidden');
    $('#previewCount').textContent=list.length;
    $('#previewList').innerHTML=list.map((c,i)=>`
        <div class="pv-item">
            <input type="checkbox" checked data-i="${i}" class="pv-cb">
            <span class="pv-name">${esc(c.name)}</span>
            ${c.group?`<span class="pv-group">${esc(c.group)}</span>`:''}
        </div>
    `).join('');
    toast(`${list.length} kanal bulundu`,'s');
}

$('#impSelectAll').addEventListener('click',()=>$$('.pv-cb').forEach(c=>c.checked=true));
$('#impDeselectAll').addEventListener('click',()=>$$('.pv-cb').forEach(c=>c.checked=false));

$('#impImportBtn').addEventListener('click',()=>{
    const idxs=[];$$('.pv-cb').forEach(cb=>{if(cb.checked)idxs.push(parseInt(cb.dataset.i))});
    if(!idxs.length)return toast('En az bir kanal seçin','w');

    const overrideCat=$('#importCategory').value;
    const channels=DB.channels();
    const cats=DB.categories();
    let added=0;
    const newCats=new Set(cats.map(c=>c.name.toLowerCase()));

    idxs.forEach(i=>{
        const c=parsedList[i];if(!c)return;
        const category=overrideCat||c.group||'';
        
        // Auto-create category if doesn't exist
        if(category&&!newCats.has(category.toLowerCase())){
            cats.push({id:uid(),name:category,icon:'fas fa-folder',color:'#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0')});
            newCats.add(category.toLowerCase());
        }

        channels.push({
            id:uid(),name:c.name,url:c.url,category,
            logo:c.logo||'',epgId:c.epgId||'',
            status:'active',order:0,
            createdAt:Date.now(),updatedAt:Date.now()
        });
        added++;
    });

    DB.saveChannels(channels);DB.saveCats(cats);
    $('#importPreview').classList.add('hidden');parsedList=[];
    $('#totalBadgeCount').textContent=channels.length;
    toast(`${added} kanal içe aktarıldı!`,'s');
});

/* ===========================
   EXPORT M3U
   =========================== */
function refreshExportFilters(){
    const cats=DB.categories();
    $('#expCat').innerHTML='<option value="">Tümü</option>'+cats.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
}

$('#genM3UBtn').addEventListener('click',()=>{
    const ch=DB.channels();
    const fc=$('#expCat').value;
    const fs=$('#expStatus').value;

    let list=ch.filter(c=>{
        const mc=!fc||c.category===fc;
        const ms=!fs||c.status===fs;
        return mc&&ms;
    });
    list.sort((a,b)=>(a.order||0)-(b.order||0)||a.name.localeCompare(b.name));

    let m3u='#EXTM3U\n';
    list.forEach(c=>{
        let ext='#EXTINF:-1';
        if(c.epgId)ext+=` tvg-id="${c.epgId}"`;
        ext+=` tvg-name="${c.name}"`;
        if(c.logo)ext+=` tvg-logo="${c.logo}"`;
        if(c.category)ext+=` group-title="${c.category}"`;
        ext+=`,${c.name}`;
        m3u+=ext+'\n'+c.url+'\n';
    });

    $('#m3uOutput').value=m3u;
    $('#dlM3UBtn').classList.remove('hidden');
    $('#copyM3UBtn').classList.remove('hidden');
    $('#expStats').classList.remove('hidden');
    $('#expStats').innerHTML=`
        <span><i class="fas fa-tv"></i> ${list.length} kanal</span>
        <span><i class="fas fa-folder"></i> ${[...new Set(list.map(c=>c.category).filter(Boolean))].length} kategori</span>
        <span><i class="fas fa-file"></i> ${(new Blob([m3u]).size/1024).toFixed(1)} KB</span>
    `;
    toast(`${list.length} kanallık M3U oluşturuldu`,'s');
});

$('#dlM3UBtn').addEventListener('click',()=>{
    const content=$('#m3uOutput').value;if(!content)return;
    const fname=($('#expFilename').value.trim()||'playlist')+'.m3u';
    const blob=new Blob([content],{type:'application/x-mpegURL'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=fname;a.click();
    URL.revokeObjectURL(url);
    toast(`${fname} indirildi`,'s');
});

$('#copyM3UBtn').addEventListener('click',()=>{
    const c=$('#m3uOutput').value;if(!c)return;
    navigator.clipboard.writeText(c).then(()=>toast('Panoya kopyalandı','s')).catch(()=>{
        $('#m3uOutput').select();document.execCommand('copy');toast('Panoya kopyalandı','s')});
});

/* ===========================
   SETTINGS
   =========================== */
$('#exportBackup').addEventListener('click',()=>{
    const data={channels:DB.channels(),categories:DB.categories(),theme:DB.theme(),date:new Date().toISOString()};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`iptv-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();
    URL.revokeObjectURL(url);toast('Yedek indirildi','s');
});

$('#importBackup').addEventListener('change',e=>{
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=ev=>{
        try{
            const d=JSON.parse(ev.target.result);
            if(!confirm(`${d.channels?.length||0} kanal ve ${d.categories?.length||0} kategori yüklenecek. Mevcut veriler silinecek. Devam?`))return;
            if(d.channels)DB.saveChannels(d.channels);
            if(d.categories)DB.saveCats(d.categories);
            if(d.theme)applyTheme(d.theme);
            refreshDashboard();
            toast('Yedek yüklendi!','s');
        }catch(err){toast('Geçersiz dosya','e')}
    };
    r.readAsText(f);e.target.value='';
});

$('#clearAllData').addEventListener('click',()=>{
    if(!confirm('TÜM VERİLER silinecek. Emin misiniz?'))return;
    if(!confirm('Bu işlem geri alınamaz! Devam?'))return;
    localStorage.removeItem('iptv_ch');localStorage.removeItem('iptv_cats');
    refreshDashboard();toast('Tüm veriler silindi','s');
    $('#totalBadgeCount').textContent='0';
});

/* ===========================
   INIT
   =========================== */
applyTheme(DB.theme());
refreshDashboard();
$('#totalBadgeCount').textContent=DB.channels().length;

})();
