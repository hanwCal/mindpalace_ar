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
                    // The request was made and the server responded with a status code
                    // that falls out of the range of 2xx
                    errorMessage = `Server error: ${error.response.status} - ${error.response.statusText}`;
                    console.error("Error response data:", error.response.data);
                } else if (error.request) {
                    // The request was made but no response was received
                    errorMessage = "No response received from server";
                } else {
                    // Something happened in setting up the request that triggered an Error
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
            console.log("Sending request to:", `${BACKEND_URL}/generate-notes`);
            const response = await axios.post(`${BACKEND_URL}/generate-notes`, { prompt });
            console.log("Response received:", response.data);
            setNotes((prevNotes) => [...prevNotes, ...response.data]);
            setPrompt("");
        } catch (error) {
            console.error("Error generating notes", error);
            let errorMessage = "Unknown error";

            if (error.response) {
                errorMessage = `Server error: ${error.response.status} - ${error.response.statusText}`;
                console.error("Error response data:", error.response.data);
            } else if (error.request) {
                errorMessage = "No response received from server";
            } else {
                errorMessage = error.message;
            }

            alert(`Error generating notes: ${errorMessage}`);
        } finally {
            setIsLoading(false);
            requestInProgress.current = false;
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

    return (
        <div style={{ display: "flex", padding: "20px", maxWidth: "1200px", margin: "0 auto", gap: "40px" }}>
            <div>
                <InputPanel
                    prompt={prompt}
                    setPrompt={setPrompt}
                    handleGenerate={handleGenerate}
                    isLoading={isLoading}
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
