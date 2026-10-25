/**
 * Google Sheets backend for Habit Tracker.
 * Entries store only done/missed statuses. Pending is represented by absence of a row.
 * Configure SPREADSHEET_ID, run setup() once, then deploy as Web App.
 * This is a starter auth system. For sensitive/public production use a managed
 * identity provider and stronger password hashing/rate limiting.
 */
const SPREADSHEET_ID = '1T6w_xiAl2aC6NhPwadoQDO11EffdnThuFEXD5ZzxIp4';
const T = {users:'Users',sessions:'Sessions',habits:'Habits',entries:'Entries',months:'Months'};
const H = {
  users:['email','name','salt','passwordHash','createdAt'],
  sessions:['token','email','createdAt'],
  habits:['id','name','category','icon','target','createdAt','userEmail'],
  entries:['key','habitId','habitName','date','status','userEmail'],
  months:['month','userEmail']
};

function doGet(e){
  try{
    const action=(e.parameter&&e.parameter.action)||'get';
    if(action!=='get')throw new Error('Unsupported GET action.');
    const user=requireUser_(e.parameter.token);
    return json_({ok:true,data:readState_(user.email)});
  }catch(err){return json_({ok:false,error:String(err.message||err)});}
}

function doPost(e){
  const lock=LockService.getScriptLock();
  try{
    lock.waitLock(15000);
    const body=JSON.parse((e.postData&&e.postData.contents)||'{}');
    if(body.action==='register')return json_(register_(body));
    if(body.action==='login')return json_(login_(body));
    if(body.action==='logout'){
      requireUser_(body.token);removeSession_(body.token);
      return json_({ok:true});
    }
    const user=requireUser_(body.token);
    if(body.action==='setStatus'){
      setStatus_(body,user.email);
      return json_({ok:true,message:'Status saved'});
    }
    if(body.action==='save'){
      writeState_(body.data||{},user.email);
      return json_({ok:true,message:'Saved'});
    }
    if(body.action==='deleteHabit'){
      const state=readState_(user.email);
      state.habits=state.habits.filter(h=>String(h.id)!==String(body.id));
      Object.keys(state.entries).forEach(k=>{if(k.startsWith(String(body.id)+'_'))delete state.entries[k];});
      writeState_(state,user.email);
      return json_({ok:true});
    }
    throw new Error('Unknown action.');
  }catch(err){return json_({ok:false,error:String(err.message||err)});}
  finally{try{lock.releaseLock();}catch(_){}}
}

