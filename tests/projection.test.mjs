import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectionScale, PROJECTION_WIDTH, PROJECTION_HEIGHT } from '../packages/shared/projection.mjs';
test('Proyección 16:9 cabe completa y se ajusta en ventanas horizontales, verticales y ultrapanorámicas', () => {
  for (const [width,height] of [[1920,1080],[1280,720],[1440,900],[1024,768],[390,844],[2560,1080],[3840,2160],[800,400]]) {
    const scale=projectionScale(width,height);
    const w=PROJECTION_WIDTH*scale, h=PROJECTION_HEIGHT*scale;
    assert.ok(w<=width+.0001 && h<=height+.0001);
    assert.ok(Math.abs(w/h-16/9)<.0001);
    assert.ok(Math.abs(w-width)<.0001 || Math.abs(h-height)<.0001);
  }
});
