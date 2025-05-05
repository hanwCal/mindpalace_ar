import json
import os
import base64
import re
import io
import hashlib
import requests
from urllib.parse import urlparse, quote
from functools import lru_cache
from typing import Tuple, Optional, List
import math
import random
from PIL import Image, ImageDraw, ImageFont

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI

# load env variables
load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all origins (TODO: restrict in prod)
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# initialize OpenAI client with API key
client = OpenAI(api_key="YOUR_OPENAI_API_KEY")

# Default placeholder image URL (served directly from Wikipedia)
DEFAULT_IMAGE_URL = "https://en.wikipedia.org/static/images/project-logos/enwiki.png"

PROMPT = """You are an expert educational assistant. Your task is to help a user learn a specific topic by generating a list of up to 10 concise learning notes, each formatted as:
- Title: 1 short, specific line
- Content: 2-3 sentences explaining the key concept in sufficient detail. Aim for clarity and depth while staying concise. You may use simple Markdown formatting if helpful.
- Image: IMPORTANT - For each note, provide a URL to a relevant image. Look for images on Wikipedia pages related to the topic. Use only freely available and public domain images.
- Caption: Add a brief, descriptive caption (1-2 sentences) for the image that explains what it shows.

CRITICAL INSTRUCTIONS FOR IMAGES:
DO NOT MAKE UP IMAGES!!! ONLY FETCH EXISTING IMAGES FROM WIKIPEDIA PAGE.
1. ONLY provide direct image URLs (https://...) that end with .jpg, .png, .svg, or .gif extensions
2. Prefer images that can be served directly from Wikipedia (e.g. https://en.wikipedia.org/wiki/Special:FilePath/...), otherwise fall back to Wikimedia Commons or other public-domain sources
3. For each note, search for an image relevant to that specific point, not just the general topic
4. If you cannot find a suitable image, use this placeholder: """ + DEFAULT_IMAGE_URL + """

Each note should focus on one key idea, suitable for placement in a memory palace. To make learning more effective and engaging, vary the type of information across cards. Focus on clarity, usefulness, and learning value."""

def fix_base64_padding(s: str) -> str:
    """Add padding to a base64 string if needed."""
    s = re.sub(r'\s+', '', s)
    padding_needed = len(s) % 4
    if padding_needed:
        s += '=' * (4 - padding_needed)
    return s

def is_valid_base64_image(base64_string: str) -> Tuple[bool, Optional[str]]:
    """Check if a string is a valid base64-encoded image."""
    if not base64_string:
        return False, "Empty string"
    s = re.sub(r'\s+', '', base64_string)
    if "base64," in s:
        s = s.split("base64,")[1]
    s = fix_base64_padding(s)
    try:
        data = base64.b64decode(s)
        if len(data) < 100:
            return False, "Data too short for an image"
        return True, None
    except Exception as e:
        return False, str(e)

# ---------------------------------------------------------------------------
# URL verification utilities
# ---------------------------------------------------------------------------

@lru_cache(maxsize=256)
def verify_url_exists(url: str) -> bool:
    """Check if a URL exists by sending a HEAD request.
    
    Uses LRU cache to avoid checking the same URL multiple times.
    Returns True if the server returns a 200/301/302 status code.
    """
    try:
        # Parse URL to ensure it has a scheme
        parsed = urlparse(url)
        if not parsed.scheme:
            return False
            
        # Timeout quickly as we just need to know if it exists
        response = requests.head(url, timeout=3, allow_redirects=True)
        return response.status_code < 400  # Success or redirect
    except Exception as e:
        print(f"URL verification error for {url}: {e}")
        return False  # Any error means URL doesn't work

