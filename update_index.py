import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

buttons_html = '''<div id="spline-algo-options" style="display:none; margin-top: 10px; background: #2a2a3e; padding: 10px; border-radius: 6px;">
      <div style="font-size: 11px; margin-bottom: 5px; color: #aaa;">스플라인 알고리즘:</div>
      <button class="tool-btn algo-btn active" id="algo-natural" onclick="setSplineAlgo('natural')">Natural Cubic</button>
      <button class="tool-btn algo-btn" id="algo-catmull" onclick="setSplineAlgo('catmull')">Catmull-Rom</button>
      <button class="tool-btn algo-btn" id="algo-bspline" onclick="setSplineAlgo('bspline')">B-Spline</button>
    </div>'''

html = re.sub(r'(<button class="tool-btn" id="tool-spline".*?</button>)', r'\1\n      ' + buttons_html, html, flags=re.DOTALL)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('Updated index.html')
