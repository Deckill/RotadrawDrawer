import glob, os, subprocess

files = glob.glob('js/*.js')
for f in files:
    try:
        subprocess.check_output(['node', '-c', f], stderr=subprocess.STDOUT)
    except subprocess.CalledProcessError as e:
        print(f"Error in {f}:\n{e.output.decode('utf-8')}")
