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

function exportSVG(){
  document.getElementById('export-modal').style.display='none';
  const bounds = getGlobalBounds();
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}" width="${bounds.w}mm" height="${bounds.h}mm">\n`;
  svg+=`<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}" fill="${document.getElementById('cv-bg').value}"/>\n`;
  images.forEach(img => {
    svg += `<image x="${img.cx - img.w/2}" y="${img.cy - img.h/2}" width="${img.w}" height="${img.h}" href="${img.img.src}" transform="rotate(${img.rotation} ${img.cx} ${img.cy})" />\n`;
  });
  groups.forEach(g=>{
    svg+=`<g transform="rotate(${g.rotation},${circle.cx},${circle.cy})">\n`;
    shapes.filter(s=>s.groupId===g.id&&!(s.groupId===GROUP1_ID&&!s._isCopy&&hasCopy(s.id))).forEach(s=>{
      const d=svgPathD(s);
      if(d){
        const sw = s.strokeWidth || strokeWidth;
        if(s.closed){
          svg+=`  <path d="${d}" fill="${g.color}" stroke="${g.color}" stroke-width="${sw}" stroke-linejoin="miter" />\n`;
        } else {
          svg+=`  <path d="${d}" fill="none" stroke="${g.color}" stroke-width="${sw}" stroke-linejoin="miter" stroke-linecap="round" />\n`;
        }
      }
    });
    svg+=`</g>\n`;
  });
  
  // 가이드 원 SVG 추가 (중심 원 실선)
  svg += `<circle cx="${circle.cx.toFixed(2)}" cy="${circle.cy.toFixed(2)}" r="${circle.r.toFixed(2)}" stroke="#4488ff" stroke-opacity="0.67" stroke-width="0.5" stroke-dasharray="5,5" fill="none" />\n`;
  svg += `<circle cx="${circle.cx.toFixed(2)}" cy="${circle.cy.toFixed(2)}" r="2.5" fill="#4488ff" fill-opacity="0.8" stroke="#4488ff" stroke-width="0.4" />\n`;
  
  // 그룹 마커 핸들 SVG 추가
  groups.forEach(g => {
    const edgeY = -circle.r;
    svg += `  <g transform="rotate(${g.rotation}, ${circle.cx}, ${circle.cy})">\n`;
    svg += `    <rect x="-0.5" y="${(edgeY - 3).toFixed(2)}" width="1" height="6" fill="${g.color}" fill-opacity="0.73" stroke="${g.color}" stroke-width="0.5" />\n`;
    svg += `    <text x="4.5" y="${edgeY.toFixed(2)}" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="3.5" dominant-baseline="middle" text-anchor="start">${g.label}</text>\n`;
    svg += `  </g>\n`;
  });

  svg+='</svg>';
  const blob=new Blob([svg],{type:'image/svg+xml'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='rotadraw.svg';a.click();
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