"""Release helper: python3 tools/release.py   (or: python3 tools/release.py ksd-v25)
Bumps the version in sw.js, js/app.js and version.json together (they MUST match), and writes the file list into version.json."""
import re, sys, json
sw = open('sw.js').read(); cur = int(re.search(r"VERSION = 'ksd-v(\d+)'", sw).group(1))
new = sys.argv[1] if len(sys.argv) > 1 else 'ksd-v%d' % (cur + 1)
sw = re.sub(r"VERSION = 'ksd-v\d+'", "VERSION = '%s'" % new, sw); open('sw.js', 'w').write(sw)
app = open('js/app.js').read(); app = re.sub(r"APP_VERSION = 'ksd-v\d+'", "APP_VERSION = '%s'" % new, app); open('js/app.js', 'w').write(app)
shell = re.search(r"SHELL = \[(.*?)\];", sw, re.S).group(1); files = re.findall(r"'([^']+)'", shell)
json.dump({'v': new, 'files': [f for f in files if f != './']}, open('version.json', 'w'), indent=1)
print('released', new)