function setup(){
  const ss=getSS_();
  Object.keys(T).forEach(k=>ensure_(ss,T[k],H[k]));
  return 'Setup complete';
}
function getSS_(){
  if(!SPREADSHEET_ID||SPREADSHEET_ID==='PASTE_YOUR_GOOGLE_SHEET_ID_HERE')throw new Error('Set SPREADSHEET_ID in Code.gs.');
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}
function ensure_(ss,name,headers){
  let sh=ss.getSheetByName(name);
  if(!sh)sh=ss.insertSheet(name);
  if(sh.getLastRow()===0){sh.appendRow(headers);}
  else{
    const rows=sh.getDataRange().getValues(),old=rows[0].map(String);
    if(old.join('|')!==headers.join('|')){
      const migrated=rows.slice(1).map(row=>{
        const obj={};old.forEach((k,i)=>obj[k]=row[i]);
        return headers.map(k=>obj[k]!==undefined?obj[k]:'');
      });
      sh.clearContents();sh.getRange(1,1,1,headers.length).setValues([headers]);
      if(migrated.length)sh.getRange(2,1,migrated.length,headers.length).setValues(migrated);
    }
  }
  sh.setFrozenRows(1);sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#d1fae5');
  return sh;
}
function objects_(sh){
  const v=sh.getDataRange().getValues();if(v.length<2)return [];
  const h=v[0].map(String);
  return v.slice(1).filter(r=>r.some(x=>x!=='')).map(r=>{const o={};h.forEach((k,i)=>o[k]=r[i]);return o;});
}
function norm_(v){return String(v||'').trim().toLowerCase();}
function register_(b){
  const email=norm_(b.email),name=String(b.name||'').trim(),password=String(b.password||'');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a valid email address.');
  if(name.length<2)throw new Error('Name must contain at least 2 characters.');
  if(password.length<8)throw new Error('Password must contain at least 8 characters.');
  const sh=ensure_(getSS_(),T.users,H.users),users=objects_(sh);
  if(users.some(u=>norm_(u.email)===email))throw new Error('An account with this email already exists.');
  const salt=Utilities.getUuid()+Utilities.getUuid();
  sh.appendRow([email,name,salt,hash_(password,salt),new Date().toISOString()]);
  if(users.length===0)claimLegacy_(email);
  return newSession_(email,name);
}
function login_(b){
  const email=norm_(b.email),password=String(b.password||'');
  const sh=ensure_(getSS_(),T.users,H.users);
  const u=objects_(sh).find(x=>norm_(x.email)===email);
  if(!u||hash_(password,String(u.salt))!==String(u.passwordHash))throw new Error('Invalid email or password.');
  return newSession_(email,String(u.name));
}
function hash_(password,salt){
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,salt+':'+password,Utilities.Charset.UTF_8));
}
function newSession_(email,name){
  const sh=ensure_(getSS_(),T.sessions,H.sessions),now=Date.now();
  objects_(sh).forEach(s=>{if(norm_(s.email)===email&&now-new Date(s.createdAt).getTime()>7*86400000)removeSession_(String(s.token));});
  const token=Utilities.getUuid()+Utilities.getUuid();
  sh.appendRow([token,email,new Date().toISOString()]);
  return {ok:true,token,user:{email,name}};
}
function requireUser_(token){
  if(!token)throw new Error('Please sign in again.');
  const s=objects_(ensure_(getSS_(),T.sessions,H.sessions)).find(x=>String(x.token)===String(token));
  if(!s)throw new Error('Session expired. Please sign in again.');
  const age=Date.now()-new Date(s.createdAt).getTime();
  if(!Number.isFinite(age)||age>7*86400000){removeSession_(token);throw new Error('Session expired. Please sign in again.');}
  return {email:norm_(s.email)};
}
function removeSession_(token){
  const sh=ensure_(getSS_(),T.sessions,H.sessions),v=sh.getDataRange().getValues();
  for(let i=v.length-1;i>=1;i--)if(String(v[i][0])===String(token))sh.deleteRow(i+1);
}
function readState_(email){
  const ss=getSS_();
  const habits=objects_(ensure_(ss,T.habits,H.habits)).filter(r=>norm_(r.userEmail)===email).map(r=>({id:String(r.id),name:String(r.name),category:String(r.category||'Personal'),icon:String(r.icon||'Sparkles'),target:String(r.target||'Daily'),createdAt:String(r.createdAt||'')}));
  const entries={};
  objects_(ensure_(ss,T.entries,H.entries)).filter(r=>norm_(r.userEmail)===email).forEach(r=>{if(r.key&&r.status)entries[String(r.key)]=String(r.status);});
  let months=objects_(ensure_(ss,T.months,H.months)).filter(r=>norm_(r.userEmail)===email).map(r=>String(r.month||'')).filter(Boolean);
  if(!months.length)months=['2026-11','2026-12'];
  return {habits,entries,months};
}

