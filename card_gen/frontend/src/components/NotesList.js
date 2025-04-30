import React from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import NoteCard from "./NoteCard";

function NotesList({ notes, onDeleteNote, onUpdateNote, onDragEnd, onDownloadCards, onDeleteAllCards }) {
    return (
        <div style={{ flex: 1 }}>
            <h2>Notes</h2>
            {notes.length > 0 && (
                <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                    <button
                        onClick={onDownloadCards}
                        style={{
                            padding: "8px 15px",
                            backgroundColor: "#4CAF50",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "14px",
                        }}
                    >
                        Download Cards as JSON
                    </button>
                    <button
                        onClick={onDeleteAllCards}
                        style={{
                            padding: "8px 15px",
                            backgroundColor: "#f44336",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "14px",
                        }}
                    >
                        Delete All Cards
                    </button>
                </div>
            )}
            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="notes">
                    {(provided) => (
                        <div 
                            {...provided.droppableProps} 
                            ref={provided.innerRef}
                            style={{ 
                                maxHeight: "calc(100vh - 180px)", 
                                overflowY: "auto",
                                padding: "5px"
                            }}
                        >
                            {notes.map((note, index) => (
                                <Draggable 
                                    key={note.id || `note-${index}`} 
                                    draggableId={note.id ? note.id.toString() : `note-${index}`} 
                                    index={index}
                                >
                                    {(provided) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            style={{
                                                border: "1px solid #ccc",
                                                marginBottom: "10px",
                                                backgroundColor: "white",
                                                borderRadius: "5px",
                                                boxShadow: "0 2px 5px rgba(0, 0, 0, 0.1)",
                                                ...provided.draggableProps.style,
                                            }}
                                        >
                                            <NoteCard
                                                note={note}
                                                dragHandleProps={provided.dragHandleProps}
                                                onDelete={() => onDeleteNote(index)}
                                                onUpdate={(updatedNote) => onUpdateNote(index, updatedNote)}
                                            />
                                        </div>
                                    )}
                                </Draggable>
                            ))}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>
            {notes.length === 0 && (
                <div style={{ 
                    textAlign: "center", 
                    padding: "30px", 
                    color: "#666",
                    border: "1px dashed #ccc",
                    borderRadius: "5px",
                    marginTop: "20px"
                }}>
                    No cards yet. Generate some cards or upload files to get started.
                </div>
            )}
        </div>
    );
}

export default NotesList;