def search_wikipedia_images(topic: str, retry_count: int = 6) -> List[str]:
    """Search for images on Wikipedia related to a topic.
    
    Args:
        topic: The topic to search for images.
        retry_count: Number of search attempts to make.
        
    Returns:
        List of valid image URLs from Wikipedia.
    """
    image_urls = []
    
    # Try different search strategies
    for attempt in range(retry_count):
        try:
            if attempt == 0:
                # First attempt: search for the exact topic
                search_term = topic
            elif attempt == 1:
                # Second attempt: try a broader search
                search_term = topic.split()[0] if ' ' in topic else topic
            else:
                # Additional attempts: add some variety
                modifiers = ["history", "diagram", "illustration", "example", "photo", "chart"]
                search_term = f"{topic} {random.choice(modifiers)}"
                
            print(f"Image search attempt {attempt+1}/{retry_count}: '{search_term}'")
            
            # Search using the Wikipedia API
            api_url = f"https://en.wikipedia.org/w/api.php?action=query&titles={quote(search_term)}&prop=images&format=json"
            response = requests.get(api_url, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                
                # Extract page data - we need to get the first page's ID dynamically
                pages = data.get('query', {}).get('pages', {})
                if not pages:
                    continue
                    
                # Get the first page (there should only be one)
                page_id = next(iter(pages))
                page_data = pages[page_id]
                
                # Extract images from the page
                images = page_data.get('images', [])
                
                # Filter for usable image formats and convert to URLs
                for img in images:
                    filename = img.get('title', '')
                    if not filename.startswith('File:'):
                        continue
                        
                    # Remove the 'File:' prefix
                    filename = filename[5:]
                    
                    # Check if it's an image format we can use
                    if re.search(r"\.(jpg|jpeg|png|svg|gif)$", filename, re.IGNORECASE):
                        # Use the Wikipedia Special:Redirect URL
                        image_url = f"https://en.wikipedia.org/wiki/Special:Redirect/file/{quote(filename)}"
                        
                        # Verify the URL exists and works
                        if verify_url_exists(image_url):
                            image_urls.append(image_url)
                            
            # If we found at least some images, we can return
            if image_urls:
                return image_urls
                
        except Exception as e:
            print(f"Error searching Wikipedia for images on attempt {attempt+1}: {e}")
    
    # If we get here, we couldn't find any valid images
    return []

# ---------------------------------------------------------------------------
# Helper utilities for handling image URLs
# ---------------------------------------------------------------------------

def wikimedia_to_wikipedia_url(url: str) -> str:
    """Convert a Wikimedia Commons image URL to a Wikipedia `Special:FilePath` URL.

    Wikipedia articles embed images that are physically hosted on the
    `upload.wikimedia.org` domain. Some clients, CDNs, or firewalls may block
    cross-domain requests, so we prefer to serve images directly from the
    `en.wikipedia.org` domain.  This helper attempts to transform a standard
    Wikimedia URL into the approximate Wikipedia equivalent.

    For example::

        https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Example.svg/600px-Example.svg.png

    becomes::

        https://en.wikipedia.org/wiki/Special:FilePath/Example.svg

    If the URL is not recognised as a Wikimedia URL, it is returned unchanged.
    """
    if not url or "upload.wikimedia.org" not in url:
        return url  # Nothing to do

    # Extract the original filename.  Thumbnails use the pattern:
    #   .../thumb/<dir>/<dir>/<FILENAME>/<SIZE>px-<FILENAME>
    # Non-thumbnail originals omit the /thumb/ segment, so handle both.
    filename = None

    thumb_match = re.search(r"/thumb/.+?/([^/]+)/[^/]*$", url)
    if thumb_match:
        filename = thumb_match.group(1)
    else:
        # Fall back to the last path component
        filename = url.split("/")[-1]

    # Remove any leading "<N>px-" size prefix that may still be present
    filename = re.sub(r"^\d+px-", "", filename)

    # Sanity check the extracted filename
    if not re.search(r"\.(jpg|jpeg|png|svg|gif)$", filename, re.IGNORECASE):
        # Could not confidently extract – return original URL
        return url

    # Use Special:Redirect which works more consistently than FilePath
    return f"https://en.wikipedia.org/wiki/Special:Redirect/file/{filename}"

def query_gpt(user_prompt: str):
    print("REQUEST WITH PROMPT", user_prompt)
    if len(user_prompt) > 100:
        print(f"User prompt too long ({len(user_prompt)} characters). Truncating.")
        user_prompt = user_prompt[:100]
    user_prompt = "I want to learn about " + user_prompt
    
    # Map of titles to their retry-fetched images (used as a cache for this session)
    title_to_images_map = {}

    response = client.responses.create(
        model="gpt-4o",  # use a model that supports hosted tools
        tools=[{
            "type": "web_search_preview",        # enable web search
            "search_context_size": "medium"      # low / medium / high
        }],
        input=[
            {"role": "developer", "content": PROMPT},
            {"role": "user",      "content": user_prompt},
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": "learning_cards",
                "schema": {
                    "type": "object",
                    "properties": {
                        "wrapper": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "title":   {"type": "string"},
                                    "content": {"type": "string"},
                                    "image":   {"type": "string", "description": "Image URL"},
                                    "caption": {"type": "string", "description": "Brief image caption"}
                                },
                                "required": ["title", "content", "image", "caption"],
                                "additionalProperties": False,
                            },
                        },
                    },
                    "required": ["wrapper"],
                    "additionalProperties": False,
                },
                "strict": True,
            }
        }
    )
    print("REQUEST ENDED")

    output = json.loads(response.output_text)
    cards = output["wrapper"]

    for card in cards:
        title   = card.get("title", "")
        content = card.get("content", "")
        image   = card.get("image", "").strip()
        caption = card.get("caption", "")

        # Prefer Wikipedia-hosted URLs if possible
        image = wikimedia_to_wikipedia_url(image)

        # validate URL format
        if (not image.startswith("http") or 
            not re.search(r"\.(jpg|jpeg|png|svg|gif)$", image, re.IGNORECASE) or
            not verify_url_exists(image)):
            print(f"Invalid image URL for '{title}', attempting to find alternative...")
            
            # Try to find alternative images
            # First check our title-based cache
            if title in title_to_images_map and title_to_images_map[title]:
                # We already found images for this title, use one of them
                image = random.choice(title_to_images_map[title])
                print(f"Using cached image for '{title}'")
            else:
                # Search for images related to this title/concept
                search_images = search_wikipedia_images(title)
                
                # Also try the topic itself if that didn't work
                if not search_images:
                    main_topic = user_prompt.replace("I want to learn about ", "")
                    search_images = search_wikipedia_images(main_topic)
                
                # Store in our cache
                title_to_images_map[title] = search_images
                
                # Use one of the found images if available
                if search_images:
                    image = random.choice(search_images)
                    print(f"Found alternative image for '{title}'")
                else:
                    print(f"No alternative image found for '{title}', using default.")
                    image = None  # Don't use a default image
            
            if image is None:
                print(f"No image available for '{title}'")
                caption = ""  # Clear caption when no image
        else:
            print(f"Using original image for '{title}'")

        yield title, content, image, caption

