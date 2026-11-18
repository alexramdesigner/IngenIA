import { projectType } from '../shared/projects.mjs';
const sessions = new Map();
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const users = { ana:'Ana · usuario de prueba', bruno:'Bruno · usuario de prueba' };
export function createPreview(typeId) {
  const type=projectType(typeId) ?? projectType('reservas');
  return {user:'ana',title:'',date:'',lookup:'2',message:'',result:null,records:[
    {id:1,owner:'ana',title:`${type.entity} de ejemplo de Ana`,date:'2026-11-18'},
    {id:2,owner:'bruno',title:`${type.entity} de ejemplo de Bruno`,date:'2026-11-19'}
  ]};
}
export function addPreviewRecord(state) {
  if (!state.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(state.date)) {
    state.message='No se guardó: completa el título y la fecha. (DATOS_REQUERIDOS)';return false;
  }
  state.records.push({id:Math.max(0,...state.records.map(r=>r.id))+1,owner:state.user,title:state.title.trim().slice(0,120),date:state.date});
  state.title='';state.date='';state.message='Registro creado. Ya aparece en tu lista.';return true;
}
export const ownPreviewRecords = state => state.records.filter(r=>r.owner===state.user);
// Reproduce la consulta por id del código didáctico, que omite comprobar propietario.
export function lookupPreviewRecord(state) {
  state.result=state.records.find(r=>r.id===Number(state.lookup))??null;
  state.message=state.result?'Consulta completada. Compara el propietario con el usuario seleccionado.':'No existe un registro con ese ID.';
  return state.result;
}
export function mountPrototypePreview(host, version, key) {
  const type=projectType(version.generatedType ?? version.projectType) ?? projectType('reservas');
  let state=sessions.get(key);
  if(!state){state=createPreview(type.id);sessions.set(key,state);}
  const record = r => `<li><strong>${esc(r.title)}</strong><span>ID ${r.id} · ${esc(r.date)} · Propietario: ${esc(users[r.owner])}</span></li>`;
  function draw() {
    const own=ownPreviewRecords(state);
    host.innerHTML=`<div class="preview-heading"><div><span class="preview-badge">Vista previa interactiva · SIMULACIÓN</span><h3>${esc(type.title)}</h3></div><button type="button" class="secondary" data-preview-reset>Reiniciar prueba</button></div>
      <p class="muted">Prueba con datos ficticios. Es una representación del comportamiento básico; no ejecuta el código generado. Esta vista funciona en tu navegador: no crea registros reales ni comparte datos entre dispositivos. Se reinicia al recargar.</p>
      ${version.incidentVariants?.includes('phantom_dependency')?'<p class="preview-warning">El código generado incluye una dependencia que debe verificarse antes de ejecutarlo. Esta vista previa no la instala ni la ejecuta.</p>':''}<label>Probar como<select data-preview-user>${Object.entries(users).map(([id,name])=>`<option value="${id}" ${state.user===id?'selected':''}>${name}</option>`).join('')}</select></label>
      <div class="preview-columns"><section><h4>Crear ${esc(type.entity)}</h4><form data-preview-create novalidate><label>Título<input name="previewTitle" maxlength="120" value="${esc(state.title)}" placeholder="Ej. Sesión de programación"></label><label>Fecha<input name="previewDate" type="date" value="${esc(state.date)}"></label><button type="submit">Crear ${esc(type.entity)}</button></form></section>
      <section><h4>Mis ${esc(type.entities)} <span class="preview-count">${own.length}</span></h4><ul class="preview-records">${own.map(record).join('') || '<li>No tienes registros todavía.</li>'}</ul></section></div>
      <section class="preview-lookup"><h4>Probar consulta por ID</h4><p>En los datos de ejemplo, el ID 1 pertenece a Ana y el ID 2 a Bruno. Comprueba qué ocurre al consultar el registro de otra persona.</p><form data-preview-lookup><label>ID del registro<input name="previewId" type="number" min="1" step="1" value="${esc(state.lookup)}" required></label><button type="submit" class="secondary">Consultar registro</button></form>
      ${state.result?`<ul class="preview-records">${record(state.result)}</ul>${state.result.owner!==state.user?'<p class="preview-warning">Se mostró un registro de otro usuario. La simulación tiene un fallo de autorización para analizar en la verificación.</p>':''}`:''}</section>
      <p class="preview-feedback" role="status" aria-live="polite">${esc(state.message)}</p>`;
    host.querySelector('[data-preview-user]').addEventListener('change',e=>{state.user=e.target.value;state.result=null;state.message='Usuario de prueba cambiado. La lista muestra solo sus registros.';draw();});
    const form=host.querySelector('[data-preview-create]');
    form.elements.previewTitle.addEventListener('input',e=>{state.title=e.target.value;});
    form.elements.previewDate.addEventListener('input',e=>{state.date=e.target.value;});
    form.addEventListener('submit',e=>{e.preventDefault();state.title=form.elements.previewTitle.value;state.date=form.elements.previewDate.value;addPreviewRecord(state);state.result=null;draw();});
    const lookup=host.querySelector('[data-preview-lookup]');
    lookup.elements.previewId.addEventListener('input',e=>{state.lookup=e.target.value;});
    lookup.addEventListener('submit',e=>{e.preventDefault();state.lookup=lookup.elements.previewId.value;lookupPreviewRecord(state);draw();});
    host.querySelector('[data-preview-reset]').addEventListener('click',()=>{state=createPreview(type.id);sessions.set(key,state);state.message='Prueba reiniciada con los dos registros de ejemplo.';draw();});
  }
  draw();
}
