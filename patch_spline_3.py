import re

with open('rotadraw.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace renderBezierHandles and related
replacement = '''
function getHandlePositions(s, ptIdx) {
  if(!s||s.type!=='spline')return{out:null,inn:null};
  const p = s.points[ptIdx];
  if (!p) return {out:null,inn:null};
  const outH = {x: p.x + p.outT.x, y: p.y + p.outT.y};
  const inH = {x: p.x + p.inT.x, y: p.y + p.inT.y};
  return {out: outH, inn: inH};
}

function hitHandle(pos,s,ptIdx,side){
  if(!s||s.type!=='spline')return false;
  const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
  const pLocal = g ? rotAround(pos, circle.cx, circle.cy, -g.rotation) : pos;
  const{out:outH,inn:inH}=getHandlePositions(s,ptIdx);
  const h=side==='out'?outH:inH;
  if(!h)return false;
  const dx=pLocal.x-h.x,dy=pLocal.y-h.y;
  return dx*dx+dy*dy<25; // 5mm radius
}

let currentCurvature = null;

function renderBezierHandles(sc){
  const s=shapes.find(x=>x.id===selShapeId);
  if(!s||s.type!=='spline'||selPtIdx===null)return;
  const p=s.points[selPtIdx];
  const{out:outH,inn:inH}=getHandlePositions(s,selPtIdx);
  ctx.save();
  ctx.setLineDash([2,2]);ctx.lineWidth=1;
  
  if(inH){
    ctx.strokeStyle='#ff9900aa';
    ctx.beginPath();ctx.moveTo(p.x*sc,p.y*sc);ctx.lineTo(inH.x*sc,inH.y*sc);ctx.stroke();
    const isDragging=dragState?.type==='cpIn';
    ctx.beginPath();ctx.arc(inH.x*sc,inH.y*sc,isDragging?7:5,0,Math.PI*2);
    ctx.fillStyle='#ff9900';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();
  }
  if(outH){
    ctx.strokeStyle='#00dd88aa';
    ctx.beginPath();ctx.moveTo(p.x*sc,p.y*sc);ctx.lineTo(outH.x*sc,outH.y*sc);ctx.stroke();
    const isDragging=dragState?.type==='cpOut';
    ctx.beginPath();ctx.arc(outH.x*sc,outH.y*sc,isDragging?7:5,0,Math.PI*2);
    ctx.fillStyle='#00dd88';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();
  }
  ctx.setLineDash([]);
  // Labels
  ctx.fillStyle='#fff';ctx.font='10px sans-serif';
  if(inH) ctx.fillText('in',inH.x*sc+7,inH.y*sc-7);
  if(outH)ctx.fillText('out',outH.x*sc+7,outH.y*sc-7);
  
  if (currentCurvature) {
    ctx.strokeStyle = '#ffff0088';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(currentCurvature.cx * sc, currentCurvature.cy * sc, currentCurvature.R * sc, 0, Math.PI*2);
    ctx.stroke();
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.arc(currentCurvature.cx * sc, currentCurvature.cy * sc, 3, 0, Math.PI*2);
    ctx.fill();
    ctx.setLineDash([]);
  }
  ctx.restore();
}
'''

# Find getHandlePositions
start_idx = html.find('function getHandlePositions(s, ptIdx)')
end_idx = html.find('function renderCircle(sc)')

if start_idx != -1 and end_idx != -1:
    html = html[:start_idx] + replacement + '\n' + html[end_idx:]

with open('rotadraw.html', 'w', encoding='utf-8') as f:
    f.write(html)
