from typing import Literal, Annotated
from pydantic import BaseModel, AfterValidator

def not_empty(v: list) -> list:
    if not v:
        raise ValueError("Messages Cannot be empty")
    return v

class Message(BaseModel):
    role: Literal['user', 'assistant']
    content: str

class ChatRequest(BaseModel):
    persona: Literal["anshuman", "abhimanyu", "kshitij"]
    messages: Annotated[list[Message], AfterValidator(not_empty)]

class ChatResponse(BaseModel):
    response: str
    persona: Literal["anshuman", "abhimanyu", "kshitij"]

