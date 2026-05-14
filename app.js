(function(){
'use strict';

// =====================
// DATA
// =====================
const ADMIN_DEF={username:'admin',password:'admin123'};
const S={
    users:()=>JSON.parse(localStorage.getItem('iv_u')||'[]'),
    sUsers:d=>localStorage.setItem('iv_u',JSON.stringify(d)),
    ch:()=>JSON.parse(localStorage.getItem('iv_c')||'[]'),
    sCh:d=>localStorage.setItem('iv_c',JSON.stringify(d)),
    cats:()=>JSON.parse(localStorage.getItem('iv_k')||'[]'),
    sCats:d=>localStorage.setItem('iv_k',JSON.stringify(d)),
    links:()=>JSON.parse(localStorage.getItem('iv_l')||'[]'),
    sLinks:d=>localStorage.setItem('iv_l',JSON.stringify(d)),
    admin:()=>JSON.parse(localStorage.getItem('iv_a')||JSON.stringify(ADMIN_DEF)),
    sAdmin:d=>localStorage.setItem('iv_a',JSON.stringify(d)),
    theme:()=>localStorage.getItem('iv_t')||'dark',
    sTheme:t=>localStorage.setItem('iv_t',t)
};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).substr(2,8);
const esc=t=>{if(!t)return'';const d=document.createElement('div');d.textContent=t;return d.innerHTML};
const fdt=ts=>new Date(ts).toLocaleDateString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});

const Ses={
    set:d=>sessionStorage.setItem('iv_s',JSON.stringify(d)),
    get:()=>JSON.parse(sessionStorage.getItem('iv_s')||'null'),
    clear:()=>sessionStorage.removeItem('iv_s')
};

// =====================
// TOAST
// =====================
function toast(m,t='i'){
    const c=document.getElementById('toasts');
    const ic={s:'fa-check-circle',e:'fa-exclamation-circle',w:'fa-exclamation-triangle',i:'fa-info-circle'};
    const el=document.createElement('div');el.className=`toast ${t}`;
    el.innerHTML=`<i class="fas ${ic[t]}"></i><span>${m}</span>`;
    c.appendChild(el);setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),200)},3000);
}
const $=s=>document.querySelector(s);const $$=s=>document.querySelectorAll(s);

// =====================
// CHECK IF M3U SERVE REQUEST
// =====================
function checkM3UServe(){
    const params=new URLSearchParams(window.location.search);
    const token=params.get('token');
    const action=params.get('action');
    
    if(token){
        const links=S.links();
        const link=links.find(l=>l.token===token);
        
        if(link && link.m3uContent){
            // If action=raw, serve raw M3U content (for IPTV players)
            if(action==='raw'){
                // Serve as plain text M3U
                document.open('text/plain');
                document.write(link.m3uContent);
                document.close();
                
                // Update download count
                link.dlCount=(link.dlCount||0)+1;
                S.sLinks(links);
                return true;
            }
            
            // Otherwise show the serve page
            document.getElementById('authScreen').classList.add('hidden');
            document.getElementById('adminPanel').classList.add('hidden');
            document.getElementById('userPanel').classList.add('hidden');
            document.getElementById('m3uServePage').classList.remove('hidden');
            
            const cats=link.categories||[];
            $('#serveTitle').textContent=`IPTV Playlist (${link.channelCount} kanal)`;
            $('#serveInfo').innerHTML=`
                <strong>${esc(link.username)}</strong> kullanıcısına özel playlist<br>
                Kategoriler: ${cats.map(c=>`<span style="background:var(--ac);color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;margin:2px">${esc(c)}</span>`).join(' ')}<br>
                <small>Oluşturulma: ${fdt(link.createdAt)}</small>
            `;
            
            $('#serveDownload').onclick=()=>{
                dlFile(link.m3uContent,`playlist-${link.token.substring(0,6)}.m3u`);
                link.dlCount=(link.dlCount||0)+1;
                S.sLinks(links);
                toast('İndirildi!','s');
            };
            
            return true;
        }else{
            // Invalid token - show error
            document.getElementById('authScreen').classList.add('hidden');
            document.getElementById('m3uServePage').classList.remove('hidden');
            $('#serveTitle').textContent='Link Bulunamadı';
            $('#serveInfo').textContent='Bu link geçersiz veya silinmiş olabilir.';
            $('#serveDownload').style.display='none';
            return true;
        }
    }
    return false;
}

// =====================
// Generate proper M3U link for IPTV players
// =====================
function generateM3ULink(token){
    // For IPTV players we need action=raw so it serves plain M3U text
    return `${location.origin}${location.pathname}?token=${token}&action=raw`;
}

function generateWebLink(token){
    // For browser viewing
    return `${location.origin}${location.pathname}?token=${token}`;
}

// =====================
// AUTH
// =====================
$$('.auth-tab').forEach(t=>t.addEventListener('click',()=>{
    $$('.auth-tab').forEach(x=>x.classList.remove('active'));$$('.auth-form').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');$(`#${t.dataset.tab}Form`).classList.add('active');
}));

