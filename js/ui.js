function showContextMenu(e, items){
  const cm = document.getElementById('context-menu');
  cm.innerHTML = '';
  items.forEach(item => {
    const btn = document.createElement('div');
    btn.textContent = item.label;
    btn.style.padding = '6px 12px';
    btn.style.fontSize = '12px';
    btn.style.color = '#eee';
    btn.style.cursor = 'pointer';
    btn.onmouseenter = () => btn.style.background = '#1a5a9a';
    btn.onmouseleave = () => btn.style.background = 'transparent';
    btn.onclick = (ev) => {
      ev.stopPropagation();
      item.action();
      cm.style.display = 'none';
    };
    cm.appendChild(btn);
  });
  cm.style.left = e.clientX + 'px';
  cm.style.top = e.clientY + 'px';
  cm.style.display = 'block';
}

function deleteSelectedShape(){
  if(selShapeId!==null){shapes=shapes.filter(s=>s.id!==selShapeId);selShapeId=null;selPtIdx=null;dragState=null;}
  render();
}

function clearAllShapes(){if(confirm('모든 도형을 삭제할까요?')){shapes=[];selShapeId=null;selPtIdx=null;render();}}

function updatePropsPanel(){
  if(selShapeId===null){document.getElementById('props-content').textContent='선택 없음';return;}
  const s=shapes.find(x=>x.id===selShapeId);if(!s)return;
  const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
  let h=`<b>도형 #${s.id}</b><br>타입: ${s.type}<br>두께: ${(s.strokeWidth||strokeWidth).toFixed(2)}mm<br>그룹: ${g?'그룹'+g.label:'없음'}<br>점수: ${isShapeClosed(s)?s.points.length-1:s.points.length}`;
  if(selPtIdx!==null&&s.points[selPtIdx]){
    const p=s.points[selPtIdx];
    h+=`<br><br><b>??${selPtIdx}</b><br>x: ${p.x.toFixed(2)}<br>y: ${p.y.toFixed(2)}`;
    if(s.type==='spline')h+=`<br><small style="color:#666">핸들 세부 보기<br>orange=입력, green=출력</small>`;
  }
  document.getElementById('props-content').innerHTML=h;
}

function updateCursor(){
  if(currentMode==='draw'&&drawTool!=='select')mainCanvas.style.cursor='crosshair';
  else mainCanvas.style.cursor='default';
}

function setMode(m){
  if(drawing)finishDrawing();
  currentMode=m;
  ['canvas','draw','arrange','label'].forEach(mm=>{
    document.getElementById('mode-'+mm).classList.toggle('active',mm===m);
    const p=document.getElementById('panel-'+mm);if(p)p.style.display=mm===m?'':'none';
  });
  document.getElementById('sb-mode').textContent='모드: '+MODE_NAMES[m];
  selShapeId=null;selPtIdx=null;selHandle=null;dragState=null;
  arrSelShapeId=null;arrDragState=null;hoverPtRef=null;lblDrag=null;
  updateCursor();render();
}

function setDrawTool(t){
  if(drawing)finishDrawing();
  drawTool=t;
  ['spline','line','select'].forEach(tt=>document.getElementById('tool-'+tt).classList.toggle('active',tt===t));
  selShapeId=null;selPtIdx=null;selHandle=null;dragState=null;hoverPtRef=null;
  updateCursor();render();
}

function onPaperSizeChange(val) {
  if (val === 'Custom') {
    document.getElementById('cv-w').disabled = false;
    document.getElementById('cv-h').disabled = false;
  } else {
    document.getElementById('cv-w').disabled = true;
    document.getElementById('cv-h').disabled = true;
    if (val === 'A4') { paperGuide.w = 210; paperGuide.h = 297; }
    else if (val === 'A3') { paperGuide.w = 297; paperGuide.h = 420; }
    else if (val === 'Letter') { paperGuide.w = 215.9; paperGuide.h = 279.4; }
    document.getElementById('cv-w').value = paperGuide.w;
    document.getElementById('cv-h').value = paperGuide.h;
  }
  paperGuide.size = val;
  canvasW = paperGuide.w;
  canvasH = paperGuide.h;
  paperGuide.cx = canvasW / 2;
  paperGuide.cy = canvasH / 2;
  paperGuide.rotation = 0;
  circle.cx = canvasW / 2;
  circle.cy = canvasH / 2;
  setCanvasSize();
  render();
}

