import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPreview,addPreviewRecord,ownPreviewRecords,lookupPreviewRecord} from '../packages/ui/prototype-preview.mjs';
import {PROJECT_TYPES} from '../packages/shared/projects.mjs';
for(const type of PROJECT_TYPES) test(`Vista previa de ${type.id}: crear, validar, filtrar y verificar autorización`,()=>{
  const s=createPreview(type.id);
  assert.equal(ownPreviewRecords(s).length,1);
  assert.match(s.records[0].title,new RegExp(type.entity));
  assert.equal(addPreviewRecord(s),false);
  assert.equal(s.records.length,2);
  s.title='Prueba de la app';s.date='2026-11-18';
  assert.equal(addPreviewRecord(s),true);
  assert.equal(ownPreviewRecords(s).length,2);
  assert.equal(s.records[2].owner,'ana');
  assert.equal(s.records[2].id,3);
  s.user='bruno';assert.equal(ownPreviewRecords(s).length,1);
  s.lookup='3';assert.equal(lookupPreviewRecord(s).owner,'ana');
  s.lookup='999';assert.equal(lookupPreviewRecord(s),null);
  assert.equal(createPreview(type.id).records.length,2);
});
test('Las pruebas de un equipo o versión no alteran las de otro',()=>{
  const a=createPreview('tutorias'),b=createPreview('tutorias');
  a.title='Registro aislado';a.date='2026-11-18';addPreviewRecord(a);
  assert.equal(b.records.length,2);
});
