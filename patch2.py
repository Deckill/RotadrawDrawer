import re

with open('rotadraw.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Replace renderOffscreen
old_offscreen = '''  function renderOffscreen(scale){
    const oc=document.createElement('canvas');
    oc.width=Math.round(canvasW*scale);oc.height=Math.round(canvasH*scale);
    const oc2=oc.getContext('2d');
    oc2.fillStyle=document.getElementById('cv-bg').value;oc2.fillRect(0,0,oc.width,oc.height);
    if(bgImage)oc2.drawImage(bgImage,0,0,oc.width,oc.height);
    shapes.forEach(s=>{
      if(s.groupId===GROUP1_ID&&!s._isCopy&&hasCopy(s.id))return;
      renderShape(s,scale,false,oc2);
    });
    return oc;
  }'''

new_offscreen = '''  function renderOffscreen(scale){
    const oc=document.createElement('canvas');
    oc.width=Math.round(paperGuide.w*scale);oc.height=Math.round(paperGuide.h*scale);
    const oc2=oc.getContext('2d');
    oc2.fillStyle=document.getElementById('cv-bg').value;oc2.fillRect(0,0,oc.width,oc.height);
    
    oc2.save();
    oc2.translate(oc.width/2, oc.height/2);
    oc2.rotate(-paperGuide.rotation * Math.PI / 180);
    oc2.translate(-paperGuide.cx * scale, -paperGuide.cy * scale);
    
    images.forEach(img => {
       oc2.save();
       oc2.translate(img.cx * scale, img.cy * scale);
       oc2.rotate(img.rotation * Math.PI / 180);
       oc2.drawImage(img.img, -img.w/2 * scale, -img.h/2 * scale, img.w * scale, img.h * scale);
       oc2.restore();
    });
    
    shapes.forEach(s=>{
      if(s.groupId===GROUP1_ID&&!s._isCopy&&hasCopy(s.id))return;
      renderShape(s,scale,false,oc2);
    });
    
    oc2.restore();
    return oc;
  }'''
text = text.replace(old_offscreen, new_offscreen)

# 2. Replace exportPDF window open
old_pdf = '''win.document.write(<!DOCTYPE html><html><head><style>@page{size:mm mm;margin:0}body{margin:0}img{width:mm;height:mm}</style></head><body><img src=""></body></html>);'''
new_pdf = '''win.document.write(<!DOCTYPE html><html><head><style>@page{size:mm mm;margin:0}body{margin:0}img{width:mm;height:mm}</style></head><body><img src=""></body></html>);'''
text = text.replace(old_pdf, new_pdf)

with open('rotadraw.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Patch 2 done.")
