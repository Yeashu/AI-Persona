from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
from contextlib import asynccontextmanager
from google import genai
from google.genai import types
from google.genai.errors import ServerError, ClientError
from typing import Annotated
import json

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
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

@app.post("/chat")
async def chat_stream(req: ChatRequest, client: Annotated[genai.Client, Depends(get_ai_client)]):
    system_prompt = PERSONAS.get(req.persona)

    if not system_prompt:
        raise HTTPException(
            status_code=400,
            detail=f"Persona '{req.persona}' has no system prompt configured"
        )

    history = to_gemini_content(req.messages[:-1])
    last_message = req.messages[-1].content

    async def event_generator():
        try:
            chat = client.aio.chats.create(
                model=settings.ai_model_name,
                config=types.GenerateContentConfig(system_instruction=system_prompt),
                history=history,
            )
            async for chunk in await chat.send_message_stream(last_message):
                data = ChatResponse(response=chunk.text or "", persona=req.persona).model_dump_json()
                yield {"data": data}
        except ClientError as e:
            if e.code == 429:
                error_msg = "\n\n[System: API quota exhausted. You've hit the free-tier rate limit. Please wait a moment and try again, or upgrade your Gemini API plan.]"
            else:
                error_msg = f"\n\n[System: API error ({e.code}): {e.message}]"
            data = ChatResponse(response=error_msg, persona=req.persona).model_dump_json()
            yield {"data": data}
        except ServerError as e:
            error_msg = f"\n\n[System: The AI model is currently experiencing issues: {e.message}. Please try again later.]"
            data = ChatResponse(response=error_msg, persona=req.persona).model_dump_json()
            yield {"data": data}
        except Exception as e:
            error_msg = f"\n\n[System: An unexpected error occurred: {type(e).__name__}: {e}]"
            data = ChatResponse(response=error_msg, persona=req.persona).model_dump_json()
            yield {"data": data}

    return EventSourceResponse(event_generator())