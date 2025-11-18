import React, { useState, useEffect } from 'react';

interface EditTranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newText: string, replaceAll: boolean, addToVocabulary: boolean) => void;
  selectedText: string;
}

export const EditTranscriptModal: React.FC<EditTranscriptModalProps> = ({ isOpen, onClose, onConfirm, selectedText }) => {
  const [newText, setNewText] = useState(selectedText);
  const [replaceAll, setReplaceAll] = useState(true);
  const [addToVocabulary, setAddToVocabulary] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setNewText(selectedText);
      setReplaceAll(true);
      setAddToVocabulary(true);
    }
  }, [isOpen, selectedText]);

  if (!isOpen) {
    return null;
  }

  const handleConfirm = () => {
    if (newText.trim()) {
      onConfirm(newText, replaceAll, addToVocabulary);
    }
  };

  return (
    <div 
        className="fixed inset-0 bg-slate-900 bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
        aria-modal="true"
        role="dialog"
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Edit Transcript & Update Vocabulary</h2>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Replace "<span className="font-bold truncate max-w-xs inline-block align-bottom">{selectedText}</span>" with:
            </label>
            <input
              type="text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              className="mt-2 w-full p-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center">
              <input
                id="replace-all-checkbox"
                type="checkbox"
                checked={replaceAll}
                onChange={(e) => setReplaceAll(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-slate-100 dark:bg-slate-900"
              />
              <label htmlFor="replace-all-checkbox" className="ml-2 block text-sm text-slate-900 dark:text-slate-200">
                Replace all occurrences
              </label>
            </div>
            <div className="flex items-center">
              <input
                id="add-to-vocabulary-checkbox"
                type="checkbox"
                checked={addToVocabulary}
                onChange={(e) => setAddToVocabulary(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-slate-100 dark:bg-slate-900"
              />
              <label htmlFor="add-to-vocabulary-checkbox" className="ml-2 block text-sm text-slate-900 dark:text-slate-200">
                Add to vocabulary
              </label>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg font-semibold text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 dark:focus:ring-offset-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 rounded-lg font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-800 transition-colors"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );
};