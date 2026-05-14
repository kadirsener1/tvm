(function(){
'use strict';

// ============================
//  DATA LAYER
// ============================
const ADMIN_DEFAULT={username:'admin',password:'admin123',role:'admin'};
const Store={
    users(){return JSON.parse(localStorage.getItem('iptv_users')||'[]')},
    saveUsers(d){localStorage.setItem('iptv_users',JSON.stringify(d))},
    channels(){return JSON.parse(localStorage.getItem('iptv_ch')||'[]')},
    saveCh(d){localStorage.setItem('iptv_ch',JSON.stringify(d))},
    cats(){return JSON.parse(localStorage.getItem('iptv_cats')||'[]')},
    saveCats(d){localStorage.setItem('iptv_cats',JSON.stringify(d))},
    links(){return JSON.parse(localStorage.getItem('iptv_links')||'[]')},
    saveLinks(d){localStorage.setItem('iptv_links',JSON.stringify(d))},
    admin(){return JSON.parse(localStorage.getItem('iptv_admin')||JSON.stringify(ADMIN_DEFAULT))},
    saveAdmin(d){localStorage.setItem('iptv_admin',JSON.stringify(d))},
    theme(){return localStorage.getItem('iptv_theme')||'dark'},
    saveTheme(t){localStorage.setItem('iptv_theme',t)}
};
function uid(){return Date.now().toString(36)+Math.random().toString(36).substr(2,8)}
function esc(t){if(!t)return'';const d=document.createElement('div');d.textContent=t;return d.innerHTML}
function fmtDate(ts){return new Date(ts).toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}

// Session
const Session={
    set(data){sessionStorage.setItem('iptv_session',JSON.stringify(data))},
    get(){return JSON.parse(sessionStorage.getItem('iptv_session')||'null')},
    clear(){sessionStorage.removeItem('iptv_session')}
};

// ============================
//  TOAST
// ============================
function toast(msg,type='i'){
    const c=document.getElementById('toasts');
    const icons={s:'fa-check-circle',e:'fa-exclamation-circle',w:'fa-exclamation-triangle',i:'fa-info-circle'};
    const el=document.createElement('div');el.className=`toast ${type}`;
    el.innerHTML=`<i class="fas ${icons[type]}"></i><span>${msg}</span>`;
    c.appendChild(el);setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),200)},3000);
}

const $=s=>document.querySelector(s);const $$=s=>document.querySelectorAll(s);

// ============================
//  AUTH
// ============================
const authScreen=$('#authScreen');
const adminPanel=$('#adminPanel');
const userPanel=$('#userPanel');

// Tabs
$$('.auth-tab').forEach(t=>t.addEventListener('click',()=>{
    $$('.auth-tab').forEach(x=>x.classList.remove('active'));
    $$('.auth-form').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    $(`#${t.dataset.tab}Form`).classList.add('active');
}));

// Login
$('#loginForm').addEventListener('submit',e=>{
    e.preventDefault();
    const u=$('#loginUser').value.trim().toLowerCase();
    const p=$('#loginPass').value;
    const admin=Store.admin();

    if(u===admin.username&&p===admin.password){
        Session.set({role:'admin',username:admin.username});
        showAdmin();toast('Admin girişi başarılı!','s');return;
    }
    const users=Store.users();
    const user=users.find(x=>x.username.toLowerCase()===u);
    if(!user){$('#loginErr').textContent='Kullanıcı bulunamadı!';return}
    if(user.password!==p){$('#loginErr').textContent='Şifre hatalı!';return}
    if(user.banned){$('#loginErr').textContent='Hesabınız engellenmiş!';return}
    Session.set({role:'user',userId:user.id,username:user.username});
    showUser(user);toast('Giriş başarılı!','s');
});

// Register
$('#registerForm').addEventListener('submit',e=>{
    e.preventDefault();
    const u=$('#regUser').value.trim();
    const em=$('#regEmail').value.trim();
    const p=$('#regPass').value;
    const p2=$('#regPass2').value;

    if(p!==p2){$('#regErr').textContent='Şifreler eşleşmiyor!';return}
    if(u.length<3){$('#regErr').textContent='Kullanıcı adı en az 3 karakter!';return}

    const users=Store.users();
    const admin=Store.admin();
    if(u.toLowerCase()===admin.username.toLowerCase()){$('#regErr').textContent='Bu isim kullanılamaz!';return}
    if(users.some(x=>x.username.toLowerCase()===u.toLowerCase())){$('#regErr').textContent='Bu kullanıcı adı alınmış!';return}
    if(users.some(x=>x.email.toLowerCase()===em.toLowerCase())){$('#regErr').textContent='Bu e-posta kullanılıyor!';return}

    const newUser={id:uid(),username:u,email:em,password:p,createdAt:Date.now(),downloads:0,banned:false};
    users.push(newUser);Store.saveUsers(users);
    Session.set({role:'user',userId:newUser.id,username:newUser.username});
    showUser(newUser);toast('Kayıt başarılı! Hoş geldiniz!','s');
});

function showAdmin(){
    authScreen.classList.add('hidden');userPanel.classList.add('hidden');adminPanel.classList.remove('hidden');
    refreshAdmDash();$('#loginForm').reset();$('#registerForm').reset();$('#loginErr').textContent='';$('#regErr').textContent='';
}

