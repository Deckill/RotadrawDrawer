import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

html = html.replace('id="spline-algo-options" style="display:none;', 'id="spline-algo-options" style="display:block;')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print('Updated index.html to display block by default')
