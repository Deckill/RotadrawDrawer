'use strict';
// ═══════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════
const MM         = 96 / 25.4;
const EXPORT_MM  = 300 / 25.4;
const SNAP_D     = 2.5;   // mm
const MAX_LBL    = 10;    // mm label offset limit
const GROUP1_ID  = 1;
// ═══════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════
let canvasW = 210, canvasH = 297, baseW = 210, baseH = 297;
let circle  = { cx: 105, cy: 148.5, r: 75 };
let images = [];
let bgImage = null;
let nextImgId = 1;
let paperGuide = { cx: 105, cy: 148.5, w: 210, h: 297, rotation: 0, visible: true, size: 'A4' };
let canvDragState = null;
let canvSelType = null; // 'image' or 'paper'
let canvSelId = null; // for image
let canvSelHandle = null;
let canvDragStartPos = null;
let canvDragStartObj = null;
let currentMode = 'canvas';
let drawTool    = 'spline';
/*
  Shape = {
    id, type:'spline'|'line',
    points: [{x,y}],            ??anchor points
    cps: [[cp1,cp2], ...],      ??bezier control points per segment (spline only)
                                   cps[i] = [outHandle of pts[i], inHandle of pts[i+1]]
    closed, strokeWidth, groupId,
    _isCopy?, _origId?
  }
  For LINE type: cps unused, direct line segments.
*/
let shapes = [], nextShapeId = 1;
let groups = [], nextGroupId = 2;
let activeDrawGroupId = GROUP1_ID;
let labels = {};
let strokeWidth = 1.0;
// View
let viewScale = 1, viewOffX = 0, viewOffY = 0;
// Draw state
let drawing = false, drawingShape = null;
// Selection (draw mode)
let selShapeId = null, selPtIdx = null;
// Which handle is active: null | 'in' | 'out'
let selHandle  = null;
let dragState  = null;  // { type:'pt'|'shape'|'cpIn'|'cpOut', ... }
// Arrange
let arrSelShapeId = null, arrDragState = null;
// Hover
let hoverPtRef = null;
// Label drag
let lblDrag = null;
// Mouse
let _mdMm = null, _hasDragged = false;
// ═══════════════════════════════════════════════
//  CANVAS / VIEW
// ═══════════════════════════════════════════════
const bgCanvas   = document.getElementById('bg-canvas');
const mainCanvas = document.getElementById('main-canvas');
const bgCtx  = bgCanvas.getContext('2d');
const ctx    = mainCanvas.getContext('2d');
const wrapper    = document.getElementById('canvas-wrapper');
const canvasArea = document.getElementById('canvas-area');
function S(mm)  { return mm * MM * viewScale; }
function clientToMm(e) {
  const r = mainCanvas.getBoundingClientRect();
  return { x: (e.clientX - r.left)/(MM*viewScale), y: (e.clientY - r.top)/(MM*viewScale) };
}
function setCanvasSize() {
  const pw = Math.max(1, Math.round(canvasW*MM*viewScale));
  const ph = Math.max(1, Math.round(canvasH*MM*viewScale));
  bgCanvas.width  = mainCanvas.width  = pw;
  bgCanvas.height = mainCanvas.height = ph;
  bgCanvas.style.width  = mainCanvas.style.width  = pw+'px';
  bgCanvas.style.height = mainCanvas.style.height = ph+'px';
  wrapper.style.width  = pw+'px';
  wrapper.style.height = ph+'px';
  wrapper.style.left   = viewOffX+'px';
  wrapper.style.top    = viewOffY+'px';
}
canvasArea.addEventListener('wheel', e => {
  e.preventDefault();
  const f = e.deltaY < 0 ? 1.1 : 0.9;
  const ns = Math.max(0.08, Math.min(12, viewScale*f));
  const ar = canvasArea.getBoundingClientRect();
  const mx = e.clientX - ar.left, my = e.clientY - ar.top;
  const ratio = ns/viewScale;
  viewOffX = mx - (mx-viewOffX)*ratio;
  viewOffY = my - (my-viewOffY)*ratio;
  viewScale = ns;
  setCanvasSize(); render();
}, { passive:false });
let _pan=false, _panO=null;
canvasArea.addEventListener('mousedown', e => { if(e.button===1){_pan=true;_panO={x:e.clientX-viewOffX,y:e.clientY-viewOffY};e.preventDefault();} });
window.addEventListener('mousemove', e => { if(_pan){viewOffX=e.clientX-_panO.x;viewOffY=e.clientY-_panO.y;wrapper.style.left=viewOffX+'px';wrapper.style.top=viewOffY+'px';} });
window.addEventListener('mouseup',   e => { if(e.button===1)_pan=false; });
// ═══════════════════════════════════════════════
//  CANVAS SIZE CONTROLS
// ═══════════════════════════════════════════════
function onPaperSizeChange(val) {
  if (val === 'Custom') {
    document.getElementById('cv-w').disabled = false;
    document.getElementById('cv-h').disabled = false;
  } else {
    document.getElementById('cv-w').disabled = true;
    document.getElementById('cv-h').disabled = true;
    if (val === 'A4') { paperGuide.w = 210; paperGuide.h = 297; }
    else if (val === 'A3') { paperGuide.w = 297; paperGuide.h = 420; }
    else if (val === 'Letter') { paperGuide.w = 215.9; paperGuide.h = 279.4; }
    document.getElementById('cv-w').value = paperGuide.w;
    document.getElementById('cv-h').value = paperGuide.h;
  }
  paperGuide.size = val;
  canvasW = paperGuide.w;
  canvasH = paperGuide.h;
  paperGuide.cx = canvasW / 2;
  paperGuide.cy = canvasH / 2;
  paperGuide.rotation = 0;
  circle.cx = canvasW / 2;
  circle.cy = canvasH / 2;
  setCanvasSize();
  render();
}
function onCustomPaperWH(axis, val) {
  const v = parseFloat(val);
  if (!isNaN(v) && v > 0) {
    if (axis === 'w') { paperGuide.w = v; canvasW = v; }
    if (axis === 'h') { paperGuide.h = v; canvasH = v; }
    paperGuide.cx = canvasW / 2;
    paperGuide.cy = canvasH / 2;
    paperGuide.rotation = 0;
    circle.cx = canvasW / 2;
    circle.cy = canvasH / 2;
    setCanvasSize();
    render();
  }
}
function goHome() {
  const ar = canvasArea.getBoundingClientRect();
  if (ar.width > 0 && ar.height > 0) {
    viewScale = Math.min((ar.width - 60) / (paperGuide.w * MM), (ar.height - 60) / (paperGuide.h * MM), 2);
    viewOffX = (ar.width - paperGuide.w * MM * viewScale) / 2;
    viewOffY = (ar.height - paperGuide.h * MM * viewScale) / 2;
    wrapper.style.left = viewOffX + 'px';
    wrapper.style.top = viewOffY + 'px';
    render();
  }
}
function importImage(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => onImageObjectLoaded(img);
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function onImageObjectLoaded(img) {
  // Load image at 60% of paper guide size to show it is a selectable object
  let w = paperGuide.w * 0.6;
  let h = w * img.height / img.width;
  if (h > paperGuide.h * 0.6) {
    h = paperGuide.h * 0.6;
    w = h * img.width / img.height;
  }
  images.push({
    id: nextImgId++,
    img: img,
    cx: paperGuide.cx,
    cy: paperGuide.cy,
    w: w,
    h: h,
    rotation: 0
  });
  render();
}
// Handle file dropping for images
document.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
document.addEventListener('drop', e => {
  e.preventDefault();
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const file = e.dataTransfer.files[0];
    if (file.type.startsWith('image/')) {
      importImage(file);
    } else if (file.name.endsWith('.json') || file.name.endsWith('.rdraw')) {
      onProjectLoaded({target:{files:[file]}});
    }
  }
});
function circleFromInput() { circle.r=(parseFloat(document.getElementById('circle-d').value)||150)/2; render(); }
// ═══════════════════════════════════════════════
//  GROUPS
// ═══════════════════════════════════════════════
const GCOLORS=['#e94560','#00b4d8','#06d6a0','#ffd166','#a855f7','#f97316','#ec4899','#14b8a6','#84cc16','#f43f5e'];
function initDefaultGroup() {
  groups=[{id:GROUP1_ID,label:1,color:GCOLORS[0],rotation:0,locked:true}];
  activeDrawGroupId=GROUP1_ID;
}
function addGroup() {
  const g={id:nextGroupId++,label:groups.length+1,color:GCOLORS[groups.length%GCOLORS.length],rotation:0,locked:false};
  groups.push(g); refreshGroupList(); render();
}
function deleteGroup(id) {
  if(id===GROUP1_ID)return;
  shapes=shapes.filter(s=>!(s.groupId===id&&s._isCopy));
  groups=groups.filter(g=>g.id!==id);
  refreshGroupList(); render();
}
// Copy system
function hasCopy(origId)  { return shapes.some(s=>s._origId===origId); }
function makeCopy(orig, targetGid) {
  shapes=shapes.filter(s=>!(s._origId===orig.id&&s.groupId===targetGid));
  const c=JSON.parse(JSON.stringify(orig));
  c.id=nextShapeId++; c._isCopy=true; c._origId=orig.id; c.groupId=targetGid;
  shapes.push(c); return c;
}
function removeCopy(origId, targetGid) { shapes=shapes.filter(s=>!(s._origId===origId&&s.groupId===targetGid)); }
function refreshGroupList() {
  // Arrange list
  const list=document.getElementById('group-list');
  list.innerHTML='';
  groups.forEach(g=>{
    const d=document.createElement('div');
    d.className='group-item';
    const delHtml=g.locked?`<span class="group-del locked">잠금</span>`:`<span class="group-del" onclick="deleteGroup(${g.id});event.stopPropagation()">✕</span>`;
    d.innerHTML=`<div class="group-color-dot" style="background:${g.color}"></div><span style="flex:1">그룹 ${g.label}</span><input type="number" value="${g.rotation}" min="-360" max="360" style="width:55px" oninput="setGroupRotation(${g.id},this.value)" onclick="event.stopPropagation()">${delHtml}`;
    list.appendChild(d);
  });
  // Label panel
  const ll=document.getElementById('label-group-list');
  ll.innerHTML='';
  groups.forEach(g=>{
    const row=document.createElement('div');
    row.className='input-row';
    row.innerHTML=`<div class="group-color-dot" style="background:${g.color}"></div><span style="flex:1;font-size:12px">그룹 ${g.label}</span><input type="number" value="${g.label}" min="1" max="999" style="width:48px;background:#0f3460;border:1px solid #1a4a7a;border-radius:3px;color:#eee;padding:3px;font-size:12px;flex:none" onchange="setGroupLabel(${g.id},this.value)">`;
    ll.appendChild(row);
  });
}
function setGroupLabel(id,v){const g=groups.find(x=>x.id===id);if(g){g.label=parseInt(v)||g.label;render();}}
// ═══════════════════════════════════════════════
//  STROKE WIDTH
// ═══════════════════════════════════════════════
function onSwRange(v){
  strokeWidth=parseFloat(v);
  document.getElementById('sw-num').value=strokeWidth.toFixed(2);
  shapes.forEach(s=>s.strokeWidth=strokeWidth);
  render();
}
function onSwNum(v){
  strokeWidth=Math.max(0.5,Math.min(2,parseFloat(v)||1));
  document.getElementById('sw-range').value=strokeWidth;
  shapes.forEach(s=>s.strokeWidth=strokeWidth);
  render();
}
// ═══════════════════════════════════════════════
//  MODES
// ═══════════════════════════════════════════════
const MODE_NAMES={canvas:'캔버스',draw:'그리기',arrange:'배치',label:'레이블'};
function setMode(m){
  if(drawing)finishDrawing();
  currentMode=m;
  ['canvas','draw','arrange','label'].forEach(mm=>{
    document.getElementById('mode-'+mm).classList.toggle('active',mm===m);
    const p=document.getElementById('panel-'+mm);if(p)p.style.display=mm===m?'':'none';
  });
  document.getElementById('sb-mode').textContent='모드: '+MODE_NAMES[m];
  selShapeId=null;selPtIdx=null;selHandle=null;dragState=null;
  arrSelShapeId=null;arrDragState=null;hoverPtRef=null;lblDrag=null;
  updateCursor();render();
}
function setDrawTool(t){
  if(drawing)finishDrawing();
  drawTool=t;
  ['spline','line','select'].forEach(tt=>document.getElementById('tool-'+tt).classList.toggle('active',tt===t));
  selShapeId=null;selPtIdx=null;selHandle=null;dragState=null;hoverPtRef=null;
  updateCursor();render();
}
function updateCursor(){
  if(currentMode==='draw'&&drawTool!=='select')mainCanvas.style.cursor='crosshair';
  else mainCanvas.style.cursor='default';
}
function onImageFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => onImageObjectLoaded(img);
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}
// ==========================================
//  HERMITE SPLINE SYSTEM
// ==========================================
function solveTridiagonal(A, B, C, D) {
  const n = D.length;
  const cPrime = new Float64Array(n);
  const dPrime = new Float64Array(n);
  const x = new Float64Array(n);

  cPrime[0] = C[0] / A[0];
  dPrime[0] = D[0] / A[0];

  for (let i = 1; i < n; i++) {
    const m = 1.0 / (A[i] - B[i] * cPrime[i - 1]);
    cPrime[i] = C[i] * m;
    dPrime[i] = (D[i] - B[i] * dPrime[i - 1]) * m;
  }

  x[n - 1] = dPrime[n - 1];
  for (let i = n - 2; i >= 0; i--) {
    x[i] = dPrime[i] - cPrime[i] * x[i + 1];
  }
  return x;
}

