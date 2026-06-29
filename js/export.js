async function saveProject(){
  const data={version:4,canvasW,canvasH,baseW,baseH,circle,shapes,groups,nextGroupId,labels,penThickness,exportThickness,bgColor:document.getElementById('cv-bg').value};
  const jsonStr = JSON.stringify(data, null, 2);
  
  if (window.showSaveFilePicker && currentFileHandle) {
    try {
      const options = { mode: 'readwrite' };
      if ((await currentFileHandle.queryPermission(options)) !== 'granted') {
        if ((await currentFileHandle.requestPermission(options)) !== 'granted') {
          alert(t('save_denied'));
          return;
        }
      }
      const writable = await currentFileHandle.createWritable();
      await writable.write(jsonStr);
      await writable.close();
    } catch (err) {
      console.warn(t('save_fallback'), err);
      await saveProjectAs();
    }
  } else {
    await saveProjectAs();
  }
}

async function saveProjectAs(){
  const data={version:4,canvasW,canvasH,baseW,baseH,circle,shapes,groups,nextGroupId,labels,penThickness,exportThickness,bgColor:document.getElementById('cv-bg').value};
  const jsonStr = JSON.stringify(data, null, 2);
  
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'rotadraw.rdraw',
        types: [{
          description: 'Rotadraw Project',
          accept: {
            'application/json': ['.rdraw', '.json']
          }
        }]
      });
      currentFileHandle = handle;
      const writable = await handle.createWritable();
      await writable.write(jsonStr);
      await writable.close();
    } catch (err) {
      if (err.name !== 'AbortError') {
        alert(t('save_err') + err.message);
      }
    }
  } else {
    const blob=new Blob([jsonStr],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rotadraw.rdraw';a.click();
  }
}

function applyProjectData(d){
  canvasW=d.canvasW||200;canvasH=d.canvasH||200;baseW=d.baseW||canvasW;baseH=d.baseH||canvasH;
  paperGuide.w = canvasW;
  paperGuide.h = canvasH;
  paperGuide.cx = canvasW / 2;
  paperGuide.cy = canvasH / 2;
  paperGuide.rotation = 0;
  circle=d.circle||{cx:100,cy:100,r:75};
  shapes=d.shapes||[];nextShapeId=shapes.reduce((m,s)=>Math.max(m,s.id+1),1);
  groups=d.groups||[];
  let g1 = groups.find(g => g.id === GROUP1_ID);
  if (!g1) {
    groups.unshift({id:GROUP1_ID,label:1,color:GCOLORS[0],rotation:0,locked:true});
  } else {
    g1.rotation = 0;
    g1.locked = true;
  }
  nextGroupId=d.nextGroupId||groups.reduce((m,g)=>Math.max(m,g.id+1),2);
  labels=d.labels||{};
  penThickness=d.penThickness||(d.strokeWidth||0.5);
  exportThickness=d.exportThickness||(d.strokeWidth||1.1);
  activeDrawGroupId=groups.find(g=>g.id===GROUP1_ID)?.id || groups[0].id;
  updateUIAfterLoad(d);
}

function updateUIAfterLoad(d) {
  document.getElementById('pen-sw-num').value=penThickness.toFixed(2);
  document.getElementById('pen-sw-range').value=penThickness;
  document.getElementById('exp-sw-num').value=exportThickness.toFixed(2);
  document.getElementById('exp-sw-range').value=exportThickness;
  document.getElementById('cv-w').value=canvasW;document.getElementById('cv-h').value=canvasH;
  document.getElementById('cv-bg').value=d.bgColor||'#ffffff';
  document.getElementById('circle-d').value=(circle.r*2).toFixed(1);
  refreshGroupList();setCanvasSize();render();
  triggerAutosave();
}

async function loadProject(){
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'Rotadraw Project',
          accept: {
            'application/json': ['.rdraw', '.json']
          }
        }]
      });
      currentFileHandle = handle;
      const file = await handle.getFile();
      const text = await file.text();
      const d = JSON.parse(text);
      applyProjectData(d);
    } catch (err) {
      if (err.name !== 'AbortError') {
        alert(t('load_err') + err.message);
      }
    }
  } else {
    document.getElementById('proj-input').click();
  }
}

function onProjectLoaded(e){
  const file=e.target.files[0];if(!file)return;
  currentFileHandle = null;
  const rd=new FileReader();
  rd.onload=ev=>{
    try{
      const d=JSON.parse(ev.target.result);
      applyProjectData(d);
    }catch(err){alert(t('file_err') + err.message);}
  };
  rd.readAsText(file);e.target.value='';
}

function showExportModal(){document.getElementById('export-modal').style.display='flex';}