function showUser(user){
    authScreen.classList.add('hidden');adminPanel.classList.add('hidden');userPanel.classList.remove('hidden');
    $('#usrName').textContent=user.username;$('#usrNameTop').textContent=user.username;$('#usrWelcome').textContent=user.username;
    refreshUserHome();$('#loginForm').reset();$('#registerForm').reset();$('#loginErr').textContent='';$('#regErr').textContent='';
}

function logout(){
    Session.clear();adminPanel.classList.add('hidden');userPanel.classList.add('hidden');authScreen.classList.remove('hidden');
    toast('Çıkış yapıldı','i');
}

$('#adminLogout').addEventListener('click',logout);
$('#userLogout').addEventListener('click',logout);

// Check session on load
function checkSession(){
    const s=Session.get();if(!s)return;
    if(s.role==='admin'){showAdmin();return}
    const users=Store.users();const u=users.find(x=>x.id===s.userId);
    if(u&&!u.banned)showUser(u);else Session.clear();
}

// ============================
//  THEME
// ============================
function applyTheme(t){document.documentElement.setAttribute('data-theme',t);Store.saveTheme(t);$$('.theme-btn').forEach(b=>b.classList.toggle('active',b.dataset.theme===t))}
$$('.theme-btn').forEach(b=>b.addEventListener('click',()=>{applyTheme(b.dataset.theme);toast('Tema değiştirildi','s')}));

// ============================
//  ADMIN NAVIGATION
// ============================
const admTitles={'adm-dash':'Dashboard','adm-channels':'Kanallar','adm-addch':'Kanal Ekle','adm-cats':'Kategoriler','adm-import':'M3U İçe Aktar','adm-export':'M3U Dışa Aktar','adm-users':'Kullanıcılar','adm-settings':'Ayarlar'};

function admNav(page){
    $('#adminSidebar').querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    $$('#adminContent .page').forEach(p=>p.classList.remove('active'));
    const n=$(`#adminSidebar .nav-item[data-page="${page}"]`);const pg=$(`#page-${page}`);
    if(n)n.classList.add('active');if(pg)pg.classList.add('active');
    $('#adminTopTitle').textContent=admTitles[page]||'';$('#adminSidebar').classList.remove('open');
    if(page==='adm-dash')refreshAdmDash();
    if(page==='adm-channels'){refreshAdmFilters();renderAdmChannels()}
    if(page==='adm-addch')prepareAdmAdd();
    if(page==='adm-cats')renderAdmCats();
    if(page==='adm-import')refreshImpCatSel();
    if(page==='adm-export')refreshAdmExpFilters();
    if(page==='adm-users')renderUserList();
}
$('#adminSidebar').querySelectorAll('.nav-item').forEach(n=>n.addEventListener('click',e=>{e.preventDefault();admNav(n.dataset.page)}));
$('#adminMenuToggle').addEventListener('click',()=>$('#adminSidebar').classList.toggle('open'));
$('#adminSidebarClose').addEventListener('click',()=>$('#adminSidebar').classList.remove('open'));

// ============================
//  USER NAVIGATION
// ============================
const usrTitles={'usr-home':'Ana Sayfa','usr-download':'M3U İndir','usr-mylinks':'Linklerim','usr-profile':'Profilim'};

function usrNav(page){
    $('#userSidebar').querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    $$('#userPanel .content .page').forEach(p=>p.classList.remove('active'));
    const n=$(`#userSidebar .nav-item[data-page="${page}"]`);const pg=$(`#page-${page}`);
    if(n)n.classList.add('active');if(pg)pg.classList.add('active');
    $('#userTopTitle').textContent=usrTitles[page]||'';$('#userSidebar').classList.remove('open');
    if(page==='usr-home')refreshUserHome();
    if(page==='usr-download')refreshUserDownload();
    if(page==='usr-mylinks')renderUserLinks();
    if(page==='usr-profile')refreshUserProfile();
}
$('#userSidebar').querySelectorAll('.nav-item').forEach(n=>n.addEventListener('click',e=>{e.preventDefault();usrNav(n.dataset.page)}));
$$('.qa-btn').forEach(b=>b.addEventListener('click',()=>{const g=b.dataset.go;if(g.startsWith('usr-'))usrNav(g);else if(g.startsWith('adm-'))admNav(g)}));
$('#userMenuToggle').addEventListener('click',()=>$('#userSidebar').classList.toggle('open'));
$('#userSidebarClose').addEventListener('click',()=>$('#userSidebar').classList.remove('open'));

