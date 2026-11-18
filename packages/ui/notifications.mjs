import { icon } from './icons.mjs';
export function createNotifier(element) {
  // Fuera del contenido: ningún panel con desenfoque limita la posición flotante.
  document.body.append(element);
  element.className='toast';
  element.hidden=true;
  let timer, duration=4500;
  const clear=()=>{clearTimeout(timer);element.hidden=true;element.replaceChildren();};
  const schedule=()=>{
    clearTimeout(timer);
    if(!element.hidden && !element.matches(':hover') && !element.contains(document.activeElement)) timer=setTimeout(clear,duration);
  };
  element.addEventListener('pointerenter',()=>clearTimeout(timer));
  element.addEventListener('pointerleave',schedule);
  element.addEventListener('focusin',()=>clearTimeout(timer));
  element.addEventListener('focusout',()=>queueMicrotask(schedule));
  return (message, kind='success')=>{
    clear();
    if(!message)return;
    duration=kind==='success'?4500:9000;
    element.dataset.kind=kind;
    element.setAttribute('role',kind==='error'?'alert':'status');
    element.setAttribute('aria-live',kind==='error'?'assertive':'polite');
    element.setAttribute('aria-atomic','true');
    const symbol=document.createElement('span');symbol.className='toast-icon';symbol.innerHTML=icon(kind==='success'?'check':'warning');symbol.setAttribute('aria-hidden','true');
    const text=document.createElement('span');text.className='toast-message';text.textContent=message;
    const close=document.createElement('button');close.type='button';close.className='toast-close';close.textContent='×';close.setAttribute('aria-label','Cerrar notificación');close.addEventListener('click',clear);
    element.append(symbol,text,close);element.hidden=false;schedule();
  };
}