function renderOffscreen(mmScale, exportTarget = 'all') {
  const exportFont = document.getElementById('export-font') ? document.getElementById('export-font').value : 'vector';
  const exportCount = document.getElementById('export-count') ? document.getElementById('export-count').value : 'yes';

  const oc=document.createElement('canvas');
  oc.width=Math.round(paperGuide.w*mmScale);oc.height=Math.round(paperGuide.h*mmScale);
  const oc2=oc.getContext('2d');
  oc2.fillStyle=document.getElementById('cv-bg').value;oc2.fillRect(0,0,oc.width,oc.height);
  oc2.save();
  oc2.translate(oc.width/2, oc.height/2);
  oc2.rotate(-paperGuide.rotation * Math.PI / 180);
  oc2.translate(-paperGuide.cx * mmScale, -paperGuide.cy * mmScale);
  images.forEach(img => {
     oc2.save();
     oc2.translate(img.cx * mmScale, img.cy * mmScale);
     oc2.rotate(img.rotation * Math.PI / 180);
     oc2.drawImage(img.img, -img.w/2 * mmScale, -img.h/2 * mmScale, img.w * mmScale, img.h * mmScale);
     oc2.restore();
  });
  
  if (exportTarget === 'all' || exportTarget === 'shapes') {
    shapes.forEach(s=>{
      if(s.groupId===GROUP1_ID&&!s._isCopy&&hasCopy(s.id))return;
      const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
      oc2.save();
      if(g&&g.rotation!==0){oc2.translate(circle.cx*mmScale,circle.cy*mmScale);oc2.rotate(g.rotation*Math.PI/180);oc2.translate(-circle.cx*mmScale,-circle.cy*mmScale);}
      
      const color = g ? g.color : '#000';
      const {pts, closed} = getPolyline(s);
      if(pts.length>=2){
        oc2.beginPath();
        oc2.moveTo(pts[0].x * mmScale, pts[0].y * mmScale);
        pts.slice(1).forEach(p => oc2.lineTo(p.x * mmScale, p.y * mmScale));
        oc2.lineJoin = 'miter';
        oc2.lineCap = 'round';
        if(closed){
          oc2.closePath();
          oc2.fillStyle = color;
          oc2.fill();
          oc2.strokeStyle = color;
          oc2.lineWidth = exportThickness * mmScale;
          oc2.stroke();
        } else {
          oc2.strokeStyle = color;
          oc2.lineWidth = exportThickness * mmScale;
          oc2.stroke();
        }
      }
      oc2.restore();
    });
  }
  
  if (exportTarget === 'all' || exportTarget === 'labels') {
    const labelSize = parseFloat(document.getElementById('label-size').value) || 4;
    const renderedCCs = new Set();
    shapes.forEach(s => {
      if(!s.groupId)return;
      if(s.groupId===GROUP1_ID && !s._isCopy && hasCopy(s.id)) return;
      const g=groups.find(x=>x.id===s.groupId);if(!g)return;
      const targetId = s._isCopy ? s._origId : s.id;
      
      const cc = getConnectedComponent(targetId);
      const ccKey = cc.join(',');
      if (renderedCCs.has(ccKey)) return;
      renderedCCs.add(ccKey);
      
      let sumX = 0, sumY = 0, count = 0;
      cc.forEach(id => {
         const cs = shapes.find(x => (x.id === id || x._origId === id) && x.groupId === s.groupId);
         if (cs) {
           const ctr = shapeCenter(cs);
           sumX += ctr.x; sumY += ctr.y; count++;
         }
      });
      if (count === 0) return;
      const ctr = { x: sumX/count, y: sumY/count };
      
      const rootId = cc[0];
      const lbl=labels[rootId]||{ox:4,oy:-4};
      
      const lx = ctr.x + lbl.ox;
      const ly = ctr.y + lbl.oy;
      
      let strStr = String(g.label);
      if (isCCClosed(targetId)) {
        const rootShape = shapes.find(x => x.id === rootId);
        if (rootShape) {
          strStr = (rootShape.isHollow !== false ? '○' : '●') + strStr;
        }
      }
      const letterSpacing = 0.8;
      const totalWidth = (strStr.length - 1) * letterSpacing;
      const startX = -totalWidth / 2;
      const hw = Math.max(0.2, labelSize * 0.08); // 레이블 굵기
      
      oc2.fillStyle = g.color;
      
      for(let i=0; i<strStr.length; i++) {
        const char = strStr[i];
        const offsetX = startX + i * letterSpacing;
        
        if (exportFont === '7seg' && digitSegs[char]) {
          digitSegs[char].forEach(seg => {
            const p1 = { x: lx + (seg[0][0] + offsetX) * labelSize, y: ly + seg[0][1] * labelSize };
            const p2 = { x: lx + (seg[1][0] + offsetX) * labelSize, y: ly + seg[1][1] * labelSize };
            const rp1 = g.rotation !== 0 ? rotAround(p1, circle.cx, circle.cy, g.rotation) : p1;
            const rp2 = g.rotation !== 0 ? rotAround(p2, circle.cx, circle.cy, g.rotation) : p2;
            const dStr = getHexSegmentD(rp1, rp2, hw, mmScale);
            if (dStr) {
              const p2d = new Path2D(dStr);
              oc2.fill(p2d);
            }
          });
        } else if (char === '○' || char === '●') {
          const charX = lx + offsetX * labelSize;
          const charY = ly;
          const charRot = g.rotation !== 0 ? rotAround({x: charX, y: charY}, circle.cx, circle.cy, g.rotation) : {x: charX, y: charY};
          
          oc2.save();
          oc2.fillStyle = g.color;
          oc2.strokeStyle = g.color;
          oc2.lineWidth = hw * 2 * mmScale;
          oc2.beginPath();
          oc2.arc(charRot.x * mmScale, charRot.y * mmScale, 0.4 * labelSize * mmScale, 0, Math.PI * 2);
          if (char === '●') oc2.fill();
          else oc2.stroke();
          oc2.restore();
        } else if (exportFont === 'vector') {
          // 'vector'는 PDF/PNG 특성상 실제 폰트 사용
          oc2.save();
          oc2.translate(circle.cx*mmScale, circle.cy*mmScale);
          if(g.rotation !== 0) oc2.rotate(g.rotation*Math.PI/180);
          oc2.translate(-circle.cx*mmScale, -circle.cy*mmScale);
          
          oc2.font = `bold ${labelSize * 1.5 * mmScale}px sans-serif`;
          oc2.textAlign = 'center';
          oc2.textBaseline = 'middle';
          oc2.fillText(char, (lx + offsetX * labelSize) * mmScale, ly * mmScale);
          oc2.restore();
        }
      }
    });

    // 가이드 원 오프스크린 렌더링
    const circleCx = circle.cx * mmScale, circleCy = circle.cy * mmScale, circleR = circle.r * mmScale;
    oc2.save();
    oc2.strokeStyle = '#4488ffaa'; oc2.lineWidth = 0.5 * mmScale;
    oc2.setLineDash([5 * mmScale, 5 * mmScale]);
    oc2.beginPath(); oc2.arc(circleCx, circleCy, circleR, 0, Math.PI*2); oc2.stroke();
    oc2.setLineDash([]);
    
    oc2.strokeStyle = '#ff4444aa';
    oc2.lineWidth = 0.5 * mmScale;
    oc2.beginPath();
    oc2.arc(circleCx, circleCy, (centerHandleDiameter/2) * mmScale, 0, Math.PI*2);
    oc2.stroke();

    oc2.beginPath();
    oc2.moveTo(circleCx - 6 * mmScale, circleCy);
    oc2.lineTo(circleCx + 6 * mmScale, circleCy);
    oc2.moveTo(circleCx, circleCy - 6 * mmScale);
    oc2.lineTo(circleCx, circleCy + 6 * mmScale);
    oc2.stroke();

    oc2.fillStyle = '#4488ffcc';
    oc2.strokeStyle = '#4488ff';
    oc2.lineWidth = 0.4 * mmScale;
    oc2.beginPath(); 
    oc2.arc(circleCx, circleCy, 2 * mmScale, 0, Math.PI*2); 
    oc2.fill();
    oc2.stroke();

    oc2.restore();
    
    // 그룹 마커 핸들 오프스크린 렌더링
    groups.forEach(g => {
      const mRadHalf = 3 * mmScale;
      const mTangHalf = 0.5 * mmScale;
      oc2.save();
      oc2.translate(circle.cx * mmScale, circle.cy * mmScale);
      oc2.rotate(g.rotation * Math.PI / 180);
      const edgeY = -(circle.r * mmScale);
      oc2.fillStyle = g.color + 'bb';
      oc2.strokeStyle = g.color;
      oc2.lineWidth = 1 * mmScale;
      oc2.beginPath();
      oc2.rect(-mTangHalf, edgeY - mRadHalf, mTangHalf * 2, mRadHalf * 2);
      oc2.fill(); oc2.stroke();
      oc2.restore();
      
      let strStr = String(g.label);
      const labelSize = parseFloat(document.getElementById('label-size')?document.getElementById('label-size').value:4) || 4;
      const mLabelSize = labelSize;
      const letterSpacing = 0.8;
      const totalWidth = (strStr.length - 1) * letterSpacing;
      
      const ly = circle.cy + (-circle.r) + 6;
      const mHw = Math.max(0.2, mLabelSize * 0.08);
      const mRot = g.rotation;

      const drawText = (textStr, cx, cy) => {
        const tw = (textStr.length - 1) * letterSpacing;
        const sX = cx - (tw * mLabelSize) / 2;
        oc2.fillStyle = g.color;
        
        for(let i=0; i<textStr.length; i++) {
          const char = textStr[i];
          const offsetX = (sX - cx)/mLabelSize + i * letterSpacing;
          
          if (exportFont === '7seg' && digitSegs[char]) {
            digitSegs[char].forEach(seg => {
              const p1 = { x: cx + (seg[0][0] + offsetX) * mLabelSize, y: cy + seg[0][1] * mLabelSize };
              const p2 = { x: cx + (seg[1][0] + offsetX) * mLabelSize, y: cy + seg[1][1] * mLabelSize };
              const p1Rot = rotAround(p1, circle.cx, circle.cy, mRot);
              const p2Rot = rotAround(p2, circle.cx, circle.cy, mRot);
              const dText = getHexSegmentD(p1Rot, p2Rot, mHw, mmScale);
              if (dText) {
                const p2d = new Path2D(dText);
                oc2.fill(p2d);
              }
            });
          } else if (char === '○' || char === '●') {
            const charX = cx + offsetX * mLabelSize;
            const charY = cy;
            const charRot = mRot !== 0 ? rotAround({x: charX, y: charY}, circle.cx, circle.cy, mRot) : {x: charX, y: charY};
            
            oc2.save();
            oc2.fillStyle = g.color;
            oc2.strokeStyle = g.color;
            oc2.lineWidth = mHw * 2 * mmScale;
            oc2.beginPath();
            oc2.arc(charRot.x * mmScale, charRot.y * mmScale, 0.4 * mLabelSize * mmScale, 0, Math.PI * 2);
            if (char === '●') oc2.fill();
            else oc2.stroke();
            oc2.restore();
          } else if (exportFont === 'vector') {
            oc2.save();
            oc2.translate(circle.cx*mmScale, circle.cy*mmScale);
            if(mRot !== 0) oc2.rotate(mRot*Math.PI/180);
            oc2.translate(-circle.cx*mmScale, -circle.cy*mmScale);
            
            oc2.font = `bold ${mLabelSize * 1.5 * mmScale}px sans-serif`;
            oc2.textAlign = 'center';
            oc2.textBaseline = 'middle';
            oc2.fillText(char, (cx + offsetX * mLabelSize) * mmScale, cy * mmScale);
            oc2.restore();
          }
        }
      };

      // Right side: Group Number
      const lxCenter = circle.cx + 4.5 + (totalWidth * mLabelSize) / 2;
      drawText(strStr, lxCenter, ly);
      
      // Left side: Shape Count
      if (exportCount === 'yes') {
        const count = typeof getGroupShapeCount === 'function' ? getGroupShapeCount(g.id) : shapes.filter(s => s.groupId === g.id && !(s.groupId === GROUP1_ID && !s._isCopy && hasCopy(s.id)) && s.points && s.points.length >= 2).length;
        const countStr = String(count);
        const ctw = (countStr.length - 1) * letterSpacing;
        const cLxCenter = circle.cx - 4.5 - (ctw * mLabelSize) / 2;
        oc2.globalAlpha = 0.6;
        drawText(countStr, cLxCenter, ly);
        oc2.globalAlpha = 1.0;
      }
    });
  }

  oc2.restore();
  return oc;
}

function exportPNG(){document.getElementById('export-modal').style.display='none';renderOffscreen(EXPORT_MM).toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='rotadraw.png';a.click();});}

function getGlobalBounds() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const addPt = (x, y) => { minX=Math.min(minX,x); minY=Math.min(minY,y); maxX=Math.max(maxX,x); maxY=Math.max(maxY,y); };
  // Include guide circle bounds
  addPt(circle.cx - circle.r, circle.cy - circle.r);
  addPt(circle.cx + circle.r, circle.cy + circle.r);
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
  minX -= 5; minY -= 5; maxX += 5; maxY += 5;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

const rawDigitSegs = {
  '0': [[[ -0.3, -0.5 ], [ 0.3, -0.5 ]], [[ 0.3, -0.5 ], [ 0.3, 0.5 ]], [[ 0.3, 0.5 ], [ -0.3, 0.5 ]], [[ -0.3, 0.5 ], [ -0.3, -0.5 ]]],
  '1': [[[ 0, -0.5 ], [ 0, 0.5 ]]],
  '2': [[[ -0.3, -0.5 ], [ 0.3, -0.5 ]], [[ 0.3, -0.5 ], [ 0.3, 0 ]], [[ 0.3, 0 ], [ -0.3, 0 ]], [[ -0.3, 0 ], [ -0.3, 0.5 ]], [[ -0.3, 0.5 ], [ 0.3, 0.5 ]]],
  '3': [[[ -0.3, -0.5 ], [ 0.3, -0.5 ]], [[ 0.3, -0.5 ], [ 0.3, 0.5 ]], [[ 0.3, 0.5 ], [ -0.3, 0.5 ]], [[ 0.3, 0 ], [ -0.3, 0 ]]],
  '4': [[[ -0.3, -0.5 ], [ -0.3, 0 ]], [[ -0.3, 0 ], [ 0.3, 0 ]], [[ 0.3, -0.5 ], [ 0.3, 0.5 ]]],
  '5': [[[ 0.3, -0.5 ], [ -0.3, -0.5 ]], [[ -0.3, -0.5 ], [ -0.3, 0 ]], [[ -0.3, 0 ], [ 0.3, 0 ]], [[ 0.3, 0 ], [ 0.3, 0.5 ]], [[ 0.3, 0.5 ], [ -0.3, 0.5 ]]],
  '6': [[[ 0.3, -0.5 ], [ -0.3, -0.5 ]], [[ -0.3, -0.5 ], [ -0.3, 0.5 ]], [[ -0.3, 0.5 ], [ 0.3, 0.5 ]], [[ 0.3, 0.5 ], [ 0.3, 0 ]], [[ 0.3, 0 ], [ -0.3, 0 ]]],
  '7': [[[ -0.3, -0.5 ], [ 0.3, -0.5 ]], [[ 0.3, -0.5 ], [ 0.3, 0.5 ]]],
  '8': [[[ -0.3, -0.5 ], [ 0.3, -0.5 ]], [[ 0.3, -0.5 ], [ 0.3, 0.5 ]], [[ 0.3, 0.5 ], [ -0.3, 0.5 ]], [[ -0.3, 0.5 ], [ -0.3, -0.5 ]], [[ -0.3, 0 ], [ 0.3, 0 ]]],
  '9': [[[ 0.3, 0.5 ], [ 0.3, -0.5 ]], [[ 0.3, -0.5 ], [ -0.3, -0.5 ]], [[ -0.3, -0.5 ], [ -0.3, 0 ]], [[ -0.3, 0 ], [ 0.3, 0 ]]]
};

