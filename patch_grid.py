import re

with open('rotadraw.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Add renderGrid function
if 'function renderGrid' not in html:
    grid_func = '''
function renderGrid(sc) {
  const W = mainCanvas.width, H = mainCanvas.height;
  bgCtx.save();
  bgCtx.strokeStyle = '#223355';
  bgCtx.lineWidth = 1;
  const gridSize = 10 * sc; // 10mm grid
  if (gridSize >= 5) {
    bgCtx.beginPath();
    const ox = (viewOffX % gridSize + gridSize) % gridSize;
    const oy = (viewOffY % gridSize + gridSize) % gridSize;
    for(let x = ox; x < W; x += gridSize) { bgCtx.moveTo(x, 0); bgCtx.lineTo(x, H); }
    for(let y = oy; y < H; y += gridSize) { bgCtx.moveTo(0, y); bgCtx.lineTo(W, y); }
    bgCtx.stroke();
  }
  bgCtx.restore();
}
'''
    html = html.replace('function render(){', grid_func + 'function render(){')

# Call renderGrid inside render()
render_body = '''    bgCtx.fillRect(0,0,W,H);
    ctx.clearRect(0,0,W,H);
    
    renderGrid(sc);
    renderCanvasMode(sc);'''

if 'renderGrid(sc)' not in html:
    html = html.replace('    bgCtx.fillRect(0,0,W,H);\n    ctx.clearRect(0,0,W,H);\n    \n    renderCanvasMode(sc);', render_body)

with open('rotadraw.html', 'w', encoding='utf-8') as f:
    f.write(html)
