import re

with open('js/main.js', 'r', encoding='utf-8') as f:
    js = f.read()

# 1. Fix Context Menu
# Find the context menu array and replace it
context_menu_replacement = """            showContextMenu(e, [
              {
                label: 'Smooth 모드',
                action: () => {
                  p.mode = 'smooth';
                  const lenIn = Math.hypot(p.inT.x, p.inT.y);
                  const lenOut = Math.hypot(p.outT.x, p.outT.y) || 1e-5;
                  if (lenIn > 0) p.inT = {x: -p.outT.x * lenIn / lenOut, y: -p.outT.y * lenIn / lenOut};
                  render();
                }
              },
              {
                label: 'Symmetric 모드',
                action: () => {
                  p.mode = 'sym';
                  p.inT = {x: -p.outT.x, y: -p.outT.y};
                  render();
                }
              },
              {
                label: 'Cusp 모드',
                action: () => {
                  p.mode = 'cusp';
                  render();
                }
              },
              {
                label: '점 삭제',
                action: () => {
                  s.points.splice(hp.ptIdx, 1);
                  if(s.points.length<2) {
                    shapes=shapes.filter(x=>x.id!==s.id);
                  }
                  selPtIdx=null; render();
                }
              }
            ]);"""

js = re.sub(r'showContextMenu\(e, \[\s*\{\s*label: \'Smooth.*?\}\s*\]\);', context_menu_replacement, js, flags=re.DOTALL)

# 2. Fix Spline Point Insertion Logic
split_logic = """               const split = splitBezier(p0, cp0, cp1, p1, bestT);
                const pt = split.left[3];
                const newPt = {
                  x: pt.x,
                  y: pt.y,
                  inT: { x: 3*(split.left[2].x - pt.x), y: 3*(split.left[2].y - pt.y) },
                  outT: { x: 3*(split.right[1].x - pt.x), y: 3*(split.right[1].y - pt.y) },
                  mode: 'smooth',
                  manual: true
                };
                
                p0.outT = { x: 3*(split.left[1].x - p0.x), y: 3*(split.left[1].y - p0.y) };
                p1.inT = { x: 3*(split.right[2].x - p1.x), y: 3*(split.right[2].y - p1.y) };
                
                if (p0.mode === 'sym') p0.mode = 'smooth';
                if (p1.mode === 'sym') p1.mode = 'smooth';
                
                hs.points.splice(i+1, 0, newPt);
                render();"""

js = re.sub(r'const split = splitBezier\(p0, cp0, cp1, p1, bestT\);.*?render\(\);', split_logic, js, flags=re.DOTALL)

with open('js/main.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("Updated main.js")
