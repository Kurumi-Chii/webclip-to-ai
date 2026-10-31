"""Serve only the synthetic manual-acceptance fixture on IPv4 loopback."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class AcceptancePage(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path not in ('/', '/acceptance.html'):
            self.send_error(404)
            return
        body = Path(__file__).with_name('acceptance.html').read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=18770)
    args = parser.parse_args()
    print(f'Manual acceptance page: http://127.0.0.1:{args.port}/acceptance.html', flush=True)
    try:
        ThreadingHTTPServer(('127.0.0.1', args.port), AcceptancePage).serve_forever()
    except KeyboardInterrupt:
        pass
