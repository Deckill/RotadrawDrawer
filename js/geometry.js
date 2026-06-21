
function getNativeCircleArcParams(s) {
  if (!s.points || s.points.length < 2) return null;
  if (s.type === 'circle2pt') {
    const r = Math.hypot(s.points[1].x - s.points[0].x, s.points[1].y - s.points[0].y);
    if (r < 0.1) return null;
    return { type: 'circle', cx: s.points[0].x, cy: s.points[0].y, r };
  }
  if (s.type === 'circle3pt') {
    if (s.points.length < 3) return null;
    const c = getCircleFrom3Pts(s.points[0], s.points[1], s.points[2]);
    if (c) return { type: 'circle', cx: c.cx, cy: c.cy, r: c.r };
  }
  if (s.type === 'arcCenter') {
    if (s.points.length < 3) return null;
    const center = s.points[0], start = s.points[1], end = s.points[2];
    const r = Math.hypot(start.x - center.x, start.y - center.y);
    if (r < 0.1) return null;
    let startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    let endAngle = Math.atan2(end.y - center.y, end.x - center.x);
    let sweep = endAngle - startAngle;
    if (sweep < 0) sweep += Math.PI * 2;
    return { type: 'arc', cx: center.x, cy: center.y, r, startAngle, endAngle: startAngle + sweep, sweep };
  }
  if (s.type === 'arc3pt') {
    if (s.points.length < 3) return null;
    const c = getCircleFrom3Pts(s.points[0], s.points[1], s.points[2]);
    if (!c) return null;
    let startAngle = Math.atan2(s.points[0].y - c.cy, s.points[0].x - c.cx);
    let midAngle = Math.atan2(s.points[1].y - c.cy, s.points[1].x - c.cx);
    let endAngle = Math.atan2(s.points[2].y - c.cy, s.points[2].x - c.cx);
    let sweep = endAngle - startAngle;
    if (sweep < 0) sweep += Math.PI * 2;
    let midSweep = midAngle - startAngle;
    if (midSweep < 0) midSweep += Math.PI * 2;
    if (midSweep > sweep) sweep -= Math.PI * 2;
    return { type: 'arc', cx: c.cx, cy: c.cy, r: c.r, startAngle, endAngle: startAngle + sweep, sweep };
  }
  return null;
}

function getCircle2PtPts(rawPts) {
  if (rawPts.length < 2) return [];
  const p0 = rawPts[0], p1 = rawPts[1];
  const r = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  if (r < 0.1) return [];
  const pts = [];
  const steps = 72;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    pts.push({ x: p0.x + Math.cos(angle)*r, y: p0.y + Math.sin(angle)*r });
  }
  return pts;
}

function getCircleFrom3Pts(p1, p2, p3) {
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const d = 2 * (x1*(y2-y3) + x2*(y3-y1) + x3*(y1-y2));
  if (Math.abs(d) < 1e-6) return null; // colinear
  const cx = ((x1*x1 + y1*y1)*(y2-y3) + (x2*x2 + y2*y2)*(y3-y1) + (x3*x3 + y3*y3)*(y1-y2)) / d;
  const cy = ((x1*x1 + y1*y1)*(x3-x2) + (x2*x2 + y2*y2)*(x1-x3) + (x3*x3 + y3*y3)*(x2-x1)) / d;
  const r = Math.hypot(x1 - cx, y1 - cy);
  return { cx, cy, r };
}

function getCircle3PtPts(rawPts) {
  if (rawPts.length < 2) return [];
  if (rawPts.length === 2) {
    // Just show a line preview
    return [{x:rawPts[0].x,y:rawPts[0].y}, {x:rawPts[1].x,y:rawPts[1].y}];
  }
  const c = getCircleFrom3Pts(rawPts[0], rawPts[1], rawPts[2]);
  if (!c) return [{x:rawPts[0].x,y:rawPts[0].y}, {x:rawPts[1].x,y:rawPts[1].y}, {x:rawPts[2].x,y:rawPts[2].y}];
  const pts = [];
  const steps = 72;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    pts.push({ x: c.cx + Math.cos(angle)*c.r, y: c.cy + Math.sin(angle)*c.r });
  }
  return pts;
}

