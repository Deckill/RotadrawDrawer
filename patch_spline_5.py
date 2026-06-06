import re

with open('rotadraw.html', 'r', encoding='utf-8') as f:
    html = f.read()

mDrawMove_replacement = '''function mDrawMove(pos,e){
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
      if (p.mode === 'sym') p.inT = {x: -p.outT.x, y: -p.outT.y};
      
      const closed = isShapeClosed(s);
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
      if (p.mode === 'sym') p.outT = {x: -p.inT.x, y: -p.inT.y};
      
      const closed = isShapeClosed(s);
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

# Use regex to replace mDrawMove
html = re.sub(r"function mDrawMove\(pos,e\)\{.*?if\(dragState\?\.type==='pt'&&_hasDragged\)\{\s*const s=shapes\.find\(x=>x\.id===dragState\.shapeId\);", mDrawMove_replacement, html, flags=re.DOTALL)

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

html = re.sub(r"if\(s&&s\.type==='spline'&&selPtIdx!==null\)\{.*?// 2\. Hit test control point", mDrawDown_handleHit_replacement + '\n      // 2. Hit test control point', html, flags=re.DOTALL)

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
html = re.sub(r"if\(s && s\.type === 'spline'\) \{.*?showContextMenu\(e, \[.*?\]\);\s*return;\s*\}", cmenu_replace, html, flags=re.DOTALL)

with open('rotadraw.html', 'w', encoding='utf-8') as f:
    f.write(html)
