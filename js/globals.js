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
// Undo / Redo
let undoStack = [], redoStack = [];
const MAX_UNDO = 20;
let currentFileHandle = null;
let shapesTransform = { cx: 0, cy: 0, w: 0, h: 0, rotation: 0 };
let transformStartShapes = null;
let lastShapeScaleValue = 100;
function _snapState() {
  return JSON.stringify({
    shapes: JSON.parse(JSON.stringify(shapes)),
    groups: JSON.parse(JSON.stringify(groups)),
    circle: {...circle},
    canvasW, canvasH, baseW, baseH,
    labels: JSON.parse(JSON.stringify(labels)),
    strokeWidth, nextShapeId, nextGroupId,
    paperGuide: JSON.parse(JSON.stringify(paperGuide))
  });
}
function saveSnapshot() {
  const s = _snapState();
  if (undoStack.length > 0 && undoStack[undoStack.length-1] === s) return;
  undoStack.push(s);
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack = [];
}
function _applySnap(snap) {
  const d = JSON.parse(snap);
  shapes = d.shapes; groups = d.groups; circle = d.circle;
  canvasW = d.canvasW; canvasH = d.canvasH;
  baseW = d.baseW||canvasW; baseH = d.baseH||canvasH;
  labels = d.labels||{}; strokeWidth = d.strokeWidth;
  nextShapeId = d.nextShapeId; nextGroupId = d.nextGroupId;
  if (d.paperGuide) Object.assign(paperGuide, d.paperGuide);
  selShapeId=null; selPtIdx=null; dragState=null;
  arrSelShapeId=null; arrDragState=null;
  try {
    document.getElementById('cv-w').value = canvasW;
    document.getElementById('cv-h').value = canvasH;
    document.getElementById('circle-d').value = (circle.r*2).toFixed(1);
    document.getElementById('sw-num').value = strokeWidth.toFixed(2);
    document.getElementById('sw-range').value = strokeWidth;
  } catch(e2) {}
  refreshGroupList();
  setCanvasSize();
  render();
}
function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(_snapState());
  if (redoStack.length > MAX_UNDO) redoStack.shift();
  _applySnap(undoStack.pop());
}
function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(_snapState());
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  _applySnap(redoStack.pop());
}
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
  // viewport 기반 캔버스: canvasArea 기준 + viewOffX/Y 보정
  const r = canvasArea.getBoundingClientRect();
  return { x: (e.clientX - r.left - viewOffX)/(MM*viewScale), y: (e.clientY - r.top - viewOffY)/(MM*viewScale) };
}

let _zoomRaf = null;
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
  // 캔버스 크기는 뷰포트 고정 - RAF로 render만 호출
  if (!_zoomRaf) {
    _zoomRaf = requestAnimationFrame(() => {
      _zoomRaf = null;
      render();
    });
  }
}, { passive:false });
let _pan=false, _panO=null;
canvasArea.addEventListener('mousedown', e => { if(e.button===1){_pan=true;_panO={x:e.clientX-viewOffX,y:e.clientY-viewOffY};e.preventDefault();} });


// ═══════════════════════════════════════════════
//  GROUPS
// ═══════════════════════════════════════════════
const GCOLORS=['#e94560','#00b4d8','#06d6a0','#ffd166','#a855f7','#f97316','#ec4899','#14b8a6','#84cc16','#f43f5e'];



// Copy system





// ═══════════════════════════════════════════════
//  STROKE WIDTH
// ═══════════════════════════════════════════════


// ═══════════════════════════════════════════════
//  MODES
// ═══════════════════════════════════════════════
const MODE_NAMES={canvas:'캔버스',draw:'그리기',arrange:'배치',label:'레이블'};




// ==========================================
//  HERMITE SPLINE SYSTEM
// ==========================================









// Get visible control points for selected spline segment


let currentCurvature = null;

// ═══════════════════════════════════════════════
//  OFFSET RENDERING HELPERS
// ═══════════════════════════════════════════════
function segNormal(a,b){
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
  return{nx:-dy/len,ny:dx/len};
}





