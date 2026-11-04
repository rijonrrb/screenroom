/* Tiny cinematic particle field. No libraries, WebGL or media downloads. */
export function mountCinematicWave(section) {
  if (!section) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'sr-cinematic-wave';
  canvas.setAttribute('aria-hidden', 'true');
  section.prepend(canvas);
  const ctx = canvas.getContext('2d', { alpha:true, desynchronized:true });
  if (!ctx) { canvas.remove(); return; }
  const finePointer = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const saveData = Boolean(navigator.connection?.saveData);
  const animate = finePointer && !reduce && !saveData;
  const pointer = { x:-999, y:-999 };
  let width = 0, height = 0, frame = 0, last = 0, visible = false;
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.25);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
    draw(performance.now());
  }
  function draw(time) {
    if (width < 1 || height < 1) return;
    ctx.clearRect(0, 0, width, height);
    const rows = 8, columns = 29, phase = animate ? time * 0.00042 : 0;
    const points = [];
    for (let row = 0; row < rows; row++) {
      const line = [];
      const depth = row / (rows - 1);
      for (let col = 0; col < columns; col++) {
        const x = (col + .5) / columns * width;
        const wave = Math.sin(x / 85 + phase + row * .48) * (18 + 16 * depth);
        let y = height * (.13 + .78 * depth) + wave;
        const dx = x - pointer.x, dy = y - pointer.y;
        const distance = Math.hypot(dx,dy);
        if (animate && distance < 130 && distance > 0) {
          y += (dy / distance) * (130 - distance) * .19;
        }
        line.push([x,y]);
        const opacity = (1-depth*.55) * .28;
        ctx.fillStyle = 'rgba(245,197,24,' + opacity.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(x,y,Math.max(.8,1.55-depth*.75),0,Math.PI*2);
        ctx.fill();
      }
      points.push(line);
    }
    ctx.lineWidth = .6;
    for (let row = 0; row < rows; row++) {
      ctx.strokeStyle = 'rgba(245,197,24,' + (.085*(1-row/rows)).toFixed(3) + ')';
      ctx.beginPath();
      points[row].forEach(([x,y],i)=> i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
      ctx.stroke();
    }
  }
  function tick(now) {
    frame = 0;
    if (!visible || document.hidden) return;
    if (now - last >= 38) { last = now; draw(now); }
    frame = requestAnimationFrame(tick);
  }
  function schedule() {
    if (animate && visible && !document.hidden && !frame) frame = requestAnimationFrame(tick);
    if ((!visible || document.hidden) && frame) { cancelAnimationFrame(frame); frame = 0; }
  }
  if (finePointer && animate) {
    section.addEventListener('pointermove',e=>{
      const rect=canvas.getBoundingClientRect();
      pointer.x=e.clientX-rect.left;
      pointer.y=e.clientY-rect.top;
    },{passive:true});
    section.addEventListener('pointerleave',()=>{pointer.x=-999;pointer.y=-999;});
  }
  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting||false;schedule();},{threshold:.01})
    : null;
  if (observer) observer.observe(section); else {visible=true;schedule();}
  document.addEventListener('visibilitychange',schedule);
  window.addEventListener('resize',resize,{passive:true});
  resize();
}
