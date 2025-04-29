import React, { useCallback } from "react";

function InputPanel({ prompt, setPrompt, handleGenerate, isLoading }) {
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
            <button
                onClick={handleButtonClick}
                style={{
                    marginTop: "10px",
                    padding: "10px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    fontSize: "16px",
                    cursor: isLoading ? "not-allowed" : "pointer",
                    opacity: isLoading ? 0.7 : 1,
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