function solveNaturalCubicSpline(pts, closed) {
  const n = pts.length;
  if (n < 2) return;
  
  if (!closed) {
    const A = new Float64Array(n);
    const B = new Float64Array(n);
    const C = new Float64Array(n);
    const Dx = new Float64Array(n);
    const Dy = new Float64Array(n);
    
    A[0] = 2; C[0] = 1; 
    Dx[0] = 3 * (pts[1].x - pts[0].x);
    Dy[0] = 3 * (pts[1].y - pts[0].y);
    
    for (let i = 1; i < n - 1; i++) {
      B[i] = 1; A[i] = 4; C[i] = 1;
      Dx[i] = 3 * (pts[i+1].x - pts[i-1].x);
      Dy[i] = 3 * (pts[i+1].y - pts[i-1].y);
    }
    
    B[n-1] = 1; A[n-1] = 2;
    Dx[n-1] = 3 * (pts[n-1].x - pts[n-2].x);
    Dy[n-1] = 3 * (pts[n-1].y - pts[n-2].y);
    
    const Tx = solveTridiagonal(A, B, C, Dx);
    const Ty = solveTridiagonal(A, B, C, Dy);
    
    for (let i = 0; i < n; i++) {
      if (!pts[i].manual) {
        pts[i].outT = { x: Tx[i], y: Ty[i] };
        pts[i].inT = { x: -Tx[i], y: -Ty[i] };
      }
    }
  } else {
    // For closed spline, we use a simple iterative solver or Sherman-Morrison.
    // Iterative Gauss-Seidel is very simple and fast for diagonally dominant systems (1, 4, 1).
    const Tx = new Float64Array(n);
    const Ty = new Float64Array(n);
    for(let i=0; i<n; i++) {
      // Initial guess (Catmull-Rom)
      const prev = pts[(i - 1 + n) % n];
      const next = pts[(i + 1) % n];
      Tx[i] = (next.x - prev.x) / 2;
      Ty[i] = (next.y - prev.y) / 2;
    }
    
    for (let iter = 0; iter < 15; iter++) {
      for (let i = 0; i < n; i++) {
        if (pts[i].manual) continue;
        const prev = pts[(i - 1 + n) % n];
        const next = pts[(i + 1) % n];
        const prevT = Tx[(i - 1 + n) % n];
        const nextT = Tx[(i + 1) % n];
        
        const rhsX = 3 * (next.x - prev.x) - prevT - nextT;
        Tx[i] = rhsX / 4;
        
        const prevTy = Ty[(i - 1 + n) % n];
        const nextTy = Ty[(i + 1) % n];
        const rhsY = 3 * (next.y - prev.y) - prevTy - nextTy;
        Ty[i] = rhsY / 4;
      }
    }
    for (let i = 0; i < n; i++) {
      if (!pts[i].manual) {
        pts[i].outT = { x: Tx[i], y: Ty[i] };
        pts[i].inT = { x: -Tx[i], y: -Ty[i] };
      }
    }
  }
}

