import os

with open('js/globals.js', 'r', encoding='utf-8') as f:
    globals_js = f.read()

if 'currentSplineAlgo' not in globals_js:
    globals_js += '\nlet currentSplineAlgo = "natural"; // natural, catmull, bspline\n'

with open('js/globals.js', 'w', encoding='utf-8') as f:
    f.write(globals_js)
print('Updated globals.js')