// Fast path for calendar status clicks: only touch the single Entries row.
// Pending is not stored; it means the user's row for this habit/date is deleted.
function setStatus_(body,email){
  const habitId=String(body.habitId||'');
  const habitName=String(body.habitName||'').trim();
  const date=String(body.date||'');
  const status=String(body.status||'');
  if(!habitId||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Invalid habit or date.');
  if(!['done','missed','pending'].includes(status))throw new Error('Invalid status.');
  const key=habitId+'_'+date;
  const sh=ensure_(getSS_(),T.entries,H.entries);
  const values=sh.getDataRange().getValues();
  const headers=values[0].map(String);
  const col={};headers.forEach((h,i)=>col[h]=i);
  let foundRow=0;
  for(let i=1;i<values.length;i++){
    if(String(values[i][col.key])===key&&norm_(values[i][col.userEmail])===email){foundRow=i+1;break;}
  }
  if(status==='pending'){
    if(foundRow)sh.deleteRow(foundRow);
    return;
  }
  const row=[key,habitId,habitName,date,status,email];
  if(foundRow)sh.getRange(foundRow,1,1,H.entries.length).setValues([row]);
  else sh.appendRow(row);
}

function writeState_(data,email){
  const ss=getSS_(),hs=ensure_(ss,T.habits,H.habits),es=ensure_(ss,T.entries,H.entries),ms=ensure_(ss,T.months,H.months);
  const oldH=objects_(hs),oldE=objects_(es),oldM=objects_(ms);
  const habits=Array.isArray(data.habits)?data.habits:[],entries=data.entries||{},months=Array.isArray(data.months)?data.months:[];
  const names={};habits.forEach(h=>names[String(h.id)]=String(h.name||''));
  const keepH=oldH.filter(r=>norm_(r.userEmail)!==email).map(r=>H.habits.map(k=>r[k]||''));
  const ownH=habits.map(h=>[h.id||'',h.name||'',h.category||'Personal',h.icon||'Sparkles',h.target||'Daily',h.createdAt||new Date().toISOString(),email]);
  replace_(hs,H.habits,[...keepH,...ownH]);

  const prev={};oldE.filter(r=>norm_(r.userEmail)===email).forEach(r=>prev[String(r.key)]=r);
  const keepE=oldE.filter(r=>norm_(r.userEmail)!==email).map(r=>H.entries.map(k=>r[k]||''));
  const ownE=Object.entries(entries).filter(([k,s])=>k&&['done','missed'].includes(s)).map(([key,status])=>{
    const ix=key.lastIndexOf('_'),habitId=ix>=0?key.slice(0,ix):'',date=ix>=0?key.slice(ix+1):'',old=prev[key];
    return [key,habitId,names[habitId]||(old&&old.habitName)||'',date,status,email];
  });
  replace_(es,H.entries,[...keepE,...ownE]);
  const keepM=oldM.filter(r=>norm_(r.userEmail)!==email).map(r=>H.months.map(k=>r[k]||''));
  replace_(ms,H.months,[...keepM,...[...new Set(months)].map(m=>[m,email])]);
}
function replace_(sh,headers,rows){
  sh.clearContents();sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold').setBackground('#d1fae5');
  if(rows.length)sh.getRange(2,1,rows.length,headers.length).setValues(rows);
  sh.setFrozenRows(1);
}
function claimLegacy_(email){
  const ss=getSS_(),hs=ensure_(ss,T.habits,H.habits),es=ensure_(ss,T.entries,H.entries),ms=ensure_(ss,T.months,H.months);
  const names={};objects_(hs).forEach(r=>{if(r.id)names[String(r.id)]=String(r.name||'');});
  claimRows_(hs,'id','userEmail',email);
  const entries=objects_(es);
  entries.forEach(r=>{
    if(!r.userEmail&&r.key){
      setByKey_(es,'key',r.key,'userEmail',email);
      setByKey_(es,'key',r.key,'habitName',names[String(r.habitId)]||String(r.habitName||''));
    }
  });
  claimRows_(ms,'month','userEmail',email);
}
function claimRows_(sh,idCol,targetCol,email){
  const v=sh.getDataRange().getValues(),headers=v[0].map(String),a=headers.indexOf(idCol),b=headers.indexOf(targetCol);
  for(let i=1;i<v.length;i++)if(v[i][a]&&!v[i][b])sh.getRange(i+1,b+1).setValue(email);
}
function setByKey_(sh,idCol,id,targetCol,value){
  const v=sh.getDataRange().getValues(),headers=v[0].map(String),a=headers.indexOf(idCol),b=headers.indexOf(targetCol);
  for(let i=1;i<v.length;i++)if(String(v[i][a])===String(id)){if(!v[i][b])sh.getRange(i+1,b+1).setValue(value);return;}
}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
