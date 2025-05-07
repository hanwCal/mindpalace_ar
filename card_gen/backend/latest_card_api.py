import json
import os
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

# Define the path to the latest cards file
LATEST_CARDS_FILE = os.path.join(os.path.dirname(__file__), "latest_cards.json")

# Define the card model
class Card(BaseModel):
    id: int
    title: str
    content: str
    image: str
    caption: str

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all origins (TODO: restrict in prod)
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

def format_cards(raw_cards: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Ensure cards are properly formatted with all required fields.
    If a card is missing any required fields, they will be filled with empty strings.
    """
    formatted_cards = []
    for i, card in enumerate(raw_cards):
        formatted_card = {
            "id": card.get("id", i),
            "title": card.get("title", ""),
            "content": card.get("content", ""),
            "image": card.get("image", ""),
            "caption": card.get("caption", "")
        }
        formatted_cards.append(formatted_card)
    return formatted_cards

@app.get("/latest-cards", response_model=List[Card])
async def get_latest_cards():
    """
    Retrieve the latest generated cards from the saved JSON file.
    Returns a properly formatted JSON array of cards.
    """
    try:
        if not os.path.exists(LATEST_CARDS_FILE):
            return []
        
        with open(LATEST_CARDS_FILE, 'r', encoding='utf-8') as f:
            raw_cards = json.load(f)
        
        return format_cards(raw_cards)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading latest cards: {str(e)}")

@app.get("/", response_model=List[Card])
async def root():
    """
    Root endpoint to serve the latest cards as a properly formatted JSON array.
    """
    try:
        if not os.path.exists(LATEST_CARDS_FILE):
            return []
        
        with open(LATEST_CARDS_FILE, 'r', encoding='utf-8') as f:
            raw_cards = json.load(f)
        
        return format_cards(raw_cards)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading latest cards: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("latest_card_api:app", host="172.20.10.3", port=8001) 