// ============================
//  ADMIN DASHBOARD
// ============================
function refreshAdmDash(){
    const ch=Store.channels(),cats=Store.cats(),users=Store.users(),links=Store.links();
    const totalDl=users.reduce((s,u)=>s+u.downloads,0)+links.reduce((s,l)=>s+(l.dlCount||0),0);
    $('#admStatCh').textContent=ch.length;$('#admStatCat').textContent=cats.length;
    $('#admStatUsers').textContent=users.length;$('#admStatDl').textContent=totalDl;

    const recent=[...ch].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,6);
    $('#admRecent').innerHTML=recent.length?recent.map(c=>`<div class="recent-row"><div class="r-logo">${c.name.charAt(0)}</div><span class="r-name">${esc(c.name)}</span><span class="r-cat">${esc(c.category||'—')}</span></div>`).join(''):'<p style="color:var(--t3);font-size:12px">Kanal yok.</p>';

    const gc={};ch.forEach(c=>{const g=c.category||'Kategorisiz';gc[g]=(gc[g]||0)+1});
    const mx=Math.max(...Object.values(gc),1);const cc={};cats.forEach(c=>cc[c.name]=c.color);
    $('#admCatChart').innerHTML=Object.entries(gc).sort((a,b)=>b[1]-a[1]).map(([n,v])=>`<div class="bar-row"><div class="bar-label"><span>${esc(n)}</span><span>${v}</span></div><div class="bar-track"><div class="bar-fill" style="width:${v/mx*100}%;background:${cc[n]||'var(--ac)'}"></div></div></div>`).join('')||'<p style="color:var(--t3);font-size:12px">Veri yok.</p>';
}

// ============================
//  ADMIN CHANNELS
// ============================
let admPage=1;const admPP=20;let admSel=new Set();

function catOpts(sel=''){const c=Store.cats();return'<option value="">Seçin</option>'+c.map(x=>`<option value="${esc(x.name)}" ${x.name===sel?'selected':''}>${esc(x.name)}</option>`).join('')}
function filterCatOpts(){const c=Store.cats();return'<option value="">Tümü</option>'+c.map(x=>`<option value="${esc(x.name)}">${esc(x.name)}</option>`).join('')}

function refreshAdmFilters(){$('#admFilterCat').innerHTML=filterCatOpts()}

function renderAdmChannels(){
    const all=Store.channels();const s=($('#admSearch')?.value||'').toLowerCase();const fc=$('#admFilterCat')?.value||'';const fs=$('#admFilterSt')?.value||'';
    let f=all.filter(c=>{const ms=c.name.toLowerCase().includes(s)||c.url.toLowerCase().includes(s)||(c.category||'').toLowerCase().includes(s);return ms&&(!fc||c.category===fc)&&(!fs||c.status===fs)});
    f.sort((a,b)=>(a.order||0)-(b.order||0)||a.name.localeCompare(b.name));
    const tp=Math.ceil(f.length/admPP)||1;if(admPage>tp)admPage=tp;
    const pg=f.slice((admPage-1)*admPP,admPage*admPP);

    $('#admChList').innerHTML=pg.length?pg.map(c=>`
        <div class="ch-card ${c.status==='inactive'?'off':''}"><input type="checkbox" class="ch-cb" data-id="${c.id}" ${admSel.has(c.id)?'checked':''}>
        ${c.logo?`<img src="${esc(c.logo)}" class="ch-logo" onerror="this.outerHTML='<div class=ch-ph>${esc(c.name).charAt(0)}</div>'">`:`<div class="ch-ph">${esc(c.name).charAt(0)}</div>`}
        <div class="ch-info"><div class="ch-name">${esc(c.name)}</div><div class="ch-meta">${c.category?`<span><i class="fas fa-folder"></i> ${esc(c.category)}</span>`:''}</div><div class="ch-url">${esc(c.url)}</div></div>
        <span class="ch-badge ${c.status==='active'?'badge-on':'badge-off'}">${c.status==='active'?'Aktif':'Pasif'}</span>
        <div class="ch-actions"><button class="btn btn-xs btn-outline ae" data-id="${c.id}"><i class="fas fa-edit"></i></button><button class="btn btn-xs btn-warn at" data-id="${c.id}"><i class="fas fa-${c.status==='active'?'toggle-on':'toggle-off'}"></i></button><button class="btn btn-xs btn-danger ad" data-id="${c.id}"><i class="fas fa-trash"></i></button></div></div>
    `).join(''):'<p style="text-align:center;color:var(--t3);padding:30px">Kanal yok.</p>';

    // pagination
    let ph='';if(tp>1){ph+=`<button ${admPage===1?'disabled':''} data-p="${admPage-1}"><i class="fas fa-chevron-left"></i></button>`;for(let i=1;i<=tp;i++){if(tp<=7||i===1||i===tp||Math.abs(i-admPage)<=1)ph+=`<button class="${i===admPage?'active':''}" data-p="${i}">${i}</button>`;else if(Math.abs(i-admPage)===2)ph+=`<button disabled>…</button>`}ph+=`<button ${admPage===tp?'disabled':''} data-p="${admPage+1}"><i class="fas fa-chevron-right"></i></button>`}
    $('#admPag').innerHTML=ph;

    $$('.ch-cb').forEach(cb=>cb.addEventListener('change',()=>{cb.checked?admSel.add(cb.dataset.id):admSel.delete(cb.dataset.id)}));
    $$('.ae').forEach(b=>b.addEventListener('click',()=>openEditModal(b.dataset.id)));
    $$('.at').forEach(b=>b.addEventListener('click',()=>{const ch=Store.channels();const c=ch.find(x=>x.id===b.dataset.id);if(c){c.status=c.status==='active'?'inactive':'active';Store.saveCh(ch);renderAdmChannels();toast(`${c.name} ${c.status}`,'s')}}));
    $$('.ad').forEach(b=>b.addEventListener('click',()=>{const ch=Store.channels();const c=ch.find(x=>x.id===b.dataset.id);if(c&&confirm(`"${c.name}" silinsin mi?`)){Store.saveCh(ch.filter(x=>x.id!==b.dataset.id));admSel.delete(b.dataset.id);renderAdmChannels();toast('Silindi','s')}}));
    $$('#admPag button:not([disabled])').forEach(b=>b.addEventListener('click',()=>{admPage=parseInt(b.dataset.p);renderAdmChannels()}));
}

