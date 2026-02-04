const hud = document.getElementById('hud');
const p1 = document.getElementById('p1');
const p2 = document.getElementById('p2');
const mouth = document.getElementById('mouth');
const lineColor = document.getElementById('lineColor');
const fullBtn = document.getElementById('fullBtn');
const orientBtn = document.getElementById('orientBtn');
const tiltMode = document.getElementById('tiltMode');

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

function setLineColor(c){
  document.documentElement.style.setProperty('--line', c);
  try{ localStorage.setItem('lineColor', c); }catch{}
}
try{
  const saved = localStorage.getItem('lineColor');
  if(saved){ lineColor.value = saved; setLineColor(saved); }
  else { setLineColor(lineColor.value); }
}catch{
  setLineColor(lineColor.value);
}
lineColor.addEventListener('input', e=>setLineColor(e.target.value));

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
  if(dx <= 10 && dy <= 10 && dt <= 350){
    toggleHud();
  }
});

function setPupilOffset(tx, ty){
  p1.style.transform = `translate(${tx}px, ${ty}px)`;
  p2.style.transform = `translate(${tx}px, ${ty}px)`;
}

let isTiltActive = false;

window.addEventListener('pointermove', e=>{
  if (isTiltActive && tiltMode.checked) return;
  const dx=(e.clientX-innerWidth/2)/(innerWidth/2);
  const dy=(e.clientY-innerHeight/2)/(innerHeight/2);
  const tx=clamp(dx,-1,1)*30;
  const ty=clamp(dy,-1,1)*30;
  setPupilOffset(tx, ty);
});

setInterval(()=>{
  document.querySelectorAll('.eye').forEach(e=>e.style.transform='scaleY(0.1)');
  setTimeout(()=>document.querySelectorAll('.eye').forEach(e=>e.style.transform='scaleY(1)'),120);
},3200);

async function requestFullscreen(){
  const el = document.documentElement;
  try{
    if (document.fullscreenElement) {
      await document.exitFullscreen?.();
      return;
    }
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  }catch(_e){}
}
fullBtn.addEventListener('click', requestFullscreen);

function handleOrientation(e){
  if (!tiltMode.checked) return;
  const gamma = (typeof e.gamma === 'number') ? e.gamma : 0; // left/right
  const beta  = (typeof e.beta  === 'number') ? e.beta  : 0; // front/back

  const nx = clamp(gamma / 30, -1, 1);
  const ny = clamp(beta  / 30, -1, 1);

  const maxPx = 34;
  setPupilOffset(nx * maxPx, ny * maxPx);
}

async function enableTilt(){
  try{
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') {
        orientBtn.textContent = 'Tilt Denied';
        return;
      }
    }
    window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    isTiltActive = true;
    orientBtn.textContent = 'Tilt Enabled';
    try{ localStorage.setItem('tiltEnabled', '1'); }catch{}
  }catch(err){
    orientBtn.textContent = 'Tilt Unsupported';
  }
}
orientBtn.addEventListener('click', enableTilt);

try{
  const wasEnabled = localStorage.getItem('tiltEnabled') === '1';
  if (wasEnabled) orientBtn.textContent = 'Enable Tilt';
}catch{}
