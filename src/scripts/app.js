const STAT=['New','Interested','Hold','Not Interested','Converted'];
const ACTIONS=['Send pricing','Schedule demo','Share server access','Payment follow-up','Paid','Refund','Send course videos','Call'];
const SOURCES=['Srinivas','Praveen','Aditi','Pooja'];
const normPhone=v=>{const s=String(v??'').trim().replace(/[\s\-().]/g,'');return /^\+?\d{6,15}$/.test(s)?s:'0'};
let leads=[],db=null,tab='Active',seq=0;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const iso=d=>d.toLocaleDateString('en-CA');
const mailLink=e=>e?`<a href="https://mail.google.com/mail/?view=cm&amp;fs=1&amp;to=${encodeURIComponent(e)}" target="_blank" rel="noopener noreferrer" title="Write in Gmail" style="color:#0a4d8c;font-weight:600;text-decoration:none">${esc(e)}</a>`:'';
const today=()=>iso(new Date());
const addDays=n=>{const d=new Date();d.setDate(d.getDate()+n);return iso(d)};
const isClosed=l=>l.status==='Not Interested'||l.status==='Converted';
const isDue=l=>!isClosed(l)&&l.nextDate&&l.nextDate<=today();

async function save(id,patch){
  patch.updated=today();
  if(db){try{await db.doc('leads/'+id).update(patch)}catch(e){$('#note').textContent='Could not save: '+(e.message||e.code)}}
  else{const l=leads.find(x=>x.id===id);Object.assign(l,patch);render()}
}
async function create(d){
  const rec={name:'',email:'',phone:'0',date:today(),module:'Not Specified',source:'',status:'New',nextAction:'',nextDate:'',followups:0,notes:'',closedAt:'',created:today(),updated:today(),...d};rec.phone=normPhone(rec.phone);if(!rec.date)rec.date=today();rec.leadNo=nextLeadNo();if(NOTIFY.emailNew)rec.notifyPending=true;
  if(db){try{await db.collection('leads').add(rec)}catch(e){$('#note').textContent='Could not save: '+(e.message||e.code)}}
  else{rec.id='l'+(++seq);leads.push(rec);render()}
}
async function remove(id){
  if(!isAdmin())return;
  const from=/^payments/.test((location.hash||'').slice(1))?'payments':'leads';
  await save(id,{deleted:true,deletedAt:today(),deletedFrom:from});
}
function setStatus(id,s){
  const l=leads.find(x=>x.id===id),p={status:s};
  if(s==='Interested'){p.nextAction=l.nextAction||ACTIONS[0];p.nextDate=l.nextDate||addDays(1);p.closedAt=''}
  else if(s==='Hold'){p.nextAction='Follow up';p.nextDate=addDays(7);p.followups=(l.followups||0)+1;p.closedAt=''}
  else if(s==='Not Interested'||s==='Converted'){p.nextAction='';p.nextDate='';p.closedAt=today()}
  else{p.closedAt=''}
  save(id,p);
}

function render(){
  const hk=(location.hash||'').slice(1);if(getView(hk))renderView(hk);render90();renderSources();renderPtabs();renderCharts();$('#ln').value=$('#pln').value=fmtNo(curMax()+1);
  const c=s=>leads.filter(l=>l.status===s).length;
  const due=leads.filter(isDue).length,tot=leads.length;
  const rate=tot?Math.round(c('Converted')/tot*100):0;
  $('#stats').innerHTML=[['Total leads',tot,'all'],['Interested',c('Interested'),'interested'],['Not Interested',c('Not Interested'),'not-interested'],['On hold',c('Hold'),'hold'],['Due today',due,'due'],['Closed',c('Not Interested')+c('Converted'),'closed'],['Payment',c('Converted'),'converted']].map(([k,v,h])=>`<a class="stat k-${h}" href="#${h}"><b>${v}</b><span>${k}</span></a>`).join('');
  const col={New:'var(--gy)',Interested:'var(--gr)',Hold:'var(--ye)','Not Interested':'var(--rd)',Converted:'var(--ac)'};
  $('#bar').innerHTML=tot?STAT.map(s=>`<i title="${s==='Converted'?'Payment':s}" style="width:${c(s)/tot*100}%;background:${col[s]}"></i>`).join(''):'';
  const c2=s=>leads.filter(l=>l.status===s).length;
  const tabs=[['Active','Active','leads'],['Interested','Interested ('+c2('Interested')+')','leads-interested'],['Hold','Hold ('+c2('Hold')+')','leads-hold'],['NotInterested','Not Interested ('+c2('Not Interested')+')','leads-not-interested'],['Due','Due Today ('+due+')','leads-due'],['Closed','Closed','leads-closed'],['All','All','leads-all']].concat([['Deleted','Deleted Items ('+ALLLEADS.filter(l=>l.deleted&&l.deletedFrom!=='payments').length+')','leads-deleted']]);
  $('#tabs').innerHTML=tabs.map(([k,t,h])=>`<a class="${tab===k?'on':''}" href="#${h}">${t}</a>`).join('');
  const q=$('#q').value.toLowerCase();
  let list=(tab==='Deleted'?ALLLEADS.filter(l=>l.deleted&&l.deletedFrom!=='payments'):leads).filter(l=>tab==='Deleted'||tab==='All'||(tab==='Active'&&!isClosed(l))||(tab==='Interested'&&l.status==='Interested')||(tab==='Hold'&&l.status==='Hold')||(tab==='NotInterested'&&l.status==='Not Interested')||(tab==='Due'&&isDue(l))||(tab==='Closed'&&isClosed(l)));
  list=list.filter(l=>!q||(l.leadNo+' '+l.name+' '+l.email+' '+(l.phone||'')+' '+(l.source||'')).toLowerCase().includes(q));
  list.sort((a,b)=>(a.nextDate||'9999').localeCompare(b.nextDate||'9999')||(b.updated||'').localeCompare(a.updated||''));
  CURLEADS=list;
  $('#lhead').textContent='Leads: '+({Active:'Active',Interested:'Interested',Hold:'Hold',NotInterested:'Not Interested',Due:'Due Today',Closed:'Closed',All:'All',Deleted:'Deleted Items'}[tab]||tab)+' ('+list.length+')'+($('#q').value.trim()?' · search: “'+$('#q').value.trim()+'”':'');
  const pages=Math.max(1,Math.ceil(list.length/PS));pgL=Math.min(pgL,pages);const shown=list.slice((pgL-1)*PS,pgL*PS);$('#lfoot').innerHTML=$('#ltop').innerHTML=pagerHtml('L',list.length,pgL,pages);
  $('#rows').innerHTML=shown.length?shown.map(l=>{
    const opts=STAT.map(s=>`<option value="${s}" ${s===l.status?'selected':''}>${s==='Converted'?'Payment':s}</option>`).join('');
    let step='',fdate='<small>-</small>';
    if(l.status==='Interested'||l.status==='Hold'){
      step=`<select data-f="nextAction" data-id="${l.id}">${[...new Set([l.nextAction,...ACTIONS,'Follow up'].filter(Boolean))].map(a=>`<option ${a===l.nextAction?'selected':''}>${esc(a)}</option>`).join('')}</select>`;fdate=`<input type="date" data-f="nextDate" data-id="${l.id}" value="${esc(l.nextDate)}" class="${isDue(l)?'due':''}" style="font-size:13px;padding:3px 6px">`;
    }else if(l.status==='Not Interested'){
      step='Closed '+esc(l.closedAt);
    }else if(l.status==='Converted'){step='Paid '+esc(l.closedAt)+'<br><select data-f="nextAction" data-id="'+l.id+'"><option value="">Paid</option><option'+(l.nextAction==='Refund'?' selected':'')+'>Refund</option></select>'}
    else step='<small>Set a status to continue</small>';
    return `<tr class="st-${l.status.replace(' ','-')}${l.deleted?' dl':''}"><td class="lno"><b>${esc(l.leadNo||'')}</b></td><td>${esc(l.date||l.created||'')}</td><td class="pill s-${l.status.replace(' ','-')}"><b>${esc(l.name)||'(no name)'}</b></td><td>${mailLink(l.email)}</td><td>${esc(l.phone??'0')}</td><td><select data-f="source" data-id="${l.id}" title="Source" style="font-size:13px;padding:3px 6px"><option value="">Source…</option>${SOURCES.map(s=>`<option ${s===l.source?'selected':''}>${s}</option>`).join('')}</select></td><td>${esc(l.module)}</td>
    <td>${step}</td><td>${fdate}</td>
    <td>${l.followups||0}</td><td><select data-st="1" data-id="${l.id}">${opts}</select></td>
    <td><textarea data-f="notes" data-id="${l.id}" rows="2" readonly title="Notes are locked. Click the pencil to edit." style="min-height:0;width:100%;min-width:110px">${esc(l.notes)}</textarea></td>
    <td style="white-space:nowrap"><button class="al" data-act="${l.id}" data-akind="lead" title="Activity log" aria-label="Activity log">${ALOG}</button>${l.deleted?`<button class="rs" data-restore="${l.id}" title="Restore" aria-label="Restore">\u21ba</button>`:`<button class="wa" data-wa="${l.id}" title="WhatsApp" aria-label="WhatsApp">${WAICON}</button><button data-edit="${l.id}" title="Edit lead" aria-label="Edit lead"><span style="display:inline-block;transform:scaleX(-1)">✎</span></button> <button class="x" data-del="${l.id}" title="Delete">✕</button>`}</td></tr>`}).join(''):`<tr><td colspan="13" class="empty">No leads in this view yet. Add a lead above or import a file.</td></tr>`;
}

document.addEventListener('change',e=>{
  const t=e.target,id=t.dataset.id;
  if(t.dataset.st)setStatus(id,t.value);
  else if(t.dataset.pst)setPayStatus(id,t.value);
  else if(t.dataset.f){const f=t.dataset.f;let v=t.value;
    if((f==='tenure'&&v&&!TENURES.includes(v))||(f==='payType'&&v&&!PTYPES.includes(v))||(f==='payMode'&&v&&!PAYMODES.includes(v))){t.value='';return}
    if(f==='phone'){return}
    const patch={};
    if(t.dataset.num){v=cleanNum(v);t.value=v;if(f==='billRate'||f==='payRate'){const l0=leads.find(x=>x.id===id)||{},b=f==='billRate'?v:l0.billRate,p2=f==='payRate'?v:l0.payRate;patch.totalAmount=fmtM((parseFloat(b)||0)+(parseFloat(p2)||0))}}
    patch[f]=v;save(id,patch)}
});
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-edit],[data-del],[data-t],[data-act]')||e.target;
  if(t.dataset.t){tab=t.dataset.t;render()}
  if(t.dataset.del){const r=ALLLEADS.find(x=>x.id===t.dataset.del);if(r&&isAdmin())askReason('lead',r,'delete',()=>remove(r.id))}
  if(t.dataset.edit){const r=leads.find(x=>x.id===t.dataset.edit);if(r)askReason('lead',r,'edit',()=>openEdit(r.id))}
  if(t.dataset.act)openAct(t.dataset.akind||'lead',t.dataset.act);
});
$('#q').addEventListener('input',()=>{pgL=1;render()});
$('#add').onclick=()=>{
  const name=$('#n').value.trim(),email=$('#e').value.trim();
  const lerr=t=>{const m=$('#impmsg');m.style.color='#c0392b';m.textContent=t};
  if(!name&&!email){lerr('Enter a name or an email.');return}
  if(!SOURCES.includes($('#src').value)){lerr('Select a source.');return}
  if(!MODS.includes($('#m').value)){lerr('Select a category.');return}
  {const dm=dupMsg(email,$('#ph').value);if(dm){lerr(dm);return}}
  $('#impmsg').textContent='';
  create({name,email,phone:$('#ph').value,date:$('#dt').value||today(),source:$('#src').value,module:$('#m').value});$('#n').value='';$('#e').value='';$('#ph').value='';$('#src').value='';$('#m').value='';shut($('#addtog'),$('#lbar'));
};
$('#imp').onclick=()=>$('#file').click();
const MODS=['Server Access','Course Videos','Server + Videos','Not Specified'];let editId=null;
function openEdit(id){const l=leads.find(x=>x.id===id);if(!l)return;editId=id;
$('#en').value=l.name||'';$('#ee').value=l.email||'';$('#ep').value=l.phone??'0';$('#enotes').value=l.notes||'';$('#emsg').textContent='';$('#ed').value=l.date||l.created||today();
$('#em').innerHTML='<option value="">Select</option>'+[...new Set([...MODS,l.module].filter(Boolean))].map(m=>`<option ${m===l.module?'selected':''}>${esc(m)}</option>`).join('');
$('#es').innerHTML='<option value="">Select</option>'+SOURCES.map(s=>`<option ${s===l.source?'selected':''}>${s}</option>`).join('');
const ip=/^payments/.test((location.hash||'').slice(1));$('#epay').hidden=!ip;
if(ip){$('#eps').value=payStatus(l);$('#epd').value=l.paidDate||'';$('#epm').value=l.payMode||'';$('#etn').value=l.tenure||'';$('#ept').value=l.payType||'';$('#ebr').value=l.billRate||'';$('#epr').value=l.payRate||'';$('#emg').value=fmtM(marginOf(l));$('#eta').value=fmtM(totalOf(l))}
$('#edlg').showModal()}
$('#ecancel').onclick=()=>$('#edlg').close();
const LTABS={leads:'Active','leads-interested':'Interested','leads-hold':'Hold','leads-not-interested':'NotInterested','leads-due':'Due','leads-closed':'Closed','leads-all':'All','leads-deleted':'Deleted'};
const pPaid=l=>(l.status==='Converted'&&l.nextAction!=='Refund')||l.nextAction==='Paid';
const pRef=l=>l.nextAction==='Refund';
const pFu=l=>['Send pricing','Payment follow-up'].includes(l.nextAction)&&!isClosed(l);
function renderPtabs(){
  const k=(location.hash||'').slice(1),isPay=/^payments(-paid|-followup|-refund|-deleted)?$/.test(k);
  $('#ptabs').hidden=!isPay;$('#pexp').hidden=!isPay;$('#pbar').hidden=!isPay;if(!isPay)return;
  const f=k==='payments-followup',r=k==='payments-refund',d=k==='payments-deleted';
  $('#ptabs').innerHTML='<a class="'+(f||r||d?'':'on')+'" href="#payments-paid">Paid ('+leads.filter(pPaid).length+')</a><a class="'+(f?'on':'')+'" href="#payments-followup">Payment Follow-up ('+leads.filter(pFu).length+')</a><a class="'+(r?'on':'')+'" href="#payments-refund">Refund ('+leads.filter(pRef).length+')</a><a class="'+(d?'on':'')+'" href="#payments-deleted">Deleted Items ('+ALLLEADS.filter(l=>l.deleted&&l.deletedFrom==='payments').length+')</a>';
}
const VIEWS={new:['New leads',l=>l.status==='New'],all:['All leads',()=>true],interested:['Interested leads',l=>l.status==='Interested'],hold:['Leads on hold',l=>l.status==='Hold'],due:['Follow-ups due today',isDue],closed:['Closed leads',isClosed],'not-interested':['Not interested leads',l=>l.status==='Not Interested'],payments:['Payments: Paid',pPaid],'payments-paid':['Payments: Paid',pPaid],'payments-followup':['Payments: Payment Follow-up',pFu],'payments-refund':['Payments: Refund',pRef],'payments-deleted':['Payments: Deleted Items',()=>true],converted:['Payment leads',l=>l.status==='Converted']};
const monthLabel=k=>{const p=k.split('-');return new Date(+p[0],+p[1]-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'})};
function getView(k){
  if(VIEWS[k])return VIEWS[k];
  const m=/^(d90|m-\d{4}-\d{2}|s-[a-z0-9]+)-(all|interested|not-interested|hold|payment)$/.exec(k);
  if(!m)return null;
  const sc=m[1],cat=m[2],t=today();
  const stat={interested:'Interested','not-interested':'Not Interested',hold:'Hold',payment:'Converted'}[cat];
  const dt=l=>(l.date||l.created||'');
  let pred,label;
  if(sc==='d90'){const s=new Date();s.setDate(s.getDate()-90);const start=iso(s);pred=l=>dt(l)>=start&&dt(l)<=t;label='Last 90 days'}
  else if(sc[0]==='m'){const key=sc.slice(2);pred=l=>dt(l).slice(0,7)===key&&dt(l)<=t;label=monthLabel(key)}
  else{const src=SOURCES.find(s=>sl(s)===sc.slice(2));if(!src)return null;pred=l=>(l.source||'')===src;label=src}
  const cl={all:'All leads',interested:'Interested','not-interested':'Not Interested',hold:'On Hold',payment:'Payment'}[cat];
  return [label+': '+cl,l=>pred(l)&&(!stat||l.status===stat)];
}
function renderView(k){const [t,f]=getView(k);const sq=/^payments/.test(k)?$('#pq').value.toLowerCase().trim():'';const base=k==='payments-deleted'?ALLLEADS.filter(l=>l.deleted&&l.deletedFrom==='payments'):leads;const list=base.filter(f).filter(l=>!sq||[l.leadNo,l.name,l.email,l.phone,l.source].join(' ').toLowerCase().includes(sq)).sort((a,b)=>(b.updated||'').localeCompare(a.updated||''));
CURVIEW=list;
$('#vt').textContent=t+' ('+list.length+')';
const pages=Math.max(1,Math.ceil(list.length/PS));pgV=Math.min(pgV,pages);const shown=list.slice((pgV-1)*PS,pgV*PS);$('#vfoot').innerHTML=$('#vtop').innerHTML=pagerHtml('V',list.length,pgV,pages);
if(VHEAD0===null)VHEAD0=$('#vhead').innerHTML;
const isPR=/^payments/.test(k);$('#vhead').innerHTML=isPR?PHEAD:VHEAD0;
if(isPR){$('#vrows').innerHTML=shown.length?shown.map(payRow).join(''):'<tr><td colspan="17" class="empty">No leads in this view yet.</td></tr>';return}
$('#vrows').innerHTML=shown.length?shown.map(l=>`<tr class="st-${l.status.replace(' ','-')}"><td class="lno"><b>${esc(l.leadNo||'')}</b></td><td>${esc(l.date||l.created||'')}</td><td class="pill s-${l.status.replace(' ','-')}"><b>${esc(l.name)||'(no name)'}</b></td><td>${mailLink(l.email)}</td><td>${esc(l.phone??'0')}</td><td>${esc(l.source)}</td><td>${esc(l.module)}</td><td>${esc(l.status==='Converted'?'Payment':l.status)}</td><td>${esc([l.nextAction,l.nextDate].filter(Boolean).join(' · '))}</td><td>${l.followups||0}</td><td>${esc(l.notes)}</td><td>${esc(l.updated)}</td><td><button data-edit="${l.id}" title="Edit lead" aria-label="Edit lead"><span style="display:inline-block;transform:scaleX(-1)">✎</span></button></td></tr>`).join(''):'<tr><td colspan="13" class="empty">No leads in this list yet.</td></tr>'}
function route(){
  const k=(location.hash||'').slice(1),v=getView(k);
  if(LTABS[k]&&tab!==LTABS[k]){tab=LTABS[k];pgL=1;render()}
  const pg=v?'view':(LTABS[k]?'leads':(UT[k]?'users':'home'));document.body.classList.toggle('fit',pg==='home');
  $('#home').hidden=pg!=='home';$('#leadsPage').hidden=pg!=='leads';$('#usersPage').hidden=pg!=='users';$('#view').hidden=pg!=='view';
  if(UT[k]){utab=UT[k];pgU=1;renderUsers()}
  if(k!==lastK){pgV=1;lastK=k}if(v)renderView(k);
  const isPay=/^payments(-paid|-followup|-refund|-deleted)?$/.test(k);renderPtabs();
  if(isPay&&k!==lastPk){lastPk=k;$('#pst').value=''}
  const act=LTABS[k]?'leads':(isPay?'payments':(UT[k]?'users':'home'));
  document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.p===act));
  window.scrollTo(0,0)}