$('#admSearch')?.addEventListener('input',()=>{admPage=1;renderAdmChannels()});
$('#admFilterCat')?.addEventListener('change',()=>{admPage=1;renderAdmChannels()});
$('#admFilterSt')?.addEventListener('change',()=>{admPage=1;renderAdmChannels()});
$('#admSelAll')?.addEventListener('click',()=>{const ch=Store.channels();ch.length===admSel.size?admSel.clear():ch.forEach(c=>admSel.add(c.id));renderAdmChannels()});
$('#admDelSel')?.addEventListener('click',()=>{if(!admSel.size)return toast('Seçim yok','w');if(!confirm(`${admSel.size} kanal silinecek?`))return;Store.saveCh(Store.channels().filter(c=>!admSel.has(c.id)));admSel.clear();renderAdmChannels();toast('Silindi','s')});

// Add channel
function prepareAdmAdd(){$('#admChEditId').value='';$('#admChForm').reset();$('#admChCat').innerHTML=catOpts();$('#admChSaveBtn').innerHTML='<i class="fas fa-save"></i> Kaydet';$('#admChCancelBtn').style.display='none'}
$('#admChForm').addEventListener('submit',e=>{
    e.preventDefault();const editId=$('#admChEditId').value;
    const d={id:editId||uid(),name:$('#admChName').value.trim(),url:$('#admChUrl').value.trim(),category:$('#admChCat').value,logo:$('#admChLogo').value.trim(),epgId:$('#admChEpg').value.trim(),status:$('#admChSt').value,order:parseInt($('#admChOrd').value)||0,updatedAt:Date.now()};
    if(!d.name||!d.url)return toast('Ad ve URL zorunlu','w');
    const ch=Store.channels();
    if(editId){const i=ch.findIndex(c=>c.id===editId);if(i>=0){d.createdAt=ch[i].createdAt;ch[i]=d}toast('Güncellendi','s')}
    else{d.createdAt=Date.now();ch.push(d);toast('Eklendi','s')}
    Store.saveCh(ch);prepareAdmAdd();
});
$('#admChCancelBtn').addEventListener('click',prepareAdmAdd);

// Edit modal
function openEditModal(id){
    const ch=Store.channels();const c=ch.find(x=>x.id===id);if(!c)return;
    $('#edId').value=c.id;$('#edName').value=c.name;$('#edUrl').value=c.url;$('#edCat').innerHTML=catOpts(c.category);
    $('#edLogo').value=c.logo||'';$('#edEpg').value=c.epgId||'';$('#edSt').value=c.status;$('#edOrd').value=c.order||0;
    $('#editModal').classList.remove('hidden');
}
function closeModal(){$('#editModal').classList.add('hidden')}
$('#modX').addEventListener('click',closeModal);$('#modCancel').addEventListener('click',closeModal);$('.modal-bg').addEventListener('click',closeModal);
$('#editForm').addEventListener('submit',e=>{
    e.preventDefault();const id=$('#edId').value;const ch=Store.channels();const i=ch.findIndex(c=>c.id===id);
    if(i>=0){ch[i]={...ch[i],name:$('#edName').value.trim(),url:$('#edUrl').value.trim(),category:$('#edCat').value,logo:$('#edLogo').value.trim(),epgId:$('#edEpg').value.trim(),status:$('#edSt').value,order:parseInt($('#edOrd').value)||0,updatedAt:Date.now()};Store.saveCh(ch);closeModal();renderAdmChannels();toast('Güncellendi','s')}
});

