const hud = document.getElementById('hud');
const p1 = document.getElementById('p1');
const p2 = document.getElementById('p2');
const mouth = document.getElementById('mouth');

const accent = document.getElementById('accent');
const pupilColor = document.getElementById('pupilColor');
const blinkToggle = document.getElementById('blinkToggle');

const fullBtn = document.getElementById('fullBtn');
const sensorBtn = document.getElementById('sensorBtn');
const modeMotion = document.getElementById('modeMotion');
const modeTilt = document.getElementById('modeTilt');

const gain = document.getElementById('gain');
const gainVal = document.getElementById('gainVal');
const smooth = document.getElementById('smooth');
const smoothVal = document.getElementById('smoothVal');
const range = document.getElementById('range');
const rangeVal = document.getElementById('rangeVal');

const landscapeMap = document.getElementById('landscapeMap');
const ori = document.getElementById('ori');

const debug = document.getElementById('debug');
const dbg = document.getElementById('dbg');

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
function persist(key, value){ try{ localStorage.setItem(key, String(value)); }catch{} }
function restore(key){ try{ return localStorage.getItem(key); }catch{ return null; } }

// ----- colors
function setAccent(c){
  document.documentElement.style.setProperty('--accent', c);
  persist('accent', c);
}
function setPupil(c){
  document.documentElement.style.setProperty('--pupil', c);
  persist('pupil', c);
}
const savedA = restore('accent');
if(savedA){ accent.value = savedA; setAccent(savedA); } else setAccent(accent.value);
accent.addEventListener('input', e=>setAccent(e.target.value));

const savedP = restore('pupil');
if(savedP){ pupilColor.value = savedP; setPupil(savedP); } else setPupil(pupilColor.value);
pupilColor.addEventListener('input', e=>setPupil(e.target.value));

// ----- blink toggle
const savedBlink = restore('blink');
blinkToggle.checked = (savedBlink === null) ? true : (savedBlink === '1');
blinkToggle.addEventListener('change', ()=>{
  persist('blink', blinkToggle.checked ? '1' : '0');
});

// ----- moods (mouth only)
document.querySelectorAll('[data-mood]').forEach(b=>{
  b.addEventListener('click', ()=>{
    const m = b.dataset.mood;
    if(m==='smile'){
      mouth.style.display='block';
      mouth.style.opacity='0.95';
      mouth.style.transform='translateY(0px) scaleY(1)';
      mouth.style.borderRadius='0 0 999px 999px';
    }
    if(m==='neutral'){
      mouth.style.display='block';
      mouth.style.opacity='0.55';
      mouth.style.transform='translateY(10px) scaleY(0.20)';
      mouth.style.borderRadius='0 0 999px 999px';
    }
    if(m==='off'){
      mouth.style.display='none';
    }
  });
});

// ----- HUD toggle (background tap)
function toggleHud(){
  hud.classList.toggle('hidden');
  persist('hudHidden', hud.classList.contains('hidden') ? '1' : '0');
}
if(restore('hudHidden') === '1') hud.classList.add('hidden');

let downX=0, downY=0, downTime=0;
window.addEventListener('pointerdown', (e)=>{
  if(hud.contains(e.target)) return;
  downX=e.clientX; downY=e.clientY; downTime=Date.now();
});
window.addEventListener('pointerup', (e)=>{
  if(hud.contains(e.target)) return;
  const dx=Math.abs(e.clientX-downX);
  const dy=Math.abs(e.clientY-downY);
  const dt=Date.now()-downTime;
  if(dx<=10 && dy<=10 && dt<=350) toggleHud();
});

// ----- fullscreen
async function requestFullscreen(){
  const el = document.documentElement;
  try{
    if (document.fullscreenElement) { await document.exitFullscreen?.(); return; }
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  }catch(_e){}
}
fullBtn.addEventListener('click', requestFullscreen);

// ----- sliders restore
function loadSlider(slider, label, key){
  const v = restore(key);
  if(v !== null) slider.value = v;
  label.textContent = String(slider.value);
}
function bindSlider(slider, label, key){
  slider.addEventListener('input', ()=>{ label.textContent = String(slider.value); persist(key, slider.value); });
}
loadSlider(gain, gainVal, 'gain'); bindSlider(gain, gainVal, 'gain');
loadSlider(smooth, smoothVal, 'smooth'); bindSlider(smooth, smoothVal, 'smooth');
loadSlider(range, rangeVal, 'range'); bindSlider(range, rangeVal, 'range');

// ----- mode restore
const savedMode = restore('mode');
if(savedMode === 'tilt'){ modeTilt.checked = true; modeMotion.checked = false; }
function setModeUI(){ persist('mode', modeMotion.checked ? 'motion' : 'tilt'); }
modeMotion.addEventListener('change', setModeUI);
modeTilt.addEventListener('change', setModeUI);

// ----- landscape mapping
const savedMap = restore('landscapeMap');
if(savedMap) landscapeMap.value = savedMap;
landscapeMap.addEventListener('change', ()=>persist('landscapeMap', landscapeMap.value));

function getAngle(){
  const a = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle
          : (typeof window.orientation === 'number' ? window.orientation : 0);
  return ((a % 360) + 360) % 360;
}
function updateOrientationLabel(){ ori.textContent = `angle=${getAngle()}`; }
window.addEventListener('orientationchange', updateOrientationLabel);
window.addEventListener('resize', updateOrientationLabel);
updateOrientationLabel();

