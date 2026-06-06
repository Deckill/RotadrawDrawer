import re

with open('rotadraw.html', 'r', encoding='utf-8') as f:
    text = f.read()

old_canvas_mouse = '''  // --- Canvas mode ---
  let _cDrag=null;
  function mCanvasDown(pos,e){
    const hitR=Math.max(4,8/viewScale);
    if(Math.hypot(pos.x-circle.cx,pos.y-circle.cy)<hitR*1.5){_cDrag='center';return;}
    if(Math.abs(Math.hypot(pos.x-circle.cx,pos.y-circle.cy)-circle.r)<hitR){_cDrag='edge';return;}
    _cDrag=null;
  }
  function mCanvasMove(pos,e){
    if(!_cDrag||!_mdMm)return;
    if(_cDrag==='center'){
      // Move circle only; shapes and other-group copies will follow via rotation
      circle.cx=pos.x;circle.cy=pos.y;
      document.getElementById('sb-info').textContent=¿ø Áß½É: (, ) mm;
    } else {
      circle.r=Math.hypot(pos.x-circle.cx,pos.y-circle.cy);
      document.getElementById('circle-d').value=(circle.r*2).toFixed(1);
    }
    render();
  }
  function mCanvasUp(pos){_cDrag=null;document.getElementById('sb-info').textContent='';}'''

new_canvas_mouse = '''  // --- Canvas mode ---
  function getActiveCanvasObj() {
    if (canvSelType === 'paper') return paperGuide;
    if (canvSelType === 'image') return images.find(x => x.id === canvSelId);
    return null;
  }
  
  function getTransformHandles(obj) {
    const {cx, cy, w, h, rotation} = obj;
    const rad = rotation * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const rot = (x, y) => ({ x: cx + x*cos - y*sin, y: cy + x*sin + y*cos });
    return {
      tl: rot(-w/2, -h/2), tr: rot(w/2, -h/2), br: rot(w/2, h/2), bl: rot(-w/2, h/2),
      t: rot(0, -h/2), r: rot(w/2, 0), b: rot(0, h/2), l: rot(-w/2, 0),
      rotH: rot(0, -h/2 - 10)
    };
  }

  function hitTestCanvasObj(obj, pos) {
    const rad = -obj.rotation * Math.PI / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const dx = pos.x - obj.cx, dy = pos.y - obj.cy;
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    return Math.abs(lx) <= obj.w/2 && Math.abs(ly) <= obj.h/2;
  }

  function mCanvasDown(pos, e) {
    const hitR = Math.max(4, 8/viewScale);
    const activeObj = getActiveCanvasObj();
    
    if (activeObj) {
       const handles = getTransformHandles(activeObj);
       for(let k in handles) {
          if(Math.hypot(pos.x - handles[k].x, pos.y - handles[k].y) < hitR) {
             canvDragState = { type: 'handle', handle: k, origObj: {...activeObj} };
             return;
          }
       }
    }
    
    for(let i = images.length - 1; i >= 0; i--) {
       if(hitTestCanvasObj(images[i], pos)) {
          canvSelType = 'image'; canvSelId = images[i].id;
          canvDragState = { type: 'move', origObj: {...images[i]} };
          render(); return;
       }
    }
    
    if(hitTestCanvasObj(paperGuide, pos)) {
       canvSelType = 'paper'; canvSelId = null;
       canvDragState = { type: 'move', origObj: {...paperGuide} };
       render(); return;
    }
    
    canvSelType = null;
    canvDragState = null;
    render();
  }

  function mCanvasMove(pos, e) {
    if(!canvDragState || !_mdMm) return;
    const obj = getActiveCanvasObj();
    if(!obj) return;
    
    if(canvDragState.type === 'move') {
       let dx = pos.x - _mdMm.x, dy = pos.y - _mdMm.y;
       if(e.shiftKey) {
          const ang = Math.atan2(dy, dx);
          const snapAng = Math.round(ang / (Math.PI/4)) * (Math.PI/4);
          const dist = Math.hypot(dx, dy);
          dx = dist * Math.cos(snapAng); dy = dist * Math.sin(snapAng);
       }
       obj.cx = canvDragState.origObj.cx + dx;
       obj.cy = canvDragState.origObj.cy + dy;
    } else if(canvDragState.type === 'handle') {
       const hName = canvDragState.handle;
       if(hName === 'rotH') {
          obj.rotation = Math.atan2(pos.y - obj.cy, pos.x - obj.cx) * 180 / Math.PI + 90;
       } else {
          const oRad = -canvDragState.origObj.rotation * Math.PI / 180;
          const oCos = Math.cos(oRad), oSin = Math.sin(oRad);
          const gDx = pos.x - _mdMm.x, gDy = pos.y - _mdMm.y;
          const dx = gDx * oCos - gDy * oSin;
          const dy = gDx * oSin + gDy * oCos;
          
          let dw = 0, dh = 0;
          if(hName.includes('r')) dw = dx;
          if(hName.includes('l')) dw = -dx;
          if(hName.includes('b')) dh = dy;
          if(hName.includes('t')) dh = -dy;
          
          if(e.shiftKey && hName.length === 2) {
             const ratio = canvDragState.origObj.w / canvDragState.origObj.h;
             if(Math.abs(dw) > Math.abs(dh)) dh = dw / ratio * Math.sign(dh * dw || 1);
             else dw = dh * ratio * Math.sign(dh * dw || 1);
          }
          
          if(e.altKey) {
             obj.w = Math.max(1, canvDragState.origObj.w + dw * 2);
             obj.h = Math.max(1, canvDragState.origObj.h + dh * 2);
          } else {
             obj.w = Math.max(1, canvDragState.origObj.w + dw);
             obj.h = Math.max(1, canvDragState.origObj.h + dh);
             let shiftX = 0, shiftY = 0;
             if(hName.includes('r')) shiftX = dw / 2;
             if(hName.includes('l')) shiftX = -dw / 2;
             if(hName.includes('b')) shiftY = dh / 2;
             if(hName.includes('t')) shiftY = -dh / 2;
             
             const nRad = canvDragState.origObj.rotation * Math.PI / 180;
             const nCos = Math.cos(nRad), nSin = Math.sin(nRad);
             obj.cx = canvDragState.origObj.cx + shiftX * nCos - shiftY * nSin;
             obj.cy = canvDragState.origObj.cy + shiftX * nSin + shiftY * nCos;
          }
       }
    }
    
    if(canvSelType === 'paper' && paperGuide.size !== 'Custom') {
       paperGuide.size = 'Custom';
       document.getElementById('pg-size').value = 'Custom';
    }
    if(canvSelType === 'paper') {
       document.getElementById('cv-w').value = Math.round(paperGuide.w);
       document.getElementById('cv-h').value = Math.round(paperGuide.h);
    }
    render();
  }

  function mCanvasUp(pos) {
    canvDragState = null;
  }'''
text = text.replace(old_canvas_mouse, new_canvas_mouse)

with open('rotadraw.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Patch 4 done.")
