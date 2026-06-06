import re

with open('js/main.js', 'r', encoding='utf-8') as f:
    js = f.read()

replacement = """            const isSym = p.mode === 'sym';
            const isSmooth = p.mode === 'smooth';
            showContextMenu(e, [
              {
                label: 'Smooth 모드로 변환',
                action: () => {
                  p.mode = 'smooth';
                  const lenIn = Math.hypot(p.inT.x, p.inT.y);
                  const lenOut = Math.hypot(p.outT.x, p.outT.y) || 1e-5;
                  if (lenIn > 0) p.inT = {x: -p.outT.x * lenIn / lenOut, y: -p.outT.y * lenIn / lenOut};
                  render();
                }
              },
              {
                label: 'Symmetric 모드로 변환',
                action: () => {
                  p.mode = 'sym';
                  p.inT = {x: -p.outT.x, y: -p.outT.y};
                  render();
                }
              },
              {
                label: 'Free(Corner) 모드로 변환',
                action: () => {
                  p.mode = 'free';
                  render();
                }
              },"""

js = re.sub(
    r"const isFree = p\.mode === 'free';.*?showContextMenu\(e, \[\s*\{\s*label:.*?render\(\);\s*\}\s*\},",
    replacement,
    js,
    flags=re.DOTALL
)

with open('js/main.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("Updated context menu in main.js")