function applyLandscapeMapping(ax, ay){
  const ang = getAngle();
  const isLandscape = (ang === 90 || ang === 270);
  let x = ax, y = ay;
  const mode = landscapeMap.value;

  if(mode === 'auto'){
    if(isLandscape){
      if(ang === 90){ const nx=y; const ny=-x; x=nx; y=ny; }
      else if(ang === 270){ const nx=-y; const ny=x; x=nx; y=ny; }
    }
    return {x, y};
  }
  if(mode === 'swap'){ return {x: y, y: x}; }
  if(mode === 'swap-invert-x'){ return {x: -y, y: x}; }
  if(mode === 'swap-invert-y'){ return {x: y, y: -x}; }
  if(mode === 'invert-x'){ return {x: -x, y}; }
  if(mode === 'invert-y'){ return {x, y: -y}; }
  return {x, y};
}

// ----- smoothing loop (pupils)
let targetX=0, targetY=0;
let currentX=0, currentY=0;
function setPupilTarget(tx, ty){ targetX=tx; targetY=ty; }

function raf(){
  const s = Number(smooth.value);
  const lerp = clamp(0.6 - (s/90)*0.55, 0.05, 0.6);
  currentX += (targetX - currentX) * lerp;
  currentY += (targetY - currentY) * lerp;
  p1.style.transform = `translate(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px)`;
  p2.style.transform = `translate(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px)`;
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// ----- debug
function setDbg(t){ dbg.textContent = debug.checked ? t : ''; }

// ----- pointer fallback
let sensorsActive=false;
window.addEventListener('pointermove', e=>{
  if(sensorsActive) return;
  const dx=(e.clientX-innerWidth/2)/(innerWidth/2);
  const dy=(e.clientY-innerHeight/2)/(innerHeight/2);
  const maxPx=Number(range.value);
  setPupilTarget(clamp(dx,-1,1)*maxPx, clamp(dy,-1,1)*maxPx);
});

// ----- sensors
let gx=0, gy=0;
const alpha=0.92;
let lastTS=0;

function handleMotion(e){
  if(!modeMotion.checked) return;
  const aG=e.accelerationIncludingGravity;
  const aL=e.acceleration;
  if(!aG && !aL) return;

  const xG=aG?.x ?? 0;
  const yG=aG?.y ?? 0;

  gx = alpha*gx + (1-alpha)*xG;
  gy = alpha*gy + (1-alpha)*yG;

  let ax = (aL?.x ?? (xG - gx));
  let ay = (aL?.y ?? (yG - gy));

  const m = applyLandscapeMapping(ax, ay);
  ax=m.x; ay=m.y;

  const g=Number(gain.value);
  const maxPx=Number(range.value);
  const tx = clamp(ax*g, -maxPx, maxPx);
  const ty = clamp(ay*g, -maxPx, maxPx);

  setPupilTarget(tx, ty);

  const now=Date.now();
  if(debug.checked && now-lastTS>90){
    setDbg(`motion ax=${ax.toFixed(2)} ay=${ay.toFixed(2)} target=(${tx.toFixed(1)},${ty.toFixed(1)})`);
    lastTS=now;
  }
}

function handleOrientation(e){
  if(!modeTilt.checked) return;
  const gamma=(typeof e.gamma==='number')? e.gamma : 0;
  const beta =(typeof e.beta==='number')? e.beta : 0;
  const nx=clamp(gamma/30,-1,1);
  const ny=clamp(beta/30,-1,1);
  const maxPx=Number(range.value);
  setPupilTarget(nx*maxPx, ny*maxPx);

  const now=Date.now();
  if(debug.checked && now-lastTS>120){
    setDbg(`tilt beta=${beta.toFixed(1)} gamma=${gamma.toFixed(1)} target=(${(nx*maxPx).toFixed(1)},${(ny*maxPx).toFixed(1)})`);
    lastTS=now;
  }
}

async function enableSensors(){
  try{
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      const res = await DeviceMotionEvent.requestPermission();
      if (res !== 'granted') { sensorBtn.textContent = 'Sensors Denied'; return; }
    }
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res2 = await DeviceOrientationEvent.requestPermission();
      if (res2 !== 'granted') { sensorBtn.textContent = 'Sensors Denied'; return; }
    }
    window.addEventListener('devicemotion', handleMotion, {passive:true});
    window.addEventListener('deviceorientation', handleOrientation, {passive:true});
    sensorsActive=true;
    sensorBtn.textContent='Sensors Enabled';
    persist('sensorsEnabled','1');
  }catch(_e){
    sensorBtn.textContent='Sensors Unsupported';
  }
}
sensorBtn.addEventListener('click', enableSensors);

// ----- random blink (toggleable)
let blinkBusy = false;
function blinkOnce(){
  if(blinkBusy) return;
  blinkBusy = true;
  const eyes = document.querySelectorAll('.eye');
  eyes.forEach(e=>e.style.transform='scaleY(0.12)');
  setTimeout(()=>{
    eyes.forEach(e=>e.style.transform='scaleY(1)');
    setTimeout(()=>{ blinkBusy=false; }, 140);
  }, 140);
}

function scheduleBlink(){
  const minMs = 2800;
  const maxMs = 7200;
  const next = Math.floor(minMs + Math.random()*(maxMs-minMs));
  setTimeout(()=>{
    if(blinkToggle.checked){
      // sometimes double-blink
      blinkOnce();
      if(Math.random() < 0.18){
        setTimeout(()=> blinkToggle.checked && blinkOnce(), 260);
      }
    }
    scheduleBlink();
  }, next);
}
scheduleBlink();
