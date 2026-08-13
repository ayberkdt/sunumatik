# Sunumatik demo sunucusu — onbelleksiz.
# python http.server onbellek basligi gondermez; tarayici eski (bozuk) bir
# index.html'i gunlerce ezberleyebilir. Bu sunucu her yanita
# Cache-Control: no-store basar: yenile = her zaman diskteki guncel dosya.
import http.server, os, sys, socket

class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()
    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))

def free_port(cands):
    for p in cands:
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", p)) != 0:
                return p
    return cands[-1]

if __name__ == "__main__":
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    port = int(sys.argv[1]) if len(sys.argv) > 1 else free_port([8790, 8795, 8798])
    print("PORT=%d" % port, flush=True)
    http.server.ThreadingHTTPServer(("", port), NoCache).serve_forever()
