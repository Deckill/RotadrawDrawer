import re

with open('js/tools.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Remove updateHermiteTangents from pt drag
js = re.sub(r'if\s*\(\s*s\.type\s*===\s*\'spline\'\s*\)\s*\{\s*updateHermiteTangents\(s\);\s*\}', '', js, flags=re.DOTALL)

with open('js/tools.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("Updated tools.js")
