"""Synthetic fixtures only. Writes solely to the isolated QA API on 127.0.0.1:3003."""
import json, pathlib, urllib.request, uuid, zipfile

ROOT = pathlib.Path('/tmp/readflix-route-theme-qa')
ROOT.mkdir(exist_ok=True)
BASE = 'http://127.0.0.1:3003/api'

def request(path, data=None, method=None, content_type='application/json'):
    body = data if isinstance(data, bytes) else json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(BASE + path, body, {'Content-Type': content_type}, method=method)
    with urllib.request.urlopen(req) as r:
        result = r.read()
        return json.loads(result) if result else None

assert request('/users') == [] and request('/books') == [], 'QA seed requires an empty isolated database; refusing to touch existing data'
users = [request('/users', {'name': name}) for name in ['閱讀測試', '另一位讀者']]
user = users[0]['id']
for reader in users:
    request('/users/' + reader['id'] + '/settings', {'writingMode': 'horizontal-tb', 'fontSize': 18, 'theme': 'dark'}, method='PUT')

def upload(path, collection):
    boundary = 'readflix-' + uuid.uuid4().hex
    body = b''
    for name, value in [('uploadedBy', user), ('collection', collection)]:
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
    mime = {'.epub':'application/epub+zip', '.pdf':'application/pdf', '.txt':'text/plain'}[path.suffix]
    body += f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{path.name}"\r\nContent-Type: {mime}\r\n\r\n'.encode() + path.read_bytes() + f'\r\n--{boundary}--\r\n'.encode()
    return request('/books', body, content_type=f'multipart/form-data; boundary={boundary}')

books = []
for n, title in enumerate(['山間的日常', '慢慢走過四季', '城市裡的一盞燈']):
    path = ROOT / f'qa-{n}.epub'
    with zipfile.ZipFile(path, 'w') as z:
        z.writestr('mimetype', 'application/epub+zip')
        z.writestr('META-INF/container.xml', '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
        z.writestr('content.opf', f'''<package version="3.0" unique-identifier="uid" xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">qa-{n}</dc:identifier><dc:title>{title}</dc:title><dc:creator>Readflix 測試編輯室</dc:creator><dc:language>zh-TW</dc:language><meta property="dcterms:modified">2026-10-06T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>''')
        z.writestr('nav.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>目錄</title></head><body><nav epub:type="toc"><ol><li><a href="c1.xhtml">第一章：出發</a></li><li><a href="c2.xhtml">第二章：回家</a></li></ol></nav></body></html>')
        for chapter in [1, 2]:
            paragraphs = ''.join(f'<p>第 {i} 段。這是合成的測試文字。山風吹過樹梢，午後的陽光落在書頁上。我們留下一點時間，慢慢閱讀，慢慢想像。每一次翻頁，都是新的開始。</p>' for i in range(50))
            z.writestr(f'c{chapter}.xhtml', f'<html xmlns="http://www.w3.org/1999/xhtml"><head><title>{title}</title></head><body><h1>{title} · 第 {chapter} 章</h1>{paragraphs}</body></html>')
    books.append(upload(path, '散文選集'))
for title in ['午後的練習', '閱讀筆記', '寫給明天的信']:
    path = ROOT / (title + '.txt')
    path.write_text((title + '\n這是本機合成測試資料，不含私人書籍內容。\n\n') * 180)
    books.append(upload(path, '生活筆記'))
# Minimal three-page PDF with valid cross-reference offsets.
objects = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>']
for n in range(3):
    objects.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 560] /Resources << /Font << /F1 9 0 R >> >> /Contents {4 + n*2} 0 R >>'.encode())
    content = f'BT /F1 24 Tf 50 450 Td (Readflix QA - Page {n+1}) Tj ET'.encode()
    objects.append(b'<< /Length ' + str(len(content)).encode() + b' >>\nstream\n' + content + b'\nendstream')
objects.append(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
pdf = b'%PDF-1.4\n'; offsets = [0]
for i, obj in enumerate(objects,1):
    offsets.append(len(pdf)); pdf += f'{i} 0 obj\n'.encode() + obj + b'\nendobj\n'
xref = len(pdf)
pdf += f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode() + b''.join(f'{offset:010d} 00000 n \n'.encode() for offset in offsets[1:])
pdf += f'trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF'.encode()
path = ROOT / 'Reading-Atlas.pdf'; path.write_bytes(pdf); books.append(upload(path,'圖文誌'))
request(f'/users/{user}/books/{books[0]["id"]}/progress', {'cfi':'@@1@@0.25@@2@@0.625', 'percentage':63}, method='PUT')
request(f'/users/{user}/books/{books[3]["id"]}/progress', {'cfi':'@@0.35@@1', 'percentage':35}, method='PUT')
request(f'/users/{user}/books/{books[6]["id"]}/progress', {'cfi':'@@2@@3', 'percentage':67}, method='PUT')
request(f'/users/{user}/books/{books[1]["id"]}/bookmark', {}, method='POST')
(ROOT/'fixtures.json').write_text(json.dumps({'users':users,'books':books}, ensure_ascii=False, indent=2))
print(json.dumps({'users':len(users), 'books':len(books), 'fixtures':str(ROOT/'fixtures.json')}))
