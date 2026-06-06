import re

# 1. Update tools.js
with open('js/tools.js', 'r', encoding='utf-8') as f:
    tools_js = f.read()

# For outT drag
tools_js = re.sub(
    r"if\s*\(p\.mode\s*===\s*'sym'\)\s*p\.inT\s*=\s*\{x:\s*-p\.outT\.x,\s*y:\s*-p\.outT\.y\};",
    "if (p.mode === 'sym') p.inT = {x: -p.outT.x, y: -p.outT.y};\n      else if (p.mode === 'smooth') {\n        const lenIn = Math.hypot(p.inT.x, p.inT.y);\n        const lenOut = Math.hypot(p.outT.x, p.outT.y) || 1e-5;\n        p.inT = {x: -p.outT.x * lenIn / lenOut, y: -p.outT.y * lenIn / lenOut};\n      }",
    tools_js
)

# For inT drag
tools_js = re.sub(
    r"if\s*\(p\.mode\s*===\s*'sym'\)\s*p\.outT\s*=\s*\{x:\s*-p\.inT\.x,\s*y:\s*-p\.inT\.y\};",
    "if (p.mode === 'sym') p.outT = {x: -p.inT.x, y: -p.inT.y};\n      else if (p.mode === 'smooth') {\n        const lenOut = Math.hypot(p.outT.x, p.outT.y);\n        const lenIn = Math.hypot(p.inT.x, p.inT.y) || 1e-5;\n        p.outT = {x: -p.inT.x * lenOut / lenIn, y: -p.inT.y * lenOut / lenIn};\n      }",
    tools_js
)

# Change default mode to 'smooth'
tools_js = tools_js.replace("mode:'sym'", "mode:'smooth'")

with open('js/tools.js', 'w', encoding='utf-8') as f:
    f.write(tools_js)

# 2. Update main.js
with open('js/main.js', 'r', encoding='utf-8') as f:
    main_js = f.read()

main_js = main_js.replace("mode: 'free',", "mode: 'smooth',")

with open('js/main.js', 'w', encoding='utf-8') as f:
    f.write(main_js)

print("Updated tools.js and main.js for smooth handles")