$('#loginForm').addEventListener('submit',e=>{
    e.preventDefault();const u=$('#loginUser').value.trim().toLowerCase(),p=$('#loginPass').value,a=S.admin();
    if(u===a.username&&p===a.password){Ses.set({role:'admin',username:a.username});showAdm();toast('Admin girişi!','s');return}
    const users=S.users(),usr=users.find(x=>x.username.toLowerCase()===u);
    if(!usr){$('#loginErr').textContent='Kullanıcı yok!';return}
    if(usr.password!==p){$('#loginErr').textContent='Şifre hatalı!';return}
    if(usr.banned){$('#loginErr').textContent='Hesap engelli!';return}
    Ses.set({role:'user',userId:usr.id,username:usr.username});showUsr(usr);toast('Hoş geldiniz!','s');
});

$('#registerForm').addEventListener('submit',e=>{
    e.preventDefault();const u=$('#regUser').value.trim(),em=$('#regEmail').value.trim(),p=$('#regPass').value,p2=$('#regPass2').value;
    if(p!==p2){$('#regErr').textContent='Şifreler eşleşmiyor!';return}
    const users=S.users(),a=S.admin();
    if(u.toLowerCase()===a.username){$('#regErr').textContent='Bu isim alınamaz!';return}
    if(users.some(x=>x.username.toLowerCase()===u.toLowerCase())){$('#regErr').textContent='Bu isim alınmış!';return}
    if(users.some(x=>x.email.toLowerCase()===em.toLowerCase())){$('#regErr').textContent='Bu e-posta kayıtlı!';return}
    const nu={id:uid(),username:u,email:em,password:p,createdAt:Date.now(),downloads:0,banned:false};
    users.push(nu);S.sUsers(users);Ses.set({role:'user',userId:nu.id,username:nu.username});showUsr(nu);toast('Kayıt başarılı!','s');
});

function showAdm(){
    $('#authScreen').classList.add('hidden');$('#userPanel').classList.add('hidden');$('#adminPanel').classList.remove('hidden');
    rAdmDash();['loginForm','registerForm'].forEach(f=>$(f?`#${f}`:null)?.reset());$('#loginErr').textContent='';$('#regErr').textContent='';
}
function showUsr(u){
    $('#authScreen').classList.add('hidden');$('#adminPanel').classList.add('hidden');$('#userPanel').classList.remove('hidden');
    $('#uName').textContent=u.username;$('#uNameT').textContent=u.username;$('#uWel').textContent=u.username;
    rUsrHome();$('#loginForm').reset();$('#registerForm').reset();$('#loginErr').textContent='';$('#regErr').textContent='';
}
function logout(){Ses.clear();$('#adminPanel').classList.add('hidden');$('#userPanel').classList.add('hidden');$('#authScreen').classList.remove('hidden');toast('Çıkış yapıldı','i')}
$('#admOut').addEventListener('click',logout);$('#usrOut').addEventListener('click',logout);

function checkSes(){const s=Ses.get();if(!s)return;if(s.role==='admin'){showAdm();return}const u=S.users().find(x=>x.id===s.userId);if(u&&!u.banned)showUsr(u);else Ses.clear()}

// =====================
// THEME
// =====================
function setTheme(t){document.documentElement.setAttribute('data-theme',t);S.sTheme(t);$$('.tb').forEach(b=>b.classList.toggle('active',b.dataset.theme===t))}
$$('.tb').forEach(b=>b.addEventListener('click',()=>{setTheme(b.dataset.theme);toast('Tema değişti','s')}));

// =====================
// ADMIN NAV
// =====================
const aTitles={'a-dash':'Dashboard','a-ch':'Kanallar','a-add':'Kanal Ekle','a-cat':'Kategoriler','a-imp':'M3U İçe Aktar','a-exp':'M3U Dışa Aktar','a-users':'Kullanıcılar','a-set':'Ayarlar'};
function aNav(p){
    $('#admSB').querySelectorAll('.ni').forEach(n=>n.classList.remove('active'));$$('#admCnt .pg').forEach(x=>x.classList.remove('active'));
    $(`#admSB .ni[data-p="${p}"]`)?.classList.add('active');$(`#pg-${p}`)?.classList.add('active');
    $('#admTT').textContent=aTitles[p]||'';$('#admSB').classList.remove('open');
    if(p==='a-dash')rAdmDash();if(p==='a-ch'){rAFilt();rAdmCh()}if(p==='a-add')pAdmAdd();if(p==='a-cat')rAdmCats();if(p==='a-imp')rImpCS();if(p==='a-exp')rAExpF();if(p==='a-users')rUList();
}
$('#admSB').querySelectorAll('.ni').forEach(n=>n.addEventListener('click',e=>{e.preventDefault();aNav(n.dataset.p)}));
$('#admMT').addEventListener('click',()=>$('#admSB').classList.toggle('open'));
$('#admSBX').addEventListener('click',()=>$('#admSB').classList.remove('open'));