function updateHermiteTangents(s) {
  const pts = s.points;
  const n = pts.length;
  if (n < 2) return;
  solveNaturalCubicSpline(pts, s.closed);
}
function getPolyline(s) {
  const closed = s.closed === true;
  if (s.type === 'line') return {pts: s.points.map(p=>({x:p.x, y:p.y})), closed};
  const rawPts = s.points;
  const rn = rawPts.length;
  if (rn < 2) return {pts: rawPts.map(p=>({x:p.x, y:p.y})), closed};
  const segs = closed ? rn : rn - 1;
  const pts = [];
  const steps = 20;
  for (let i = 0; i < segs; i++) {
    const p0 = rawPts[i], p1 = rawPts[(i + 1) % rn];
    const c0 = {x: p0.x + (p0.outT.x)/3, y: p0.y + (p0.outT.y)/3};
    const c1 = {x: p1.x + (p1.inT.x)/3, y: p1.y + (p1.inT.y)/3};
    for (let j = 0; j < steps; j++) {
      const t = j / steps;
      const u = 1 - t;
      const x = u*u*u*p0.x + 3*u*u*t*c0.x + 3*u*t*t*c1.x + t*t*t*p1.x;
      const y = u*u*u*p0.y + 3*u*u*t*c0.y + 3*u*t*t*c1.y + t*t*t*p1.y;
      pts.push({x, y});
    }
  }
  if (!closed) pts.push({x: rawPts[rn-1].x, y: rawPts[rn-1].y});
  return {pts, closed};
}
function svgPathD(s) {
  if (s.type === 'spline') {
    const closed = s.closed === true;
    const rawPts = s.points;
    const rn = rawPts.length;
    if (rn < 2) return null;
    const segs = closed ? rn : rn - 1;
    let d = `M ${rawPts[0].x.toFixed(2)} ${rawPts[0].y.toFixed(2)} `;
    for (let i = 0; i < segs; i++) {
      const p0 = rawPts[i], p1 = rawPts[(i + 1) % rn];
      const c0 = {x: p0.x + (p0.outT.x)/3, y: p0.y + (p0.outT.y)/3};
      const c1 = {x: p1.x + (p1.inT.x)/3, y: p1.y + (p1.inT.y)/3};
      d += `C ${c0.x.toFixed(2)} ${c0.y.toFixed(2)}, ${c1.x.toFixed(2)} ${c1.y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} `;
    }
    if (closed) d += 'Z';
    return d;
  }
  const closed = s.closed === true;
  const rawPts = s.points;
  if (rawPts.length < 2) return null;
  let d = `M ${rawPts[0].x.toFixed(2)} ${rawPts[0].y.toFixed(2)} `;
  rawPts.slice(1).forEach(p => d += `L ${p.x.toFixed(2)} ${p.y.toFixed(2)} `);
  if (closed) d += 'Z';
  return d;
}
function getCurvature(P0, M0, P1, M1, t) {
  let Vx, Vy, Ax, Ay;
  if (t === 0) {
    Vx = M0.x; Vy = M0.y;
    Ax = 6*(P1.x - P0.x) - 4*M0.x - 2*M1.x;
    Ay = 6*(P1.y - P0.y) - 4*M0.y - 2*M1.y;
  } else {
    Vx = M1.x; Vy = M1.y;
    Ax = -6*(P1.x - P0.x) + 2*M0.x + 4*M1.x;
    Ay = -6*(P1.y - P0.y) + 2*M0.y + 4*M1.y;
  }
  const v2 = Vx*Vx + Vy*Vy;
  if (v2 < 1e-5) return null;
  const cross = Vx*Ay - Vy*Ax;
  if (Math.abs(cross) < 1e-5) return null;
  const k = cross / Math.pow(v2, 1.5);
  let R = 1 / Math.abs(k);
  if (R > 500) R = 500; // Limit to 500mm
  const vMag = Math.sqrt(v2);
  const nx = -Vy / vMag;
  const ny = Vx / vMag;
  const cx = (t===0?P0.x:P1.x) + (1/k) * nx;
  const cy = (t===0?P0.y:P1.y) + (1/k) * ny;
  return { R, cx, cy };
}
function isShapeClosed(s){
  return s.closed === true;
}
// Get visible control points for selected spline segment
function getHandlePositions(s, ptIdx) {
  if(!s||s.type!=='spline')return{out:null,inn:null};
  const p = s.points[ptIdx];
  if (!p) return {out:null,inn:null};
  const closed = s.closed === true;
  const n = s.points.length;
  const outH = {x: p.x + p.outT.x, y: p.y + p.outT.y};
  const inH = {x: p.x + p.inT.x, y: p.y + p.inT.y};
  if (!closed) {
    if (ptIdx === 0) return { out: outH, inn: null };
    if (ptIdx === n - 1) return { out: null, inn: inH };
  }
  return {out: outH, inn: inH};
}
function hitHandle(pos,s,ptIdx,side){
  if(!s||s.type!=='spline')return false;
  const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
  const pLocal = g ? rotAround(pos, circle.cx, circle.cy, -g.rotation) : pos;
  const{out:outH,inn:inH}=getHandlePositions(s,ptIdx);
  const h=side==='out'?outH:inH;
  if(!h)return false;
  const dx=pLocal.x-h.x,dy=pLocal.y-h.y;
  return dx*dx+dy*dy<25; // 5mm radius
}
let currentCurvature = null;
function renderBezierHandles(sc){
  const s=shapes.find(x=>x.id===selShapeId);
  if(!s||s.type!=='spline'||selPtIdx===null)return;
  const p=s.points[selPtIdx];
  const{out:outH,inn:inH}=getHandlePositions(s,selPtIdx);
  ctx.save();
  ctx.setLineDash([2,2]);ctx.lineWidth=1;
  if(inH){
    ctx.strokeStyle='#ff9900aa';
    ctx.beginPath();ctx.moveTo(p.x*sc,p.y*sc);ctx.lineTo(inH.x*sc,inH.y*sc);ctx.stroke();
    const isDragging=dragState?.type==='cpIn';
    ctx.beginPath();ctx.arc(inH.x*sc,inH.y*sc,isDragging?7:5,0,Math.PI*2);
    ctx.fillStyle='#ff9900';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();
  }
  if(outH){
    ctx.strokeStyle='#00dd88aa';
    ctx.beginPath();ctx.moveTo(p.x*sc,p.y*sc);ctx.lineTo(outH.x*sc,outH.y*sc);ctx.stroke();
    const isDragging=dragState?.type==='cpOut';
    ctx.beginPath();ctx.arc(outH.x*sc,outH.y*sc,isDragging?7:5,0,Math.PI*2);
    ctx.fillStyle='#00dd88';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();
  }
  ctx.setLineDash([]);
  // Labels
  ctx.fillStyle='#fff';ctx.font='10px sans-serif';
  if(inH) ctx.fillText('in',inH.x*sc+7,inH.y*sc-7);
  if(outH)ctx.fillText('out',outH.x*sc+7,outH.y*sc-7);
  if (currentCurvature) {
    ctx.strokeStyle = '#ffff0088';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(currentCurvature.cx * sc, currentCurvature.cy * sc, currentCurvature.R * sc, 0, Math.PI*2);
    ctx.stroke();
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.arc(currentCurvature.cx * sc, currentCurvature.cy * sc, 3, 0, Math.PI*2);
    ctx.fill();
    ctx.setLineDash([]);
  }
  ctx.restore();
}
// ═══════════════════════════════════════════════
//  OFFSET RENDERING HELPERS
// ═══════════════════════════════════════════════
function segNormal(a,b){
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
  return{nx:-dy/len,ny:dx/len};
}
function offsetSeg(a,b,halfW){
  const{nx,ny}=segNormal(a,b);
  return{
    aL:{x:a.x+nx*halfW,y:a.y+ny*halfW},
    bL:{x:b.x+nx*halfW,y:b.y+ny*halfW},
    aR:{x:a.x-nx*halfW,y:a.y-ny*halfW},
    bR:{x:b.x-nx*halfW,y:b.y-ny*halfW}
  };
}
function lineIntersectT(p1,d1,p2,d2){
  const denom=d1.x*d2.y-d1.y*d2.x;
  if(Math.abs(denom)<1e-10)return null;
  const t=((p2.x-p1.x)*d2.y-(p2.y-p1.y)*d2.x)/denom;
  return t;
}
function miterJoin(bL_prev, dirPrev, bL_next, dirNext, halfW, maxMiter=4){
  const d1={x:dirPrev.x,y:dirPrev.y};
  const d2={x:dirNext.x,y:dirNext.y};
  const t=lineIntersectT(bL_prev,d1,bL_next,d2);
  if(t===null) return {x: (bL_prev.x + bL_next.x)/2, y: (bL_prev.y + bL_next.y)/2};
  const ip={x:bL_prev.x+t*d1.x,y:bL_prev.y+t*d1.y};
  const midX = (bL_prev.x + bL_next.x) / 2;
  const midY = (bL_prev.y + bL_next.y) / 2;
  const dx = ip.x - midX;
  const dy = ip.y - midY;
  const dist = Math.hypot(dx, dy);
  if (dist > maxMiter * halfW) {
    const scale = (maxMiter * halfW) / dist;
    return {
      x: midX + dx * scale,
      y: midY + dy * scale
    };
  }
  return ip;
}
function buildOffsetPath(pts, closed, hw, sc) {
  const scaledPts = pts.map(p => ({ x: p.x * sc, y: p.y * sc }));
  const scaledHw = hw * sc;
  const d = svgOffsetPathD(scaledPts, closed, scaledHw);
  if (!d) return null;
  return new Path2D(d);
}
function getShapePath(s,sc){
  const{pts,closed}=getPolyline(s);
  if(pts.length<2)return null;
  return buildOffsetPath(pts,closed,(s.strokeWidth||strokeWidth)/2,sc);
}
function gColor(s){
  const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
  return g?g.color:'#aaa';
}
function renderShape(s,sc,isPreview=false,customCtx=null){
  const drawCtx=customCtx||ctx;
  const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
  const color=gColor(s);
  const isGhost=(s.groupId===GROUP1_ID&&!s._isCopy&&hasCopy(s.id));
  drawCtx.save();
  if(g&&g.rotation!==0){
    drawCtx.translate(circle.cx*sc,circle.cy*sc);
    drawCtx.rotate(g.rotation*Math.PI/180);
    drawCtx.translate(-circle.cx*sc,-circle.cy*sc);
  }
  drawCtx.globalAlpha=isPreview?0.55:isGhost?0.15:1;
  const path=getShapePath(s,sc);
  if(path){
    drawCtx.fillStyle=color;
    drawCtx.fill(path,'evenodd');
  }
  // Arrange highlight
  if(currentMode==='arrange'&&s.id===arrSelShapeId&&path&&!customCtx){
    drawCtx.globalAlpha=0.3;drawCtx.fillStyle='#fff';drawCtx.fill(path,'evenodd');
    drawCtx.globalAlpha=0.9;drawCtx.strokeStyle='#fff';drawCtx.lineWidth=1.5;
    const{pts,closed}=getPolyline(s);
    if(pts.length>=2){
      drawCtx.beginPath();drawCtx.moveTo(pts[0].x*sc,pts[0].y*sc);
      pts.slice(1).forEach(p=>drawCtx.lineTo(p.x*sc,p.y*sc));
      if(closed)drawCtx.closePath();
      drawCtx.stroke();
    }
  }
  // Draw mode vertex/edge drawing
  if(currentMode==='draw'&&s.id===selShapeId&&!customCtx){
    const{pts,closed}=getPolyline(s);
    if(pts.length>=2){
      drawCtx.strokeStyle='#4488ffaa';drawCtx.lineWidth=1;
      drawCtx.beginPath();drawCtx.moveTo(pts[0].x*sc,pts[0].y*sc);
      pts.slice(1).forEach(p=>drawCtx.lineTo(p.x*sc,p.y*sc));
      if(closed)drawCtx.closePath();
      drawCtx.stroke();
    }
    s.points.forEach((p,idx)=>{
      const isSel=idx===selPtIdx;
      drawCtx.beginPath();drawCtx.arc(p.x*sc,p.y*sc,isSel?6:4,0,Math.PI*2);
      drawCtx.fillStyle=isSel?'#ff007f':'#4488ff';drawCtx.fill();
      drawCtx.strokeStyle='#fff';drawCtx.lineWidth=1;drawCtx.stroke();
    });
  }
  drawCtx.restore();
}
function renderCanvasMode(sc) {
  images.forEach(img => {
     ctx.save();
     ctx.translate(img.cx*sc, img.cy*sc);
     ctx.rotate(img.rotation * Math.PI / 180);
     ctx.drawImage(img.img, -img.w/2*sc, -img.h/2*sc, img.w*sc, img.h*sc);
     ctx.restore();
  });
  if (paperGuide.visible) {
    ctx.save();
    ctx.translate(paperGuide.cx*sc, paperGuide.cy*sc);
    ctx.rotate(paperGuide.rotation * Math.PI / 180);
    ctx.strokeStyle = canvSelType==='paper'?'#ff00ff':'#00ffff';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(-paperGuide.w/2*sc, -paperGuide.h/2*sc, paperGuide.w*sc, paperGuide.h*sc);
    ctx.beginPath();
    ctx.moveTo(-5, 0); ctx.lineTo(5, 0);
    ctx.moveTo(0, -5); ctx.lineTo(0, 5);
    ctx.stroke();
    ctx.fillStyle = canvSelType==='paper'?'#ff00ff':'#00ffff';
    ctx.font = '12px sans-serif';
    ctx.fillText('Paper', -paperGuide.w/2*sc + 2, -paperGuide.h/2*sc + 14);
    ctx.restore();
  }
  if (currentMode === 'canvas') {
     const activeObj = canvSelType === 'paper' ? paperGuide : (canvSelType === 'image' ? images.find(x => x.id === canvSelId) : null);
     if (activeObj) {
        const rad = activeObj.rotation * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const rot = (x, y) => ({ x: (activeObj.cx + x*cos - y*sin)*sc, y: (activeObj.cy + x*sin + y*cos)*sc });
        const w2 = activeObj.w/2, h2 = activeObj.h/2;
        const handles = {
          tl: rot(-w2, -h2), tr: rot(w2, -h2), br: rot(w2, h2), bl: rot(-w2, h2),
          t: rot(0, -h2), r: rot(w2, 0), b: rot(0, h2), l: rot(-w2, 0),
          rotH: rot(0, -h2 - 10)
        };
        ctx.strokeStyle = canvSelType==='paper'?'#ff00ff':'#00ffff';
        ctx.fillStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        const r = 4;
        ctx.beginPath();
        ctx.moveTo(handles.tl.x, handles.tl.y);
        ctx.lineTo(handles.tr.x, handles.tr.y);
        ctx.lineTo(handles.br.x, handles.br.y);
        ctx.lineTo(handles.bl.x, handles.bl.y);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(handles.t.x, handles.t.y);
        ctx.lineTo(handles.rotH.x, handles.rotH.y);
        ctx.stroke();
        for(let k in handles) {
           ctx.beginPath();
           if(k === 'rotH') ctx.arc(handles[k].x, handles[k].y, r, 0, Math.PI*2);
           else ctx.rect(handles[k].x - r, handles[k].y - r, r*2, r*2);
           ctx.fill(); ctx.stroke();
        }
     }
  }
}
function render(){
  const W=mainCanvas.width,H=mainCanvas.height,sc=MM*viewScale;
  bgCtx.clearRect(0,0,W,H);
  bgCtx.fillStyle=document.getElementById('cv-bg').value;
  bgCtx.fillRect(0,0,W,H);
  if(bgImage)bgCtx.drawImage(bgImage,0,0,W,H);
  ctx.clearRect(0,0,W,H);
  renderCanvasMode(sc);
  shapes.forEach(s=>renderShape(s,sc));
  if(drawing&&drawingShape)renderShape(drawingShape,sc,true);
  renderCircle(sc);
  if(currentMode==='arrange'||currentMode==='label')renderGroupMarkers(sc);
  if(currentMode==='label')renderLabels(sc);
  if(currentMode==='draw'&&drawTool==='select'&&selShapeId!==null&&selPtIdx!==null)renderBezierHandles(sc);
}
function renderCircle(sc){
  const cx=circle.cx*sc,cy=circle.cy*sc,r=circle.r*sc;
  ctx.save();
  ctx.strokeStyle='#4488ff77';ctx.lineWidth=1;ctx.setLineDash([5,5]);
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#4488ffcc';ctx.beginPath();ctx.arc(cx,cy,5,0,Math.PI*2);ctx.fill();
  if(currentMode==='canvas'){
    ctx.strokeStyle='#4488ff44';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(cx-r,cy);ctx.lineTo(cx+r,cy);ctx.stroke();
    ctx.fillStyle='#4488ffbb';ctx.font='11px sans-serif';
    ctx.fillText(`⌀${(circle.r*2).toFixed(1)}mm`,cx+r+5,cy+4);
  }
  ctx.restore();
}
function renderGroupMarkers(sc){
  groups.forEach(g=>{
    // Marker: radially tall (6mm tall, 1mm wide at circle edge)
    const mRadHalf=3*sc;   // 6mm total radial height 편측3mm
    const mTangHalf=0.5*sc; // 1mm tangential width 편측0.5mm
    ctx.save();
    ctx.translate(circle.cx*sc,circle.cy*sc);
    ctx.rotate(g.rotation*Math.PI/180);
    const edgeY=-(circle.r*sc);
    const isSel=arrSelShapeId&&shapes.find(s=>s.id===arrSelShapeId)?.groupId===g.id;
    ctx.fillStyle=g.color+(isSel?'ff':'bb');
    ctx.strokeStyle=isSel?'#fff':g.color;
    ctx.lineWidth=isSel?2:1;
    ctx.beginPath();
    ctx.rect(-mTangHalf,edgeY-mRadHalf,mTangHalf*2,mRadHalf*2);
    ctx.fill();ctx.stroke();
    // Label to the right
    ctx.fillStyle='#fff';
    ctx.font=`bold ${Math.max(9,3.5*sc)}px sans-serif`;
    ctx.textAlign='left';ctx.textBaseline='middle';
    ctx.fillText(g.label,mTangHalf+4,edgeY);
    ctx.restore();
  });
}
function renderLabels(sc){
  const fs=parseFloat(document.getElementById('label-size').value)||4;
  shapes.forEach(s=>{
    if(!s.groupId)return;
    const g=groups.find(x=>x.id===s.groupId);if(!g)return;
    const lbl=labels[s.id]||{ox:4,oy:-4};
    const ctr=shapeCenter(s);
    ctx.save();
    ctx.translate(circle.cx*sc,circle.cy*sc);
    ctx.rotate(g.rotation*Math.PI/180);
    ctx.translate(-circle.cx*sc,-circle.cy*sc);
    const lx=(ctr.x+lbl.ox)*sc,ly=(ctr.y+lbl.oy)*sc;
    ctx.font=`bold ${fs*sc}px sans-serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.strokeStyle='#000a';ctx.lineWidth=3;ctx.strokeText(g.label,lx,ly);
    ctx.fillStyle=g.color;ctx.fillText(g.label,lx,ly);
    ctx.restore();
  });
}
// ═══════════════════════════════════════════════
//  HIT TESTING
// ═══════════════════════════════════════════════
function hitPoint(pos){
  const thresh=Math.max(2.5,6/viewScale);
  for(let i=shapes.length-1;i>=0;i--){
    const s=shapes[i];
  // ── Draw mode ──
    const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
    const pLocal = g ? rotAround(pos, circle.cx, circle.cy, -g.rotation) : pos;
    for(let j=0;j<s.points.length;j++){
      if(Math.hypot(pLocal.x-s.points[j].x,pLocal.y-s.points[j].y)<thresh)
        return{shapeId:s.id,ptIdx:j};
    }
  }
  return null;
}
function hitSegment(pos){
  const thresh=Math.max(1.5,4/viewScale);
  for(let i=shapes.length-1;i>=0;i--){
    const s=shapes[i];
  // ── Draw mode ──
    if(currentMode==='arrange' && s.groupId===GROUP1_ID && !s._isCopy && hasCopy(s.id)) continue;
    const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
    const pLocal = g ? rotAround(pos, circle.cx, circle.cy, -g.rotation) : pos;
    const{pts}=getPolyline(s);
    for(let j=0;j<pts.length-1;j++){if(segDist(pLocal,pts[j],pts[j+1])<thresh)return s;}
    if(isShapeClosed(s)&&pts.length>2&&segDist(pLocal,pts[pts.length-1],pts[0])<thresh)return s;
  }
  return null;
}
function segDist(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
  if(l2===0)return Math.hypot(p.x-a.x,p.y-a.y);
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2));
  return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
}
function hitHandle(pos,s,ptIdx,side){
  if(!s||s.type!=='spline')return false;
  const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
  const pLocal = g ? rotAround(pos, circle.cx, circle.cy, -g.rotation) : pos;
  const{out:outH,inn:inH}=getHandlePositions(s,ptIdx);
  const h=side==='out'?outH:inH;
  if(!h)return false;
  return Math.hypot(pLocal.x-h.x,pLocal.y-h.y)<Math.max(2,6/viewScale);
}
function hitGroupMarker(pos,g){
  const rot=g.rotation*Math.PI/180;
  const mx=circle.cx+Math.sin(rot)*circle.r;
  const my=circle.cy-Math.cos(rot)*circle.r;
  return Math.hypot(pos.x-mx,pos.y-my)<10;
}
function shapeCenter(s){
  if(!s.points.length)return{x:0,y:0};
  const xs=s.points.map(p=>p.x),ys=s.points.map(p=>p.y);
  return{x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2};
}
function distToShape(pos,s){
  const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
  const pLocal = g ? rotAround(pos, circle.cx, circle.cy, -g.rotation) : pos;
  const{pts}=getPolyline(s);
  let md=Infinity;
  for(let j=0;j<pts.length-1;j++)md=Math.min(md,segDist(pLocal,pts[j],pts[j+1]));
  if(isShapeClosed(s)&&pts.length>2)md=Math.min(md,segDist(pLocal,pts[pts.length-1],pts[0]));
  return Math.max(0,md-(s.strokeWidth||strokeWidth)/2);
}
function snapToPoint(pos,excludeId=null){
  let best=null,bestD=SNAP_D;
  shapes.forEach(s=>{
    if(s.id===excludeId)return;
    const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
    s.points.forEach(p=>{
      const pWorld = g ? rotAround(p, circle.cx, circle.cy, g.rotation) : p;
      const d=Math.hypot(pos.x-pWorld.x,pos.y-pWorld.y);
      if(d<bestD){bestD=d;best=pWorld;}
    });
  });
  if(drawingShape&&drawingShape.points.length>=2){
    const p0=drawingShape.points[0];const d=Math.hypot(pos.x-p0.x,pos.y-p0.y);if(d<bestD){bestD=d;best=p0;}
  }
  return best;
}
// Ensure cps array exists and has correct length for shape
function ensureCps(s){return;} function old_ensureCps(s){
  const closed=isShapeClosed(s);
  const rawPts=s.points;
  const segs=closed?rawPts.length:rawPts.length-1;
  if(!s.cps)s.cps=[];
  while(s.cps.length<segs)s.cps.push([null,null]);
}
// Get/create segment control points, initializing from auto if null
function getOrInitSeg(s,segIdx){
  ensureCps(s);
  if(!s.cps[segIdx]) s.cps[segIdx] = [null, null];
  return s.cps[segIdx];
}
function splitBezier(p0, cp0, cp1, p1, t) {
  const u = 1 - t;
  const q0 = { x: u*p0.x + t*cp0.x, y: u*p0.y + t*cp0.y };
  const q1 = { x: u*cp0.x + t*cp1.x, y: u*cp0.y + t*cp1.y };
  const q2 = { x: u*cp1.x + t*p1.x, y: u*cp1.y + t*p1.y };
  const r0 = { x: u*q0.x + t*q1.x, y: u*q0.y + t*q1.y };
  const r1 = { x: u*q1.x + t*q2.x, y: u*q1.y + t*q2.y };
  const pt = { x: u*r0.x + t*r1.x, y: u*r0.y + t*r1.y };
  return { left: [p0, q0, r0, pt], right: [pt, r1, q2, p1] };
}
// ═══════════════════════════════════════════════
//  MOUSE EVENTS
// ═══════════════════════════════════════════════
mainCanvas.addEventListener('mousedown',e=>{if(e.button!==0)return;const p=clientToMm(e);_mdMm=p;_hasDragged=false;
  if(currentMode==='canvas')mCanvasDown(p,e);
  else if(currentMode==='draw')mDrawDown(p,e);
  else if(currentMode==='arrange')mArrDown(p,e);
  else if(currentMode==='label')mLblDown(p,e);
});
mainCanvas.addEventListener('mousemove',e=>{
  const p=clientToMm(e);
  if(_mdMm&&Math.hypot(p.x-_mdMm.x,p.y-_mdMm.y)>0.6)_hasDragged=true;
  document.getElementById('sb-pos').textContent=`x: ${p.x.toFixed(1)}  y: ${p.y.toFixed(1)} mm`;
  if(currentMode==='canvas')mCanvasMove(p,e);
  else if(currentMode==='draw')mDrawMove(p,e);
  else if(currentMode==='arrange')mArrMove(p,e);
  else if(currentMode==='label')mLblMove(p,e);
});
window.addEventListener('mouseup',e=>{
  if(e.button!==0)return;
  if(_mdMm){
    const p=clientToMm(e);
    if(currentMode==='canvas')mCanvasUp(p);
    else if(currentMode==='draw')mDrawUp(p,e);
    else if(currentMode==='arrange')mArrUp(p,e);
    else if(currentMode==='label')mLblUp(p);
  }
  _mdMm=null;
  _hasDragged=false;
});
mainCanvas.addEventListener('dblclick',e=>{if(currentMode==='draw'&&drawTool!=='select')finishDrawing();});
function showContextMenu(e, items){
  const cm = document.getElementById('context-menu');
  cm.innerHTML = '';
  items.forEach(item => {
    const btn = document.createElement('div');
    btn.textContent = item.label;
    btn.style.padding = '6px 12px';
    btn.style.fontSize = '12px';
    btn.style.color = '#eee';
    btn.style.cursor = 'pointer';
    btn.onmouseenter = () => btn.style.background = '#1a5a9a';
    btn.onmouseleave = () => btn.style.background = 'transparent';
    btn.onclick = (ev) => {
      ev.stopPropagation();
      item.action();
      cm.style.display = 'none';
    };
    cm.appendChild(btn);
  });
  cm.style.left = e.clientX + 'px';
  cm.style.top = e.clientY + 'px';
  cm.style.display = 'block';
}
window.addEventListener('click', () => {
  const cm = document.getElementById('context-menu');
  if(cm) cm.style.display = 'none';
});
mainCanvas.addEventListener('contextmenu',e=>{
  e.preventDefault();
  if(drawing){finishDrawing();return;}
  if(currentMode==='draw' && drawTool==='select'){
    const p = clientToMm(e);
    const hp = hitPoint(p);
    if(hp) {
       const s = shapes.find(x => x.id === hp.shapeId);
         if(s && s.type === 'spline') {
            const p = s.points[hp.ptIdx];
            const isFree = p.mode === 'free';
            showContextMenu(e, [
              {
                label: isFree ? '대칭 모드로 변환' : '자유 모드로 변환',
                action: () => {
                  p.mode = isFree ? 'sym' : 'free';
                  if(p.mode === 'sym') p.inT = {x: -p.outT.x, y: -p.outT.y};
                  render();
                }
              },
              {
                label: '자동 핸들로 재설정',
                action: () => {
                  p.manual = false;
                  updateHermiteTangents(s);
                  render();
                }
              },
              {
                label: '점 삭제',
                action: () => {
                  s.points.splice(hp.ptIdx, 1);
                  if(s.points.length<2) {
                    shapes=shapes.filter(x=>x.id!==s.id);
                  } else {
                    updateHermiteTangents(s);
                  }
                  selPtIdx=null; render();
                }
              }
            ]);
            return;
          }
    }
    const hs = hitSegment(p);
    if(hs && hs.type === 'spline'){
       showContextMenu(e, [
         {
           label: '점 추가',
           action: () => {
             const closed = isShapeClosed(hs);
             const n = hs.points.length;
             const segs = closed ? n : n - 1;
             const g = hs.groupId ? groups.find(x=>x.id===hs.groupId) : null;
             const pLocal = g ? rotAround(p, circle.cx, circle.cy, -g.rotation) : p;
             let bestSeg = null; let minD = Infinity; let bestT = 0;
             for(let i=0; i<segs; i++) {
               const p0 = hs.points[i];
               const p1 = hs.points[(i+1)%n];
               const cp0 = { x: p0.x + p0.outT.x / 3, y: p0.y + p0.outT.y / 3 };
               const cp1 = { x: p1.x + p1.inT.x / 3, y: p1.y + p1.inT.y / 3 };
               for(let t=0; t<=1; t+=0.02) {
                 const u=1-t, x=u*u*u*p0.x+3*u*u*t*cp0.x+3*u*t*t*cp1.x+t*t*t*p1.x;
                 const y=u*u*u*p0.y+3*u*u*t*cp0.y+3*u*t*t*cp1.y+t*t*t*p1.y;
                 const d = Math.hypot(pLocal.x-x, pLocal.y-y);
                 if(d < minD){ minD = d; bestSeg = i; bestT = t; }
               }
             }
             if(bestSeg !== null) {
               const i = bestSeg;
               const p0 = hs.points[i], p1 = hs.points[(i+1)%n];
               const cp0 = { x: p0.x + p0.outT.x / 3, y: p0.y + p0.outT.y / 3 };
               const cp1 = { x: p1.x + p1.inT.x / 3, y: p1.y + p1.inT.y / 3 };
               const u = 1 - bestT;
               const nx = u*u*u*p0.x + 3*u*u*bestT*cp0.x + 3*u*bestT*bestT*cp1.x + bestT*bestT*bestT*p1.x;
               const ny = u*u*u*p0.y + 3*u*u*bestT*cp0.y + 3*u*bestT*bestT*cp1.y + bestT*bestT*bestT*p1.y;
               const split = splitBezier(p0, cp0, cp1, p1, bestT);
                const pt = split.left[3];
                const newPt = {
                  x: nx,
                  y: ny,
                  inT: { x: 0, y: 0 },
                  outT: { x: 0, y: 0 },
                  mode: 'free',
                  manual: false
                };
                
                // Allow the global solver to recalculate the shape
                p0.manual = false;
                p1.manual = false;
                
                hs.points.splice(i+1, 0, newPt);
                render();
              }
           }
         }
       ]);
       return;
    }
  }
});
// ═══════════════════════════════════════════════
//  CANVAS MODE HELPERS
// ═══════════════════════════════════════════════
function getTransformHandles(obj) {
  const {cx, cy, w, h, rotation} = obj;
  const rad = rotation * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const rot = (x, y) => ({ x: cx + x*cos - y*sin, y: cy + x*sin + y*cos });
  return {
    tl: rot(-w/2, -h/2), tr: rot(w/2, -h/2), br: rot(w/2, h/2), bl: rot(-w/2, h/2),
    t: rot(0, -h/2), r: rot(w/2, 0), b: rot(0, h/2), l: rot(-w/2, 0),
    rotH: rot(0, -h/2 - 10)
  };
}
function hitTestCanvasObj(obj, pos) {
  const rad = -obj.rotation * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const dx = pos.x - obj.cx, dy = pos.y - obj.cy;
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) <= obj.w/2 && Math.abs(ly) <= obj.h/2;
}
function getCanvasModeTarget(pos) {
  const hitR = Math.max(4, 8/viewScale);
  // 1. Check active object handles (only images, paper guide is locked)
  if (canvSelType === 'image') {
    const activeObj = images.find(x => x.id === canvSelId);
    if (activeObj) {
      const handles = getTransformHandles(activeObj);
      for (let k in handles) {
        if (Math.hypot(pos.x - handles[k].x, pos.y - handles[k].y) < hitR) {
          return { type: canvSelType, id: canvSelId, handle: k };
        }
      }
    }
  }
  // 1.5. Check circle center or border
  const distToCircleCenter = Math.hypot(pos.x - circle.cx, pos.y - circle.cy);
  if (distToCircleCenter < Math.max(6, 12/viewScale) || Math.abs(distToCircleCenter - circle.r) < Math.max(3, 6/viewScale)) {
    return { type: 'circle', id: null, handle: 'center' };
  }
  // 2. Check images (front to back)
  for (let i = images.length - 1; i >= 0; i--) {
    if (hitTestCanvasObj(images[i], pos)) {
      return { type: 'image', id: images[i].id, handle: 'center' };
    }
  }
  return null;
}
  // ── Canvas mode ──
function mCanvasDown(pos,e){
  const target = getCanvasModeTarget(pos);
  if (target) {
    canvSelType = target.type;
    canvSelId = target.id;
    canvSelHandle = target.handle;
    canvDragStartPos = { x: pos.x, y: pos.y };
    const obj = canvSelType === 'paper' ? paperGuide : (canvSelType === 'circle' ? circle : images.find(x => x.id === canvSelId));
    if(obj) {
      canvDragStartObj = { cx: obj.cx, cy: obj.cy, w: obj.w, h: obj.h, rotation: obj.rotation };
    }
  } else {
    canvSelType = null;
    canvSelId = null;
    canvSelHandle = null;
  }
  render();
}
function mCanvasMove(pos,e){
  if (!canvSelHandle || !_mdMm) return;
  const obj = canvSelType === 'paper' ? paperGuide : (canvSelType === 'circle' ? circle : images.find(x => x.id === canvSelId));
  if (!obj) return;
  const dx = pos.x - canvDragStartPos.x;
  const dy = pos.y - canvDragStartPos.y;
  if (canvSelHandle === 'center') {
    let nx = canvDragStartObj.cx + dx;
    let ny = canvDragStartObj.cy + dy;
    if (e.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) ny = canvDragStartObj.cy;
      else nx = canvDragStartObj.cx;
    }
    obj.cx = nx;
    obj.cy = ny;
  } else if (canvSelHandle === 'rotH') {
    const cx = canvDragStartObj.cx, cy = canvDragStartObj.cy;
    let ang = Math.atan2(pos.y - cy, pos.x - cx) * 180 / Math.PI + 90;
    if (e.shiftKey) ang = Math.round(ang / 45) * 45;
    obj.rotation = ang;
  } else {
    const rad = canvDragStartObj.rotation * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const locDx = dx * cos + dy * sin;
    const locDy = -dx * sin + dy * cos;
    let scaleX = 1, scaleY = 1;
    if (canvSelHandle === 'tl') { scaleX = (canvDragStartObj.w - locDx*2) / canvDragStartObj.w; scaleY = (canvDragStartObj.h - locDy*2) / canvDragStartObj.h; }
    else if (canvSelHandle === 'tr') { scaleX = (canvDragStartObj.w + locDx*2) / canvDragStartObj.w; scaleY = (canvDragStartObj.h - locDy*2) / canvDragStartObj.h; }
    else if (canvSelHandle === 'br') { scaleX = (canvDragStartObj.w + locDx*2) / canvDragStartObj.w; scaleY = (canvDragStartObj.h + locDy*2) / canvDragStartObj.h; }
    else if (canvSelHandle === 'bl') { scaleX = (canvDragStartObj.w - locDx*2) / canvDragStartObj.w; scaleY = (canvDragStartObj.h + locDy*2) / canvDragStartObj.h; }
    if (e.shiftKey) { const maxS = Math.max(scaleX, scaleY); scaleX = maxS; scaleY = maxS; }
    obj.w = Math.max(10, canvDragStartObj.w * scaleX);
    obj.h = Math.max(10, canvDragStartObj.h * scaleY);
    if (canvSelType === 'paper' && document.getElementById('pg-size').value === 'Custom') {
      document.getElementById('cv-w').value = Math.round(obj.w);
      document.getElementById('cv-h').value = Math.round(obj.h);
    }
  }
  render();
}
function mCanvasUp(pos){ canvSelHandle = null; }
  // ── Draw mode ──
function mDrawDown(pos,e){
  if(drawTool==='select'){
    const s=selShapeId!==null?shapes.find(x=>x.id===selShapeId):null;
    // 1. Check bezier handles if point is selected
    if(s&&s.type==='spline'&&selPtIdx!==null){
      if(hitHandle(pos,s,selPtIdx,'out')){
        dragState={type:'cpOut',shapeId:s.id,ptIdx:selPtIdx};
        return;
      }
      if(hitHandle(pos,s,selPtIdx,'in')){
        dragState={type:'cpIn',shapeId:s.id,ptIdx:selPtIdx};
        return;
      }
    }
      // 2. Hit test control point
    const hp=hitPoint(pos);
    if(hp){
      selShapeId=hp.shapeId;selPtIdx=hp.ptIdx;selHandle=null;dragState=null;
      updatePropsPanel();render();return;
    }
    // 3. Hit test shape
    const hs=hitSegment(pos);
    if(hs){
      selShapeId=hs.id;selPtIdx=null;selHandle=null;
      dragState={type:'shape',shapeId:hs.id,startPos:{...pos},origPts:hs.points.map(p=>({...p})),origCps:hs.cps?JSON.parse(JSON.stringify(hs.cps)):null};
      updatePropsPanel();render();return;
    }
    selShapeId=null;selPtIdx=null;selHandle=null;dragState=null;
    render();return;
  }
  // Drawing
  const snapOff=e.ctrlKey;
  let sx=pos.x,sy=pos.y;
  if(!snapOff){const sn=snapToPoint(pos,drawing?drawingShape?.id:null);if(sn){sx=sn.x;sy=sn.y;}}
  if(!drawing){
    drawingShape={id:nextShapeId++,type:drawTool,points:[{x:sx,y:sy,inT:{x:0,y:0},outT:{x:0,y:0},mode:'sym'}],closed:false,strokeWidth,groupId:GROUP1_ID};
    drawing=true;
  } else {
    const p0=drawingShape.points[0];
    if(drawingShape.points.length>=2&&Math.hypot(sx-p0.x,sy-p0.y)<SNAP_D){
      drawingShape.closed=true;finishDrawing();return;
    }
    drawingShape.points.push({x:sx,y:sy,inT:{x:0,y:0},outT:{x:0,y:0},mode:'sym'});
      if (drawingShape.type==='spline') updateHermiteTangents(drawingShape);
  }
  render();
}
function mDrawMove(pos,e){
  const snapOff=e.ctrlKey;
  if(drawTool==='select'&&!dragState){
    hoverPtRef=hitPoint(pos);
    mainCanvas.style.cursor=(hoverPtRef||hitSegment(pos))?'pointer':'default';
  }
  // Bezier handle drag
  if(dragState?.type==='cpOut'){
    const s=shapes.find(x=>x.id===dragState.shapeId);if(s){
      const p = s.points[dragState.ptIdx];
      p.manual = true; // Mark as manually adjusted
      p.outT = {x: pos.x - p.x, y: pos.y - p.y};
      if (p.mode === 'sym') p.inT = {x: -p.outT.x, y: -p.outT.y};
      const closed = isShapeClosed(s);
      const n = s.points.length;
      let nextIdx = (dragState.ptIdx + 1) % n;
      if (!closed && dragState.ptIdx === n - 1) { currentCurvature = null; }
      else {
        const p1 = s.points[nextIdx];
        currentCurvature = getCurvature(p, p.outT, p1, {x: -p1.inT.x, y: -p1.inT.y}, 0);
      }
    }
    render();return;
  }
  if(dragState?.type==='cpIn'){
    const s=shapes.find(x=>x.id===dragState.shapeId);if(s){
      const p = s.points[dragState.ptIdx];
      p.manual = true; // Mark as manually adjusted
      p.inT = {x: pos.x - p.x, y: pos.y - p.y};
      if (p.mode === 'sym') p.outT = {x: -p.inT.x, y: -p.inT.y};
      const closed = isShapeClosed(s);
      const n = s.points.length;
      let prevIdx = (dragState.ptIdx - 1 + n) % n;
      if (!closed && dragState.ptIdx === 0) { currentCurvature = null; }
      else {
        const p0 = s.points[prevIdx];
        currentCurvature = getCurvature(p0, p0.outT, p, {x: -p.inT.x, y: -p.inT.y}, 1);
      }
    }
    render();return;
  }
  // Point drag (activated once hasDragged)
  if(dragState?.type==='pt'&&_hasDragged){
    const s=shapes.find(x=>x.id===dragState.shapeId);
    if(s){
      const g = s.groupId ? groups.find(x=>x.id===s.groupId) : null;
      const pLocal = g ? rotAround(pos, circle.cx, circle.cy, -g.rotation) : pos;
      s.points[dragState.ptIdx].x=pLocal.x;
      s.points[dragState.ptIdx].y=pLocal.y;
      if (s.type === 'spline') {
        updateHermiteTangents(s);
      }
    }
    render();return;
  }
  // Shape drag
  if(dragState?.type==='shape'&&_hasDragged){
    const s=shapes.find(x=>x.id===dragState.shapeId);
    if(s){
      const dx=pos.x-dragState.startPos.x,dy=pos.y-dragState.startPos.y;
      s.points.forEach((p,i)=>{p.x=dragState.origPts[i].x+dx;p.y=dragState.origPts[i].y+dy;});
      if(s.cps&&dragState.origCps){s.cps.forEach((seg,i)=>{if(seg&&dragState.origCps[i]){seg[0]={x:dragState.origCps[i][0].x+dx,y:dragState.origCps[i][0].y+dy};seg[1]={x:dragState.origCps[i][1].x+dx,y:dragState.origCps[i][1].y+dy};}});}
    }
    render();return;
  }
  // Point drag (activated on mousedown, starts on first move)
  if(_mdMm && selShapeId!==null&&selPtIdx!==null&&drawTool==='select'&&_hasDragged&&!dragState){
    const s=shapes.find(x=>x.id===selShapeId);
    if(s){
      dragState={type:'pt',shapeId:s.id,ptIdx:selPtIdx,startPos:{...pos},origPts:s.points.map(p=>({...p}))};
    }
  }
  if(!drawing){render();return;}
  render();
  let px=pos.x,py=pos.y;
  if(!snapOff){const sn=snapToPoint(pos,drawingShape.id);if(sn){px=sn.x;py=sn.y;}}
  const p0=drawingShape.points[0];
  const willClose=drawingShape.points.length>=2&&Math.hypot(px-p0.x,py-p0.y)<SNAP_D;
  const sc=MM*viewScale,last=drawingShape.points[drawingShape.points.length-1];
  ctx.save();
  ctx.strokeStyle=willClose?'#00ff88aa':'#fff5';ctx.lineWidth=1.5;ctx.setLineDash([4,4]);
  ctx.beginPath();ctx.moveTo(last.x*sc,last.y*sc);ctx.lineTo(willClose?p0.x*sc:px*sc,willClose?p0.y*sc:py*sc);ctx.stroke();ctx.setLineDash([]);
  if(willClose){ctx.strokeStyle='#00ff88';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p0.x*sc,p0.y*sc,8,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
}
function mDrawUp(pos,e){
  dragState=null;render();
}
function finishDrawing(){
  if(!drawingShape){drawing=false;return;}
  if(drawingShape.points.length>=2)shapes.push(drawingShape);
  drawingShape=null;drawing=false;render();
}
function deleteSelectedShape(){
  if(selShapeId!==null){shapes=shapes.filter(s=>s.id!==selShapeId);selShapeId=null;selPtIdx=null;dragState=null;}
  render();
}
function clearAllShapes(){if(confirm('모든 도형을 삭제할까요?')){shapes=[];selShapeId=null;selPtIdx=null;render();}}
function updatePropsPanel(){
  if(selShapeId===null){document.getElementById('props-content').textContent='선택 없음';return;}
  const s=shapes.find(x=>x.id===selShapeId);if(!s)return;
  const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
  let h=`<b>도형 #${s.id}</b><br>타입: ${s.type}<br>두께: ${(s.strokeWidth||strokeWidth).toFixed(2)}mm<br>그룹: ${g?'그룹'+g.label:'없음'}<br>점수: ${isShapeClosed(s)?s.points.length-1:s.points.length}`;
  if(selPtIdx!==null&&s.points[selPtIdx]){
    const p=s.points[selPtIdx];
    h+=`<br><br><b>??${selPtIdx}</b><br>x: ${p.x.toFixed(2)}<br>y: ${p.y.toFixed(2)}`;
    if(s.type==='spline')h+=`<br><small style="color:#666">핸들 세부 보기<br>orange=입력, green=출력</small>`;
  }
  document.getElementById('props-content').innerHTML=h;
}
  // ── Arrange mode ──
function mArrDown(pos,e){
  // Group marker
  for(const g of groups){
    if(g.id===GROUP1_ID)continue;
    if(hitGroupMarker(pos,g)){
      arrDragState={type:'marker',groupId:g.id,startAng:Math.atan2(pos.y-circle.cy,pos.x-circle.cx),startRot:g.rotation};
      render();return;
    }
  }
  // ANY shape in ANY group
  const hs=hitSegment(pos);
  if(hs){
    arrSelShapeId=hs.id;
    // Follow to original if copy
    const origId=hs._isCopy?hs._origId:hs.id;
    arrDragState={type:'shape',shapeId:hs.id,origId,origGroupId:hs.groupId,startAng:Math.atan2(pos.y-circle.cy,pos.x-circle.cx),newGroupId:null};
    refreshGroupList();render();return;
  }
  arrSelShapeId=null;arrDragState=null;refreshGroupList();render();
}
function mArrMove(pos,e){
  if(!arrDragState||!_hasDragged)return;
  const ang=Math.atan2(pos.y-circle.cy,pos.x-circle.cx);
  if(arrDragState.type==='marker'){
    const g=groups.find(x=>x.id===arrDragState.groupId);
    if(g)g.rotation=arrDragState.startRot+(ang-arrDragState.startAng)*180/Math.PI;
    render();return;
  }
  if(arrDragState.type==='shape'){
    const origShape=shapes.find(x=>x.id===arrDragState.origId&&!x._isCopy)||shapes.find(x=>x.id===arrDragState.origId);
    if(!origShape)return;
    const delta=(ang-arrDragState.startAng)*180/Math.PI;
    const baseRot=arrDragState.origGroupId?groups.find(x=>x.id===arrDragState.origGroupId)?.rotation||0:0;
    const targetRot=baseRot+delta;
    if(e.ctrlKey){
      if(!arrDragState.newGroupId){
        const ng={id:nextGroupId++,label:groups.length+1,color:GCOLORS[groups.length%GCOLORS.length],rotation:0,locked:false};
        groups.push(ng);arrDragState.newGroupId=ng.id;refreshGroupList();
      }
      const ng=groups.find(x=>x.id===arrDragState.newGroupId);
      if(ng)ng.rotation=targetRot;
      if (!shapes.some(s => s._origId === origShape.id && s.groupId === arrDragState.newGroupId)) {
        const copy=makeCopy(origShape,arrDragState.newGroupId);
        arrSelShapeId=copy.id;
      }
    } else {
      let best=null,bestD=25;
      groups.forEach(g=>{const diff=((targetRot-g.rotation)%360+360)%360;const d=Math.min(diff,360-diff);if(d<bestD){bestD=d;best=g;}});
      if(best && arrDragState.origGroupId !== best.id){
        if(arrDragState.origGroupId !== GROUP1_ID) {
           removeCopy(origShape.id, arrDragState.origGroupId);
        }
        if(best.id === GROUP1_ID) {
           arrSelShapeId = origShape.id;
           arrDragState.origGroupId = GROUP1_ID;
        } else {
           const copy = makeCopy(origShape, best.id);
           arrSelShapeId = copy.id;
           arrDragState.origGroupId = best.id;
        }
      }
    }
    refreshGroupList();render();
  }
}
function mArrUp(pos,e){arrDragState=null;render();}
  // ── Label mode ──
function mLblDown(pos,e){
  for(const s of shapes){
    if(!s.groupId)continue;
    const g=groups.find(x=>x.id===s.groupId);if(!g)continue;
    const lbl=labels[s.id]||{ox:4,oy:-4};
    const ctr=shapeCenter(s);
    const lp=rotAround(pos,circle.cx,circle.cy,-g.rotation);
    const fs=parseFloat(document.getElementById('label-size').value)||4;
    if(Math.hypot(lp.x-(ctr.x+lbl.ox),lp.y-(ctr.y+lbl.oy))<fs){
      lblDrag={shapeId:s.id,startLocal:lp,startOx:lbl.ox,startOy:lbl.oy};return;
    }
  }
  lblDrag=null;
}
function mLblMove(pos,e){
  if(!lblDrag)return;
  const s=shapes.find(x=>x.id===lblDrag.shapeId);if(!s)return;
  const g=groups.find(x=>x.id===s.groupId);
  const lp=g?rotAround(pos,circle.cx,circle.cy,-g.rotation):pos;
  let ox=lblDrag.startOx+(lp.x-lblDrag.startLocal.x);
  let oy=lblDrag.startOy+(lp.y-lblDrag.startLocal.y);
  const ctr=shapeCenter(s);
  const d=distToShape({x:ctr.x+ox,y:ctr.y+oy},s);
  if(d>MAX_LBL){
    const mag=Math.hypot(ox,oy)||1;let lo=0,hi=mag;
    for(let k=0;k<20;k++){const mid=(lo+hi)/2;if(distToShape({x:ctr.x+ox/mag*mid,y:ctr.y+oy/mag*mid},s)<=MAX_LBL)lo=mid;else hi=mid;}
    ox=ox/mag*lo;oy=oy/mag*lo;
  }
  if(!labels[s.id])labels[s.id]={ox:4,oy:-4};
  labels[s.id].ox=ox;labels[s.id].oy=oy;render();
}
function mLblUp(pos){lblDrag=null;render();}
function rotAround(pos,cx,cy,deg){
  const r=deg*Math.PI/180,dx=pos.x-cx,dy=pos.y-cy;
  return{x:cx+dx*Math.cos(r)-dy*Math.sin(r),y:cy+dx*Math.sin(r)+dy*Math.cos(r)};
}
  // ── Keyboard ──
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(currentMode==='draw')setDrawTool('select');
  }
  if((e.key==='Delete'||e.key==='Backspace')&&!e.target.matches('input,textarea')){
    if(currentMode==='draw')deleteSelectedShape();
    else if(currentMode==='canvas' && canvSelType==='image' && canvSelId!==null) {
      images = images.filter(x => x.id !== canvSelId);
      canvSelId = null;
      canvSelType = null;
      render();
    }
  }
});
// ═══════════════════════════════════════════════
//  SAVE / LOAD / EXPORT
// ═══════════════════════════════════════════════
function saveProject(){
  const data={version:4,canvasW,canvasH,baseW,baseH,circle,shapes,groups,nextGroupId,labels,strokeWidth,bgColor:document.getElementById('cv-bg').value};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rotadraw.rdraw';a.click();
}
function loadProject(){document.getElementById('proj-input').click();}
function onProjectLoaded(e){
  const file=e.target.files[0];if(!file)return;
  const rd=new FileReader();
  rd.onload=ev=>{
    try{
      const d=JSON.parse(ev.target.result);
      canvasW=d.canvasW||200;canvasH=d.canvasH||200;baseW=d.baseW||canvasW;baseH=d.baseH||canvasH;
      paperGuide.w = canvasW;
      paperGuide.h = canvasH;
      paperGuide.cx = canvasW / 2;
      paperGuide.cy = canvasH / 2;
      paperGuide.rotation = 0;
      circle=d.circle||{cx:100,cy:100,r:75};
      shapes=d.shapes||[];nextShapeId=shapes.reduce((m,s)=>Math.max(m,s.id+1),1);
      groups=d.groups||[];nextGroupId=d.nextGroupId||groups.reduce((m,g)=>Math.max(m,g.id+1),2);
      if(!groups.length)initDefaultGroup();
      labels=d.labels||{};strokeWidth=d.strokeWidth||1;activeDrawGroupId=groups[0].id;
      document.getElementById('cv-w').value=canvasW;document.getElementById('cv-h').value=canvasH;
      document.getElementById('cv-bg').value=d.bgColor||'#ffffff';
      document.getElementById('circle-d').value=(circle.r*2).toFixed(1);
      document.getElementById('sw-num').value=strokeWidth.toFixed(2);document.getElementById('sw-range').value=strokeWidth;
      syncAspectSlider();refreshGroupList();setCanvasSize();render();
    }catch(err){alert('파일 오류: '+err.message);}
  };
  rd.readAsText(file);e.target.value='';
}
function showExportModal(){document.getElementById('export-modal').style.display='flex';}
function renderOffscreen(mmScale){
  const oc=document.createElement('canvas');
  oc.width=Math.round(paperGuide.w*mmScale);oc.height=Math.round(paperGuide.h*mmScale);
  const oc2=oc.getContext('2d');
  oc2.fillStyle=document.getElementById('cv-bg').value;oc2.fillRect(0,0,oc.width,oc.height);
  oc2.save();
  oc2.translate(oc.width/2, oc.height/2);
  oc2.rotate(-paperGuide.rotation * Math.PI / 180);
  oc2.translate(-paperGuide.cx * mmScale, -paperGuide.cy * mmScale);
  images.forEach(img => {
     oc2.save();
     oc2.translate(img.cx * mmScale, img.cy * mmScale);
     oc2.rotate(img.rotation * Math.PI / 180);
     oc2.drawImage(img.img, -img.w/2 * mmScale, -img.h/2 * mmScale, img.w * mmScale, img.h * mmScale);
     oc2.restore();
  });
  shapes.forEach(s=>{
    if(s.groupId===GROUP1_ID&&!s._isCopy&&hasCopy(s.id))return;
    const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
    oc2.save();
    if(g&&g.rotation!==0){oc2.translate(circle.cx*mmScale,circle.cy*mmScale);oc2.rotate(g.rotation*Math.PI/180);oc2.translate(-circle.cx*mmScale,-circle.cy*mmScale);}
    const path=getShapePath(s,mmScale);
    if(path){oc2.fillStyle=g?g.color:'#000';oc2.fill(path,'evenodd');}
    oc2.restore();
  });
  oc2.restore();
  return oc;
}
function exportPNG(){document.getElementById('export-modal').style.display='none';renderOffscreen(EXPORT_MM).toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='rotadraw.png';a.click();});}
function getGlobalBounds() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const addPt = (x, y) => { minX=Math.min(minX,x); minY=Math.min(minY,y); maxX=Math.max(maxX,x); maxY=Math.max(maxY,y); };
  shapes.forEach(s => {
     if(s.groupId===GROUP1_ID&&!s._isCopy&&hasCopy(s.id))return;
     const g = s.groupId ? groups.find(x=>x.id===s.groupId) : null;
     const {pts} = getPolyline(s);
     pts.forEach(p => {
        const w = g ? rotAround(p, circle.cx, circle.cy, g.rotation) : p;
        addPt(w.x, w.y);
     });
  });
  images.forEach(img => {
     const rad = img.rotation * Math.PI / 180;
     const cos = Math.cos(rad), sin = Math.sin(rad);
     const rot = (x, y) => ({ x: img.cx + x*cos - y*sin, y: img.cy + x*sin + y*cos });
     const tl=rot(-img.w/2,-img.h/2), tr=rot(img.w/2,-img.h/2), br=rot(img.w/2,img.h/2), bl=rot(-img.w/2,img.h/2);
     addPt(tl.x, tl.y); addPt(tr.x, tr.y); addPt(br.x, br.y); addPt(bl.x, bl.y);
  });
  if (minX === Infinity) return {x:0, y:0, w:100, h:100};
  minX -= 10; minY -= 10; maxX += 10; maxY += 10;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
