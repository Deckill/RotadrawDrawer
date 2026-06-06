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

window.addEventListener('mousemove', e => { if(_pan){viewOffX=e.clientX-_panO.x;viewOffY=e.clientY-_panO.y;wrapper.style.left=viewOffX+'px';wrapper.style.top=viewOffY+'px';} });
window.addEventListener('mouseup',   e => { if(e.button===1)_pan=false; });
// ═══════════════════════════════════════════════
//  CANVAS SIZE CONTROLS
// ═══════════════════════════════════════════════





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

window.addEventListener('click', () => {
  const cm = document.getElementById('context-menu');
  if(cm) cm.style.display = 'none';
});

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

mainCanvas.addEventListener('dblclick',e=>{if(currentMode==='draw'&&drawTool!=='select')finishDrawing();});


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
                updateHermiteTangents(hs);
                render();
              }
           }
         }
       ]);
       return;
    }
  }
});