function rotAround(pos,cx,cy,deg){
  const r=deg*Math.PI/180,dx=pos.x-cx,dy=pos.y-cy;
  return{x:cx+dx*Math.cos(r)-dy*Math.sin(r),y:cy+dx*Math.sin(r)+dy*Math.cos(r)};
}

function solveTridiagonal(A, B, C, D) {
  const n = D.length;
  const cPrime = new Float64Array(n);
  const dPrime = new Float64Array(n);
  const x = new Float64Array(n);

  cPrime[0] = C[0] / A[0];
  dPrime[0] = D[0] / A[0];

  for (let i = 1; i < n; i++) {
    const m = 1.0 / (A[i] - B[i] * cPrime[i - 1]);
    cPrime[i] = C[i] * m;
    dPrime[i] = (D[i] - B[i] * dPrime[i - 1]) * m;
  }

  x[n - 1] = dPrime[n - 1];
  for (let i = n - 2; i >= 0; i--) {
    x[i] = dPrime[i] - cPrime[i] * x[i + 1];
  }
  return x;
}

function solveNaturalCubicSpline(pts, closed) {
  const n = pts.length;
  if (n < 2) return;
  
  if (!closed) {
    const A = new Float64Array(n);
    const B = new Float64Array(n);
    const C = new Float64Array(n);
    const Dx = new Float64Array(n);
    const Dy = new Float64Array(n);
    
    A[0] = 2; C[0] = 1; 
    Dx[0] = 3 * (pts[1].x - pts[0].x);
    Dy[0] = 3 * (pts[1].y - pts[0].y);
    
    for (let i = 1; i < n - 1; i++) {
      B[i] = 1; A[i] = 4; C[i] = 1;
      Dx[i] = 3 * (pts[i+1].x - pts[i-1].x);
      Dy[i] = 3 * (pts[i+1].y - pts[i-1].y);
    }
    
    B[n-1] = 1; A[n-1] = 2;
    Dx[n-1] = 3 * (pts[n-1].x - pts[n-2].x);
    Dy[n-1] = 3 * (pts[n-1].y - pts[n-2].y);
    
    const Tx = solveTridiagonal(A, B, C, Dx);
    const Ty = solveTridiagonal(A, B, C, Dy);
    
    for (let i = 0; i < n; i++) {
      if (!pts[i].manual) {
        pts[i].outT = { x: Tx[i], y: Ty[i] };
        pts[i].inT = { x: -Tx[i], y: -Ty[i] };
      }
    }
  } else {
    // For closed spline, we use a simple iterative solver or Sherman-Morrison.
    // Iterative Gauss-Seidel is very simple and fast for diagonally dominant systems (1, 4, 1).
    const Tx = new Float64Array(n);
    const Ty = new Float64Array(n);
    for(let i=0; i<n; i++) {
      // Initial guess (Catmull-Rom)
      const prev = pts[(i - 1 + n) % n];
      const next = pts[(i + 1) % n];
      Tx[i] = (next.x - prev.x) / 2;
      Ty[i] = (next.y - prev.y) / 2;
    }
    
    for (let iter = 0; iter < 15; iter++) {
      for (let i = 0; i < n; i++) {
        if (pts[i].manual) continue;
        const prev = pts[(i - 1 + n) % n];
        const next = pts[(i + 1) % n];
        const prevT = Tx[(i - 1 + n) % n];
        const nextT = Tx[(i + 1) % n];
        
        const rhsX = 3 * (next.x - prev.x) - prevT - nextT;
        Tx[i] = rhsX / 4;
        
        const prevTy = Ty[(i - 1 + n) % n];
        const nextTy = Ty[(i + 1) % n];
        const rhsY = 3 * (next.y - prev.y) - prevTy - nextTy;
        Ty[i] = rhsY / 4;
      }
    }
    for (let i = 0; i < n; i++) {
      if (!pts[i].manual) {
        pts[i].outT = { x: Tx[i], y: Ty[i] };
        pts[i].inT = { x: -Tx[i], y: -Ty[i] };
      }
    }
  }
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

function lineIntersectT(p1,d1,p2,d2){
  const denom=d1.x*d2.y-d1.y*d2.x;
  if(Math.abs(denom)<1e-10)return null;
  const t=((p2.x-p1.x)*d2.y-(p2.y-p1.y)*d2.x)/denom;
  return t;
}