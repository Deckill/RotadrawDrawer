async function saveProject(){
  const data={version:4,canvasW,canvasH,baseW,baseH,circle,shapes,groups,nextGroupId,labels,strokeWidth,bgColor:document.getElementById('cv-bg').value};
  const jsonStr = JSON.stringify(data, null, 2);
  
  if (window.showSaveFilePicker && currentFileHandle) {
    try {
      const options = { mode: 'readwrite' };
      if ((await currentFileHandle.queryPermission(options)) !== 'granted') {
        if ((await currentFileHandle.requestPermission(options)) !== 'granted') {
          alert('저장 권한이 거부되었습니다.');
          return;
        }
      }
      const writable = await currentFileHandle.createWritable();
      await writable.write(jsonStr);
      await writable.close();
    } catch (err) {
      console.warn('기존 파일 덮어쓰기 실패, 다른 이름으로 저장을 시도합니다.', err);
      await saveProjectAs();
    }
  } else {
    await saveProjectAs();
  }
}

async function saveProjectAs(){
  const data={version:4,canvasW,canvasH,baseW,baseH,circle,shapes,groups,nextGroupId,labels,strokeWidth,bgColor:document.getElementById('cv-bg').value};
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
        alert('저장 오류: ' + err.message);
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
  labels=d.labels||{};strokeWidth=d.strokeWidth||1;activeDrawGroupId=groups.find(g=>g.id===GROUP1_ID)?.id || groups[0].id;
  document.getElementById('cv-w').value=canvasW;document.getElementById('cv-h').value=canvasH;
  document.getElementById('cv-bg').value=d.bgColor||'#ffffff';
  document.getElementById('circle-d').value=(circle.r*2).toFixed(1);
  document.getElementById('sw-num').value=strokeWidth.toFixed(2);document.getElementById('sw-range').value=strokeWidth;
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
        alert('불러오기 오류: ' + err.message);
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
    }catch(err){alert('파일 오류: '+err.message);}
  };
  rd.readAsText(file);e.target.value='';
}

function showExportModal(){document.getElementById('export-modal').style.display='flex';}

function renderOffscreen(mmScale){
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
        oc2.lineWidth = (s.strokeWidth || strokeWidth) * mmScale;
        oc2.stroke();
      } else {
        oc2.strokeStyle = color;
        oc2.lineWidth = (s.strokeWidth || strokeWidth) * mmScale;
        oc2.stroke();
      }
    }
    oc2.restore();
  });
  
  // 가이드 원 오프스크린 렌더링 추가
  const circleCx = circle.cx * mmScale, circleCy = circle.cy * mmScale, circleR = circle.r * mmScale;
  oc2.save();
  oc2.strokeStyle = '#4488ffaa'; oc2.lineWidth = 0.5 * mmScale;
  oc2.setLineDash([5 * mmScale, 5 * mmScale]);
  oc2.beginPath(); oc2.arc(circleCx, circleCy, circleR, 0, Math.PI*2); oc2.stroke();
  oc2.setLineDash([]);
  oc2.fillStyle = '#4488ffcc'; oc2.beginPath(); oc2.arc(circleCx, circleCy, 2.5 * mmScale, 0, Math.PI*2); oc2.fill();
  oc2.restore();
  
  // 그룹 마커 핸들 오프스크린 렌더링 추가
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
    
    // Label to the right
    oc2.fillStyle = '#fff';
    oc2.font = `bold ${3.5 * mmScale}px sans-serif`;
    oc2.textAlign = 'left'; oc2.textBaseline = 'middle';
    oc2.fillText(g.label, mTangHalf + 4 * mmScale, edgeY);
    oc2.restore();
  });

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
    const shrink = 0.12; // 0.1로 늘리되 두께 고려하여 조금 더 넉넉하게 0.12로 적용
    const nx = dx/len * shrink;
    const ny = dy/len * shrink;
    return [
      [seg[0][0] + nx, seg[0][1] + ny],
      [seg[1][0] - nx, seg[1][1] - ny]
    ];
  });
}