// =====================
// USER NAV
// =====================
const uTitles={'u-home':'Ana Sayfa','u-dl':'M3U İndir','u-links':'Linklerim','u-prof':'Profilim'};
function uNav(p){
    $('#usrSB').querySelectorAll('.ni').forEach(n=>n.classList.remove('active'));$$('#userPanel .cnt .pg').forEach(x=>x.classList.remove('active'));
    $(`#usrSB .ni[data-p="${p}"]`)?.classList.add('active');$(`#pg-${p}`)?.classList.add('active');
    $('#usrTT').textContent=uTitles[p]||'';$('#usrSB').classList.remove('open');
    if(p==='u-home')rUsrHome();if(p==='u-dl')rUsrDl();if(p==='u-links')rUsrLinks();if(p==='u-prof')rUsrProf();
}
$('#usrSB').querySelectorAll('.ni').forEach(n=>n.addEventListener('click',e=>{e.preventDefault();uNav(n.dataset.p)}));
$$('.qab').forEach(b=>b.addEventListener('click',()=>{const g=b.dataset.g;if(g?.startsWith('u-'))uNav(g);else if(g?.startsWith('a-'))aNav(g)}));
$('#usrMT').addEventListener('click',()=>$('#usrSB').classList.toggle('open'));
$('#usrSBX').addEventListener('click',()=>$('#usrSB').classList.remove('open'));

// =====================
// ADMIN DASHBOARD
// =====================
function rAdmDash(){
    const ch=S.ch(),cats=S.cats(),users=S.users(),links=S.links();
    const td=links.reduce((s,l)=>s+(l.dlCount||0),0);
    $('#aS1').textContent=ch.length;$('#aS2').textContent=cats.length;$('#aS3').textContent=users.length;$('#aS4').textContent=td;
    const rec=[...ch].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,6);
    $('#aRec').innerHTML=rec.length?rec.map(c=>`<div class="rr"><div class="rl">${esc(c.name).charAt(0)}</div><span class="rn">${esc(c.name)}</span><span class="rc">${esc(c.category||'—')}</span></div>`).join(''):'<p style="color:var(--t3);font-size:11px">Kanal yok.</p>';
    const gc={};ch.forEach(c=>{const g=c.category||'—';gc[g]=(gc[g]||0)+1});const mx=Math.max(...Object.values(gc),1);const cc={};cats.forEach(c=>cc[c.name]=c.color);
    $('#aChart').innerHTML=Object.entries(gc).sort((a,b)=>b[1]-a[1]).map(([n,v])=>`<div class="br"><div class="bl"><span>${esc(n)}</span><span>${v}</span></div><div class="bt"><div class="bf" style="width:${v/mx*100}%;background:${cc[n]||'var(--ac)'}"></div></div></div>`).join('')||'<p style="color:var(--t3);font-size:11px">—</p>';
}

