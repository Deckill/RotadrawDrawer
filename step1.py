import re

# 1. Update index.html
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Remove spline-algo-options div
html = re.sub(r'<div id="spline-algo-options".*?</div>', '', html, flags=re.DOTALL)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

# 2. Update ui.js
with open('js/ui.js', 'r', encoding='utf-8') as f:
    ui_js = f.read()

# Remove setSplineAlgo
ui_js = re.sub(r'function setSplineAlgo\(algo\)\s*\{.*?\n\}', '', ui_js, flags=re.DOTALL)

# Fix setMode: remove the block checking document.getElementById('spline-algo-options')
ui_js = re.sub(r'if\s*\(\s*document\.getElementById\(\'spline-algo-options\'\)\s*\)\s*\{.*?\n\s*\}', '', ui_js, flags=re.DOTALL)

# Fix setDrawTool: remove the block checking spline-algo-options
ui_js = re.sub(r'if\s*\(\s*document\.getElementById\(\'spline-algo-options\'\)\s*\)\s*\{.*?\n\s*\}', '', ui_js, flags=re.DOTALL)

with open('js/ui.js', 'w', encoding='utf-8') as f:
    f.write(ui_js)

print("Step 1 done")