function gColor(s){
  const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
  return g?g.color:'#aaa';
}






// ═══════════════════════════════════════════════
//  HIT TESTING
// ═══════════════════════════════════════════════



function hitHandle(pos,s,ptIdx,side){
  if(!s||s.type!=='spline')return false;
  const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
  const pLocal = g ? rotAround(pos, circle.cx, circle.cy, -g.rotation) : pos;
  const{out:outH,inn:inH}=getHandlePositions(s,ptIdx);
  const h=side==='out'?outH:inH;
  if(!h)return false;
  // 픽셀 기준 반경: 줌 수준에 관계없이 항상 7px (점 10px보다 작아 점 우선순위 자연 보장)
  const thresh = 7 / (MM * viewScale);
  return Math.hypot(pLocal.x-h.x,pLocal.y-h.y)<thresh;
}




// Ensure cps array exists and has correct length for shape
 function old_ensureCps(s){
  const closed=isShapeClosed(s);
  const rawPts=s.points;
  const segs=closed?rawPts.length:rawPts.length-1;
  if(!s.cps)s.cps=[];
  while(s.cps.length<segs)s.cps.push([null,null]);
}
// Get/create segment control points, initializing from auto if null


// ═══════════════════════════════════════════════
//  MOUSE EVENTS
// ═══════════════════════════════════════════════




// ═══════════════════════════════════════════════
//  CANVAS MODE HELPERS
// ═══════════════════════════════════════════════



  // ── Canvas mode ──



  // ── Draw mode ──







  // ── Arrange mode ──



  // ── Label mode ──




  // ── Keyboard ──
document.addEventListener('keydown',e=>{
  // input/textarea에서는 단축키 무시
  if(e.target.matches('input,textarea,select'))return;

  // Ctrl/Cmd 단축키
  if(e.ctrlKey||e.metaKey){
    if(e.key==='z'||e.key==='Z'){
      e.preventDefault();
      if(e.shiftKey)redo(); else undo();
      return;
    }
    if(e.key==='y'||e.key==='Y'){e.preventDefault();redo();return;}
    if(e.key==='s'||e.key==='S'){
      e.preventDefault();
      if(e.shiftKey){
        saveProjectAs();
      } else {
        saveProject();
      }
      return;
    }
    if(e.key==='l'||e.key==='L'){e.preventDefault();loadProject();return;}
    if(e.key==='p'||e.key==='P'){e.preventDefault();showExportModal();return;}
    return;
  }

  if(e.key==='Escape'){
    if(currentMode==='draw')setDrawTool('select');
  }
  if((e.key==='Delete'||e.key==='Backspace')){
    if(currentMode==='draw')deleteSelectedShape();
    else if(currentMode==='canvas'&&canvSelType==='image'&&canvSelId!==null){
      images=images.filter(x=>x.id!==canvSelId);
      canvSelId=null;canvSelType=null;
      render();
    }
  }

  // 그리기 모드 도구 단축키
  if(currentMode==='draw'&&!e.altKey){
    if(e.key==='l'||e.key==='L'){setDrawTool('line');return;}
    if(e.key==='s'||e.key==='S'){setDrawTool('spline');return;}
  }
});
// ═══════════════════════════════════════════════
//  SAVE / LOAD / EXPORT
// ═══════════════════════════════════════════════








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



// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════

window.addEventListener('resize',()=>{setCanvasSize();render();});
requestAnimationFrame(()=>requestAnimationFrame(init));
let currentSplineAlgo = "natural"; // natural, catmull, bspline

function triggerAutosave() {
  try {
    const data = {
      version: 4,
      canvasW,
      canvasH,
      baseW,
      baseH,
      circle,
      shapes,
      groups,
      nextGroupId,
      labels,
      strokeWidth,
      bgColor: document.getElementById('cv-bg').value
    };
    localStorage.setItem('rotadraw_autosave', JSON.stringify(data));
  } catch (e) {
    console.warn('Auto-save failed:', e);
  }
}
