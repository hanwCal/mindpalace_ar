import json
import os
from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

# Define the path to the latest cards file
LATEST_CARDS_FILE = os.path.join(os.path.dirname(__file__), "latest_cards.json")

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all origins (TODO: restrict in prod)
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/latest-cards")
async def get_latest_cards():
    """
    Retrieve the latest generated cards from the saved JSON file.
    """
    try:
        if not os.path.exists(LATEST_CARDS_FILE):
            return []
        
        with open(LATEST_CARDS_FILE, 'r', encoding='utf-8') as f:
            cards = json.load(f)
        
        return cards
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading latest cards: {str(e)}")

@app.get("/")
async def root():
    """
    Root endpoint to serve the latest cards without outer array brackets.
    """
    try:
        if not os.path.exists(LATEST_CARDS_FILE):
            return Response("[]", media_type="text/plain")
        
        with open(LATEST_CARDS_FILE, 'r', encoding='utf-8') as f:
            cards = json.load(f)
        
        # Convert to string and remove outer brackets
        json_str = json.dumps(cards, ensure_ascii=False)
        if json_str.startswith("[") and json_str.endswith("]"):
            json_str = json_str[1:-1]
        
        return Response(json_str, media_type="text/plain")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading latest cards: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("latest_cards_api:app", host="0.0.0.0", port=8001) 