window.addEventListener('hashchange',route);
const fmtNo=n=>'L-'+String(n).padStart(4,'0');
const numOf=l=>parseInt(String(l.leadNo||'').replace(/\D/g,''),10)||0;
let issued=0,bf=false;
const curMax=()=>Math.max(issued,0,...ALLLEADS.map(numOf),...leads.map(numOf));
function nextLeadNo(){issued=curMax()+1;return fmtNo(issued)}
function backfill(){
  const miss=leads.filter(l=>!l.leadNo);
  if(!miss.length||bf||!db)return;bf=true;let n=curMax();
  miss.sort((a,b)=>(a.created||'').localeCompare(b.created||'')||a.id.localeCompare(b.id));
  miss.forEach(l=>{n++;l.leadNo=fmtNo(n);db.doc('leads/'+l.id).update({leadNo:l.leadNo}).catch(()=>{})});
  issued=n;
}
function bar3d(items,total){
  const W=380,H=250,L=14,R=14,T=30,B=34,dx=14,dy=9,n=items.length||1;
  const mx=Math.max(1,...items.map(i=>i.v)),cw=(W-L-R)/n,bw=Math.min(56,cw*.55),ph=H-T-B-dy,base=T+dy+ph;
  let g='';
  for(let i=0;i<=4;i++){const yy=T+dy+ph*i/4;g+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="${i==4?'#94a3b8':'#e3edf7'}"/>`}
  items.forEach((it,i)=>{
    const x=L+cw*i+(cw-bw-dx)/2,h=it.v?Math.max(3,ph*it.v/mx):2,y=base-h,pc=total?Math.round(it.v/total*100):0;
    const cx=x+(bw+dx)/2,w=it.l.split(' '),l1=w[0],l2=w.slice(1).join(' ');
    g+=`<a href="${it.h}"><g class="b3"><title>${it.l}: ${it.v} (${pc}%)</title><rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="${it.c}"/>`
     +`<polygon points="${x+bw},${y} ${x+bw+dx},${y-dy} ${x+bw+dx},${y-dy+h} ${x+bw},${y+h}" fill="${it.c}" style="filter:brightness(.7)"/>`
     +`<polygon points="${x},${y} ${x+dx},${y-dy} ${x+bw+dx},${y-dy} ${x+bw},${y}" fill="${it.c}" style="filter:brightness(1.3)"/>`
     +`<text x="${cx}" y="${y-dy-6}" text-anchor="middle" font-size="11" font-weight="700" fill="#07294d">${it.t!==undefined?it.t:it.v} <tspan font-size="10" font-weight="600" fill="#475569">(${pc}%)</tspan></text>`
     +``
     +`<text x="${cx}" y="${base+16}" text-anchor="middle" font-size="10" font-weight="600" fill="#334155">${it.l}</text></g></a>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="3D bar chart">${g}</svg>`;
}
const PM2=()=>PAYMODES.map(x=>[x,x]),PT2=()=>PTYPES.map(x=>[x,x]);
const CARDF={dash:[['st','Status',()=>GST]],month:[['m','Months',()=>CHMON]],source:[['s','Sources',()=>SOURCES.map(s=>[s,s])]],rev:[['rm','Months',()=>CHMON],['rpm','Payment Mode',PM2],['rpt','Payment Type',PT2]]};
function ccToggle(ev,k){ev.stopPropagation();ccOpen=ccOpen===k?null:k;renderCharts()}
function fillCard(k){const p=$('#pop-cc-'+k);if(!p)return;
  p.innerHTML=CARDF[k].map(([key,title,items])=>'<fieldset><legend>'+title+'</legend>'+items().map(([v,l])=>'<label class="ck"><input type="checkbox" data-cg="'+key+'" data-k="'+v+'"'+(CH[key].includes(v)?'':' checked')+'> '+l+'</label>').join('')+'</fieldset>').join('')+'<div class="pbar"><span class="pmsg"></span><button class="lnk" data-ccreset="'+k+'" type="button">Select all</button><button class="p" data-closepop="1" type="button">Done</button></div>';
  p.hidden=false}
document.addEventListener('change',e=>{const t=e.target;if(!(t.dataset&&t.dataset.cg))return;const g=t.dataset.cg,pop=t.closest('.pop'),sel='input[data-cg="'+g+'"]';
  if(!pop.querySelectorAll(sel+':checked').length){t.checked=true;pop.querySelector('.pmsg').textContent='Keep at least one selected.';return}
  CH[g]=[...pop.querySelectorAll(sel+':not(:checked)')].map(i=>i.dataset.k);saveCH();render()});
document.addEventListener('click',e=>{const r=e.target.closest('[data-ccreset]');if(r){CARDF[r.dataset.ccreset].forEach(([key])=>{CH[key]=[]});saveCH();render()}});
function renderCharts(){
  const el=$('#charts');if(!el)return;
  const c=s=>leads.filter(l=>l.status===s).length,t=today(),cur=t.slice(0,7),dt=l=>(l.date||l.created||'');
  const st=[['Interested','#1a8f4c'],['Not Interested','#c0392b'],['Hold','#d9822b'],['Converted','#d4a90a']].map(([s,col])=>({l:s==='Hold'?'On Hold':s==='Converted'?'Payment':s,v:c(s),c:col,k:s,h:'#'+({New:'new',Interested:'interested','Not Interested':'not-interested',Hold:'hold',Converted:'converted'}[s])}));
  const keys=[];let y=+cur.slice(0,4),m=+cur.slice(5);
  for(let i=0;i<6;i++){const k=y+'-'+String(m).padStart(2,'0');if(k<'2026-10')break;keys.unshift(k);m--;if(m<1){m=12;y--}}
  const ms=keys.map(k=>({l:monthLabel(k).replace(/^(\w{3})\w*/,'$1'),v:leads.filter(l=>dt(l).slice(0,7)===k&&dt(l)<=t).length,c:'#0a4d8c',h:'#m-'+k+'-all'}));
  const pal=['#0a4d8c','#03b1ed','#6d5bd0','#0f766e'];
  const ss=SOURCES.map((s,i)=>({l:s,v:leads.filter(l=>(l.source||'')===s).length,c:pal[i%4],h:'#s-'+sl(s)+'-all'}));
  const num=x=>{const n=parseFloat(x);return isNaN(n)?0:n};
  const fmtK=n=>n>=1e6?(n/1e6).toFixed(1).replace(/\.0$/,'')+'M':n>=1e3?(n/1e3).toFixed(1).replace(/\.0$/,'')+'K':String(Math.round(n));
  const rv=keys.map(k=>{const v=leads.filter(l=>pPaid(l)&&!CH.rpm.includes(l.payMode||'__none')&&!CH.rpt.includes(l.payType||'__none')&&(l.paidDate||l.closedAt||dt(l)).slice(0,7)===k).reduce((a,l)=>a+totalOf(l),0);return {l:monthLabel(k).replace(/^(\w{3})\w*/,'$1'),v,t:fmtK(v),c:'#0f766e',h:'#payments-paid',k:'m-'+k}});
  const sum=a=>a.reduce((x,i)=>x+i.v,0);
  const card=(key,h,sub,a)=>{const tt=sum(a);return '<div class="ccard c-'+key+'"><div class="chead"><h3>'+h+'</h3><button class="cust" type="button" onclick="ccToggle(event,\''+key+'\')">Customize</button></div><p>'+sub+'</p><div class="pop" id="pop-cc-'+key+'" hidden></div>'+(tt?bar3d(a,tt):'<div class="empty">No data yet</div>')+'</div>'};
  CHMON=keys.map(k=>['m-'+k,monthLabel(k)]);
  const stf=st.filter(i=>!CH.st.includes(i.k)),msf=ms.filter(i=>!CH.m.includes(i.h.slice(1,-4))),ssf=ss.filter(i=>!CH.s.includes(i.l)),rvf=rv.filter(i=>!CH.rm.includes(i.k));
  const cards=[];
  if(!CH.g.includes('dash'))cards.push(card('dash','Dashboard',sum(stf)+' leads by status, % of the bars shown',stf));
  if(!CH.g.includes('month'))cards.push(card('month','Month Analysis','Leads per month, % of the months shown',msf));
  if(!CH.g.includes('source'))cards.push(card('source','Source Analysis','Leads per source, % of leads with a source',ssf));
  if(!CH.g.includes('rev'))cards.push(card('rev','Revenue Analysis','Total amount received per month, % of revenue shown',rvf));
  el.innerHTML=cards.join('');el.style.setProperty('--n',cards.length||1);
  if(ccOpen&&CARDF[ccOpen])fillCard(ccOpen);
}
let PS=10,pgL=1,pgV=1,lastK=null;
try{const n=+localStorage.getItem('crm-ps');if([5,10,25,50,100].includes(n))PS=n}catch(e){}
function pagerHtml(key,total,page,pages){
  const from=total?(page-1)*PS+1:0,to=Math.min(page*PS,total);
  const nums=[];for(let i=1;i<=pages;i++)if(i===1||i===pages||Math.abs(i-page)<=1)nums.push(i);
  let b='',prev=0;nums.forEach(i=>{if(prev&&i-prev>1)b+='<span class="pdots">\u2026</span>';b+='<button class="pn'+(i===page?' on':'')+'" data-pg="'+key+':'+i+'">'+i+'</button>';prev=i});
  return '<div class="pl">Rows per page <select data-ps="1">'+[5,10,25,50,100].map(n=>'<option'+(n===PS?' selected':'')+'>'+n+'</option>').join('')+'</select></div><div class="pi">Showing '+from+'\u2013'+to+' of '+total+' &nbsp;|&nbsp; Page '+page+' of '+pages+'</div><div class="pb"><button class="pn" data-pg="'+key+':'+(page-1)+'"'+(page<=1?' disabled':'')+'>\u2039 Previous</button>'+b+'<button class="pn" data-pg="'+key+':'+(page+1)+'"'+(page>=pages?' disabled':'')+'>Next \u203a</button></div>';
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-pg]');if(!b||b.disabled)return;const p=b.dataset.pg.split(':');if(p[0]==='U'){pgU=+p[1];renderUsers();return}if(p[0]==='L')pgL=+p[1];else pgV=+p[1];render()});
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset||!t.dataset.ps)return;PS=+t.value;pgL=1;pgV=1;try{localStorage.setItem('crm-ps',PS)}catch(x){}render();renderUsers()});
const PAYMODES=['UPI','Bank Transfer','Money Transfer'];
const PHEAD='<tr><th>Lead No.</th><th>Lead Date</th><th>Name</th><th>Email</th><th>Phone</th><th>Source</th><th>Category</th><th>Status</th><th>Paid Date</th><th>Payment Mode</th><th>Tenure Month</th><th>Payment Type</th><th>Bill Rate</th><th>Pay Rate</th><th>Margin</th><th>Total Amount</th><th>Actions</th></tr>';
let VHEAD0=null;
const payStatus=l=>l.nextAction==='Refund'?'Refund':((l.status==='Converted'||l.nextAction==='Paid')?'Paid':'Follow-up');
const cleanNum=v=>{v=String(v).replace(/[^\d.]/g,'');const p=v.split('.');return p.length>2?p[0]+'.'+p.slice(1).join(''):v};
function setPayStatus(id,v){
  const l=leads.find(x=>x.id===id);if(!l)return;const p={};
  if(v==='Paid'){p.nextAction='Paid';p.status='Converted';p.closedAt=l.closedAt||today();p.paidDate=l.paidDate||today();p.nextDate=''}
  else if(v==='Follow-up'){p.nextAction='Payment follow-up';if(l.status==='Converted'){p.status='Interested';p.closedAt=''}}
  else if(v==='Refund'){p.nextAction='Refund'}
  save(id,p);
}
function payRow(l){
  const ps=payStatus(l),cls={Paid:'Converted','Follow-up':'Hold',Refund:'Not-Interested'}[ps];
  const nf=f=>'<td><input data-num="1" inputmode="decimal" data-f="'+f+'" data-id="'+l.id+'" value="'+esc(l[f]??'')+'" size="9" placeholder="0"></td>';
  return '<tr class="st-'+cls+(l.deleted?' dl':'')+'"><td class="lno"><b>'+esc(l.leadNo||'')+'</b></td><td>'+esc(l.date||l.created||'')+'</td><td><b>'+(esc(l.name)||'(no name)')+'</b></td><td>'+mailLink(l.email)+'</td><td>'+esc(l.phone??'0')+'</td><td>'+esc(l.source)+'</td><td>'+esc(l.module)+'</td>'
   +'<td><select data-pst="1" data-id="'+l.id+'">'+['Paid','Follow-up','Refund'].map(s=>'<option'+(s===ps?' selected':'')+'>'+s+'</option>').join('')+'</select></td>'
   +'<td><input type="date" data-f="paidDate" data-id="'+l.id+'" value="'+esc(l.paidDate||'')+'"></td>'
   +'<td><select data-f="payMode" data-id="'+l.id+'"><option value="">Select</option>'+PAYMODES.map(m=>'<option'+(m===l.payMode?' selected':'')+'>'+m+'</option>').join('')+'</select></td>'
   +'<td><select data-f="tenure" data-id="'+l.id+'"><option value="">Select</option>'+TENURES.map(m=>'<option'+(m===l.tenure?' selected':'')+'>'+m+'</option>').join('')+'</select></td><td><select data-f="payType" data-id="'+l.id+'"><option value="">Select</option>'+PTYPES.map(m=>'<option'+(m===l.payType?' selected':'')+'>'+m+'</option>').join('')+'</select></td>'+nf('billRate')+nf('payRate')+'<td class="mg"><b>'+fmtM(marginOf(l))+'</b></td><td class="mg"><b>'+fmtM(totalOf(l))+'</b></td>'
   +'<td style="white-space:nowrap"><button class="al" data-act="'+l.id+'" data-akind="lead" title="Activity log" aria-label="Activity log">'+ALOG+'</button>'+(l.deleted?'<button class="rs" data-restore="'+l.id+'" title="Restore" aria-label="Restore">\u21ba</button></td></tr>':'<button class="wa" data-wa="'+l.id+'" title="WhatsApp" aria-label="WhatsApp">'+WAICON+'</button><button data-edit="'+l.id+'" title="Edit lead" aria-label="Edit lead"><span style="display:inline-block;transform:scaleX(-1)">\u270e</span></button> <button class="x" data-del="'+l.id+'" title="Delete">\u2715</button></td></tr>');
}
document.addEventListener('input',e=>{const t=e.target;if(t.dataset&&t.dataset.num){const c=cleanNum(t.value);if(c!==t.value)t.value=c}});
$('#pexp').onclick=()=>{
  if(!isAdmin())return;
  const k=(location.hash||'').slice(1),v=getView(k);if(!v||!/^payments/.test(k))return;
  const q=s=>'"'+String(s??'').replace(/"/g,'""')+'"';
  const H=['Lead No.','Lead Date','Name','Email','Phone','Source','Category','Status','Paid Date','Payment Mode','Tenure Month','Payment Type','Bill Rate','Pay Rate','Margin','Total Amount'];
  const rows=CURVIEW.map(l=>[l.leadNo,l.date||l.created,l.name,l.email,l.phone??'0',l.source,l.module,payStatus(l),l.paidDate,l.payMode,l.tenure,l.payType,l.billRate,l.payRate,fmtM(marginOf(l)),fmtM(totalOf(l))].map(q).join(','));
  saveFile('payments-'+k.replace('payments-','').replace('payments','paid')+'.csv',[H.map(q).join(',')].concat(rows).join('\n'));
};
$('#padd').onclick=async()=>{
  const name=$('#pn').value.trim(),email=$('#pe').value.trim();
  if(!name&&!email){pmsgErr('Enter a name or an email.');return}
  if(!$('#pst').value){pmsgErr('Select a status: Paid, Follow-up or Refund.');return}
  if(!TENURES.includes($('#ptn').value)){pmsgErr('Select a tenure month (01 to 12).');return}
  if(!PTYPES.includes($('#ppt').value)){pmsgErr('Select a payment type: New or Renew.');return}
  {const dm=dupMsg(email,$('#pph').value);if(dm){pmsgErr(dm);return}}
  $('#pmsg').textContent='';$('#pmsg').style.color='#07294d';
  const k=(location.hash||'').slice(1),date=$('#pdt').value||today();
  const d={name,email,phone:$('#pph').value,date,source:$('#psrc').value,module:$('#pm').value||'Not Specified',paidDate:$('#ppd').value,payMode:$('#ppm').value,tenure:$('#ptn').value,payType:$('#ppt').value,billRate:cleanNum($('#pbr').value),payRate:cleanNum($('#ppr').value)};
  d.totalAmount=fmtM((parseFloat(d.billRate)||0)+(parseFloat(d.payRate)||0));
  Object.assign(d,payExtra($('#pst').value,date,d.paidDate));
  await create(d);['pn','pe','pph','ppd','pbr','ppr','pta','pmg'].forEach(i=>$('#'+i).value='');$('#ppm').value='';$('#pst').value='';$('#ptn').value='';$('#ppt').value='';shut($('#paddtog'),$('#pform'));
};
$('#pq').addEventListener('input',()=>{pgV=1;render()});
let lastPk=null;
function payExtra(st,date,pd){
  if(st==='Follow-up')return {status:'Interested',nextAction:'Payment follow-up'};
  if(st==='Refund')return {status:'Converted',nextAction:'Refund',closedAt:today(),paidDate:pd||date};
  return {status:'Converted',nextAction:'Paid',closedAt:today(),paidDate:pd||date};
}
const PHEADN=['Name','Email','Phone','Date','Source','Category','Status','Paid Date','Payment Mode','Tenure Month','Payment Type','Bill Rate','Pay Rate'];
const PSAMPLE=['Ravi Kumar','ravi@example.com','9876543210','2026-11-15','Srinivas','Server + Videos','Paid','2026-11-15','UPI','12','New','15000','15000'];
async function readRowsFromFile(f){
  if(/\.csv$/i.test(f.name))return csvParse(await f.text());
  if(!window.XLSX)throw new Error('xlsx');
  const wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true});
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:false,dateNF:'yyyy-mm-dd',defval:''});
}
$('#ptpl').onclick=()=>saveFile('payments-import-template.csv',PHEADN.join(',')+'\n'+PSAMPLE.join(',')+'\n');
$('#pimp').onclick=()=>$('#pfile').click();
$('#pfile').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  const msg=$('#pmsg');msg.style.color='#07294d';msg.textContent='Reading file...';
  let rows=[];
  try{rows=await readRowsFromFile(f)}catch(err){msg.textContent=err.message==='xlsx'?'Excel library could not load. Save the file as CSV and import again.':'Could not read this file.';return}
  rows=rows.filter(r=>r.some(c=>String(c).trim()!==''));
  if(!rows.length){msg.textContent='The file is empty.';return}
  let idx=PHEADN.map((x,i)=>i);const h=rows[0].map(c=>String(c).trim().toLowerCase());
  if(h.includes('email')||h.includes('name')){idx=PHEADN.map(x=>h.indexOf(x.toLowerCase()));rows=rows.slice(1)}
  const k0=(location.hash||'').slice(1),defSt=k0==='payments-followup'?'Follow-up':k0==='payments-refund'?'Refund':'Paid';
  const ci=(arr,v)=>arr.find(x=>x.toLowerCase()===String(v).toLowerCase())||'';
  const seen=new Set(leads.map(l=>(l.email||'').toLowerCase()).filter(Boolean));
  let ok=0,dup=0,bad=0;const seenP=new Set();
  for(const r of rows){const g=i=>i<0?'':String(r[i]??'').trim();
    const name=g(idx[0]),email=g(idx[1]);
    if((!name&&!email)||/@example\.com$/i.test(email)){bad++;continue}
    if(dupMsg(email,g(idx[2]))||(email&&seen.has(email.toLowerCase()))||(phoneKey(g(idx[2]))&&seenP.has(phoneKey(g(idx[2]))))){dup++;continue}
    if(email)seen.add(email.toLowerCase());{const pk=phoneKey(g(idx[2]));if(pk)seenP.add(pk)}
    const date=normDate(g(idx[3])),pd=g(idx[7])?normDate(g(idx[7])):'';
    const tn=ci(TENURES,String(g(idx[9])).padStart(2,'0')),pt=ci(PTYPES,g(idx[10]));
    if(!tn||!pt){bad++;continue}
    const bill=cleanNum(g(idx[11])),pay=cleanNum(g(idx[12])),tot=fmtM((parseFloat(bill)||0)+(parseFloat(pay)||0));
    const d={name,email,phone:g(idx[2]),date,source:ci(SOURCES,g(idx[4])),module:ci(MODS,g(idx[5]))||'Not Specified',paidDate:pd,payMode:ci(PAYMODES,g(idx[8])),tenure:tn,payType:pt,billRate:bill,payRate:pay,totalAmount:tot};
    Object.assign(d,payExtra(ci(['Paid','Follow-up','Refund'],g(idx[6]))||defSt,date,pd));
    await create(d);ok++}
  msg.textContent='Imported '+ok+' payment'+(ok===1?'':'s')+(dup?', skipped '+dup+' duplicate'+(dup===1?'':'s')+' (email or phone already exists)':'')+(bad?', skipped '+bad+' invalid or sample row'+(bad===1?'':'s'):'')+'.';
};
function pmsgErr(t){const m=$('#pmsg');m.style.color='#c0392b';m.textContent=t}
function editExtra(){
  if($('#epay').hidden)return {};
  const l0=leads.find(x=>x.id===editId),pd=$('#epd').value,date=$('#ed').value||today();
  const p={paidDate:pd,payMode:$('#epm').value,tenure:TENURES.includes($('#etn').value)?$('#etn').value:'',payType:PTYPES.includes($('#ept').value)?$('#ept').value:'',billRate:cleanNum($('#ebr').value),payRate:cleanNum($('#epr').value),totalAmount:fmtM((parseFloat($('#ebr').value)||0)+(parseFloat($('#epr').value)||0))};
  const st=$('#eps').value;
  if(l0&&st!==payStatus(l0))Object.assign(p,payExtra(st,date,pd));
  return p;
}

// ---------- Settings menu (profile) ----------
const PROF_KEY='crm-profile';
function loadProf(){try{return JSON.parse(localStorage.getItem(PROF_KEY)||'{}')}catch(e){return {}}}
function saveProf(p){try{localStorage.setItem(PROF_KEY,JSON.stringify(p))}catch(e){}}
function paintProf(){paintTheme();const p=loadProf(),nm=p.name||(SESSION&&SESSION.name)||(ME&&ME.name)||(authDoc&&authDoc.user)||'User',ini=nm.trim().charAt(0).toUpperCase();$('#gname').value=nm;$('#gini').textContent=ini;$('#gtini').textContent=ini;$('#gtn').textContent=nm;const im=$('#gimg'),it=$('#gtop');if(p.pic){im.src=it.src=p.pic;im.hidden=it.hidden=false;$('#gini').hidden=$('#gtini').hidden=true}else{im.hidden=it.hidden=true;$('#gini').hidden=$('#gtini').hidden=false}}
$('#gbtn').onclick=e=>{e.stopPropagation();const m=$('#gmenu');m.hidden=!m.hidden;if(!m.hidden)paintProf()};
document.addEventListener('click',e=>{if(!e.target.closest('.gear'))$('#gmenu').hidden=true});
$('#gname').onchange=()=>{const p=loadProf();p.name=$('#gname').value.trim();saveProf(p);paintProf()};
$('#gpick').onclick=()=>$('#gfile').click();
$('#gfile').onchange=e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=c.height=128;const s0=Math.min(img.width,img.height);c.getContext('2d').drawImage(img,(img.width-s0)/2,(img.height-s0)/2,s0,s0,0,0,128,128);const p=loadProf();p.pic=c.toDataURL('image/jpeg',.85);saveProf(p);paintProf()};img.src=r.result};r.readAsDataURL(f)};
$('#gpw').onclick=()=>{$('#gmenu').hidden=true;['rpc','rpn','rpn2'].forEach(i=>$('#'+i).value='');$('#rpm').textContent='';$('#pwdlg').showModal()};
$('#rpx').onclick=()=>$('#pwdlg').close();
$('#rps').onclick=async()=>{
  const m=$('#rpm'),cur=$('#rpc').value,np=$('#rpn').value;
  if(SESSION&&SESSION.kind==='user'){
    const rec=ALLUSERS.find(x=>x.id===SESSION.id);
    if(!db||!rec||!rec.pwHash){m.textContent='Account details are not available. Reload the page.';return}
    if(np.length<8){m.textContent='Use at least 8 characters for the new password.';return}
    if(np!==$('#rpn2').value){m.textContent='The two new passwords do not match.';return}
    if(await pbk(cur,unhex(rec.pwSalt),rec.pwIter)!==rec.pwHash){m.textContent='The current password is not correct.';return}
    const sl=crypto.getRandomValues(new Uint8Array(16));
    try{await db.doc('users/'+rec.id).update({pwSalt:hex(sl),pwIter:rec.pwIter,pwHash:await pbk(np,sl,rec.pwIter)});$('#pwdlg').close()}catch(e){m.textContent='Could not save the new password. Try again.'}
    return}
  if(!db||!authDoc){m.textContent='Sign-in details are not available. Reload the page.';return}
  if(np.length<8){m.textContent='Use at least 8 characters for the new password.';return}
  if(np!==$('#rpn2').value){m.textContent='The two new passwords do not match.';return}
  if(await pbk(cur,unhex(authDoc.salt),authDoc.iter)!==authDoc.hash){m.textContent='The current password is not correct.';return}
  const salt=crypto.getRandomValues(new Uint8Array(16)),doc={...authDoc,salt:hex(salt),hash:await pbk(np,salt,authDoc.iter)};
  try{await db.doc('auth/admin').set(doc);authDoc=doc;$('#pwdlg').close()}catch(e){m.textContent='Could not save the new password. Try again.'}
};

// ---------- Graph hub (independent of Month / Source analysis) ----------
let CH={g:[],st:[],m:[],s:[],rm:[],rpm:[],rpt:[]},CHMON=[],ccOpen=null;
try{const j=JSON.parse(localStorage.getItem('crm-chide')||'null');if(j)CH=Object.assign(CH,j)}catch(e){}
CH.rpm=(CH.rpm||[]).filter(x=>x!=='__none');CH.rpt=(CH.rpt||[]).filter(x=>x!=='__none');CH.st=(CH.st||[]).filter(x=>x!=='New');
function saveCH(){try{localStorage.setItem('crm-chide',JSON.stringify(CH))}catch(e){}}
const GRAPHS=[['dash','Dashboard (status)'],['month','Month Analysis'],['source','Source Analysis'],['rev','Revenue Analysis']];
const GST=[['Interested','Interested'],['Not Interested','Not Interested'],['Hold','On Hold'],['Converted','Payment']];
// To add a new filter group for the graphs, add one entry here: [key, title, ()=>[[value,label],...]]
const HUB=[['g','Graphs',()=>GRAPHS],['st','Status',()=>GST],['m','Months',()=>CHMON],['s','Sources',()=>SOURCES.map(s=>[s,s])],['rm','Revenue months',()=>CHMON],['rpm','Revenue payment mode',()=>PM2()],['rpt','Revenue payment type',()=>PT2()]];
function fillHub(){$('#pop-hub').innerHTML=HUB.map(([key,title,items])=>'<fieldset><legend>'+title+'</legend>'+items().map(([v,l])=>'<label class="ck"><input type="checkbox" data-hg="'+key+'" data-k="'+v+'"'+(CH[key].includes(v)?'':' checked')+'> '+l+'</label>').join('')+'</fieldset>').join('')+'<div class="pbar"><span class="pmsg"></span><button class="lnk" id="hubreset" type="button">Select all</button><button class="p" data-closepop="1" type="button">Done</button></div>'}
$('#hubbtn').onclick=e=>{e.stopPropagation();const p=$('#pop-hub'),open=p.hidden;closePops();if(open){fillHub();p.hidden=false}};
document.addEventListener('click',e=>{if(e.target.closest('#hubreset')){CH={g:[],st:[],m:[],s:[],rm:[],rpm:[],rpt:[]};saveCH();fillHub();render()}});
document.addEventListener('change',e=>{const t=e.target;if(!(t.dataset&&t.dataset.hg))return;const g=t.dataset.hg,pop=t.closest('.pop'),sel='input[data-hg="'+g+'"]';
  if(!pop.querySelectorAll(sel+':checked').length){t.checked=true;pop.querySelector('.pmsg').textContent='Keep at least one selected.';return}
  pop.querySelector('.pmsg').textContent='';CH[g]=[...pop.querySelectorAll(sel+':not(:checked)')].map(i=>i.dataset.k);saveCH();render()});

// ---------- Payments margin ----------
const marginOf=l=>(parseFloat(l.billRate)||0)-(parseFloat(l.payRate)||0);
const fmtM=n=>String(Math.round(n*100)/100);
const totalOf=l=>(parseFloat(l.billRate)||0)+(parseFloat(l.payRate)||0);
['ebr','epr'].forEach(id=>$('#'+id).addEventListener('input',()=>{const b=parseFloat($('#ebr').value)||0,p2=parseFloat($('#epr').value)||0;$('#emg').value=fmtM(b-p2);$('#eta').value=fmtM(b+p2)}));
['pbr','ppr'].forEach(id=>$('#'+id).addEventListener('input',()=>{const b=parseFloat($('#pbr').value)||0,p2=parseFloat($('#ppr').value)||0;$('#pmg').value=fmtM(b-p2);$('#pta').value=fmtM(b+p2)}));

// ---------- Activity log + reason modal ----------
let ACT=[],actRec=null,rsCtx=null;
const ALOG='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const fmtAt=iso=>{const d=new Date(iso);return isNaN(d)?'':d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})+' '+d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true})};
const whoAmI=()=>{const p=loadProf();return p.name||(SESSION&&SESSION.name)||(ME&&ME.name)||(authDoc&&authDoc.user)||'User'};
const recLabel=(kind,r)=>(kind==='lead'?[r.leadNo,r.name||r.email]:[r.empId,r.name,r.lastName]).filter(Boolean).join(' ');
function startActivity(){if(!db)return;db.collection('activity').onSnapshot(s=>{ACT=s.docs.map(d=>({id:d.id,...d.data()}));if($('#actdlg').open)fillAct()},e=>{})}
async function logAct(kind,rec,action,reason){
  if(!db)return;
  try{await db.collection('activity').add({kind,recId:rec.id,label:recLabel(kind,rec),action,reason:reason||'',by:whoAmI(),role:ROLE,at:new Date().toISOString()})}catch(e){}
}
function askReason(kind,rec,action,after){
  rsCtx={kind,rec,action,after};
  $('#rs_t').textContent=(action==='delete'?'Delete':'Edit')+': reason required';
  $('#rs_s').textContent=recLabel(kind,rec);
  $('#rs_note').value='';$('#rs_m').textContent='';$('#rsdlg').showModal();
}
$('#rs_x').onclick=()=>{rsCtx=null;$('#rsdlg').close()};
$('#rs_ok').onclick=async()=>{
  const note=$('#rs_note').value.trim();
  if(note.length<3){$('#rs_m').textContent='Enter a reason or note (at least 3 characters).';return}
  const c=rsCtx;if(!c)return;rsCtx=null;$('#rsdlg').close();
  await logAct(c.kind,c.rec,c.action,note);
  c.after();
};
function fillAct(){
  const r=actRec;if(!r)return;
  const list=ACT.filter(a=>a.recId===r.id).sort((a,b)=>String(b.at).localeCompare(String(a.at)));
  $('#act_t').textContent='Activity log: '+r.label;
  const nm={edit:'Edit',delete:'Delete',restore:'Restore',activation:'Activation email',reset:'Password reset',whatsapp:'WhatsApp'};
  $('#act_list').innerHTML=list.length?list.map(a=>'<div class="alog"><div class="ah"><b>'+esc(nm[a.action]||a.action)+'</b> by '+esc(a.by)+' <span>'+esc(fmtAt(a.at))+'</span></div>'+(a.reason?'<div class="ar">'+esc(a.reason)+'</div>':'')+'</div>').join(''):'<div class="empty">No activity recorded yet.</div>';
}
function openAct(kind,id){const rec=kind==='lead'?(ALLLEADS.find(x=>x.id===id)||leads.find(x=>x.id===id)):ALLUSERS.find(x=>x.id===id);if(!rec)return;actRec={id,label:recLabel(kind,rec)};fillAct();$('#actdlg').showModal()}
$('#act_x').onclick=()=>$('#actdlg').close();

// ---------- Light / Dark mode toggle ----------
const darkMQ=window.matchMedia?matchMedia('(prefers-color-scheme: dark)'):null;
function curTheme(){return document.documentElement.getAttribute('data-theme')||(darkMQ&&darkMQ.matches?'dark':'light')}
function paintTheme(){const b=$('#gtheme');if(!b)return;b.textContent=curTheme()==='dark'?'\u2600\ufe0f  Switch to Light mode':'\ud83c\udf19  Switch to Dark mode';$('#gthauto').hidden=!document.documentElement.getAttribute('data-theme')}
$('#gtheme').onclick=()=>{const nt=curTheme()==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',nt);try{localStorage.setItem('crm-theme',nt)}catch(e){}paintTheme()};
$('#gthauto').onclick=()=>{document.documentElement.removeAttribute('data-theme');try{localStorage.removeItem('crm-theme')}catch(e){}paintTheme()};
if(darkMQ&&darkMQ.addEventListener)darkMQ.addEventListener('change',paintTheme);
// ---------- Entry form toggles ----------
const tg=(btn,form,focus)=>{const open=form.hidden;form.hidden=!open;btn.setAttribute('aria-expanded',open?'true':'false');if(open&&focus)$('#'+focus).focus()};
const shut=(btn,form)=>{form.hidden=true;btn.setAttribute('aria-expanded','false')};
$('#addtog').onclick=()=>tg($('#addtog'),$('#lbar'),'n');
$('#lcancel').onclick=()=>shut($('#addtog'),$('#lbar'));
$('#paddtog').onclick=()=>tg($('#paddtog'),$('#pform'),'pn');
$('#pcancel').onclick=()=>shut($('#paddtog'),$('#pform'));
$('#uaddtog').onclick=()=>tg($('#uaddtog'),$('#ubar'),'un');
$('#ucancel').onclick=()=>shut($('#uaddtog'),$('#ubar'));
// ---------- Roles, uniqueness, helpers ----------
let ALLLEADS=[],ALLUSERS=[],ME=null,ROLE='User',CURLEADS=[],CURVIEW=[];
const TENURES=['01','02','03','04','05','06','07','08','09','10','11','12'],PTYPES=['New','Renew'];
const isAdmin=()=>ROLE==='Admin';
async function initRole(){try{const u=await claude.use('user');ME=u?await u.me():null}catch(e){ME=null}computeRole()}
function computeRole(){
  let r='User';
  if(SESSION&&SESSION.kind==='user'){const rc=USERS.find(u=>u.id===SESSION.id);r=(rc&&!rc.locked&&rc.status!=='Inactive'&&rc.category==='Admin')?'Admin':'User'}
  else if(ME&&(ME.isOwner||ME.canEdit))r='Admin';
  else if(ME&&ME.email){const em=ME.email.toLowerCase(),rec=USERS.find(u=>String(u.email||'').toLowerCase()===em&&u.status!=='Inactive');if(rec&&rec.category==='Admin')r='Admin'}
  ROLE=r;document.body.classList.toggle('admin',r==='Admin');applyPhoneRule();
  const g=$('#grole');if(g)g.textContent=r;paintProf();
  render();renderUsers();tryToken();if(r==='Admin'){processPending();processNotifs()}
}
function applyPhoneRule(){['ep','ued_p'].forEach(id=>{const el=$('#'+id);if(!el)return;el.disabled=!isAdmin();el.title=isAdmin()?'':'Only an Admin can change phone numbers'})}
applyPhoneRule();
const phoneKey=p=>{const d=String(p||'').replace(/\D/g,'');return d.length>=6?d:''};
function dupMsg(email,phone,exKind,exId){
  const e=String(email||'').trim().toLowerCase(),ph=phoneKey(phone);
  if(!e&&!ph)return '';
  const scan=(arr,kind,label)=>{
    for(const r of arr){
      if(kind===exKind&&r.id===exId)continue;
      const tag=r.deleted?' (deleted record)':(r.status?' ('+r.status+')':'');
      if(e&&String(r.email||'').trim().toLowerCase()===e)return 'This email already exists in '+label+tag+'.';
      if(ph&&phoneKey(r.phone)===ph)return 'This phone number already exists in '+label+tag+'.';
    }
    return '';
  };
  return scan(ALLLEADS,'lead','Leads')||scan(leads,'lead','Leads')||scan(ALLUSERS,'user','Users')||scan(USERS,'user','Users');
}
function showNote(t){const n=$('#note');n.textContent=t;n.style.color='#c0392b';n.style.fontWeight='700';clearTimeout(showNote.t);showNote.t=setTimeout(()=>{n.textContent=''},7000)}
function armDelete(btn,fn){
  if(btn.dataset.arm==='1'){fn();return}
  btn.dataset.arm='1';btn.dataset.orig=btn.textContent;btn.textContent='Sure?';btn.style.color='#a50e0e';
  setTimeout(()=>{if(btn.isConnected){btn.dataset.arm='';btn.textContent=btn.dataset.orig;btn.style.color=''}},3000);
}
document.addEventListener('click',e=>{
  const rs=e.target.closest('[data-restore]');if(rs){if(isAdmin()){const r=ALLLEADS.find(x=>x.id===rs.dataset.restore);save(rs.dataset.restore,{deleted:false,deletedAt:'',deletedFrom:''});if(r)logAct('lead',r,'restore','')}return}
  const ur=e.target.closest('[data-urestore]');if(ur){if(isAdmin()&&db){const r=ALLUSERS.find(x=>x.id===ur.dataset.urestore);db.doc('users/'+ur.dataset.urestore).update({deleted:false,deletedAt:'',deletedFrom:''}).catch(()=>{});if(r)logAct('user',r,'restore','')}}
});
const capsChk=e=>{$('#lcaps').hidden=!(e.getModifierState&&e.getModifierState('CapsLock'))};
['lp','lp2'].forEach(id=>{const el=$('#'+id);['keydown','keyup'].forEach(ev=>el.addEventListener(ev,capsChk));el.addEventListener('blur',()=>{$('#lcaps').hidden=true})});

// ---------- Activation email (sent through the viewer's Gmail connector) ----------
const CRM_URL='https://claude.ai/artifact/Lx1bJJPoKcQ9HYbokxUPEd';
function activationMail(u,tok){
  const full=[u.name,u.lastName].filter(Boolean).join(' ')||'there',sender=whoAmI();
  const link=tok?CRM_URL+'#activate-'+tok:CRM_URL;
  const subject='Activate your NextS4 HANA CRM account';
  const body=['Dear '+full+',','','Welcome to NextS4 HANA. Your CRM account has been created.','','Account details','  Employee Id: '+u.empId,'  Email: '+u.email,'  Role: '+u.category,'  Date of joining: '+u.doj,'','To activate your account:','  1. Open your activation link (valid for 72 hours): '+link,'  2. Choose a password of at least 8 characters.','  3. Sign in with your Employee Id or email address and your new password.','','You need to be signed in to Claude with '+u.email+' to open the page.','','If you did not expect this email, please contact your administrator.','','Kind regards,',sender,'NextS4 HANA'].join('\n');
  const rows=[['Employee Id',u.empId],['Email',u.email],['Role',u.category],['Date of joining',u.doj]].map(([k,v])=>'<tr><td style="padding:6px 14px 6px 0;color:#475569">'+k+'</td><td style="padding:6px 0;font-weight:600;color:#07294d">'+esc(v)+'</td></tr>').join('');
  const html='<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;color:#1b1f24;line-height:1.55"><div style="background:#0a4d8c;color:#fff;padding:16px 22px;border-radius:10px 10px 0 0;font-size:18px;font-weight:700">NextS4 HANA</div><div style="border:1px solid #d6e4f1;border-top:none;padding:22px;border-radius:0 0 10px 10px"><p>Dear '+esc(full)+',</p><p>Welcome to NextS4 HANA. Your CRM account has been created.</p><table style="border-collapse:collapse;margin:8px 0 16px">'+rows+'</table><p><b>To activate your account</b></p><ol style="padding-left:20px"><li>Open your activation link using the button below (valid for 72 hours).</li><li>Choose a password of at least 8 characters.</li><li>Sign in with your Employee Id or email address and your new password.</li></ol><p style="margin:18px 0"><a href="'+link+'" style="background:#0a4d8c;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;display:inline-block">Activate my account</a></p><p style="color:#475569;font-size:13px">You need to be signed in to Claude with <b>'+esc(u.email)+'</b> to open the page. If you did not expect this email, please contact your administrator.</p><p>Kind regards,<br>'+esc(sender)+'<br>NextS4 HANA</p></div></div>';
  return {subject,body,html};
}
function showMailDlg(u,m,why){
  $('#ms_s').textContent=why+' You can open the message in Gmail, or copy the text and send it yourself.';
  $('#ms_body').value='To: '+u.email+'\nSubject: '+m.subject+'\n\n'+m.body;
  $('#ms_gm').href='https://mail.google.com/mail/?view=cm&fs=1&to='+encodeURIComponent(u.email)+'&su='+encodeURIComponent(m.subject)+'&body='+encodeURIComponent(m.body);
  $('#mailsdlg').showModal();
}
$('#ms_close').onclick=()=>$('#mailsdlg').close();
$('#ms_copy').onclick=()=>{const t=$('#ms_body');t.select();try{document.execCommand('copy')}catch(e){}};
async function sendActivation(u,manual){
  if(!MAILRE.test(u.email||''))return;
  let tok='';try{if(db&&u.id)tok=await issueToken(u,'activate')}catch(e){}
  const m=activationMail(u,tok);
  let mcp=null;
  try{mcp=await claude.use('mcp')}catch(e){mcp=null}
  if(!mcp){showMailDlg(u,m,'Sending from this page is not available in this view.');return}
  umsg('Sending activation email to '+u.email+'...');
  try{
    await mcp.callTool('Gmail','send_message',{to:[u.email],subject:m.subject,body:m.body,htmlBody:m.html,includeSignature:true},{cache:false});
    umsg('Activation email sent to '+u.email+'.');
    if(u.id)logAct('user',u,'activation','Sent to '+u.email);
  }catch(err){
    const c=err&&err.code;
    if(c==='approval_required'){umsg('Sending needs your approval. claude.ai asks for it when this page is open there.',1);showMailDlg(u,m,'The email was not sent because approval was not given.')}
    else if(c==='server_not_connected'){umsg('Gmail is not connected to your Claude account.',1);showMailDlg(u,m,'Connect Gmail in your Claude settings, then use the envelope button on the row to send it.')}
    else if(c==='needs_reauth'){umsg('Gmail needs to be reconnected in your Claude settings.',1);showMailDlg(u,m,'The email was not sent because Gmail needs to be reconnected.')}
    else if(c==='blocked_by_policy'){umsg('Your workspace policy blocks sending email from this page.',1);showMailDlg(u,m,'The email was not sent because of a workspace policy.')}
    else if(c==='cancelled'){umsg('Sending was cancelled.',1)}
    else if(c==='server_unavailable'||c==='upstream_error'){umsg('The email may or may not have been sent. Check your Gmail Sent folder before sending again.',1)}
    else if(c==='tool_error'){umsg('Gmail reported an error and the email was not sent.',1);showMailDlg(u,m,'Gmail reported an error.')}
    else{umsg('The activation email could not be sent ('+(c||'unknown error')+').',1);showMailDlg(u,m,'The email could not be sent from this page.')}
  }
}

// ---------- Accounts: lock after 3 failed attempts, Admin-initiated reset links ----------
const sha=async t=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t)));
let SESSION=null;try{SESSION=JSON.parse(sessionStorage.getItem('crm-sess')||'null')}catch(e){}
function setSession(s){SESSION=s;try{s?sessionStorage.setItem('crm-sess',JSON.stringify(s)):sessionStorage.removeItem('crm-sess')}catch(e){}}
let TOKEN=null;{const tm=/^#?(reset|activate)-([0-9a-f]{32})$/.exec(location.hash||'');if(tm)TOKEN={kind:tm[1],tok:tm[2]}}
const LFAIL={},pendTried=new Set();
const findAcct=id=>{const k=String(id).trim().toLowerCase();return ALLUSERS.find(u=>!u.deleted&&(String(u.empId).toLowerCase()===k||String(u.email||'').toLowerCase()===k))};
const mailWhy=c=>({approval_required:'Approval to send was not given.',server_not_connected:'Gmail is not connected to your Claude account.',needs_reauth:'Gmail needs to be reconnected in your Claude settings.',blocked_by_policy:'Your workspace policy blocks sending email from this page.',tool_error:'Gmail reported an error.',unavailable:'Sending from this page is not available in this view.',cancelled:'Sending was cancelled.'}[c]||('The email could not be sent ('+c+').'));
async function gmailSend(to,m){
  let mcp=null;try{mcp=await claude.use('mcp')}catch(e){mcp=null}
  if(!mcp)return {ok:false,code:'unavailable'};
  try{await mcp.callTool('Gmail','send_message',{to,subject:m.subject,body:m.body,htmlBody:m.html,includeSignature:true},{cache:false});return {ok:true}}
  catch(err){return {ok:false,code:(err&&err.code)||'error'}}
}
function lockMail(r){
  const who=[r.name,r.lastName].filter(Boolean).join(' ')||'(unnamed)',at=fmtAt(new Date().toISOString());
  const subject='Security alert: CRM account locked ('+(r.empId||'login')+')';
  const body=['Hello,','','A CRM account has been locked after 3 failed password attempts.','','  Name: '+who,'  Employee Id: '+(r.empId||'-'),'  Email: '+(r.email||'-'),'  Time: '+at,'','The account stays locked until an Admin sends a password reset link:','  1. Open the CRM: '+CRM_URL,'  2. Go to Users and click the key icon on that user.','','If you do not recognise this activity, please review the Activity log.','','NextS4 HANA CRM security'].join('\n');
  const rows=[['Name',who],['Employee Id',r.empId||'-'],['Email',r.email||'-'],['Time',at],['Failed attempts','3']].map(([k,v])=>'<tr><td style="padding:6px 14px 6px 0;color:#475569">'+k+'</td><td style="padding:6px 0;font-weight:600;color:#1b1f24">'+esc(v)+'</td></tr>').join('');
  const html='<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;color:#1b1f24;line-height:1.55"><div style="background:#b42318;color:#fff;padding:16px 22px;border-radius:10px 10px 0 0;font-size:18px;font-weight:700">Security alert: account locked</div><div style="border:1px solid #f0c9c4;border-top:none;padding:22px;border-radius:0 0 10px 10px"><p>A CRM account has been locked after <b>3 failed password attempts</b>.</p><table style="border-collapse:collapse;margin:8px 0 16px">'+rows+'</table><p>The account stays locked until an Admin sends a password reset link: open the CRM, go to <b>Users</b> and click the key icon on that user.</p><p style="margin:18px 0"><a href="'+CRM_URL+'" style="background:#0a4d8c;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;display:inline-block">Open the CRM</a></p><p style="color:#475569;font-size:13px">If you do not recognise this activity, please review the Activity log.</p><p>NextS4 HANA CRM security</p></div></div>';
  return {subject,body,html};
}
async function sendLockAlert(rec,asAdmin){
  const to=[...new Set(ALLUSERS.filter(u=>!u.deleted&&u.category==='Admin'&&u.status!=='Inactive'&&MAILRE.test(u.email||'')&&u.id!==rec.id).map(u=>u.email))];
  if(asAdmin&&ME&&ME.email&&MAILRE.test(ME.email)&&!to.includes(ME.email))to.push(ME.email);
  if(!to.length)return false;
  const r=await gmailSend(to,lockMail(rec));
  if(r.ok&&rec.id&&db)db.doc('users/'+rec.id).update({alertPending:false}).catch(()=>{});
  return r.ok;
}
function processPending(){if(!isAdmin()||!db)return;ALLUSERS.filter(u=>!u.deleted&&u.locked&&u.alertPending&&!pendTried.has(u.id)).forEach(u=>{pendTried.add(u.id);sendLockAlert(u,true)})}
async function userLogin(u,p){
  const m=$('#lm'),rec=findAcct(u);
  if(!rec){m.textContent='Incorrect username or password.';return}
  if(rec.locked||(LFAIL[rec.id]||0)>=3){m.textContent='This account is locked. Please contact your Admin to send you a password reset link.';return}
  if(rec.status==='Inactive'){m.textContent='This account is inactive. Please contact your Admin.';return}
  if(!rec.pwHash){m.textContent='This account is not activated yet. Use the activation link from your email, or ask your Admin to resend it.';return}
  if(await pbk(p,unhex(rec.pwSalt),rec.pwIter)===rec.pwHash){
    LFAIL[rec.id]=0;if(rec.fails&&db)db.doc('users/'+rec.id).update({fails:0}).catch(()=>{});
    setSession({kind:'user',id:rec.id,name:rec.name});unlock();return}
  const n=Math.max(rec.fails||0,LFAIL[rec.id]||0)+1;LFAIL[rec.id]=n;
  if(n>=3){
    if(db)await db.doc('users/'+rec.id).update({fails:n,locked:true,lockedAt:new Date().toISOString(),alertPending:true}).catch(()=>{});
    let ok=false;try{ok=await sendLockAlert({...rec,fails:n})}catch(e){ok=false}
    m.textContent=ok?'Too many failed attempts. This account is now locked and your Admin has been notified.':'Too many failed attempts. This account is now locked. Your Admin will be notified and can send you a password reset link.';
    return}
  if(db)db.doc('users/'+rec.id).update({fails:n}).catch(()=>{});
  m.textContent='Incorrect username or password. '+(3-n)+' attempt'+(3-n===1?'':'s')+' left.';
}
async function issueToken(u,kind){
  const tok=hex(crypto.getRandomValues(new Uint8Array(16)));
  await db.doc('users/'+u.id).update({resetHash:await sha(tok),resetExp:Date.now()+(kind==='activate'?72:24)*3600000,resetKind:kind});
  return tok;
}
function resetMail(u,tok){
  const full=[u.name,u.lastName].filter(Boolean).join(' ')||'there',sender=whoAmI(),link=CRM_URL+'#reset-'+tok;
  const subject='Reset your NextS4 HANA CRM password';
  const body=['Dear '+full+',','','Your Admin has started a password reset for your NextS4 HANA CRM account.','','To choose a new password:','  1. Open your reset link (valid for 24 hours): '+link,'  2. Enter a new password of at least 8 characters.','  3. Sign in with your Employee Id or email address and the new password.','','Resetting your password also unlocks your account if it was locked.','','If you did not expect this email, please contact your Admin straight away.','','Kind regards,',sender,'NextS4 HANA'].join('\n');
  const html='<div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;color:#1b1f24;line-height:1.55"><div style="background:#0a4d8c;color:#fff;padding:16px 22px;border-radius:10px 10px 0 0;font-size:18px;font-weight:700">NextS4 HANA</div><div style="border:1px solid #d6e4f1;border-top:none;padding:22px;border-radius:0 0 10px 10px"><p>Dear '+esc(full)+',</p><p>Your Admin has started a password reset for your NextS4 HANA CRM account.</p><ol style="padding-left:20px"><li>Open your reset link using the button below (valid for 24 hours).</li><li>Enter a new password of at least 8 characters.</li><li>Sign in with your Employee Id or email address and the new password.</li></ol><p style="margin:18px 0"><a href="'+link+'" style="background:#0a4d8c;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;display:inline-block">Reset my password</a></p><p style="color:#475569;font-size:13px">Resetting your password also unlocks your account if it was locked. If you did not expect this email, please contact your Admin straight away.</p><p>Kind regards,<br>'+esc(sender)+'<br>NextS4 HANA</p></div></div>';
  return {subject,body,html};
}
async function initReset(u){
  if(!isAdmin()||!db)return;
  if(!MAILRE.test(u.email||'')){umsg('This user has no valid email address.',1);return}
  umsg('Sending a password reset link to '+u.email+'...');
  let tok;try{tok=await issueToken(u,'reset')}catch(e){umsg('Could not create the reset link. Try again.',1);return}
  const m=resetMail(u,tok),r=await gmailSend([u.email],m);
  if(r.ok){umsg('Password reset link sent to '+u.email+'.');logAct('user',u,'reset','Reset link sent to '+u.email)}
  else if(r.code==='server_unavailable'||r.code==='upstream_error'){umsg('The email may or may not have been sent. Check your Gmail Sent folder before sending again.',1)}
  else{umsg(mailWhy(r.code),1);showMailDlg(u,m,'The reset link email was not sent.')}
}
async function tryToken(){
  if(!TOKEN||TOKEN.done||!ALLUSERS.length)return;
  TOKEN.done=true;
  const hh=await sha(TOKEN.tok),rec=ALLUSERS.find(u=>!u.deleted&&u.resetHash&&u.resetHash===hh);
  $('#app').hidden=true;$('#lock').style.display='flex';
  if(!rec||!(rec.resetExp>Date.now())){showLock('signin');$('#lm').textContent='This link is invalid or has expired. Please ask your Admin to send a new one.';TOKEN=null;return}
  TOKEN.rec=rec;showLock('setpw');
}
async function doSetPw(){
  const m=$('#lm'),p=$('#lp').value,rec=TOKEN&&TOKEN.rec;
  if(!rec){m.textContent='This link is no longer valid.';return}
  if(p.length<8){m.textContent='Use at least 8 characters for the password.';return}
  if(p!==$('#lp2').value){m.textContent='The two passwords do not match.';return}
  const salt=crypto.getRandomValues(new Uint8Array(16)),iter=150000;
  const patch={pwSalt:hex(salt),pwIter:iter,pwHash:await pbk(p,salt,iter),resetHash:'',resetExp:0,resetKind:'',locked:false,fails:0,alertPending:false,pwSetAt:new Date().toISOString()};
  if(rec.status==='Pending')patch.status='Active';
  try{await db.doc('users/'+rec.id).update(patch)}catch(e){m.textContent='Could not save the password. Make sure you have access to this page, then try again.';return}
  LFAIL[rec.id]=0;TOKEN=null;
  showLock('signin');$('#lu').value=rec.empId||'';
  m.style.color='#1a8f4c';m.textContent='Password saved. You can sign in now.';
}

// ---------- Lead notifications and WhatsApp (Admin only) ----------
let NOTIFY={},lastDigest=0;
const WA_DEFAULT='Hello {name}, thank you for your interest in NextS4 HANA SAP training (e-learning videos with live server access). Our team will contact you shortly. Reply here if you have any questions.';
const WAICON='<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 1 1-4.2 15.2l-.3-.2-2.9.8.8-2.8-.2-.3A8.2 8.2 0 0 1 12 3.8zm-3 4c-.2 0-.5.1-.7.4-.3.4-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.5 2.6 1 3.1.8 3.7.8.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.7-.4l-2.1-1c-.3-.1-.5-.1-.7.2l-1 1.2c-.2.2-.3.3-.6.1-.9-.4-2-1-3-2.4-.2-.4 0-.5.2-.7l.5-.6.3-.5c.1-.2 0-.4 0-.5l-1-2.3c-.2-.6-.5-.5-.7-.5z"/></svg>';
function startSettings(){if(!db)return;db.collection('settings').onSnapshot(s=>{const d=s.docs.find(x=>x.id==='notify');NOTIFY=d?d.data():{};const v=s.docs.find(x=>x.id==='validation'),j=v?JSON.stringify(v.data().lists||{}):'';if(j!==lastVld){lastVld=j;if(v)applyValidation(v.data().lists)}},e=>{})}
function adminEmails(){const t=ALLUSERS.filter(u=>!u.deleted&&u.category==='Admin'&&u.status!=='Inactive'&&MAILRE.test(u.email||'')).map(u=>u.email);if(ME&&ME.email&&MAILRE.test(ME.email))t.push(ME.email);return [...new Set(t)]}
function leadDigestMail(list){
  const n=list.length,show=list.slice(0,20),more=n>20?n-20:0;
  const subject='New leads added: '+n;
  const ph=l=>(l.phone&&l.phone!=='0')?l.phone:'no phone';
  const lines=show.map(l=>'  '+(l.leadNo||'-')+'  '+(l.name||l.email||'-')+'  |  '+ph(l)+'  |  '+(l.source||'-')+'  |  '+(l.module||'-'));
  const body=['Hello,','',n+' new lead'+(n===1?' was':'s were')+' added to the CRM.','',...lines,...(more?['  ...and '+more+' more']:[]),'','Open the CRM: '+CRM_URL,'','NextS4 HANA CRM'].join('\n');
  const rows=show.map(l=>'<tr><td style="padding:6px 12px 6px 0;font-weight:700;color:#07294d">'+esc(l.leadNo||'-')+'</td><td style="padding:6px 12px 6px 0">'+esc(l.name||l.email||'-')+'</td><td style="padding:6px 12px 6px 0;color:#475569">'+esc(ph(l))+'</td><td style="padding:6px 12px 6px 0;color:#475569">'+esc(l.source||'-')+'</td><td style="padding:6px 0;color:#475569">'+esc(l.module||'-')+'</td></tr>').join('');
  const html='<div style="font-family:Segoe UI,Arial,sans-serif;max-width:600px;color:#1b1f24;line-height:1.55"><div style="background:#0a4d8c;color:#fff;padding:16px 22px;border-radius:10px 10px 0 0;font-size:18px;font-weight:700">New leads added</div><div style="border:1px solid #d6e4f1;border-top:none;padding:22px;border-radius:0 0 10px 10px"><p><b>'+n+'</b> new lead'+(n===1?' was':'s were')+' added to the CRM.</p><table style="border-collapse:collapse;margin:8px 0 16px;font-size:14px">'+rows+'</table>'+(more?'<p style="color:#475569">...and '+more+' more.</p>':'')+'<p style="margin:18px 0"><a href="'+CRM_URL+'" style="background:#0a4d8c;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;display:inline-block">Open the CRM</a></p><p style="color:#475569;font-size:13px">NextS4 HANA CRM</p></div></div>';
  return {subject,body,html};
}
async function processNotifs(){
  if(!isAdmin()||!db||!NOTIFY.emailNew||Date.now()-lastDigest<10*60000)return;
  const pend=leads.filter(l=>l.notifyPending);
  if(!pend.length)return;
  lastDigest=Date.now();
  const to=adminEmails();if(!to.length)return;
  const r=await gmailSend(to,leadDigestMail(pend));
  if(r.ok)pend.forEach(l=>db.doc('leads/'+l.id).update({notifyPending:false}).catch(()=>{}));
  else if(r.code==='server_unavailable'||r.code==='upstream_error')showNote('The new-lead summary email may or may not have been sent. Check your Gmail Sent folder.');
  else showNote('New-lead summary email not sent: '+mailWhy(r.code));
}
$('#gnotif').onclick=()=>{if(!isAdmin())return;$('#gmenu').hidden=true;$('#nt_email').checked=!!NOTIFY.emailNew;$('#nt_cc').value=NOTIFY.cc||'91';$('#nt_wa').value=NOTIFY.waText||WA_DEFAULT;$('#nt_m').textContent='';$('#ntdlg').showModal()};
$('#nt_x').onclick=()=>$('#ntdlg').close();
$('#nt_save').onclick=async()=>{
  const m=$('#nt_m'),cc=$('#nt_cc').value.replace(/\D/g,''),text=$('#nt_wa').value.trim();
  if(!isAdmin()||!db){m.textContent='Only an Admin can change these settings.';return}
  if(cc.length<1||cc.length>3){m.textContent='Enter a country code of 1 to 3 digits.';return}
  if(text.length<5){m.textContent='Enter the WhatsApp message.';return}
  try{await db.doc('settings/notify').set({emailNew:$('#nt_email').checked,cc,waText:text,updatedBy:whoAmI(),updated:today()});$('#ntdlg').close()}catch(e){m.textContent='Could not save the settings. Try again.'}
};
function waNumber(ph){let d=String(ph||'').replace(/\D/g,'');if(!d||d==='0')return '';const cc=String(NOTIFY.cc||'91');if(d.startsWith('00'))d=d.slice(2);else if(d.length===11&&d[0]==='0')d=cc+d.slice(1);else if(d.length===10)d=cc+d;return(d.length>=9&&d.length<=15)?d:''}
const waFill=(t,l)=>t.replace(/\{name\}/g,l.name||'there').replace(/\{leadNo\}/g,l.leadNo||'').replace(/\{category\}/g,l.module||'');
let waRec=null,waNum='';
function waLink(){return 'https://wa.me/'+waNum+'?text='+encodeURIComponent($('#wa_text').value)}
function openWa(id){
  const l=leads.find(x=>x.id===id);if(!l||!isAdmin())return;
  const num=waNumber(l.phone);
  if(!num){showNote('This lead has no valid phone number for WhatsApp.');return}
  waRec=l;waNum=num;
  $('#wa_s').textContent='To: '+(l.name||l.email||l.leadNo)+' (+'+num+')';
  $('#wa_text').value=waFill(NOTIFY.waText||WA_DEFAULT,l);
  $('#wa_go').href=waLink();$('#wadlg').showModal();
}
$('#wa_text').addEventListener('input',()=>{$('#wa_go').href=waLink()});
$('#wa_go').addEventListener('click',()=>{if(waRec)logAct('lead',waRec,'whatsapp','Chat opened with +'+waNum)});
$('#wa_copy').onclick=()=>{const t=$('#wa_text');t.select();try{document.execCommand('copy')}catch(e){}};
$('#wa_x').onclick=()=>$('#wadlg').close();
document.addEventListener('click',e=>{const w=e.target.closest('[data-wa]');if(w){openWa(w.dataset.wa)}});

// ---------- Data validation manager (Admin only) ----------
let lastVld='',VST=null,vlCur='source';
const sl=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
const PAYSTAT=['Paid','Follow-up','Refund'];
// To make another list editable, add one entry here: label, the array it controls, locked built-in values, and the record field it is stored in.
const VL={
  source:{label:'Source',arr:()=>SOURCES,prot:[],field:['leads','source']},
  category:{label:'Category',arr:()=>MODS,prot:['Not Specified'],field:['leads','module']},
  payMode:{label:'Payment Mode',arr:()=>PAYMODES,prot:[],field:['leads','payMode']},
  payType:{label:'Payment Type',arr:()=>PTYPES,prot:[],field:['leads','payType']},
  tenure:{label:'Tenure Month',arr:()=>TENURES,prot:[],field:['leads','tenure']},
  nextStep:{label:'Next Step',arr:()=>ACTIONS,prot:['Paid','Refund','Payment follow-up','Send pricing'],field:['leads','nextAction']},
  userCat:{label:'User Category',arr:()=>UCATS,prot:['Admin','User'],field:['users','category']},
  userStatus:{label:'User Status',arr:()=>USTAT,prot:['Active','Inactive','Pending'],field:['users','status']}
};
const optHtml=(list,ph)=>(ph?'<option value="">'+ph+'</option>':'')+list.map(v=>'<option>'+esc(v)+'</option>').join('');
function fillSelects(){
  const put=(id,html)=>{const el=$('#'+id);if(!el)return;const v=el.value;el.innerHTML=html;if([...el.options].some(o=>o.value===v))el.value=v};
  put('src',optHtml(SOURCES,'Select'));put('m',optHtml(MODS,'Select'));
  put('psrc',optHtml(SOURCES,'Select'));put('pm',optHtml(MODS,'Select'));put('pst',optHtml(PAYSTAT,'Select'));
  put('ppm',optHtml(PAYMODES,'Select'));put('ptn',optHtml(TENURES,'Select'));put('ppt',optHtml(PTYPES,'Select'));
  put('eps',optHtml(PAYSTAT,''));put('epm',optHtml(PAYMODES,'Select'));put('etn',optHtml(TENURES,'Select'));put('ept',optHtml(PTYPES,'Select'));
  put('ucat',optHtml(UCATS,'Select'));put('ust',optHtml(USTAT,'Select'));put('ued_c',optHtml(UCATS,''));put('ued_s',optHtml(USTAT,''));
}
function applyValidation(lists){
  if(!lists)return;
  Object.keys(VL).forEach(k=>{const v=lists[k];if(!Array.isArray(v)||!v.length)return;const nv=v.map(String);VL[k].prot.forEach(x=>{if(!nv.includes(x))nv.push(x)});const arr=VL[k].arr();arr.splice(0,arr.length,...nv)});
  fillSelects();render();renderUsers();
}
function vlOpen(){
  if(!isAdmin())return;
  VST={};Object.keys(VL).forEach(k=>{VST[k]=VL[k].arr().map(t=>({orig:t,text:t}))});
  vlCur='source';$('#vl_m').textContent='';$('#gmenu').hidden=true;vlDraw();$('#vldlg').showModal();
}
function vlDraw(){
  $('#vl_list').innerHTML=Object.keys(VL).map(k=>'<option value="'+k+'"'+(k===vlCur?' selected':'')+'>'+VL[k].label+'</option>').join('');
  const cfg=VL[vlCur];
  $('#vl_items').innerHTML=VST[vlCur].map((it,i)=>{const lk=cfg.prot.includes(it.orig);return '<div class="vrow"><input data-vi="'+i+'" value="'+esc(it.text)+'" maxlength="40"'+(lk?' disabled title="Built-in value used by the app"':'')+'><button type="button" data-vup="'+i+'" title="Move up">\u2191</button><button type="button" data-vdn="'+i+'" title="Move down">\u2193</button>'+(lk?'<span class="vlk" title="Built-in value used by the app">\ud83d\udd12</span>':'<button type="button" class="x" data-vrm="'+i+'" title="Remove">\u2715</button>')+'</div>'}).join('');
  $('#vl_note').textContent=cfg.prot.length?'Locked values are used by the app and cannot be renamed or removed. You can add more.':'';
}
function vlCheck(k,items){
  const L=VL[k].label,texts=items.map(i=>i.text.trim());
  if(!texts.length)return L+': keep at least one option.';
  if(texts.some(t=>!t))return L+': options cannot be empty.';
  const low=texts.map(t=>t.toLowerCase());
  if(new Set(low).size!==low.length)return L+': each option must be different.';
  if(k==='source'){const sg=texts.map(sl);if(sg.some(x=>!x))return 'Source names need letters or numbers (a-z, 0-9).';if(new Set(sg).size!==sg.length)return 'Two source names are too similar. Make them differ by letters or numbers.'}
  if(k==='tenure'&&texts.some(t=>!/^\d{1,3}$/.test(t)))return 'Tenure Month options must be numbers.';
  for(const it of items){if(it.orig!=null&&it.orig!==it.text.trim()&&items.some(o=>o!==it&&o.orig===it.text.trim()))return L+': "'+it.text.trim()+'" clashes with an existing option.'}
  return '';
}
async function vlSave(){
  const m=$('#vl_m');
  if(!isAdmin()||!db){m.textContent='Only an Admin can change these lists.';return}
  const lists={},renames=[];
  for(const k of Object.keys(VL)){
    const err=vlCheck(k,VST[k]);if(err){m.textContent=err;vlCur=k;vlDraw();return}
    lists[k]=VST[k].map(i=>i.text.trim());
    VST[k].forEach(i=>{if(i.orig!=null&&i.orig!==i.text.trim())renames.push([k,i.orig,i.text.trim()])});
  }
  m.textContent='Saving...';
  try{await db.doc('settings/validation').set({lists,updatedBy:whoAmI(),updated:today()})}catch(e){m.textContent='Could not save. Try again.';return}
  let n=0;
  for(const [k,old,nw] of renames){
    const [kind,f]=VL[k].field,src=kind==='leads'?ALLLEADS:ALLUSERS,col=kind==='leads'?'leads/':'users/';
    for(const r of src.filter(x=>x[f]===old)){try{await db.doc(col+r.id).update({[f]:nw});n++}catch(e){}}
  }
  lastVld=JSON.stringify(lists);applyValidation(lists);
  $('#vldlg').close();
  if(n){const nt=$('#note');nt.textContent='Updated '+n+' existing record'+(n===1?'':'s')+' to the renamed options.';nt.style.color='#1a8f4c';nt.style.fontWeight='700';setTimeout(()=>{nt.textContent=''},7000)}
}
$('#gvld').onclick=vlOpen;
$('#vl_list').onchange=()=>{vlCur=$('#vl_list').value;vlDraw()};
$('#vl_items').addEventListener('input',e=>{const i=e.target.dataset.vi;if(i!==undefined)VST[vlCur][+i].text=e.target.value});
$('#vl_items').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;const a=VST[vlCur];
  if(b.dataset.vrm!==undefined)a.splice(+b.dataset.vrm,1);
  else if(b.dataset.vup!==undefined){const i=+b.dataset.vup;if(i>0)[a[i-1],a[i]]=[a[i],a[i-1]]}
  else if(b.dataset.vdn!==undefined){const i=+b.dataset.vdn;if(i<a.length-1)[a[i+1],a[i]]=[a[i],a[i+1]]}
  vlDraw();
});
const vlAdd=()=>{const v=$('#vl_new').value.trim();if(!v)return;VST[vlCur].push({orig:null,text:v});$('#vl_new').value='';vlDraw()};
$('#vl_add').onclick=vlAdd;
$('#vl_new').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();vlAdd()}});
$('#vl_x').onclick=()=>$('#vldlg').close();
$('#vl_save').onclick=vlSave;

// ---------- Users page ----------
let USERS=[],utab='All',pgU=1;
const UT={users:'All','users-active':'Active','users-inactive':'Inactive','users-pending':'Pending','users-deleted':'Deleted'};
const ULABEL={All:'All Users',Active:'Active',Inactive:'In-Active',Pending:'Pending',Deleted:'Deleted Items'};
const UCATS=['Admin','User'],USTAT=['Active','Inactive','Pending'];
const UHEAD=['Employee Id','Date of Joining','First Name','Last Name','Email','Phone','User Category','Status'];
const USAMPLE=['EMP-0001','2026-11-01','Ravi','Kumar','ravi@example.com','9876543210','User','Active'];
const MAILRE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uNo=n=>'EMP-'+String(n).padStart(4,'0');
const uNum=u=>parseInt(String(u.empId||'').replace(/\D/g,''),10)||0;
const ciOf=(arr,v)=>arr.find(x=>x.toLowerCase()===String(v).toLowerCase())||'';
function startUsers(){if(!db)return;db.collection('users').onSnapshot(s=>{ALLUSERS=s.docs.map(d=>({id:d.id,...d.data()}));USERS=ALLUSERS.filter(u=>!u.deleted);computeRole()},e=>{})}
function usersList(){
  const q=$('#uq').value.toLowerCase().trim();
  const base=utab==='Deleted'?ALLUSERS.filter(u=>u.deleted):USERS;
  return base.filter(u=>(utab==='All'||utab==='Deleted'||u.status===utab)&&(!q||[u.empId,u.name,u.lastName,u.email,u.phone].join(' ').toLowerCase().includes(q))).sort((a,b)=>uNum(a)-uNum(b));
}
function renderUsers(){
  const n=s=>USERS.filter(u=>u.status===s).length,ad=isAdmin(),q=$('#uq').value.trim();
  const tabs=[['All','All Users ('+USERS.length+')','users'],['Active','Active ('+n('Active')+')','users-active'],['Inactive','In-Active ('+n('Inactive')+')','users-inactive'],['Pending','Pending ('+n('Pending')+')','users-pending']];
  tabs.push(['Deleted','Deleted Items ('+ALLUSERS.filter(u=>u.deleted).length+')','users-deleted']);
  $('#utabs').innerHTML=tabs.map(([k,t,h])=>'<a class="'+(utab===k?'on':'')+'" href="#'+h+'">'+t+'</a>').join('');
  const ei=$('#ueid');if(!ei.value||ei.dataset.auto==='1'){ei.value=uNo(Math.max(0,...ALLUSERS.map(uNum))+1);ei.dataset.auto='1'}
  if(!$('#udoj').value)$('#udoj').value=today();
  const list=usersList(),pages=Math.max(1,Math.ceil(list.length/PS));pgU=Math.min(pgU,pages);
  $('#uhead').textContent='Users: '+ULABEL[utab]+' ('+list.length+')'+(q?' \u00b7 search: \u201c'+q+'\u201d':'');
  $('#ufoot').innerHTML=$('#utop').innerHTML=pagerHtml('U',list.length,pgU,pages);
  const sc={Active:'Interested',Inactive:'Not-Interested',Pending:'Hold'},dis=ad?'':' disabled';
  $('#urows').innerHTML=list.length?list.slice((pgU-1)*PS,pgU*PS).map(u=>{
    const act0=u.deleted?'<button class="rs" data-urestore="'+u.id+'" title="Restore" aria-label="Restore">\u21ba</button>':'<label class="sw" title="'+(ad?'Turn this user on or off':'Only an Admin can change this')+'"><input type="checkbox" data-utog="'+u.id+'"'+(u.status==='Active'?' checked':'')+dis+'><span></span></label><button class="ml" data-ureset="'+u.id+'" title="Send password reset link" aria-label="Send password reset link">\ud83d\udd11</button><button class="ml" data-umail="'+u.id+'\" title="Send activation email" aria-label="Send activation email">\u2709</button><button data-uedit="'+u.id+'" title="Edit user\" aria-label="Edit user"><span style="display:inline-block;transform:scaleX(-1)">\u270e</span></button> <button class="x" data-udel="'+u.id+'" title="Delete">\u2715</button>';
    const act='<button class="al" data-uact="'+u.id+'" title="Activity log" aria-label="Activity log">'+ALOG+'</button>'+act0;
    return '<tr class="st-'+(sc[u.status]||'New')+(u.deleted?' dl':'')+'"><td class="lno"><b>'+esc(u.empId)+'</b></td><td>'+esc(u.doj)+'</td><td><b>'+(esc(u.name)||'(no name)')+'</b></td><td><b>'+esc(u.lastName)+'</b></td><td>'+mailLink(u.email)+'</td><td>'+esc(u.phone??'0')+'</td><td><select data-uf="category" data-id="'+u.id+'"'+dis+'>'+UCATS.map(c=>'<option'+(c===u.category?' selected':'')+'>'+c+'</option>').join('')+'</select></td><td><select data-uf="status" data-id="'+u.id+'"'+dis+'>'+USTAT.map(c=>'<option'+(c===u.status?' selected':'')+'>'+c+'</option>').join('')+'</select>'+(u.locked?'<span class="lk">Locked</span>':'')+'</td><td style="white-space:nowrap">'+act+'</td></tr>';
  }).join(''):'<tr><td colspan="9" class="empty">No users in this view yet. Add a user above or import a file.</td></tr>';
}
$('#ueid').addEventListener('input',()=>{$('#ueid').dataset.auto='0'});
$('#uq').addEventListener('input',()=>{pgU=1;renderUsers()});
const umsg=(t,err)=>{const m=$('#umsg');m.style.color=err?'#c0392b':'#07294d';m.textContent=t};
$('#uadd').onclick=async()=>{
  const eid=$('#ueid').value.trim(),name=$('#un').value.trim(),last=$('#uln').value.trim(),email=$('#ue').value.trim(),cat=$('#ucat').value,st=$('#ust').value;
  if(!eid){umsg('Enter an Employee Id.',1);return}
  if(ALLUSERS.some(u=>String(u.empId).toLowerCase()===eid.toLowerCase())){umsg('This Employee Id already exists.',1);return}
  if(!name){umsg('Enter the first name.',1);return}
  if(!MAILRE.test(email)){umsg('Enter a valid email address.',1);return}
  const dm=dupMsg(email,$('#uph').value);if(dm){umsg(dm,1);return}
  if(!cat){umsg('Select a user category: Admin or User.',1);return}
  if(!st){umsg('Select a status: Active, Inactive or Pending.',1);return}
  if(!db){umsg('Storage is not available.',1);return}
  umsg('');
  const rec={empId:eid,doj:$('#udoj').value||today(),name,lastName:last,email,phone:normPhone($('#uph').value),category:cat,status:st,created:today()};
  const ref=await db.collection('users').add(rec);
  sendActivation({...rec,id:ref.id},false);
  ['un','uln','ue','uph'].forEach(i=>$('#'+i).value='');$('#ucat').value='';$('#ust').value='';$('#ueid').dataset.auto='1';$('#ueid').value='';renderUsers();shut($('#uaddtog'),$('#ubar'));
};
document.addEventListener('change',e=>{const t=e.target;if(!(t.dataset&&t.dataset.utog))return;if(!isAdmin()||!db){t.checked=!t.checked;return}db.doc('users/'+t.dataset.utog).update({status:t.checked?'Active':'Inactive'}).catch(()=>{})});
document.addEventListener('change',e=>{const t=e.target;if(!(t.dataset&&t.dataset.uf))return;const v=t.value;if(!isAdmin()||!(t.dataset.uf==='category'?UCATS:USTAT).includes(v)||!db)return;db.doc('users/'+t.dataset.id).update({[t.dataset.uf]:v}).catch(()=>{})});
let uEdit=null;
function openUEdit(id){const u=USERS.find(x=>x.id===id);if(!u)return;uEdit=id;$('#ued_id').value=u.empId||'';$('#ued_doj').value=u.doj||'';$('#ued_n').value=u.name||'';$('#ued_ln').value=u.lastName||'';$('#ued_e').value=u.email||'';$('#ued_p').value=u.phone??'0';$('#ued_c').value=u.category||'User';$('#ued_s').value=u.status||'Pending';$('#ued_c').disabled=$('#ued_s').disabled=!isAdmin();$('#ued_m').textContent='';$('#udlg').showModal()}
$('#ued_x').onclick=()=>$('#udlg').close();
$('#ued_save').onclick=async()=>{
  const m=$('#ued_m'),eid=$('#ued_id').value.trim(),name=$('#ued_n').value.trim(),email=$('#ued_e').value.trim();
  if(!eid){m.textContent='Enter an Employee Id.';return}
  if(ALLUSERS.some(u=>u.id!==uEdit&&String(u.empId).toLowerCase()===eid.toLowerCase())){m.textContent='This Employee Id already exists.';return}
  if(!name){m.textContent='Enter the first name.';return}
  if(!MAILRE.test(email)){m.textContent='Enter a valid email address.';return}
  const dm=dupMsg(email,$('#ued_p').value,'user',uEdit);if(dm){m.textContent=dm;return}
  const patch={empId:eid,doj:$('#ued_doj').value||today(),name,lastName:$('#ued_ln').value.trim(),email,phone:isAdmin()?normPhone($('#ued_p').value):((ALLUSERS.find(x=>x.id===uEdit)||{}).phone??'0')};
  if(isAdmin()){patch.category=$('#ued_c').value;patch.status=$('#ued_s').value}
  try{await db.doc('users/'+uEdit).update(patch);$('#udlg').close()}catch(e){m.textContent='Could not save. Try again.'}
};
document.addEventListener('click',e=>{
  const ur2=e.target.closest('[data-ureset]');if(ur2){const r=USERS.find(x=>x.id===ur2.dataset.ureset);if(r&&isAdmin())initReset(r);return}
  const um=e.target.closest('[data-umail]');if(um){const r=USERS.find(x=>x.id===um.dataset.umail);if(r&&isAdmin())sendActivation(r,true);return}
  const ua=e.target.closest('[data-uact]');if(ua){openAct('user',ua.dataset.uact);return}
  const ed=e.target.closest('[data-uedit]');if(ed){const r=ALLUSERS.find(x=>x.id===ed.dataset.uedit);if(r)askReason('user',r,'edit',()=>openUEdit(r.id));return}
  const dl=e.target.closest('[data-udel]');
  if(dl){const r=ALLUSERS.find(x=>x.id===dl.dataset.udel);if(r&&isAdmin())askReason('user',r,'delete',()=>{if(db)db.doc('users/'+r.id).update({deleted:true,deletedAt:today()}).catch(()=>{})})}
});
$('#utpl').onclick=()=>saveFile('users-import-template.csv',UHEAD.join(',')+'\n'+USAMPLE.join(',')+'\n');
$('#uimp').onclick=()=>$('#ufile').click();
$('#ufile').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  umsg('Reading file...');
  let rows=[];
  try{rows=await readRowsFromFile(f)}catch(err){umsg(err.message==='xlsx'?'Excel library could not load. Save the file as CSV and import again.':'Could not read this file.',1);return}
  rows=rows.filter(r=>r.some(c=>String(c).trim()!==''));
  if(!rows.length){umsg('The file is empty.',1);return}
  let idx=UHEAD.map((x,i)=>i);const h=rows[0].map(c=>String(c).trim().toLowerCase());
  if(h.includes('email')||h.includes('first name')||h.includes('employee id')){idx=UHEAD.map(x=>h.indexOf(x.toLowerCase()));rows=rows.slice(1)}
  if(!db){umsg('Storage is not available.',1);return}
  const ids=new Set(ALLUSERS.map(u=>String(u.empId).toLowerCase())),mails=new Set(),phones=new Set();
  let n=Math.max(0,...ALLUSERS.map(uNum)),ok=0,dup=0,bad=0;
  for(const r of rows){const g=i=>i<0?'':String(r[i]??'').trim();
    const name=g(idx[2]),email=g(idx[4]);
    if(!name||!MAILRE.test(email)||/@example\.com$/i.test(email)){bad++;continue}
    let eid=g(idx[0]);if(!eid){n++;eid=uNo(n)}
    const pk=phoneKey(g(idx[5]));
    if(ids.has(eid.toLowerCase())||mails.has(email.toLowerCase())||(pk&&phones.has(pk))||dupMsg(email,g(idx[5]))){dup++;continue}
    ids.add(eid.toLowerCase());mails.add(email.toLowerCase());if(pk)phones.add(pk);
    await db.collection('users').add({empId:eid,doj:g(idx[1])?normDate(g(idx[1])):today(),name,lastName:g(idx[3]),email,phone:normPhone(g(idx[5])),category:ciOf(UCATS,g(idx[6]))||'User',status:ciOf(USTAT,g(idx[7]))||'Pending',created:today()});ok++}
  umsg('Imported '+ok+' user'+(ok===1?'':'s')+(dup?', skipped '+dup+' duplicate'+(dup===1?'':'s')+' (id, email or phone already exists)':'')+(bad?', skipped '+bad+' invalid or sample row'+(bad===1?'':'s'):'')+'.');
};
$('#uexp').onclick=()=>{if(!isAdmin())return;const q=s=>'"'+String(s??'').replace(/"/g,'""')+'"';const rows=usersList().map(u=>[u.empId,u.doj,u.name,u.lastName,u.email,u.phone??'0',u.category,u.status].map(q).join(','));saveFile('users-'+utab.toLowerCase()+'.csv',[UHEAD.map(q).join(',')].concat(rows).join('\n'))};
let HIDE={m:[],ms:[],s:[],ss:[]},MON=[];
try{const j=JSON.parse(localStorage.getItem('crm-hide')||'null');if(j)HIDE=Object.assign(HIDE,j)}catch(e){}
function saveHide(){try{localStorage.setItem('crm-hide',JSON.stringify(HIDE))}catch(e){}}
const ST=[['all','Total Leads'],['interested','Interested'],['not-interested','Not Interested'],['hold','On Hold'],['payment','Payment']];
const CFG={month:[['m','Month wise',()=>MON],['ms','Status wise',()=>ST]],source:[['s','Source wise',()=>SOURCES.map(s=>[s,s])],['ss','Status wise',()=>ST]]};
function closePops(){ccOpen=null;document.querySelectorAll('.pop').forEach(p=>p.hidden=true)}
function fillPop(k){
  const grp=([key,title,items])=>'<fieldset><legend>'+title+'</legend>'+items().map(([v,l])=>'<label class="ck"><input type="checkbox" data-g="'+key+'" data-k="'+v+'"'+(HIDE[key].includes(v)?'':' checked')+'> '+l+'</label>').join('')+'</fieldset>';
  $('#pop-'+k).innerHTML=CFG[k].map(grp).join('')+'<div class="pbar"><span class="pmsg"></span><button class="lnk" data-reset="'+k+'" type="button">Select all</button><button class="p" data-closepop="1" type="button">Done</button></div>';
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-cust]');
  if(b){const k=b.dataset.cust,p=$('#pop-'+k),open=p.hidden;closePops();if(open){fillPop(k);p.hidden=false}return}
  const r=e.target.closest('[data-reset]');
  if(r){const k=r.dataset.reset;if(k==='month'){HIDE.m=[];HIDE.ms=[]}else{HIDE.s=[];HIDE.ss=[]}saveHide();fillPop(k);render();return}
  if(e.target.closest('[data-closepop]')||!e.target.closest('.pop'))closePops();
});
document.addEventListener('change',e=>{
  const t=e.target;if(!(t.dataset&&t.dataset.g))return;
  const g=t.dataset.g,pop=t.closest('.pop'),sel='input[data-g="'+g+'"]';
  if(!pop.querySelectorAll(sel+':checked').length){t.checked=true;pop.querySelector('.pmsg').textContent='Keep at least one selected.';return}
  pop.querySelector('.pmsg').textContent='';
  HIDE[g]=[...pop.querySelectorAll(sel+':not(:checked)')].map(i=>i.dataset.k);saveHide();render();
});
function boxHtml(title,L,sc,top,hid){hid=hid||[];
  const st=top?' style="border-top-color:'+top+'"':'';
  const c=s=>L.filter(l=>l.status===s).length;
  const a=(cat,cls,label,n)=>'<a class="'+cls+'" href="#'+sc+'-'+cat+'"><span>'+label+'</span><b>'+n+'</b></a>';
  return '<div class="mbox"'+st+'><h4>'+title+'</h4>'+(hid.includes('all')?'':'<div class="tot"><a href="#'+sc+'-all" title="Show all leads">'+L.length+' <small style="font-size:12px;font-weight:700;color:#475569">Total Leads</small></a></div>')+'<div class="ic">'+(hid.includes('interested')?'':a('interested','k-i','Interested',c('Interested')))+(hid.includes('not-interested')?'':a('not-interested','k-n','Not Interested',c('Not Interested')))+(hid.includes('hold')?'':a('hold','k-h','On Hold',c('Hold')))+(hid.includes('payment')?'':a('payment','k-p','Payment',c('Converted')))+'</div></div>'}
function renderSources(){
  const n=(L,st)=>L.filter(l=>l.status===st).length;
  $('#srcw').innerHTML=SOURCES.filter(s=>!HIDE.s.includes(s)).map(s=>{const L=leads.filter(l=>(l.source||'')===s);
    return boxHtml(s,L,'s-'+sl(s),null,HIDE.ss)}).join('');
}
function render90(){
  const dt=l=>(l.date||l.created||'');
  const t=today(),s=new Date();s.setDate(s.getDate()-90);const start=iso(s);
  const n=(L,st)=>L.filter(l=>l.status===st).length;
  const box=(title,L,sc,top)=>boxHtml(title,L,sc,top,HIDE.ms);
  MON=[['d90','Last 90 days']];const out=HIDE.m.includes('d90')?[]:[box('Last 90 days',leads.filter(l=>dt(l)>=start&&dt(l)<=t),'d90','#07294d')];
  let y=s.getFullYear(),m=s.getMonth()+1;const cur=t.slice(0,7);
  for(;;){const k=y+'-'+String(m).padStart(2,'0');
    const L=leads.filter(l=>dt(l).slice(0,7)===k&&dt(l)<=t);
    if(k>='2026-10')MON.push(['m-'+k,monthLabel(k)]);if(k>='2026-10'&&!HIDE.m.includes('m-'+k))out.push(box(new Date(y,m-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'})+(k===cur?' (Current Month)':''),L,'m-'+k));
    if(k>=cur)break;m++;if(m>12){m=1;y++}}
  $('#d90').innerHTML=out.join('');
}
function renderMonths(){
  const ym=l=>(l.date||l.created||'').slice(0,7);
  const cur=today().slice(0,7);
  let last='2027-12';const mx=leads.map(ym).filter(Boolean).sort().pop();
  if(mx&&mx>last)last=mx;if(cur>last)last=cur;
  const keys=[];let y=2026,m=11;
  while((y+'-'+String(m).padStart(2,'0'))<=last){keys.push(y+'-'+String(m).padStart(2,'0'));m++;if(m>12){m=1;y++}}
  const rows=keys.map(k=>{const L=leads.filter(l=>ym(l)===k);const n=s=>L.filter(l=>l.status===s).length;const p=k.split('-');
    return {k,label:new Date(+p[0],+p[1]-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'}),t:L.length,i:n('Interested'),ni:n('Not Interested'),h:n('Hold'),c:n('Converted')}});
  const mt=Math.max(1,...rows.map(r=>r.t));const sum=f=>rows.reduce((a,r)=>a+r[f],0);
  $('#mrows').innerHTML=rows.map(r=>`<div class="mbox${r.k===cur?' cur':''}"><h4>📅 ${r.label}${r.k===cur?' · now':''}</h4><div class="tot">${r.t}</div><div class="ic"><span title="Interested">👍 ${r.i}</span><span title="Not Interested">🚫 ${r.ni}</span><span title="On hold">⏸️ ${r.h}</span><span title="Converted">🏆 ${r.c}</span></div></div>`).join('')
  +`<div class="mbox" style="border-top-color:#07294d"><h4>📊 Total</h4><div class="tot">${sum('t')}</div><div class="ic"><span>👍 ${sum('i')}</span><span>🚫 ${sum('ni')}</span><span>⏸️ ${sum('h')}</span><span>🏆 ${sum('c')}</span></div></div>`;
}
$('#esave').onclick=async()=>{const dm=dupMsg($('#ee').value,$('#ep').value,'lead',editId);if(dm){$('#emsg').textContent=dm;return}if(!SOURCES.includes($('#es').value)){$('#emsg').textContent='Select a source.';return}if(!MODS.includes($('#em').value)){$('#emsg').textContent='Select a category.';return}await save(editId,{...editExtra(),notes:$('#enotes').value,name:$('#en').value.trim(),email:$('#ee').value.trim(),phone:isAdmin()?normPhone($('#ep').value):((leads.find(x=>x.id===editId)||{}).phone??'0'),date:$('#ed').value||today(),source:$('#es').value,module:$('#em').value});$('#edlg').close()};
const HEAD=['Name','Email','Phone','Date','Source','Module'];
const SAMPLE=['Ravi Kumar','ravi@example.com','9876543210','2026-11-15','Srinivas','Server + Videos'];
function csvParse(txt){const rows=[];let r=[],c='',q=false;txt=txt.replace(/^\uFEFF/,'');
  for(let i=0;i<txt.length;i++){const ch=txt[i];
    if(q){if(ch==='"'){if(txt[i+1]==='"'){c+='"';i++}else q=false}else c+=ch}
    else if(ch==='"')q=true;
    else if(ch===','){r.push(c);c=''}
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&txt[i+1]==='\n')i++;r.push(c);rows.push(r);r=[];c=''}
    else c+=ch}
  if(c!==''||r.length){r.push(c);rows.push(r)}return rows}
function normDate(v){v=String(v||'').trim();let m;
  if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;
  if(m=v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/))return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
  return today()}
async function saveFile(filename,data){
  try{const d=await claude.use('downloads');if(d){await d.save({filename,data});return}}catch(e){if(e&&e.code==='declined')return}
  $('#impmsg').textContent=$('#note').textContent='Download is not available in this view.'}
$('#tcsv').onclick=()=>saveFile('leads-import-template.csv',HEAD.join(',')+'\n'+SAMPLE.join(',')+'\n');
$('#file').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  const msg=$('#impmsg');msg.style.color='#07294d';msg.textContent='Reading file...';
  let rows=[];
  try{
    if(/\.csv$/i.test(f.name))rows=csvParse(await f.text());
    else{if(!window.XLSX){msg.textContent='Excel library could not load. Save the file as CSV and import again.';return}
      const wb=XLSX.read(await f.arrayBuffer(),{type:'array',cellDates:true});
      rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:false,dateNF:'yyyy-mm-dd',defval:''})}
  }catch(err){msg.textContent='Could not read this file.';return}
  rows=rows.filter(r=>r.some(c=>String(c).trim()!==''));
  if(!rows.length){msg.textContent='The file is empty.';return}
  let idx=[0,1,2,3,4,5];const h=rows[0].map(c=>String(c).trim().toLowerCase());
  if(h.includes('email')||h.includes('name')){idx=HEAD.map(k=>h.indexOf(k.toLowerCase()));rows=rows.slice(1)}
  const seen=new Set(leads.map(l=>(l.email||'').toLowerCase()).filter(Boolean));
  let ok=0,dup=0,bad=0;const seenP=new Set();
  for(const r of rows){const g=i=>i<0?'':String(r[i]??'').trim();
    const name=g(idx[0]),email=g(idx[1]);
    if((!name&&!email)||/@example\.com$/i.test(email)){bad++;continue}
    if(dupMsg(email,g(idx[2]))||(email&&seen.has(email.toLowerCase()))||(phoneKey(g(idx[2]))&&seenP.has(phoneKey(g(idx[2]))))){dup++;continue}
    if(email)seen.add(email.toLowerCase());{const pk=phoneKey(g(idx[2]));if(pk)seenP.add(pk)}
    const src=SOURCES.find(s=>s.toLowerCase()===g(idx[4]).toLowerCase())||'';
    const mod=MODS.find(m=>m.toLowerCase()===g(idx[5]).toLowerCase())||'Not Specified';
    await create({name,email,phone:g(idx[2]),date:normDate(g(idx[3])),source:src,module:mod});ok++}
  msg.textContent='Imported '+ok+' lead'+(ok===1?'':'s')+(dup?', skipped '+dup+' duplicate'+(dup===1?'':'s')+' (email or phone already exists)':'')+(bad?', skipped '+bad+' invalid or sample row'+(bad===1?'':'s'):'')+'.'};
$('#exp').onclick=async()=>{
  if(!isAdmin())return;
  const h=['leadNo','name','email','phone','date','source','module','status','nextAction','nextDate','followups','notes','created','updated'];
  const csv=[h.join(',')].concat(CURLEADS.map(l=>h.map(k=>'"'+String(l[k]??'').replace(/"/g,'""')+'"').join(','))).join('\n');
  try{const d=await claude.use('downloads');if(d){await d.save({filename:'leads-'+String(tab).toLowerCase()+'.csv',data:csv});return}}catch(e){}
  $('#note').textContent='Download is not available in this view.';
};

const AUTH_KEY='crm-auth',IDLE_MS=30*60*1000;let idleT=null,fails=0,lockUntil=0,authDoc=null;
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const unhex=h=>new Uint8Array(h.match(/../g).map(x=>parseInt(x,16)));
async function pbk(pw,salt,iter){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:iter},k,256))}
function armIdle(){clearTimeout(idleT);idleT=setTimeout(logout,IDLE_MS)}
function unlock(){try{sessionStorage.setItem(AUTH_KEY,'1')}catch(e){}$('#lock').style.display='none';$('#app').hidden=false;$('#lp').value='';$('#lp2').value='';armIdle();paintProf();computeRole()}
let mode='signin';
function showLock(md){
  mode=md||(authDoc?'signin':'create');
  const act=TOKEN&&TOKEN.kind==='activate';
  const T={signin:['Sign in','Sign in'],create:['Create your login','Create login'],reset:['Reset password','Reset password'],setpw:[act?'Activate your account':'Set a new password','Save password']}[mode];
  $('#lt').textContent=T[0];$('#lgo').textContent=T[1];
  ['lp','lgo','lrow'].forEach(id=>$('#'+id).hidden=false);
  $('#lu').hidden=(mode==='reset'||mode==='setpw');$('#lrc').hidden=true;$('#lp2').hidden=mode==='signin';
  $('#lp').placeholder=(mode==='reset'||mode==='setpw')?'New password':'Password';
  $('#lforgot').textContent=mode==='reset'?'Back to sign in':'Forgot password?';
  $('#lforgot').hidden=(mode==='create'||mode==='setpw');
  $('#lp').type='password';$('#lp2').type='password';$('#lshow').textContent='Show password';
  $('#lrec').hidden=true;$('#lm').style.color='';$('#lm').textContent='';
}
function showRecovery(code){
  ['lu','lrc','lp','lp2','lgo','lrow'].forEach(id=>$('#'+id).hidden=true);
  $('#lt').textContent='Save your recovery code';$('#lcode').textContent=code;$('#lrec').hidden=false;$('#lm').textContent='';
}
function logout(){setSession(null);try{sessionStorage.removeItem(AUTH_KEY)}catch(e){}$('#app').hidden=true;$('#lock').style.display='flex';$('#lm').textContent='';showLock()}
['click','keydown','mousemove','touchstart'].forEach(ev=>document.addEventListener(ev,()=>{if(!$('#app').hidden)armIdle()},{passive:true}));
async function initLock(){
  const m=$('#lm');
  if(!db){m.textContent='Storage is not available, so sign-in cannot be checked. Reload the page.';return}
  try{const s=await db.doc('auth/admin').get();authDoc=s.exists?s.data():null}catch(e){m.textContent='Could not read the sign-in details. Reload the page.';return}
  showLock();
  let ok=false;try{ok=sessionStorage.getItem(AUTH_KEY)==='1'}catch(e){}
  if(ok&&authDoc)unlock();
  tryToken();
}
$('#lgo').onclick=async()=>{
  const m=$('#lm'),u=$('#lu').value.trim(),p=$('#lp').value;m.textContent='';
  if(!db)return;
  if(Date.now()<lockUntil){m.textContent='Too many attempts. Try again in '+Math.ceil((lockUntil-Date.now())/1000)+' seconds.';return}
  if(mode==='setpw'){await doSetPw();return}
  if(mode==='reset'){await doReset();return}
  if(!authDoc){
    if(!u){m.textContent='Enter a username.';return}
    if(p.length<8){m.textContent='Use at least 8 characters for the password.';return}
    if(p!==$('#lp2').value){m.textContent='The two passwords do not match.';return}
    const r=await makeDoc(u.toLowerCase(),p);
    try{await db.doc('auth/admin').set(r.doc);authDoc=r.doc;showRecovery(r.code)}catch(e){m.textContent='Could not save the login. Try again.'}
    return}
  if(u.toLowerCase()!==String(authDoc.user).toLowerCase()){await userLogin(u,p);return}
  const h=await pbk(p,unhex(authDoc.salt),authDoc.iter);
  if(h===authDoc.hash){fails=0;setSession(null);unlock();return}
  fails++;
  if(fails>=3){lockUntil=Date.now()+15*60000;fails=0;m.textContent='Too many failed attempts. This login is locked for 15 minutes.';sendLockAlert({name:authDoc.user,empId:'Main login account',email:'',fails:3});return}
  m.textContent='Incorrect username or password. '+(3-fails)+' attempt'+(3-fails===1?'':'s')+' left.';
};
['lu','lrc','lp','lp2'].forEach(id=>$('#'+id).addEventListener('keydown',e=>{if(e.key==='Enter')$('#lgo').click()}));
async function makeDoc(user,pw){
  const iter=150000,salt=crypto.getRandomValues(new Uint8Array(16)),rs=crypto.getRandomValues(new Uint8Array(16));
  const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',raw=[...crypto.getRandomValues(new Uint8Array(16))].map(x=>A[x%A.length]).join('');
  return {code:raw.match(/.{4}/g).join('-'),doc:{user,iter,salt:hex(salt),hash:await pbk(pw,salt,iter),rsalt:hex(rs),rhash:await pbk(raw,rs,iter),created:today()}};
}
async function isOwner(){try{const u=await claude.use('user');return u?((await u.isOwner())||(await u.canEdit())):false}catch(e){return false}}
async function doReset(){
  const m=$('#lm'),p=$('#lp').value,code=$('#lrc').value.replace(/[^A-Za-z0-9]/g,'').toUpperCase();
  if(p.length<8){m.textContent='Use at least 8 characters for the new password.';return}
  if(p!==$('#lp2').value){m.textContent='The two passwords do not match.';return}
  if(!await isOwner()){m.textContent='Only an Admin can reset passwords. Please contact your Admin.';return}
  const r=await makeDoc(authDoc.user,p);
  try{await db.doc('auth/admin').set(r.doc);authDoc=r.doc;showRecovery(r.code)}catch(e){m.textContent='Could not save the new password. Try again.'}
}
$('#lshow').onclick=()=>{const t=$('#lp').type==='password';$('#lp').type=t?'text':'password';$('#lp2').type=t?'text':'password';$('#lshow').textContent=t?'Hide password':'Show password'};
$('#lforgot').onclick=()=>showLock(mode==='reset'?'signin':'reset');
$('#lrecok').onclick=unlock;
$('#lout').onclick=logout;
(async()=>{
  const tick=()=>{const d=new Date();$('#hdate').innerHTML=d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+'<br><b>'+d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true})+'</b>'};
  tick();setInterval(tick,1000);
  fillSelects();$('#dt').value=today();$('#pdt').value=today();render();route();
  try{db=await claude.use('db')}catch(e){db=null}
  initLock();startUsers();initRole();startActivity();startSettings();setInterval(processNotifs,60000);
  if(!db){$('#note').textContent='Not connected to storage: leads are kept only until you close this page.';return}
  const t=setTimeout(()=>{$('#note').textContent='Still loading… data may be out of date.'},10000);
  db.collection('leads').onSnapshot(s=>{clearTimeout(t);$('#note').textContent='';
    const a=document.activeElement;if(a&&a.tagName==='TEXTAREA'&&a.dataset.f==='notes')return;
    ALLLEADS=s.docs.map(d=>({id:d.id,...d.data()}));leads=ALLLEADS.filter(l=>!l.deleted);backfill();render()},
    e=>{clearTimeout(t);$('#note').textContent='Could not load leads ('+(e.message||e.code)+').'});
})();
