import { Template } from './types';

export const TEMPLATES_KEY = 'gemini-transcriber-templates';
export const LAST_SELECTED_TEMPLATES_KEY = 'gemini-transcriber-last-selected-templates';
export const LAST_INSTRUCTION_KEY = 'gemini-transcriber-last-instruction';
export const TRANSCRIPTION_PROMPT_KEY = 'gemini-transcriber-transcription-prompt';
export const VOCABULARY_KEY = 'gemini-transcriber-vocabulary';
export const SELECTED_MODEL_KEY = 'gemini-transcriber-selected-model';

export const DEFAULT_TEMPLATES: Template[] = [
  {
    name: 'Preamble',
    content: `You are a helpful assistant that formats meeting transcriptions.
Based on the transcription provided, please generate structured meeting notes.
The output should be in Markdown format.`
  },
  {
    name: 'Meeting Summary',
    content: `## Meeting Summary
- A concise, one-paragraph summary of the meeting.`
  },
  {
    name: 'Action Items',
    content: `## Action Items
- A bulleted list of all action items, assigning each to a person if mentioned. Use the format: "- [ ] @Person: [Action Item]".`
  },
  {
    name: 'Key Decisions',
    content: `## Key Decisions
- A bulleted list of key decisions made during the meeting.`
  },
  {
    name: 'Full Transcript',
    content: `## Full Transcript
- The complete, cleaned-up transcript of the meeting.`
  }
];

export const DEFAULT_SELECTED_TEMPLATES = ['Preamble', 'Meeting Summary', 'Action Items', 'Full Transcript'];

export const DEFAULT_TRANSCRIPTION_PROMPT = 'Transcribe the audio. The audio can be in any language. Focus on accuracy while creating a clean transcript by removing hesitation words such as "ah," "uhm," and similar filler expressions.';