// =====================
// ADMIN CHANNELS
// =====================
let aP=1;const aPP=20;let aSel=new Set();
function cOpts(s=''){return'<option value="">Seçin</option>'+S.cats().map(c=>`<option value="${esc(c.name)}"${c.name===s?' selected':''}>${esc(c.name)}</option>`).join('')}
function fOpts(){return'<option value="">Tümü</option>'+S.cats().map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')}
function rAFilt(){$('#aFCat').innerHTML=fOpts()}

function rAdmCh(){
    const all=S.ch(),sr=($('#aSrch')?.value||'').toLowerCase(),fc=$('#aFCat')?.value||'',fs=$('#aFSt')?.value||'';
    let f=all.filter(c=>(c.name.toLowerCase().includes(sr)||c.url.toLowerCase().includes(sr)||(c.category||'').toLowerCase().includes(sr))&&(!fc||c.category===fc)&&(!fs||c.status===fs));
    f.sort((a,b)=>(a.order||0)-(b.order||0)||a.name.localeCompare(b.name));
    const tp=Math.ceil(f.length/aPP)||1;if(aP>tp)aP=tp;const pg=f.slice((aP-1)*aPP,aP*aPP);
    $('#aChL').innerHTML=pg.length?pg.map(c=>`<div class="cc${c.status==='inactive'?' off':''}"><input type="checkbox" class="ccb" data-id="${c.id}"${aSel.has(c.id)?' checked':''}>${c.logo?`<img src="${esc(c.logo)}" class="cl" onerror="this.outerHTML='<div class=cp>${esc(c.name).charAt(0)}</div>'">`:`<div class="cp">${esc(c.name).charAt(0)}</div>`}<div class="ci"><div class="cn">${esc(c.name)}</div><div class="cm">${c.category?`<span><i class="fas fa-folder"></i>${esc(c.category)}</span>`:''}</div><div class="cu">${esc(c.url)}</div></div><span class="cb ${c.status==='active'?'bon':'boff'}">${c.status==='active'?'Aktif':'Pasif'}</span><div class="ca"><button class="btn sm ol _e" data-id="${c.id}"><i class="fas fa-edit"></i></button><button class="btn sm ol _t" data-id="${c.id}"><i class="fas fa-${c.status==='active'?'toggle-on':'toggle-off'}"></i></button><button class="btn sm dn _d" data-id="${c.id}"><i class="fas fa-trash"></i></button></div></div>`).join(''):'<p style="text-align:center;color:var(--t3);padding:26px">Kanal yok.</p>';
    let ph='';if(tp>1){ph+=`<button${aP===1?' disabled':''} data-p="${aP-1}"><i class="fas fa-chevron-left"></i></button>`;for(let i=1;i<=tp;i++){if(tp<=7||i===1||i===tp||Math.abs(i-aP)<=1)ph+=`<button class="${i===aP?'active':''}" data-p="${i}">${i}</button>`;else if(Math.abs(i-aP)===2)ph+=`<button disabled>…</button>`}ph+=`<button${aP===tp?' disabled':''} data-p="${aP+1}"><i class="fas fa-chevron-right"></i></button>`}
    $('#aPag').innerHTML=ph;bindACh();
}
function bindACh(){
    $$('.ccb').forEach(cb=>cb.addEventListener('change',()=>{cb.checked?aSel.add(cb.dataset.id):aSel.delete(cb.dataset.id)}));
    $$('._e').forEach(b=>b.addEventListener('click',()=>openMod(b.dataset.id)));
    $$('._t').forEach(b=>b.addEventListener('click',()=>{const ch=S.ch(),c=ch.find(x=>x.id===b.dataset.id);if(c){c.status=c.status==='active'?'inactive':'active';S.sCh(ch);rAdmCh();toast(c.status,'s')}}));
    $$('._d').forEach(b=>b.addEventListener('click',()=>{const ch=S.ch(),c=ch.find(x=>x.id===b.dataset.id);if(c&&confirm(`"${c.name}" sil?`)){S.sCh(ch.filter(x=>x.id!==b.dataset.id));aSel.delete(b.dataset.id);rAdmCh();toast('Silindi','s')}}));
    $$('#aPag button:not([disabled])').forEach(b=>b.addEventListener('click',()=>{aP=parseInt(b.dataset.p);rAdmCh()}));
}
$('#aSrch')?.addEventListener('input',()=>{aP=1;rAdmCh()});$('#aFCat')?.addEventListener('change',()=>{aP=1;rAdmCh()});$('#aFSt')?.addEventListener('change',()=>{aP=1;rAdmCh()});
$('#aSelA')?.addEventListener('click',()=>{const ch=S.ch();ch.length===aSel.size?aSel.clear():ch.forEach(c=>aSel.add(c.id));rAdmCh()});
$('#aDelS')?.addEventListener('click',()=>{if(!aSel.size)return toast('Seçim yok','w');if(!confirm(`${aSel.size} kanal silinecek?`))return;S.sCh(S.ch().filter(c=>!aSel.has(c.id)));aSel.clear();rAdmCh();toast('Silindi','s')});

// Add channel
function pAdmAdd(){$('#aChEI').value='';$('#aChF').reset();$('#aChC').innerHTML=cOpts();$('#aChSB').innerHTML='<i class="fas fa-save"></i> Kaydet';$('#aChCB').style.display='none'}
$('#aChF').addEventListener('submit',e=>{
    e.preventDefault();const eI=$('#aChEI').value;
    const d={id:eI||uid(),name:$('#aChN').value.trim(),url:$('#aChU').value.trim(),category:$('#aChC').value,logo:$('#aChL').value.trim(),epgId:$('#aChE').value.trim(),status:$('#aChS').value,order:parseInt($('#aChO').value)||0,updatedAt:Date.now()};
    if(!d.name||!d.url)return toast('Ad ve URL zorunlu','w');
    const ch=S.ch();if(eI){const i=ch.findIndex(c=>c.id===eI);if(i>=0){d.createdAt=ch[i].createdAt;ch[i]=d}toast('Güncellendi','s')}else{d.createdAt=Date.now();ch.push(d);toast('Eklendi','s')}
    S.sCh(ch);pAdmAdd();
});
$('#aChCB').addEventListener('click',pAdmAdd);

// Edit modal
function openMod(id){const ch=S.ch(),c=ch.find(x=>x.id===id);if(!c)return;$('#eI').value=c.id;$('#eN').value=c.name;$('#eU').value=c.url;$('#eC').innerHTML=cOpts(c.category);$('#eL').value=c.logo||'';$('#eE').value=c.epgId||'';$('#eS').value=c.status;$('#eO').value=c.order||0;$('#edMod').classList.remove('hidden')}
function closeMod(){$('#edMod').classList.add('hidden')}
$('#mX').addEventListener('click',closeMod);$('#mCa').addEventListener('click',closeMod);$('.mbg')?.addEventListener('click',closeMod);
$('#edFrm').addEventListener('submit',e=>{e.preventDefault();const id=$('#eI').value,ch=S.ch(),i=ch.findIndex(c=>c.id===id);if(i>=0){ch[i]={...ch[i],name:$('#eN').value.trim(),url:$('#eU').value.trim(),category:$('#eC').value,logo:$('#eL').value.trim(),epgId:$('#eE').value.trim(),status:$('#eS').value,order:parseInt($('#eO').value)||0,updatedAt:Date.now()};S.sCh(ch);closeMod();rAdmCh();toast('Güncellendi','s')}});

// =====================
// ADMIN CATEGORIES
// =====================
function rAdmCats(){
    const cats=S.cats(),ch=S.ch();
    $('#aCatL').innerHTML=cats.length?cats.map(c=>{const n=ch.filter(x=>x.category===c.name).length;return`<div class="ccd"><div class="cci" style="background:${c.color||'var(--ac)'}"><i class="${c.icon||'fas fa-folder'}"></i></div><div class="ccf"><h4>${esc(c.name)}</h4><p>${n} kanal</p></div><div class="cca"><button class="btn sm ol _ce" data-id="${c.id}"><i class="fas fa-edit"></i></button><button class="btn sm dn _cd" data-id="${c.id}"><i class="fas fa-trash"></i></button></div></div>`}).join(''):'<p style="color:var(--t3);padding:18px">Kategori yok.</p>';
    $$('._ce').forEach(b=>b.addEventListener('click',()=>{const c=S.cats().find(x=>x.id===b.dataset.id);if(!c)return;$('#aCatEI').value=c.id;$('#aCatN').value=c.name;$('#aCatIc').value=c.icon||'';$('#aCatCo').value=c.color||'#1da1f2';$('#aCatSB').innerHTML='<i class="fas fa-save"></i>';$('#aCatCB').style.display='inline-flex'}));
    $$('._cd').forEach(b=>b.addEventListener('click',()=>{const cats2=S.cats(),c=cats2.find(x=>x.id===b.dataset.id);if(c&&confirm(`"${c.name}" sil?`)){S.sCats(cats2.filter(x=>x.id!==b.dataset.id));const ch2=S.ch();ch2.forEach(x=>{if(x.category===c.name)x.category=''});S.sCh(ch2);rAdmCats();toast('Silindi','s')}}));
}
$('#aCatF').addEventListener('submit',e=>{
    e.preventDefault();const eI=$('#aCatEI').value,nm=$('#aCatN').value.trim(),ic=$('#aCatIc').value.trim()||'fas fa-folder',co=$('#aCatCo').value;
    if(!nm)return;const cats=S.cats();
    if(eI){const old=cats.find(c=>c.id===eI),oN=old?old.name:'',i=cats.findIndex(c=>c.id===eI);if(i>=0){cats[i]={...cats[i],name:nm,icon:ic,color:co};if(oN!==nm){const ch=S.ch();ch.forEach(x=>{if(x.category===oN)x.category=nm});S.sCh(ch)}}toast('Güncellendi','s')}
    else{if(cats.some(c=>c.name.toLowerCase()===nm.toLowerCase()))return toast('Zaten var','w');cats.push({id:uid(),name:nm,icon:ic,color:co});toast('Eklendi','s')}
    S.sCats(cats);$('#aCatF').reset();$('#aCatEI').value='';$('#aCatSB').innerHTML='<i class="fas fa-plus"></i>';$('#aCatCB').style.display='none';$('#aCatCo').value='#1da1f2';rAdmCats();
});
$('#aCatCB').addEventListener('click',()=>{$('#aCatF').reset();$('#aCatEI').value='';$('#aCatSB').innerHTML='<i class="fas fa-plus"></i>';$('#aCatCB').style.display='none';$('#aCatCo').value='#1da1f2'});
$$('.ih').forEach(h=>h.addEventListener('click',()=>{$('#aCatIc').value=h.dataset.i}));

// =====================
// ADMIN IMPORT
// =====================
function parseM3U(t){const ls=t.split('\n').map(l=>l.trim()).filter(Boolean);const r=[];let cur=null;for(const l of ls){if(l.startsWith('#EXTINF')){cur={};cur.epgId=ga(l,'tvg-id');const tn=ga(l,'tvg-name');cur.logo=ga(l,'tvg-logo');cur.group=ga(l,'group-title');const ci=l.lastIndexOf(',');cur.name=tn||(ci>=0?l.substring(ci+1).trim():'')||'?'}else if(l.startsWith('#'))continue;else if(cur){cur.url=l;r.push({...cur});cur=null}}return r}
function ga(l,a){const m=l.match(new RegExp(`${a}="([^"]*)"`, 'i'));return m?m[1]:''}

$$('.itab').forEach(t=>t.addEventListener('click',()=>{$$('.itab').forEach(x=>x.classList.remove('active'));$$('.itc').forEach(x=>x.classList.remove('active'));t.classList.add('active');$(`#iT-${t.dataset.t}`).classList.add('active')}));
function rImpCS(){$('#iCatS').innerHTML='<option value="">Orijinal grubu kullan</option>'+S.cats().map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')}

const dz=$('#dz');
dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('over')});dz.addEventListener('dragleave',()=>dz.classList.remove('over'));
dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('over');if(e.dataTransfer.files[0])rdF(e.dataTransfer.files[0])});
$('#m3uF').addEventListener('change',e=>{if(e.target.files[0])rdF(e.target.files[0])});
function rdF(f){const r=new FileReader();r.onload=e=>shPV(parseM3U(e.target.result));r.readAsText(f)}
$('#iPTB').addEventListener('click',()=>{const t=$('#m3uT').value.trim();if(!t)return toast('Boş','w');shPV(parseM3U(t))});
$('#iFUB').addEventListener('click',async()=>{const u=$('#m3uU').value.trim();if(!u)return toast('URL yok','w');try{const r=await fetch(u);shPV(parseM3U(await r.text()))}catch(e){toast('Hata','e')}});