function onCustomPaperWH(axis, val) {
  const v = parseFloat(val);
  if (!isNaN(v) && v > 0) {
    if (axis === 'w') { paperGuide.w = v; canvasW = v; }
    if (axis === 'h') { paperGuide.h = v; canvasH = v; }
    paperGuide.cx = canvasW / 2;
    paperGuide.cy = canvasH / 2;
    paperGuide.rotation = 0;
    circle.cx = canvasW / 2;
    circle.cy = canvasH / 2;
    setCanvasSize();
    render();
  }
}

function importImage(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => onImageObjectLoaded(img);
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function onImageObjectLoaded(img) {
  // Load image at 60% of paper guide size to show it is a selectable object
  let w = paperGuide.w * 0.6;
  let h = w * img.height / img.width;
  if (h > paperGuide.h * 0.6) {
    h = paperGuide.h * 0.6;
    w = h * img.width / img.height;
  }
  images.push({
    id: nextImgId++,
    img: img,
    cx: paperGuide.cx,
    cy: paperGuide.cy,
    w: w,
    h: h,
    rotation: 0
  });
  render();
}

function circleFromInput() { circle.r=(parseFloat(document.getElementById('circle-d').value)||150)/2; render(); }

function initDefaultGroup() {
  groups=[{id:GROUP1_ID,label:1,color:GCOLORS[0],rotation:0,locked:true}];
  activeDrawGroupId=GROUP1_ID;
}

function addGroup() {
  const g={id:nextGroupId++,label:groups.length+1,color:GCOLORS[groups.length%GCOLORS.length],rotation:0,locked:false};
  groups.push(g); refreshGroupList(); render();
}

function deleteGroup(id) {
  if(id===GROUP1_ID)return;
  shapes=shapes.filter(s=>!(s.groupId===id&&s._isCopy));
  groups=groups.filter(g=>g.id!==id);
  refreshGroupList(); render();
}

function hasCopy(origId)  { return shapes.some(s=>s._origId===origId); }

function makeCopy(orig, targetGid) {
  shapes=shapes.filter(s=>!(s._origId===orig.id&&s.groupId===targetGid));
  const c=JSON.parse(JSON.stringify(orig));
  c.id=nextShapeId++; c._isCopy=true; c._origId=orig.id; c.groupId=targetGid;
  shapes.push(c); return c;
}

function removeCopy(origId, targetGid) { shapes=shapes.filter(s=>!(s._origId===origId&&s.groupId===targetGid)); }

function refreshGroupList() {
  // Arrange list
  const list=document.getElementById('group-list');
  list.innerHTML='';
  groups.forEach(g=>{
    const d=document.createElement('div');
    d.className='group-item';
    const delHtml=g.locked?`<span class="group-del locked">잠금</span>`:`<span class="group-del" onclick="deleteGroup(${g.id});event.stopPropagation()">✕</span>`;
    d.innerHTML=`<div class="group-color-dot" style="background:${g.color}"></div><span style="flex:1">그룹 ${g.label}</span><input type="number" value="${g.rotation}" min="-360" max="360" style="width:55px" oninput="setGroupRotation(${g.id},this.value)" onclick="event.stopPropagation()">${delHtml}`;
    list.appendChild(d);
  });
  // Label panel
  const ll=document.getElementById('label-group-list');
  ll.innerHTML='';
  groups.forEach(g=>{
    const row=document.createElement('div');
    row.className='input-row';
    row.innerHTML=`<div class="group-color-dot" style="background:${g.color}"></div><span style="flex:1;font-size:12px">그룹 ${g.label}</span><input type="number" value="${g.label}" min="1" max="999" style="width:48px;background:#0f3460;border:1px solid #1a4a7a;border-radius:3px;color:#eee;padding:3px;font-size:12px;flex:none" onchange="setGroupLabel(${g.id},this.value)">`;
    ll.appendChild(row);
  });
}

function setGroupLabel(id,v){const g=groups.find(x=>x.id===id);if(g){g.label=parseInt(v)||g.label;render();}}

function onSwRange(v){
  strokeWidth=parseFloat(v);
  document.getElementById('sw-num').value=strokeWidth.toFixed(2);
  shapes.forEach(s=>s.strokeWidth=strokeWidth);
  render();
}

function onSwNum(v){
  strokeWidth=Math.max(0.5,Math.min(2,parseFloat(v)||1));
  document.getElementById('sw-range').value=strokeWidth;
  shapes.forEach(s=>s.strokeWidth=strokeWidth);
  render();
}

function onImageFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => onImageObjectLoaded(img);
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}