# -*- coding: utf-8 -*-
with open('rotadraw.html', 'rb') as f:
    raw = f.read()

lines = raw.split(b'\n')
for i, line in enumerate(lines):
    if b'sb-mode' in line and b'/span>' in line and b'</span' not in line:
        lines[i] = '  <span id="sb-mode">모드: 캔버스</span>\r'.encode('utf-8')
        print(f"Fixed line {i+1}")

with open('rotadraw.html', 'wb') as f:
    f.write(b'\n'.join(lines))
