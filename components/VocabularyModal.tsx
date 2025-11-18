import React, { useState, useEffect } from 'react';
import { VocabularyItem } from '../types';
import { TrashIcon } from './icons';

interface VocabularyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (vocabulary: VocabularyItem[]) => void;
  initialVocabulary: VocabularyItem[];
}

export const VocabularyModal: React.FC<VocabularyModalProps> = ({ isOpen, onClose, onSave, initialVocabulary }) => {
  const [localVocabulary, setLocalVocabulary] = useState<VocabularyItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Deep copy to avoid mutating parent state directly
      setLocalVocabulary(JSON.parse(JSON.stringify(initialVocabulary)));
    }
  }, [isOpen, initialVocabulary]);

  if (!isOpen) {
    return null;
  }

  const handleAddItem = () => {
    setLocalVocabulary([...localVocabulary, { id: Date.now(), word: '', description: '' }]);
  };

  const handleItemChange = (index: number, field: 'word' | 'description', value: string) => {
    const updated = [...localVocabulary];
    updated[index] = { ...updated[index], [field]: value };
    setLocalVocabulary(updated);
  };

  const handleDeleteItem = (id: number) => {
    setLocalVocabulary(localVocabulary.filter(item => item.id !== id));
  };

  const handleSave = () => {
    // Filter out empty words before saving
    const filteredVocab = localVocabulary.filter(item => item.word.trim() !== '');
    onSave(filteredVocab);
    onClose();
  };

  return (
    <div 
        className="fixed inset-0 bg-slate-900 bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
        aria-modal="true"
        role="dialog"
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Custom Vocabulary</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Improve transcription accuracy for specific words, names, or jargon.
          </p>
        </div>
        
        <div className="p-6 flex-grow overflow-y-auto">
          <div className="space-y-3">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
              <div className="col-span-5">Word / Phrase</div>
              <div className="col-span-6">Description (Optional)</div>
              <div className="col-span-1"></div>
            </div>
            
            {localVocabulary.map((item, index) => (
              <div key={item.id} className="grid grid-cols-12 gap-4 items-center p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                <div className="col-span-5">
                  <input
                    type="text"
                    value={item.word}
                    onChange={(e) => handleItemChange(index, 'word', e.target.value)}
                    placeholder="e.g., Gemini"
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  />
                </div>
                <div className="col-span-6">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    placeholder="e.g., AI model name"
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  />
                </div>
                <div className="col-span-1 text-right">
                  <button 
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-2 text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    aria-label="Delete item"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleAddItem}
            className="mt-4 w-full text-center px-4 py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg font-semibold text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-800 transition-colors"
          >
            + Add Word
          </button>
        </div>
        
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg font-semibold text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 dark:focus:ring-offset-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-800 transition-colors"
          >
            Save Vocabulary
          </button>
        </div>
      </div>
    </div>
  );
};