const digitSegs = {};
for(let k in rawDigitSegs) {
  digitSegs[k] = rawDigitSegs[k].map(seg => {
    const dx = seg[1][0] - seg[0][0];
    const dy = seg[1][1] - seg[0][1];
    const len = Math.hypot(dx, dy);
    if(len < 1e-4) return seg;
    const shrink = 0.015;
    const nx = dx/len * shrink;
    const ny = dy/len * shrink;
    return [
      [seg[0][0] + nx, seg[0][1] + ny],
      [seg[1][0] - nx, seg[1][1] - ny]
    ];
  });
}

function getHexSegmentD(p0, p1, hw, customScale = 96 / 25.4) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-5) return null;
  const nx = -dy/len * hw, ny = dx/len * hw;
  const px = dx/len, py = dy/len;
  
  const f = v => (v * customScale).toFixed(3);
  
  const tipL = hw * 0.9; 
  const gap = 0; 
  const p0x = p0.x + px*gap, p0y = p0.y + py*gap;
  const p1x = p1.x - px*gap, p1y = p1.y - py*gap;
  
  const t0x = p0x, t0y = p0y;
  const c0tx = p0x + px*tipL + nx, c0ty = p0y + py*tipL + ny;
  const c1tx = p1x - px*tipL + nx, c1ty = p1y - py*tipL + ny;
  const t1x = p1x, t1y = p1y;
  const c1bx = p1x - px*tipL - nx, c1by = p1y - py*tipL - ny;
  const c0bx = p0x + px*tipL - nx, c0by = p0y + py*tipL - ny;

  return `M ${f(t0x)} ${f(t0y)} L ${f(c0tx)} ${f(c0ty)} L ${f(c1tx)} ${f(c1ty)} L ${f(t1x)} ${f(t1y)} L ${f(c1bx)} ${f(c1by)} L ${f(c0bx)} ${f(c0by)} Z`;
}

const vectorDigits = {
  '0': [{ closed: true, points: [ {x:0, y:-0.5, inT:{x:-0.2,y:0}, outT:{x:0.2,y:0}}, {x:0.3, y:0, inT:{x:0,y:-0.3}, outT:{x:0,y:0.3}}, {x:0, y:0.5, inT:{x:0.2,y:0}, outT:{x:-0.2,y:0}}, {x:-0.3, y:0, inT:{x:0,y:0.3}, outT:{x:0,y:-0.3}} ]}],
  '1': [{ closed: false, points: [ {x:0, y:-0.5, inT:{x:0,y:0}, outT:{x:0,y:0}}, {x:0, y:0.5, inT:{x:0,y:0}, outT:{x:0,y:0}} ]}],
  '2': [{ closed: false, points: [ {x:-0.3, y:-0.3, inT:{x:0,y:0}, outT:{x:0,y:-0.2}}, {x:0, y:-0.5, inT:{x:-0.2,y:0}, outT:{x:0.2,y:0}}, {x:0.3, y:-0.3, inT:{x:0,y:-0.2}, outT:{x:-0.1,y:0.3}}, {x:-0.3, y:0.5, inT:{x:0.1,y:-0.3}, outT:{x:0,y:0}}, {x:0.3, y:0.5, inT:{x:0,y:0}, outT:{x:0,y:0}} ]}],
  '3': [{ closed: false, points: [ {x:-0.3, y:-0.3, inT:{x:0,y:0}, outT:{x:0,y:-0.2}}, {x:0, y:-0.5, inT:{x:-0.2,y:0}, outT:{x:0.2,y:0}}, {x:0.3, y:-0.25, inT:{x:0,y:-0.2}, outT:{x:0,y:0.15}}, {x:0, y:0, inT:{x:0.2,y:0}, outT:{x:0.2,y:0}}, {x:0.3, y:0.25, inT:{x:0,y:-0.15}, outT:{x:0,y:0.2}}, {x:0, y:0.5, inT:{x:0.2,y:0}, outT:{x:-0.2,y:0}}, {x:-0.3, y:0.3, inT:{x:0,y:0.2}, outT:{x:0,y:0}} ]}],
  '4': [{ closed: false, points: [ {x:0.2, y:0.5, inT:{x:0,y:0}, outT:{x:0,y:0}}, {x:0.2, y:-0.5, inT:{x:0,y:0}, outT:{x:0,y:0}}, {x:-0.3, y:0.1, inT:{x:0,y:0}, outT:{x:0,y:0}}, {x:0.3, y:0.1, inT:{x:0,y:0}, outT:{x:0,y:0}} ]}],
  '5': [{ closed: false, points: [ {x:0.3, y:-0.5, inT:{x:0,y:0}, outT:{x:0,y:0}}, {x:-0.3, y:-0.5, inT:{x:0,y:0}, outT:{x:0,y:0}}, {x:-0.3, y:0, inT:{x:0,y:0}, outT:{x:0.2,y:0}}, {x:0.3, y:0.15, inT:{x:0,y:-0.1}, outT:{x:0,y:0.2}}, {x:0, y:0.5, inT:{x:0.2,y:0}, outT:{x:-0.2,y:0}}, {x:-0.3, y:0.3, inT:{x:0,y:0.2}, outT:{x:0,y:0}} ]}],
  '6': [{ closed: false, points: [ {x:0.2, y:-0.4, inT:{x:0,y:0}, outT:{x:-0.1,y:-0.1}}, {x:-0.3, y:0.1, inT:{x:0,y:-0.2}, outT:{x:0,y:0.2}}, {x:0, y:0.5, inT:{x:-0.2,y:0}, outT:{x:0.2,y:0}}, {x:0.3, y:0.15, inT:{x:0,y:0.2}, outT:{x:0,y:-0.2}}, {x:0, y:-0.1, inT:{x:0.2,y:0}, outT:{x:-0.2,y:0}}, {x:-0.3, y:0.1, inT:{x:0,y:-0.1}, outT:{x:0,y:0}} ]}],
  '7': [{ closed: false, points: [ {x:-0.3, y:-0.5, inT:{x:0,y:0}, outT:{x:0,y:0}}, {x:0.3, y:-0.5, inT:{x:0,y:0}, outT:{x:0,y:0}}, {x:0, y:0.5, inT:{x:0,y:0}, outT:{x:0,y:0}} ]}],
  '8': [{ closed: true, points: [ {x:0, y:-0.5, inT:{x:-0.2,y:0}, outT:{x:0.2,y:0}}, {x:0.3, y:-0.25, inT:{x:0,y:-0.15}, outT:{x:0,y:0.15}}, {x:0, y:0, inT:{x:0.2,y:0}, outT:{x:-0.2,y:0}}, {x:-0.3, y:0.25, inT:{x:0,y:-0.15}, outT:{x:0,y:0.15}}, {x:0, y:0.5, inT:{x:-0.2,y:0}, outT:{x:0.2,y:0}}, {x:0.3, y:0.25, inT:{x:0,y:0.15}, outT:{x:0,y:-0.15}}, {x:0, y:0, inT:{x:0.2,y:0}, outT:{x:-0.2,y:0}}, {x:-0.3, y:-0.25, inT:{x:0,y:0.15}, outT:{x:0,y:-0.15}} ]}],
  '9': [{ closed: false, points: [ {x:-0.2, y:0.4, inT:{x:0,y:0}, outT:{x:0.1,y:0.1}}, {x:0.3, y:-0.1, inT:{x:0,y:0.2}, outT:{x:0,y:-0.2}}, {x:0, y:-0.5, inT:{x:0.2,y:0}, outT:{x:-0.2,y:0}}, {x:-0.3, y:-0.15, inT:{x:0,y:-0.2}, outT:{x:0,y:0.2}}, {x:0, y:0.1, inT:{x:-0.2,y:0}, outT:{x:0.2,y:0}}, {x:0.3, y:-0.1, inT:{x:0,y:0.1}, outT:{x:0,y:0}} ]}],
  '○': [{ closed: false, isHollow: true, points: [ {x:0.12, y:-0.38, inT:{x:0,y:0}, outT:{x:0.15,y:0.05}}, {x:0.4, y:0, inT:{x:0,y:-0.2}, outT:{x:0,y:0.2}}, {x:0, y:0.4, inT:{x:0.2,y:0}, outT:{x:-0.2,y:0}}, {x:-0.4, y:0, inT:{x:0,y:0.2}, outT:{x:0,y:-0.2}}, {x:-0.12, y:-0.38, inT:{x:-0.15,y:0.05}, outT:{x:0,y:0}} ]}],
  '●': [{ closed: true, isHollow: false, points: [ {x:0, y:-0.4, inT:{x:-0.22,y:0}, outT:{x:0.22,y:0}}, {x:0.4, y:0, inT:{x:0,y:-0.22}, outT:{x:0,y:0.22}}, {x:0, y:0.4, inT:{x:0.22,y:0}, outT:{x:-0.22,y:0}}, {x:-0.4, y:0, inT:{x:0,y:0.22}, outT:{x:0,y:-0.22}} ]}]
};

