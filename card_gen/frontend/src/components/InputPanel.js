import React, { useCallback, useRef } from "react";

function InputPanel({ prompt, setPrompt, handleGenerate, isLoading, onFileUpload }) {
    const fileInputRef = useRef(null);

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === "Enter" && !isLoading) {
                handleGenerate();
            }
        },
        [handleGenerate, isLoading]
    );

    const handleButtonClick = useCallback(() => {
        if (!isLoading) {
            handleGenerate();
        }
    }, [handleGenerate, isLoading]);

    const handleFileInputChange = (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            onFileUpload(files);
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current.click();
    };

    return (
        <div style={{ flex: 0.5, marginRight: "20px" }}>
            <h2>What would you like to explore?</h2>
            <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={100}
                placeholder="e.g. Dolphins, Neural networks..."
                style={{ width: "100%", padding: "8px", fontSize: "16px" }}
                disabled={isLoading}
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                    onClick={handleButtonClick}
                    style={{
                        padding: "10px 20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        fontSize: "16px",
                        cursor: isLoading ? "not-allowed" : "pointer",
                        opacity: isLoading ? 0.7 : 1,
                        flex: 1,
                        backgroundColor: "#4285f4",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                    }}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <div className="spinner"></div>
                            Generating...
                        </>
                    ) : (
                        "Generate Cards"
                    )}
                </button>
                <button
                    onClick={handleUploadClick}
                    style={{
                        padding: "10px 20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        fontSize: "16px",
                        cursor: isLoading ? "not-allowed" : "pointer",
                        opacity: isLoading ? 0.7 : 1,
                        flex: 1,
                        backgroundColor: "#34a853",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                    }}
                    disabled={isLoading}
                >
                    <span style={{ display: "flex", alignItems: "center" }}>
                        <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            style={{ marginRight: "6px" }}
                        >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="17 8 12 3 7 8"></polyline>
                            <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                        Upload File(s)
                    </span>
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInputChange}
                    style={{ display: "none" }}
                    accept=".pdf,.pptx,.docx,.doc,.ppt,.mp4,.mov,.avi"
                    multiple
                />
            </div>
            <p style={{ fontSize: "12px", color: "#777", marginTop: "5px" }}>
                Supported formats: PDF, PowerPoint, Word documents, and videos
            </p>
            <style jsx>{`
                .spinner {
                    width: 16px;
                    height: 16px;
                    border: 3px solid rgba(255, 255, 255, 0.3);
                    border-radius: 50%;
                    border-top-color: white;
                    animation: spin 1s ease-in-out infinite;
                }

                @keyframes spin {
                    to {
                        transform: rotate(360deg);
                    }
                }
            `}</style>
        </div>
    );
}

export default InputPanel;
