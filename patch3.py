import re

with open('rotadraw.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Replace exportSVG
old_svg = '''  function exportSVG(){
    document.getElementById('export-modal').style.display='none';
    const hw=canvasW/2, hh=canvasH/2;
    let svg=<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0  " width="mm" height="mm">\n;
    svg+=<rect width="100%" height="100%" fill=""/>\n;
    shapes.forEach(s=>{'''

new_svg = '''  function getGlobalBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const addPt = (x, y) => { minX=Math.min(minX,x); minY=Math.min(minY,y); maxX=Math.max(maxX,x); maxY=Math.max(maxY,y); };
    
    shapes.forEach(s => {
       if(s.groupId===GROUP1_ID&&!s._isCopy&&hasCopy(s.id))return;
       const g = s.groupId ? groups.find(x=>x.id===s.groupId) : null;
       const {pts} = getPolyline(s);
       pts.forEach(p => {
          const w = g ? rotAround(p, circle.cx, circle.cy, g.rotation) : p;
          addPt(w.x, w.y);
       });
    });
    images.forEach(img => {
       const rad = img.rotation * Math.PI / 180;
       const cos = Math.cos(rad), sin = Math.sin(rad);
       const rot = (x, y) => ({ x: img.cx + x*cos - y*sin, y: img.cy + x*sin + y*cos });
       const tl=rot(-img.w/2,-img.h/2), tr=rot(img.w/2,-img.h/2), br=rot(img.w/2,img.h/2), bl=rot(-img.w/2,img.h/2);
       addPt(tl.x, tl.y); addPt(tr.x, tr.y); addPt(br.x, br.y); addPt(bl.x, bl.y);
    });
    
    if (minX === Infinity) return {x:0, y:0, w:100, h:100};
    minX -= 10; minY -= 10; maxX += 10; maxY += 10;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function exportSVG(){
    document.getElementById('export-modal').style.display='none';
    const bounds = getGlobalBounds();
    let svg=<svg xmlns="http://www.w3.org/2000/svg" viewBox="   " width="mm" height="mm">\n;
    svg+=<rect x="" y="" width="" height="" fill=""/>\n;
    
    images.forEach(img => {
      svg += <image x="" y="" width="" height="" href="" transform="rotate(  )" />\n;
    });
    
    shapes.forEach(s=>{'''
text = text.replace(old_svg, new_svg)

# 2. Replace render
old_render = '''function render(){
    const W=mainCanvas.width,H=mainCanvas.height,sc=MM*viewScale;
    bgCtx.clearRect(0,0,W,H);
    bgCtx.fillStyle=document.getElementById('cv-bg').value;
    bgCtx.fillRect(0,0,W,H);
    if(bgImage)bgCtx.drawImage(bgImage,0,0,W,H);
    ctx.clearRect(0,0,W,H);
    shapes.forEach(s=>renderShape(s,sc));
    if(drawing&&drawingShape)renderShape(drawingShape,sc,true);
    renderCircle(sc);
    if(currentMode==='arrange'||currentMode==='label')renderGroupMarkers(sc);
    if(currentMode==='label')renderLabels(sc);
    if(currentMode==='draw'&&drawTool==='select'&&selShapeId!==null&&selPtIdx!==null)renderBezierHandles(sc);
  }'''

new_render = '''function renderCanvasMode(sc) {
  images.forEach(img => {
     ctx.save();
     ctx.translate(img.cx*sc, img.cy*sc);
     ctx.rotate(img.rotation * Math.PI / 180);
     ctx.drawImage(img.img, -img.w/2*sc, -img.h/2*sc, img.w*sc, img.h*sc);
     ctx.restore();
  });
  
  if (paperGuide.visible) {
    ctx.save();
    ctx.translate(paperGuide.cx*sc, paperGuide.cy*sc);
    ctx.rotate(paperGuide.rotation * Math.PI / 180);
    ctx.strokeStyle = canvSelType==='paper'?'#ff00ff':'#00ffff';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(-paperGuide.w/2*sc, -paperGuide.h/2*sc, paperGuide.w*sc, paperGuide.h*sc);
    
    ctx.beginPath();
    ctx.moveTo(-5, 0); ctx.lineTo(5, 0);
    ctx.moveTo(0, -5); ctx.lineTo(0, 5);
    ctx.stroke();
    
    ctx.fillStyle = canvSelType==='paper'?'#ff00ff':'#00ffff';
    ctx.font = '12px sans-serif';
    ctx.fillText(Paper: , -paperGuide.w/2*sc + 2, -paperGuide.h/2*sc + 14);
    ctx.restore();
  }
  
  if (currentMode === 'canvas') {
     const activeObj = canvSelType === 'paper' ? paperGuide : (canvSelType === 'image' ? images.find(x => x.id === canvSelId) : null);
     if (activeObj) {
        const rad = activeObj.rotation * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const rot = (x, y) => ({ x: (activeObj.cx + x*cos - y*sin)*sc, y: (activeObj.cy + x*sin + y*cos)*sc });
        const w2 = activeObj.w/2, h2 = activeObj.h/2;
        const handles = {
          tl: rot(-w2, -h2), tr: rot(w2, -h2), br: rot(w2, h2), bl: rot(-w2, h2),
          t: rot(0, -h2), r: rot(w2, 0), b: rot(0, h2), l: rot(-w2, 0),
          rotH: rot(0, -h2 - 10)
        };
        
        ctx.strokeStyle = canvSelType==='paper'?'#ff00ff':'#00ffff';
        ctx.fillStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        const r = 4;
        
        ctx.beginPath();
        ctx.moveTo(handles.tl.x, handles.tl.y);
        ctx.lineTo(handles.tr.x, handles.tr.y);
        ctx.lineTo(handles.br.x, handles.br.y);
        ctx.lineTo(handles.bl.x, handles.bl.y);
        ctx.closePath();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(handles.t.x, handles.t.y);
        ctx.lineTo(handles.rotH.x, handles.rotH.y);
        ctx.stroke();
        
        for(let k in handles) {
           ctx.beginPath();
           if(k === 'rotH') ctx.arc(handles[k].x, handles[k].y, r, 0, Math.PI*2);
           else ctx.rect(handles[k].x - r, handles[k].y - r, r*2, r*2);
           ctx.fill(); ctx.stroke();
        }
     }
  }
}

function render(){
    const W=mainCanvas.width,H=mainCanvas.height,sc=MM*viewScale;
    bgCtx.clearRect(0,0,W,H);
    bgCtx.fillStyle=document.getElementById('cv-bg').value;
    bgCtx.fillRect(0,0,W,H);
    ctx.clearRect(0,0,W,H);
    
    renderCanvasMode(sc);
    
    shapes.forEach(s=>renderShape(s,sc));
    if(drawing&&drawingShape)renderShape(drawingShape,sc,true);
    renderCircle(sc);
    if(currentMode==='arrange'||currentMode==='label')renderGroupMarkers(sc);
    if(currentMode==='label')renderLabels(sc);
    if(currentMode==='draw'&&drawTool==='select'&&selShapeId!==null&&selPtIdx!==null)renderBezierHandles(sc);
  }'''
text = text.replace(old_render, new_render)

with open('rotadraw.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Patch 3 done.")
