import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

function NoteCard({ note, onDelete, onUpdate, dragHandleProps }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState("");
    const [isFlipped, setIsFlipped] = useState(false);
    const textareaRef = useRef(null);

    useEffect(() => {
        setEditedText(`${note.title}\n\n${note.content}`);
    }, [note]);

    // autoresize textarea to fit content
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
        }
    }, [editedText, isEditing]);

    const handleBlur = () => {
        setIsEditing(false);

        // split text into title(1st line) and content(remaining)
        const lines = editedText.split("\n");
        const title = lines[0] || "";
        const content = lines.slice(1).join("\n").trim();

        // delete note if title&content are empty
        if (!title.trim() && !content.trim()) {
            onDelete();
            return;
        }

        onUpdate({ ...note, title, content });
    };

    // Check if content looks like JSON and format it nicely
    const formatContentIfJSON = (content) => {
        if (typeof content !== 'string') return content;
        
        try {
            // Check if content starts with { or [ indicating JSON
            if ((content.trim().startsWith('{') && content.trim().endsWith('}')) || 
                (content.trim().startsWith('[') && content.trim().endsWith(']'))) {
                
                const parsedContent = JSON.parse(content);
                // Return the formatted JSON string
                return JSON.stringify(parsedContent, null, 2);
            }
            return content;
        } catch (e) {
            // If parsing fails, just return the original content
            return content;
        }
    };

    const formattedContent = formatContentIfJSON(note.content);

    return (
        <div 
            style={{ 
                position: "relative", 
                padding: "10px", 
                paddingLeft: "50px",
                transition: "transform 0.6s",
                transformStyle: "preserve-3d",
                transform: isFlipped ? "rotateY(180deg)" : ""
            }}
        >
            <div
                style={{
                    cursor: "grab",
                    position: "absolute",
                    top: "10px",
                    left: "10px",
                    border: "none",
                    background: "transparent",
                    fontSize: "18px",
                    zIndex: 1
                }}
            >
                ☰
            </div>

            <button
                onClick={onDelete}
                style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    border: "none",
                    background: "transparent",
                    fontSize: "18px",
                    cursor: "pointer",
                    zIndex: 1
                }}
            >
                ×
            </button>

            {isEditing ? (
                <div>
                    <textarea
                        ref={textareaRef}
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                        onBlur={handleBlur}
                        autoFocus
                        style={{
                            width: "calc(100% - 25px)",
                            padding: "8px",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                            resize: "none",
                            overflow: "hidden",
                            boxSizing: "border-box",
                            minHeight: "120px"
                        }}
                    />
                    <div
                        style={{
                            fontSize: "12px",
                            color: "#666",
                            marginTop: "5px",
                            fontStyle: "italic",
                        }}
                    >
                        Markdown supported: **bold**, *italic*, - bullet points, 1. numbered lists
                    </div>
                </div>
            ) : (
                <div onClick={() => setIsEditing(true)} style={{ cursor: "text" }}>
                    <h3 style={{ margin: "0 0 5px 0", fontSize: "18px", paddingRight: "25px" }}>{note.title}</h3>
                    <div style={{ margin: 0, paddingRight: "25px" }}>
                        {formattedContent.includes('```json') || formattedContent.startsWith('{') || formattedContent.startsWith('[') ? (
                            <pre style={{ 
                                whiteSpace: "pre-wrap", 
                                wordBreak: "break-word",
                                overflow: "auto", 
                                fontSize: "14px",
                                backgroundColor: "#f5f5f5",
                                padding: "8px",
                                borderRadius: "4px",
                                maxHeight: "200px"
                            }}>
                                {formattedContent}
                            </pre>
                        ) : (
                            <ReactMarkdown
                                components={{
                                    p: ({ node, ...props }) => <p style={{ margin: 0, marginTop: "5px" }} {...props} />,
                                    ul: ({ node, ...props }) => <ul style={{ margin: 0, marginTop: "5px" }} {...props} />,
                                    code: ({ node, inline, ...props }) => 
                                        inline ? (
                                            <code style={{ backgroundColor: "#f0f0f0", padding: "0.2em 0.4em", borderRadius: "3px" }} {...props} />
                                        ) : (
                                            <pre style={{ 
                                                backgroundColor: "#f5f5f5", 
                                                padding: "0.5em", 
                                                borderRadius: "5px",
                                                overflowX: "auto" 
                                            }}>
                                                <code {...props} />
                                            </pre>
                                        )
                                }}
                            >
                                {note.content}
                            </ReactMarkdown>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default NoteCard;
