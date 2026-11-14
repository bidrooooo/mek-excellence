
import React,{useEffect,useMemo,useState} from 'react';
import{createRoot}from'react-dom/client';
import{createClient}from'@supabase/supabase-js';
import'./style.css';
import'./admin.css';

import heroBanner from '../file_00000000a3688210ad35cff434db2714.png';
import mekLogo from '../1d03d52709b8a1b620118841afb67b9e.jpeg';

const supabase=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY);
const marks=['CA','AL','MT','DK','GH','IS','NS','BS','FY','MN','AS','SH','QN','LX','AW'];

function App(){
 const[activeTab,setActiveTab]=useState('ranking'),[search,setSearch]=useState(''),[selectedOffice,setSelectedOffice]=useState(null),[offices,setOffices]=useState([]),[achievements,setAchievements]=useState([]),[approvedCount,setApprovedCount]=useState(0),[totalPoints,setTotalPoints]=useState(0),[loading,setLoading]=useState(true),[connectionError,setConnectionError]=useState('');
 const[adminOpen,setAdminOpen]=useState(false),[adminUser,setAdminUser]=useState(null),[loginEmail,setLoginEmail]=useState(''),[loginPassword,setLoginPassword]=useState(''),[loginBusy,setLoginBusy]=useState(false),[adminError,setAdminError]=useState(''),[adminTab,setAdminTab]=useState('new'),[adminOffices,setAdminOffices]=useState([]),[activityTypes,setActivityTypes]=useState([]),[pending,setPending]=useState([]),[adminBusy,setAdminBusy]=useState(false),[notice,setNotice]=useState('');
 const[form,setForm]=useState({office_id:'',activity_type_id:'',title:'',description:'',event_date:new Date().toISOString().slice(0,10)});
 const[award,setAward]=useState({});

 async function loadDashboard(){
  setLoading(true);setConnectionError('');
  const[o,g,b,c,a]=await Promise.all([
   supabase.from('offices').select('id,name,sort_order,is_active').eq('is_active',true).order('sort_order'),
   supabase.from('office_governorates').select('office_id,governorates(name)'),
   supabase.from('leaderboard').select('office_id,office_name,total_points'),
   supabase.from('achievements').select('id',{count:'exact',head:true}).eq('status','approved'),
   supabase.from('achievements').select('id,office_id,title,event_date,reviewed_at,activity_types(name),offices(name)').eq('status','approved').order('reviewed_at',{ascending:false}).limit(8)
  ]);
  const errors=[o.error,g.error,b.error,c.error,a.error].filter(Boolean);
  if(errors.length){console.error(errors);setConnectionError('تعذر تحميل بعض البيانات. راجع صلاحيات القراءة في Supabase.')}
  const gm={};(g.data||[]).forEach(x=>{const n=x.governorates?.name;if(n){gm[x.office_id]||=[];gm[x.office_id].push(n)}});
  const bm=new Map((b.data||[]).map(x=>[x.office_id,Number(x.total_points||0)]));
  const os=(o.data||[]).map((x,i)=>({...x,governorates:(gm[x.id]||[]).join(' • '),mark:marks[i]||x.name.slice(0,2),points:bm.get(x.id)||0})).sort((x,y)=>y.points-x.points||x.sort_order-y.sort_order);
  const latest=a.data||[];let pm={};
  if(latest.length){
   const p=await supabase.from('point_entries').select('achievement_id,points').in('achievement_id',latest.map(x=>x.id));
   if(!p.error)(p.data||[]).forEach(x=>pm[x.achievement_id]=(pm[x.achievement_id]||0)+Number(x.points||0))
  }
  setOffices(os);
  setAchievements(latest.map(x=>({...x,officeName:x.offices?.name||os.find(y=>y.id===x.office_id)?.name||'مكتب غير محدد',activityName:x.activity_types?.name||'إنجاز تطوعي',points:pm[x.id]||0})));
  setApprovedCount(c.count||0);
  setTotalPoints(os.reduce((s,x)=>s+x.points,0));
  setLoading(false);
 }

 async function verifyAdmin(user){
  const{data,error}=await supabase.rpc('is_admin');
  if(error||data!==true){await supabase.auth.signOut();setAdminUser(null);setAdminError('الحساب ده مش مضاف ضمن مسؤولي لوحة الإدارة.');return false}
  setAdminUser(user);setAdminError('');await loadAdminData();return true;
 }

 async function loadAdminData(){
  setAdminBusy(true);
  const[o,t,p]=await Promise.all([
   supabase.from('offices').select('id,name').eq('is_active',true).order('sort_order'),
   supabase.from('activity_types').select('id,name,default_points,is_active').eq('is_active',true).order('name'),
   supabase.from('achievements').select('id,office_id,title,description,event_date,submitted_at,activity_types(name),offices(name)').eq('status','pending').order('submitted_at',{ascending:true})
  ]);
  if(o.error||t.error||p.error)setAdminError('تعذر تحميل بعض بيانات الإدارة. '+(o.error?.message||t.error?.message||p.error?.message||''));
  setAdminOffices(o.data||[]);setActivityTypes(t.data||[]);setPending(p.data||[]);setAdminBusy(false);
 }

 useEffect(()=>{
  loadDashboard();
  supabase.auth.getSession().then(({data})=>{if(data.session?.user)verifyAdmin(data.session.user)});
 },[]);

 const filtered=useMemo(()=>offices.filter(x=>(x.name+x.governorates).includes(search.trim())),[offices,search]);
 const governorateCount=useMemo(()=>new Set(offices.flatMap(x=>x.governorates.split(' • ').filter(Boolean))).size,[offices]);

 async function login(e){
  e.preventDefault();setLoginBusy(true);setAdminError('');
  const{data,error}=await supabase.auth.signInWithPassword({email:loginEmail.trim(),password:loginPassword});
  if(error){setAdminError('تعذر تسجيل الدخول: '+error.message);setLoginBusy(false);return}
  await verifyAdmin(data.user);setLoginBusy(false)
 }

 async function logout(){
  await supabase.auth.signOut();setAdminUser(null);setAdminOpen(false);setNotice('');
 }

 async function submitAchievement(e){
  e.preventDefault();setAdminBusy(true);setAdminError('');setNotice('');
  const payload={office_id:Number(form.office_id),title:form.title.trim(),description:form.description.trim()||null,event_date:form.event_date||null,status:'pending'};
  if(form.activity_type_id)payload.activity_type_id=Number(form.activity_type_id);
  const{error}=await supabase.from('achievements').insert(payload);
  if(error)setAdminError('لم يتم حفظ الإنجاز: '+error.message);
  else{setNotice('تم إرسال الإنجاز للمراجعة بنجاح.');setForm({...form,title:'',description:''});await loadAdminData()}
  setAdminBusy(false);
 }

 async function approveAchievement(item){
  const points=Number(award[item.id]||0);
  if(!Number.isFinite(points)||points<0){setAdminError('اكتب عدد نقاط صحيح.');return}
  setAdminBusy(true);setAdminError('');setNotice('');
  const{error}=await supabase.from('achievements').update({status:'approved',reviewed_by:adminUser.id,reviewed_at:new Date().toISOString()}).eq('id',item.id);
  if(error){setAdminError('تعذر اعتماد الإنجاز: '+error.message);setAdminBusy(false);return}
  if(points>0){
   const p=await supabase.from('point_entries').insert({achievement_id:item.id,points,reason:'نقاط اعتماد الإنجاز'});
   if(p.error){setAdminError('تم اعتماد الإنجاز، لكن تعذر تسجيل النقاط: '+p.error.message+' — يمكنك إعادة تسجيل النقاط من قاعدة البيانات أو مراجعة إعدادات الجدول.');setAdminBusy(false);await loadAdminData();return}
  }
  setNotice('تم اعتماد الإنجاز وتسجيل '+points+' نقطة.');
  await loadAdminData();await loadDashboard();setAdminBusy(false);
 }

 async function rejectAchievement(item){
  if(!confirm('هل تريد رفض هذا الإنجاز؟'))return;
  setAdminBusy(true);
  const{error}=await supabase.from('achievements').update({status:'rejected',reviewed_by:adminUser.id,reviewed_at:new Date().toISOString()}).eq('id',item.id);
  if(error)setAdminError('تعذر رفض الإنجاز: '+error.message);
  else{setNotice('تم رفض الإنجاز.');await loadAdminData()}
  setAdminBusy(false);
 }

 const podium=offices.slice(0,3);
 const remaining=filtered.filter(x=>offices.indexOf(x)>=3);

 return <div className="app-shell">
  <header className="topbar">
   <div className="brand">
    <img
     src={mekLogo}
     alt="مصر الخير - إدارة التطوع"
     className="brand-mark"
     style={{width:68,height:68,objectFit:'contain',background:'transparent',borderRadius:0}}
    />
    <div><strong>مصر الخير</strong><small>إدارة التطوع</small></div>
   </div>
   <div className="top-actions"><span className="season">موسم التميز 2026</span><button className="admin-btn" onClick={()=>{setAdminOpen(true);setAdminError('');}}>{adminUser?'لوحة الإدارة':'دخول الإدارة'} <b>↗</b></button></div>
  </header>

  <main>
   <section
    className="hero"
    style={{
     padding:0,
     overflow:'hidden',
     background:'none',
     minHeight:'auto',
     borderRadius:24
    }}
   >
    <img
     src={heroBanner}
     alt="كأس التميز - مكاتب مؤسسة مصر الخير التطوعية"
     style={{
      display:'block',
      width:'100%',
      height:'auto',
      objectFit:'cover'
     }}
    />
   </section>

   <section className="stats-grid">
    <div className="stat-card"><span className="stat-icon green">▦</span><div><small>المكاتب المشاركة</small><strong>{loading?'…':offices.length}</strong></div></div>
    <div className="stat-card"><span className="stat-icon gold">✦</span><div><small>الإنجازات المعتمدة</small><strong>{loading?'…':approvedCount}</strong></div></div>
    <div className="stat-card"><span className="stat-icon mint">◎</span><div><small>إجمالي نقاط المنافسة</small><strong>{loading?'…':totalPoints.toLocaleString('en-US')}</strong></div></div>
    <div className="stat-card"><span className="stat-icon region">⌖</span><div><small>المحافظات المغطاة</small><strong>{loading?'…':governorateCount}</strong></div></div>
   </section>

   <section className="content-section">
    <div className="section-heading">
     <div><div className="section-kicker">لوحة المنافسة</div><h2>رحلة التميز تبدأ من هنا</h2><p>تابع ترتيب المكاتب وأحدث الإنجازات أولًا بأول.</p></div>
     <div className="live-pill"><span></span> لوحة النتائج</div>
    </div>
    <div className="tabs">
     <button className={activeTab==='ranking'?'active':''} onClick={()=>setActiveTab('ranking')}>ترتيب المكاتب <span>{offices.length}</span></button>
     <button className={activeTab==='activities'?'active':''} onClick={()=>setActiveTab('activities')}>آخر الإنجازات</button>
    </div>

    {activeTab==='ranking'?<div className="ranking-panel">
     <div className="podium-section">
      <div className="podium-heading"><span>🏆</span><div><strong>منصة التتويج</strong><small>أصحاب المراكز الأولى في المنافسة</small></div></div>
      {loading?<div className="empty-state">جارٍ تحميل بيانات المكاتب...</div>:podium.length?<div className="podium-grid">
       {podium.map((x,i)=><button className={`podium-card podium-${i+1}`} key={x.id} onClick={()=>setSelectedOffice(x)}>
        <span className="podium-medal">{i===0?'🥇':i===1?'🥈':'🥉'}</span><span className="podium-rank">المركز {i+1}</span><span className="podium-avatar">{x.mark}</span><strong>{x.name}</strong><small>{x.governorates}</small><b className="podium-points">{x.points.toLocaleString('en-US')} <small>نقطة</small></b><span className="podium-base">{i===0?'الأول':i===1?'الثاني':'الثالث'}</span>
       </button>)}
      </div>:<div className="empty-state">لا توجد مكاتب لعرضها حاليًا.</div>}
     </div>

     <div className="panel-toolbar">
      <div><strong>ترتيب جميع المكاتب</strong><small>من المركز الرابع حتى الخامس عشر — حسب النقاط المعتمدة</small></div>
      <label className="search-box"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث عن مكتب..."/></label>
     </div>
     <div className="ranking-list">
      {loading&&<div className="empty-state">جارٍ تحميل بيانات المكاتب...</div>}
      {!loading&&remaining.map(x=><button className="office-row" key={x.id} onClick={()=>setSelectedOffice(x)}>
       <span className="rank-number">{String(offices.indexOf(x)+1).padStart(2,'0')}</span><span className="office-avatar">{x.mark}</span><span className="office-info"><strong>{x.name}</strong><small>{x.governorates}</small></span><span className="points"><b>{x.points.toLocaleString('en-US')}</b><small>نقطة</small></span><span className="row-arrow">‹</span>
      </button>)}
      {!loading&&remaining.length===0&&<div className="empty-state">{search?'لا توجد نتائج مطابقة بعد المراكز الثلاثة الأولى.':'لا توجد مكاتب إضافية حاليًا.'}</div>}
     </div>
     <div className="panel-foot"><span>إجمالي المكاتب: {offices.length}</span><span>الترتيب يتحدث وفق النقاط المعتمدة</span></div>
    </div>:<div className="activity-panel">
     {loading?<div className="activity-empty">جارٍ تحميل الإنجازات...</div>:achievements.length?achievements.map(x=><div className="activity-item" key={x.id}>
      <div className="activity-mark">✦</div><div className="activity-info"><strong>{x.title}</strong><small>{x.officeName} • {x.activityName}{x.event_date?' • '+new Date(x.event_date).toLocaleDateString('ar-EG'):''}</small></div><div className="activity-points">+{x.points.toLocaleString('en-US')}<small>نقطة</small></div>
     </div>):<div className="activity-empty"><div className="empty-icon">✦</div><h3>لسه بنجهّز أول إنجاز!</h3><p>{connectionError||'هتظهر هنا أحدث الإنجازات اللي تم اعتمادها وإضافة نقاط لها.'}</p><span className="muted-tag">بانتظار أول إنجاز حاصل على نقاط</span></div>}
    </div>}
   </section>

   <section className="quote-band"><span>“</span><div><strong>التميز مش مجرد ترتيب… التميز أثر بنسيبه.</strong><small>معًا نصنع فرقًا حقيقيًا في حياة الناس</small></div><b>مصر الخير</b></section>
  </main>

  <footer><span>© 2026 مصر الخير — كأس التميز</span><span>منصة المنافسة بين مكاتب المؤسسة</span></footer>

  {selectedOffice&&<div className="modal-backdrop" onClick={()=>setSelectedOffice(null)}>
   <div className="office-modal" onClick={e=>e.stopPropagation()}>
    <button className="close" onClick={()=>setSelectedOffice(null)}>×</button><div className="office-avatar large">{selectedOffice.mark}</div><div className="section-kicker">ملف المكتب</div><h2>{selectedOffice.name}</h2><p>{selectedOffice.governorates}</p><div className="modal-score"><strong>{selectedOffice.points.toLocaleString('en-US')}</strong><small>إجمالي النقاط المعتمدة</small></div>
   </div>
  </div>}

  {adminOpen&&<div className="admin-overlay">
   <section className="admin-window">
    <button className="admin-close" onClick={()=>setAdminOpen(false)}>×</button>
    {!adminUser?<div className="admin-login">
     <div className="section-kicker">مساحة محمية</div><h2>دخول الإدارة</h2><p>سجّل الدخول بحساب الإدارة المسجل في Supabase.</p>
     <form onSubmit={login}>
      <label>البريد الإلكتروني<input type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} required autoComplete="username"/></label>
      <label>كلمة المرور<input type="password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} required autoComplete="current-password"/></label>
      <button className="admin-primary" disabled={loginBusy}>{loginBusy?'جارٍ التحقق...':'تسجيل الدخول'}</button>
     </form>
     {adminError&&<div className="admin-error">{adminError}</div>}
    </div>:<div className="admin-dashboard">
     <div className="admin-head"><div><div className="section-kicker">لوحة التحكم</div><h2>إدارة كأس التميز</h2><small>{adminUser.email}</small></div><button className="admin-logout" onClick={logout}>تسجيل الخروج</button></div>
     <div className="admin-tabs">
      <button className={adminTab==='new'?'selected':''} onClick={()=>setAdminTab('new')}>إضافة إنجاز</button>
      <button className={adminTab==='review'?'selected':''} onClick={()=>{setAdminTab('review');loadAdminData()}}>مراجعة الإنجازات ({pending.length})</button>
     </div>
     {notice&&<div className="admin-success">{notice}</div>}
     {adminError&&<div className="admin-error">{adminError}</div>}
     {adminTab==='new'?<form className="achievement-form" onSubmit={submitAchievement}>
      <h3>تسجيل إنجاز جديد</h3><p>سيتم حفظ الإنجاز بحالة «قيد المراجعة» ولن يدخل ترتيب المكاتب إلا بعد اعتماده.</p>
      <label>المكتب<select required value={form.office_id} onChange={e=>setForm({...form,office_id:e.target.value})}><option value="">اختر المكتب</option>{adminOffices.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>نوع النشاط (اختياري)<select value={form.activity_type_id} onChange={e=>setForm({...form,activity_type_id:e.target.value})}><option value="">غير محدد</option>{activityTypes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>عنوان الإنجاز<input required maxLength="180" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="مثال: زيارة دار مسنين"/></label>
      <label>تفاصيل الإنجاز<textarea rows="3" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="اكتب ملخصًا للإنجاز..."/></label>
      <label>تاريخ التنفيذ<input type="date" value={form.event_date} onChange={e=>setForm({...form,event_date:e.target.value})}/></label>
      <button className="admin-primary" disabled={adminBusy||!adminOffices.length}>{adminBusy?'جارٍ الحفظ...':'إرسال للمراجعة'}</button>
      {!activityTypes.length&&<small className="admin-hint">ملاحظة: لم تتم إضافة أنواع أنشطة في جدول activity_types حتى الآن؛ يمكنك تسجيل الإنجاز بدون تحديد النوع.</small>}
     </form>:<div className="pending-list">
      <h3>الإنجازات قيد المراجعة</h3>
      {adminBusy?<p>جارٍ تحميل البيانات...</p>:!pending.length?<div className="admin-empty">لا توجد إنجازات تنتظر المراجعة حاليًا.</div>:pending.map(x=><article className="pending-card" key={x.id}>
       <div className="pending-title"><strong>{x.title}</strong><small>{x.offices?.name||'مكتب غير محدد'} • {x.event_date||'بدون تاريخ'}</small></div>
       {x.description&&<p>{x.description}</p>}
       <label>النقاط بعد الاعتماد<input type="number" min="0" step="0.5" value={award[x.id]??''} onChange={e=>setAward({...award,[x.id]:e.target.value})} placeholder="اكتب النقاط"/></label>
       <div className="pending-actions"><button className="admin-primary" disabled={adminBusy} onClick={()=>approveAchievement(x)}>اعتماد وتسجيل النقاط</button><button className="admin-reject" disabled={adminBusy} onClick={()=>rejectAchievement(x)}>رفض</button></div>
      </article>)}
     </div>}
    </div>}
   </section>
  </div>}
 </div>
}

createRoot(document.getElementById('root')).render(<App/>);