let pvArr=[];
function shPV(list){pvArr=list;if(!list.length){toast('Kanal yok','w');$('#iPV').classList.add('hidden');return}$('#iPV').classList.remove('hidden');$('#pvC').textContent=list.length;$('#pvL').innerHTML=list.map((c,i)=>`<div class="pvi"><input type="checkbox" checked data-i="${i}" class="pvc"><span class="pvn">${esc(c.name)}</span>${c.group?`<span class="pvg">${esc(c.group)}</span>`:''}</div>`).join('');toast(`${list.length} kanal`,'s')}
$('#pvSA').addEventListener('click',()=>$$('.pvc').forEach(c=>c.checked=true));
$('#pvDA').addEventListener('click',()=>$$('.pvc').forEach(c=>c.checked=false));
$('#pvIB').addEventListener('click',()=>{
    const idxs=[];$$('.pvc').forEach(cb=>{if(cb.checked)idxs.push(parseInt(cb.dataset.i))});if(!idxs.length)return toast('Seçim yok','w');
    const ov=$('#iCatS').value,ch=S.ch(),cats=S.cats(),cn=new Set(cats.map(c=>c.name.toLowerCase()));let n=0;
    idxs.forEach(i=>{const c=pvArr[i];if(!c)return;const cat=ov||c.group||'';if(cat&&!cn.has(cat.toLowerCase())){cats.push({id:uid(),name:cat,icon:'fas fa-folder',color:'#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0')});cn.add(cat.toLowerCase())}ch.push({id:uid(),name:c.name,url:c.url,category:cat,logo:c.logo||'',epgId:c.epgId||'',status:'active',order:0,createdAt:Date.now(),updatedAt:Date.now()});n++});
    S.sCh(ch);S.sCats(cats);$('#iPV').classList.add('hidden');pvArr=[];toast(`${n} kanal eklendi!`,'s');
});

