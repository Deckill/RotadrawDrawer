import re

with open('rotadraw.html', 'r', encoding='utf-8') as f:
    html = f.read()

# I will find the second hitHandle and remove it
match = re.search(r'function hitHandle\(pos,s,ptIdx,side\)\{\n    if\(!s\|\|s\.type!==\'spline\'\)return false;\n    const g=s\.groupId\?groups\.find\(x=>x\.id===s\.groupId\):null;\n    const pLocal = g \? rotAround\(pos, circle\.cx, circle\.cy, -g\.rotation\) : pos;\n    const\{out:outH,inn:inH\}=getHandlePositions\(s,ptIdx\);\n    const h=side===\'out\'\?outH:inH;\n    if\(!h\)return false;\n    return Math\.hypot\(pLocal\.x-h\.x,pLocal\.y-h\.y\)<Math\.max\(2,6/viewScale\);\n  }', html)

if match:
    html = html[:match.start()] + html[match.end():]

# Clean up any potential duplicate getHandlePositions
# The old getHandlePositions was:
# function getHandlePositions(s, ptIdx) {
#   if(!s||s.type!=='spline')return{out:null,inn:null};
#   const closed=isShapeClosed(s);
#   const rawPts=s.points;
#   const rn=rawPts.length;
#   const auto=autoHandles(rawPts,closed);
#   const cps=s.cps||[];
#   let outH=null,inH=null;
#   ...
match_get = re.search(r'function getHandlePositions\(s, ptIdx\) \{\n    const closed=isShapeClosed\(s\);', html)
if match_get:
    # Actually wait, the old one was:
    # function getHandlePositions(s, ptIdx) {
    #   if(!s||s.type!=='spline')return{out:null,inn:null};
    #   const closed=isShapeClosed(s);
    pass

# A safer way: Just use string replacement for the specific old function block if it still exists.
old_hitHandle = '''function hitHandle(pos,s,ptIdx,side){
    if(!s||s.type!=='spline')return false;
    const g=s.groupId?groups.find(x=>x.id===s.groupId):null;
    const pLocal = g ? rotAround(pos, circle.cx, circle.cy, -g.rotation) : pos;
    const{out:outH,inn:inH}=getHandlePositions(s,ptIdx);
    const h=side==='out'?outH:inH;
    if(!h)return false;
    return Math.hypot(pLocal.x-h.x,pLocal.y-h.y)<Math.max(2,6/viewScale);
  }'''

html = html.replace(old_hitHandle, '')

with open('rotadraw.html', 'w', encoding='utf-8') as f:
    f.write(html)
