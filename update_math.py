import os

with open('js/math.js', 'r', encoding='utf-8') as f:
    math_js = f.read()

new_solvers = '''
function solveCatmullRomSpline(pts, closed, alpha=0.5) {
  const n = pts.length;
  if (n < 2) return;
  
  const getP = (i) => {
    if (closed) return pts[(i % n + n) % n];
    if (i < 0) return { x: 2*pts[0].x - pts[1].x, y: 2*pts[0].y - pts[1].y };
    if (i >= n) return { x: 2*pts[n-1].x - pts[n-2].x, y: 2*pts[n-1].y - pts[n-2].y };
    return pts[i];
  };
  
  const getD = (pA, pB) => Math.pow(Math.hypot(pB.x - pA.x, pB.y - pA.y), alpha) || 1e-5;
  
  for (let i = 0; i < n; i++) {
    if (pts[i].manual) continue;
    const p0 = getP(i - 1);
    const p1 = getP(i);
    const p2 = getP(i + 1);
    
    const d1 = getD(p0, p1);
    const d2 = getD(p1, p2);
    
    const T1x = (d1 * (p2.x - p1.x)/d2 + d2 * (p1.x - p0.x)/d1) / (d1 + d2);
    const T1y = (d1 * (p2.y - p1.y)/d2 + d2 * (p1.y - p0.y)/d1) / (d1 + d2);
    
    pts[i].outT = { x: T1x * d2, y: T1y * d2 };
    pts[i].inT = { x: -T1x * d1, y: -T1y * d1 };
  }
}

function solveGlobalBSpline(pts, closed) {
  const n = pts.length;
  if (n < 2) return;
  
  if (!closed) {
    const C_x = new Float64Array(n);
    const C_y = new Float64Array(n);
    C_x[0] = pts[0].x; C_y[0] = pts[0].y;
    C_x[n-1] = pts[n-1].x; C_y[n-1] = pts[n-1].y;
    
    if (n > 2) {
      const A = new Float64Array(n-2);
      const B = new Float64Array(n-2);
      const C = new Float64Array(n-2);
      const Dx = new Float64Array(n-2);
      const Dy = new Float64Array(n-2);
      
      for(let i=0; i<n-2; i++) {
        A[i] = 4; B[i] = 1; C[i] = 1;
        Dx[i] = 6 * pts[i+1].x;
        Dy[i] = 6 * pts[i+1].y;
      }
      Dx[0] -= pts[0].x;
      Dy[0] -= pts[0].y;
      Dx[n-3] -= pts[n-1].x;
      Dy[n-3] -= pts[n-1].y;
      
      const Ix = solveTridiagonal(A, B, C, Dx);
      const Iy = solveTridiagonal(A, B, C, Dy);
      
      for(let i=0; i<n-2; i++) {
        C_x[i+1] = Ix[i];
        C_y[i+1] = Iy[i];
      }
    }
    
    const getC = (i) => {
      if (i === -1) return { x: 2*C_x[0] - C_x[1], y: 2*C_y[0] - C_y[1] };
      if (i === n) return { x: 2*C_x[n-1] - C_x[n-2], y: 2*C_y[n-1] - C_y[n-2] };
      return { x: C_x[i], y: C_y[i] };
    };
    
    for(let i=0; i<n; i++) {
      if (!pts[i].manual) {
        const prev = getC(i-1), next = getC(i+1);
        pts[i].outT = { x: (next.x - prev.x)/2, y: (next.y - prev.y)/2 };
        pts[i].inT = { x: -(next.x - prev.x)/2, y: -(next.y - prev.y)/2 };
      }
    }
  } else {
    const C_x = new Float64Array(n);
    const C_y = new Float64Array(n);
    for(let i=0; i<n; i++) { C_x[i] = pts[i].x; C_y[i] = pts[i].y; }
    
    for(let iter=0; iter<15; iter++) {
      for(let i=0; i<n; i++) {
        const prevX = C_x[(i-1+n)%n], nextX = C_x[(i+1)%n];
        C_x[i] = (6*pts[i].x - prevX - nextX)/4;
        const prevY = C_y[(i-1+n)%n], nextY = C_y[(i+1)%n];
        C_y[i] = (6*pts[i].y - prevY - nextY)/4;
      }
    }
    
    for(let i=0; i<n; i++) {
      if (!pts[i].manual) {
        const prevX = C_x[(i-1+n)%n], nextX = C_x[(i+1)%n];
        const prevY = C_y[(i-1+n)%n], nextY = C_y[(i+1)%n];
        pts[i].outT = { x: (nextX - prevX)/2, y: (nextY - prevY)/2 };
        pts[i].inT = { x: -(nextX - prevX)/2, y: -(nextY - prevY)/2 };
      }
    }
  }
}
'''
if 'solveCatmullRomSpline' not in math_js:
    math_js += '\n' + new_solvers

with open('js/math.js', 'w', encoding='utf-8') as f:
    f.write(math_js)
print('Updated math.js')