// =====================
// ADMIN EXPORT
// =====================
function rAExpF(){$('#aEC').innerHTML=fOpts()}
$('#aGM').addEventListener('click',()=>{const ch=S.ch(),fc=$('#aEC').value,fs=$('#aES').value;let l=ch.filter(c=>(!fc||c.category===fc)&&(!fs||c.status===fs));l.sort((a,b)=>(a.order||0)-(b.order||0)||a.name.localeCompare(b.name));let m='#EXTM3U\n';l.forEach(c=>{let e='#EXTINF:-1';if(c.epgId)e+=` tvg-id="${c.epgId}"`;e+=` tvg-name="${c.name}"`;if(c.logo)e+=` tvg-logo="${c.logo}"`;if(c.category)e+=` group-title="${c.category}"`;e+=`,${c.name}`;m+=e+'\n'+c.url+'\n'});$('#aMO').value=m;$('#aDM').classList.remove('hidden');$('#aCM').classList.remove('hidden');toast(`${l.length} kanal`,'s')});
$('#aDM').addEventListener('click',()=>dlFile($('#aMO').value,'admin-playlist.m3u'));
$('#aCM').addEventListener('click',()=>cpText($('#aMO').value));

// =====================
// ADMIN USERS
// =====================
function rUList(){
    const users=S.users(),links=S.links(),q=($('#uSrch')?.value||'').toLowerCase();
    const f=users.filter(u=>u.username.toLowerCase().includes(q)||u.email.toLowerCase().includes(q));
    $('#uList').innerHTML=f.length?f.map(u=>{const ul=links.filter(l=>l.userId===u.id);const td=ul.reduce((s,l)=>s+(l.dlCount||0),0);
    return`<div class="uc${u.banned?' off':''}"><div class="uav">${u.username.charAt(0).toUpperCase()}</div><div class="ui"><h4>${esc(u.username)}</h4><p>${esc(u.email)} · ${fdt(u.createdAt)}</p></div><div class="us"><span><i class="fas fa-link"></i>${ul.length}</span><span><i class="fas fa-download"></i>${td}</span></div><div class="ua"><button class="btn sm ${u.banned?'su':'ol'} _ub" data-id="${u.id}"><i class="fas fa-${u.banned?'unlock':'ban'}"></i></button><button class="btn sm dn _ud" data-id="${u.id}"><i class="fas fa-trash"></i></button></div></div>`}).join(''):'<p style="color:var(--t3);padding:18px">Kullanıcı yok.</p>';
    $$('._ub').forEach(b=>b.addEventListener('click',()=>{const u2=S.users(),u=u2.find(x=>x.id===b.dataset.id);if(u){u.banned=!u.banned;S.sUsers(u2);rUList();toast(u.banned?'Engellendi':'Engel kaldırıldı','s')}}));
    $$('._ud').forEach(b=>b.addEventListener('click',()=>{if(!confirm('Sil?'))return;S.sUsers(S.users().filter(x=>x.id!==b.dataset.id));S.sLinks(S.links().filter(x=>x.userId!==b.dataset.id));rUList();toast('Silindi','s')}));
}
$('#uSrch')?.addEventListener('input',rUList);