// ============================
//  ADMIN CATEGORIES
// ============================
function renderAdmCats(){
    const cats=Store.cats();const ch=Store.channels();
    $('#admCatList').innerHTML=cats.length?cats.map(c=>{const cnt=ch.filter(x=>x.category===c.name).length;return`
        <div class="cat-card"><div class="cat-ico" style="background:${c.color||'var(--ac)'}"><i class="${c.icon||'fas fa-folder'}"></i></div>
        <div class="cat-inf"><h4>${esc(c.name)}</h4><p>${cnt} kanal</p></div>
        <div class="cat-acts"><button class="btn btn-xs btn-outline ce" data-id="${c.id}"><i class="fas fa-edit"></i></button><button class="btn btn-xs btn-danger cd" data-id="${c.id}"><i class="fas fa-trash"></i></button></div></div>`}).join(''):'<p style="color:var(--t3);padding:20px">Kategori yok.</p>';
    $$('.ce').forEach(b=>b.addEventListener('click',()=>{const c=Store.cats().find(x=>x.id===b.dataset.id);if(!c)return;$('#admCatEditId').value=c.id;$('#admCatName').value=c.name;$('#admCatIcon').value=c.icon||'';$('#admCatColor').value=c.color||'#1da1f2';$('#admCatSaveBtn').innerHTML='<i class="fas fa-save"></i>';$('#admCatCancelBtn').style.display='inline-flex'}));
    $$('.cd').forEach(b=>b.addEventListener('click',()=>{const cats2=Store.cats();const c=cats2.find(x=>x.id===b.dataset.id);if(c&&confirm(`"${c.name}" silinsin mi?`)){Store.saveCats(cats2.filter(x=>x.id!==b.dataset.id));const ch2=Store.channels();ch2.forEach(x=>{if(x.category===c.name)x.category=''});Store.saveCh(ch2);renderAdmCats();toast('Silindi','s')}}));
}
$('#admCatForm').addEventListener('submit',e=>{
    e.preventDefault();const eId=$('#admCatEditId').value;const name=$('#admCatName').value.trim();const icon=$('#admCatIcon').value.trim()||'fas fa-folder';const color=$('#admCatColor').value;
    if(!name)return;const cats=Store.cats();
    if(eId){const old=cats.find(c=>c.id===eId);const oldN=old?old.name:'';const i=cats.findIndex(c=>c.id===eId);if(i>=0){cats[i]={...cats[i],name,icon,color};if(oldN!==name){const ch=Store.channels();ch.forEach(x=>{if(x.category===oldN)x.category=name});Store.saveCh(ch)}}toast('Güncellendi','s')}
    else{if(cats.some(c=>c.name.toLowerCase()===name.toLowerCase()))return toast('Var','w');cats.push({id:uid(),name,icon,color});toast('Eklendi','s')}
    Store.saveCats(cats);$('#admCatForm').reset();$('#admCatEditId').value='';$('#admCatSaveBtn').innerHTML='<i class="fas fa-plus"></i>';$('#admCatCancelBtn').style.display='none';$('#admCatColor').value='#1da1f2';renderAdmCats();
});
$('#admCatCancelBtn').addEventListener('click',()=>{$('#admCatForm').reset();$('#admCatEditId').value='';$('#admCatSaveBtn').innerHTML='<i class="fas fa-plus"></i>';$('#admCatCancelBtn').style.display='none';$('#admCatColor').value='#1da1f2'});
$$('.ih').forEach(h=>h.addEventListener('click',()=>{$('#admCatIcon').value=h.dataset.i}));

// ============================
//  ADMIN IMPORT
// ============================
function parseM3U(text){const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);const res=[];let cur=null;for(const l of lines){if(l.startsWith('#EXTINF')){cur={};cur.epgId=ga(l,'tvg-id');const tn=ga(l,'tvg-name');cur.logo=ga(l,'tvg-logo');cur.group=ga(l,'group-title');const ci=l.lastIndexOf(',');cur.name=tn||(ci>=0?l.substring(ci+1).trim():'')||'Bilinmeyen'}else if(l.startsWith('#'))continue;else if(cur){cur.url=l;res.push({...cur});cur=null}}return res}
function ga(l,a){const m=l.match(new RegExp(`${a}="([^"]*)"`, 'i'));return m?m[1]:''}

$$('.imp-tab').forEach(t=>t.addEventListener('click',()=>{$$('.imp-tab').forEach(x=>x.classList.remove('active'));$$('.imp-content').forEach(x=>x.classList.remove('active'));t.classList.add('active');$(`#impTab-${t.dataset.tab}`).classList.add('active')}));

function refreshImpCatSel(){$('#impCatSelect').innerHTML='<option value="">Orijinal grubu kullan</option>'+Store.cats().map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')}

const dz=$('#dropZone');
dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('over')});
dz.addEventListener('dragleave',()=>dz.classList.remove('over'));
dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('over');if(e.dataTransfer.files[0])rdFile(e.dataTransfer.files[0])});
$('#m3uFile').addEventListener('change',e=>{if(e.target.files[0])rdFile(e.target.files[0])});
function rdFile(f){const r=new FileReader();r.onload=e=>showPV(parseM3U(e.target.result));r.readAsText(f)}
$('#parseTextBtn').addEventListener('click',()=>{const t=$('#m3uText').value.trim();if(!t)return toast('İçerik yok','w');showPV(parseM3U(t))});
$('#fetchUrlBtn').addEventListener('click',async()=>{const u=$('#m3uUrl').value.trim();if(!u)return toast('URL yok','w');try{const r=await fetch(u);showPV(parseM3U(await r.text()))}catch(e){toast('İndirilemedi','e')}});

