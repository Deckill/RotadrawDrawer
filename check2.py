with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, l in enumerate(lines):
    if 'tool-spline' in l or 'algo-' in l or 'spline-algo-options' in l:
        print(f'{i}: {l.strip()}')
