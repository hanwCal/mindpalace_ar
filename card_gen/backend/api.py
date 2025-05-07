import json
import os
import base64
import re
import io
import hashlib
import requests
from urllib.parse import urlparse, quote
from functools import lru_cache
from typing import Tuple, Optional, List, Dict, Any
import math
import random
from PIL import Image, ImageDraw, ImageFont

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI

# load env variables
load_dotenv()

# Define output file path for latest generated cards
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

# initialize OpenAI client with API key
client = OpenAI(api_key="YOUR_API_KEY")

# Default placeholder image URL (served directly from Wikipedia)
DEFAULT_IMAGE_URL = "https://en.wikipedia.org/static/images/project-logos/enwiki.png"

PROMPT = """You are an expert educational assistant. Your task is to help a user learn a specific topic by generating a list of up to 12 concise learning notes, each formatted as:
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
    
    # Extract keywords - remove stopwords to focus on important terms
    keywords = []
    stopwords = ["a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "with", "by", "about", "of"]
    for word in topic.lower().split():
        if word not in stopwords and len(word) > 2:
            keywords.append(word)
    
    # Ensure we have at least one keyword (use the original topic if no keywords were extracted)
    if not keywords:
        keywords = [topic.split()[0]] if topic.split() else [topic]

    print(f"Keywords extracted: {keywords}")
    
    # Define search strategies - all will include at least the primary keywords
    search_strategies = []

    # Strategy 1: Exact topic 
    search_strategies.append(topic)

    # Strategy 2: Primary keyword(s) - use up to 2 most important keywords
    primary_keywords = " ".join(keywords[:2]) if len(keywords) > 1 else keywords[0]
    search_strategies.append(primary_keywords)

    # Strategy 3-5: Keywords + specific qualifiers for higher relevance
    modifiers = ["diagram", "illustration", "example", "chart", "photo", "symbol", "logo"]
    for i in range(min(3, len(modifiers))):
        search_strategies.append(f"{primary_keywords} {modifiers[i]}")

    # Strategy 6: Related broader term (if applicable)
    if len(keywords) > 1:
        search_strategies.append(keywords[0])

    # Try each strategy in order until we find images
    for attempt, search_term in enumerate(search_strategies[:retry_count]):
        try:
            print(f"Image search attempt {attempt+1}/{retry_count}: '{search_term}'")
            
            # First, try direct page search
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
                
                # Skip if page exists but no images found (try another method)
                if not images and '-1' in pages:
                    # Try a more direct search approach
                    search_api_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={quote(search_term)}&format=json"
                    search_response = requests.get(search_api_url, timeout=5)
                    
                    if search_response.status_code == 200:
                        search_data = search_response.json()
                        search_results = search_data.get('query', {}).get('search', [])
                        
                        # If we found actual pages, get images from the first result
                        if search_results:
                            first_result = search_results[0]
                            page_title = first_result.get('title', '')
                            
                            if page_title:
                                # Get images from this page
                                image_api_url = f"https://en.wikipedia.org/w/api.php?action=query&titles={quote(page_title)}&prop=images&format=json"
                                image_response = requests.get(image_api_url, timeout=5)
                                
                                if image_response.status_code == 200:
                                    image_data = image_response.json()
                                    image_pages = image_data.get('query', {}).get('pages', {})
                                    
                                    if image_pages:
                                        first_page_id = next(iter(image_pages))
                                        first_page = image_pages[first_page_id]
                                        images = first_page.get('images', [])
                
                # Filter for usable image formats and convert to URLs
                filtered_images = []
                for img in images:
                    filename = img.get('title', '')
                    if not filename.startswith('File:'):
                        continue
                        
                    # Remove the 'File:' prefix
                    filename = filename[5:]
                    
                    # Skip irrelevant images or commons categories
                    if any(skip in filename.lower() for skip in ["icon", "logo", "commons", "wiki", "category", "placeholder"]):
                        continue

                    # Skip small icons or purely decorative images
                    if re.search(r"icon|button|bullet|arrow|pixel|^dot-", filename.lower()):
                        continue
                    
                    # Check if it's an image format we can use
                    if re.search(r"\.(jpg|jpeg|png|svg|gif)$", filename, re.IGNORECASE):
                        # Use the Wikipedia Special:Redirect URL
                        image_url = f"https://en.wikipedia.org/wiki/Special:Redirect/file/{quote(filename)}"
                        
                        # Verify the URL exists and works
                        if verify_url_exists(image_url):
                            # Check relevance by seeing if any keyword is in the filename
                            name_without_extension = re.sub(r"\.(jpg|jpeg|png|svg|gif)$", "", filename.lower(), flags=re.IGNORECASE)
                            words_in_filename = re.findall(r'\w+', name_without_extension)
                            
                            # Score the image by relevance (keywords in filename)
                            relevance_score = 0
                            for keyword in keywords:
                                if keyword.lower() in words_in_filename:
                                    relevance_score += 2
                                elif any(keyword.lower() in word for word in words_in_filename):
                                    relevance_score += 1
                            
                            filtered_images.append((image_url, relevance_score))
                
                # Sort by relevance score and add to results
                if filtered_images:
                    # Sort by relevance score (highest first)
                    filtered_images.sort(key=lambda x: x[1], reverse=True)
                    
                    # Add top images to our results (up to 3 per page)
                    for url, score in filtered_images[:3]:
                        if url not in image_urls:  # Avoid duplicates
                            image_urls.append(url)
                            
            # If we found at least some images, we can return
            if image_urls:
                print(f"Found {len(image_urls)} relevant images")
                return image_urls
                
        except Exception as e:
            print(f"Error searching Wikipedia for images on attempt {attempt+1}: {e}")
    
    # If we get here, we couldn't find any valid images
    print("Could not find any relevant images after all attempts")
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
                    # Try each image until we find a matching one
                    found_match = False
                    for img_url in search_images:
                        # Verify the image matches the title/content
                        is_match, validated_caption = verify_image_caption_match(
                            img_url, caption, title, content
                        )
                        
                        if is_match:
                            image = img_url
                            caption = validated_caption  # Use the validated/improved caption
                            print(f"Found matching image for '{title}'")
                            found_match = True
                            break
                    
                    # If no match found, use first image but flag it
                    if not found_match and search_images:
                        image = search_images[0]
                        print(f"No perfect match found, using best available image for '{title}'")
                    elif not search_images:
                        image = None
                else:
                    print(f"No alternative image found for '{title}', using default.")
                    image = None  # Don't use a default image
            
            if image is None:
                print(f"No image available for '{title}'")
                caption = ""  # Clear caption when no image
        else:
            # Verify the original image matches the caption
            is_match, validated_caption = verify_image_caption_match(
                image, caption, title, content
            )
            
            if is_match:
                caption = validated_caption  # Use the validated/improved caption
                print(f"Verified original image for '{title}'")
            else:
                print(f"Original image doesn't match caption for '{title}', searching for alternative...")
                # Search for a better match
                search_images = search_wikipedia_images(title)
                
                if search_images:
                    # Try each image until we find a matching one
                    found_match = False
                    for img_url in search_images:
                        # Verify the image matches the title/content
                        is_match, validated_caption = verify_image_caption_match(
                            img_url, caption, title, content
                        )
                        
                        if is_match:
                            image = img_url
                            caption = validated_caption
                            print(f"Found better matching image for '{title}'")
                            found_match = True
                            break
                    
                    # If no match found but we have images, use first image
                    if not found_match and search_images:
                        image = search_images[0]
                        print(f"Using best available alternative for '{title}'")
                else:
                    # We'll keep the original image even if it's not a perfect match
                    print(f"Keeping original image for '{title}' despite imperfect match")

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

    # Save the latest generated cards to a file
    try:
        with open(LATEST_CARDS_FILE, 'w', encoding='utf-8') as f:
            json.dump(cards_out, f, ensure_ascii=False, indent=2)
        print(f"Saved latest cards to {LATEST_CARDS_FILE}")
    except Exception as e:
        print(f"Error saving cards to file: {e}")

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

# ---------------------------------------------------------------------------
# Image-caption validation
# ---------------------------------------------------------------------------

@lru_cache(maxsize=64)
def verify_image_caption_match(image_url: str, caption: str, title: str, content: str) -> Tuple[bool, str]:
    """
    Verify if an image matches its caption using OpenAI's vision capabilities.
    
    Args:
        image_url: URL of the image to check
        caption: Caption provided for the image
        title: Title of the note/card
        content: Content of the note/card

    Returns:
        Tuple of (is_match: bool, new_caption: str)
        - is_match: True if the image matches the caption/context
        - new_caption: Original or improved caption based on analysis
    """
    try:
        # Skip if no caption or no image
        if not caption or not image_url:
            return False, ""

        print(f"Validating image-caption match for '{title}'")
        
        # First, try a simpler text-based validation
        # Extract keywords from caption
        caption_keywords = extract_keywords(caption)
        title_keywords = extract_keywords(title)
        
        # Extract filename from URL
        filename = image_url.split('/')[-1]
        if 'File:' in filename:
            filename = filename.split('File:')[-1]
        
        # Clean up filename
        filename = re.sub(r'\.(jpg|jpeg|png|svg|gif)$', '', filename, flags=re.IGNORECASE)
        filename = filename.replace('_', ' ').replace('-', ' ')
        
        # Check if enough keywords match
        filename_words = set(extract_keywords(filename))
        caption_match = any(keyword in filename_words for keyword in caption_keywords)
        title_match = any(keyword in filename_words for keyword in title_keywords)
        
        # If we already have a strong text match, don't use the API
        if caption_match or title_match:
            print(f"Text-based validation successful for '{title}'")
            return True, caption
        
        # For more complex cases, we'll use Vision API
        try:
            # Prepare the messages for vision API
            context = f"Title: {title}\nContent: {content}"
            
            # Call the vision API
            vision_response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are an assistant that verifies if an image matches a caption and educational context."},
                    {"role": "user", "content": [
                        {"type": "text", "text": f"Educational context: {context}\n\nCaption: {caption}\n\nVerify if this image accurately represents the educational concept and caption. Answer ONLY with 'MATCH' or 'MISMATCH', followed by a better caption if needed."},
                        {"type": "image_url", "image_url": {"url": image_url}}
                    ]}
                ],
                max_tokens=150
            )
            
            # Process the response
            response_text = vision_response.choices[0].message.content
            print(f"Vision API response: {response_text[:50]}...")
            
            # Check if it's a match
            is_match = "MATCH" in response_text.upper().split()[0]
            
            # Extract improved caption if provided
            new_caption = caption
            if is_match and len(response_text) > 10:
                # Try to extract a better caption if provided
                caption_start = response_text.find(":")
                if caption_start > 0:
                    new_caption = response_text[caption_start+1:].strip()
                    # Truncate if too long
                    if len(new_caption) > 150:
                        new_caption = new_caption[:147] + "..."
            
            return is_match, new_caption
            
        except Exception as e:
            print(f"Vision API error: {e} - falling back to text matching")
            # Fall back to text matching
            return caption_match or title_match, caption
        
    except Exception as e:
        print(f"Error verifying image-caption match: {e}")
        return False, caption

def extract_keywords(text: str) -> List[str]:
    """Extract meaningful keywords from text, removing stopwords."""
    if not text:
        return []
        
    stopwords = ["a", "an", "the", "and", "or", "but", "in", "on", "at", "to", 
                "for", "with", "by", "about", "of", "this", "that", "these", 
                "those", "is", "are", "was", "were", "be", "been", "being", 
                "have", "has", "had", "do", "does", "did", "can", "could", 
                "will", "would", "shall", "should", "may", "might", "must"]
                
    # Convert to lowercase and split
    words = re.findall(r'\w+', text.lower())
    
    # Filter out stopwords and short words
    return [word for word in words if word not in stopwords and len(word) > 2]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
