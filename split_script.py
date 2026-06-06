import os, re

with open('js/full_source.js', 'r', encoding='utf-8') as f:
    js = f.read()

def extract_functions(names):
    funcs_code = []
    global js
    for name in names:
        pattern = r'(?:async\s+)?function\s+' + name + r'\s*\([^)]*\)\s*\{'
        match = re.search(pattern, js)
        if match:
            start_idx = match.start()
            brace_count = 0
            in_string = False
            str_char = ''
            end_idx = -1
            for i in range(start_idx, len(js)):
                c = js[i]
                if in_string:
                    if c == str_char and js[i-1] != '\\':
                        in_string = False
                else:
                    if c in '"\'`':
                        in_string = True
                        str_char = c
                    elif c == '{':
                        brace_count += 1
                    elif c == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            end_idx = i + 1
                            break
            if end_idx != -1:
                funcs_code.append(js[start_idx:end_idx])
                js = js[:start_idx] + js[end_idx:]
        else:
            print('Function not found:', name)
    return '\n\n'.join(funcs_code)

math_funcs = ['rotAround', 'solveTridiagonal', 'solveNaturalCubicSpline', 'getCurvature', 'lineIntersectT']
geom_funcs = ['getPolyline', 'buildOffsetPath', 'getShapePath', 'segDist', 'shapeCenter', 'isShapeClosed', 
              'getHandlePositions', 'offsetSeg', 'miterJoin', 'hitPoint', 'hitSegment', 'hitHandle', 
              'hitGroupMarker', 'distToShape', 'snapToPoint', 'ensureCps', 'getOrInitSeg', 'splitBezier', 
              'getTransformHandles', 'hitTestCanvasObj', 'getCanvasModeTarget', 'updateHermiteTangents']
render_funcs = ['render', 'renderShape', 'renderCircle', 'renderCanvasMode', 'renderGroupMarkers', 'renderLabels', 'renderBezierHandles']
tools_funcs = ['mCanvasDown', 'mCanvasMove', 'mCanvasUp', 'mDrawDown', 'mDrawMove', 'mDrawUp', 'mArrDown', 'mArrMove', 'mArrUp', 'mLblDown', 'mLblMove', 'mLblUp', 'finishDrawing']
export_funcs = ['saveProject', 'loadProject', 'onProjectLoaded', 'showExportModal', 'renderOffscreen', 'exportPNG', 'getGlobalBounds', 'exportSVG', 'svgPathD', 'svgOffsetPathD', 'exportDXF', 'exportPDF']
ui_funcs = ['showContextMenu', 'deleteSelectedShape', 'clearAllShapes', 'updatePropsPanel', 'updateCursor', 'setMode', 'setDrawTool', 'onPaperSizeChange', 'onCustomPaperWH', 'importImage', 'onImageObjectLoaded', 'circleFromInput', 'initDefaultGroup', 'addGroup', 'deleteGroup', 'hasCopy', 'makeCopy', 'removeCopy', 'refreshGroupList', 'setGroupLabel', 'onSwRange', 'onSwNum', 'onImageFileSelected']
main_funcs = ['init', 'setCanvasSize', 'goHome']

math_code = extract_functions(math_funcs)
geom_code = extract_functions(geom_funcs)
render_code = extract_functions(render_funcs)
tools_code = extract_functions(tools_funcs)
export_code = extract_functions(export_funcs)
ui_code = extract_functions(ui_funcs)
main_code = extract_functions(main_funcs)

events_code = []
for pattern in [r'window\.addEventListener\(.*?\n\}\);', r'mainCanvas\.addEventListener\(.*?\n\}\);', r'document\.getElementById\(.*?\)\.addEventListener\(.*?\n\}\);']:
    matches = re.finditer(pattern, js, re.DOTALL)
    for m in matches:
        events_code.append(m.group(0))
    js = re.sub(pattern, '', js, flags=re.DOTALL)

globals_code = js.strip()

with open('js/math.js', 'w', encoding='utf-8') as f: f.write(math_code)
with open('js/geometry.js', 'w', encoding='utf-8') as f: f.write(geom_code)
with open('js/render.js', 'w', encoding='utf-8') as f: f.write(render_code)
with open('js/tools.js', 'w', encoding='utf-8') as f: f.write(tools_code)
with open('js/export.js', 'w', encoding='utf-8') as f: f.write(export_code)
with open('js/ui.js', 'w', encoding='utf-8') as f: f.write(ui_code)
with open('js/globals.js', 'w', encoding='utf-8') as f: f.write(globals_code)

with open('js/main.js', 'w', encoding='utf-8') as f: 
    f.write(main_code + '\n\n' + '\n\n'.join(events_code))

print('Split complete!')
