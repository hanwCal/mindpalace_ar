import json
import os
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

# Define the path to the latest cards file
LATEST_CARDS_FILE = os.path.join(os.path.dirname(__file__), "latest_cards.json")

# Define position model
class Position(BaseModel):
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0

# Define the card model
class Card(BaseModel):
    id: str
    anchor: str = "Null"
    title: str
    description: str
    position: Position = Position()
    imageUrl: str
    color: str = "#FFD700"
    Caption: str

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
    Ensure cards are properly formatted with all required fields and convert
    from original format to the downstream app format.
    """
    formatted_cards = []
    for i, card in enumerate(raw_cards):
        formatted_card = {
            "id": card.get("id", f"Card-{i}"),
            "anchor": "Null",
            "title": card.get("title", ""),
            "description": card.get("content", ""),
            "position": {"x": 0.0, "y": 0.0, "z": 0.0},
            "imageUrl": card.get("image", ""),
            "color": "#FFD700",
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