// =====================
// ADMIN SETTINGS
// =====================
$('#aPF').addEventListener('submit',e=>{e.preventDefault();const a=S.admin();if($('#aCP').value!==a.password)return toast('Hatalı','e');const np=$('#aNP').value;if(np.length<4)return toast('Min 4','w');a.password=np;S.sAdmin(a);$('#aPF').reset();toast('Güncellendi','s')});
$('#aBK').addEventListener('click',()=>{const d={ch:S.ch(),cats:S.cats(),users:S.users(),links:S.links(),admin:S.admin(),theme:S.theme(),date:new Date().toISOString()};dlFile(JSON.stringify(d,null,2),`backup-${new Date().toISOString().slice(0,10)}.json`,'application/json');toast('İndirildi','s')});
$('#aRS').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(!confirm('Üzerine yaz?'))return;if(d.ch)S.sCh(d.ch);if(d.cats)S.sCats(d.cats);if(d.users)S.sUsers(d.users);if(d.links)S.sLinks(d.links);if(d.admin)S.sAdmin(d.admin);if(d.theme)setTheme(d.theme);rAdmDash();toast('Yüklendi!','s')}catch(er){toast('Hata','e')}};r.readAsText(f);e.target.value=''});
$('#aCA').addEventListener('click',()=>{if(!confirm('TÜM VERİLER silinecek!'))return;['iv_c','iv_k','iv_u','iv_l'].forEach(k=>localStorage.removeItem(k));rAdmDash();toast('Silindi','s')});

// =====================
// USER HOME
// =====================
function getCU(){const s=Ses.get();if(!s||s.role!=='user')return null;return S.users().find(u=>u.id===s.userId)||null}
function rUsrHome(){
    const u=getCU();if(!u)return;const cats=S.cats(),ch=S.ch().filter(c=>c.status==='active'),ml=S.links().filter(l=>l.userId===u.id),md=ml.reduce((s,l)=>s+(l.dlCount||0),0);
    $('#uH1').textContent=cats.length;$('#uH2').textContent=ch.length;$('#uH3').textContent=md;$('#uH4').textContent=ml.length;
}

// =====================
// USER DOWNLOAD - THE KEY PART
// =====================
function rUsrDl(){
    const cats=S.cats(),ch=S.ch().filter(c=>c.status==='active');
    $('#uCatSel').innerHTML=cats.length?cats.map(c=>{const n=ch.filter(x=>x.category===c.name).length;return`<div class="csc" data-cat="${esc(c.name)}"><div class="csci" style="background:${c.color||'var(--ac)'}"><i class="${c.icon||'fas fa-folder'}"></i></div><div class="cscf"><h4>${esc(c.name)}</h4><p>${n} kanal</p></div><div class="csck"><i class="fas fa-check"></i></div></div>`}).join(''):'<p style="color:var(--t3)">Kategori yok.</p>';
    $$('.csc').forEach(c=>c.addEventListener('click',()=>c.classList.toggle('sel')));
    $('#uPV').classList.add('hidden');$('#uDL').classList.add('hidden');$('#uCpL').classList.add('hidden');
}

$('#uGen').addEventListener('click',()=>{
    const u=getCU();if(!u)return toast('Oturum hatası','e');
    const selCats=[];$$('.csc.sel').forEach(c=>selCats.push(c.dataset.cat));
    if(!selCats.length)return toast('Kategori seçin','w');
    
    const ch=S.ch().filter(c=>c.status==='active'&&selCats.includes(c.category));
    ch.sort((a,b)=>(a.order||0)-(b.order||0)||a.name.localeCompare(b.name));
    if(!ch.length)return toast('Kanal yok','w');

    const token=uid();
    
    // Build M3U content
    let m3u='#EXTM3U\n';
    ch.forEach(c=>{
        let e='#EXTINF:-1';
        if(c.epgId)e+=` tvg-id="${c.epgId}"`;
        e+=` tvg-name="${c.name}"`;
        if(c.logo)e+=` tvg-logo="${c.logo}"`;
        if(c.category)e+=` group-title="${c.category}"`;
        e+=`,${c.name}`;
        m3u+=e+'\n'+c.url+'\n';
    });

    // Save link with M3U content
    const links=S.links();
    links.push({
        id:uid(),
        userId:u.id,
        username:u.username,
        token:token,
        categories:selCats,
        channelCount:ch.length,
        m3uContent:m3u,
        createdAt:Date.now(),
        dlCount:0
    });
    S.sLinks(links);

    // Update user downloads
    const users=S.users();const ui=users.findIndex(x=>x.id===u.id);
    if(ui>=0){users[ui].downloads=(users[ui].downloads||0)+1;S.sUsers(users)}

    // Generate the proper link that serves M3U directly
    const m3uLink = generateM3ULink(token);
    const webLink = generateWebLink(token);
    
    $('#uLO').value=m3uLink;
    $('#uMO').value=m3u;
    $('#uPV').classList.remove('hidden');$('#uDL').classList.remove('hidden');$('#uCpL').classList.remove('hidden');
    $('#uES').innerHTML=`<span><i class="fas fa-tv"></i> ${ch.length} kanal</span><span><i class="fas fa-folder"></i> ${selCats.length} kategori</span><span><i class="fas fa-file"></i> ${(new Blob([m3u]).size/1024).toFixed(1)} KB</span><span><i class="fas fa-fingerprint"></i> ${token.substring(0,8)}</span>`;
    toast(`${ch.length} kanallık M3U oluşturuldu!`,'s');
});

