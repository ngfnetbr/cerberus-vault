const $=selector=>document.querySelector(selector);
const setupView=$('#setup-view'),unlockView=$('#unlock-view'),appView=$('#app-view'),message=$('#message'),entryDialog=$('#entry-dialog');
let entries=[];

async function send(payload){const response=await chrome.runtime.sendMessage(payload);if(response?.error)throw new Error(response.error);return response}
function notify(text,error=false){message.textContent=text;message.className=`show${error?' error':''}`;clearTimeout(notify.timer);notify.timer=setTimeout(()=>message.className='',3500)}
function showAuth(view){setupView.hidden=view!==setupView;unlockView.hidden=view!==unlockView;appView.hidden=true}
function showApp(){setupView.hidden=true;unlockView.hidden=true;appView.hidden=false;switchView('vault')}
function switchView(name){for(const id of['vault','backup','security'])$(`#${id}-view`).hidden=id!==name;for(const button of document.querySelectorAll('nav button'))button.classList.toggle('active',button.dataset.view===name)}
function escapeText(value){const node=document.createElement('span');node.textContent=value;return node.innerHTML}

async function refresh(){
  try{const status=await send({type:'STATUS'});if(!status.imported){showAuth(setupView);return}if(!status.unlocked){showAuth(unlockView);$('#unlock-password').focus();return}showApp();await loadEntries()}
  catch(error){notify(error.message,true)}
}

async function loadEntries(){const result=await send({type:'LIST'});entries=result.entries.sort((a,b)=>a.site.localeCompare(b.site));renderEntries()}
function renderEntries(){
  const query=$('#search').value.trim().toLowerCase();const filtered=entries.filter(entry=>!query||entry.site.toLowerCase().includes(query)||entry.username.toLowerCase().includes(query));
  $('#entry-count').textContent=`${entries.length} credencial(is)`;const list=$('#entry-list');list.replaceChildren();
  if(!filtered.length){list.innerHTML='<div class="empty">Nenhuma credencial encontrada.</div>';return}
  for(const entry of filtered){const card=document.createElement('article');card.className='entry-card';card.innerHTML=`<strong>${escapeText(entry.site)}</strong><span>${escapeText(entry.username)}</span><div class="entry-actions"><button class="secondary edit">Editar</button><button class="danger delete">Excluir</button></div>`;card.querySelector('.edit').addEventListener('click',()=>openEntry(entry));card.querySelector('.delete').addEventListener('click',()=>deleteEntry(entry));list.append(card)}
}

function openEntry(entry=null){$('#dialog-heading').textContent=entry?'Editar credencial':'Nova credencial';$('#entry-id').value=entry?.id||'';$('#site').value=entry?.site||'';$('#username').value=entry?.username||'';$('#password').value=entry?.password||'';$('#notes').value=entry?.notes||'';$('#password').type='password';$('#toggle-password').textContent='Mostrar';entryDialog.showModal();$('#site').focus()}
async function deleteEntry(entry){if(!confirm(`Excluir a credencial de ${entry.site}?`))return;try{await send({type:'DELETE_ENTRY',entryId:entry.id});await loadEntries();notify('Credencial excluída.')}catch(error){notify(error.message,true)}}

async function importFile(file){if(!file)return;try{const vault=JSON.parse(await file.text());const result=await send({type:'IMPORT',vault});showAuth(unlockView);notify(result.version===2?'Backup antigo importado. Desbloqueie para migrar.':'Backup importado. Desbloqueie para continuar.');$('#unlock-password').focus()}catch(error){notify(error.message||'Falha ao importar.',true)}}
for(const id of['#setup-import','#unlock-import','#app-import'])$(id).addEventListener('change',event=>{importFile(event.target.files?.[0]);event.target.value=''});

$('#create-form').addEventListener('submit',async event=>{event.preventDefault();const password=$('#create-password').value,confirmPassword=$('#create-confirm').value;if(password!==confirmPassword){notify('As senhas não coincidem.',true);return}try{await send({type:'CREATE',password});event.target.reset();showApp();await loadEntries();notify('Cofre criado.')}catch(error){notify(error.message,true)}});
$('#unlock-form').addEventListener('submit',async event=>{event.preventDefault();try{const result=await send({type:'UNLOCK',password:$('#unlock-password').value});event.target.reset();showApp();await loadEntries();notify(result.migrated?'Backup antigo migrado para o formato seguro.':'Cofre desbloqueado.')}catch(error){notify(error.message,true)}});
$('#lock').addEventListener('click',async()=>{await send({type:'LOCK'});showAuth(unlockView);$('#unlock-password').focus()});
for(const button of document.querySelectorAll('nav button'))button.addEventListener('click',()=>switchView(button.dataset.view));
$('#search').addEventListener('input',renderEntries);$('#add-entry').addEventListener('click',()=>openEntry());$('#close-dialog').addEventListener('click',()=>entryDialog.close());$('#cancel-entry').addEventListener('click',()=>entryDialog.close());
$('#toggle-password').addEventListener('click',()=>{const input=$('#password');input.type=input.type==='password'?'text':'password';$('#toggle-password').textContent=input.type==='password'?'Mostrar':'Ocultar'});
$('#generate-password').addEventListener('click',()=>{const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-=';const random=crypto.getRandomValues(new Uint8Array(24));$('#password').value=[...random].map(value=>chars[value%chars.length]).join('');$('#password').type='text';$('#toggle-password').textContent='Ocultar'});
$('#entry-form').addEventListener('submit',async event=>{event.preventDefault();const entry={id:$('#entry-id').value||undefined,site:$('#site').value,username:$('#username').value,password:$('#password').value,notes:$('#notes').value};try{await send({type:'SAVE_ENTRY',entry});entryDialog.close();await loadEntries();notify('Credencial salva.')}catch(error){notify(error.message,true)}});

$('#export-backup').addEventListener('click',async()=>{try{const {vault}=await send({type:'EXPORT'});const blob=new Blob([JSON.stringify(vault,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`cerberus-vault-${new Date().toISOString().slice(0,10)}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Backup exportado.')}catch(error){notify(error.message,true)}});
$('#password-form').addEventListener('submit',async event=>{event.preventDefault();const password=$('#new-password').value;if(password!==$('#new-confirm').value){notify('As senhas não coincidem.',true);return}try{await send({type:'CHANGE_PASSWORD',password});event.target.reset();notify('Senha mestra alterada e cofre recriptografado.')}catch(error){notify(error.message,true)}});
refresh();
