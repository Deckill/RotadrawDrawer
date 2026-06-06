import json

def generate_solve_natural_cubic_spline():
    return """function solveNaturalCubicSpline(pts, closed) {
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
"""

if __name__ == "__main__":
    with open("js/math.js", "r", encoding="utf-8") as f:
        content = f.read()
    
    import re
    # Replace solveNaturalCubicSpline
    pattern = re.compile(r'function solveNaturalCubicSpline\(pts,\s*closed\)\s*\{.*?\n\}\n(?=function|\n?$)', re.DOTALL)
    new_content = pattern.sub(generate_solve_natural_cubic_spline() + '\n', content)
    
    with open("js/math.js", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Replaced solveNaturalCubicSpline in js/math.js")
