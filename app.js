const hud = document.getElementById('hud');
const p1 = document.getElementById('p1');
const p2 = document.getElementById('p2');
const mouth = document.getElementById('mouth');
const lineColor = document.getElementById('lineColor');
const fullBtn = document.getElementById('fullBtn');
const sensorBtn = document.getElementById('sensorBtn');
const modeMotion = document.getElementById('modeMotion');
const modeTilt = document.getElementById('modeTilt');
const gain = document.getElementById('gain');
const gainVal = document.getElementById('gainVal');
const debug = document.getElementById('debug');
const dbg = document.getElementById('dbg');

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

// ---------- Line color (persisted)
function setLineColor(c){
  document.documentElement.style.setProperty('--line', c);
  try{ localStorage.setItem('lineColor', c); }catch{}
}
try{
  const saved = localStorage.getItem('lineColor');
  if(saved){ lineColor.value = saved; setLineColor(saved); }
  else { setLineColor(lineColor.value); }
}catch{ setLineColor(lineColor.value); }
lineColor.addEventListener('input', e=>setLineColor(e.target.value));

// ---------- Mood
document.querySelectorAll('[data-mood]').forEach(b=>{
  b.addEventListener('click', ()=>{
    const m = b.dataset.mood;
    if(m==='neutral'){
      mouth.style.transform='scaleY(1)';
      mouth.style.borderRadius='0 0 999px 999px';
    }
    if(m==='smile'){
      mouth.style.transform='scaleY(0.6) translateY(-10px)';
      mouth.style.borderRadius='0 0 999px 999px';
    }
    if(m==='surprise'){
      mouth.style.transform='scaleY(1.6)';
      mouth.style.borderRadius='999px';
    }
  });
});

// ---------- HUD toggle: background tap
function toggleHud(){
  hud.classList.toggle('hidden');
  try{ localStorage.setItem('hudHidden', hud.classList.contains('hidden') ? '1' : '0'); }catch{}
}
try{
  const hidden = localStorage.getItem('hudHidden') === '1';
  if(hidden) hud.classList.add('hidden');
}catch{}

let downX=0, downY=0, downTime=0;
window.addEventListener('pointerdown', (e)=>{
  if(hud.contains(e.target)) return;
  downX = e.clientX; downY = e.clientY; downTime = Date.now();
});
window.addEventListener('pointerup', (e)=>{
  if(hud.contains(e.target)) return;
  const dx = Math.abs(e.clientX - downX);
  const dy = Math.abs(e.clientY - downY);
  const dt = Date.now() - downTime;
  if(dx <= 10 && dy <= 10 && dt <= 350) toggleHud();
});

// ---------- Eye helpers
function setPupilOffset(tx, ty){
  p1.style.transform = `translate(${tx}px, ${ty}px)`;
  p2.style.transform = `translate(${tx}px, ${ty}px)`;
}
function updateDebug(txt){
  if(!debug.checked){ dbg.textContent=''; return; }
  dbg.textContent = txt;
}

// Fallback pointer tracking when sensors not active
let sensorsActive = false;
window.addEventListener('pointermove', e=>{
  if (sensorsActive) return;
  const dx=(e.clientX-innerWidth/2)/(innerWidth/2);
  const dy=(e.clientY-innerHeight/2)/(innerHeight/2);
  setPupilOffset(clamp(dx,-1,1)*30, clamp(dy,-1,1)*30);
});

// Blink
setInterval(()=>{
  document.querySelectorAll('.eye').forEach(e=>e.style.transform='scaleY(0.1)');
  setTimeout(()=>document.querySelectorAll('.eye').forEach(e=>e.style.transform='scaleY(1)'),120);
},3200);

// ---------- Fullscreen button
async function requestFullscreen(){
  const el = document.documentElement;
  try{
    if (document.fullscreenElement) { await document.exitFullscreen?.(); return; }
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  }catch(_e){}
}
fullBtn.addEventListener('click', requestFullscreen);

