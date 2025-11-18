import React, { useCallback, useEffect, useState, useRef } from 'react';
import { TranscriptChunk } from '../types';
import { LoaderIcon, RefreshCwIcon, ChevronRightIcon, ChevronDownIcon, EditIcon } from './icons';
import { EditTranscriptModal } from './EditTranscriptModal';

interface TranscriptDisplayProps {
  chunks: TranscriptChunk[];
  onRetry: (chunkIndex: number) => void;
  onUpdate: (chunkIndex: number, newContent: string) => void;
  isProcessing: boolean;
  isRecording: boolean;
  onEditAndUpdateVocabulary: (params: {
    oldText: string;
    newText: string;
    replaceAll: boolean;
    addToVocabulary: boolean;
    chunkIndex: number;
    start: number;
    end: number;
  }) => void;
}

const TranscriptPlaceholder: React.FC<{ icon?: React.ReactNode, title: string, subtitle: string }> = ({ icon, title, subtitle }) => (
    <div className="w-full min-h-48 p-3 mt-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center text-center text-slate-500 dark:text-slate-400 text-sm">
      {icon}
      <p className="font-semibold mt-2">{title}</p>
      <p className="text-xs">{subtitle}</p>
    </div>
);

export const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({ chunks, onRetry, onUpdate, isProcessing, isRecording, onEditAndUpdateVocabulary }) => {
    const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());
    const [selectionInfo, setSelectionInfo] = useState<{ 
        text: string; 
        chunkIndex: number; 
        start: number; 
        end: number;
        popupPosition: { top: number; left: number };
    } | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    
    // Auto-expand the first chunk when it's completed
    useEffect(() => {
        if (chunks.length > 0 && chunks[0].status === 'completed' && expandedChunks.size === 0) {
            setExpandedChunks(new Set([0]));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chunks.length > 0 && chunks[0].status]);

    useEffect(() => {
        const handleClickOutside = () => {
            if (selectionInfo && !isEditModalOpen) {
                setSelectionInfo(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [selectionInfo, isEditModalOpen]);

    const toggleChunkExpansion = (index: number) => {
        setExpandedChunks(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };
    
    const autoResizeTextarea = (element: HTMLTextAreaElement) => {
        element.style.height = 'auto';
        element.style.height = `${element.scrollHeight}px`;
    };

    const measuredRef = useCallback((node: HTMLTextAreaElement) => {
        if (node !== null) {
            autoResizeTextarea(node);
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>, chunkIndex: number) => {
        autoResizeTextarea(e.target);
        onUpdate(chunkIndex, e.target.value);
    }

    const handleMouseUp = (e: React.MouseEvent<HTMLTextAreaElement>, chunkIndex: number) => {
        const textarea = e.currentTarget;
        const selectionStart = textarea.selectionStart;
        const selectionEnd = textarea.selectionEnd;
        const selectedText = textarea.value.substring(selectionStart, selectionEnd);

        if (selectedText.trim().length > 0) {
            setSelectionInfo({
                text: selectedText,
                chunkIndex: chunkIndex,
                start: selectionStart,
                end: selectionEnd,
                popupPosition: {
                    top: e.clientY - 45, // Position 45px above the mouse cursor
                    left: e.clientX,     // Center horizontally on the mouse cursor
                }
            });
        } else {
            setSelectionInfo(null);
        }
    };
  
    if (isRecording) {
        return <TranscriptPlaceholder title="Recording in progress..." subtitle="Transcription will begin after you stop." />;
    }

    if (isProcessing && chunks.length === 0) {
        return <TranscriptPlaceholder icon={<LoaderIcon className="w-6 h-6" />} title="Transcription in progress..." subtitle="Please wait a moment." />;
    }

    if (chunks.length === 0) {
        return <TranscriptPlaceholder title="No transcript yet" subtitle="Your transcript will appear here after recording or uploading." />;
    }

  return (
    <>
      {selectionInfo && !isEditModalOpen && (
        <div
            className="fixed z-20"
            style={{ top: `${selectionInfo.popupPosition.top}px`, left: `${selectionInfo.popupPosition.left}px`, transform: 'translateX(-50%)' }}
            onMouseDown={e => e.stopPropagation()}
        >
            <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
            >
                <EditIcon className="w-4 h-4" />
                Edit & update vocabulary
            </button>
        </div>
      )}

      {selectionInfo && (
        <EditTranscriptModal
            isOpen={isEditModalOpen}
            onClose={() => {
                setIsEditModalOpen(false);
                setSelectionInfo(null);
            }}
            selectedText={selectionInfo.text}
            onConfirm={(newText, replaceAll, addToVocabulary) => {
                onEditAndUpdateVocabulary({
                    oldText: selectionInfo.text,
                    newText,
                    replaceAll,
                    addToVocabulary,
                    chunkIndex: selectionInfo.chunkIndex,
                    start: selectionInfo.start,
                    end: selectionInfo.end,
                });
                setIsEditModalOpen(false);
                setSelectionInfo(null);
            }}
        />
      )}

      <div className="w-full min-h-48 max-h-96 mt-2 border border-slate-300 dark:border-slate-700 rounded-xl overflow-y-auto text-sm space-y-2 p-2 bg-slate-50 dark:bg-slate-900/50">
        {chunks.map((chunk) => {
            const isExpanded = expandedChunks.has(chunk.index);
            const wordCount = chunk.status === 'completed' ? chunk.content.trim().split(/\s+/).filter(Boolean).length : 0;
            return (
              <div key={chunk.index} className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 shadow-sm transition-all duration-200">
                  <div
                      className="flex items-center gap-3 p-3 cursor-pointer"
                      onClick={() => toggleChunkExpansion(chunk.index)}
                      aria-expanded={isExpanded}
                      aria-controls={`chunk-content-${chunk.index}`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleChunkExpansion(chunk.index)}}
                  >
                      {isExpanded ? <ChevronDownIcon className="w-4 h-4 text-slate-500 flex-shrink-0" /> : <ChevronRightIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />}
                      <div className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500">{String(chunk.index + 1).padStart(2, '0')}</div>
                      
                      <div className="flex-grow flex items-center gap-2 min-w-0">
                          {chunk.status === 'completed' && <span className="px-2 py-0.5 text-xs font-semibold text-green-800 bg-green-100 dark:text-green-200 dark:bg-green-900/50 rounded-full">Completed</span>}
                          {chunk.status === 'failed' && <span className="px-2 py-0.5 text-xs font-semibold text-red-800 bg-red-100 dark:text-red-200 dark:bg-red-900/50 rounded-full">Failed</span>}
                          {chunk.status === 'processing' && <span className="px-2 py-0.5 text-xs font-semibold text-indigo-800 bg-indigo-100 dark:text-indigo-200 dark:bg-indigo-900/50 rounded-full flex items-center"><LoaderIcon className="w-3 h-3 mr-1"/> Processing</span>}
                          {wordCount > 0 && <span className="text-xs text-slate-500 truncate hidden sm:inline">({wordCount} words)</span>}
                      </div>
                      
                      {chunk.status === 'failed' && (
                          <button
                              onClick={(e) => { e.stopPropagation(); onRetry(chunk.index); }}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 font-semibold flex-shrink-0"
                              title="Retry this chunk"
                          >
                              <RefreshCwIcon className="w-3 h-3" />
                              Retry
                          </button>
                      )}
                  </div>

                  {isExpanded && (
                      <div id={`chunk-content-${chunk.index}`} className="border-t border-slate-200 dark:border-slate-700 px-4 pb-3 pt-2 ml-10">
                          {chunk.status === 'failed' && (
                              <div className="text-xs text-red-600 dark:text-red-400 font-medium py-2">
                                  <strong>Transcription failed:</strong>
                                  <pre className="whitespace-pre-wrap break-all bg-red-50 dark:bg-red-900/30 p-2 rounded-md mt-1 font-mono text-slate-800 dark:text-slate-200">{chunk.content || "An unknown error occurred."}</pre>
                              </div>
                          )}
                          {chunk.status === 'completed' && (
                              <textarea
                                  ref={measuredRef}
                                  value={chunk.content}
                                  onChange={(e) => handleChange(e, chunk.index)}
                                  onMouseUp={(e) => handleMouseUp(e, chunk.index)}
                                  className="w-full p-0 border-none focus:ring-0 resize-none bg-transparent block text-sm leading-6 text-slate-800 dark:text-slate-200"
                                  rows={1}
                                  onClick={e => e.stopPropagation()} // Prevent closing when clicking textarea
                              />
                          )}
                          {chunk.status === 'processing' && (
                              <p className="text-xs text-slate-500 py-2">Processing chunk...</p>
                          )}
                      </div>
                  )}
              </div>
            )
        })}
      </div>
    </>
  );
};