function exportSVG(){
  document.getElementById('export-modal').style.display='none';
  const bounds = getGlobalBounds();
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}" width="${bounds.w}mm" height="${bounds.h}mm">\n`;
  svg+=`<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}" fill="${document.getElementById('cv-bg').value}"/>\n`;
  images.forEach(img => {
    svg += `<image x="${img.cx - img.w/2}" y="${img.cy - img.h/2}" width="${img.w}" height="${img.h}" href="${img.img.src}" transform="rotate(${img.rotation} ${img.cx} ${img.cy})" />\n`;
  });
  groups.forEach(g=>{
    svg+=`<g transform="rotate(${g.rotation},${circle.cx},${circle.cy})">\n`;
    shapes.filter(s=>s.groupId===g.id&&!(s.groupId===GROUP1_ID&&!s._isCopy&&hasCopy(s.id))).forEach(s=>{
      const d=svgPathD(s);if(d)svg+=`  <path d="${d}" fill="${g.color}" fill-rule="evenodd"/>\n`;
    });
    svg+=`</g>\n`;
  });
  svg+='</svg>';
  const blob=new Blob([svg],{type:'image/svg+xml'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rotadraw.svg';a.click();
}
function svgPathD(s){
  // Use bezier curves directly for spline, polyline for line
  if(s.type==='spline'){
    const closed=isShapeClosed(s);
    const rawPts=s.points;
    const rn=rawPts.length;if(rn<2)return null;
    const hw=(s.strokeWidth||strokeWidth)/2;
    // Sample polyline then build offset
    const{pts}=getPolyline(s);
    return svgOffsetPathD(pts,closed,hw);
  }
  const{pts,closed}=getPolyline(s);
  if(pts.length<2)return null;
  return svgOffsetPathD(pts,closed,(s.strokeWidth||strokeWidth)/2);
}
function svgOffsetPathD(pts,closed,hw){
  const n=pts.length;if(n<2)return null;
  const f=v=>v.toFixed(3);
  // Build offset using same logic as buildOffsetPath but output SVG string
  if(!closed){
    const segs=[];
    for(let i=0;i<n-1;i++)segs.push(offsetSeg(pts[i],pts[i+1],hw));
    const L=[segs[0].aL],R=[segs[0].aR];
    for(let i=0;i<segs.length-1;i++){
      const prev=segs[i],next=segs[i+1];
      const dPL={x:prev.bL.x-prev.aL.x,y:prev.bL.y-prev.aL.y};const dNL={x:next.bL.x-next.aL.x,y:next.bL.y-next.aL.y};
      const dPR={x:prev.bR.x-prev.aR.x,y:prev.bR.y-prev.aR.y};const dNR={x:next.bR.x-next.aR.x,y:next.bR.y-next.aR.y};
      L.push(miterJoin(prev.bL,dPL,next.aL,dNL,hw));R.push(miterJoin(prev.bR,dPR,next.aR,dNR,hw));
    }
    L.push(segs[segs.length-1].bL);R.push(segs[segs.length-1].bR);
    let d=`M${f(L[0].x)} ${f(L[0].y)}`;
    L.slice(1).forEach(p=>d+=` L${f(p.x)} ${f(p.y)}`);
    const ep=pts[n-1],a0=Math.atan2(pts[n-1].y-pts[n-2].y,pts[n-1].x-pts[n-2].x);
    for(let i=0;i<=8;i++){const a=a0-Math.PI/2+Math.PI*i/8;d+=` L${f(ep.x+Math.cos(a)*hw)} ${f(ep.y+Math.sin(a)*hw)}`;}
    for(let i=R.length-1;i>=0;i--)d+=` L${f(R[i].x)} ${f(R[i].y)}`;
    const sp=pts[0],a1=Math.atan2(pts[0].y-pts[1].y,pts[0].x-pts[1].x);
    for(let i=0;i<=8;i++){const a=a1-Math.PI/2+Math.PI*i/8;d+=` L${f(sp.x+Math.cos(a)*hw)} ${f(sp.y+Math.sin(a)*hw)}`;}
    return d+' Z';
  } else {
    const segs=[];
    for(let i=0;i<n;i++)segs.push(offsetSeg(pts[i],pts[(i+1)%n],hw));
    const O=[],I=[];
    for(let i=0;i<n;i++){
      const prev=segs[(i-1+n)%n],cur=segs[i];
      const dPL={x:prev.bL.x-prev.aL.x,y:prev.bL.y-prev.aL.y};const dCL={x:cur.bL.x-cur.aL.x,y:cur.bL.y-cur.aL.y};
      const dPR={x:prev.bR.x-prev.aR.x,y:prev.bR.y-prev.aR.y};const dCR={x:cur.bR.x-cur.aR.x,y:cur.bR.y-cur.aR.y};
      O.push(miterJoin(prev.bL,dPL,cur.aL,dCL,hw));I.push(miterJoin(prev.bR,dPR,cur.aR,dCR,hw));
    }
    let d=`M${f(O[0].x)} ${f(O[0].y)}`;O.slice(1).forEach(p=>d+=` L${f(p.x)} ${f(p.y)}`);d+=' Z';
    d+=` M${f(I[n-1].x)} ${f(I[n-1].y)}`;for(let i=n-2;i>=0;i--)d+=` L${f(I[i].x)} ${f(I[i].y)}`;return d+' Z';
  }
}
function exportDXF(){
  document.getElementById('export-modal').style.display='none';
  let dxf='0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';
  shapes.forEach(s=>{
    if(s.groupId===GROUP1_ID&&!s._isCopy&&hasCopy(s.id))return;
    const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
    const{pts}=getPolyline(s);if(pts.length<2)return;
    const rp=pts.map(p=>g?rotAround(p,circle.cx,circle.cy,g.rotation):p);
    dxf+=`0\nLWPOLYLINE\n8\nG${s.groupId||0}\n70\n${isShapeClosed(s)?1:0}\n`;
    rp.forEach(p=>{dxf+=`10\n${p.x.toFixed(4)}\n20\n${(-p.y).toFixed(4)}\n`;});
  });
  dxf+='0\nENDSEC\n0\nEOF\n';
  const blob=new Blob([dxf],{type:'application/dxf'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rotadraw.dxf';a.click();
}
function exportPDF(){
  document.getElementById('export-modal').style.display='none';
  const oc=renderOffscreen(EXPORT_MM);
  const url=oc.toDataURL('image/png');
  const win=window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><style>@page{size:${paperGuide.w}mm ${paperGuide.h}mm;margin:0}body{margin:0}img{width:${paperGuide.w}mm;height:${paperGuide.h}mm}</style></head><body><img src="${url}"></body></html>`);
  win.document.close();win.onload=()=>win.print();
}
// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
function init(){
  initDefaultGroup();refreshGroupList();setCanvasSize();
  const ar=canvasArea.getBoundingClientRect();
  if(ar.width>0&&ar.height>0){
    const sx=(ar.width-60)/(canvasW*MM),sy=(ar.height-60)/(canvasH*MM);
    viewScale=Math.min(sx,sy,2);
    viewOffX=(ar.width-canvasW*MM*viewScale)/2;
    viewOffY=(ar.height-canvasH*MM*viewScale)/2;
  }
  setCanvasSize();setMode('canvas');render();
}
window.addEventListener('resize',()=>render());
requestAnimationFrame(()=>requestAnimationFrame(init));