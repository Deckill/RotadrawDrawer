import os, re

with open('js/ui.js', 'r', encoding='utf-8') as f:
    ui_js = f.read()

set_algo_func = '''
function setSplineAlgo(algo) {
  currentSplineAlgo = algo;
  ['natural', 'catmull', 'bspline'].forEach(a => {
    document.getElementById('algo-' + a).classList.toggle('active', a === algo);
  });
  // Update all splines
  shapes.forEach(s => {
    if(s.type === 'spline') updateHermiteTangents(s);
  });
  render();
}
'''
if 'function setSplineAlgo' not in ui_js:
    ui_js += '\n' + set_algo_func

# Modify setDrawTool to show/hide the options
# Look for updateCursor();render();
replacement = '''  if (document.getElementById('spline-algo-options')) {
    document.getElementById('spline-algo-options').style.display = (t === 'spline') ? 'block' : 'none';
  }
  updateCursor();render();'''
ui_js = ui_js.replace('updateCursor();render();', replacement)

with open('js/ui.js', 'w', encoding='utf-8') as f:
    f.write(ui_js)
print('Updated ui.js')