let pvList=[];
function showPV(list){pvList=list;if(!list.length){toast('Kanal yok','w');$('#impPreview').classList.add('hidden');return}$('#impPreview').classList.remove('hidden');$('#pvCount').textContent=list.length;$('#pvList').innerHTML=list.map((c,i)=>`<div class="pv-item"><input type="checkbox" checked data-i="${i}" class="pvc"><span class="pv-name">${esc(c.name)}</span>${c.group?`<span class="pv-group">${esc(c.group)}</span>`:''}</div>`).join('');toast(`${list.length} kanal bulundu`,'s')}
$('#pvSelAll').addEventListener('click',()=>$$('.pvc').forEach(c=>c.checked=true));
$('#pvDesel').addEventListener('click',()=>$$('.pvc').forEach(c=>c.checked=false));
$('#pvImport').addEventListener('click',()=>{
    const idxs=[];$$('.pvc').forEach(cb=>{if(cb.checked)idxs.push(parseInt(cb.dataset.i))});if(!idxs.length)return toast('Seçim yok','w');
    const ov=$('#impCatSelect').value;const ch=Store.channels();const cats=Store.cats();const cn=new Set(cats.map(c=>c.name.toLowerCase()));let added=0;
    idxs.forEach(i=>{const c=pvList[i];if(!c)return;const cat=ov||c.group||'';if(cat&&!cn.has(cat.toLowerCase())){cats.push({id:uid(),name:cat,icon:'fas fa-folder',color:'#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0')});cn.add(cat.toLowerCase())}ch.push({id:uid(),name:c.name,url:c.url,category:cat,logo:c.logo||'',epgId:c.epgId||'',status:'active',order:0,createdAt:Date.now(),updatedAt:Date.now()});added++});
    Store.saveCh(ch);Store.saveCats(cats);$('#impPreview').classList.add('hidden');pvList=[];toast(`${added} kanal eklendi!`,'s');
});

// ============================
//  ADMIN EXPORT
// ============================
function refreshAdmExpFilters(){$('#admExpCat').innerHTML=filterCatOpts()}
$('#admGenM3U').addEventListener('click',()=>{
    const ch=Store.channels();const fc=$('#admExpCat').value;const fs=$('#admExpSt').value;
    let list=ch.filter(c=>(!fc||c.category===fc)&&(!fs||c.status===fs));list.sort((a,b)=>(a.order||0)-(b.order||0)||a.name.localeCompare(b.name));
    let m3u='#EXTM3U\n';list.forEach(c=>{let e='#EXTINF:-1';if(c.epgId)e+=` tvg-id="${c.epgId}"`;e+=` tvg-name="${c.name}"`;if(c.logo)e+=` tvg-logo="${c.logo}"`;if(c.category)e+=` group-title="${c.category}"`;e+=`,${c.name}`;m3u+=e+'\n'+c.url+'\n'});
    $('#admM3UOut').value=m3u;$('#admDlM3U').classList.remove('hidden');$('#admCopyM3U').classList.remove('hidden');toast(`${list.length} kanallık M3U`,'s');
});
$('#admDlM3U').addEventListener('click',()=>{dl($('#admM3UOut').value,'admin-playlist.m3u')});
$('#admCopyM3U').addEventListener('click',()=>{cp($('#admM3UOut').value)});

// ============================
//  ADMIN USERS
// ============================
function renderUserList(){
    const users=Store.users();const links=Store.links();const q=($('#userSearch')?.value||'').toLowerCase();
    const f=users.filter(u=>u.username.toLowerCase().includes(q)||u.email.toLowerCase().includes(q));
    $('#userList').innerHTML=f.length?f.map(u=>{
        const uLinks=links.filter(l=>l.userId===u.id);const totalDl=uLinks.reduce((s,l)=>s+(l.dlCount||0),0);
        return`<div class="user-card ${u.banned?'off':''}">
            <div class="uc-avatar">${u.username.charAt(0).toUpperCase()}</div>
            <div class="uc-info"><h4>${esc(u.username)}</h4><p>${esc(u.email)} · ${fmtDate(u.createdAt)}</p></div>
            <div class="uc-stats"><span><i class="fas fa-link"></i>${uLinks.length}</span><span><i class="fas fa-download"></i>${totalDl}</span></div>
            <div class="uc-actions">
                <button class="btn btn-xs ${u.banned?'btn-success':'btn-warn'} ub" data-id="${u.id}" title="${u.banned?'Engeli Kaldır':'Engelle'}"><i class="fas fa-${u.banned?'unlock':'ban'}"></i></button>
                <button class="btn btn-xs btn-danger ud" data-id="${u.id}" title="Sil"><i class="fas fa-trash"></i></button>
            </div></div>`}).join(''):'<p style="color:var(--t3);padding:20px">Kullanıcı yok.</p>';
    $$('.ub').forEach(b=>b.addEventListener('click',()=>{const users2=Store.users();const u=users2.find(x=>x.id===b.dataset.id);if(u){u.banned=!u.banned;Store.saveUsers(users2);renderUserList();toast(u.banned?'Engellendi':'Engel kaldırıldı','s')}}));
    $$('.ud').forEach(b=>b.addEventListener('click',()=>{if(!confirm('Bu kullanıcı silinsin mi?'))return;Store.saveUsers(Store.users().filter(x=>x.id!==b.dataset.id));Store.saveLinks(Store.links().filter(x=>x.userId!==b.dataset.id));renderUserList();toast('Silindi','s')}));
}
$('#userSearch')?.addEventListener('input',()=>renderUserList());