function getArcCenterPts(rawPts) {
  if (rawPts.length < 2) return [];
  const center = rawPts[0], start = rawPts[1];
  const r = Math.hypot(start.x - center.x, start.y - center.y);
  if (r < 0.1) return [];
  if (rawPts.length === 2) {
    return [{x:center.x, y:center.y}, {x:start.x, y:start.y}];
  }
  const end = rawPts[2];
  let startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  let endAngle = Math.atan2(end.y - center.y, end.x - center.x);
  
  // Always draw arc counter-clockwise from start to end
  let sweep = endAngle - startAngle;
  if (sweep < 0) sweep += Math.PI * 2;
  
  const pts = [];
  const steps = Math.max(10, Math.ceil((sweep / (Math.PI * 2)) * 72));
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (i / steps) * sweep;
    pts.push({ x: center.x + Math.cos(angle)*r, y: center.y + Math.sin(angle)*r });
  }
  return pts;
}

function getArc3PtPts(rawPts) {
  if (rawPts.length < 2) return [];
  if (rawPts.length === 2) {
    return [{x:rawPts[0].x,y:rawPts[0].y}, {x:rawPts[1].x,y:rawPts[1].y}];
  }
  const c = getCircleFrom3Pts(rawPts[0], rawPts[1], rawPts[2]);
  if (!c) return [{x:rawPts[0].x,y:rawPts[0].y}, {x:rawPts[1].x,y:rawPts[1].y}, {x:rawPts[2].x,y:rawPts[2].y}];
  
  let startAngle = Math.atan2(rawPts[0].y - c.cy, rawPts[0].x - c.cx);
  let midAngle = Math.atan2(rawPts[1].y - c.cy, rawPts[1].x - c.cx);
  let endAngle = Math.atan2(rawPts[2].y - c.cy, rawPts[2].x - c.cx);
  
  // Determine direction to pass through midAngle
  let sweep = endAngle - startAngle;
  if (sweep < 0) sweep += Math.PI * 2;
  
  let midSweep = midAngle - startAngle;
  if (midSweep < 0) midSweep += Math.PI * 2;
  
  if (midSweep > sweep) {
    sweep -= Math.PI * 2; // draw clockwise
  }
  
  const pts = [];
  const steps = Math.max(10, Math.ceil((Math.abs(sweep) / (Math.PI * 2)) * 72));
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (i / steps) * sweep;
    pts.push({ x: c.cx + Math.cos(angle)*c.r, y: c.cy + Math.sin(angle)*c.r });
  }
  return pts;
}

function getPolyline(s) {
  const closed = s.closed === true;
  if (s.type === 'line') return {pts: s.points.map(p=>({x:p.x, y:p.y})), closed};
  if (s.type === 'circle2pt') return {pts: getCircle2PtPts(s.points), closed: true};
  if (s.type === 'circle3pt') return {pts: getCircle3PtPts(s.points), closed: true};
  if (s.type === 'arcCenter') return {pts: getArcCenterPts(s.points), closed: false};
  if (s.type === 'arc3pt') return {pts: getArc3PtPts(s.points), closed: false};

  const rawPts = s.points;
  const rn = rawPts.length;
  if (rn < 2) return {pts: rawPts.map(p=>({x:p.x, y:p.y})), closed};
  const segs = closed ? rn : rn - 1;
  const pts = [];
  const steps = 20;
  for (let i = 0; i < segs; i++) {
    const p0 = rawPts[i], p1 = rawPts[(i + 1) % rn];
    const c0 = {x: p0.x + p0.outT.x, y: p0.y + p0.outT.y};
    const c1 = {x: p1.x + p1.inT.x, y: p1.y + p1.inT.y};
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
  return buildOffsetPath(pts,closed,getCurrentStrokeWidth()/2,sc);
}

function segDist(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;
  if(l2===0)return Math.hypot(p.x-a.x,p.y-a.y);
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l2));
  return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
}

