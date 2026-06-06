import re

with open('rotadraw.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Update Drawing Shape creation
html = html.replace("drawingShape={id:nextShapeId++,type:drawTool,points:[{x:sx,y:sy}],cps:[],closed:false,strokeWidth,groupId:GROUP1_ID};", "drawingShape={id:nextShapeId++,type:drawTool,points:[{x:sx,y:sy,inT:{x:0,y:0},outT:{x:0,y:0},mode:'sym'}],closed:false,strokeWidth,groupId:GROUP1_ID};")

html = html.replace("drawingShape.points.push({x:sx,y:sy});", "drawingShape.points.push({x:sx,y:sy,inT:{x:0,y:0},outT:{x:0,y:0},mode:'sym'});\n      if (drawingShape.type==='spline') updateHermiteTangents(drawingShape);")

with open('rotadraw.html', 'w', encoding='utf-8') as f:
    f.write(html)
