export type RecordingStatus = 'new' | 'transcribing' | 'completed' | 'failed';

export type ChunkStatus = 'processing' | 'completed' | 'failed';

export interface TranscriptChunk {
  index: number;
  content: string;
  status: ChunkStatus;
}

export interface Template {
  name: string;
  content: string;
}

export interface RecordingMetadata {
  id: number; // Timestamp
  name:string;
  size: number;
  mimeType: string;
  status: RecordingStatus;
  progress: number;
  transcriptChunks: TranscriptChunk[];
  formattedNotes?: string;
}

export interface Recording extends RecordingMetadata {
  blob: Blob;
}

export interface VocabularyItem {
    id: number;
    word: string;
    description: string;
}