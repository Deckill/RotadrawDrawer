function init(){
  initDefaultGroup();refreshGroupList();setCanvasSize();
  const ar=canvasArea.getBoundingClientRect();
  if(ar.width>0&&ar.height>0){
    const sx=(ar.width-60)/(canvasW*MM),sy=(ar.height-60)/(canvasH*MM);
    viewScale=Math.min(sx,sy,2);
    viewOffX=(ar.width-canvasW*MM*viewScale)/2;
    viewOffY=(ar.height-canvasH*MM*viewScale)/2;
  }
  setCanvasSize();
  const loaded = loadAutosave();
  if(!loaded) {
    setMode('canvas');
  } else {
    setMode(currentMode);
  }
  render();
}

function setCanvasSize() {
  // 뷰포트 크기로 고정 - 줌과 무관하게 캔버스 크기 일정
  const ar = canvasArea.getBoundingClientRect();
  const pw = Math.max(1, Math.round(ar.width));
  const ph = Math.max(1, Math.round(ar.height));
  bgCanvas.width  = mainCanvas.width  = pw;
  bgCanvas.height = mainCanvas.height = ph;
  bgCanvas.style.width  = mainCanvas.style.width  = pw+'px';
  bgCanvas.style.height = mainCanvas.style.height = ph+'px';
  wrapper.style.width  = pw+'px';
  wrapper.style.height = ph+'px';
  // wrapper는 항상 (0,0) - 오프셋은 render() 내 ctx.translate로 처리
  wrapper.style.left = '0px';
  wrapper.style.top  = '0px';
}

function goHome() {
  const ar = canvasArea.getBoundingClientRect();
  if (ar.width > 0 && ar.height > 0) {
    viewScale = Math.min((ar.width - 60) / (paperGuide.w * MM), (ar.height - 60) / (paperGuide.h * MM), 2);
    viewOffX = (ar.width - paperGuide.w * MM * viewScale) / 2;
    viewOffY = (ar.height - paperGuide.h * MM * viewScale) / 2;
    render();
  }
}

window.addEventListener('mousemove', e => { if(_pan){viewOffX=e.clientX-_panO.x;viewOffY=e.clientY-_panO.y;render();} });
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
  triggerAutosave();
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
                        const isSym = p.mode === 'sym';
            const isSmooth = p.mode === 'smooth';
                        showContextMenu(e, [
              {
                label: 'Smooth 모드',
                action: () => {
                  p.mode = 'smooth';
                  const lenIn = Math.hypot(p.inT.x, p.inT.y);
                  const lenOut = Math.hypot(p.outT.x, p.outT.y) || 1e-5;
                  if (lenIn > 0) p.inT = {x: -p.outT.x * lenIn / lenOut, y: -p.outT.y * lenIn / lenOut};
                  render();
                }
              },
              {
                label: 'Symmetric 모드',
                action: () => {
                  p.mode = 'sym';
                  p.inT = {x: -p.outT.x, y: -p.outT.y};
                  render();
                }
              },
              {
                label: 'Cusp 모드',
                action: () => {
                  p.mode = 'cusp';
                  render();
                }
              },
              {
                label: '자동 모드 재설정',
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
               const cp0 = { x: p0.x + p0.outT.x, y: p0.y + p0.outT.y };
               const cp1 = { x: p1.x + p1.inT.x, y: p1.y + p1.inT.y };
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
                const cp0 = { x: p0.x + p0.outT.x, y: p0.y + p0.outT.y };
                const cp1 = { x: p1.x + p1.inT.x, y: p1.y + p1.inT.y };
                const u = 1 - bestT;
                const nx = u*u*u*p0.x + 3*u*u*bestT*cp0.x + 3*u*bestT*bestT*cp1.x + bestT*bestT*bestT*p1.x;
                const ny = u*u*u*p0.y + 3*u*u*bestT*cp0.y + 3*u*bestT*bestT*cp1.y + bestT*bestT*bestT*p1.y;
                const split = splitBezier(p0, cp0, cp1, p1, bestT);
                const pt = split.left[3];
                const newPt = {
                  x: pt.x,
                  y: pt.y,
                  inT: { x: split.left[2].x - pt.x, y: split.left[2].y - pt.y },
                  outT: { x: split.right[1].x - pt.x, y: split.right[1].y - pt.y },
                  mode: 'smooth',
                  manual: true
                };
                
                p0.outT = { x: split.left[1].x - p0.x, y: split.left[1].y - p0.y };
                p1.inT = { x: split.right[2].x - p1.x, y: split.right[2].y - p1.y };
                
                if (p0.mode === 'sym') p0.mode = 'smooth';
                if (p1.mode === 'sym') p1.mode = 'smooth';
                
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

function loadAutosave() {
  try {
    const saved = localStorage.getItem('rotadraw_autosave');
    if (saved) {
      const d = JSON.parse(saved);
      if (d && (d.shapes || d.groups)) {
        canvasW=d.canvasW||200;canvasH=d.canvasH||200;baseW=d.baseW||canvasW;baseH=d.baseH||canvasH;
        paperGuide.w = canvasW;
        paperGuide.h = canvasH;
        paperGuide.cx = canvasW / 2;
        paperGuide.cy = canvasH / 2;
        paperGuide.rotation = 0;
        circle=d.circle||{cx:100,cy:100,r:75};
        shapes=d.shapes||[];nextShapeId=shapes.reduce((m,s)=>Math.max(m,s.id+1),1);
        groups=d.groups||[];
        let g1 = groups.find(g => g.id === GROUP1_ID);
        if (!g1) {
          groups.unshift({id:GROUP1_ID,label:1,color:GCOLORS[0],rotation:0,locked:true});
        } else {
          g1.rotation = 0;
          g1.locked = true;
        }
        nextGroupId=d.nextGroupId||groups.reduce((m,g)=>Math.max(m,g.id+1),2);
        labels=d.labels||{};strokeWidth=d.strokeWidth||1;
        
        document.getElementById('cv-w').value=canvasW;
        document.getElementById('cv-h').value=canvasH;
        document.getElementById('cv-bg').value=d.bgColor||'#ffffff';
        document.getElementById('circle-d').value=(circle.r*2).toFixed(1);
        document.getElementById('sw-num').value=strokeWidth.toFixed(2);
        document.getElementById('sw-range').value=strokeWidth;
        
        refreshGroupList();
        setCanvasSize();
        console.log('Autosave loaded successfully.');
        return true;
      }
    }
  } catch (err) {
    console.warn('Failed to load autosave:', err);
  }
  return false;
}