import re, os

log_path = r'C:\Users\kalli\.gemini\antigravity\brain\903178ad-91ea-4a17-b5b2-ebc1bf2cf7f5\.system_generated\logs\overview.txt'

with open(log_path, 'r', encoding='utf-8') as f:
    text = f.read()

# We need to extract the parts of page.js from the view_file outputs.
# Let's find matches for "Showing lines ... to ..." followed by code.
# The code lines start with "1: ", "2: ", etc.

blocks = {}
current_block = []
current_line_num = 0

for line in text.split('\n'):
    m = re.match(r'^(\d+):\s(.*)', line)
    if m:
        num = int(m.group(1))
        content = m.group(2)
        blocks[num] = content

if not blocks:
    print("No lines found!")
else:
    max_line = max(blocks.keys())
    print(f"Recovered up to line {max_line}")
    out_lines = []
    for i in range(1, max_line + 1):
        if i in blocks:
            out_lines.append(blocks[i])
        else:
            out_lines.append('// MISSING LINE ' + str(i))
    
    with open('d:/10.Coding/01.Vibe/FinanceBoard/src/app/holdings/page.js', 'w', encoding='utf-8') as f:
        f.write('\n'.join(out_lines))
    print("Restore done!")
