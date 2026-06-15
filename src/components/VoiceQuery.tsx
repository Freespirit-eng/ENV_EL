import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, Sparkles, AlertCircle } from 'lucide-react';

interface Props {
  onQueryResult: (params: {
    origin?: string;
    destination?: string;
    vehicleType?: string;
    weather?: string;
    congestionLevel?: string;
  }) => void;
  isProcessing: boolean;
}

// Check for browser speech recognition support
const SpeechRecognitionAPI =
  (globalThis as any).SpeechRecognition ||
  (globalThis as any).webkitSpeechRecognition ||
  null;

export default function VoiceQuery({ onQueryResult, isProcessing }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'done' | 'error'>('idle');
  const [resultMessage, setResultMessage] = useState('');
  const recognitionRef = useRef<any>(null);

  const hasSpeechSupport = Boolean(SpeechRecognitionAPI);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = () => {
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onstart = () => {
      setIsListening(true);
      setStatus('listening');
      setTranscript('');
      setResultMessage('');
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t;
        } else {
          setTranscript(t);
        }
      }
      if (finalTranscript) {
        setTranscript(finalTranscript);
        processQuery(finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      setStatus('error');
      setResultMessage(`Voice error: ${event.error}. Try typing instead.`);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const processQuery = async (query: string) => {
    setStatus('processing');
    try {
      const res = await fetch('/api/voice-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: query }),
      });
      const data = await res.json();

      if (data.error) {
        setStatus('error');
        setResultMessage(data.error);
        return;
      }

      setStatus('done');
      setResultMessage(
        `✅ Parsed: ${data.origin || '?'} → ${data.destination || '?'}` +
        (data.vehicleType ? ` | Vehicle: ${data.vehicleType}` : '') +
        (data.weather ? ` | Weather: ${data.weather}` : '')
      );

      onQueryResult(data);
    } catch (e) {
      setStatus('error');
      setResultMessage('Failed to process query. Server may be down.');
    }
  };

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    setTranscript(textInput);
    processQuery(textInput);
    setTextInput('');
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-violet-600/20 to-indigo-600/20 border border-violet-500/30 rounded-xl text-xs font-semibold text-violet-300 hover:border-violet-400/50 hover:shadow-[0_0_15px_rgba(139,92,246,0.2)] transition-all"
      >
        <Mic className="w-3.5 h-3.5" />
        <span>Voice Query</span>
      </button>
    );
  }

  return (
    <div className="bg-slate-900/60 border border-violet-500/20 rounded-2xl p-4 space-y-3 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-bold text-white">AI Voice Query</span>
        </div>
        <button onClick={() => { setIsOpen(false); stopListening(); }}
          className="text-slate-500 hover:text-slate-300 text-xs">✕</button>
      </div>

      <p className="text-[10px] text-slate-500">
        Say something like: "Find the greenest route from Koramangala to Whitefield during heavy rain"
      </p>

      {/* Microphone button */}
      <div className="flex items-center gap-2">
        {hasSpeechSupport ? (
          <button
            onClick={isListening ? stopListening : startListening}
            disabled={status === 'processing'}
            className={`p-3 rounded-xl transition-all ${
              isListening
                ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400 animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                : 'bg-violet-500/10 border border-violet-500/30 text-violet-400 hover:bg-violet-500/20'
            }`}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        ) : (
          <div className="flex items-center gap-1.5 text-[10px] text-amber-400">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Speech API not available — use text input</span>
          </div>
        )}

        {/* Text fallback input */}
        <div className="flex-grow flex gap-1.5">
          <input
            type="text"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTextSubmit()}
            placeholder="Or type your route query..."
            className="flex-grow bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500 placeholder:text-slate-600"
          />
          <button
            onClick={handleTextSubmit}
            disabled={!textInput.trim() || status === 'processing'}
            className="px-3 py-2 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-500 disabled:opacity-40 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Live transcript */}
      {transcript && (
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Transcript</p>
          <p className="text-xs text-slate-200 italic">"{transcript}"</p>
        </div>
      )}

      {/* Status */}
      {status === 'processing' && (
        <div className="flex items-center gap-2 text-xs text-violet-400">
          <Sparkles className="w-3.5 h-3.5 animate-spin" />
          <span>Gemini is interpreting your query...</span>
        </div>
      )}

      {resultMessage && (
        <div className={`text-[11px] p-2.5 rounded-lg border ${
          status === 'error'
            ? 'bg-rose-950/20 border-rose-500/20 text-rose-300'
            : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300'
        }`}>
          {resultMessage}
        </div>
      )}
    </div>
  );
}
