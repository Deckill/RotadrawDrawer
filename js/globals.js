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
  return Math.hypot(pLocal.x-h.x,pLocal.y-h.y)<Math.max(2,6/viewScale);
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

window.addEventListener('resize',()=>render());
requestAnimationFrame(()=>requestAnimationFrame(init));