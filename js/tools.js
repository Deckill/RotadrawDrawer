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

function finishDrawing(){
  if(!drawingShape){drawing=false;return;}
  if(drawingShape.points.length>=2)shapes.push(drawingShape);
  drawingShape=null;drawing=false;render();
}