// ---------- Mode + gain persistence
function setModeUI(){
  try{ localStorage.setItem('mode', modeMotion.checked ? 'motion' : 'tilt'); }catch{}
}
try{
  const savedMode = localStorage.getItem('mode');
  if(savedMode === 'tilt'){ modeTilt.checked = true; modeMotion.checked = false; }
}catch{}
modeMotion.addEventListener('change', setModeUI);
modeTilt.addEventListener('change', setModeUI);

function setGain(v){
  gainVal.textContent = String(v);
  try{ localStorage.setItem('gain', String(v)); }catch{}
}
try{
  const g = localStorage.getItem('gain');
  if(g){ gain.value = g; setGain(g); } else setGain(gain.value);
}catch{ setGain(gain.value); }
gain.addEventListener('input', ()=>setGain(gain.value));

// ---------- Sensors: Motion (movement direction) + Tilt
let gx=0, gy=0, gz=0;
const alpha = 0.90; // smoother gravity estimate
let lastMotionTS = 0;

function handleMotion(e){
  if(!modeMotion.checked) return;

  const aG = e.accelerationIncludingGravity;
  const aL = e.acceleration; // sometimes null on iOS; use as fallback if present
  if(!aG && !aL) return;

  const xG = aG?.x ?? 0;
  const yG = aG?.y ?? 0;
  const zG = aG?.z ?? 0;

  // gravity estimate from includingGravity
  gx = alpha*gx + (1-alpha)*xG;
  gy = alpha*gy + (1-alpha)*yG;
  gz = alpha*gz + (1-alpha)*zG;

  // linear acceleration: prefer e.acceleration, else subtract gravity estimate
  const lax = (aL?.x ?? (xG - gx));
  const lay = (aL?.y ?? (yG - gy));

  const g = Number(gain.value);
  const maxPx = 34;

  // Map acceleration -> pupil offset (tuned empirically)
  const tx = clamp(lax * g, -maxPx, maxPx);
  const ty = clamp(lay * g, -maxPx, maxPx);

  setPupilOffset(tx, ty);

  const now = Date.now();
  if(now - lastMotionTS > 80){
    updateDebug(`motion ax=${lax.toFixed(2)} ay=${lay.toFixed(2)} | px=(${tx.toFixed(1)},${ty.toFixed(1)})`);
    lastMotionTS = now;
  }
}

let lastOrientTS = 0;
function handleOrientation(e){
  if(!modeTilt.checked) return;
  const gamma = (typeof e.gamma === 'number') ? e.gamma : 0;
  const beta  = (typeof e.beta  === 'number') ? e.beta  : 0;

  const nx = clamp(gamma / 30, -1, 1);
  const ny = clamp(beta  / 30, -1, 1);

  const maxPx = 34;
  const tx = nx * maxPx;
  const ty = ny * maxPx;

  setPupilOffset(tx, ty);

  const now = Date.now();
  if(now - lastOrientTS > 120){
    updateDebug(`tilt beta=${beta.toFixed(1)} gamma=${gamma.toFixed(1)} | px=(${tx.toFixed(1)},${ty.toFixed(1)})`);
    lastOrientTS = now;
  }
}

async function enableSensors(){
  // Request permissions on iOS (must be in user gesture)
  try{
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      const res = await DeviceMotionEvent.requestPermission();
      if (res !== 'granted') { sensorBtn.textContent = 'Sensors Denied'; return; }
    }
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res2 = await DeviceOrientationEvent.requestPermission();
      if (res2 !== 'granted') { sensorBtn.textContent = 'Sensors Denied'; return; }
    }

    window.addEventListener('devicemotion', handleMotion, { passive: true });
    window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    sensorsActive = true;
    sensorBtn.textContent = 'Sensors Enabled';
    try{ localStorage.setItem('sensorsEnabled', '1'); }catch{}
  }catch(_e){
    sensorBtn.textContent = 'Sensors Unsupported';
  }
}
sensorBtn.addEventListener('click', enableSensors);