// ============================
//  ADMIN SETTINGS
// ============================
$('#admPassForm').addEventListener('submit',e=>{e.preventDefault();const a=Store.admin();if($('#admCurPass').value!==a.password)return toast('Hatalı şifre','e');const np=$('#admNewPass').value;if(np.length<4)return toast('Min 4 karakter','w');a.password=np;Store.saveAdmin(a);$('#admPassForm').reset();toast('Şifre güncellendi','s')});
$('#admBackup').addEventListener('click',()=>{const d={channels:Store.channels(),categories:Store.cats(),users:Store.users(),links:Store.links(),admin:Store.admin(),theme:Store.theme(),date:new Date().toISOString()};dl(JSON.stringify(d,null,2),`iptv-backup-${new Date().toISOString().slice(0,10)}.json`,'application/json');toast('Yedek indirildi','s')});
$('#admRestore').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(!confirm('Mevcut veriler silinecek. Devam?'))return;if(d.channels)Store.saveCh(d.channels);if(d.categories)Store.saveCats(d.categories);if(d.users)Store.saveUsers(d.users);if(d.links)Store.saveLinks(d.links);if(d.admin)Store.saveAdmin(d.admin);if(d.theme)applyTheme(d.theme);refreshAdmDash();toast('Yedek yüklendi!','s')}catch(err){toast('Geçersiz dosya','e')}};r.readAsText(f);e.target.value=''});
$('#admClearAll').addEventListener('click',()=>{if(!confirm('TÜM VERİLER silinecek!'))return;if(!confirm('Geri alınamaz! Emin misiniz?'))return;['iptv_ch','iptv_cats','iptv_users','iptv_links'].forEach(k=>localStorage.removeItem(k));refreshAdmDash();toast('Silindi','s')});

// ============================
//  USER HOME
// ============================
function getCurUser(){const s=Session.get();if(!s||s.role!=='user')return null;return Store.users().find(u=>u.id===s.userId)||null}

function refreshUserHome(){
    const u=getCurUser();if(!u)return;
    const cats=Store.cats();const ch=Store.channels().filter(c=>c.status==='active');
    const myLinks=Store.links().filter(l=>l.userId===u.id);
    const myDl=myLinks.reduce((s,l)=>s+(l.dlCount||0),0);
    $('#usrStatCats').textContent=cats.length;$('#usrStatCh').textContent=ch.length;
    $('#usrStatDl').textContent=myDl;$('#usrStatLinks').textContent=myLinks.length;
}

// ============================
//  USER DOWNLOAD
// ============================
function refreshUserDownload(){
    const cats=Store.cats();const ch=Store.channels().filter(c=>c.status==='active');
    $('#usrCatSelector').innerHTML=cats.length?cats.map(c=>{const cnt=ch.filter(x=>x.category===c.name).length;return`
        <div class="cat-sel-card" data-cat="${esc(c.name)}">
            <div class="csc-icon" style="background:${c.color||'var(--ac)'}"><i class="${c.icon||'fas fa-folder'}"></i></div>
            <div class="csc-info"><h4>${esc(c.name)}</h4><p>${cnt} kanal</p></div>
            <div class="csc-check"><i class="fas fa-check"></i></div>
        </div>`}).join(''):'<p style="color:var(--t3)">Henüz kategori eklenmemiş.</p>';

    $$('.cat-sel-card').forEach(card=>{
        card.addEventListener('click',()=>card.classList.toggle('selected'));
    });

    $('#usrPreview').classList.add('hidden');$('#usrDownload').classList.add('hidden');$('#usrCopyLink').classList.add('hidden');
}

$('#usrGenerate').addEventListener('click',()=>{
    const u=getCurUser();if(!u)return toast('Oturum hatası','e');
    const selectedCats=[];$$('.cat-sel-card.selected').forEach(c=>selectedCats.push(c.dataset.cat));
    if(!selectedCats.length)return toast('En az bir kategori seçin','w');

    const ch=Store.channels().filter(c=>c.status==='active'&&selectedCats.includes(c.category));
    ch.sort((a,b)=>(a.order||0)-(b.order||0)||a.name.localeCompare(b.name));

    if(!ch.length)return toast('Seçili kategorilerde kanal yok','w');

    // Generate unique link token
    const token=uid();
    let m3u='#EXTM3U\n';m3u+=`# IPTV Playlist - User: ${u.username} - Token: ${token}\n`;m3u+=`# Generated: ${new Date().toISOString()}\n`;
    ch.forEach(c=>{let e='#EXTINF:-1';if(c.epgId)e+=` tvg-id="${c.epgId}"`;e+=` tvg-name="${c.name}"`;if(c.logo)e+=` tvg-logo="${c.logo}"`;if(c.category)e+=` group-title="${c.category}"`;e+=`,${c.name}`;m3u+=e+'\n'+c.url+'\n'});

    // Save link
    const links=Store.links();
    const linkObj={id:uid(),userId:u.id,username:u.username,token,categories:selectedCats,channelCount:ch.length,m3uContent:m3u,createdAt:Date.now(),dlCount:0};
    links.push(linkObj);Store.saveLinks(links);

    // Update user downloads
    const users=Store.users();const ui=users.findIndex(x=>x.id===u.id);if(ui>=0){users[ui].downloads=(users[ui].downloads||0)+1;Store.saveUsers(users)}

    // Unique link (simulated - in real app this would be a server URL)
    const fakeUrl=`${location.origin}${location.pathname}?user=${u.username}&token=${token}`;
    $('#usrLinkOutput').value=fakeUrl;
    $('#usrM3UOut').value=m3u;
    $('#usrPreview').classList.remove('hidden');$('#usrDownload').classList.remove('hidden');$('#usrCopyLink').classList.remove('hidden');
    $('#usrExpStats').innerHTML=`<span><i class="fas fa-tv"></i> ${ch.length} kanal</span><span><i class="fas fa-folder"></i> ${selectedCats.length} kategori</span><span><i class="fas fa-file"></i> ${(new Blob([m3u]).size/1024).toFixed(1)} KB</span><span><i class="fas fa-fingerprint"></i> ${token}</span>`;
    toast(`${ch.length} kanallık M3U oluşturuldu!`,'s');
});

