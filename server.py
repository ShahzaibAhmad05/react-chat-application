import asyncio
import websockets
import json
import random
from datetime import datetime

HOST = "localhost"
PORT = 55555
ANSI_COLORS = ["#e74c3c","#2ecc71","#f1c40f","#3498db","#9b59b6","#1abc9c"]
COLOR_DM = "#ff66cc"

clients = {}       #username -> websocket
user_colors = {}   #username -> color

#assign random color
def random_color():
    return random.choice(ANSI_COLORS)

#send json message
async def send_json(ws, data):
    try:
        await ws.send(json.dumps(data))
    except:
        pass

#broadcast message
async def broadcast(data, exclude=None):
    for user, ws in list(clients.items()):
        if user != exclude:
            await send_json(ws, data)

#send private message
async def send_dm(sender, recipient, message):
    if recipient not in clients:
        await send_json(clients[sender], {"type":"error","text":f"user '{recipient}' not found"})
        return
    await send_json(clients[recipient], {
        "type":"dm",
        "from":sender,
        "color":COLOR_DM,
        "text":message
    })
    await send_json(clients[sender], {
        "type":"dm",
        "to":recipient,
        "color":COLOR_DM,
        "text":message
    })

#handle each client (updated for new websockets versions)
async def handle_client(ws, path=None):
    username = None
    try:
        await send_json(ws, {"type":"info","text":"enter your username"})
        data = await ws.recv()
        username = data.strip()
        if not username or username in clients:
            await send_json(ws, {"type":"error","text":"invalid or duplicate username"})
            await ws.close()
            return

        clients[username] = ws
        user_colors[username] = random_color()
        await send_json(ws, {"type":"info","text":f"joined as {username}"})
        await broadcast({"type":"notice","text":f"{username} joined the chat"}, exclude=username)

        #main message loop
        async for msg in ws:
            msg = msg.strip()
            if not msg:
                continue
            if msg == "/quit":
                break
            if msg.startswith("@"):
                parts = msg.split(maxsplit=1)
                if len(parts) < 2:
                    await send_json(ws, {"type":"error","text":"use @username message"})
                    continue
                target, text = parts[0][1:], parts[1]
                await send_dm(username, target, text)
            else:
                time = datetime.now().strftime("%I:%M%p").lstrip("0")
                await broadcast({
                    "type":"chat",
                    "from":username,
                    "color":user_colors[username],
                    "time":time,
                    "text":msg
                })
    except:
        pass
    finally:
        if username and username in clients:
            del clients[username]
            await broadcast({"type":"notice","text":f"{username} left the chat"})

#main entry
async def main():
    print(f"[server] running on {HOST}:{PORT}")
    async with websockets.serve(handle_client, HOST, PORT):
        await asyncio.Future()  #run forever

if __name__ == "__main__":
    asyncio.run(main())
