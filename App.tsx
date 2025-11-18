

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Template, Recording, RecordingMetadata, RecordingStatus, TranscriptChunk, VocabularyItem } from './types';
import { TEMPLATES_KEY, DEFAULT_TEMPLATES, LAST_INSTRUCTION_KEY, TRANSCRIPTION_PROMPT_KEY, DEFAULT_TRANSCRIPTION_PROMPT, VOCABULARY_KEY, LAST_SELECTED_TEMPLATES_KEY, DEFAULT_SELECTED_TEMPLATES, SELECTED_MODEL_KEY } from './constants';
import { formatNotes, transcribeAudio } from './services/geminiService';
import { initDB, addAudioChunk, getAudioChunks, clearAudioChunks, addRecording, getAllRecordingsMetadata, getRecording, deleteRecording, updateRecording } from './services/dbService';
import { NotePreview } from './components/NotePreview';
import { SavedRecordingsList } from './components/SavedRecordingsList';
import { TranscriptDisplay } from './components/TranscriptDisplay';
import { VocabularyModal } from './components/VocabularyModal';
import { MicrophoneIcon, StopIcon, LoaderIcon, SparklesIcon, SaveIcon, CopyIcon, CheckIcon, UploadIcon, DownloadIcon, TrashIcon, SettingsIcon, BookOpenIcon, ChevronDownIcon, GripVerticalIcon, EditIcon } from './components/icons';

const MAX_CHUNK_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const HEADER_SIZE_BYTES = 10 * 1024; // 10KB, generous for WEBM headers

