import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

// Inline SVG placeholder that adapts to the note title
const PlaceholderImage = ({ title = "Note" }) => {
  // Generate a simple hash-based color from the title
  const getColorFromTitle = (text) => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generate pastel colors (lighter, softer colors)
    const h = Math.abs(hash) % 360;
    const s = 25 + (Math.abs(hash) % 30); // Lower saturation for pastel
    const l = 75 + (Math.abs(hash) % 15); // Higher lightness for pastel
    
    return `hsl(${h}, ${s}%, ${l}%)`;
  };

  // Extract first letter or icon based on title
  const getInitial = (text) => {
    return text && text.length > 0 ? text.charAt(0).toUpperCase() : "?";
  };

  const bgColor = getColorFromTitle(title);
  const initial = getInitial(title);

  return (
    <svg width="200" height="150" xmlns="http://www.w3.org/2000/svg" style={{ maxWidth: "100%" }}>
      <rect width="200" height="150" fill="#f0f0f0" stroke="#dddddd" strokeWidth="1" />
      <rect x="50" y="30" width="100" height="75" fill={bgColor} rx="8" ry="8" />
      <text 
        x="100" 
        y="75" 
        fontFamily="Arial" 
        fontSize="30" 
        fontWeight="bold" 
        textAnchor="middle" 
        fill="#ffffff"
        dominantBaseline="middle"
      >
        {initial}
      </text>
      <text x="100" y="120" fontFamily="Arial" fontSize="12" textAnchor="middle" fill="#999999">No image available</text>
    </svg>
  );
};

function NoteCard({ note, onDelete, onUpdate, dragHandleProps }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState("");
    const [editedImage, setEditedImage] = useState("");
    const [editedCaption, setEditedCaption] = useState("");
    const [imageError, setImageError] = useState(false);
    const textareaRef = useRef(null);
    const captionRef = useRef(null);

    useEffect(() => {
        setEditedText(`${note.title}\n\n${note.content}`);
        setEditedImage(note.image || "");
        setEditedCaption(note.caption || "");
        setImageError(false);
    }, [note]);

    // autoresize textarea to fit content
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
        }
        
        if (isEditing && captionRef.current) {
            captionRef.current.style.height = "auto";
            captionRef.current.style.height = captionRef.current.scrollHeight + "px";
        }
    }, [editedText, editedCaption, isEditing]);

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

        onUpdate({ ...note, title, content, image: editedImage, caption: editedCaption });
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditedImage(reader.result);
                setImageError(false);
            };
            reader.readAsDataURL(file);
        }
    };

    // Function to ensure image source is properly formatted
    const formatImageSrc = (imageSrc) => {
        if (!imageSrc) return '';
        
        // If it's a URL starting with http, use as is
        if (imageSrc.startsWith('http')) {
            return imageSrc;
        }
        
        // Remove any whitespace that might be in the base64 string
        imageSrc = imageSrc.replace(/\s/g, '');
        
        // If already a data URL, return as is
        if (imageSrc.startsWith('data:image/')) {
            return imageSrc;
        }
        
        // Add data:image prefix if it's a raw base64 string
        return `data:image/png;base64,${imageSrc}`;
    };

    // Handle image loading errors
    const handleImageError = (e) => {
        console.error("Image failed to load", e);
        setImageError(true);
    };

    // Check if image is valid and non-empty
    const hasValidImage = () => {
        return !!note.image && !imageError;
    };

    return (
        <div style={{ position: "relative", padding: "10px", paddingLeft: "50px" }}>
            <div
                style={{
                    cursor: "grab",
                    position: "absolute",
                    top: "10px",
                    left: "10px",
                    border: "none",
                    background: "transparent",
                    fontSize: "18px",
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
                        }}
                    />
                    <div style={{ marginTop: "10px" }}>
                        <label htmlFor={`image-upload-${note.id}`} style={{ display: "block", marginBottom: "5px" }}>
                            Image:
                        </label>
                        <input
                            id={`image-upload-${note.id}`}
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            style={{ marginBottom: "10px" }}
                        />
                        <div style={{ marginTop: "10px" }}>
                            {editedImage && !imageError ? (
                                <div className="image-container" style={{ 
                                    backgroundColor: "#f9f9f9", 
                                    border: "1px solid #eee",
                                    borderRadius: "4px",
                                    padding: "8px",
                                    display: "flex",
                                    flexDirection: "column", 
                                    justifyContent: "center",
                                    alignItems: "center",
                                    minHeight: "150px"
                                }}>
                                    <img
                                        src={formatImageSrc(editedImage)}
                                        alt="Note illustration"
                                        onError={handleImageError}
                                        style={{ 
                                            maxWidth: "100%", 
                                            maxHeight: "200px", 
                                            display: "block",
                                            objectFit: "contain"
                                        }}
                                    />
                                    <textarea
                                        ref={captionRef}
                                        value={editedCaption}
                                        onChange={(e) => setEditedCaption(e.target.value)}
                                        placeholder="Add image caption (optional)"
                                        style={{
                                            width: "calc(100% - 16px)",
                                            padding: "8px",
                                            marginTop: "10px",
                                            border: "1px solid #ccc",
                                            borderRadius: "4px",
                                            resize: "none",
                                            overflow: "hidden",
                                            boxSizing: "border-box",
                                            fontSize: "14px"
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="placeholder-container" style={{ 
                                    backgroundColor: "#f9f9f9", 
                                    border: "1px solid #eee",
                                    borderRadius: "4px",
                                    padding: "8px",
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    minHeight: "150px"
                                }}>
                                    <PlaceholderImage title={note.title} />
                                    {imageError && (
                                        <p style={{ color: "#666", fontSize: "12px", position: "absolute", bottom: "5px" }}>
                                            Image could not be loaded. Using placeholder.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
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
                        <ReactMarkdown
                            components={{
                                p: ({ node, ...props }) => <p style={{ margin: 0, marginTop: "5px" }} {...props} />,
                                ul: ({ node, ...props }) => <ul style={{ margin: 0, marginTop: "5px" }} {...props} />,
                            }}
                        >
                            {note.content}
                        </ReactMarkdown>
                    </div>
                    {hasValidImage() && <div style={{ marginTop: "10px" }}>
                        {hasValidImage() ? (
                            <div className="image-container" style={{ 
                                backgroundColor: "#f9f9f9", 
                                border: "1px solid #eee",
                                borderRadius: "4px",
                                padding: "8px",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                alignItems: "center",
                                minHeight: "150px"
                            }}>
                                <img
                                    src={formatImageSrc(note.image)}
                                    alt="Note illustration"
                                    onError={handleImageError}
                                    style={{ 
                                        maxWidth: "100%", 
                                        maxHeight: "200px", 
                                        display: "block",
                                        objectFit: "contain"
                                    }}
                                />
                                {note.caption && (
                                    <div style={{ 
                                        marginTop: "8px", 
                                        fontSize: "14px", 
                                        color: "#555", 
                                        fontStyle: "italic",
                                        textAlign: "center",
                                        maxWidth: "100%",
                                        padding: "0 8px"
                                    }}>
                                        {note.caption}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="placeholder-container" style={{ 
                                backgroundColor: "#f9f9f9", 
                                border: "1px solid #eee",
                                borderRadius: "4px",
                                padding: "8px",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                minHeight: "150px"
                            }}>
                                <PlaceholderImage title={note.title} />
                            </div>
                        )}
                    </div>}
                </div>
            )}
        </div>
    );
}

export default NoteCard;
