import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

m = re.search(r'id="spline-algo-options"', html)
if m: print('Found spline-algo-options in index.html')
else: print('NOT FOUND in index.html!')

with open('js/ui.js', 'r', encoding='utf-8') as f:
    js = f.read()

m2 = re.search(r'spline-algo-options', js)
if m2: print('Found spline-algo-options in ui.js')
else: print('NOT FOUND in ui.js!')
