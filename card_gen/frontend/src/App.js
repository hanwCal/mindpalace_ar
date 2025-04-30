import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import InputPanel from "./components/InputPanel";
import NotesList from "./components/NotesList";

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");

function App() {
    const [prompt, setPrompt] = useState("");
    const [notes, setNotes] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [backendStatus, setBackendStatus] = useState("Checking...");
    const [backendDetails, setBackendDetails] = useState("");
    const requestInProgress = useRef(false);

    // Check if backend is accessible
    useEffect(() => {
        const checkBackend = async () => {
            try {
                console.log("Checking backend at:", BACKEND_URL);
                const response = await axios.get(`${BACKEND_URL}/test`);
                console.log("Backend response:", response.data);
                setBackendStatus("Connected");
            } catch (error) {
                console.error("Backend connection error:", error);
                let errorMessage = "Unknown error";

                if (error.response) {
                    errorMessage = `Server error: ${error.response.status} - ${error.response.statusText}`;
                    console.error("Error response data:", error.response.data);
                } else if (error.request) {
                    errorMessage = "No response received from server";
                } else {
                    errorMessage = error.message;
                }

                setBackendStatus(`Error: ${errorMessage}`);
                setBackendDetails(`URL: ${BACKEND_URL}`);
            }
        };

        checkBackend();
    }, []);

    const handleGenerate = async () => {
        if (!prompt.trim() || requestInProgress.current) return;

        requestInProgress.current = true;
        setIsLoading(true);

        try {
            // Use Reagent Noggin API instead of the backend
            console.log("Sending request to Reagent Noggin API");
            const response = await fetch(
                'https://noggin.rea.gent/chosen-mollusk-9962',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer rg_v1_zmstww0es8el30r7z3v5v979nu7hsbpplrt6_ngk',
                    },
                    body: JSON.stringify({
                        "topic": prompt,
                    }),
                }
            );
            
            const responseText = await response.text();
            console.log("Reagent response received:", responseText);
            
            // Parse the response to create note cards
            const generatedNotes = processResponseIntoCards(responseText, prompt);
            
            // Add unique IDs to each note if they don't already have one
            const notesWithIds = generatedNotes.map(note => ({
                ...note,
                id: note.id || `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            }));
            
            setNotes((prevNotes) => [...prevNotes, ...notesWithIds]);
            setPrompt("");
        } catch (error) {
            console.error("Error generating notes", error);
            let errorMessage = "Error calling Reagent Noggin API";
            alert(`Error generating notes: ${errorMessage}`);
        } finally {
            setIsLoading(false);
            requestInProgress.current = false;
        }
    };
    
    // Function to process the Reagent response into card format
    const processResponseIntoCards = (responseText, originalPrompt) => {
        try {
            // First try to parse as JSON
            let jsonData;
            
            // Check if response contains JSON
            // Look for JSON data in the response
            const jsonMatch = responseText.match(/\[.*\]/s) || responseText.match(/\{.*\}/s);
            
            if (jsonMatch) {
                try {
                    jsonData = JSON.parse(jsonMatch[0]);
                } catch (e) {
                    console.log("Couldn't parse first JSON match, trying full response");
                    try {
                        jsonData = JSON.parse(responseText);
                    } catch (e2) {
                        console.log("Couldn't parse response as JSON, falling back to text processing");
                    }
                }
            }
            
            // If we successfully parsed JSON
            if (jsonData) {
                console.log("Processed response as JSON", jsonData);
                
                // Handle array of objects
                if (Array.isArray(jsonData)) {
                    return jsonData.map(item => {
                        // Check for different possible JSON formats
                        if (item.title && (item.content || item.description)) {
                            return {
                                id: Date.now() + Math.random(),
                                title: item.title,
                                content: item.content || item.description
                            };
                        } else if (item.word || item.term) {
                            return {
                                id: Date.now() + Math.random(),
                                title: item.word || item.term || item.question || `Card ${Math.floor(Math.random() * 1000)}`,
                                content: item.definition || item.description || item.answer || item.info || ""
                            };
                        } else {
                            // Handle case where we have a simple key-value object
                            const key = Object.keys(item)[0];
                            return {
                                id: Date.now() + Math.random(),
                                title: key,
                                content: item[key]
                            };
                        }
                    });
                } 
                // Handle object with cards array
                else if (jsonData.cards || jsonData.flashcards) {
                    const cardsArray = jsonData.cards || jsonData.flashcards;
                    if (Array.isArray(cardsArray)) {
                        return processResponseIntoCards(JSON.stringify(cardsArray), originalPrompt);
                    }
                }
                // Handle single object
                else if (typeof jsonData === 'object') {
                    const cards = [];
                    // Convert object keys to cards
                    for (const key in jsonData) {
                        if (jsonData.hasOwnProperty(key)) {
                            cards.push({
                                id: Date.now() + Math.random(),
                                title: key,
                                content: typeof jsonData[key] === 'object' 
                                    ? JSON.stringify(jsonData[key], null, 2) 
                                    : jsonData[key]
                            });
                        }
                    }
                    return cards;
                }
            }
            
            // Fallback to text processing if JSON parsing fails
            const sections = responseText.split('\n\n').filter(section => section.trim() !== '');
            
            return sections.map((section, index) => {
                const lines = section.split('\n');
                const title = lines[0] || `${originalPrompt} - Note ${index + 1}`;
                const content = lines.slice(1).join('\n') || section;
                
                return {
                    id: Date.now() + Math.random(),
                    title: title,
                    content: content
                };
            });
        } catch (error) {
            console.error("Error processing response:", error);
            // Return a single note with the full response if processing fails
            return [{
                id: Date.now(),
                title: originalPrompt,
                content: responseText
            }];
        }
    };

    const handleDeleteNote = (index) => {
        setNotes(notes.filter((_, i) => i !== index));
    };

    const handleDeleteAllCards = () => {
        setNotes([]);
    };

    const handleUpdateNote = (index, updatedNote) => {
        const newNotes = [...notes];
        newNotes[index] = updatedNote;
        setNotes(newNotes);
    };

    const handleDragEnd = (result) => {
        if (!result.destination) return;
        
        const items = Array.from(notes);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        
        setNotes(items);
    };

    const handleDownloadCards = () => {
        if (notes.length === 0) return;

        const cardsToDownload = notes.map((note) => ({
            id: note.id,
            title: note.title,
            content: note.content,
        }));

        const jsonString = JSON.stringify(cardsToDownload, null, 2);

        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        // create link to trigger download
        const link = document.createElement("a");
        link.href = url;
        link.download = "flashcards.json";
        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleFileUpload = async (files) => {
        if (requestInProgress.current) return;
        
        requestInProgress.current = true;
        setIsLoading(true);
        
        try {
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('files', files[i]);
            }
            
            console.log("Sending files to:", `${BACKEND_URL}/upload-files`);
            const response = await axios.post(`${BACKEND_URL}/upload-files`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            console.log("File upload response:", response.data);
            setNotes((prevNotes) => [...prevNotes, ...response.data]);
        } catch (error) {
            console.error("Error uploading files", error);
            let errorMessage = "Unknown error";

            if (error.response) {
                errorMessage = `Server error: ${error.response.status} - ${error.response.statusText}`;
                console.error("Error response data:", error.response.data);
            } else if (error.request) {
                errorMessage = "No response received from server";
            } else {
                errorMessage = error.message;
            }

            alert(`Error uploading files: ${errorMessage}`);
        } finally {
            setIsLoading(false);
            requestInProgress.current = false;
        }
    };

    return (
        <div style={{ display: "flex", padding: "20px", maxWidth: "1200px", margin: "0 auto", gap: "40px" }}>
            <div>
                <InputPanel
                    prompt={prompt}
                    setPrompt={setPrompt}
                    handleGenerate={handleGenerate}
                    isLoading={isLoading}
                    onFileUpload={handleFileUpload}
                />
            </div>
            <NotesList
                notes={notes}
                onDeleteNote={handleDeleteNote}
                onUpdateNote={handleUpdateNote}
                onDragEnd={handleDragEnd}
                onDownloadCards={handleDownloadCards}
                onDeleteAllCards={handleDeleteAllCards}
            />
        </div>
    );
}

export default App;
