export type VoicePrefs = { enabled: boolean; volume: number; mode: 'dialogue-only' | 'narration-and-dialogue' };

let currentUtterance: SpeechSynthesisUtterance | null = null;
let voicesLoaded = false;
let syntheticVoices: SpeechSynthesisVoice[] = [];

function loadVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        syntheticVoices = window.speechSynthesis.getVoices();
        if (syntheticVoices.length > 0) {
            voicesLoaded = true;
        }
    }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    loadVoices();
}

function stringToHash(string: string) {
    let hash = 0;
    if (string.length === 0) return hash;
    for (let i = 0; i < string.length; i++) {
        const char = string.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

function pickVoiceForSpeaker(speaker: string, voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    if (voices.length === 0) return null;
    
    // Fallback to english voices
    const enVoices = voices.filter(v => v.lang.startsWith('en'));
    const pool = enVoices.length > 0 ? enVoices : voices;

    // Simple heuristic for overrides
    const lowerSpeaker = speaker.toLowerCase();
    if (lowerSpeaker.includes('paimon') || lowerSpeaker.includes('amber') || lowerSpeaker.includes('lumine') || lowerSpeaker.includes('jean') || lowerSpeaker.includes('lisa')) {
        const femaleVoice = pool.find(v => v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Google UK English Female'));
        if (femaleVoice) return femaleVoice;
    } else if (lowerSpeaker.includes('kaeya') || lowerSpeaker.includes('venti') || lowerSpeaker.includes('diluc') || lowerSpeaker.includes('aether')) {
        const maleVoice = pool.find(v => v.name.includes('Male') || v.name.includes('David') || v.name.includes('Google UK English Male'));
        if (maleVoice) return maleVoice;
    }

    // Deterministic selection based on speaker name hash
    const index = stringToHash(speaker) % pool.length;
    return pool[index];
}

function chunkText(text: string, maxLength: number = 300): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+[\])'"`’”]*|.+/g) || [text];
    const chunks: string[] = [];
    let currentChunk = "";

    for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > maxLength) {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence;
        } else {
            currentChunk += " " + sentence;
        }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
}

export function speak(text: string, prefs: VoicePrefs, voiceHintForSpeaker?: string) {
    if (!prefs.enabled || !text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel();
    
    const voices = syntheticVoices.length > 0 ? syntheticVoices : window.speechSynthesis.getVoices();
    let voiceToUse: SpeechSynthesisVoice | null = null;
    let pitch = 1.0;

    if (voiceHintForSpeaker && voices.length) {
        voiceToUse = pickVoiceForSpeaker(voiceHintForSpeaker, voices);
        if (voiceHintForSpeaker.toLowerCase() === 'paimon') pitch = 1.5;
        if (voiceHintForSpeaker.toLowerCase() === 'venti') pitch = 1.2;
        if (voiceHintForSpeaker.toLowerCase() === 'diluc' || voiceHintForSpeaker.toLowerCase() === 'dvalin') pitch = 0.7;
    }

    const chunks = chunkText(text);
    
    const speakChunk = (index: number) => {
        if (index >= chunks.length || !prefs.enabled) return;
        
        const u = new SpeechSynthesisUtterance(chunks[index]);
        u.volume = prefs.volume;
        u.rate = 1.0;
        u.pitch = pitch;
        if (voiceToUse) u.voice = voiceToUse;
        
        u.onend = () => speakChunk(index + 1);
        u.onerror = (e) => {
            const errEvent = e as SpeechSynthesisErrorEvent;
            if (errEvent.error === 'interrupted' || errEvent.error === 'canceled') return;
            console.warn("Speech synthesis issue:", errEvent.error || 'unknown', e);
        };
        
        currentUtterance = u;
        window.speechSynthesis.speak(u);
    };

    speakChunk(0);
}

export function stopSpeaking() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    currentUtterance = null;
}
