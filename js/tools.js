function mCanvasDown(pos,e){
  const target = getCanvasModeTarget(pos);
  if (target) {
    canvSelType = target.type;
    canvSelId = target.id;
    canvSelHandle = target.handle;
    canvDragStartPos = { x: pos.x, y: pos.y };
    const obj = canvSelType === 'paper' ? paperGuide : (canvSelType === 'circle' ? circle : (canvSelType === 'shapes' ? shapesTransform : images.find(x => x.id === canvSelId)));
    if(obj) {
      canvDragStartObj = { cx: obj.cx, cy: obj.cy, w: obj.w, h: obj.h, rotation: obj.rotation };
    }
    if (canvSelType === 'shapes') {
      transformStartShapes = JSON.parse(JSON.stringify(shapes));
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
  const obj = canvSelType === 'paper' ? paperGuide : (canvSelType === 'circle' ? circle : (canvSelType === 'shapes' ? shapesTransform : images.find(x => x.id === canvSelId)));
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

  // shapes 실시간 변환 적용
  if (canvSelType === 'shapes' && transformStartShapes) {
    const startObj = canvDragStartObj;
    const currentObj = shapesTransform;
    const sx = startObj.w > 0 ? (currentObj.w / startObj.w) : 1;
    const sy = startObj.h > 0 ? (currentObj.h / startObj.h) : 1;
    const dRot = currentObj.rotation - startObj.rotation;
    const dxVal = currentObj.cx - startObj.cx;
    const dyVal = currentObj.cy - startObj.cy;

    shapes = JSON.parse(JSON.stringify(transformStartShapes));
    shapes.forEach(shape => {
      shape.points.forEach(p => {
        let px1 = startObj.cx + (p.x - startObj.cx) * sx;
        let py1 = startObj.cy + (p.y - startObj.cy) * sy;
        let pRot = rotAround({ x: px1, y: py1 }, startObj.cx, startObj.cy, dRot);
        p.x = pRot.x + dxVal;
        p.y = pRot.y + dyVal;

        if (p.inT) {
          let vx1 = p.inT.x * sx;
          let vy1 = p.inT.y * sy;
          let vRot = rotAround({ x: vx1, y: vy1 }, 0, 0, dRot);
          p.inT.x = vRot.x;
          p.inT.y = vRot.y;
        }
        if (p.outT) {
          let vx1 = p.outT.x * sx;
          let vy1 = p.outT.y * sy;
          let vRot = rotAround({ x: vx1, y: vy1 }, 0, 0, dRot);
          p.outT.x = vRot.x;
          p.outT.y = vRot.y;
        }
      });
    });
  }

  render();
}

function mCanvasUp(pos){
  canvSelHandle = null;
  if (canvSelType === 'shapes') {
    if (transformStartShapes) {
      saveSnapshot();
      triggerAutosave();
      transformStartShapes = null;
    }
    const bounds = getShapesBounds();
    if (bounds) {
      shapesTransform.cx = bounds.x + bounds.w/2;
      shapesTransform.cy = bounds.y + bounds.h/2;
      shapesTransform.w = bounds.w;
      shapesTransform.h = bounds.h;
      shapesTransform.rotation = 0;
    }
  }
}

function mDrawDown(pos,e){
  if(drawTool==='select'){
    const s=selShapeId!==null?shapes.find(x=>x.id===selShapeId):null;

    // 1. 먼저 클릭 위치에 포인트가 있는지 확인
    const hp=hitPoint(pos);

    // 2. 클릭된 점이 현재 선택된 바로 그 점일 때만 핸들을 우선 체크
    //    (이미 선택된 점 위에서 핸들을 드래그해야 하므로)
    if(hp && s && s.type==='spline' && selPtIdx!==null
       && hp.shapeId===selShapeId && hp.ptIdx===selPtIdx){
      const pd=s.points[selPtIdx];
      if(hitHandle(pos,s,selPtIdx,'out')){
        const outH={x:pd.x+pd.outT.x,y:pd.y+pd.outT.y};
        dragState={type:'cpOut',shapeId:s.id,ptIdx:selPtIdx,grabX:outH.x-pos.x,grabY:outH.y-pos.y};
        return;
      }
      if(hitHandle(pos,s,selPtIdx,'in')){
        const inH={x:pd.x+pd.inT.x,y:pd.y+pd.inT.y};
        dragState={type:'cpIn',shapeId:s.id,ptIdx:selPtIdx,grabX:inH.x-pos.x,grabY:inH.y-pos.y};
        return;
      }
    }

    // 3. 포인트 클릭 처리 (어떤 핸들보다 우선)
    if(hp){
      selShapeId=hp.shapeId;selPtIdx=hp.ptIdx;selHandle=null;dragState=null;
      updatePropsPanel();render();return;
    }

    // 4. 포인트가 없을 때만 핸들 체크 (선택된 점의 핸들 드래그 시작)
    if(s&&s.type==='spline'&&selPtIdx!==null){
      const pd=s.points[selPtIdx];
      if(hitHandle(pos,s,selPtIdx,'out')){
        const outH={x:pd.x+pd.outT.x,y:pd.y+pd.outT.y};
        dragState={type:'cpOut',shapeId:s.id,ptIdx:selPtIdx,grabX:outH.x-pos.x,grabY:outH.y-pos.y};
        return;
      }
      if(hitHandle(pos,s,selPtIdx,'in')){
        const inH={x:pd.x+pd.inT.x,y:pd.y+pd.inT.y};
        dragState={type:'cpIn',shapeId:s.id,ptIdx:selPtIdx,grabX:inH.x-pos.x,grabY:inH.y-pos.y};
        return;
      }
    }

    // 5. 도형(선분) 클릭
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
    drawingShape={id:nextShapeId++,type:drawTool,points:[{x:sx,y:sy,inT:{x:0,y:0},outT:{x:0,y:0},mode:'smooth'}],closed:false,strokeWidth,groupId:GROUP1_ID};
    drawing=true;
  } else {
    const p0=drawingShape.points[0];
    if(drawingShape.points.length>=2&&Math.hypot(sx-p0.x,sy-p0.y)<SNAP_D){
      drawingShape.closed=true;finishDrawing();return;
    }
    drawingShape.points.push({x:sx,y:sy,inT:{x:0,y:0},outT:{x:0,y:0},mode:'smooth'});
      if (drawingShape.type==='spline') updateHermiteTangents(drawingShape);
      // 그리기 중에는 원본 복사본 동기화 불필요 (혁재 그리는 도형은 아직 shapes에 없음)
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
      p.manual = true;
      // grab 오프셋 적용: 클릭 지점에서 핸들 중심까지의 차이를 보정
      const tx = pos.x + (dragState.grabX||0);
      const ty = pos.y + (dragState.grabY||0);
      p.outT = {x: tx - p.x, y: ty - p.y};
      if (p.mode === 'sym') p.inT = {x: -p.outT.x, y: -p.outT.y};
      else if (p.mode === 'smooth') {
        const lenIn = Math.hypot(p.inT.x, p.inT.y);
        const lenOut = Math.hypot(p.outT.x, p.outT.y) || 1e-5;
        p.inT = {x: -p.outT.x * lenIn / lenOut, y: -p.outT.y * lenIn / lenOut};
      }
      const closed = isShapeClosed(s);
      const n = s.points.length;
      let nextIdx = (dragState.ptIdx + 1) % n;
      if (!closed && dragState.ptIdx === n - 1) { currentCurvature = null; }
      else {
        const p1 = s.points[nextIdx];
        currentCurvature = getCurvature(p, p.outT, p1, {x: -p1.inT.x, y: -p1.inT.y}, 0);
      }
      syncCopies(s);
    }
    render();return;
  }
  if(dragState?.type==='cpIn'){
    const s=shapes.find(x=>x.id===dragState.shapeId);if(s){
      const p = s.points[dragState.ptIdx];
      p.manual = true;
      // grab 오프셋 적용
      const tx = pos.x + (dragState.grabX||0);
      const ty = pos.y + (dragState.grabY||0);
      p.inT = {x: tx - p.x, y: ty - p.y};
      if (p.mode === 'sym') p.outT = {x: -p.inT.x, y: -p.inT.y};
      else if (p.mode === 'smooth') {
        const lenOut = Math.hypot(p.outT.x, p.outT.y);
        const lenIn = Math.hypot(p.inT.x, p.inT.y) || 1e-5;
        p.outT = {x: -p.inT.x * lenOut / lenIn, y: -p.inT.y * lenOut / lenIn};
      }
      const closed = isShapeClosed(s);
      const n = s.points.length;
      let prevIdx = (dragState.ptIdx - 1 + n) % n;
      if (!closed && dragState.ptIdx === 0) { currentCurvature = null; }
      else {
        const p0 = s.points[prevIdx];
        currentCurvature = getCurvature(p0, p0.outT, p, {x: -p.inT.x, y: -p.inT.y}, 1);
      }
      syncCopies(s);
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
      if(s.type==='spline') updateHermiteTangents(s);
      syncCopies(s);
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
      syncCopies(s);
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
  // 드래그가 있었으면 스냅셛 저장
  if(dragState && _hasDragged) saveSnapshot();
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
    if(arrDragState.groupId === GROUP1_ID) return;
    const g=groups.find(x=>x.id===arrDragState.groupId);
    if(g)g.rotation=arrDragState.startRot+(ang-arrDragState.startAng)*180/Math.PI;
    render();return;
  }
  if(arrDragState.type==='shape'){
    const origShape=shapes.find(x=>x.id===arrDragState.origId&&!x._isCopy)||shapes.find(x=>x.id===arrDragState.origId);
    if(!origShape)return;

    // 마우스의 12시 기준 각도 (0~360): sin(ang)*r = x방향, -cos(ang)*r = y방향
    const mouseAngle360 = (Math.atan2(pos.x - circle.cx, -(pos.y - circle.cy)) * 180 / Math.PI + 360) % 360;

    if(e.ctrlKey){
      if(!arrDragState.newGroupId){
        const ng={id:nextGroupId++,label:groups.length+1,color:GCOLORS[groups.length%GCOLORS.length],rotation:mouseAngle360,locked:false};
        groups.push(ng);arrDragState.newGroupId=ng.id;refreshGroupList();
        // 원래 그룹이 GROUP1이 아니면 이동 (원본 그룹에서 제거)
        if(arrDragState.origGroupId !== GROUP1_ID){
          removeCopy(origShape.id, arrDragState.origGroupId);
          arrDragState.origGroupId = GROUP1_ID;
        }
      }
      const ng=groups.find(x=>x.id===arrDragState.newGroupId);
      // 새 그룹 rotation을 마우스 각도로 실시간 업데이트
      if(ng) ng.rotation = mouseAngle360;
      if(!shapes.some(s=>s._origId===origShape.id&&s.groupId===arrDragState.newGroupId)){
        const copy=makeCopy(origShape,arrDragState.newGroupId);
        arrSelShapeId=copy.id;
      }
    } else {
      // ctrl 뗐을 때: 생성된 새 그룹이 있으면 취소하고 snap 모드 복귀
      if(arrDragState.newGroupId !== null){
        groups = groups.filter(g => g.id !== arrDragState.newGroupId);
        shapes = shapes.filter(s => !(s._isCopy && s.groupId === arrDragState.newGroupId));
        arrDragState.newGroupId = null;
        arrSelShapeId = origShape.id;
        arrDragState.origGroupId = GROUP1_ID;
        refreshGroupList();
      }

      // 각도 기반 snap: 마우스 12시 각도와 각 그룹 rotation(0~360) 비교
      const SNAP_DEG = 25; // 25도 이내 snap
      let best=null, bestDiff=SNAP_DEG;
      groups.forEach(g=>{
        const gAngle = ((g.rotation % 360) + 360) % 360;
        const raw = Math.abs(mouseAngle360 - gAngle);
        const circDiff = Math.min(raw, 360 - raw);
        if(circDiff < bestDiff){ bestDiff = circDiff; best = g; }
      });
      if(best && arrDragState.origGroupId !== best.id){
        if(arrDragState.origGroupId !== GROUP1_ID){
          removeCopy(origShape.id, arrDragState.origGroupId);
        }
        if(best.id === GROUP1_ID){
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

function mArrUp(pos,e){
  // 드래그가 있었으면 스냅셛 저장
  if(arrDragState && _hasDragged) saveSnapshot();
  arrDragState=null;render();
}

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
  if(drawingShape.points.length>=2){
    if(drawingShape.type==='spline') updateHermiteTangents(drawingShape);
    shapes.push(drawingShape);
    saveSnapshot(); // 도형 그리기 완료 시 저장
  }
  drawingShape=null;drawing=false;render();
  triggerAutosave();
}