import asyncio
import time
from google import genai
from app.config import settings

async def main():
    client = genai.Client(api_key=settings.gemini_api_key)
    chat = client.aio.chats.create(model=settings.ai_model_name)
    start = time.time()
    
    print("Testing stream...")
    response_stream = await chat.send_message_stream("Write a short story about a robot learning to feel. Make it long.")
    async for chunk in response_stream:
        print(f"[{time.time()-start:.2f}s] got chunk of len {len(chunk.text or '')}")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(main())