$('#usrDownload').addEventListener('click',()=>{
    const m3u=$('#usrM3UOut').value;if(!m3u)return;
    const fname=($('#usrFilename').value.trim()||'my-playlist')+'.m3u';
    dl(m3u,fname);

    // Increment download count
    const s=Session.get();if(s){const links=Store.links();const last=links.filter(l=>l.userId===s.userId).pop();if(last){last.dlCount=(last.dlCount||0)+1;Store.saveLinks(links)}}
    toast(`${fname} indirildi!`,'s');
});

$('#usrCopyLink').addEventListener('click',()=>cp($('#usrLinkOutput').value));
$('#usrCopyLinkBtn').addEventListener('click',()=>cp($('#usrLinkOutput').value));

// ============================
//  USER MY LINKS
// ============================
function renderUserLinks(){
    const u=getCurUser();if(!u)return;
    const links=Store.links().filter(l=>l.userId===u.id).sort((a,b)=>b.createdAt-a.createdAt);
    const cats=Store.cats();const catColors={};cats.forEach(c=>catColors[c.name]=c.color);

    $('#usrLinkList').innerHTML=links.length?links.map(l=>{
        const fakeUrl=`${location.origin}${location.pathname}?user=${u.username}&token=${l.token}`;
        return`<div class="link-card">
            <div class="lc-top"><h4><i class="fas fa-link"></i> Playlist #${l.token.substring(0,6)}</h4><span class="lc-date">${fmtDate(l.createdAt)}</span></div>
            <div class="lc-cats">${l.categories.map(c=>`<span class="lc-cat-tag" style="background:${catColors[c]||'var(--ac)'}">${esc(c)}</span>`).join('')}</div>
            <div class="lc-stats"><span><i class="fas fa-tv"></i> ${l.channelCount} kanal</span><span><i class="fas fa-download"></i> ${l.dlCount||0} indirme</span><span><i class="fas fa-file"></i> ${(new Blob([l.m3uContent||'']).size/1024).toFixed(1)} KB</span></div>
            <div class="lc-link"><input type="text" value="${esc(fakeUrl)}" readonly><button class="btn btn-xs btn-primary lc-copy" data-url="${esc(fakeUrl)}"><i class="fas fa-copy"></i></button></div>
            <div class="lc-actions">
                <button class="btn btn-xs btn-success lc-dl" data-id="${l.id}"><i class="fas fa-download"></i> İndir</button>
                <button class="btn btn-xs btn-danger lc-del" data-id="${l.id}"><i class="fas fa-trash"></i> Sil</button>
            </div></div>`}).join(''):'<p style="color:var(--t3);padding:20px">Henüz bir link oluşturmadınız.</p>';

    $$('.lc-copy').forEach(b=>b.addEventListener('click',()=>cp(b.dataset.url)));
    $$('.lc-dl').forEach(b=>b.addEventListener('click',()=>{const l=Store.links().find(x=>x.id===b.dataset.id);if(l){dl(l.m3uContent,`playlist-${l.token.substring(0,6)}.m3u`);l.dlCount=(l.dlCount||0)+1;Store.saveLinks(Store.links().map(x=>x.id===l.id?l:x));renderUserLinks();toast('İndirildi','s')}}));
    $$('.lc-del').forEach(b=>b.addEventListener('click',()=>{if(!confirm('Bu link silinsin mi?'))return;Store.saveLinks(Store.links().filter(x=>x.id!==b.dataset.id));renderUserLinks();toast('Silindi','s')}));
}

// ============================
//  USER PROFILE
// ============================
function refreshUserProfile(){
    const u=getCurUser();if(!u)return;
    $('#usrProfName').value=u.username;$('#usrProfEmail').value=u.email;$('#usrProfDate').value=fmtDate(u.createdAt);
}
$('#usrPassForm').addEventListener('submit',e=>{
    e.preventDefault();const u=getCurUser();if(!u)return;
    if($('#usrCurPass').value!==u.password)return toast('Hatalı şifre','e');
    const np=$('#usrNewPass').value;const np2=$('#usrNewPass2').value;
    if(np!==np2)return toast('Şifreler eşleşmiyor','e');if(np.length<4)return toast('Min 4 karakter','w');
    const users=Store.users();const i=users.findIndex(x=>x.id===u.id);if(i>=0){users[i].password=np;Store.saveUsers(users)}
    $('#usrPassForm').reset();toast('Şifre güncellendi','s');
});

// ============================
//  HELPERS
// ============================
function dl(content,filename,type='application/x-mpegURL'){const b=new Blob([content],{type});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=filename;a.click();URL.revokeObjectURL(u)}
function cp(text){navigator.clipboard.writeText(text).then(()=>toast('Kopyalandı!','s')).catch(()=>{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Kopyalandı!','s')})}

// ============================
//  INIT
// ============================
applyTheme(Store.theme());
checkSession();

})();
