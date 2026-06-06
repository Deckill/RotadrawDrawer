import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# I will find the block to remove completely:
block = """        <button class="panel-btn active" id="algo-natural" onclick="setSplineAlgo('natural')" style="margin-bottom:4px; font-size:12px;">Natural Cubic</button>
        <button class="panel-btn" id="algo-catmull" onclick="setSplineAlgo('catmull')" style="margin-bottom:4px; font-size:12px;">Catmull-Rom</button>
        <button class="panel-btn" id="algo-bspline" onclick="setSplineAlgo('bspline')" style="font-size:12px;">B-Spline</button>
      </div>"""

html = html.replace(block, "")

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Fixed index.html structure")