function svgNativeSimplePathD(s, rot, cx, cy, customScale = 96 / 25.4) {
  if (s.type !== 'spline' && s.type !== 'line') {
    const {pts, closed} = getPolyline(s);
    if (!pts || pts.length < 2) return null;
    const tempShape = { ...s, type: 'line', points: pts.map(p => ({x: p.x, y: p.y})), closed: closed };
    return svgNativeSimplePathD(tempShape, rot, cx, cy, customScale);
  }
  const f = v => (v * customScale).toFixed(3);
  const n = s.points.length;
  if (n < 2) return null;
  const isLine = s.type === 'line';
  const closed = s.closed === true;
  const segs = closed ? n : n - 1;
  let d = '';

  for (let i = 0; i < segs; i++) {
    const p0_orig = s.points[i];
    const p1_orig = s.points[(i + 1) % n];
    const p0 = rot !== 0 ? rotAround(p0_orig, cx, cy, rot) : p0_orig;
    const p1 = rot !== 0 ? rotAround(p1_orig, cx, cy, rot) : p1_orig;
    
    if (i === 0) d += `M ${f(p0.x)} ${f(p0.y)} `;
    
    if (isLine || (!p0_orig.outT && !p1_orig.inT)) {
       d += `L ${f(p1.x)} ${f(p1.y)} `;
    } else {
       const c0_orig = {x: p0_orig.x + (p0_orig.outT ? p0_orig.outT.x : 0), y: p0_orig.y + (p0_orig.outT ? p0_orig.outT.y : 0)};
       const c1_orig = {x: p1_orig.x + (p1_orig.inT ? p1_orig.inT.x : 0), y: p1_orig.y + (p1_orig.inT ? p1_orig.inT.y : 0)};
       const c0 = rot !== 0 ? rotAround(c0_orig, cx, cy, rot) : c0_orig;
       const c1 = rot !== 0 ? rotAround(c1_orig, cx, cy, rot) : c1_orig;
       d += `C ${f(c0.x)} ${f(c0.y)}, ${f(c1.x)} ${f(c1.y)}, ${f(p1.x)} ${f(p1.y)} `;
    }
  }
  if (closed) d += "Z";
  return d;
}

function svgNativeOffsetPathD(s, rot, cx, cy, customScale = 96 / 25.4) {
  if (s.type !== 'spline' && s.type !== 'line') {
    const {pts, closed} = getPolyline(s);
    if (!pts || pts.length < 2) return null;
    const tempShape = { ...s, type: 'line', points: pts.map(p => ({x: p.x, y: p.y})), closed: closed };
    return svgNativeOffsetPathD(tempShape, rot, cx, cy, customScale);
  }
  const f = v => (v * customScale).toFixed(3);
  const hw = exportThickness / 2;
  const closed = s.closed === true;
  
  const norm = (dx, dy) => {
    const d = Math.hypot(dx, dy);
    return d > 1e-5 ? {x: -dy/d, y: dx/d} : null;
  };

  const lineIntersect = (pA, dirA, pB, dirB) => {
    const det = dirA.x * dirB.y - dirA.y * dirB.x;
    if(Math.abs(det) < 1e-5) return null;
    const t = ((pB.x - pA.x) * dirB.y - (pB.y - pA.y) * dirB.x) / det;
    return {x: pA.x + dirA.x * t, y: pA.y + dirA.y * t};
  };

  const getOffsetBezier = (p0, c0, c1, p1, offset) => {
    const n1 = norm(c0.x - p0.x, c0.y - p0.y) || norm(c1.x - p0.x, c1.y - p0.y) || norm(p1.x - p0.x, p1.y - p0.y);
    const n3 = norm(p1.x - c1.x, p1.y - c1.y) || norm(p1.x - c0.x, p1.y - c0.y) || norm(p1.x - p0.x, p1.y - p0.y);
    const n2 = norm(c1.x - c0.x, c1.y - c0.y) || n1;

    if(!n1 || !n3) return { q0: p0, q1: c0, q2: c1, q3: p1 };

    const q0 = {x: p0.x + n1.x * offset, y: p0.y + n1.y * offset};
    const q3 = {x: p1.x + n3.x * offset, y: p1.y + n3.y * offset};

    const p1_offset = {x: c0.x + n2.x * offset, y: c0.y + n2.y * offset};
    const dir1 = {x: c0.x - p0.x, y: c0.y - p0.y};
    const dir2 = {x: c1.x - c0.x, y: c1.y - c0.y};
    const dir3 = {x: p1.x - c1.x, y: p1.y - c1.y};

    let q1 = lineIntersect(q0, dir1, p1_offset, dir2);
    let q2 = lineIntersect(p1_offset, dir2, q3, dir3);

    if(!q1) q1 = {x: q0.x + dir1.x, y: q0.y + dir1.y};
    if(!q2) q2 = {x: q3.x - dir3.x, y: q3.y - dir3.y};

    return {q0, q1, q2, q3};
  };

  const getOffsetLine = (p0, p1, offset) => {
    const n = norm(p1.x - p0.x, p1.y - p0.y) || {x:0, y:1};
    return {
      q0: {x: p0.x + n.x * offset, y: p0.y + n.y * offset},
      q3: {x: p1.x + n.x * offset, y: p1.y + n.y * offset}
    };
  };

  const n = s.points.length;
  if(n < 2) return null;

  const isLine = s.type === 'line';
  const segs = closed ? n : n - 1;
  
  const outerSegs = [];
  const innerSegs = [];

  for(let i=0; i<segs; i++) {
    const p0_orig = s.points[i];
    const p1_orig = s.points[(i+1)%n];
    const p0 = rot !== 0 ? rotAround(p0_orig, cx, cy, rot) : p0_orig;
    const p1 = rot !== 0 ? rotAround(p1_orig, cx, cy, rot) : p1_orig;
    
    if(isLine) {
      outerSegs.push(getOffsetLine(p0, p1, hw));
      innerSegs.push(getOffsetLine(p0, p1, -hw));
    } else {
      const c0_orig = {x: p0_orig.x + p0_orig.outT.x, y: p0_orig.y + p0_orig.outT.y};
      const c1_orig = {x: p1_orig.x + p1_orig.inT.x, y: p1_orig.y + p1_orig.inT.y};
      const c0 = rot !== 0 ? rotAround(c0_orig, cx, cy, rot) : c0_orig;
      const c1 = rot !== 0 ? rotAround(c1_orig, cx, cy, rot) : c1_orig;
      outerSegs.push(getOffsetBezier(p0, c0, c1, p1, hw));
      innerSegs.push(getOffsetBezier(p0, c0, c1, p1, -hw));
    }
  }

  const getSweep = (v1, v2) => {
    return (v1.x * v2.y - v1.y * v2.x) >= 0 ? 1 : 0;
  };

  let d = '';

  if(!closed) {
    d += `M ${f(outerSegs[0].q0.x)} ${f(outerSegs[0].q0.y)} `;
    for(let i=0; i<segs; i++) {
      const o = outerSegs[i];
      if(isLine) d += `L ${f(o.q3.x)} ${f(o.q3.y)} `;
      else d += `C ${f(o.q1.x)} ${f(o.q1.y)}, ${f(o.q2.x)} ${f(o.q2.y)}, ${f(o.q3.x)} ${f(o.q3.y)} `;
      
      if (i < segs - 1) {
         const nextO = outerSegs[i+1];
         const p = rot !== 0 ? rotAround(s.points[i+1], cx, cy, rot) : s.points[i+1];
         const v1 = {x: o.q3.x - p.x, y: o.q3.y - p.y};
         const v2 = {x: nextO.q0.x - p.x, y: nextO.q0.y - p.y};
         d += `A ${f(hw)} ${f(hw)} 0 0 ${getSweep(v1, v2)} ${f(nextO.q0.x)} ${f(nextO.q0.y)} `;
      }
    }
    const endI = innerSegs[segs-1].q3;
    d += `A ${f(hw)} ${f(hw)} 0 0 0 ${f(endI.x)} ${f(endI.y)} `;
    
    for(let i=segs-1; i>=0; i--) {
      const inn = innerSegs[i];
      if(isLine) d += `L ${f(inn.q0.x)} ${f(inn.q0.y)} `;
      else d += `C ${f(inn.q2.x)} ${f(inn.q2.y)}, ${f(inn.q1.x)} ${f(inn.q1.y)}, ${f(inn.q0.x)} ${f(inn.q0.y)} `;
      
      if (i > 0) {
         const nextInn = innerSegs[i-1];
         const p = rot !== 0 ? rotAround(s.points[i], cx, cy, rot) : s.points[i];
         const v1 = {x: inn.q0.x - p.x, y: inn.q0.y - p.y};
         const v2 = {x: nextInn.q3.x - p.x, y: nextInn.q3.y - p.y};
         d += `A ${f(hw)} ${f(hw)} 0 0 ${getSweep(v1, v2)} ${f(nextInn.q3.x)} ${f(nextInn.q3.y)} `;
      }
    }
    const startO = outerSegs[0].q0;
    d += `A ${f(hw)} ${f(hw)} 0 0 0 ${f(startO.x)} ${f(startO.y)} Z`;
  } else {
    d += `M ${f(outerSegs[0].q0.x)} ${f(outerSegs[0].q0.y)} `;
    for(let i=0; i<segs; i++) {
      const o = outerSegs[i];
      if(isLine) d += `L ${f(o.q3.x)} ${f(o.q3.y)} `;
      else d += `C ${f(o.q1.x)} ${f(o.q1.y)}, ${f(o.q2.x)} ${f(o.q2.y)}, ${f(o.q3.x)} ${f(o.q3.y)} `;
      
      const nextIdx = (i + 1) % n;
      const nextOIdx = (i + 1) % segs;
      const nextO = outerSegs[nextOIdx];
      const p = rot !== 0 ? rotAround(s.points[nextIdx], cx, cy, rot) : s.points[nextIdx];
      const v1 = {x: o.q3.x - p.x, y: o.q3.y - p.y};
      const v2 = {x: nextO.q0.x - p.x, y: nextO.q0.y - p.y};
      d += `A ${f(hw)} ${f(hw)} 0 0 ${getSweep(v1, v2)} ${f(nextO.q0.x)} ${f(nextO.q0.y)} `;
    }
    d += 'Z ';
    
    d += `M ${f(innerSegs[segs-1].q3.x)} ${f(innerSegs[segs-1].q3.y)} `;
    for(let i=segs-1; i>=0; i--) {
      const inn = innerSegs[i];
      if(isLine) d += `L ${f(inn.q0.x)} ${f(inn.q0.y)} `;
      else d += `C ${f(inn.q2.x)} ${f(inn.q2.y)}, ${f(inn.q1.x)} ${f(inn.q1.y)}, ${f(inn.q0.x)} ${f(inn.q0.y)} `;
      
      const nextIdx = i; // The junction is at p[i]
      const nextOIdx = (i - 1 + segs) % segs;
      const nextInn = innerSegs[nextOIdx];
      const p = rot !== 0 ? rotAround(s.points[nextIdx], cx, cy, rot) : s.points[nextIdx];
      const v1 = {x: inn.q0.x - p.x, y: inn.q0.y - p.y};
      const v2 = {x: nextInn.q3.x - p.x, y: nextInn.q3.y - p.y};
      d += `A ${f(hw)} ${f(hw)} 0 0 ${getSweep(v1, v2)} ${f(nextInn.q3.x)} ${f(nextInn.q3.y)} `;
    }
    d += 'Z';
  }

  return d;
}