$('#uDL').addEventListener('click',()=>{
    const m3u=$('#uMO').value;if(!m3u)return;
    dlFile(m3u,($('#uFN').value.trim()||'my-playlist')+'.m3u');
    const s=Ses.get();if(s){const links=S.links();const last=[...links].filter(l=>l.userId===s.userId).pop();if(last){last.dlCount=(last.dlCount||0)+1;S.sLinks(links)}}
    toast('İndirildi!','s');
});

$('#uCpL').addEventListener('click',()=>cpText($('#uLO').value));
$('#uCpLB').addEventListener('click',()=>cpText($('#uLO').value));

// =====================
// USER LINKS
// =====================
function rUsrLinks(){
    const u=getCU();if(!u)return;
    const links=S.links().filter(l=>l.userId===u.id).sort((a,b)=>b.createdAt-a.createdAt);
    const cats=S.cats();const cc={};cats.forEach(c=>cc[c.name]=c.color);

    $('#uLL').innerHTML=links.length?links.map(l=>{
        const m3uLink = generateM3ULink(l.token);
        return`<div class="lc">
            <div class="lct"><h4><i class="fas fa-link"></i> Playlist #${l.token.substring(0,6)}</h4><span class="lcd">${fdt(l.createdAt)}</span></div>
            <div class="lcc">${(l.categories||[]).map(c=>`<span class="lcg" style="background:${cc[c]||'var(--ac)'}">${esc(c)}</span>`).join('')}</div>
            <div class="lcs"><span><i class="fas fa-tv"></i> ${l.channelCount} kanal</span><span><i class="fas fa-download"></i> ${l.dlCount||0} indirme</span><span><i class="fas fa-file"></i> ${(new Blob([l.m3uContent||'']).size/1024).toFixed(1)} KB</span></div>
            <div class="lcl"><input type="text" value="${esc(m3uLink)}" readonly><button class="btn sm pr _lc" data-url="${esc(m3uLink)}"><i class="fas fa-copy"></i></button></div>
            <div class="lca">
                <button class="btn sm su _ld" data-id="${l.id}"><i class="fas fa-download"></i> İndir</button>
                <button class="btn sm dn _lr" data-id="${l.id}"><i class="fas fa-trash"></i> Sil</button>
            </div></div>`}).join(''):'<p style="color:var(--t3);padding:18px">Henüz link yok.</p>';

    $$('._lc').forEach(b=>b.addEventListener('click',()=>cpText(b.dataset.url)));
    $$('._ld').forEach(b=>b.addEventListener('click',()=>{const l=S.links().find(x=>x.id===b.dataset.id);if(l){dlFile(l.m3uContent,`playlist-${l.token.substring(0,6)}.m3u`);l.dlCount=(l.dlCount||0)+1;S.sLinks(S.links().map(x=>x.id===l.id?l:x));rUsrLinks();toast('İndirildi','s')}}));
    $$('._lr').forEach(b=>b.addEventListener('click',()=>{if(!confirm('Sil?'))return;S.sLinks(S.links().filter(x=>x.id!==b.dataset.id));rUsrLinks();toast('Silindi','s')}));
}

// =====================
// USER PROFILE
// =====================
function rUsrProf(){const u=getCU();if(!u)return;$('#uPN').value=u.username;$('#uPE').value=u.email;$('#uPD').value=fdt(u.createdAt)}
$('#uPF').addEventListener('submit',e=>{
    e.preventDefault();const u=getCU();if(!u)return;
    if($('#uCP').value!==u.password)return toast('Hatalı','e');
    const np=$('#uNP').value,np2=$('#uNP2').value;
    if(np!==np2)return toast('Eşleşmiyor','e');if(np.length<4)return toast('Min 4','w');
    const users=S.users(),i=users.findIndex(x=>x.id===u.id);if(i>=0){users[i].password=np;S.sUsers(users)}
    $('#uPF').reset();toast('Güncellendi','s');
});

// =====================
// HELPERS
// =====================
function dlFile(content,filename,type='application/x-mpegURL'){const b=new Blob([content],{type});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=filename;a.click();URL.revokeObjectURL(u)}
function cpText(t){navigator.clipboard.writeText(t).then(()=>toast('Kopyalandı!','s')).catch(()=>{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Kopyalandı!','s')})}

// =====================
// INIT
// =====================
setTheme(S.theme());

// First check if this is an M3U serve request
if(!checkM3UServe()){
    // Normal app load
    checkSes();
}

})();
