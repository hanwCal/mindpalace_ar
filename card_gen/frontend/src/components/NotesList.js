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
                        <div {...provided.droppableProps} ref={provided.innerRef}>
                            {notes.map((note, index) => (
                                <Draggable key={note.id} draggableId={`note-${note.id}`} index={index}>
                                    {(provided) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            style={{
                                                border: "1px solid #ccc",
                                                marginBottom: "10px",
                                                backgroundColor: "white",
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
        </div>
    );
}

export default NotesList;