function getSquareLineD(p0, p1, hw) {
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-5) return null;
  const nx = -dy/len * hw, ny = dx/len * hw;
  const SVG_SCALE = 96 / 25.4;
  const f = v => (v * SVG_SCALE).toFixed(3);
  return `M ${f(p0.x + nx)} ${f(p0.y + ny)} L ${f(p1.x + nx)} ${f(p1.y + ny)} L ${f(p1.x - nx)} ${f(p1.y - ny)} L ${f(p0.x - nx)} ${f(p0.y - ny)} Z`;
}

function getNativeArcsAndCirclesForExport(s, rot, globalCx, globalCy) {
  const p = getNativeCircleArcParams(s);
  if (!p) return null;
  const results = [];
  const addGeom = (geom) => {
    const pRot = rot === 0 ? {x: geom.cx, y: geom.cy} : rotAround({x: geom.cx, y: geom.cy}, globalCx, globalCy, rot);
    const rotRad = rot * Math.PI / 180;
    if (geom.type === 'circle') {
      results.push({ type: 'circle', cx: pRot.x, cy: pRot.y, r: geom.r });
    } else {
      results.push({ 
        type: 'arc', cx: pRot.x, cy: pRot.y, r: geom.r, 
        startAngle: geom.startAngle + rotRad, 
        endAngle: geom.endAngle + rotRad,
        sweep: geom.sweep
      });
    }
  };
  if (isShapeFilled(s) && p.type === 'circle') {
    addGeom(p);
  } else if (isShapeFilled(s) && p.type === 'arc') {
    addGeom(p);
  }
  
  const hw = exportThickness / 2;
  if (p.type === 'circle') {
    addGeom({ ...p, r: p.r + hw });
    addGeom({ ...p, r: p.r - hw });
  } else {
    addGeom({ ...p, r: p.r + hw });
    addGeom({ ...p, r: p.r - hw });
    const capSweep = p.sweep > 0 ? Math.PI : -Math.PI;
    const startX = p.cx + Math.cos(p.startAngle) * p.r;
    const startY = p.cy + Math.sin(p.startAngle) * p.r;
    addGeom({ type: 'arc', cx: startX, cy: startY, r: hw, startAngle: p.startAngle + Math.PI, endAngle: p.startAngle + Math.PI + capSweep, sweep: capSweep });
    const endX = p.cx + Math.cos(p.endAngle) * p.r;
    const endY = p.cy + Math.sin(p.endAngle) * p.r;
    addGeom({ type: 'arc', cx: endX, cy: endY, r: hw, startAngle: p.endAngle, endAngle: p.endAngle + capSweep, sweep: capSweep });
  }
  return results;
}

function getSvgNativeArcCirclePath(s, rot, globalCx, globalCy) {
  const p = getNativeCircleArcParams(s);
  if (!p) return null;
  const f = v => (v * (96 / 25.4)).toFixed(3);
  const pRot = rot === 0 ? {x: p.cx, y: p.cy} : rotAround({x: p.cx, y: p.cy}, globalCx, globalCy, rot);
  const rotRad = rot * Math.PI / 180;
  
  if (p.type === 'circle') {
    const hw = exportThickness / 2;
    const ro = p.r + hw;
    const ri = p.r - hw;
    const cx = pRot.x, cy = pRot.y;
    const dOuter = `M ${f(cx-ro)} ${f(cy)} A ${f(ro)} ${f(ro)} 0 1 1 ${f(cx+ro)} ${f(cy)} A ${f(ro)} ${f(ro)} 0 1 1 ${f(cx-ro)} ${f(cy)}`;
    const dInner = `M ${f(cx-ri)} ${f(cy)} A ${f(ri)} ${f(ri)} 0 1 0 ${f(cx+ri)} ${f(cy)} A ${f(ri)} ${f(ri)} 0 1 0 ${f(cx-ri)} ${f(cy)}`;
    return dOuter + " " + dInner;
  }
  
  if (p.type === 'arc') {
    const hw = exportThickness / 2;
    const ro = p.r + hw;
    const ri = p.r - hw;
    const cx = pRot.x, cy = pRot.y;
    const sa = p.startAngle + rotRad;
    const ea = p.endAngle + rotRad;
    const sweep = p.sweep;
    
    const ox1 = cx + Math.cos(sa)*ro, oy1 = cy + Math.sin(sa)*ro;
    const ox2 = cx + Math.cos(ea)*ro, oy2 = cy + Math.sin(ea)*ro;
    const ix1 = cx + Math.cos(sa)*ri, iy1 = cy + Math.sin(sa)*ri;
    const ix2 = cx + Math.cos(ea)*ri, iy2 = cy + Math.sin(ea)*ri;
    
    const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0;
    const sweepFlagOuter = sweep > 0 ? 1 : 0;
    const sweepFlagInner = sweep > 0 ? 0 : 1;
    const capSweep = sweep > 0 ? 1 : 0;
    
    return `M ${f(ix1)} ${f(iy1)} ` +
           `A ${f(hw)} ${f(hw)} 0 0 ${capSweep} ${f(ox1)} ${f(oy1)} ` +
           `A ${f(ro)} ${f(ro)} 0 ${largeArc} ${sweepFlagOuter} ${f(ox2)} ${f(oy2)} ` +
           `A ${f(hw)} ${f(hw)} 0 0 ${capSweep} ${f(ix2)} ${f(iy2)} ` +
           `A ${f(ri)} ${f(ri)} 0 ${largeArc} ${sweepFlagInner} ${f(ix1)} ${f(iy1)} Z`;
  }
}


