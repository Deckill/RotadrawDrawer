import re

with open('rotadraw.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. State changes
text = text.replace('let bgImage = null;', '''let images = [];
let nextImgId = 1;
let paperGuide = {cx:100,cy:100,w:210,h:297,rotation:0,size:'A4'};
let canvDragState = null;
let canvSelType = null; // 'image' or 'paper'
let canvSelId = null; // image id
''')

# 2. UI changes in panel-canvas
ui_old = '''        <div class="panel-title">캔버스 크기</div>
        <div class="input-row"><label>너비(mm)</label><input type="number" id="cv-w" value="200" min="10" max="2000" oninput="onCanvasWH('w',this.value)"></div>
        <div class="input-row"><label>높이(mm)</label><input type="number" id="cv-h" value="200" min="10" max="2000" oninput="onCanvasWH('h',this.value)"></div>
        <div class="input-row"><label>비율</label>
          <input type="range" id="cv-aspect" min="-1.5" max="1.5" step="0.01" value="0" oninput="onAspectSlider(this.value)">
          <span class="val-display" id="cv-aspect-lbl">1:1</span>
        </div>
        <div class="input-row"><label>전체크기</label>
          <input type="range" id="cv-scale" min="0.1" max="3" step="0.01" value="1" oninput="onScaleSlider(this.value)">
          <span class="val-display" id="cv-scale-lbl">100%</span>
        </div>
        <button class="tb-btn" style="width:100%;margin-top:5px" onclick="fitToBackground()">배경 이미지에 맞춤</button>'''

ui_new = '''        <div class="panel-title">용지 및 캔버스</div>
        <div class="input-row">
          <label>용지 크기</label>
          <select id="pg-size" onchange="onPaperSizeChange(this.value)" style="width:100px;background:#3a3a3c;color:#fff;border:1px solid #555;border-radius:4px;">
            <option value="A4">A4 (210x297)</option>
            <option value="A3">A3 (297x420)</option>
            <option value="Letter">Letter</option>
            <option value="Custom">Custom</option>
          </select>
        </div>
        <div class="input-row"><label>너비(mm)</label><input type="number" id="cv-w" value="210" min="10" max="2000" oninput="onCustomPaperWH('w',this.value)"></div>
        <div class="input-row"><label>높이(mm)</label><input type="number" id="cv-h" value="297" min="10" max="2000" oninput="onCustomPaperWH('h',this.value)"></div>
        <button class="tb-btn" style="width:100%;margin-top:5px" onclick="viewPan={x:0,y:0};viewScale=1;render()">원점 복귀 (Home)</button>'''

text = text.replace(ui_old, ui_new)

with open('rotadraw.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Patched state and UI.")
