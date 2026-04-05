import os

def check_encoding(directory):
    for root, dirs, files in os.walk(directory):
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        if '.next' in dirs:
            dirs.remove('.next')
            
        for file in files:
            if file.endswith(('.js', '.jsx', '.ts', '.tsx', '.css', '.html')):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'rb') as f:
                        content = f.read()
                    content.decode('utf-8')
                except UnicodeDecodeError as e:
                    print(f"ENCODING_ERROR: {filepath} at {e.start} - Not valid UTF-8")

if __name__ == "__main__":
    check_encoding('d:\\10.Coding\\01.Vibe\\FinanceBoard\\src')