const App: React.FC = () => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [transcriptChunks, setTranscriptChunks] = useState<TranscriptChunk[]>([]);
  const [instruction, setInstruction] = useState<string>('');
  const [transcriptionPrompt, setTranscriptionPrompt] = useState<string>(DEFAULT_TRANSCRIPTION_PROMPT);
  const [generatedNotes, setGeneratedNotes] = useState<string>('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateNames, setSelectedTemplateNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [transcriptCopied, setTranscriptCopied] = useState<boolean>(false);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [savedRecordings, setSavedRecordings] = useState<RecordingMetadata[]>([]);
  const [transcriptionStatus, setTranscriptionStatus] = useState<string>('');
  const [activeRecordingId, setActiveRecordingId] = useState<number | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'record' | 'paste'>('record');
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [isVocabModalOpen, setIsVocabModalOpen] = useState<boolean>(false);

  // State for template management UI
  const [isCreateTemplateModalOpen, setIsCreateTemplateModalOpen] = useState<boolean>(false);
  const [newTemplateName, setNewTemplateName] = useState<string>('');
  const [newTemplateContent, setNewTemplateContent] = useState<string>('');
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editedTemplateName, setEditedTemplateName] = useState<string>('');
  const [editedTemplateContent, setEditedTemplateContent] = useState<string>('');
  const [confirmingDeleteTemplate, setConfirmingDeleteTemplate] = useState<string | null>(null);
  const [confirmingDeleteRecording, setConfirmingDeleteRecording] = useState<number | null>(null);
  const [isEditingTranscriptionPrompt, setIsEditingTranscriptionPrompt] = useState<boolean>(false);
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState<boolean>(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState<boolean>(false);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const availableModels = ['gemini-2.5-flash', 'gemini-2.5-pro'];

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIdRef = useRef<number | null>(null);
  const chunkIndexRef = useRef<number>(0);
  const noteUpdateTimeoutRef = useRef<number | null>(null);
  const templateDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);


  const loadRecordings = useCallback(async () => {
    try {
        const metadata = await getAllRecordingsMetadata();
        setSavedRecordings(metadata);
    } catch(err) {
        console.error("Failed to load recordings from DB", err);
        setError("Could not load saved recordings.");
    }
  }, []);

  useEffect(() => {
    try {
      const savedTemplates = localStorage.getItem(TEMPLATES_KEY);
      if (savedTemplates) {
        setTemplates(JSON.parse(savedTemplates));
      } else {
        setTemplates(DEFAULT_TEMPLATES);
      }
      
      const lastSelectedTemplates = localStorage.getItem(LAST_SELECTED_TEMPLATES_KEY);
      if (lastSelectedTemplates) {
        setSelectedTemplateNames(JSON.parse(lastSelectedTemplates));
      } else {
        setSelectedTemplateNames(DEFAULT_SELECTED_TEMPLATES);
      }

      const lastInstruction = localStorage.getItem(LAST_INSTRUCTION_KEY);
      if (lastInstruction) {
        setInstruction(lastInstruction);
      }
      const savedTranscriptionPrompt = localStorage.getItem(TRANSCRIPTION_PROMPT_KEY);
      if (savedTranscriptionPrompt) {
        setTranscriptionPrompt(savedTranscriptionPrompt);
      }
      const savedVocabulary = localStorage.getItem(VOCABULARY_KEY);
      if (savedVocabulary) {
        setVocabulary(JSON.parse(savedVocabulary));
      }
      const savedModel = localStorage.getItem(SELECTED_MODEL_KEY);
      if (savedModel && availableModels.includes(savedModel)) {
        setSelectedModel(savedModel);
      }
    } catch (e) {
      console.error("Failed to parse from localStorage", e);
      setError("Could not load saved settings.");
    }
    
    const initializeDatabase = async () => {
      try {
        await initDB();
        await loadRecordings();
      } catch (err) {
        setError("Your browser doesn't support storage for long recordings. Short recordings in memory will still work.");
        console.error(err);
      }
    };
    initializeDatabase();
  }, [loadRecordings]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (templateDropdownRef.current && !templateDropdownRef.current.contains(event.target as Node)) {
            setIsTemplateDropdownOpen(false);
        }
        if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
            setIsModelDropdownOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const newInstruction = selectedTemplateNames
      .map(name => templates.find(m => m.name === name)?.content || '')
      .join('\n\n');
    setInstruction(newInstruction);
  }, [selectedTemplateNames, templates]);
  
  useEffect(() => {
    localStorage.setItem(LAST_INSTRUCTION_KEY, instruction);
  }, [instruction]);

  useEffect(() => {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  }, [templates]);
  
  useEffect(() => {
    localStorage.setItem(LAST_SELECTED_TEMPLATES_KEY, JSON.stringify(selectedTemplateNames));
  }, [selectedTemplateNames]);

  useEffect(() => {
    localStorage.setItem(TRANSCRIPTION_PROMPT_KEY, transcriptionPrompt);
  }, [transcriptionPrompt]);

  useEffect(() => {
    localStorage.setItem(VOCABULARY_KEY, JSON.stringify(vocabulary));
  }, [vocabulary]);

  useEffect(() => {
    localStorage.setItem(SELECTED_MODEL_KEY, selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    if (editingTemplate) {
        setEditedTemplateName(editingTemplate.name);
        setEditedTemplateContent(editingTemplate.content);
    }
  }, [editingTemplate]);

  const buildTranscriptionPromptWithVocabulary = useCallback(() => {
    let prompt = transcriptionPrompt;
    if (vocabulary.length > 0) {
        const vocabList = vocabulary
            .map(v => `- ${v.word.trim()}${v.description.trim() ? `: ${v.description.trim()}` : ''}`)
            .join('\n');
        
        prompt += `\n\n---
Custom Vocabulary:
Please give special consideration to the following words, phrases, and their spellings during transcription.
${vocabList}
---`;
    }
    return prompt;
  }, [transcriptionPrompt, vocabulary]);

  const processRecording = async (id: number) => {
    setTranscriptChunks([]);
    setGeneratedNotes('');
    setError(null);
    setIsTranscribing(true);
    setActiveRecordingId(id);
    setTranscriptionStatus('Initializing transcription...');
  
    let recording: Recording | undefined;
    try {
      recording = await getRecording(id);
      if (!recording) throw new Error('Recording not found in database.');
  
      setRecordedAudioBlob(recording.blob);
      setTranscriptChunks(recording.transcriptChunks || []);
      setGeneratedNotes(recording.formattedNotes || '');
  
      // If a full transcript already exists, don't re-process
      if (recording.status === 'completed' && recording.transcriptChunks?.length > 0) {
        setIsTranscribing(false);
        setTranscriptionStatus('');
        return;
      }

      await updateRecording(id, {
        status: 'transcribing',
        progress: 5,
        transcriptChunks: [],
      });
      await loadRecordings();

      const { blob } = recording;
      const finalPrompt = buildTranscriptionPromptWithVocabulary();
      
      if (blob.size <= MAX_CHUNK_SIZE_BYTES) {
        setTranscriptionStatus('Transcribing audio... This may take a few moments.');
        await updateRecording(id, { progress: 10 });
        await loadRecordings();

        const newChunk: TranscriptChunk = { index: 0, content: '', status: 'processing' };
        setTranscriptChunks([newChunk]);
        
        try {
            const mimeType = blob.type.split(';')[0];
            const fullTranscript = await transcribeAudio(blob, mimeType, finalPrompt);
            
            const completedChunk: TranscriptChunk = { index: 0, content: fullTranscript.trim(), status: 'completed' };
            setTranscriptChunks([completedChunk]);
            await updateRecording(id, { transcriptChunks: [completedChunk], status: 'completed', progress: 100 });
        } catch(e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            const failedChunk: TranscriptChunk = { index: 0, content: errorMessage, status: 'failed' };
            setTranscriptChunks([failedChunk]);
            await updateRecording(id, { transcriptChunks: [failedChunk], status: 'failed', progress: 100 });
            throw e;
        }

      } else {
        const totalChunks = Math.ceil((blob.size - HEADER_SIZE_BYTES) / (MAX_CHUNK_SIZE_BYTES - HEADER_SIZE_BYTES));
        const header = blob.slice(0, HEADER_SIZE_BYTES, blob.type);
        
        const initialChunks: TranscriptChunk[] = Array.from({ length: totalChunks }, (_, i) => ({
            index: i, content: '', status: 'processing'
        }));
        setTranscriptChunks(initialChunks);
        await updateRecording(id, { transcriptChunks: initialChunks, progress: 10 });
        await loadRecordings();

        let finalChunks = [...initialChunks];

        for (let i = 0; i < totalChunks; i++) {
          setTranscriptionStatus(`Transcribing chunk ${i + 1} of ${totalChunks}...`);
          
          const start = i * (MAX_CHUNK_SIZE_BYTES - HEADER_SIZE_BYTES);
          const end = Math.min(start + (MAX_CHUNK_SIZE_BYTES - HEADER_SIZE_BYTES), blob.size);
          const chunkBlob = blob.slice(start, end, blob.type);

          if (chunkBlob.size === 0) {
              finalChunks[i] = { ...finalChunks[i], status: 'completed' };
              continue;
          };

          const blobToSend = (i === 0) ? chunkBlob : new Blob([header, chunkBlob], { type: blob.type });

          try {
              const mimeType = blob.type.split(';')[0];
              const transcriptPart = await transcribeAudio(blobToSend, mimeType, finalPrompt);
              finalChunks[i] = { ...finalChunks[i], content: transcriptPart.trim(), status: 'completed' };
          } catch (chunkError) {
              console.error(`Error transcribing chunk ${i}:`, chunkError);
              const errorMessage = chunkError instanceof Error ? chunkError.message : String(chunkError);
              finalChunks[i] = { ...finalChunks[i], content: errorMessage, status: 'failed' };
          }
          
          setTranscriptChunks([...finalChunks]);
          const progress = Math.round(((i + 1) / totalChunks) * 95);
          await updateRecording(id, { transcriptChunks: finalChunks, progress });
          await loadRecordings();
        }
        
        const allSucceeded = finalChunks.every(c => c.status === 'completed');
        await updateRecording(id, { status: allSucceeded ? 'completed' : 'failed', progress: 100 });
      }
      await loadRecordings();

    } catch (err: any) {
      setError(`Processing failed: ${err.message}. The file might be too large or in an unsupported format.`);
      console.error(err);
      if (recording) {
        await updateRecording(recording.id, { status: 'failed', progress: 0 });
        await loadRecordings();
      }
    } finally {
      setIsTranscribing(false);
      setTranscriptionStatus('');
    }
  };

  const createAndProcessRecording = async (blob: Blob, name: string) => {
    const newRecording: Recording = {
      id: Date.now(),
      name,
      size: blob.size,
      mimeType: blob.type,
      blob,
      status: 'new',
      progress: 0,
      transcriptChunks: [],
    };
    try {
      await addRecording(newRecording);
      await loadRecordings();
      await processRecording(newRecording.id);
    } catch (err: any) {
      setError(`Failed to save new recording: ${err.message}`);
      console.error(err);
    }
  };

  const handleStartRecording = async () => {
    if (isRecording) return;
    setTranscriptChunks([]);
    setGeneratedNotes('');
    setError(null);
    setRecordedAudioBlob(null);
    setActiveRecordingId(null);

    recordingIdRef.current = Date.now();
    chunkIndexRef.current = 0;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeTypeOptions = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4'];
        const supportedMimeType = mimeTypeOptions.find(type => MediaRecorder.isTypeSupported(type));
        
        if (!supportedMimeType) {
            setError('No supported audio format found for recording.');
            return;
        }

        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: supportedMimeType });

        mediaRecorderRef.current.ondataavailable = async (event) => {
            if (event.data.size > 0 && recordingIdRef.current) {
                try {
                    await addAudioChunk(recordingIdRef.current, chunkIndexRef.current, event.data);
                    chunkIndexRef.current++;
                } catch (dbError: any) {
                    console.error('Failed to save audio chunk to DB:', dbError);
                    setError(`Error saving audio chunk: ${dbError.message || dbError}. Recording may fail.`);
                    handleStopRecording();
                }
            }
        };

        mediaRecorderRef.current.onstop = async () => {
            const mimeType = mediaRecorderRef.current?.mimeType || supportedMimeType;
            const currentRecordingId = recordingIdRef.current;

            if (!currentRecordingId) {
                setError("Could not find recording session data.");
                return;
            }

            try {
                const audioChunks = await getAudioChunks(currentRecordingId);
                if (audioChunks.length === 0) {
                    throw new Error("No audio was recorded.");
                }

                const audioBlob = new Blob(audioChunks, { type: mimeType });
                setRecordedAudioBlob(audioBlob);

                const fileExtension = (mimeType.split('/')[1] || 'webm').split(';')[0];
                
                const tempRecording: Recording = {
                    id: currentRecordingId,
                    name: `recording-${new Date(currentRecordingId).toISOString()}.${fileExtension}`,
                    size: audioBlob.size,
                    mimeType: audioBlob.type,
                    blob: audioBlob,
                    status: 'new',
                    progress: 0,
                    transcriptChunks: [],
                };

                await addRecording(tempRecording);
                await loadRecordings();
                await processRecording(tempRecording.id);

            } catch (err: any) {
                setError(`Finalizing recording failed: ${err.message}`);
                console.error(err);
            } finally {
                stream.getTracks().forEach(track => track.stop());
                if (currentRecordingId) {
                    await clearAudioChunks(currentRecordingId);
                }
                recordingIdRef.current = null;
            }
        };

        mediaRecorderRef.current.start(5 * 60 * 1000); // chunk every 5 minutes
        setIsRecording(true);
    } catch (err) {
        console.error('Error starting recording:', err);
        setError('Could not start recording. Please ensure microphone access is granted.');
    }
  };

  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
    }
  }, []);

  const processFile = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('audio/') && !/\.(m4a|mp3|webm|mp4|wav|ogg|aac)$/i.test(file.name)) {
        setError('Invalid file type. Please upload an audio file.');
        setTimeout(() => setError(null), 3000);
        return;
    }

    let mimeType = file.type;
    if (file.name.toLowerCase().endsWith('.webm')) {
        mimeType = 'audio/webm';
    } else if (!mimeType) { // Fallback for files without a clear MIME type
        const extension = file.name.split('.').pop()?.toLowerCase();
        switch (extension) {
            case 'mp3': mimeType = 'audio/mpeg'; break;
            case 'mp4': case 'm4a': mimeType = 'audio/mp4'; break;
            case 'wav': mimeType = 'audio/wav'; break;
            case 'ogg': mimeType = 'audio/ogg'; break;
            case 'aac': mimeType = 'audio/aac'; break;
            default: mimeType = 'application/octet-stream';
        }
    }

    try {
        const audioBlob = new Blob([file], { type: mimeType });
        await createAndProcessRecording(audioBlob, file.name);
    } catch(err: any) {
        setError(`File upload failed: ${err.message}`);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        await processFile(file);
    }
    event.target.value = '';
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0 && e.dataTransfer.types.includes('Files')) {
        if (!isRecording && !isTranscribing) {
            setIsDraggingOver(true);
        }
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleFileDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation(); // Necessary to allow dropping
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (isRecording || isTranscribing) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
       await processFile(file);
    }
  };

  const handleGenerateNotes = async () => {
    const fullTranscript = transcriptChunks.map(c => c.content).join(' ');
    if (!fullTranscript) {
      setError("There is no transcript to process.");
      return;
    }
    setIsGenerating(true);
    setError(null);
    setGeneratedNotes('');
    try {
      const notes = await formatNotes(fullTranscript, instruction, selectedModel);
      setGeneratedNotes(notes);
      if (activeRecordingId) {
        await updateRecording(activeRecordingId, { formattedNotes: notes });
        await loadRecordings();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateNotes = (newNotes: string) => {
    setGeneratedNotes(newNotes);

    if (noteUpdateTimeoutRef.current) {
        clearTimeout(noteUpdateTimeoutRef.current);
    }

    if (activeRecordingId) {
        noteUpdateTimeoutRef.current = window.setTimeout(async () => {
            try {
                await updateRecording(activeRecordingId, { formattedNotes: newNotes });
                await loadRecordings();
            } catch (err) {
                console.error("Failed to save notes automatically", err);
                setError("Failed to auto-save notes.");
                setTimeout(() => setError(null), 3000);
            }
        }, 1000); // 1-second debounce
    }
  };

  const handleNoteEditAndUpdateVocabulary = (params: {
    oldText: string;
    newText: string;
    replaceAll: boolean;
    addToVocabulary: boolean;
    start: number;
    end: number;
  }) => {
    const { oldText, newText, replaceAll, addToVocabulary, start, end } = params;
    if (!newText.trim()) return;

    let updatedNotes;
    if (replaceAll) {
        const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(escapeRegExp(oldText), 'g');
        updatedNotes = generatedNotes.replace(searchRegex, newText);
    } else {
        updatedNotes = generatedNotes.substring(0, start) + newText + generatedNotes.substring(end);
    }

    handleUpdateNotes(updatedNotes);

    if (addToVocabulary) {
        setVocabulary(prev => {
            const trimmedNewText = newText.trim();
            if (prev.some(item => item.word.toLowerCase() === trimmedNewText.toLowerCase())) {
                return prev;
            }
            const newItem: VocabularyItem = {
                id: Date.now(),
                word: trimmedNewText,
                description: `Corrected from "${oldText.trim()}"`
            };
            return [...prev, newItem];
        });
    }
  };

  const handleCopyTranscript = () => {
    const fullTranscript = transcriptChunks.map(c => c.content).join('\n\n');
    if (!fullTranscript) return;
    navigator.clipboard.writeText(fullTranscript).then(() => {
      setTranscriptCopied(true);
      setTimeout(() => setTranscriptCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy transcript: ', err);
      setError('Failed to copy transcript to clipboard.');
    });
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };
  
  const handleDownloadCurrentRecording = () => {
    if (!recordedAudioBlob) return;
    const fileExtension = (recordedAudioBlob.type.split('/')[1] || 'webm').split(';')[0];
    downloadBlob(recordedAudioBlob, `recording-${new Date().toISOString()}.${fileExtension}`);
  };

  const handleDeleteRecording = (id: number) => {
    setConfirmingDeleteRecording(id);
  };

  const handleConfirmDeleteRecording = async () => {
    if (confirmingDeleteRecording === null) return;
    try {
        await deleteRecording(confirmingDeleteRecording);
        await loadRecordings();
        if (activeRecordingId === confirmingDeleteRecording) {
            setActiveRecordingId(null);
            setTranscriptChunks([]);
            setRecordedAudioBlob(null);
            setGeneratedNotes('');
        }
    } catch (err) {
        console.error(err);
        setError('Failed to delete the recording.');
    } finally {
        setConfirmingDeleteRecording(null);
    }
  };

  const handleCancelDeleteRecording = () => {
    setConfirmingDeleteRecording(null);
  };

  const handleUpdateRecordingName = async (id: number, name: string) => {
    try {
        const recording = await getRecording(id);
        if (recording && recording.name !== name) {
            await updateRecording(id, { name });
            await loadRecordings();
        }
    } catch (err) {
        console.error("Failed to update recording name", err);
        setError("Could not update the recording name.");
    }
  };


  const handleDownloadSavedRecording = async (id: number) => {
    try {
        const recording = await getRecording(id);
        if (recording) {
            downloadBlob(recording.blob, recording.name);
        } else {
            throw new Error('Recording not found');
        }
    } catch (err) {
        console.error(err);
        setError('Failed to download the recording.');
    }
  };

  const handleRetryTranscription = async (id: number) => {
    try {
        await updateRecording(id, { transcriptChunks: [], status: 'new', progress: 0 });
        await loadRecordings();
        await processRecording(id);
    } catch (err) {
        console.error(err);
        setError('Failed to retry transcription.');
    }
  };

  const handleSelectRecording = async (id: number) => {
    if (isRecording || isTranscribing) return;
    try {
        const recording = await getRecording(id);
        if (!recording) {
            setError("Could not load the selected recording.");
            return;
        }
        setActiveRecordingId(id);
        setRecordedAudioBlob(recording.blob);
        setTranscriptChunks(recording.transcriptChunks || []);
        setGeneratedNotes(recording.formattedNotes || '');
    } catch (err) {
        console.error(err);
        setError("Failed to load recording from database.");
    }
  };

  const handleRetryChunkTranscription = async (chunkIndex: number) => {
    if (!activeRecordingId) return;

    setError(null);
    setIsTranscribing(true);
    setTranscriptionStatus(`Retrying chunk ${chunkIndex + 1}...`);

    try {
        const recording = await getRecording(activeRecordingId);
        if (!recording) throw new Error("Recording not found");

        const { blob } = recording;
        
        const updatedChunks = transcriptChunks.map((c): TranscriptChunk =>
            c.index === chunkIndex ? { ...c, status: 'processing' } : c
        );
        setTranscriptChunks(updatedChunks);

        const start = chunkIndex * (MAX_CHUNK_SIZE_BYTES - HEADER_SIZE_BYTES);
        const end = Math.min(start + (MAX_CHUNK_SIZE_BYTES - HEADER_SIZE_BYTES), blob.size);
        const chunkBlob = blob.slice(start, end, blob.type);
        
        let blobToSend = chunkBlob;
        if (chunkIndex > 0 && blob.size > MAX_CHUNK_SIZE_BYTES) {
            const header = blob.slice(0, HEADER_SIZE_BYTES, blob.type);
            blobToSend = new Blob([header, chunkBlob], { type: blob.type });
        }
        
        const mimeType = blob.type.split(';')[0];
        const finalPrompt = buildTranscriptionPromptWithVocabulary();
        const transcriptPart = await transcribeAudio(blobToSend, mimeType, finalPrompt);

        const finalChunks = updatedChunks.map((c): TranscriptChunk =>
            c.index === chunkIndex 
                ? { ...c, status: 'completed', content: transcriptPart.trim() } 
                : c
        );
        setTranscriptChunks(finalChunks);
        await updateRecording(activeRecordingId, { transcriptChunks: finalChunks });

    } catch (err: any) {
        setError(`Failed to retry chunk: ${err.message}`);
        const errorMessage = err instanceof Error ? err.message : String(err);
        const finalChunks = transcriptChunks.map((c): TranscriptChunk =>
            c.index === chunkIndex ? { ...c, status: 'failed', content: errorMessage } : c
        );
        setTranscriptChunks(finalChunks);
        if(activeRecordingId){
            await updateRecording(activeRecordingId, { transcriptChunks: finalChunks });
        }
    } finally {
        setIsTranscribing(false);
        setTranscriptionStatus('');
        await loadRecordings();
    }
  };

  const handleUpdateTranscriptChunk = async (chunkIndex: number, newContent: string) => {
      const newChunks = transcriptChunks.map(c => 
          c.index === chunkIndex ? { ...c, content: newContent } : c
      );
      setTranscriptChunks(newChunks);
      if (activeRecordingId) {
          try {
              await updateRecording(activeRecordingId, { transcriptChunks: newChunks });
          } catch(err) {
              console.error("Failed to save transcript chunk update", err);
              setError("Failed to save transcript changes.");
          }
      }
  };

  const handleEditAndUpdateVocabulary = async (params: {
    oldText: string;
    newText: string;
    replaceAll: boolean;
    addToVocabulary: boolean;
    chunkIndex: number;
    start: number;
    end: number;
  }) => {
    const { oldText, newText, replaceAll, addToVocabulary, chunkIndex, start, end } = params;
    
    if (!newText.trim()) return;

    const escapeRegExp = (string: string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    const newChunks = transcriptChunks.map((chunk, index) => {
        let newContent = chunk.content;
        if (replaceAll) {
            const searchRegex = new RegExp(escapeRegExp(oldText), 'g');
            newContent = newContent.replace(searchRegex, newText);
        } else if (index === chunkIndex) {
            newContent = chunk.content.substring(0, start) + newText + chunk.content.substring(end);
        }
        return { ...chunk, content: newContent };
    });

    setTranscriptChunks(newChunks);
    if (activeRecordingId) {
        try {
            await updateRecording(activeRecordingId, { transcriptChunks: newChunks });
        } catch(err) {
            console.error("Failed to save transcript changes after edit", err);
            setError("Failed to save transcript changes.");
        }
    }
    
    if (addToVocabulary) {
        setVocabulary(prev => {
            const trimmedNewText = newText.trim();
            if (prev.some(item => item.word.toLowerCase() === trimmedNewText.toLowerCase())) {
                return prev;
            }
            const newItem: VocabularyItem = {
                id: Date.now(),
                word: trimmedNewText,
                description: `Corrected from "${oldText.trim()}"`
            };
            return [...prev, newItem];
        });
    }
  };

  const handleOpenCreateTemplateModal = () => {
    setNewTemplateName('');
    setNewTemplateContent('');
    setIsCreateTemplateModalOpen(true);
  };

  const handleConfirmCreateTemplate = () => {
    const trimmedName = newTemplateName.trim();
    if (!trimmedName) {
        setError("Template name cannot be empty.");
        setTimeout(() => setError(null), 3000);
        return;
    }
    if (!newTemplateContent.trim()) {
        setError("Template instruction cannot be empty.");
        setTimeout(() => setError(null), 3000);
        return;
    }
    if (templates.some(t => t.name.toLowerCase() === trimmedName.toLowerCase())) {
        setError('A template with this name already exists.');
        setTimeout(() => setError(null), 3000);
        return;
    }

    const newTemplate: Template = { name: trimmedName, content: newTemplateContent };
    const updatedTemplates = [...templates, newTemplate].sort((a, b) => a.name.localeCompare(b.name));
    setTemplates(updatedTemplates);
    
    setSelectedTemplateNames(prev => [...prev, trimmedName]);
    
    setIsCreateTemplateModalOpen(false);
  };

  const handleUpdateTemplate = () => {
    if (!editingTemplate) return;

    const trimmedName = editedTemplateName.trim();
    if (!trimmedName) {
        setError("Template name cannot be empty.");
        setTimeout(() => setError(null), 3000);
        return;
    }
    if (!editedTemplateContent.trim()) {
        setError("Template instruction cannot be empty.");
        setTimeout(() => setError(null), 3000);
        return;
    }
    // Check for name conflict, excluding the original name itself
    if (templates.some(t => t.name.toLowerCase() === trimmedName.toLowerCase() && t.name.toLowerCase() !== editingTemplate.name.toLowerCase())) {
        setError('A template with this name already exists.');
        setTimeout(() => setError(null), 3000);
        return;
    }

    // Update templates array
    const updatedTemplates = templates.map(t =>
        t.name === editingTemplate.name
            ? { name: trimmedName, content: editedTemplateContent }
            : t
    );
    setTemplates(updatedTemplates.sort((a, b) => a.name.localeCompare(b.name)));

    // Update selected templates array if the name changed
    if (editingTemplate.name !== trimmedName) {
        setSelectedTemplateNames(prev =>
            prev.map(name => (name === editingTemplate.name ? trimmedName : name))
        );
    }

    setEditingTemplate(null);
  };

  const handleDeleteTemplate = (name: string) => {
    setConfirmingDeleteTemplate(name);
  };
  
  const handleConfirmDeleteTemplate = () => {
      if (!confirmingDeleteTemplate) return;
  
      const updatedTemplates = templates.filter(t => t.name !== confirmingDeleteTemplate);
      setTemplates(updatedTemplates);

      const updatedSelected = selectedTemplateNames.filter(name => name !== confirmingDeleteTemplate);
      setSelectedTemplateNames(updatedSelected);

      setConfirmingDeleteTemplate(null);
      setIsTemplateDropdownOpen(false); // Close dropdown after deletion
  };
  
  const handleCancelDeleteTemplate = () => {
    setConfirmingDeleteTemplate(null);
  };

  const handleToggleTemplateSelection = (name: string) => {
    setSelectedTemplateNames(prev => {
        if (prev.includes(name)) {
            return prev.filter(n => n !== name);
        } else {
            const newSelected = [...prev];
            const originalIndex = templates.findIndex(t => t.name === name);
            let inserted = false;
            // Insert the new selection in its original sorted order
            for (let i = 0; i < newSelected.length; i++) {
                const selectedIndex = templates.findIndex(t => t.name === newSelected[i]);
                if (originalIndex < selectedIndex) {
                    newSelected.splice(i, 0, name);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) {
                newSelected.push(name);
            }
            return newSelected;
        }
    });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleModuleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    
    const newSelected = [...selectedTemplateNames];
    const [draggedItem] = newSelected.splice(draggedItemIndex, 1);
    newSelected.splice(index, 0, draggedItem);
    
    setDraggedItemIndex(index);
    setSelectedTemplateNames(newSelected);
  };
  
  const handleDragEnd = () => {
    setDraggedItemIndex(null);
  };
  
  const handleTabChange = (tab: 'record' | 'paste') => {
    if (isRecording || isTranscribing) return;
    setActiveTab(tab);
    setTranscriptChunks([]);
    setGeneratedNotes('');
    setError(null);
    setRecordedAudioBlob(null);
    setActiveRecordingId(null);
  };

  const handlePasteInputChange = (content: string) => {
    if (content) {
      setTranscriptChunks([{ index: 0, content, status: 'completed' }]);
    } else {
      setTranscriptChunks([]);
    }
    if (activeRecordingId) setActiveRecordingId(null);
    if (recordedAudioBlob) setRecordedAudioBlob(null);
  };


  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <VocabularyModal
        isOpen={isVocabModalOpen}
        onClose={() => setIsVocabModalOpen(false)}
        initialVocabulary={vocabulary}
        onSave={setVocabulary}
      />
       {isCreateTemplateModalOpen && (
          <div className="fixed inset-0 bg-white dark:bg-slate-900 z-50 flex flex-col" aria-modal="true" role="dialog">
              {/* Header */}
              <header className="flex-shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                      <div className="flex justify-between items-center h-16">
                          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                              Create New Template
                          </h2>
                          <div className="flex items-center gap-4">
                              <button 
                                  onClick={() => setIsCreateTemplateModalOpen(false)} 
                                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg font-semibold text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 dark:focus:ring-offset-slate-900"
                              >
                                  Cancel
                              </button>
                              <button 
                                  onClick={handleConfirmCreateTemplate}
                                  className="px-4 py-2 rounded-lg font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-900 transition-colors"
                              >
                                  Save
                              </button>
                          </div>
                      </div>
                  </div>
              </header>

              {/* Content */}
              <main className="flex-grow p-4 sm:p-6 lg:p-8 overflow-y-auto">
                  <div className="max-w-7xl mx-auto space-y-6 h-full flex flex-col">
                      <div>
                          <label htmlFor="template-name-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Template Name</label>
                          <input
                              id="template-name-input"
                              type="text"
                              value={newTemplateName}
                              onChange={(e) => setNewTemplateName(e.target.value)}
                              placeholder="e.g., Action Items"
                              className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base"
                              autoFocus
                          />
                      </div>
                      <div className="flex flex-col flex-grow">
                          <label htmlFor="template-content-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Instruction</label>
                          <textarea
                              id="template-content-input"
                              value={newTemplateContent}
                              onChange={(e) => setNewTemplateContent(e.target.value)}
                              placeholder="Enter the instructions for this template..."
                              className="w-full flex-grow p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base resize-none"
                          />
                      </div>
                  </div>
              </main>
          </div>
        )}
      {editingTemplate && (
          <div className="fixed inset-0 bg-white dark:bg-slate-900 z-50 flex flex-col" aria-modal="true" role="dialog">
              {/* Header */}
              <header className="flex-shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                      <div className="flex justify-between items-center h-16">
                          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                              Edit Template
                          </h2>
                          <div className="flex items-center gap-4">
                              <button 
                                  onClick={() => setEditingTemplate(null)} 
                                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg font-semibold text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 dark:focus:ring-offset-slate-900"
                              >
                                  Cancel
                              </button>
                              <button 
                                  onClick={handleUpdateTemplate}
                                  className="px-4 py-2 rounded-lg font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-900 transition-colors"
                              >
                                  Save Changes
                              </button>
                          </div>
                      </div>
                  </div>
              </header>

              {/* Content */}
              <main className="flex-grow p-4 sm:p-6 lg:p-8 overflow-y-auto">
                  <div className="max-w-7xl mx-auto space-y-6 h-full flex flex-col">
                      <div>
                          <label htmlFor="edit-template-name-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Template Name</label>
                          <input
                              id="edit-template-name-input"
                              type="text"
                              value={editedTemplateName}
                              onChange={(e) => setEditedTemplateName(e.target.value)}
                              className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base"
                              autoFocus
                          />
                      </div>
                      <div className="flex flex-col flex-grow">
                          <label htmlFor="edit-template-content-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Instruction</label>
                          <textarea
                              id="edit-template-content-input"
                              value={editedTemplateContent}
                              onChange={(e) => setEditedTemplateContent(e.target.value)}
                              className="w-full flex-grow p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base resize-none"
                          />
                      </div>
                  </div>
              </main>
          </div>
      )}

      <div className="max-w-7xl mx-auto">
        <header className="mb-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">SSV Meeting Note Transcriber</h1>
            <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">Record, upload, and format your meeting notes instantly with AI.</p>
        </header>

        {error && (
            <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg relative mb-6" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
                <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3" aria-label="Dismiss error">
                  <span className="text-2xl font-thin">&times;</span>
                </button>
            </div>
        )}

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Left Column */}
            <div className="space-y-8">
                {/* Recorder Card */}
                <div
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg p-6 relative transition-all duration-300"
                    onDragEnter={handleDragEnter}
                >
                    <div className={`absolute inset-0 bg-indigo-50 dark:bg-indigo-900/50 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl z-10 border-2 border-dashed border-indigo-400 dark:border-indigo-600 transition-opacity duration-300 ${isDraggingOver ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleFileDragOver}
                        onDrop={handleDrop}
                    >
                        <UploadIcon className="w-12 h-12 text-indigo-500 dark:text-indigo-400 mb-2 pointer-events-none" />
                        <p className="text-lg font-semibold text-indigo-700 dark:text-indigo-300 pointer-events-none">Drop audio file to transcribe</p>
                    </div>

                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">1. Provide a Transcript</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Record, upload, paste text, or select a past session.</p>
                        </div>
                    </div>

                    <div className="border-b border-slate-200 dark:border-slate-700 mb-4">
                        <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                            <button
                                onClick={() => handleTabChange('record')}
                                disabled={isRecording || isTranscribing}
                                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                    activeTab === 'record'
                                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                                }`}
                            >
                                Record / Upload
                            </button>
                            <button
                                onClick={() => handleTabChange('paste')}
                                disabled={isRecording || isTranscribing}
                                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                    activeTab === 'paste'
                                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                                }`}
                            >
                                Paste Transcript
                            </button>
                        </nav>
                    </div>

                    {activeTab === 'record' && (
                        <>
                            {isEditingTranscriptionPrompt && (
                                <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl transition-all">
                                    <label htmlFor="transcription-prompt-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Transcription Prompt</label>
                                    <textarea
                                        id="transcription-prompt-input"
                                        value={transcriptionPrompt}
                                        onChange={(e) => setTranscriptionPrompt(e.target.value)}
                                        placeholder="Enter prompt for the transcription model..."
                                        className="w-full h-24 p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                    />
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">This prompt guides the AI in how to transcribe the audio.</p>
                                </div>
                            )}
                            
                            <div className="flex justify-between items-center mt-6 mb-2">
                                <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Previous Sessions</h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setIsVocabModalOpen(true)}
                                        className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded-lg p-2 -m-2 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                                        title="Manage custom vocabulary"
                                    >
                                        <BookOpenIcon className="w-4 h-4" />
                                        <span>Vocabulary</span>
                                    </button>
                                    <button
                                        onClick={() => setIsEditingTranscriptionPrompt(prev => !prev)}
                                        className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors rounded-lg p-2 -m-2 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                                        title="Edit transcription prompt"
                                    >
                                        <SettingsIcon className="w-4 h-4" />
                                        <span>Prompt</span>
                                    </button>
                                </div>
                            </div>

                            <SavedRecordingsList
                                recordings={savedRecordings}
                                onDelete={handleDeleteRecording}
                                onDownload={handleDownloadSavedRecording}
                                onRetry={handleRetryTranscription}
                                onSelect={handleSelectRecording}
                                isBusy={isRecording || isTranscribing}
                                activeRecordingId={activeRecordingId}
                                confirmingDeleteId={confirmingDeleteRecording}
                                onConfirmDelete={handleConfirmDeleteRecording}
                                onCancelDelete={handleCancelDeleteRecording}
                                onUpdateName={handleUpdateRecordingName}
                            />

                            <div className="grid sm:grid-cols-2 gap-4 my-4">
                                <button
                                    onClick={isRecording ? handleStopRecording : handleStartRecording}
                                    disabled={isTranscribing}
                                    className={`flex items-center justify-center px-4 py-2.5 rounded-lg font-semibold text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800 transition-all duration-200 transform hover:scale-105 disabled:bg-slate-400 disabled:dark:bg-slate-600 disabled:cursor-not-allowed disabled:scale-100 ${
                                        isRecording
                                        ? 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500'
                                        : 'bg-slate-900 text-white hover:bg-slate-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 focus-visible:ring-slate-800 dark:focus-visible:ring-indigo-500'
                                    }`}
                                >
                                    {isRecording ? (
                                        <>
                                            <StopIcon className="w-5 h-5 mr-2" />
                                            <span>Stop Recording</span>
                                        </>
                                    ) : (
                                        <>
                                            <MicrophoneIcon className="w-5 h-5 mr-2" />
                                            <span>Start Recording</span>
                                        </>
                                    )}
                                </button>
                                
                                <label
                                    className={`flex items-center justify-center px-4 py-2.5 border rounded-lg font-semibold text-sm focus-within:ring-2 focus-within:ring-offset-2 dark:focus-within:ring-offset-slate-800 transition-all duration-200 transform hover:scale-105 ${
                                        isRecording || isTranscribing
                                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-600 focus-within:ring-indigo-500 cursor-pointer'
                                    }`}
                                >
                                    <UploadIcon className="w-5 h-5 mr-2" />
                                    <span>Upload File</span>
                                    <input
                                        id="audio-upload"
                                        type="file"
                                        accept="audio/mp4,audio/mpeg,audio/wav,audio/webm,audio/ogg,audio/aac,.m4a,.mp4,.mp3,.wav,.webm,.ogg,.aac"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                        disabled={isRecording || isTranscribing}
                                    />
                                </label>
                            </div>
                            {recordedAudioBlob && !isRecording && (
                                <button
                                    onClick={handleDownloadCurrentRecording}
                                    className="w-full flex items-center justify-center mt-4 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg font-semibold text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-800 transition-colors"
                                >
                                    <DownloadIcon className="w-5 h-5 mr-2" />
                                    <span>Download Audio</span>
                                </button>
                            )}
                                
                            <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center h-6 mt-2">
                                {isRecording && <><span className="relative flex h-3 w-3 mr-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>Recording...</>}
                                {isTranscribing && (
                                    <div className="text-sm flex items-center">
                                        <LoaderIcon className="w-5 h-5 mr-2" />
                                        <span>{transcriptionStatus || 'Transcribing...'}</span>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === 'paste' && (
                        <div className="my-4">
                            <textarea
                                value={transcriptChunks[0]?.content || ''}
                                onChange={(e) => handlePasteInputChange(e.target.value)}
                                placeholder="Paste your meeting transcript here..."
                                className="w-full h-48 p-3 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow text-sm"
                                disabled={isRecording || isTranscribing}
                            />
                        </div>
                    )}


                    <div className="flex justify-between items-center mt-6">
                        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Transcript</h3>
                        <button
                            onClick={handleCopyTranscript}
                            disabled={transcriptChunks.length === 0}
                            className="flex items-center space-x-2 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {transcriptCopied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
                            <span>{transcriptCopied ? 'Copied!' : 'Copy'}</span>
                        </button>
                    </div>
                    <TranscriptDisplay
                        chunks={transcriptChunks}
                        onRetry={handleRetryChunkTranscription}
                        onUpdate={handleUpdateTranscriptChunk}
                        isProcessing={isTranscribing}
                        isRecording={isRecording}
                        onEditAndUpdateVocabulary={handleEditAndUpdateVocabulary}
                    />
                </div>

                {/* Instructions Card */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">2. Set Instructions</h2>
                        <button
                            onClick={handleOpenCreateTemplateModal}
                            className="flex items-center space-x-2 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-800 transition-colors"
                            title="Create a new reusable template"
                        >
                            <SaveIcon className="w-4 h-4" />
                            <span>Create new template</span>
                        </button>
                    </div>
                    
                    {confirmingDeleteTemplate && (
                        <div className="mb-4 w-full p-2.5 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg flex justify-between items-center">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">Delete "<strong>{confirmingDeleteTemplate}</strong>"?</p>
                            <div>
                                <button onClick={handleConfirmDeleteTemplate} className="px-3 py-1 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md mr-2">Yes, Delete</button>
                                <button onClick={handleCancelDeleteTemplate} className="px-3 py-1 text-sm font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md">Cancel</button>
                            </div>
                        </div>
                    )}

                    <div className="mb-4 space-y-3">
                        <div className="relative" ref={templateDropdownRef}>
                            <button
                                onClick={() => setIsTemplateDropdownOpen(prev => !prev)}
                                className="w-full flex justify-between items-center p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                title="You can select multiple templates. The instruction will include all selected templates. It's best to structure templates as smaller, combinable parts."
                            >
                                <span className="font-medium text-slate-700 dark:text-slate-300">Select templates</span>
                                <ChevronDownIcon className={`w-5 h-5 text-slate-500 transition-transform ${isTemplateDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isTemplateDropdownOpen && (
                                <div className="absolute top-full mt-1.5 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                                    {templates.map(template => (
                                        <div key={template.name} className="flex items-center justify-between p-2 hover:bg-slate-100 dark:hover:bg-slate-700">
                                            <label className="flex items-center gap-3 cursor-pointer flex-grow p-1">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTemplateNames.includes(template.name)}
                                                    onChange={() => handleToggleTemplateSelection(template.name)}
                                                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 bg-slate-100 dark:bg-slate-900"
                                                />
                                                <span className="text-sm text-slate-800 dark:text-slate-200">{template.name}</span>
                                            </label>
                                            <button
                                                onClick={() => setEditingTemplate(template)}
                                                aria-label={`Edit template ${template.name}`}
                                                title={`Edit template ${template.name}`}
                                                className="p-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600"
                                            >
                                                <EditIcon className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTemplate(template.name)}
                                                aria-label={`Delete template ${template.name}`}
                                                title={`Delete template ${template.name}`}
                                                className="p-1.5 text-slate-500 hover:text-red-600 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        {selectedTemplateNames.length > 0 && (
                            <div className="space-y-1.5 pt-2">
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Selected Order</p>
                                {selectedTemplateNames.map((name, index) => (
                                    <div
                                        key={name}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, index)}
                                        onDragOver={(e) => handleModuleDragOver(e, index)}
                                        onDragEnd={handleDragEnd}
                                        className={`flex items-center gap-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 transition-shadow ${draggedItemIndex === index ? 'shadow-lg scale-105' : ''}`}
                                    >
                                        <GripVerticalIcon className="w-5 h-5 text-slate-400 dark:text-slate-500 cursor-grab" />
                                        <span className="flex-grow text-sm font-medium text-slate-800 dark:text-slate-200">{name}</span>
                                        <button
                                            onClick={() => handleToggleTemplateSelection(name)}
                                            aria-label={`Remove ${name} template`}
                                            title={`Remove ${name} template`}
                                            className="p-1 text-slate-500 hover:text-red-600 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
                                        >
                                            <span className="text-lg font-thin leading-none">&times;</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <textarea
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        placeholder="Your instructions will be built here. You can also edit them directly."
                        className="w-full h-48 p-3 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow text-sm"
                    />
                    <div className="mt-4 flex items-stretch gap-2">
                        <button
                            onClick={handleGenerateNotes}
                            disabled={transcriptChunks.length === 0 || isGenerating || isRecording || isTranscribing}
                            className="flex-grow flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-800 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-transform duration-200 transform hover:scale-105"
                        >
                            {isGenerating ? (
                                <>
                                    <LoaderIcon className="w-5 h-5 mr-3" />
                                    <span>Generating with {selectedModel}...</span>
                                </>
                            ) : (
                                <>
                                    <SparklesIcon className="w-5 h-5 mr-3"/>
                                    <span>Generate Notes</span>
                                </>
                            )}
                        </button>

                        <div className="relative" ref={modelDropdownRef}>
                            <button 
                                onClick={() => setIsModelDropdownOpen(prev => !prev)}
                                disabled={isGenerating || isRecording || isTranscribing}
                                className="h-full px-3 flex items-center justify-center border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title={`Change AI model (current: ${selectedModel})`}
                            >
                                <SettingsIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                            </button>
                            {isModelDropdownOpen && (
                                <div className="absolute bottom-full right-0 mb-2 w-56 origin-bottom-right bg-white dark:bg-slate-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-30 border border-slate-200 dark:border-slate-700">
                                    <div className="py-1">
                                        <div className="px-4 pt-2 pb-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">AI Model</div>
                                        {availableModels.map((model) => (
                                            <button
                                                key={model}
                                                onClick={() => {
                                                    setSelectedModel(model);
                                                    setIsModelDropdownOpen(false);
                                                }}
                                                className="w-full text-left flex items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                                            >
                                                {selectedModel === model ? (
                                                    <CheckIcon className="w-4 h-4 mr-3 text-indigo-500" />
                                                ) : (
                                                    <div className="w-4 h-4 mr-3" />
                                                )}
                                                <span className={`${selectedModel === model ? 'font-semibold' : ''} ${model === 'gemini-2.5-pro' ? 'flex items-center gap-2' : ''}`}>
                                                    {model}
                                                    {model === 'gemini-2.5-pro' && <span className="text-xs px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full">Smarter</span>}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column */}
            <div className="lg:sticky lg:top-8">
                <NotePreview
                  notes={generatedNotes}
                  isLoading={isGenerating}
                  isEditable={!!activeRecordingId}
                  onUpdateNotes={handleUpdateNotes}
                  onEditAndUpdateVocabulary={handleNoteEditAndUpdateVocabulary}
                />
            </div>
        </main>
      </div>
    </div>
  );
};

export default App;