function svgNativeOffsetPathD(s, rot, cx, cy) {
  const SVG_SCALE = 96 / 25.4;
  const f = v => (v * SVG_SCALE).toFixed(3);
  const hw = (s.strokeWidth || strokeWidth) / 2;
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

  for(let i=1; i<segs; i++) {
    const midO = {x: (outerSegs[i-1].q3.x + outerSegs[i].q0.x)/2, y: (outerSegs[i-1].q3.y + outerSegs[i].q0.y)/2};
    outerSegs[i-1].q3 = midO; outerSegs[i].q0 = midO;
    const midI = {x: (innerSegs[i-1].q3.x + innerSegs[i].q0.x)/2, y: (innerSegs[i-1].q3.y + innerSegs[i].q0.y)/2};
    innerSegs[i-1].q3 = midI; innerSegs[i].q0 = midI;
  }
  if(closed) {
    const midO = {x: (outerSegs[segs-1].q3.x + outerSegs[0].q0.x)/2, y: (outerSegs[segs-1].q3.y + outerSegs[0].q0.y)/2};
    outerSegs[segs-1].q3 = midO; outerSegs[0].q0 = midO;
    const midI = {x: (innerSegs[segs-1].q3.x + innerSegs[0].q0.x)/2, y: (innerSegs[segs-1].q3.y + innerSegs[0].q0.y)/2};
    innerSegs[segs-1].q3 = midI; innerSegs[0].q0 = midI;
  }

  let d = '';

  if(!closed) {
    d += `M ${f(outerSegs[0].q0.x)} ${f(outerSegs[0].q0.y)} `;
    for(let i=0; i<segs; i++) {
      const o = outerSegs[i];
      if(isLine) d += `L ${f(o.q3.x)} ${f(o.q3.y)} `;
      else d += `C ${f(o.q1.x)} ${f(o.q1.y)}, ${f(o.q2.x)} ${f(o.q2.y)}, ${f(o.q3.x)} ${f(o.q3.y)} `;
    }
    const endI = innerSegs[segs-1].q3;
    d += `A ${f(hw)} ${f(hw)} 0 0 0 ${f(endI.x)} ${f(endI.y)} `;
    
    for(let i=segs-1; i>=0; i--) {
      const inn = innerSegs[i];
      if(isLine) d += `L ${f(inn.q0.x)} ${f(inn.q0.y)} `;
      else d += `C ${f(inn.q2.x)} ${f(inn.q2.y)}, ${f(inn.q1.x)} ${f(inn.q1.y)}, ${f(inn.q0.x)} ${f(inn.q0.y)} `;
    }
    const startO = outerSegs[0].q0;
    d += `A ${f(hw)} ${f(hw)} 0 0 0 ${f(startO.x)} ${f(startO.y)} Z`;
  } else {
    d += `M ${f(outerSegs[0].q0.x)} ${f(outerSegs[0].q0.y)} `;
    for(let i=0; i<segs; i++) {
      const o = outerSegs[i];
      if(isLine) d += `L ${f(o.q3.x)} ${f(o.q3.y)} `;
      else d += `C ${f(o.q1.x)} ${f(o.q1.y)}, ${f(o.q2.x)} ${f(o.q2.y)}, ${f(o.q3.x)} ${f(o.q3.y)} `;
    }
    d += 'Z ';
    
    d += `M ${f(innerSegs[segs-1].q3.x)} ${f(innerSegs[segs-1].q3.y)} `;
    for(let i=segs-1; i>=0; i--) {
      const inn = innerSegs[i];
      if(isLine) d += `L ${f(inn.q0.x)} ${f(inn.q0.y)} `;
      else d += `C ${f(inn.q2.x)} ${f(inn.q2.y)}, ${f(inn.q1.x)} ${f(inn.q1.y)}, ${f(inn.q0.x)} ${f(inn.q0.y)} `;
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

function exportSVG(){
  document.getElementById('export-modal').style.display='none';
  const targetSel = document.getElementById('export-target');
  const exportTarget = targetSel ? targetSel.value : 'all'; // 'all', 'shapes', 'labels'
  
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
          const d = svgNativeOffsetPathD(s, g.rotation, circle.cx, circle.cy);
          if(d){
            svg+=`  <path d="${d}" fill="${g.color}" stroke="none" />\n`;
          }
        }
      });
    });
  }

  if (exportTarget === 'all' || exportTarget === 'labels') {
    // 숫자 레이블 SVG 추가 (모든 복제 그룹 포함, 벡터화)
    const labelSize = parseFloat(document.getElementById('label-size').value) || 4;
    shapes.forEach(s => {
      if(!s.groupId)return;
      if(s.groupId===GROUP1_ID && !s._isCopy && hasCopy(s.id)) return;
      const g=groups.find(x=>x.id===s.groupId);if(!g)return;
      const targetId = s._isCopy ? s._origId : s.id;
      const lbl=labels[targetId]||{ox:4,oy:-4};
      const ctr = shapeCenter(s);
      
      const lx = ctr.x + lbl.ox;
      const ly = ctr.y + lbl.oy;
      
      const strStr = String(g.label);
      const letterSpacing = 0.8;
      const totalWidth = (strStr.length - 1) * letterSpacing;
      const startX = -totalWidth / 2;
      const hw = Math.max(0.2, labelSize * 0.08); // 레이블 굵기
      
      for(let i=0; i<strStr.length; i++) {
        const char = strStr[i];
        if (digitSegs[char]) {
          const offsetX = startX + i * letterSpacing;
          digitSegs[char].forEach(seg => {
            const p1 = { x: lx + (seg[0][0] + offsetX) * labelSize, y: ly + seg[0][1] * labelSize };
            const p2 = { x: lx + (seg[1][0] + offsetX) * labelSize, y: ly + seg[1][1] * labelSize };
            const rp1 = g.rotation !== 0 ? rotAround(p1, circle.cx, circle.cy, g.rotation) : p1;
            const rp2 = g.rotation !== 0 ? rotAround(p2, circle.cx, circle.cy, g.rotation) : p2;
            const d = getSquareLineD(rp1, rp2, hw);
            if (d) svg += `  <path d="${d}" fill="${g.color}" stroke="none" />\n`;
          });
        }
      }
    });
    
    // 가이드 원 SVG 추가 (중심 원 실선)
    svg += `<circle cx="${fs(circle.cx)}" cy="${fs(circle.cy)}" r="${fs(circle.r)}" stroke="#4488ff" stroke-opacity="0.67" stroke-width="${fs(0.5)}" stroke-dasharray="${fs(5)},${fs(5)}" fill="none" />\n`;
    svg += `<circle cx="${fs(circle.cx)}" cy="${fs(circle.cy)}" r="${fs(2.5)}" fill="#4488ff" fill-opacity="0.8" stroke="#4488ff" stroke-width="${fs(0.4)}" />\n`;
    
    // 그룹 마커 핸들 SVG 추가 (벡터화)
    groups.forEach(g => {
      const edgeY = -circle.r;
      const mRot = g.rotation;
      
      const rp1 = rotAround({x: circle.cx, y: circle.cy + edgeY - 3}, circle.cx, circle.cy, mRot);
      const rp2 = rotAround({x: circle.cx, y: circle.cy + edgeY + 3}, circle.cx, circle.cy, mRot);
      const dLine = getSquareLineD(rp1, rp2, 0.5);
      if(dLine) svg += `  <path d="${dLine}" fill="${g.color}" stroke="none" fill-opacity="0.73" />\n`;
      
      const strStr = String(g.label);
      const mLabelSize = 3.5;
      const letterSpacing = 0.8;
      const totalWidth = (strStr.length - 1) * letterSpacing;
      const lxCenter = circle.cx + 4.5 + (totalWidth * mLabelSize) / 2;
      const ly = circle.cy + edgeY;
      const mHw = 0.25;
      
      for(let i=0; i<strStr.length; i++) {
        const char = strStr[i];
        if (digitSegs[char]) {
          const offsetX = -totalWidth/2 + i * letterSpacing;
          digitSegs[char].forEach(seg => {
            const p1 = { x: lxCenter + (seg[0][0] + offsetX) * mLabelSize, y: ly + seg[0][1] * mLabelSize };
            const p2 = { x: lxCenter + (seg[1][0] + offsetX) * mLabelSize, y: ly + seg[1][1] * mLabelSize };
            const p1Rot = rotAround(p1, circle.cx, circle.cy, mRot);
            const p2Rot = rotAround(p2, circle.cx, circle.cy, mRot);
            const dText = getSquareLineD(p1Rot, p2Rot, mHw);
            if (dText) svg += `  <path d="${dText}" fill="${g.color}" stroke="none" />\n`;
          });
        }
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

function exportDXF(){
  document.getElementById('export-modal').style.display='none';
  let dxf='0\nSECTION\n2\nHEADER\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n';
  shapes.forEach(s=>{
    if(s.groupId===GROUP1_ID&&!s._isCopy&&hasCopy(s.id))return;
    const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
    const{pts}=getPolyline(s);if(pts.length<2)return;
    const rp=pts.map(p=>g?rotAround(p,circle.cx,circle.cy,g.rotation):p);
    dxf+=`0\nLWPOLYLINE\n8\nG${s.groupId||0}\n70\n${isShapeClosed(s)?1:0}\n`;
    rp.forEach(p=>{dxf+=`10\n${p.x.toFixed(4)}\n20\n${(-p.y).toFixed(4)}\n`;});
  });
  dxf+='0\nENDSEC\n0\nEOF\n';
  const blob=new Blob([dxf],{type:'application/dxf'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rotadraw.dxf';a.click();
}

function exportPDF(){
  document.getElementById('export-modal').style.display='none';
  const oc=renderOffscreen(EXPORT_MM);
  const url=oc.toDataURL('image/png');
  const win=window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><style>@page{size:${paperGuide.w}mm ${paperGuide.h}mm;margin:0}body{margin:0}img{width:${paperGuide.w}mm;height:${paperGuide.h}mm}</style></head><body><img src="${url}"></body></html>`);
  win.document.close();win.onload=()=>win.print();
}