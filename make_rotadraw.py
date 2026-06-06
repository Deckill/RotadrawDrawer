import os
import re

def build_rotadraw():
    # Read index.html
    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # Inline CSS
    css_pattern = r'<link\s+rel="stylesheet"\s+href="css/style\.css"\s*/?>'
    with open('css/style.css', 'r', encoding='utf-8') as f:
        css_content = f.read()
    
    html = re.sub(css_pattern, f'<style>\n{css_content}\n</style>', html)

    # Extract JS script names
    script_pattern = r'<script\s+src="js/([^"]+)"></script>'
    scripts = re.findall(script_pattern, html)

    combined_js = []
    for s in scripts:
        js_path = os.path.join('js', s)
        with open(js_path, 'r', encoding='utf-8') as f:
            js_content = f.read()
        combined_js.append(f"// --- {s} --- \n{js_content}")

    # Build JS bundle
    js_bundle = "\n\n".join(combined_js)

    # Match and replace all script tags
    full_script_pattern = r'(?:\s*<script\s+src="js/[^"]+"></script>\s*)+'
    html = re.sub(full_script_pattern, lambda m: f'\n<script>\n{js_bundle}\n</script>\n', html)

    # Save to rotadraw.html
    with open('rotadraw.html', 'w', encoding='utf-8') as f:
        f.write(html)

    print("Successfully built rotadraw.html from index.html, style.css and js/*.js")

if __name__ == '__main__':
    build_rotadraw()
