"""Local integration receiver, not an AI backend. Python 3, no dependencies."""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DEMO = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<title>选文送 AI · 禁止选择演示页</title>
<style>body{font:18px/1.8 system-ui;max-width:760px;margin:70px auto;padding:24px;background:#f6f8f5;color:#20332e;user-select:none;-webkit-user-select:none}article{padding:24px;border:1px solid #ccd8cf;border-radius:14px;background:white}</style>
<h1>试着把这段话送给智能体</h1><p>此页故意阻止选字、复制和右键。点击插件「允许当前页选择与右键」，关闭面板后再拖动选字并右键发送。</p>
<article id="sample">春天的风吹过山谷，带来了新的想法。把这一段文字送给我的 AI 智能体。<br>引号测试："你好"；反斜杠测试：\\；换行也应该保持原样。</article>
<p>接收地址：http://127.0.0.1:8765/receive。此页只用于联调。</p>
<script>for(const name of ['contextmenu','selectstart','copy'])document.addEventListener(name,e=>e.preventDefault());</script></html>'''

class Receiver(BaseHTTPRequestHandler):
    def send(self, status, data, content_type='application/json; charset=utf-8'):
        encoded = data.encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        if self.path in ('/', '/demo'):
            self.send(200, DEMO, 'text/html; charset=utf-8')
        else:
            self.send(404, '{"error":"not_found"}')

    def do_POST(self):
        if self.path != '/receive':
            self.send(404, '{"error":"not_found"}')
            return
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if size < 1 or size > 2_000_000:
                self.send(413, '{"error":"invalid_size"}')
                return
            payload = json.loads(self.rfile.read(size).decode('utf-8'))
            if not isinstance(payload, dict):
                raise ValueError('object required')
            print('\n--- Received JSON / 收到内容 ---\n' + json.dumps(payload, ensure_ascii=False, indent=2), flush=True)
            self.send(200, json.dumps({'received': True, 'message': '本地测试接口已收到。这不是 AI 回复。', 'text': payload.get('text', '')}, ensure_ascii=False))
        except (ValueError, UnicodeDecodeError):
            self.send(400, '{"error":"invalid_json"}')

if __name__ == '__main__':
    print('Local test receiver: http://127.0.0.1:8765/receive\nDemo page: http://127.0.0.1:8765/demo\nPress Ctrl+C to stop.', flush=True)
    try:
        ThreadingHTTPServer(('127.0.0.1', 8765), Receiver).serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