function shapeCenter(s){
  if(!s.points.length)return{x:0,y:0};
  const xs=s.points.map(p=>p.x),ys=s.points.map(p=>p.y);
  return{x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2};
}

function isShapeClosed(s){
  return s.closed === true;
}

function isShapeFilled(s) {
  if (s.isHollow !== false) return false;
  if (isShapeClosed(s)) return true;
  if (typeof isCCClosed === 'function' && isCCClosed(s.id)) return true;
  return false;
}

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

function offsetSeg(a,b,halfW){
  const{nx,ny}=segNormal(a,b);
  return{
    aL:{x:a.x+nx*halfW,y:a.y+ny*halfW},
    bL:{x:b.x+nx*halfW,y:b.y+ny*halfW},
    aR:{x:a.x-nx*halfW,y:a.y-ny*halfW},
    bR:{x:b.x-nx*halfW,y:b.y-ny*halfW}
  };
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

function hitPoint(pos){
  // 픽셀 기준 반경: 줌 수준에 관계없이 항상 10px
  const thresh = 10 / (MM * viewScale);
  for(let i=shapes.length-1;i>=0;i--){
    const s=shapes[i];
    // Draw 모드에서는 copy 선택 불가
    if(currentMode==='draw' && s._isCopy) continue;
    const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
    const pLocal = g ? rotAround(pos, circle.cx, circle.cy, -g.rotation) : pos;
    for(let j=0;j<s.points.length;j++){
      if(Math.hypot(pLocal.x-s.points[j].x,pLocal.y-s.points[j].y)<thresh)
        return{shapeId:s.id,ptIdx:j};
    }
  }
  return null;
}

function isPointInPolygon(p, s) {
  const {pts} = getPolyline(s);
  return isPointInPolygonPts(p, pts);
}

function isPointInPolygonPts(p, pts) {
  const n = pts.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    const intersect = ((yi > p.y) !== (yj > p.y))
        && (p.x < (xj - xi) * (p.y - yi) / (yj - yi + 1e-10) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function hitSegment(pos){
  const thresh=Math.max(1.5,4/viewScale);
  for(let i=shapes.length-1;i>=0;i--){
    const s=shapes[i];
    // Draw 모드에서는 copy 선택 불가
    if(currentMode==='draw' && s._isCopy) continue;
    if(currentMode==='arrange' && s.groupId===GROUP1_ID && !s._isCopy && hasCopy(s.id)) continue;
    const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
    const pLocal = g ? rotAround(pos, circle.cx, circle.cy, -g.rotation) : pos;
    
    const targetId = s._isCopy ? s._origId : s.id;
    if (isCCClosed(targetId)) {
      const rootId = getConnectedComponent(targetId)[0];
      const rootShape = shapes.find(x => x.id === rootId);
      if (rootShape && rootShape.isHollow !== true) {
         const loop = getCCLoopPolyline(targetId);
         if (loop && isPointInPolygonPts(pLocal, loop.pts)) return s;
      }
    } else if (isShapeClosed(s)) {
      if (s.isHollow !== true && isPointInPolygon(pLocal, s)) return s;
    }
    const{pts}=getPolyline(s);
    for(let j=0;j<pts.length-1;j++){if(segDist(pLocal,pts[j],pts[j+1])<thresh)return s;}
    if(isShapeClosed(s)&&pts.length>2&&segDist(pLocal,pts[pts.length-1],pts[0])<thresh)return s;
  }
  return null;
}

function hitHandle(pos,s,ptIdx,side){
  if(!s||s.type!=='spline')return false;
  const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
  const pLocal = g ? rotAround(pos, circle.cx, circle.cy, -g.rotation) : pos;
  const{out:outH,inn:inH}=getHandlePositions(s,ptIdx);
  const h=side==='out'?outH:inH;
  if(!h)return false;
  // 픽셀 기준 반경 (점 10px보다 작아 점 우선순위 자연 보장)
  const thresh = 7 / (MM * viewScale);
  return Math.hypot(pLocal.x-h.x,pLocal.y-h.y)<thresh;
}

function hitGroupMarker(pos,g){
  const rot=g.rotation*Math.PI/180;
  const mx=circle.cx+Math.sin(rot)*circle.r;
  const my=circle.cy-Math.cos(rot)*circle.r;
  return Math.hypot(pos.x-mx,pos.y-my)<10;
}

function distToShape(pos,s){
  const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
  const pLocal = g ? rotAround(pos, circle.cx, circle.cy, -g.rotation) : pos;
  if (isShapeClosed(s) && s.isHollow !== true && isPointInPolygon(pLocal, s)) {
    return 0;
  }
  const{pts}=getPolyline(s);
  let md=Infinity;
  for(let j=0;j<pts.length-1;j++)md=Math.min(md,segDist(pLocal,pts[j],pts[j+1]));
  if(isShapeClosed(s)&&pts.length>2)md=Math.min(md,segDist(pLocal,pts[pts.length-1],pts[0]));
  return Math.max(0,md-getCurrentStrokeWidth()/2);
}

function distToCCPolyline(pLocal, loopPolyline) {
  const pts = loopPolyline.pts;
  if (!pts || pts.length < 3) return Infinity;
  
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    const intersect = ((yi > pLocal.y) !== (yj > pLocal.y))
        && (pLocal.x < (xj - xi) * (pLocal.y - yi) / (yj - yi + 1e-10) + xi);
    if (intersect) inside = !inside;
  }
  if (inside) return 0;
  
  let md = Infinity;
  for(let j=0;j<pts.length-1;j++) md=Math.min(md,segDist(pLocal,pts[j],pts[j+1]));
  md=Math.min(md,segDist(pLocal,pts[pts.length-1],pts[0]));
  return md;
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

function ensureCps(s){return;}

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

function getShapesBounds() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  shapes.forEach(s => {
    const g = s.groupId ? groups.find(x => x.id === s.groupId) : null;
    const {pts} = getPolyline(s);
    pts.forEach(p => {
      const w = g ? rotAround(p, circle.cx, circle.cy, g.rotation) : p;
      minX = Math.min(minX, w.x);
      minY = Math.min(minY, w.y);
      maxX = Math.max(maxX, w.x);
      maxY = Math.max(maxY, w.y);
    });
  });
  if (minX === Infinity) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function getCanvasModeTarget(pos) {
  const hitR = Math.max(4, 8/viewScale);
  // 1. Check active object handles
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
  } else if (canvSelType === 'shapes' && shapesTransform) {
    const handles = getTransformHandles(shapesTransform);
    for (let k in handles) {
      if (Math.hypot(pos.x - handles[k].x, pos.y - handles[k].y) < hitR) {
        return { type: 'shapes', id: null, handle: k };
      }
    }
  }
  // 1.5. Check circle center or border
  const distToCircleCenter = Math.hypot(pos.x - circle.cx, pos.y - circle.cy);
  if (distToCircleCenter < Math.max(6, 12/viewScale) || Math.abs(distToCircleCenter - circle.r) < Math.max(3, 6/viewScale)) {
    return { type: 'circle', id: null, handle: 'center' };
  }
  // 1.8. Check shapes (vector lines)
  const hitShape = hitSegment(pos);
  if (hitShape) {
    const bounds = getShapesBounds();
    if (bounds) {
      shapesTransform.cx = bounds.x + bounds.w/2;
      shapesTransform.cy = bounds.y + bounds.h/2;
      shapesTransform.w = bounds.w;
      shapesTransform.h = bounds.h;
      shapesTransform.rotation = 0;
      return { type: 'shapes', id: null, handle: 'center' };
    }
  }
  // 2. Check images (front to back)
  for (let i = images.length - 1; i >= 0; i--) {
    if (hitTestCanvasObj(images[i], pos)) {
      return { type: 'image', id: images[i].id, handle: 'center' };
    }
  }
  return null;
}

function updateHermiteTangents(s) {
  const pts = s.points;
  const n = pts.length;
  if (n < 2) return;
  
  if (typeof currentSplineAlgo !== 'undefined') {
    if (currentSplineAlgo === 'natural') solveNaturalCubicSpline(pts, s.closed);
    else if (currentSplineAlgo === 'catmull') solveCatmullRomSpline(pts, s.closed, 0.5);
    else if (currentSplineAlgo === 'bspline') solveGlobalBSpline(pts, s.closed);
    else solveNaturalCubicSpline(pts, s.closed);
  } else {
    solveNaturalCubicSpline(pts, s.closed);
  }
}

function getConnectedComponent(startId) {
  const visited = new Set();
  const queue = [startId];
  while (queue.length > 0) {
    const curr = queue.shift();
    if (visited.has(curr)) continue;
    visited.add(curr);
    const s = shapes.find(x => x.id === curr);
    if (s) {
      if (s.points[0] && s.points[0].connectedTo) queue.push(s.points[0].connectedTo.shapeId);
      if (s.points.length > 1 && s.points[s.points.length - 1].connectedTo) queue.push(s.points[s.points.length - 1].connectedTo.shapeId);
    }
  }
  return Array.from(visited).sort((a,b)=>a-b);
}

function isCCClosed(startId) {
  const cc = getConnectedComponent(startId);
  for (let id of cc) {
    const s = shapes.find(x => x.id === id);
    if (!s) return false;
    if (s.closed) return true;
    const p0 = s.points[0];
    const p1 = s.points[s.points.length - 1];
    if (!p0.connectedTo || !p1.connectedTo) return false;
  }
  return true;
}

function getCCLoopPolyline(startId) {
  const cc = getConnectedComponent(startId);
  if (!isCCClosed(startId)) return null;
  if (cc.length === 1 && shapes.find(x=>x.id===cc[0]).closed) {
    return getPolyline(shapes.find(x=>x.id===cc[0]));
  }
  
  const s0 = shapes.find(x => x.id === startId);
  const pts = [];
  let currShape = s0;
  let currEntryPtIdx = 0;
  const visited = new Set();
  
  // Start from s0
  while (!visited.has(currShape.id)) {
    visited.add(currShape.id);
    const { pts: sPts } = getPolyline(currShape);
    if (currEntryPtIdx === currShape.points.length - 1) {
      pts.push(...sPts.slice().reverse().slice(0, -1));
      const nextConn = currShape.points[0].connectedTo;
      if (!nextConn) break;
      currShape = shapes.find(x => x.id === nextConn.shapeId);
      currEntryPtIdx = nextConn.ptIdx;
    } else {
      pts.push(...sPts.slice(0, -1));
      const nextConn = currShape.points[currShape.points.length - 1].connectedTo;
      if (!nextConn) break;
      currShape = shapes.find(x => x.id === nextConn.shapeId);
      currEntryPtIdx = nextConn.ptIdx;
    }
  }
  return { pts, closed: true };
}

function disconnectPoint(s, ptIdx) {
  const conn = s.points[ptIdx].connectedTo;
  if (conn) {
    const s2 = shapes.find(x => x.id === conn.shapeId);
    if (s2 && s2.points[conn.ptIdx]) {
      s2.points[conn.ptIdx].connectedTo = null;
    }
    s.points[ptIdx].connectedTo = null;
  }
}

function tryConnectPoints(shapeId, ptIdx, skipConnect = false) {
  const s = shapes.find(x => x.id === shapeId);
  if (!s || s.closed) return false;
  
  const isStart = (ptIdx === 0);
  const isEnd = (ptIdx === s.points.length - 1);
  if (!isStart && !isEnd) return false;
  
  if (skipConnect) return false;
  
  if (s.points[ptIdx].connectedTo) {
    disconnectPoint(s, ptIdx);
  }
  
  const p = s.points[ptIdx];
  const g = s.groupId ? groups.find(x => x.id === s.groupId) : null;
  const pWorld = g ? rotAround(p, circle.cx, circle.cy, g.rotation) : p;
  
  let bestCandidate = null;
  let bestDist = SNAP_D;

  // 1. Check self-intersection (priority on ties)
  for (let i = 0; i < s.points.length; i++) {
    if (i === ptIdx) continue;
    const isOtherEnd = (i === 0 || i === s.points.length - 1);
    if (!isOtherEnd) continue;
    
    const p2 = s.points[i];
    const p2World = g ? rotAround(p2, circle.cx, circle.cy, g.rotation) : p2;
    const d = Math.hypot(pWorld.x - p2World.x, pWorld.y - p2World.y);
    if (d < bestDist) {
      bestDist = d;
      bestCandidate = { type: 'self', ptIdx: i, p2: p2, p2World: p2World };
    }
  }

  // 2. Check other shapes
  for (let i = 0; i < shapes.length; i++) {
    const s2 = shapes[i];
    if (s2.id === s.id || s2.closed || s2._isCopy) continue;
    if (s.groupId !== s2.groupId && s.groupId !== GROUP1_ID && s2.groupId !== GROUP1_ID) continue;
    
    const g2 = s2.groupId ? groups.find(x => x.id === s2.groupId) : null;
    const ends = [0, s2.points.length - 1];
    for (let j of ends) {
      if (s2.points[j].connectedTo) continue; // Only connect 1:1 to unconnected
      const p2 = s2.points[j];
      const p2World = g2 ? rotAround(p2, circle.cx, circle.cy, g2.rotation) : p2;
      const d = Math.hypot(pWorld.x - p2World.x, pWorld.y - p2World.y);
      if (d < bestDist) {
        bestDist = d;
        bestCandidate = { type: 'other', shape: s2, ptIdx: j, p2: p2, p2World: p2World, g2: g2 };
      }
    }
  }

  if (bestCandidate) {
    if (bestCandidate.type === 'self') {
      disconnectPoint(s, bestCandidate.ptIdx);
      s.points[ptIdx].connectedTo = { shapeId: s.id, ptIdx: bestCandidate.ptIdx };
      s.points[bestCandidate.ptIdx].connectedTo = { shapeId: s.id, ptIdx: ptIdx };
      s.points[ptIdx].x = bestCandidate.p2.x; 
      s.points[ptIdx].y = bestCandidate.p2.y;
      return true;
    } else {
      const s2 = bestCandidate.shape;
      const j = bestCandidate.ptIdx;
      s.points[ptIdx].connectedTo = { shapeId: s2.id, ptIdx: j };
      s2.points[j].connectedTo = { shapeId: s.id, ptIdx: ptIdx };
      const pWorldSnapped = bestCandidate.p2World;
      const pLocal = g ? rotAround(pWorldSnapped, circle.cx, circle.cy, -g.rotation) : pWorldSnapped;
      s.points[ptIdx].x = pLocal.x; 
      s.points[ptIdx].y = pLocal.y;
      return true;
    }
  }
  return false;
}

function getGroupShapeCount(groupId) {
    const validShapes = shapes.filter(s => s.groupId === groupId && !(s.groupId === GROUP1_ID && !s._isCopy && typeof hasCopy === 'function' && hasCopy(s.id)) && s.points && s.points.length >= 2);
    const countedCCs = new Set();
    let count = 0;
    validShapes.forEach(s => {
       const targetId = s._isCopy ? s._origId : s.id;
       const cc = getConnectedComponent(targetId);
       const ccKey = cc.join(',');
       if (!countedCCs.has(ccKey)) {
          countedCCs.add(ccKey);
          count++;
       }
    });
    return count;
}