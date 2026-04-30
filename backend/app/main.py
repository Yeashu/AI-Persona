from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.sse import EventSourceResponse
from contextlib import asynccontextmanager
from google import genai
from google.genai import types
from google.genai.errors import ServerError
from typing import Annotated
from collections.abc import AsyncIterable

from app.config import settings
from app.models import Message, ChatRequest, ChatResponse
from app.personas import PERSONAS


# Lifecycle management
@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.ai_client = genai.Client(api_key=settings.gemini_api_key)
    yield
    await app.state.ai_client.aio.aclose()
    app.state.ai_client.close()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'], #For dev only will change in production
    allow_methods=['GET', 'POST'],
    allow_headers=['*']
)

#Helper convertor funciton
def to_gemini_content(messages: list[Message]) -> list:
    return [
        {
            "role" : "user" if msg.role == "user" else "model",
            "parts" : [types.Part(text=msg.content)]
        }
         for msg in messages
    ]

#Exception Handling
@app.exception_handler(ServerError)
async def gemini_exception_handler(request: Request, exc: ServerError):
    return JSONResponse(
        status_code=exc.code,
        content={"message":exc.message, "details":exc.details}
    )

#Dependency
async def get_ai_client(req: Request) -> genai.Client:
    return req.app.state.ai_client

@app.get("/health")
def health():
    return {'status': 'ok'}

@app.post("/chat", response_class=EventSourceResponse)
async def chat_stream(req: ChatRequest, client: Annotated[genai.Client, Depends(get_ai_client)]) -> AsyncIterable[ChatResponse]:
    system_prompt = PERSONAS.get(req.persona)

    if not system_prompt:
        raise HTTPException(
            status_code=400,
            detail=f"Persona '{req.persona}' has no system prompt configured"
        )

    history = to_gemini_content(req.messages[:-1])
    last_message = req.messages[-1].content

    chat = client.aio.chats.create(
        model=settings.ai_model_name,
        config=types.GenerateContentConfig(system_instruction=system_prompt),
        history=history,
    )
    async for chunk in await chat.send_message_stream(last_message):
        yield ChatResponse(response = chunk.text or "", persona=req.persona)