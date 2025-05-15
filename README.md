# Mind Palace AR

Mind Palace AR is an innovative learning tool that combines web-based flashcard generation with augmented reality spatial learning. It allows users to create interactive study cards and place them in their physical environment using VisionOS, leveraging spatial memory for enhanced learning.

## Features

- **Web Interface (card_gen)**
  - Dynamic card generation from topic input
  - Automatic keyword extraction
  - Smart image search with validation
  - Real-time card editing and reordering
  - [Ongoing] Custom image upload support
  - JSON export functionality
  - Instant synchronization

- **VisionOS App**
  - Seamless integration with web-generated cards
  - Intuitive gaze and gesture controls
  - Precise spatial placement of cards
  - Persistent card anchoring
  - Cross-room interaction capability

## System Architecture

The system consists of two main components:
1. A web application (card_gen) for generating and managing study cards
2. A VisionOS application for AR-based spatial learning

## Deployment Instructions

### Web Application (card_gen)

The web application consists of a backend and frontend that need to be run separately.

#### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd card_gen/backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the backend server:
   ```bash
   uvicorn api:app --reload
   ```
4. Start the server-vp API
   ```bash
   python card_gen/backend/latest_card_api.py
   ```

#### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd card_gen/frontend
   ```
2. Install Node.js dependencies:
   ```bash
   npm install
   ```
3. Start the frontend development server:
   ```bash
   npm start
   ```

The web application will be accessible through your browser at the default address shown in the terminal.

### VisionOS Application

#### Requirements
- Xcode 15.0 or later
- VisionOS SDK 2.0 or later

#### Building the App
The VisionOS application is ready to build. Simply open the project in Xcode and build for the Vision Pro simulator or device.

## Contact

For questions or support, please reach out to the project maintainers hanw@berkeley.edu