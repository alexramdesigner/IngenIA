import { PHASES } from '/packages/shared/phases.mjs';
import { icon } from '/packages/ui/icons.mjs';
import { requestId } from '/packages/shared/request-id.mjs';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
let host, state, api, selected=1, opened=false, following=true, sending=false, revision=0, retry;
const histories=new Map(), drafts=new Map(), replies=new Map(), liking=new Set();
const questions={
  1:['¿Quién usará la aplicación?','¿Qué necesidad concreta tiene?','¿Qué no vamos a desarrollar hoy?'],
  2:['¿Qué necesita hacer el usuario?','¿Cómo comprobaremos que funciona?','¿Qué debe pasar si algo falla?'],
  3:['¿Cómo organizamos la aplicación y sus datos?','¿Quién puede acceder a qué?','¿Por qué elegimos esta arquitectura?'],
  4:['¿Qué contexto y límites debe tener el prompt?','¿Qué coincide con lo pedido?','¿Qué debemos ajustar?'],
  5:['¿Qué hallazgos encontramos y qué impacto tienen?','¿Cómo corregimos el problema?','¿Qué prueba evitará que se repita?'],
  6:['¿Publicamos, condicionamos o detenemos la entrega?','¿Qué riesgos quedan y cómo revertimos?','¿Qué mejoramos en la siguiente iteración?']
};
function shell() {
  if(host)return;
  host=document.createElement('aside');host.className='team-chat';host.setAttribute('aria-label','Chat privado del equipo');document.body.append(host);
  host.innerHTML=`<button class="team-chat-toggle" aria-expanded="false" aria-controls="team-chat-panel">${icon('chat')}<span>Acuerdos equipo</span><b class="chat-unread" hidden>Nuevo</b></button><section id="team-chat-panel" class="team-chat-panel" hidden><header><strong>Acuerdos equipo</strong><button type="button" class="chat-close" aria-label="Cerrar chat">×</button></header><label class="chat-phase-label">Conversación<select class="chat-phase">${PHASES.map(p=>`<option value="${p.id}">${p.id}. ${esc(p.title)}</option>`).join('')}</select></label><details class="chat-guide"><summary>Preguntas para el consenso</summary><div></div></details><button class="chat-older" hidden>Ver anteriores</button><div class="chat-messages" role="log" aria-label="Mensajes del equipo" aria-live="polite"></div><div class="chat-reply-preview" hidden></div><form class="chat-form"><label class="sr-only" for="team-chat-input">Mensaje al equipo</label><textarea id="team-chat-input" name="teamChatMessage" maxlength="2000" rows="2" required placeholder="Comparte tu idea…"></textarea><button type="submit">Enviar</button></form><p class="chat-feedback" role="status"></p></section>`;
  host.querySelector('.team-chat-toggle').onclick=()=>toggle(!opened);
  host.querySelector('.chat-close').onclick=()=>toggle(false);
  host.querySelector('.chat-phase').onchange=event=>{selected=Number(event.target.value);following=selected===(state.activePhase||1);retry=null;paint();fetchHistory();};
  host.querySelector('textarea').oninput=event=>drafts.set(selected,event.target.value);
  host.querySelector('.chat-older').onclick=()=>fetchHistory(true);
  host.querySelector('.chat-messages').onclick=async event=>{
    const reply=event.target.closest('[data-chat-reply]');
    if(reply){
      const message=histories.get(selected)?.messages.find(m=>m.id===Number(reply.dataset.chatReply));
      if(message){replies.set(selected,message);retry=null;paintReply();host.querySelector('textarea').focus();}
      return;
    }
    const button=event.target.closest('[data-chat-like]');
    if(!button||state.status==='FINISHED')return;
    const id=Number(button.dataset.chatLike), identity=state.actorId;
    if(liking.has(id))return;
    const message=histories.get(selected)?.messages.find(m=>m.id===id);if(!message)return;
    liking.add(id);button.disabled=true;
    try{
      const result=await api(`/sessions/${state.id}/team-chat-like`,{messageId:id,liked:!message.likes?.includes(identity)});
      if(identity===state?.actorId)receiveTeamMessage(result.message);
    }catch(error){if(identity===state?.actorId)feedback(error.message);}
    finally{liking.delete(id);if(state)paint();}
  };
  host.querySelector('.chat-reply-preview').onclick=event=>{if(event.target.closest('[data-cancel-reply]')){replies.delete(selected);retry=null;paintReply();host.querySelector('textarea').focus();}};
  host.querySelector('form').onsubmit=async event=>{
    event.preventDefault();if(sending||state.status==='FINISHED')return;
    const content=host.querySelector('textarea').value.trim();if(!content)return;
    const phase=selected, identity=state.actorId;
    const replyTo=replies.get(phase)?.id ?? null;
    if(!retry||retry.phase!==phase||retry.content!==content||retry.replyTo!==replyTo)retry={phase,content,replyTo,clientId:requestId()};
    const payload=retry;sending=true;paintStatus();
    try {
      const result=await api(`/sessions/${state.id}/team-chat`,payload);
      if(identity!==state?.actorId)return;
      receiveTeamMessage(result.message);
      if(drafts.get(phase)?.trim()===content)drafts.delete(phase);
      if(replies.get(phase)?.id===payload.replyTo)replies.delete(phase);
      if(selected===phase)paintReply();
      if(retry===payload)retry=null;
      if(selected===phase)host.querySelector('textarea').value=drafts.get(phase)||'';
      feedback('');
    } catch(error){if(identity===state?.actorId)feedback(error.message);}
    finally{sending=false;paintStatus();}
  };
}
function toggle(value){opened=value;host.querySelector('.team-chat-panel').hidden=!value;host.querySelector('.team-chat-toggle').setAttribute('aria-expanded',String(value));if(value){host.querySelector('.chat-unread').hidden=true;paint();fetchHistory();host.querySelector('textarea').focus();}}
function feedback(text){host.querySelector('.chat-feedback').textContent=text;}
function paintStatus(){if(!state||!host)return;const closed=state.status==='FINISHED';host.querySelector('textarea').disabled=closed;const button=host.querySelector('[type=submit]');button.disabled=closed||sending;button.textContent=sending?'Enviando…':'Enviar';if(closed)feedback('Taller finalizado · Solo lectura');}
function paint(){
  if(!host||!state)return;
  host.querySelector('select').value=selected;
  host.querySelector('.chat-guide div').innerHTML=`<ul>${questions[selected].map(q=>`<li>${esc(q)}</li>`).join('')}</ul>`;
  host.querySelector('textarea').value=drafts.get(selected)||'';
  const history=histories.get(selected);
  const box=host.querySelector('.chat-messages');
  const nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<80;
  box.innerHTML=history?.messages.length?history.messages.map(m=>{
    const liked=m.likes?.includes(state.actorId), closed=state.status==='FINISHED';
    return `<article class="chat-message ${m.actorId===state.actorId?'is-own':''}"><div><strong>${esc(m.author)}</strong><time datetime="${new Date(m.createdAt).toISOString()}">${new Date(m.createdAt).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}</time></div>${m.reply?`<blockquote class="chat-quote"><strong>${esc(m.reply.author)}</strong><span>${esc(m.reply.content)}</span></blockquote>`:''}<p>${esc(m.content)}</p><footer class="chat-actions"><button type="button" data-chat-like="${m.id}" aria-pressed="${Boolean(liked)}" ${closed||liking.has(m.id)?'disabled':''}>👍 ${liked?'Te gusta':'Me gusta'}${m.likes?.length?` · ${m.likes.length}`:''}</button><button type="button" data-chat-reply="${m.id}" ${closed?'disabled':''}>Responder</button></footer></article>`;
  }).join(''):'<p class="chat-empty">¿Qué propone el equipo?</p>';
  paintReply();
  if(nearBottom)box.scrollTop=box.scrollHeight;
  host.querySelector('.chat-older').hidden=!history?.hasMore;
  paintStatus();
}
function paintReply(){
  const preview=host.querySelector('.chat-reply-preview'), message=replies.get(selected);
  preview.hidden=!message;
  preview.innerHTML=message?`<div><strong>Respondiendo a ${esc(message.author)}</strong><span>${esc(message.content.slice(0,140))}</span></div><button type="button" data-cancel-reply aria-label="Cancelar respuesta">×</button>`:'';
}
async function fetchHistory(older=false){
  if(!state||!opened)return;
  const phase=selected, ticket=++revision, identity=state.actorId;
  const history=histories.get(phase), before=older?history?.messages[0]?.id:null;
  try{
    const result=await api(`/sessions/${state.id}/team-chat?phase=${phase}${before?`&before=${before}`:''}`);
    if(identity!==state?.actorId||ticket!==revision)return;
    const current=histories.get(phase);
    const combined=[...(current?.messages||[]),...result.messages];
    const messages=[...new Map(combined.map(m=>[m.id,m])).values()].sort((a,b)=>a.id-b.id);
    histories.set(phase,{messages,hasMore:older?result.hasMore:current?.messages.length&&current.messages[0].id<result.messages[0]?.id?current.hasMore:result.hasMore});
    if(selected===phase)paint();
  }catch(error){if(ticket===revision)feedback(error.message);}
}
export function receiveTeamMessage(message){
  if(!state||!host)return;
  const history=histories.get(message.phase)||{messages:[],hasMore:false};
  const isNew=!history.messages.some(m=>m.id===message.id);
  if(isNew)history.messages.push(message);
  else history.messages[history.messages.findIndex(m=>m.id===message.id)]=message;
  history.messages.sort((a,b)=>a.id-b.id);histories.set(message.phase,history);
  if(opened&&selected===message.phase)paint();
  else if(isNew&&message.actorId!==state.actorId)host.querySelector('.chat-unread').hidden=false;
}
export function updateTeamChat(next, request, visible=true){
  if(!visible||!next?.team||!next.attendance?.confirmedAt){if(host){host.hidden=true;toggle(false);}return;}
  api=request;shell();host.hidden=false;
  if(state?.actorId!==next.actorId){histories.clear();drafts.clear();replies.clear();liking.clear();following=true;retry=null;revision++;}
  const previous=state?.activePhase;state=next;
  if(following)selected=next.activePhase||1;
  if(opened){paint();if(previous!==next.activePhase)fetchHistory();}
}
export function hideTeamChat(){if(host){host.hidden=true;toggle(false);}state=null;histories.clear();drafts.clear();replies.clear();liking.clear();revision++;}
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&opened&&host){toggle(false);host.querySelector('.team-chat-toggle').focus();}});
setInterval(()=>{if(opened&&state&&!document.hidden)fetchHistory();},5000);
