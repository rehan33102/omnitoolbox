"""Probe: does Microsoft Edge TTS work from this serverless environment?"""
from http.server import BaseHTTPRequestHandler
import json
import asyncio
import time


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        async def test():
            import edge_tts

            t0 = time.time()
            communicate = edge_tts.Communicate(
                "Assalam o alaikum, ye test hai.", "ur-PK-AsadNeural"
            )
            chunks = []
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    chunks.append(chunk["data"])
            audio = b"".join(chunks)
            return {"bytes": len(audio), "seconds": round(time.time() - t0, 1)}

        async def run():
            return await asyncio.wait_for(test(), timeout=25)

        try:
            result = asyncio.run(run())
            payload = {"ok": True, **result}
        except Exception as e:
            payload = {"ok": False, "error": f"{type(e).__name__}: {str(e)[:400]}"}

        body = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