last_id = 0

@app.post("/generate-notes")
async def generate_notes(request: Request):
    global last_id
    data = await request.json()
    prompt = data.get("prompt", "")

    cards_out = []
    for title, content, image_url, caption in query_gpt(prompt):
        cards_out.append({
            "id":      last_id,
            "title":   title,
            "content": content,
            "image":   image_url,
            "caption": caption
        })
        last_id += 1

    return cards_out

@app.get("/test")
async def test_endpoint():
    return {"message": "Backend is working!"}

def generate_icon_image(text: str) -> str:
    """Generate a simple colorful icon based on the text and return as base64."""
    text_hash = int(hashlib.md5(text.encode("utf-8")).hexdigest(), 16)
    hue = (text_hash % 360) / 360.0
    width, height = 200, 200
    img = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(img)

    # pastel background
    bg = hsv_to_rgb(hue, 0.3, 0.95)
    draw.rectangle([(0, 0), (width, height)], fill=bg)

    # central shape
    main = hsv_to_rgb(hue, 0.6, 0.8)
    w, h = 140, 100
    x1, y1 = (width - w) // 2, (height - h) // 2
    draw.rectangle([x1, y1, x1 + w, y1 + h], fill=main)

    # simple shape based on first char
    initial = text[0].lower() if text else "a"
    code = ord(initial) % 4
    cx, cy = width // 2, height // 2
    if code == 0:
        draw.ellipse((cx-30, cy-30, cx+30, cy+30), fill="white")
    elif code == 1:
        draw.polygon([(cx,cy-40),(cx-40,cy+40),(cx+40,cy+40)], fill="white")
    elif code == 2:
        s = 35
        draw.polygon([(cx,cy-s),(cx+s,cy),(cx,cy+s),(cx-s,cy)], fill="white")
    else:
        s = 30
        draw.rectangle([cx-s,cy-s,cx+s,cy+s], fill="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")

def hsv_to_rgb(h: float, s: float, v: float) -> Tuple[int,int,int]:
    """Convert HSV to RGB tuple."""
    h_i = int(h * 6)
    f = (h * 6) - h_i
    p = v * (1 - s)
    q = v * (1 - f * s)
    t = v * (1 - (1 - f) * s)
    if   h_i == 0: r, g, b = v, t, p
    elif h_i == 1: r, g, b = q, v, p
    elif h_i == 2: r, g, b = p, v, t
    elif h_i == 3: r, g, b = p, q, v
    elif h_i == 4: r, g, b = t, p, v
    else:          r, g, b = v, p, q
    return int(r*255), int(g*255), int(b*255)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
