import threading
import webview # type: ignore
from servidor import app

def start_flask():
    app.run(host='127.0.0.1', port=5000, debug=False)

if __name__ == '__main__':
    flask_thread = threading.Thread(target=start_flask, daemon=True)
    flask_thread.start()

    webview.create_window(
        title="Sistema MaxTour",
        url="http://127.0.0.1:5000",
        width=1024,
        height=768
    )
    
    webview.start()
