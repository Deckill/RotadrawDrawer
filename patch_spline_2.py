import re

with open('rotadraw.html', 'r', encoding='utf-8') as f:
    html = f.read()

hermite_logic = '''
// ==========================================
//  HERMITE SPLINE SYSTEM
// ==========================================
function updateHermiteTangents(s) {
  const pts = s.points;
  const n = pts.length;
  if (n < 2) return;
  const closed = s.closed;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (p.mode === 'free' && (p.inT.x!==0 || p.inT.y!==0 || p.outT.x!==0 || p.outT.y!==0)) continue; // Don't override user-edited free tangents
    
    let prev = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)];
    let next = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
    
    // Catmull-Rom like tangent
    let vx = (next.x - prev.x) / 2;
    let vy = (next.y - prev.y) / 2;
    
    if (!closed) {
      if (i === 0) { vx = (next.x - p.x); vy = (next.y - p.y); }
      if (i === n - 1) { vx = (p.x - prev.x); vy = (p.y - prev.y); }
    }
    
    if (p.mode === 'sym') {
       p.outT = {x: vx, y: vy};
       p.inT = {x: -vx, y: -vy};
    }
  }
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
    let d = M   ;
    for (let i = 0; i < segs; i++) {
      const p0 = rawPts[i], p1 = rawPts[(i + 1) % rn];
      const c0 = {x: p0.x + (p0.outT.x)/3, y: p0.y + (p0.outT.y)/3};
      const c1 = {x: p1.x + (p1.inT.x)/3, y: p1.y + (p1.inT.y)/3};
      d += C  ,  ,   ;
    }
    if (closed) d += 'Z';
    return d;
  }
  const closed = s.closed === true;
  const rawPts = s.points;
  if (rawPts.length < 2) return null;
  let d = M   ;
  rawPts.slice(1).forEach(p => d += L   );
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
'''

# Find the start of BEZIER SPLINE SYSTEM
start_idx = html.find('// ═══════════════════════════════════════════════\n//  BEZIER SPLINE SYSTEM')
end_idx = html.find('function isShapeClosed(s){')

if start_idx != -1 and end_idx != -1:
    html = html[:start_idx] + hermite_logic + '\n' + html[end_idx:]

with open('rotadraw.html', 'w', encoding='utf-8') as f:
    f.write(html)
