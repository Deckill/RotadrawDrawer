function render(){
  const W=mainCanvas.width,H=mainCanvas.height,sc=MM*viewScale;
  // 뷰포트 전체 클리어
  bgCtx.clearRect(0,0,W,H);
  ctx.clearRect(0,0,W,H);
  // pan/zoom 트랜스폼 적용 (캔버스는 뷰포트 고정 크기, 오프셋으로 이동)
  bgCtx.save();
  bgCtx.translate(viewOffX,viewOffY);
  ctx.save();
  ctx.translate(viewOffX,viewOffY);
  // 용지 영역에만 배경색 채우기
  bgCtx.fillStyle=document.getElementById('cv-bg').value;
  bgCtx.fillRect(0,0,canvasW*sc,canvasH*sc);
  if(bgImage)bgCtx.drawImage(bgImage,0,0,canvasW*sc,canvasH*sc);
  renderCanvasMode(sc);
  shapes.forEach(s=>renderShape(s,sc));
  if(drawing&&drawingShape)renderShape(drawingShape,sc,true);
  renderCircle(sc);
  if(currentMode==='arrange'||currentMode==='label')renderGroupMarkers(sc);
  if(currentMode==='label')renderLabels(sc);
  if(currentMode==='draw'&&drawTool==='select'&&selShapeId!==null&&selPtIdx!==null)renderBezierHandles(sc);
  if(typeof updateImageSizeUI === 'function') updateImageSizeUI();
  // 트랜스폼 복구
  bgCtx.restore();
  ctx.restore();
}

function renderShape(s,sc,isPreview=false,customCtx=null){
  const drawCtx=customCtx||ctx;
  const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
  const color=gColor(s);
  const isGhost=(s.groupId===GROUP1_ID&&!s._isCopy&&hasCopy(s.id));
  const isCopyInDrawMode=(currentMode==='draw'&&s._isCopy);
  // draw 모드에서 isGhost는 무시 (원본을 진하게 보이게)
  const applyGhost = isGhost && currentMode !== 'draw';
  const shapeOpacity = (s.opacity !== undefined ? s.opacity : 1.0);
  drawCtx.save();
  if(g&&g.rotation!==0){
    drawCtx.translate(circle.cx*sc,circle.cy*sc);
    drawCtx.rotate(g.rotation*Math.PI/180);
    drawCtx.translate(-circle.cx*sc,-circle.cy*sc);
  }
  const baseAlpha = isPreview?0.55 : applyGhost?0.15 : isCopyInDrawMode?0.22 : 1.0;
  drawCtx.globalAlpha = baseAlpha * shapeOpacity;
  
  const{pts,closed}=getPolyline(s);
  if(pts.length>=2){
    drawCtx.beginPath();
    drawCtx.moveTo(pts[0].x*sc,pts[0].y*sc);
    pts.slice(1).forEach(p=>drawCtx.lineTo(p.x*sc,p.y*sc));
    drawCtx.lineJoin = 'miter';
    drawCtx.lineCap = 'round';
    if(closed){
      drawCtx.closePath();
      drawCtx.fillStyle=color;
      drawCtx.fill();
      drawCtx.strokeStyle=color;
      drawCtx.lineWidth=(s.strokeWidth||strokeWidth)*sc;
      drawCtx.stroke();
    } else {
      drawCtx.strokeStyle=color;
      drawCtx.lineWidth=(s.strokeWidth||strokeWidth)*sc;
      drawCtx.stroke();
    }
  }

  // Arrange highlight
  if(currentMode==='arrange'&&s.id===arrSelShapeId&&pts.length>=2&&!customCtx){
    drawCtx.save();
    drawCtx.globalAlpha=0.3;
    drawCtx.beginPath();
    drawCtx.moveTo(pts[0].x*sc,pts[0].y*sc);
    pts.slice(1).forEach(p=>drawCtx.lineTo(p.x*sc,p.y*sc));
    if(closed){
      drawCtx.closePath();
      drawCtx.fillStyle='#fff';
      drawCtx.fill();
    }
    drawCtx.restore();
    
    drawCtx.globalAlpha=0.9;drawCtx.strokeStyle='#fff';drawCtx.lineWidth=1.5;
    drawCtx.beginPath();drawCtx.moveTo(pts[0].x*sc,pts[0].y*sc);
    pts.slice(1).forEach(p=>drawCtx.lineTo(p.x*sc,p.y*sc));
    if(closed)drawCtx.closePath();
    drawCtx.stroke();
  }
  // Draw mode vertex/edge drawing
  if(currentMode==='draw'&&s.id===selShapeId&&!customCtx){
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

function renderCanvasMode(sc) {
  images.forEach(img => {
     ctx.save();
     ctx.globalAlpha = (img.opacity !== undefined ? img.opacity : 1.0);
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
     const activeObj = canvSelType === 'paper' ? paperGuide : (canvSelType === 'image' ? images.find(x => x.id === canvSelId) : (canvSelType === 'shapes' ? shapesTransform : null));
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
    if(s.groupId===GROUP1_ID && !s._isCopy && hasCopy(s.id)) return;
    const g=groups.find(x=>x.id===s.groupId);if(!g)return;
    const targetId = s._isCopy ? s._origId : s.id;
    const lbl=labels[targetId]||{ox:4,oy:-4};
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