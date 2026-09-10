import os
import sys
import webbrowser
from http.server import SimpleHTTPRequestHandler, HTTPServer
import threading

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def start_local_server(port=8000):
    os.chdir(BASE_DIR)
    server = HTTPServer(('127.0.0.1', port), SimpleHTTPRequestHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server

def main():
    port = 8765
    try:
        start_local_server(port)
        url = f"http://127.0.0.1:{port}/index.html"
    except Exception:
        url = os.path.join(BASE_DIR, "index.html")

    try:
        import webview
        # 네이티브 데스크톱 윈도우로 실행
        webview.create_window(
            title="Limbus Beep - 단테 삐삐 시뮬레이터",
            url=url,
            width=1100,
            height=660,
            min_size=(600, 400),
            background_color="#000000",
            resizable=True,
        )
        webview.start(debug=False)
    except Exception as e:
        print(f"데스크톱 웹뷰 대신 기본 브라우저로 엽니다: {e}")
        webbrowser.open(url)

if __name__ == "__main__":
    main()
