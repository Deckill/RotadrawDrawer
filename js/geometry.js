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

function hitGroupMarker(pos,g){
  const rot=g.rotation*Math.PI/180;
  const mx=circle.cx+Math.sin(rot)*circle.r;
  const my=circle.cy-Math.cos(rot)*circle.r;
  return Math.hypot(pos.x-mx,pos.y-my)<10;
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

function updateHermiteTangents(s) {
  const pts = s.points;
  const n = pts.length;
  if (n < 2) return;
  solveNaturalCubicSpline(pts, s.closed);
}