function exportSVG(){
  document.getElementById('export-modal').style.display='none';
  const targetSel = document.getElementById('export-target');
  const exportTarget = targetSel ? targetSel.value : 'all'; // 'all', 'shapes', 'labels'
  
  const fontSel = document.getElementById('export-font');
  const exportFont = fontSel ? fontSel.value : 'vector';
  
  const countSel = document.getElementById('export-count');
  const exportCount = countSel ? countSel.value : 'yes';
  
  const bounds = getGlobalBounds();
  
  const SVG_SCALE = 96 / 25.4;
  const fs = v => (v * SVG_SCALE).toFixed(3);

  let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fs(bounds.x)} ${fs(bounds.y)} ${fs(bounds.w)} ${fs(bounds.h)}" width="${bounds.w}mm" height="${bounds.h}mm">\n`;
  svg+=`<rect x="${fs(bounds.x)}" y="${fs(bounds.y)}" width="${fs(bounds.w)}" height="${fs(bounds.h)}" fill="${document.getElementById('cv-bg').value}"/>\n`;
  images.forEach(img => {
    svg += `<image x="${fs(img.cx - img.w/2)}" y="${fs(img.cy - img.h/2)}" width="${fs(img.w)}" height="${fs(img.h)}" href="${img.img.src}" transform="rotate(${img.rotation} ${fs(img.cx)} ${fs(img.cy)})" />\n`;
  });
  
  if (exportTarget === 'all' || exportTarget === 'shapes') {
    groups.forEach(g=>{
      shapes.filter(s=>s.groupId===g.id&&!(s.groupId===GROUP1_ID&&!s._isCopy&&hasCopy(s.id))).forEach(s=>{
        if(s.points.length >= 2){
          if (s.type === 'circle2pt' || s.type === 'circle3pt' || s.type === 'arcCenter' || s.type === 'arc3pt') {
            const dStr = getSvgNativeArcCirclePath(s, g.rotation, circle.cx, circle.cy);
            if (dStr) {
              svg += `  <path d="${dStr}" fill="${g.color}" stroke="none" />\n`;
            }
            if (isShapeFilled(s) && isShapeClosed(s)) {
              const p = getNativeCircleArcParams(s);
              if (p && p.type === 'circle') {
                  const pRot = g.rotation === 0 ? p : rotAround({x: p.cx, y: p.cy}, circle.cx, circle.cy, g.rotation);
                  svg += `  <circle cx="${fs(pRot.x)}" cy="${fs(pRot.y)}" r="${fs(p.r)}" fill="${g.color}" stroke="none" />\n`;
              }
            }
            return;
          }

          let dOutline = svgNativeOffsetPathD(s, g.rotation, circle.cx, circle.cy);
          if(dOutline) svg+=`  <path d="${dOutline}" fill="${g.color}" stroke="none" />\n`;
          
          if (isShapeClosed(s) && isShapeFilled(s)) {
              let dFill = svgNativeSimplePathD(s, g.rotation, circle.cx, circle.cy);
              if (dFill) svg+=`  <path d="${dFill}" fill="${g.color}" stroke="none" />\n`;
          }
        }
      });
    });
  }

  if (exportTarget === 'all' || exportTarget === 'labels') {
    // 숫자 레이블 SVG 추가 (모든 복제 그룹 포함, 벡터화)
    const labelSize = parseFloat(document.getElementById('label-size').value) || 4;
    const renderedCCs = new Set();
    shapes.forEach(s => {
      if(!s.groupId)return;
      if(s.groupId===GROUP1_ID && !s._isCopy && hasCopy(s.id)) return;
      const g=groups.find(x=>x.id===s.groupId);if(!g)return;
      const targetId = s._isCopy ? s._origId : s.id;
      
      const cc = getConnectedComponent(targetId);
      const ccKey = cc.join(',');
      if (renderedCCs.has(ccKey)) return;
      renderedCCs.add(ccKey);
      
      let sumX = 0, sumY = 0, count = 0;
      cc.forEach(id => {
         const cs = shapes.find(x => (x.id === id || x._origId === id) && x.groupId === s.groupId);
         if (cs) {
           const ctr = shapeCenter(cs);
           sumX += ctr.x; sumY += ctr.y; count++;
         }
      });
      if (count === 0) return;
      const ctr = { x: sumX/count, y: sumY/count };
      
      const rootId = cc[0];
      const lbl=labels[rootId]||{ox:4,oy:-4};
      
      const lx = ctr.x + lbl.ox;
      const ly = ctr.y + lbl.oy;
      
      let strStr = String(g.label);
      if (isCCClosed(targetId)) {
        const rootShape = shapes.find(x => x.id === rootId);
        if (rootShape) {
          strStr = (rootShape.isHollow !== false ? '○' : '●') + strStr;
        }
      }
      const letterSpacing = 0.8;
      const totalWidth = (strStr.length - 1) * letterSpacing;
      const startX = -totalWidth / 2;
      const hw = Math.max(0.2, labelSize * 0.08); // 레이블 굵기
      
      for(let i=0; i<strStr.length; i++) {
        const char = strStr[i];
        const offsetX = startX + i * letterSpacing;
        
        if (exportFont === '7seg' && digitSegs[char]) {
          digitSegs[char].forEach(seg => {
            const p1 = { x: lx + (seg[0][0] + offsetX) * labelSize, y: ly + seg[0][1] * labelSize };
            const p2 = { x: lx + (seg[1][0] + offsetX) * labelSize, y: ly + seg[1][1] * labelSize };
            const rp1 = g.rotation !== 0 ? rotAround(p1, circle.cx, circle.cy, g.rotation) : p1;
            const rp2 = g.rotation !== 0 ? rotAround(p2, circle.cx, circle.cy, g.rotation) : p2;
            const d = getHexSegmentD(rp1, rp2, hw);
            if (d) svg += `  <path d="${d}" fill="${g.color}" stroke="none" />\n`;
          });
        } else if ((exportFont === 'vector' || char === '○' || char === '●') && vectorDigits[char]) {
          vectorDigits[char].forEach(stroke => {
            const scaledPoints = stroke.points.map(p => ({
              x: lx + (p.x + offsetX) * labelSize,
              y: ly + p.y * labelSize,
              inT: { x: p.inT.x * labelSize, y: p.inT.y * labelSize },
              outT: { x: p.outT.x * labelSize, y: p.outT.y * labelSize }
            }));
            const mockShape = { closed: stroke.closed, type: 'spline', strokeWidth: hw * 2, points: scaledPoints, isHollow: stroke.isHollow };
            let d;
            if (mockShape.isHollow === false && isShapeClosed(mockShape)) {
                d = svgNativeSimplePathD(mockShape, g.rotation, circle.cx, circle.cy);
            } else {
                d = svgNativeOffsetPathD(mockShape, g.rotation, circle.cx, circle.cy);
            }
            if (d) svg += `  <path d="${d}" fill="${g.color}" stroke="none" />\n`;
          });
        }
      }
    });
    
    // 가이드 원 SVG 추가 (중심 원 실선)
    svg += `<circle cx="${fs(circle.cx)}" cy="${fs(circle.cy)}" r="${fs(circle.r)}" stroke="#4488ff" stroke-opacity="0.67" stroke-width="${fs(0.5)}" stroke-dasharray="${fs(5)},${fs(5)}" fill="none" />\n`;
    svg += `<circle cx="${fs(circle.cx)}" cy="${fs(circle.cy)}" r="${fs(centerHandleDiameter/2)}" stroke="#ff4444" stroke-opacity="0.67" stroke-width="${fs(0.5)}" fill="none" />\n`;
    svg += `<path d="M ${fs(circle.cx - 6)} ${fs(circle.cy)} L ${fs(circle.cx + 6)} ${fs(circle.cy)} M ${fs(circle.cx)} ${fs(circle.cy - 6)} L ${fs(circle.cx)} ${fs(circle.cy + 6)}" stroke="#ff4444" stroke-width="${fs(0.5)}" fill="none" />\n`;
    svg += `<circle cx="${fs(circle.cx)}" cy="${fs(circle.cy)}" r="${fs(2)}" fill="#4488ff" fill-opacity="0.8" stroke="#4488ff" stroke-width="${fs(0.4)}" />\n`;
    
    // 그룹 마커 핸들 SVG 추가 (벡터화)
    groups.forEach(g => {
      const edgeY = -circle.r;
      const mRot = g.rotation;
      
      const rp1 = rotAround({x: circle.cx, y: circle.cy + edgeY - 3}, circle.cx, circle.cy, mRot);
      const rp2 = rotAround({x: circle.cx, y: circle.cy + edgeY + 3}, circle.cx, circle.cy, mRot);
      const dLine = getSquareLineD(rp1, rp2, 0.5);
      if(dLine) svg += `  <path d="${dLine}" fill="${g.color}" stroke="none" fill-opacity="0.73" />\n`;
      
      let strStr = String(g.label);
      const mLabelSize = parseFloat(document.getElementById('label-size')?document.getElementById('label-size').value:4) || 4;
      const letterSpacing = 0.8;
      const totalWidth = (strStr.length - 1) * letterSpacing;
      const lxCenter = circle.cx + 4.5 + (totalWidth * mLabelSize) / 2;
      const ly = circle.cy + edgeY + 6;
      const mHw = Math.max(0.2, mLabelSize * 0.08);
      
      const drawText = (textStr, cx, cy, opac) => {
        const tw = (textStr.length - 1) * letterSpacing;
        const sX = cx - (tw * mLabelSize) / 2;
        for(let i=0; i<textStr.length; i++) {
          const char = textStr[i];
          const offsetX = (sX - cx)/mLabelSize + i * letterSpacing;
          if (exportFont === '7seg' && digitSegs[char]) {
            digitSegs[char].forEach(seg => {
              const p1 = { x: cx + (seg[0][0] + offsetX) * mLabelSize, y: cy + seg[0][1] * mLabelSize };
              const p2 = { x: cx + (seg[1][0] + offsetX) * mLabelSize, y: cy + seg[1][1] * mLabelSize };
              const p1Rot = rotAround(p1, circle.cx, circle.cy, mRot);
              const p2Rot = rotAround(p2, circle.cx, circle.cy, mRot);
              const dText = getHexSegmentD(p1Rot, p2Rot, mHw);
              if (dText) svg += `  <path d="${dText}" fill="${g.color}" stroke="none" fill-opacity="${opac}" />\n`;
            });
          } else if ((exportFont === 'vector' || char === '○' || char === '●') && vectorDigits[char]) {
            vectorDigits[char].forEach(stroke => {
              const scaledPoints = stroke.points.map(p => ({
                x: cx + (p.x + offsetX) * mLabelSize,
                y: cy + p.y * mLabelSize,
                inT: { x: p.inT.x * mLabelSize, y: p.inT.y * mLabelSize },
                outT: { x: p.outT.x * mLabelSize, y: p.outT.y * mLabelSize }
              }));
              const mockShape = { closed: stroke.closed, type: 'spline', strokeWidth: mHw * 2, points: scaledPoints, isHollow: stroke.isHollow };
              let dText;
              if (mockShape.isHollow === false && isShapeClosed(mockShape)) {
                  dText = svgNativeSimplePathD(mockShape, mRot, circle.cx, circle.cy);
              } else {
                  dText = svgNativeOffsetPathD(mockShape, mRot, circle.cx, circle.cy);
              }
              if (dText) svg += `  <path d="${dText}" fill="${g.color}" stroke="none" fill-opacity="${opac}" />\n`;
            });
          }
        }
      };

      drawText(strStr, lxCenter, ly, 1);
      
      // Shape Count -> Left
      if (exportCount === 'yes') {
        const count = typeof getGroupShapeCount === 'function' ? getGroupShapeCount(g.id) : shapes.filter(s => s.groupId === g.id && !(s.groupId === GROUP1_ID && !s._isCopy && hasCopy(s.id)) && s.points && s.points.length >= 2).length;
        const countStr = String(count);
        const ctw = (countStr.length - 1) * letterSpacing;
        const cLxCenter = circle.cx - 4.5 - (ctw * mLabelSize) / 2;
        drawText(countStr, cLxCenter, ly, 0.6);
      }
    });
  }

  svg+='</svg>';
  const filename = exportTarget === 'shapes' ? 'rotadraw_shapes.svg' : (exportTarget === 'labels' ? 'rotadraw_labels.svg' : 'rotadraw.svg');
  const blob=new Blob([svg],{type:'image/svg+xml'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();
}

function svgPathD(s) {
  if (s.type === 'spline') {
    const closed = s.closed === true;
    const rawPts = s.points;
    const rn = rawPts.length;
    if (rn < 2) return null;
    const segs = closed ? rn : rn - 1;
    let d = `M ${rawPts[0].x.toFixed(2)} ${rawPts[0].y.toFixed(2)} `;
    for (let i = 0; i < segs; i++) {
      const p0 = rawPts[i], p1 = rawPts[(i + 1) % rn];
      const c0 = {x: p0.x + p0.outT.x, y: p0.y + p0.outT.y};
      const c1 = {x: p1.x + p1.inT.x, y: p1.y + p1.inT.y};
      d += `C ${c0.x.toFixed(2)} ${c0.y.toFixed(2)}, ${c1.x.toFixed(2)} ${c1.y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} `;
    }
    if (closed) d += 'Z';
    return d;
  }
  const closed = s.closed === true;
  const rawPts = s.points;
  if (rawPts.length < 2) return null;
  let d = `M ${rawPts[0].x.toFixed(2)} ${rawPts[0].y.toFixed(2)} `;
  rawPts.slice(1).forEach(p => d += `L ${p.x.toFixed(2)} ${p.y.toFixed(2)} `);
  if (closed) d += 'Z';
  return d;
}

function svgOffsetPathD(pts,closed,hw){
  const n=pts.length;if(n<2)return null;
  const f=v=>v.toFixed(3);
  // Build offset using same logic as buildOffsetPath but output SVG string
  if(!closed){
    const segs=[];
    for(let i=0;i<n-1;i++)segs.push(offsetSeg(pts[i],pts[i+1],hw));
    const L=[segs[0].aL],R=[segs[0].aR];
    for(let i=0;i<segs.length-1;i++){
      const prev=segs[i],next=segs[i+1];
      const dPL={x:prev.bL.x-prev.aL.x,y:prev.bL.y-prev.aL.y};const dNL={x:next.bL.x-next.aL.x,y:next.bL.y-next.aL.y};
      const dPR={x:prev.bR.x-prev.aR.x,y:prev.bR.y-prev.aR.y};const dNR={x:next.bR.x-next.aR.x,y:next.bR.y-next.aR.y};
      L.push(miterJoin(prev.bL,dPL,next.aL,dNL,hw));R.push(miterJoin(prev.bR,dPR,next.aR,dNR,hw));
    }
    L.push(segs[segs.length-1].bL);R.push(segs[segs.length-1].bR);
    let d=`M${f(L[0].x)} ${f(L[0].y)}`;
    L.slice(1).forEach(p=>d+=` L${f(p.x)} ${f(p.y)}`);
    const ep=pts[n-1],a0=Math.atan2(pts[n-1].y-pts[n-2].y,pts[n-1].x-pts[n-2].x);
    for(let i=0;i<=8;i++){const a=a0-Math.PI/2+Math.PI*i/8;d+=` L${f(ep.x+Math.cos(a)*hw)} ${f(ep.y+Math.sin(a)*hw)}`;}
    for(let i=R.length-1;i>=0;i--)d+=` L${f(R[i].x)} ${f(R[i].y)}`;
    const sp=pts[0],a1=Math.atan2(pts[0].y-pts[1].y,pts[0].x-pts[1].x);
    for(let i=0;i<=8;i++){const a=a1-Math.PI/2+Math.PI*i/8;d+=` L${f(sp.x+Math.cos(a)*hw)} ${f(sp.y+Math.sin(a)*hw)}`;}
    return d+' Z';
  } else {
    const segs=[];
    for(let i=0;i<n;i++)segs.push(offsetSeg(pts[i],pts[(i+1)%n],hw));
    const O=[],I=[];
    for(let i=0;i<n;i++){
      const prev=segs[(i-1+n)%n],cur=segs[i];
      const dPL={x:prev.bL.x-prev.aL.x,y:prev.bL.y-prev.aL.y};const dCL={x:cur.bL.x-cur.aL.x,y:cur.bL.y-cur.aL.y};
      const dPR={x:prev.bR.x-prev.aR.x,y:prev.bR.y-prev.aR.y};const dCR={x:cur.bR.x-cur.aR.x,y:cur.bR.y-cur.aR.y};
      O.push(miterJoin(prev.bL,dPL,cur.aL,dCL,hw));I.push(miterJoin(prev.bR,dPR,cur.aR,dCR,hw));
    }
    let d=`M${f(O[0].x)} ${f(O[0].y)}`;O.slice(1).forEach(p=>d+=` L${f(p.x)} ${f(p.y)}`);d+=' Z';
    d+=` M${f(I[n-1].x)} ${f(I[n-1].y)}`;for(let i=n-2;i>=0;i--)d+=` L${f(I[i].x)} ${f(I[i].y)}`;return d+' Z';
  }
}

function exportPNG(){
  document.getElementById('export-modal').style.display='none';
  const targetSel = document.getElementById('export-target');
  const exportTarget = targetSel ? targetSel.value : 'all';
  const filename = exportTarget === 'shapes' ? 'rotadraw_shapes.png' : (exportTarget === 'labels' ? 'rotadraw_labels.png' : 'rotadraw.png');
  
  renderOffscreen(EXPORT_MM, exportTarget).toBlob(b=>{
    const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=filename;a.click();
  });
}

function exportDXF(){
  document.getElementById('export-modal').style.display='none';
  const targetSel = document.getElementById('export-target');
  const exportTarget = targetSel ? targetSel.value : 'all';
  
  const fontSel = document.getElementById('export-font');
  const exportFont = fontSel ? fontSel.value : 'vector';
  
  const countSel = document.getElementById('export-count');
  const exportCount = countSel ? countSel.value : 'yes';
  
  let dxf='0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';
  
  const SVG_SCALE = 96 / 25.4;
  
  const writeLine = (layer, x1, y1, x2, y2) => {
    dxf += `0\nLINE\n8\n${layer}\n`;
    dxf += `10\n${x1.toFixed(4)}\n20\n${(-y1).toFixed(4)}\n`;
    dxf += `11\n${x2.toFixed(4)}\n21\n${(-y2).toFixed(4)}\n`;
  };
  
  const writeBezier = (layer, x1, y1, cx1, cy1, cx2, cy2, x2, y2) => {
    dxf += `0\nSPLINE\n8\n${layer}\n100\nAcDbEntity\n100\nAcDbSpline\n`;
    dxf += `70\n8\n71\n3\n72\n8\n73\n4\n74\n0\n`;
    dxf += `40\n0\n40\n0\n40\n0\n40\n0\n40\n1\n40\n1\n40\n1\n40\n1\n`; 
    dxf += `10\n${x1.toFixed(4)}\n20\n${(-y1).toFixed(4)}\n`;
    dxf += `10\n${cx1.toFixed(4)}\n20\n${(-cy1).toFixed(4)}\n`;
    dxf += `10\n${cx2.toFixed(4)}\n20\n${(-cy2).toFixed(4)}\n`;
    dxf += `10\n${x2.toFixed(4)}\n20\n${(-y2).toFixed(4)}\n`;
  };

  const writeCircle = (layer, cx, cy, r) => {
    dxf += `0\nCIRCLE\n8\n${layer}\n`;
    dxf += `10\n${(cx*SVG_SCALE).toFixed(4)}\n20\n${(-cy*SVG_SCALE).toFixed(4)}\n`;
    dxf += `40\n${(r*SVG_SCALE).toFixed(4)}\n`;
  };

  const writeArc = (layer, cx, cy, r, startAngleRad, endAngleRad) => {
    dxf += `0\nARC\n8\n${layer}\n`;
    dxf += `10\n${(cx*SVG_SCALE).toFixed(4)}\n20\n${(-cy*SVG_SCALE).toFixed(4)}\n`;
    dxf += `40\n${(r*SVG_SCALE).toFixed(4)}\n`;
    let startDeg = (-endAngleRad) * 180 / Math.PI;
    let endDeg = (-startAngleRad) * 180 / Math.PI;
    while(startDeg < 0) startDeg += 360;
    while(startDeg >= 360) startDeg -= 360;
    while(endDeg < 0) endDeg += 360;
    while(endDeg >= 360) endDeg -= 360;
    dxf += `50\n${startDeg.toFixed(4)}\n51\n${endDeg.toFixed(4)}\n`;
  };

  const processSvgPath = (d, layer) => {
    const tokens = d.replace(/,/g, ' ').trim().split(/\s+/);
    let cx = 0, cy = 0;
    let startX = 0, startY = 0;
    let i = 0;
    while(i < tokens.length) {
      const cmd = tokens[i++];
      if (cmd === 'M') {
        cx = parseFloat(tokens[i++]);
        cy = parseFloat(tokens[i++]);
        startX = cx; startY = cy;
      } else if (cmd === 'L') {
        const nx = parseFloat(tokens[i++]);
        const ny = parseFloat(tokens[i++]);
        writeLine(layer, cx, cy, nx, ny);
        cx = nx; cy = ny;
      } else if (cmd === 'C') {
        const cx1 = parseFloat(tokens[i++]);
        const cy1 = parseFloat(tokens[i++]);
        const cx2 = parseFloat(tokens[i++]);
        const cy2 = parseFloat(tokens[i++]);
        const nx = parseFloat(tokens[i++]);
        const ny = parseFloat(tokens[i++]);
        writeBezier(layer, cx, cy, cx1, cy1, cx2, cy2, nx, ny);
        cx = nx; cy = ny;
      } else if (cmd === 'A') {
        const rx = parseFloat(tokens[i++]);
        const ry = parseFloat(tokens[i++]);
        const xAxisRot = parseFloat(tokens[i++]);
        const largeArc = parseFloat(tokens[i++]);
        const sweep = parseFloat(tokens[i++]);
        const nx = parseFloat(tokens[i++]);
        const ny = parseFloat(tokens[i++]);
        
        const mx = (cx + nx) / 2;
        const my = (cy + ny) / 2;
        const dx = nx - cx;
        const dy = ny - cy;
        const len = Math.hypot(dx, dy);
        
        if (len > 1e-4) {
          const perpX = sweep === 0 ? -dy/len * rx : dy/len * rx;
          const perpY = sweep === 0 ? dx/len * rx : -dx/len * rx;
          
          const midPointX = mx + perpX;
          const midPointY = my + perpY;
          
          const kappa = 0.552284749831;
          const c1x = cx + perpX * kappa;
          const c1y = cy + perpY * kappa;
          const c2x = midPointX - (dx/2) * kappa;
          const c2y = midPointY - (dy/2) * kappa;
          writeBezier(layer, cx, cy, c1x, c1y, c2x, c2y, midPointX, midPointY);
          
          const c3x = midPointX + (dx/2) * kappa;
          const c3y = midPointY + (dy/2) * kappa;
          const c4x = nx + perpX * kappa;
          const c4y = ny + perpY * kappa;
          writeBezier(layer, midPointX, midPointY, c3x, c3y, c4x, c4y, nx, ny);
        }
        cx = nx; cy = ny;
      } else if (cmd === 'Z') {
        if (Math.hypot(cx - startX, cy - startY) > 1e-4) {
          writeLine(layer, cx, cy, startX, startY);
        }
        cx = startX; cy = startY;
      }
    }
  };

  if (exportTarget === 'all' || exportTarget === 'shapes') {
    groups.forEach(g=>{
      shapes.filter(s=>s.groupId===g.id&&!(s.groupId===GROUP1_ID&&!s._isCopy&&hasCopy(s.id))).forEach(s=>{
        if(s.points.length >= 2){
          const nativeGeom = getNativeArcsAndCirclesForExport(s, g.rotation, circle.cx, circle.cy);
          if (nativeGeom) {
            nativeGeom.forEach(geom => {
              if (geom.type === 'circle') {
                writeCircle(`G${g.id}_Shapes`, geom.cx, geom.cy, geom.r);
              } else {
                writeArc(`G${g.id}_Shapes`, geom.cx, geom.cy, geom.r, geom.startAngle, geom.endAngle);
              }
            });
            return;
          }

          const dOutline = svgNativeOffsetPathD(s, g.rotation, circle.cx, circle.cy);
          if(dOutline){
            processSvgPath(dOutline, `G${g.id}_Shapes`);
          }
          if (isShapeClosed(s) && isShapeFilled(s)) {
            const dFill = svgNativeSimplePathD(s, g.rotation, circle.cx, circle.cy);
            if (dFill) processSvgPath(dFill, `G${g.id}_Shapes`);
          }
        }
      });
    });
  }

  if (exportTarget === 'all' || exportTarget === 'labels') {
    const labelSize = parseFloat(document.getElementById('label-size').value) || 4;
    const renderedCCs = new Set();
    shapes.forEach(s => {
      if(!s.groupId)return;
      if(s.groupId===GROUP1_ID && !s._isCopy && hasCopy(s.id)) return;
      const g=groups.find(x=>x.id===s.groupId);if(!g)return;
      const targetId = s._isCopy ? s._origId : s.id;
      
      const cc = getConnectedComponent(targetId);
      const ccKey = cc.join(',');
      if (renderedCCs.has(ccKey)) return;
      renderedCCs.add(ccKey);
      
      let sumX = 0, sumY = 0, count = 0;
      cc.forEach(id => {
         const cs = shapes.find(x => (x.id === id || x._origId === id) && x.groupId === s.groupId);
         if (cs) {
           const ctr = shapeCenter(cs);
           sumX += ctr.x; sumY += ctr.y; count++;
         }
      });
      if (count === 0) return;
      const ctr = { x: sumX/count, y: sumY/count };
      
      const rootId = cc[0];
      const lbl=labels[rootId]||{ox:4,oy:-4};
      
      const lx = ctr.x + lbl.ox;
      const ly = ctr.y + lbl.oy;
      
      let strStr = String(g.label);
      if (isCCClosed(targetId)) {
        const rootShape = shapes.find(x => x.id === rootId);
        if (rootShape) {
          strStr = (rootShape.isHollow !== false ? '○' : '●') + strStr;
        }
      }
      const letterSpacing = 0.8;
      const totalWidth = (strStr.length - 1) * letterSpacing;
      const startX = -totalWidth / 2;
      const hw = Math.max(0.2, labelSize * 0.08);
      
      for(let i=0; i<strStr.length; i++) {
        const char = strStr[i];
        const offsetX = startX + i * letterSpacing;
        
        if (exportFont === '7seg' && digitSegs[char]) {
          digitSegs[char].forEach(seg => {
            const p1 = { x: lx + (seg[0][0] + offsetX) * labelSize, y: ly + seg[0][1] * labelSize };
            const p2 = { x: lx + (seg[1][0] + offsetX) * labelSize, y: ly + seg[1][1] * labelSize };
            const rp1 = g.rotation !== 0 ? rotAround(p1, circle.cx, circle.cy, g.rotation) : p1;
            const rp2 = g.rotation !== 0 ? rotAround(p2, circle.cx, circle.cy, g.rotation) : p2;
            const d = getHexSegmentD(rp1, rp2, hw);
            if (d) processSvgPath(d, `G${g.id}_Labels`);
          });
        } else if ((exportFont === 'vector' || char === '○' || char === '●') && vectorDigits[char]) {
          vectorDigits[char].forEach(stroke => {
            const scaledPoints = stroke.points.map(p => ({
              x: lx + (p.x + offsetX) * labelSize,
              y: ly + p.y * labelSize,
              inT: { x: p.inT.x * labelSize, y: p.inT.y * labelSize },
              outT: { x: p.outT.x * labelSize, y: p.outT.y * labelSize }
            }));
            const mockShape = { closed: stroke.closed, type: 'spline', strokeWidth: hw * 2, points: scaledPoints, isHollow: stroke.isHollow };
            let d;
            if (mockShape.isHollow === false && isShapeClosed(mockShape)) {
                d = svgNativeSimplePathD(mockShape, g.rotation, circle.cx, circle.cy);
            } else {
                d = svgNativeOffsetPathD(mockShape, g.rotation, circle.cx, circle.cy);
            }
            if (d) processSvgPath(d, `G${g.id}_Labels`);
          });
        }
      }
    });
    
    // 가이드 원 DXF 추가 (Guide layer)
    writeCircle('Guide', circle.cx, circle.cy, circle.r);
    writeCircle('Guide', circle.cx, circle.cy, centerHandleDiameter/2);
    // Draw cross
    processSvgPath(`M ${circle.cx - 6} ${circle.cy} L ${circle.cx + 6} ${circle.cy}`, 'Guide');
    processSvgPath(`M ${circle.cx} ${circle.cy - 6} L ${circle.cx} ${circle.cy + 6}`, 'Guide');
    writeCircle('Guide', circle.cx, circle.cy, 2.0);
    
    // 그룹 마커 핸들 DXF 추가
    groups.forEach(g => {
      const edgeY = -circle.r;
      const mRot = g.rotation;
      
      const rp1 = rotAround({x: circle.cx, y: circle.cy + edgeY - 3}, circle.cx, circle.cy, mRot);
      const rp2 = rotAround({x: circle.cx, y: circle.cy + edgeY + 3}, circle.cx, circle.cy, mRot);
      const dLine = getSquareLineD(rp1, rp2, 0.5);
      if(dLine) processSvgPath(dLine, `G${g.id}_Labels`);
      
      let strStr = String(g.label);
      const mLabelSize = 3.5;
      const letterSpacing = 0.8;
      const totalWidth = (strStr.length - 1) * letterSpacing;
      const lxCenter = circle.cx + 4.5 + (totalWidth * mLabelSize) / 2;
      const ly = circle.cy + edgeY + 6;
      const mHw = 0.25;
      
      const drawText = (textStr, cx, cy) => {
        const tw = (textStr.length - 1) * letterSpacing;
        const sX = cx - (tw * mLabelSize) / 2;
        for(let i=0; i<textStr.length; i++) {
          const char = textStr[i];
          const offsetX = (sX - cx)/mLabelSize + i * letterSpacing;
          if (exportFont === '7seg' && digitSegs[char]) {
            digitSegs[char].forEach(seg => {
              const p1 = { x: cx + (seg[0][0] + offsetX) * mLabelSize, y: cy + seg[0][1] * mLabelSize };
              const p2 = { x: cx + (seg[1][0] + offsetX) * mLabelSize, y: cy + seg[1][1] * mLabelSize };
              const p1Rot = rotAround(p1, circle.cx, circle.cy, mRot);
              const p2Rot = rotAround(p2, circle.cx, circle.cy, mRot);
              const dText = getHexSegmentD(p1Rot, p2Rot, mHw);
              if (dText) processSvgPath(dText, `G${g.id}_Labels`);
            });
          } else if ((exportFont === 'vector' || char === '○' || char === '●') && vectorDigits[char]) {
            vectorDigits[char].forEach(stroke => {
              const scaledPoints = stroke.points.map(p => ({
                x: cx + (p.x + offsetX) * mLabelSize,
                y: cy + p.y * mLabelSize,
                inT: { x: p.inT.x * mLabelSize, y: p.inT.y * mLabelSize },
                outT: { x: p.outT.x * mLabelSize, y: p.outT.y * mLabelSize }
              }));
              const mockShape = { closed: stroke.closed, type: 'spline', strokeWidth: mHw * 2, points: scaledPoints, isHollow: stroke.isHollow };
              let dText;
              if (mockShape.isHollow === false && isShapeClosed(mockShape)) {
                  dText = svgNativeSimplePathD(mockShape, mRot, circle.cx, circle.cy);
              } else {
                  dText = svgNativeOffsetPathD(mockShape, mRot, circle.cx, circle.cy);
              }
              if (dText) processSvgPath(dText, `G${g.id}_Labels`);
            });
          }
        }
      };

      drawText(strStr, lxCenter, ly);
      
      // Shape Count -> Left
      if (exportCount === 'yes') {
        const count = typeof getGroupShapeCount === 'function' ? getGroupShapeCount(g.id) : shapes.filter(s => s.groupId === g.id && !(s.groupId === GROUP1_ID && !s._isCopy && hasCopy(s.id)) && s.points && s.points.length >= 2).length;
        const countStr = String(count);
        const ctw = (countStr.length - 1) * letterSpacing;
        const cLxCenter = circle.cx - 4.5 - (ctw * mLabelSize) / 2;
        drawText(countStr, cLxCenter, ly);
      }
    });
  }

  dxf+='0\nENDSEC\n0\nEOF\n';
  const filename = exportTarget === 'shapes' ? 'rotadraw_shapes.dxf' : (exportTarget === 'labels' ? 'rotadraw_labels.dxf' : 'rotadraw.dxf');
  const blob=new Blob([dxf],{type:'application/dxf'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();
}

function exportPDF(){
  document.getElementById('export-modal').style.display='none';
  const targetSel = document.getElementById('export-target');
  const exportTarget = targetSel ? targetSel.value : 'all';
  
  const oc=renderOffscreen(EXPORT_MM, exportTarget);
  const url=oc.toDataURL('image/png');
  const win=window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><style>@page{size:${paperGuide.w}mm ${paperGuide.h}mm;margin:0}body{margin:0}img{width:${paperGuide.w}mm;height:${paperGuide.h}mm}</style></head><body><img src="${url}"></body></html>`);
  win.document.close();win.onload=()=>win.print();
}