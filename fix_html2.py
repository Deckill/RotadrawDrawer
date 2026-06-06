# -*- coding: utf-8 -*-
with open('rotadraw.html', 'rb') as f:
    raw = f.read()

lines = raw.split(b'\n')
for i, line in enumerate(lines):
    if b'mode-canvas' in line and b'</button>' not in line:
        lines[i] = '  <button class="tb-btn active" id="mode-canvas" onclick="setMode(\'canvas\')">캔버스</button>\r'.encode('utf-8')
        print(f"Fixed line {i+1}")
    elif b'margin-top:10px' in line and b'div' in line and b'</div' not in line:
        lines[i] = '      <div class="panel-title" style="margin-top:10px">원</div>\r'.encode('utf-8')
        print(f"Fixed line {i+1}")

with open('rotadraw.html', 'wb') as f:
    f.write(b'\n'.join(lines))
