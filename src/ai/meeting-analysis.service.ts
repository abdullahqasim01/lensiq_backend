import {
  Injectable,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GoogleGenAI, Type } from '@google/genai';

export interface MeetingSegmentResult {
  speaker: string;
  text: string;
  startMs: number;
}

export interface MeetingAnalysisResult {
  /** Omitted when analyzing an already-known transcript (text input path). */
  transcript?: MeetingSegmentResult[];
  summary: string;
  mindMap: {
    nodes: { id: string; label: string }[];
    edges: { from: string; to: string }[];
  };
}

export interface MeetingLanguageOptions {
  sourceLanguage?: string;
  targetLanguage?: string;
}

// Inline base64 audio must stay well under Gemini's ~20MB total
// request-size ceiling. There is no chunked/resumable upload path here
// (that would need the separate Files API) — per
// docs/plan/07-meetings-overhaul.md §7.5, this endpoint trades that off for
// simplicity, so very long recordings should be trimmed/compressed
// client-side before calling it.
const MAX_AUDIO_BYTES = 19 * 1024 * 1024;

const mindMapSchema = {
  type: Type.OBJECT,
  properties: {
    nodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          label: { type: Type.STRING, description: 'Short, 2-5 word label.' },
        },
        required: ['id', 'label'],
      },
    },
    edges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          from: { type: Type.STRING, description: 'A node id.' },
          to: { type: Type.STRING, description: 'A node id.' },
        },
        required: ['from', 'to'],
      },
    },
  },
  required: ['nodes', 'edges'],
};

const audioAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    transcript: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          speaker: { type: Type.STRING },
          text: { type: Type.STRING },
          startMs: {
            type: Type.INTEGER,
            description: 'Approximate start time in milliseconds.',
          },
        },
        required: ['speaker', 'text', 'startMs'],
      },
    },
    summary: { type: Type.STRING },
    mindMap: mindMapSchema,
  },
  required: ['transcript', 'summary', 'mindMap'],
};

const transcriptAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    mindMap: mindMapSchema,
  },
  required: ['summary', 'mindMap'],
};

/**
 * Turns a meeting recording (or an already-transcribed text) into the
 * structured {transcript, summary, mindMap} shape `LensiqMeeting` expects —
 * one call handles all three, rather than separate transcription/summary/
 * mind-map prompts. See `docs/plan/07-meetings-overhaul.md` §7.5 and
 * `docs/heycyan-reference/10-ai-recommendations.md`.
 */
@Injectable()
export class MeetingAnalysisService {
  private client?: GoogleGenAI;

  async analyzeAudio(
    audio: Buffer,
    mimeType: string,
    options: MeetingLanguageOptions = {},
  ): Promise<MeetingAnalysisResult> {
    if (audio.length > MAX_AUDIO_BYTES) {
      throw new PayloadTooLargeException(
        'Audio file is too large to analyze in one request (limit ~19MB). ' +
          'Trim or compress the recording and try again.',
      );
    }
    const result = await this.generate(
      [
        { inlineData: { data: audio.toString('base64'), mimeType } },
        { text: this.buildAudioPrompt(options) },
      ],
      audioAnalysisSchema,
    );
    return this.normalize(result, true);
  }

  async analyzeTranscript(
    transcript: string,
    options: MeetingLanguageOptions = {},
  ): Promise<MeetingAnalysisResult> {
    const result = await this.generate(
      [{ text: this.buildTranscriptPrompt(transcript, options) }],
      transcriptAnalysisSchema,
    );
    return this.normalize(result, false);
  }

  private async generate(
    parts: Array<Record<string, unknown>>,
    responseSchema: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const model = process.env.GEMINI_MEETING_MODEL ?? 'gemini-flash-latest';
    const response = await this.getClient().models.generateContent({
      model,
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: 'application/json',
        responseSchema,
      },
    });

    const text = response.text;
    if (!text) {
      throw new ServiceUnavailableException(
        'Gemini returned an empty meeting analysis.',
      );
    }
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new ServiceUnavailableException(
        'Gemini returned malformed meeting analysis JSON.',
      );
    }
  }

  private normalize(
    raw: Record<string, unknown>,
    includeTranscript: boolean,
  ): MeetingAnalysisResult {
    const transcriptRaw = raw.transcript;
    const summary = typeof raw.summary === 'string' ? raw.summary : '';
    const mindMapRaw = (raw.mindMap ?? {}) as Record<string, unknown>;
    const nodesRaw = mindMapRaw.nodes;
    const edgesRaw = mindMapRaw.edges;

    return {
      transcript:
        includeTranscript && Array.isArray(transcriptRaw)
          ? transcriptRaw.map((entry) => this.normalizeSegment(entry))
          : undefined,
      summary,
      mindMap: {
        nodes: Array.isArray(nodesRaw)
          ? nodesRaw.map((entry) => this.normalizeNode(entry))
          : [],
        edges: Array.isArray(edgesRaw)
          ? edgesRaw.map((entry) => this.normalizeEdge(entry))
          : [],
      },
    };
  }

  private normalizeSegment(entry: unknown): MeetingSegmentResult {
    const obj = (entry ?? {}) as Record<string, unknown>;
    return {
      speaker: typeof obj.speaker === 'string' ? obj.speaker : '',
      text: typeof obj.text === 'string' ? obj.text : '',
      startMs: typeof obj.startMs === 'number' ? Math.round(obj.startMs) : 0,
    };
  }

  private normalizeNode(entry: unknown): { id: string; label: string } {
    const obj = (entry ?? {}) as Record<string, unknown>;
    return {
      id: typeof obj.id === 'string' ? obj.id : '',
      label: typeof obj.label === 'string' ? obj.label : '',
    };
  }

  private normalizeEdge(entry: unknown): { from: string; to: string } {
    const obj = (entry ?? {}) as Record<string, unknown>;
    return {
      from: typeof obj.from === 'string' ? obj.from : '',
      to: typeof obj.to === 'string' ? obj.to : '',
    };
  }

  private buildAudioPrompt(options: MeetingLanguageOptions): string {
    return (
      'You are analyzing an audio recording of a meeting or conversation. ' +
      'Transcribe it with speaker labels (e.g. "Speaker 1", "Speaker 2") and ' +
      'the approximate start time of each line in milliseconds from the ' +
      'start of the recording. Write a concise summary as bullet points, ' +
      'including any action items. Then produce a mind map of 5-12 nodes ' +
      'covering the key topics discussed and how they relate to each other.' +
      this.languageNote(options)
    );
  }

  private buildTranscriptPrompt(
    transcript: string,
    options: MeetingLanguageOptions,
  ): string {
    return (
      'You are given the transcript of a meeting or conversation below. ' +
      'Write a concise summary as bullet points, including any action ' +
      'items. Then produce a mind map of 5-12 nodes covering the key ' +
      'topics discussed and how they relate to each other.' +
      this.languageNote(options) +
      '\n\nTranscript:\n' +
      transcript
    );
  }

  private languageNote(options: MeetingLanguageOptions): string {
    if (!options.sourceLanguage || !options.targetLanguage) return '';
    return (
      ` The speakers may be using ${options.sourceLanguage}; write the ` +
      `summary and mind-map labels in ${options.targetLanguage}.`
    );
  }

  private getClient(): GoogleGenAI {
    if (this.client) return this.client;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is not configured.',
      );
    }

    this.client = new GoogleGenAI({ apiKey });
    return this.client;
  }
}
