import re

with open('rotadraw.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace <style> block
html = re.sub(r'<style>.*?</style>', '<link rel="stylesheet" href="css/style.css">', html, flags=re.DOTALL)

# Replace <script> block
scripts = '''<script src="js/globals.js"></script>
<script src="js/math.js"></script>
<script src="js/geometry.js"></script>
<script src="js/render.js"></script>
<script src="js/tools.js"></script>
<script src="js/ui.js"></script>
<script src="js/export.js"></script>
<script src="js/main.js"></script>'''
html = re.sub(r'<script>.*?</script>', scripts, html, flags=re.DOTALL)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Created index.html')
