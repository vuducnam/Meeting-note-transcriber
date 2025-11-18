import React, { useState } from 'react';
import { RecordingMetadata } from '../types';
import { TrashIcon, DownloadIcon, RefreshCwIcon, EditIcon } from './icons';

interface SavedRecordingsListProps {
  recordings: RecordingMetadata[];
  onDelete: (id: number) => void;
  onDownload: (id: number) => void;
  onRetry: (id: number) => void;
  onSelect: (id: number) => void;
  onUpdateName: (id: number, name: string) => void;
  isBusy: boolean;
  activeRecordingId: number | null;
  confirmingDeleteId: number | null;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}

const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true,
    });
};

export const SavedRecordingsList: React.FC<SavedRecordingsListProps> = ({ 
    recordings, 
    onDelete, 
    onDownload, 
    onRetry, 
    onSelect, 
    onUpdateName,
    isBusy, 
    activeRecordingId,
    confirmingDeleteId,
    onConfirmDelete,
    onCancelDelete
}) => {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editedName, setEditedName] = useState<string>('');

    if (recordings.length === 0) {
        return <p className="text-sm text-center text-slate-500 dark:text-slate-400 my-4">No saved recordings yet.</p>;
    }

    const handleEditClick = (e: React.MouseEvent, rec: RecordingMetadata) => {
        e.stopPropagation();
        if (isBusy) return;
        setEditingId(rec.id);
        setEditedName(rec.name);
    };

    const handleNameSave = () => {
        if (editingId !== null && editedName.trim()) {
            const originalRecording = recordings.find(r => r.id === editingId);
            if (originalRecording && originalRecording.name !== editedName.trim()) {
                onUpdateName(editingId, editedName.trim());
            }
        }
        setEditingId(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleNameSave();
        } else if (e.key === 'Escape') {
            setEditingId(null);
        }
    };

    return (
        <div className="">
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 -mr-2">
                {recordings.map((rec) => (
                    <div 
                        key={rec.id} 
                        onClick={() => !isBusy && onSelect(rec.id)}
                        className={`p-3 rounded-xl border transition-all duration-200 ${
                            isBusy ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                        } ${
                            activeRecordingId === rec.id 
                                ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 dark:border-indigo-600 shadow-md' 
                                : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex-grow min-w-0">
                                {editingId === rec.id ? (
                                    <input
                                        type="text"
                                        value={editedName}
                                        onChange={(e) => setEditedName(e.target.value)}
                                        onBlur={handleNameSave}
                                        onKeyDown={handleKeyDown}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full text-sm font-medium bg-transparent border-b border-indigo-500 dark:border-indigo-400 focus:outline-none p-0 mb-0.5 text-slate-900 dark:text-slate-100"
                                        autoFocus
                                    />
                                ) : (
                                    <div className="flex items-center gap-1.5 group">
                                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate" title={rec.name}>
                                            {rec.name}
                                        </p>
                                        <button
                                            onClick={(e) => handleEditClick(e, rec)}
                                            disabled={isBusy}
                                            aria-label={`Edit name for ${rec.name}`}
                                            title="Edit name"
                                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-0 transition-opacity flex-shrink-0"
                                        >
                                            <EditIcon className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {formatDate(rec.id)} &bull; {formatBytes(rec.size)}
                                </p>
                            </div>
                            <div className="flex items-center space-x-1 ml-4 flex-shrink-0">
                                {confirmingDeleteId !== rec.id && (
                                    <>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onRetry(rec.id); }}
                                            disabled={isBusy}
                                            aria-label={`Retry transcription for recording from ${formatDate(rec.id)}`}
                                            title="Retry Transcription"
                                            className="p-2 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:text-slate-300 dark:disabled:text-slate-600 disabled:cursor-not-allowed rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                                        >
                                            <RefreshCwIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDownload(rec.id); }}
                                            disabled={isBusy}
                                            aria-label={`Download recording from ${formatDate(rec.id)}`}
                                            title="Download"
                                            className="p-2 text-slate-500 hover:text-green-600 disabled:text-slate-300 dark:disabled:text-slate-600 disabled:cursor-not-allowed rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                                        >
                                            <DownloadIcon className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDelete(rec.id); }}
                                            disabled={isBusy}
                                            aria-label={`Delete recording from ${formatDate(rec.id)}`}
                                            title="Delete"
                                            className="p-2 text-slate-500 hover:text-red-600 disabled:text-slate-300 dark:disabled:text-slate-600 disabled:cursor-not-allowed rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        {rec.status === 'transcribing' && (
                            <div className="mt-2">
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                                    <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${rec.progress}%` }}></div>
                                </div>
                            </div>
                        )}
                        {rec.status === 'failed' && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-semibold">Transcription failed</p>
                        )}
                        {confirmingDeleteId === rec.id && (
                            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2 text-xs">
                                <p className="font-medium text-slate-800 dark:text-slate-200 mr-auto">Delete?</p>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onConfirmDelete(); }}
                                    className="px-3 py-1 font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md"
                                >
                                    Yes
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onCancelDelete(); }}
                                    className="px-3 py-1 font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md"
                                >
                                    No
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};