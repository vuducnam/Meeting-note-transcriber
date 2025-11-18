
import React, { useEffect, useState, useRef } from 'react';
import { LoaderIcon, SparklesIcon, CopyIcon, CheckIcon, ChevronDownIcon, FileTextIcon, DownloadIcon, EditIcon } from './icons';
import { EditTranscriptModal } from './EditTranscriptModal';

interface NotePreviewProps {
  notes: string;
  isLoading: boolean;
  isEditable: boolean;
  onUpdateNotes?: (newNotes: string) => void;
  onEditAndUpdateVocabulary?: (params: {
    oldText: string;
    newText: string;
    replaceAll: boolean;
    addToVocabulary: boolean;
    start: number;
    end: number;
  }) => void;
}

// Since we are loading `marked` from a CDN, we need to declare it globally for TypeScript
declare global {
    interface Window {
      marked: {
        parse: (markdown: string) => string;
      };
      jspdf: any;
      html2canvas: any;
    }
  }

export const NotePreview: React.FC<NotePreviewProps> = ({ notes, isLoading, isEditable, onUpdateNotes, onEditAndUpdateVocabulary }) => {
    const [htmlContent, setHtmlContent] = useState('');
    const [copyStatus, setCopyStatus] = useState<string | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [selectionInfo, setSelectionInfo] = useState<{ 
        text: string;
        start: number;
        end: number;
        popupPosition: { top: number; left: number };
    } | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (notes && window.marked) {
            setHtmlContent(window.marked.parse(notes));
        } else {
            setHtmlContent('');
        }
    }, [notes]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
            if (selectionInfo && !isEditModalOpen) {
                setSelectionInfo(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [selectionInfo, isEditModalOpen]);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [isEditing, notes]);

    const handleEditToggle = () => {
        setIsEditing(prev => !prev);
    };

    const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (onUpdateNotes) {
            onUpdateNotes(e.target.value);
        }
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };

    const handleMouseUp = (e: React.MouseEvent<HTMLTextAreaElement>) => {
        if (!onEditAndUpdateVocabulary) return;
        const textarea = e.currentTarget;
        const selectionStart = textarea.selectionStart;
        const selectionEnd = textarea.selectionEnd;
        const selectedText = textarea.value.substring(selectionStart, selectionEnd);

        if (selectedText.trim().length > 0) {
            setSelectionInfo({
                text: selectedText,
                start: selectionStart,
                end: selectionEnd,
                popupPosition: {
                    top: e.clientY - 45,
                    left: e.clientX,
                }
            });
        } else {
            setSelectionInfo(null);
        }
    };

    const handleCopyText = () => {
        if (!notes) return;
        navigator.clipboard.writeText(notes).then(() => {
            setCopyStatus('text');
            setIsMenuOpen(false);
            setTimeout(() => setCopyStatus(null), 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    };

    const handleCopyToDoc = () => {
        if (!htmlContent) return;
        try {
            const blob = new Blob([htmlContent], { type: 'text/html' });
            // This is a modern browser API, may not be in all TS lib versions.
            const item = new (window as any).ClipboardItem({ 'text/html': blob });
            navigator.clipboard.write([item]).then(() => {
                setCopyStatus('doc');
                setIsMenuOpen(false);
                setTimeout(() => setCopyStatus(null), 2000);
            }).catch(err => {
                console.error('Failed to copy HTML:', err);
            });
        } catch (e) {
            console.error('Clipboard API error, falling back to plain text:', e);
            handleCopyText();
        }
    };

    const handleDownloadPdf = async () => {
        if (!contentRef.current || !notes) return;
        setIsMenuOpen(false);
        setIsPdfLoading(true);
    
        try {
            const { jsPDF } = window.jspdf;
            const content = contentRef.current;
            const wasEditing = isEditing;
            if (wasEditing) setIsEditing(false); // Temporarily switch to view mode for capture

            // Allow DOM to update before capturing
            await new Promise(resolve => setTimeout(resolve, 50));

            const canvas = await window.html2canvas(content, {
                scale: 2,
                backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff',
                useCORS: true,
                onclone: (docClone) => {
                    // Ensure dark mode styles are applied in the canvas render
                    if (document.documentElement.classList.contains('dark')) {
                        docClone.querySelector('.prose')?.classList.add('dark');
                    }
                }
            });
            
            if (wasEditing) setIsEditing(true); // Switch back if needed

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'pt',
                format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasAspectRatio = canvas.width / canvas.height;
            
            const margin = 40; // 20pt margin on each side
            const contentWidth = pdfWidth - margin * 2;
            const contentHeight = contentWidth / canvasAspectRatio;

            let heightLeft = contentHeight;
            let position = margin;

            // Add the first page
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, position, contentWidth, contentHeight);
            heightLeft -= (pdfHeight - margin * 2);

            // Add new pages if content overflows
            while (heightLeft > 0) {
                position = heightLeft - contentHeight + margin; // Recalculate position for the new page
                pdf.addPage();
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, position, contentWidth, contentHeight);
                heightLeft -= (pdfHeight - margin * 2);
            }

            pdf.save(`meeting-notes-${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
        } finally {
            setIsPdfLoading(false);
        }
    };
    
    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg p-6 h-full flex flex-col">
            {selectionInfo && !isEditModalOpen && onEditAndUpdateVocabulary && (
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
            {selectionInfo && onEditAndUpdateVocabulary && (
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
                            start: selectionInfo.start,
                            end: selectionInfo.end,
                        });
                        setIsEditModalOpen(false);
                        setSelectionInfo(null);
                    }}
                />
            )}

            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 flex items-center">
                    <SparklesIcon className="w-6 h-6 mr-3 text-indigo-500" />
                    Formatted Notes
                </h2>
                <div className="flex items-center gap-2">
                    {isEditable && notes && !isLoading && (
                        <button
                            onClick={handleEditToggle}
                            className="flex items-center space-x-2 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-800 transition-colors"
                        >
                            {isEditing ? (
                                <>
                                    <CheckIcon className="w-4 h-4 text-green-500" />
                                    <span>Done</span>
                                </>
                            ) : (
                                <>
                                    <EditIcon className="w-4 h-4" />
                                    <span>Edit</span>
                                </>
                            )}
                        </button>
                    )}
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setIsMenuOpen(prev => !prev)}
                            disabled={!notes || isLoading || isPdfLoading}
                            className="flex items-center space-x-2 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isPdfLoading ? (
                                <>
                                    <LoaderIcon className="w-4 h-4" />
                                    <span>Generating PDF...</span>
                                </>
                            ) : copyStatus ? (
                                <>
                                    <CheckIcon className="w-4 h-4 text-green-500" />
                                    <span>{copyStatus === 'text' ? 'Text Copied!' : 'Copied for Doc!'}</span>
                                </>
                            ) : (
                                <>
                                    <CopyIcon className="w-4 h-4" />
                                    <span>Export</span>
                                    <ChevronDownIcon className="w-4 h-4 -mr-1" />
                                </>
                            )}
                        </button>
                        {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-56 origin-top-right bg-white dark:bg-slate-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10 border border-slate-200 dark:border-slate-700">
                                <div className="py-1">
                                    <button
                                        onClick={handleCopyText}
                                        className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                                    >
                                        <CopyIcon className="w-4 h-4 mr-3" />
                                        <span>Copy as Markdown Text</span>
                                    </button>
                                    <button
                                        onClick={handleCopyToDoc}
                                        className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                                    >
                                        <FileTextIcon className="w-4 h-4 mr-3" />
                                        <span>Copy for Google Docs</span>
                                    </button>
                                    <button
                                        onClick={handleDownloadPdf}
                                        className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                                    >
                                        <DownloadIcon className="w-4 h-4 mr-3" />
                                        <span>Download as PDF</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div ref={contentRef} className="prose max-w-none flex-grow overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900/50">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
                        <LoaderIcon className="w-8 h-8 mb-4" />
                        <span className="font-semibold">Generating notes...</span>
                        <span className="text-sm">This may take a moment.</span>
                    </div>
                ) : notes ? (
                     isEditing && onUpdateNotes ? (
                        <textarea
                            ref={textareaRef}
                            value={notes}
                            onChange={handleNotesChange}
                            onMouseUp={handleMouseUp}
                            className="w-full min-h-[50vh] p-0 border-none focus:ring-0 resize-none bg-transparent block text-slate-800 dark:text-slate-200"
                            autoFocus
                        />
                    ) : (
                        <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                    )
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400 text-center">
                        <p>Your AI-generated notes will appear here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};