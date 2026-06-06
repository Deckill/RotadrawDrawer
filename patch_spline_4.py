import re

with open('rotadraw.html', 'r', encoding='utf-8') as f:
    html = f.read()

mDrawMove_replacement = '''
function mDrawMove(pos,e){
  const snapOff=e.ctrlKey;

  if(drawTool==='select'&&!dragState){
    hoverPtRef=hitPoint(pos);
    mainCanvas.style.cursor=(hoverPtRef||hitSegment(pos))?'pointer':'default';
  }

  // Bezier handle drag
  if(dragState?.type==='cpOut'){
    const s=shapes.find(x=>x.id===dragState.shapeId);if(s){
      const p = s.points[dragState.ptIdx];
      p.outT = {x: pos.x - p.x, y: pos.y - p.y};
      if (p.mode === 'sym') p.inT = {x: -(pos.x - p.x), y: -(pos.y - p.y)};
      
      const closed = s.closed;
      const n = s.points.length;
      let nextIdx = (dragState.ptIdx + 1) % n;
      if (!closed && dragState.ptIdx === n - 1) { currentCurvature = null; }
      else {
        const p1 = s.points[nextIdx];
        currentCurvature = getCurvature(p, p.outT, p1, {x: -p1.inT.x, y: -p1.inT.y}, 0);
      }
    }
    render();return;
  }
  if(dragState?.type==='cpIn'){
    const s=shapes.find(x=>x.id===dragState.shapeId);if(s){
      const p = s.points[dragState.ptIdx];
      p.inT = {x: pos.x - p.x, y: pos.y - p.y};
      if (p.mode === 'sym') p.outT = {x: -(pos.x - p.x), y: -(pos.y - p.y)};
      
      const closed = s.closed;
      const n = s.points.length;
      let prevIdx = (dragState.ptIdx - 1 + n) % n;
      if (!closed && dragState.ptIdx === 0) { currentCurvature = null; }
      else {
        const p0 = s.points[prevIdx];
        currentCurvature = getCurvature(p0, p0.outT, p, {x: -p.inT.x, y: -p.inT.y}, 1);
      }
    }
    render();return;
  }

  // Point drag (activated once hasDragged)
  if(dragState?.type==='pt'&&_hasDragged){
    const s=shapes.find(x=>x.id===dragState.shapeId);
'''

mDrawDown_handleHit_replacement = '''
    if(s&&s.type==='spline'&&selPtIdx!==null){
      if(hitHandle(pos,s,selPtIdx,'out')){
        dragState={type:'cpOut',shapeId:s.id,ptIdx:selPtIdx};
        return;
      }
      if(hitHandle(pos,s,selPtIdx,'in')){
        dragState={type:'cpIn',shapeId:s.id,ptIdx:selPtIdx};
        return;
      }
    }
'''

# Find mDrawMove
md_start = html.find('function mDrawMove(pos,e){')
md_end = html.find("if(dragState?.type==='pt'&&_hasDragged){\n      const s=shapes.find(x=>x.id===dragState.shapeId);")
if md_start != -1 and md_end != -1:
    html = html[:md_start] + mDrawMove_replacement + html[md_end + len("if(dragState?.type==='pt'&&_hasDragged){\n      const s=shapes.find(x=>x.id===dragState.shapeId);"):]

# Find mDrawDown hitHandle
hhit_start = html.find('if(s&&s.type===\'spline\'&&selPtIdx!==null){\n        if(hitHandle(pos,s,selPtIdx,\'out\')){')
hhit_end = html.find('// 2. Hit test control point')
if hhit_start != -1 and hhit_end != -1:
    html = html[:hhit_start] + mDrawDown_handleHit_replacement + '\n      ' + html[hhit_end:]

# Also update mDrawUp to clear currentCurvature
mup_replacement = '''function mDrawUp(pos,e){
  currentCurvature = null;
  if(dragState&&dragState.type==='pt'&&!_hasDragged){
'''
html = html.replace("function mDrawUp(pos,e){\n  if(dragState&&dragState.type==='pt'&&!_hasDragged){", mup_replacement)

# Also fix ensureCps and enforceSymmetric since we don't need them, but they might be called elsewhere.
# Actually, I should remove enforceSymmetric entirely or make it a no-op.
html = html.replace("function ensureCps(s){", "function ensureCps(s){return;} function old_ensureCps(s){")
html = html.replace("function enforceSymmetric(s, ptIdx, side){", "function enforceSymmetric(s, ptIdx, side){return;} function old_enforceSymmetric(s, ptIdx, side){")

# Also, update context menu to toggle mode
cmenu_replace = '''
         if(s && s.type === 'spline') {
           const p = s.points[hp.ptIdx];
           const isFree = p.mode === 'free';
           showContextMenu(e, [
             {
               label: isFree ? '대칭 모드로 변환' : '자유 모드로 변환',
               action: () => {
                 p.mode = isFree ? 'sym' : 'free';
                 if(p.mode === 'sym') p.inT = {x: -p.outT.x, y: -p.outT.y};
                 render();
               }
             },
             {
               label: '점 삭제',
               action: () => {
                 s.points.splice(hp.ptIdx, 1);
                 if(s.points.length<2) shapes=shapes.filter(x=>x.id!==s.id);
                 selPtIdx=null; render();
               }
             }
           ]);
           return;
         }
'''
cm_start = html.find('if(s && s.type === \'spline\') {\n           s.pointModes = s.pointModes || {};')
cm_end = html.find('// 3. Hit test shape')
if cm_start != -1 and cm_end != -1:
    # Find the next const hs = hitSegment(p); which comes before // 3. Hit test shape?
    # No, const hs = hitSegment(p); is right above if(hs && hs.type === 'spline'){
    cm_end2 = html.find('const hs = hitSegment(p);', cm_start)
    if cm_end2 != -1:
        html = html[:cm_start] + cmenu_replace + '      }\n      ' + html[cm_end2:]

with open('rotadraw.html', 'w', encoding='utf-8') as f:
    f.write(html)
