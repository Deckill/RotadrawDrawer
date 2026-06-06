import os

with open('js/geometry.js', 'r', encoding='utf-8') as f:
    geo_js = f.read()

replacement = '''function updateHermiteTangents(s) {
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
}'''

# Replace the existing function
import re
geo_js = re.sub(r'function updateHermiteTangents\(s\) \{.*?\n\}', replacement, geo_js, flags=re.DOTALL)

with open('js/geometry.js', 'w', encoding='utf-8') as f:
    f.write(geo_js)
print('Updated geometry.js')
