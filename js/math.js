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

  const h = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const nextIdx = (i + 1) % n;
    h[i] = Math.max(Math.hypot(pts[nextIdx].x - pts[i].x, pts[nextIdx].y - pts[i].y), 1e-5);
  }

  // We will solve for V_i, the velocity at each point.
  // outT_i = V_i * h_i / 3
  // inT_i = -V_i * h_{i-1} / 3

  if (!closed) {
    // Find blocks of non-manual points
    let start = 0;
    while (start < n) {
      if (pts[start].manual) {
        start++;
        continue;
      }
      let end = start;
      while (end + 1 < n && !pts[end + 1].manual) {
        end++;
      }
      
      // We need to solve for V_{start} ... V_{end}
      const cnt = end - start + 1;
      const A = new Float64Array(cnt);
      const B = new Float64Array(cnt);
      const C = new Float64Array(cnt);
      const Dx = new Float64Array(cnt);
      const Dy = new Float64Array(cnt);

      for (let j = 0; j < cnt; j++) {
        const i = start + j;
        if (i === 0) {
          A[j] = 2; B[j] = 0; C[j] = 1;
          Dx[j] = 3 * (pts[1].x - pts[0].x) / h[0];
          Dy[j] = 3 * (pts[1].y - pts[0].y) / h[0];
        } else if (i === n - 1) {
          B[j] = 1; A[j] = 2; C[j] = 0;
          Dx[j] = 3 * (pts[n-1].x - pts[n-2].x) / h[n-2];
          Dy[j] = 3 * (pts[n-1].y - pts[n-2].y) / h[n-2];
        } else {
          B[j] = h[i]; A[j] = 2 * (h[i-1] + h[i]); C[j] = h[i-1];
          const px = 3 * (h[i] * (pts[i].x - pts[i-1].x) / h[i-1] + h[i-1] * (pts[i+1].x - pts[i].x) / h[i]);
          const py = 3 * (h[i] * (pts[i].y - pts[i-1].y) / h[i-1] + h[i-1] * (pts[i+1].y - pts[i].y) / h[i]);
          Dx[j] = px; Dy[j] = py;
        }

        // Apply boundary conditions if neighbors are manual
        if (i > 0 && i === start && pts[i-1].manual) {
          const V_prev_x = 3 * pts[i-1].outT.x / h[i-1];
          const V_prev_y = 3 * pts[i-1].outT.y / h[i-1];
          Dx[j] -= B[j] * V_prev_x;
          Dy[j] -= B[j] * V_prev_y;
          B[j] = 0; // conceptually
        }
        if (i < n - 1 && i === end && pts[i+1].manual) {
          const V_next_x = -3 * pts[i+1].inT.x / h[i];
          const V_next_y = -3 * pts[i+1].inT.y / h[i];
          Dx[j] -= C[j] * V_next_x;
          Dy[j] -= C[j] * V_next_y;
          C[j] = 0; // conceptually
        }
      }

      const Vx = solveTridiagonal(A, B, C, Dx);
      const Vy = solveTridiagonal(A, B, C, Dy);

      for (let j = 0; j < cnt; j++) {
        const i = start + j;
        const vx = Vx[j], vy = Vy[j];
        if (i < n - 1) pts[i].outT = { x: vx * h[i] / 3, y: vy * h[i] / 3 };
        else pts[i].outT = { x: 0, y: 0 };
        
        if (i > 0) pts[i].inT = { x: -vx * h[i-1] / 3, y: -vy * h[i-1] / 3 };
        else pts[i].inT = { x: 0, y: 0 };
      }

      start = end + 1;
    }
  } else {
    // Closed spline handling (using iterative Gauss-Seidel for simplicity)
    const Vx = new Float64Array(n);
    const Vy = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      if (pts[i].manual) {
        Vx[i] = 3 * pts[i].outT.x / h[i];
        Vy[i] = 3 * pts[i].outT.y / h[i];
      } else {
        const prev = pts[(i - 1 + n) % n];
        const next = pts[(i + 1) % n];
        Vx[i] = (next.x - prev.x) / (h[(i-1+n)%n]/2 + h[i]/2);
        Vy[i] = (next.y - prev.y) / (h[(i-1+n)%n]/2 + h[i]/2);
      }
    }

    for (let iter = 0; iter < 20; iter++) {
      for (let i = 0; i < n; i++) {
        if (pts[i].manual) continue;
        const iPrev = (i - 1 + n) % n;
        const iNext = (i + 1) % n;
        const hp = h[iPrev], hn = h[i];
        const px = 3 * (hn * (pts[i].x - pts[iPrev].x) / hp + hp * (pts[iNext].x - pts[i].x) / hn);
        const py = 3 * (hn * (pts[i].y - pts[iPrev].y) / hp + hp * (pts[iNext].y - pts[i].y) / hn);
        
        Vx[i] = (px - hn * Vx[iPrev] - hp * Vx[iNext]) / (2 * (hp + hn));
        Vy[i] = (py - hn * Vy[iPrev] - hp * Vy[iNext]) / (2 * (hp + hn));
      }
    }

    for (let i = 0; i < n; i++) {
      if (!pts[i].manual) {
        pts[i].outT = { x: Vx[i] * h[i] / 3, y: Vy[i] * h[i] / 3 };
        pts[i].inT = { x: -Vx[i] * h[(i-1+n)%n] / 3, y: -Vy[i] * h[(i-1+n)%n] / 3 };
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
    
    pts[i].outT = { x: T1x * d2 / 3, y: T1y * d2 / 3 };
    pts[i].inT = { x: -T1x * d1 / 3, y: -T1y * d1 / 3 };
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
        pts[i].outT = { x: (next.x - prev.x)/6, y: (next.y - prev.y)/6 };
        pts[i].inT = { x: -(next.x - prev.x)/6, y: -(next.y - prev.y)/6 };
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
        pts[i].outT = { x: (nextX - prevX)/6, y: (nextY - prevY)/6 };
        pts[i].inT = { x: -(nextX - prevX)/6, y: -(nextY - prevY)/6 };
      }
    }
  }
}
