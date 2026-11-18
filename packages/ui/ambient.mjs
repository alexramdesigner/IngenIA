const stage = document.querySelector('#projection-stage') ?? document.body;
const canvas = document.createElement('canvas');
canvas.className = 'ambient-network';
canvas.setAttribute('aria-hidden', 'true');

const context = canvas.getContext('2d');
if (context) {
  stage.prepend(canvas);

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const nodes = Array.from({ length: 46 }, () => ({
    x: Math.random(),
    y: Math.random(),
    phase: Math.random() * Math.PI * 2,
  }));
  let width = 0;
  let height = 0;
  let frame;
  let lastDraw = 0;

  function draw(time) {
    context.clearRect(0, 0, width, height);
    const count = Math.min(nodes.length, Math.max(18, Math.round(width * height / 32000)));
    const reach = Math.min(185, Math.max(105, width * .27));
    const points = nodes.slice(0, count).map(node => ({
      x: node.x * width + 21 * Math.sin(time / 7600 + node.phase),
      y: node.y * height + 17 * Math.cos(time / 9100 + node.phase),
    }));
    context.lineWidth = 1;
    for (const [index, point] of points.entries()) {
      for (let neighbor = index + 1; neighbor < points.length; neighbor++) {
        const other = points[neighbor];
        const distance = Math.hypot(point.x - other.x, point.y - other.y);
        if (distance >= reach) continue;
        context.strokeStyle = `rgba(69, 217, 232, ${.23 * (1 - distance / reach)})`;
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(other.x, other.y);
        context.stroke();
      }
      context.fillStyle = 'rgba(111, 255, 238, .34)';
      context.beginPath();
      context.arc(point.x, point.y, 1.7, 0, Math.PI * 2);
      context.fill();
    }
  }

  function animate(time) {
    if (time - lastDraw >= 40) {
      draw(time);
      lastDraw = time;
    }
    frame = requestAnimationFrame(animate);
  }

  function updateMotion() {
    cancelAnimationFrame(frame);
    if (document.hidden) return;
    if (reducedMotion.matches) draw(0);
    else frame = requestAnimationFrame(animate);
  }

  new ResizeObserver(() => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (!document.hidden) draw(reducedMotion.matches ? 0 : performance.now());
  }).observe(canvas);
  reducedMotion.addEventListener('change', updateMotion);
  document.addEventListener('visibilitychange', updateMotion);
  updateMotion();
}
