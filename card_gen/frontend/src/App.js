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
            // Assuming the response is a formatted text that needs to be converted to cards
            const generatedNotes = processResponseIntoCards(responseText, prompt);
            
            setNotes((prevNotes) => [...prevNotes, ...generatedNotes]);
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
        // Simple processing: Split by double newlines to separate concepts
        // This is a basic implementation - you may need to adjust based on actual response format
        const sections = responseText.split('\n\n').filter(section => section.trim() !== '');
        
        return sections.map((section, index) => {
            // For each section, create a card with title and content
            const lines = section.split('\n');
            const title = lines[0] || `${originalPrompt} - Note ${index + 1}`;
            const content = lines.slice(1).join('\n') || section;
            
            return {
                title: title,
                content: content
            };
        });
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
        console.log(notes);
        const updatedNotes = Array.from(notes);
        const [removed] = updatedNotes.splice(result.source.index, 1);
        updatedNotes.splice(result.destination.index, 0, removed);
        setNotes(updatedNotes);
    };

    const handleDownloadCards = () => {
        if (notes.length === 0) return;

        const cardsToDownload = notes.map((note) => ({
            title: note.title,
            content: note.content,
        }));

        const jsonString = JSON.stringify(cardsToDownload, null, 2);

        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        // create link to trigger download
        const link = document.createElement("a");
        link.href = url;
        link.download = "cards.json";
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
