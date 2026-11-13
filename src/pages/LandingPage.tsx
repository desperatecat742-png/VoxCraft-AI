import { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  Globe2,
  Languages,
  Loader2,
  Megaphone,
  Menu,
  Mic2,
  Play,
  Scissors,
  Sliders,
  Users,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { AudioPlayer } from '../components/AudioPlayer';
import { AdSlot } from '../components/AdSlot';
import { AdBlockNotice } from '../components/AdBlockNotice';
import { LegalModal, type LegalTab } from '../components/LegalModal';
import { voxApi } from '../services/api';
import type { PublicAppConfig, StudioView } from '../types/voxcraft';

interface LandingPageProps {
  config: PublicAppConfig;
  onEnterStudio: (initialView?: StudioView) => void;
}

const FAQS = [
  {
    q: 'Is VoxCraft AI free to use?',
    a: 'Yes. VoxCraft AI provides a generous daily free character and generation allowance for individuals, creators, educators, and businesses, protected by fair server-side rate limits.',
  },
  {
    q: 'Which AI models power the voice generation and scripts?',
    a: 'Speech generation runs server-side using Google Gemini 3.8 Flash TTS and Gemini 3.8 Flash Lite TTS. Script writing, translation, and pronunciation guidance use Gemini 4 Hydrogen.',
  },
  {
    q: 'What audio formats can I download?',
    a: 'Every generated voiceover, conversation, audiobook chapter, and Audio Studio mix can be downloaded as uncompressed WAV (24kHz, 16-bit) or MP3 (128kbps encoded server-side).',
  },
  {
    q: 'How does the African Voice Collection work?',
    a: 'Where native African language voices are not yet separate voice IDs in the underlying model, VoxCraft AI clearly indicates whether a variety is Multilingual Native, Style-Guided (e.g., Nigerian, Ghanaian, South African, or Kenyan English cadence), or Pronunciation-Guided (Yoruba, Hausa, Igbo, isiZulu).',
  },
  {
    q: 'Can I edit and combine multiple generated clips?',
    a: 'Yes. The built-in Audio Editing Studio uses the browser Web Audio API to arrange multiple clips on a timeline, adjust volume and fade-in/fade-out curves, preview the combined mix, and export a single WAV or MP3 file.',
  },
];

export function LandingPage({ config, onEnterStudio }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  // Live Interactive Hero TTS Preview state
  const [previewText, setPreviewText] = useState(
    'Give your words a voice. Turn scripts, lessons, and stories into clear studio-grade audio in seconds.'
  );
  const [previewVoiceId, setPreviewVoiceId] = useState(config.voices[0]?.id || 'Kore');
  const [previewLangCode, setPreviewLangCode] = useState('en-US');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<{
    audioBase64: string;
    mimeType: string;
    durationSeconds: number;
  } | null>(null);

  const [langRegionFilter, setLangRegionFilter] = useState<'all' | 'african' | 'global'>('all');

  const previewWordCount = previewText.trim() ? previewText.trim().split(/\s+/).length : 0;

  const handleGenerateHeroPreview = async () => {
    setPreviewError(null);
    const clean = previewText.trim();
    if (!clean) {
      setPreviewError('Enter or paste your script above to convert words into real speech.');
      return;
    }
    if (previewWordCount > 2000) {
      setPreviewError('Preview supports up to 2,000 words per request. Shorten slightly or open Audiobook Maker.');
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await voxApi.generateSpeech({
        text: clean,
        voiceId: previewVoiceId,
        languageCode: previewLangCode,
        emotionId: 'natural',
        modelId: 'gemini-3.8-flash-lite-tts',
        format: 'wav',
        saveHistory: false,
      });
      setPreviewAudio({
        audioBase64: res.audioBase64,
        mimeType: res.mimeType,
        durationSeconds: res.durationSeconds,
      });
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Unable to generate audio preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const filteredLanguages = config.languages.filter((lang) => {
    if (langRegionFilter === 'african') return lang.isAfricanCollection;
    if (langRegionFilter === 'global') return !lang.isAfricanCollection;
    return true;
  });

  const africanLanguages = config.languages.filter((l) => l.isAfricanCollection);

  return (
    <div className="min-h-screen bg-[#070B19] text-slate-100">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#070B19]/90 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <Logo onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            <a href="#how-it-works" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#features" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Studio Tools
            </a>
            <a href="#african-voices" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              African Voices
            </a>
            <a href="#languages" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Languages
            </a>
            <a href="#faq" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onEnterStudio('tts')}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              Start Creating Free
            </button>
            <button
              type="button"
              aria-label="Toggle navigation menu"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-[#0D1326] px-4 py-4 space-y-3">
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-slate-200"
            >
              How It Works
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-slate-200"
            >
              Studio Tools
            </a>
            <a
              href="#african-voices"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-slate-200"
            >
              African Voices
            </a>
            <a
              href="#languages"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-slate-200"
            >
              Languages
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm text-slate-200"
            >
              FAQ
            </a>
            <button
              type="button"
              onClick={() => onEnterStudio('tts')}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold"
            >
              Start Creating Free
            </button>
          </div>
        )}
      </header>

      <main>
        <AdBlockNotice adsense={config.adsense} variant="landing" />
        {/* 1. Hero Section with Live Interactive TTS Preview */}
        <section className="relative overflow-hidden border-b border-slate-800/70">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(37,99,235,0.18),_transparent_55%),radial-gradient(ellipse_at_bottom_left,_rgba(124,58,237,0.14),_transparent_55%)]"
          />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              {/* Left Copy Column */}
              <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
                <p className="text-sm font-medium text-blue-400">
                  VoxCraft AI · Give Your Words a Voice
                </p>

                <h1 className="font-display font-bold tracking-tight text-white hero-headline-balance text-[clamp(2.25rem,4vw,3.65rem)] leading-[1.08]">
                  Turn Your Words Into Powerful, Natural-Sounding Voices.
                </h1>

                <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
                  Create professional AI voiceovers, translate content, produce audiobooks and bring your scripts to
                  life in multiple languages. Everything you need to create amazing audio, in one place.
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => onEnterStudio('tts')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm sm:text-base transition-colors whitespace-nowrap shrink-0"
                  >
                    Start Creating Free
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEnterStudio('voice-library')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-100 border border-slate-700 font-semibold text-sm sm:text-base transition-colors whitespace-nowrap shrink-0"
                  >
                    <Volume2 className="w-4 h-4 text-violet-400" />
                    Explore AI Voices
                  </button>
                </div>

                {/* Studio Image Banner */}
                <div className="pt-4">
                  <div className="rounded-2xl overflow-hidden border border-slate-800 bg-[#0D1326] aspect-[16/9] max-h-56 relative">
                    {!heroImgFailed ? (
                      <img
                        src="/src/assets/images/hero_voice_studio_1794585720738.jpg"
                        alt="VoxCraft AI studio condenser microphone and audio interface"
                        referrerPolicy="no-referrer"
                        onError={() => setHeroImgFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0D1326] to-[#161F3D] p-6 text-center">
                        <Mic2 className="w-8 h-8 text-blue-400 mb-2" />
                        <p className="text-sm font-medium text-slate-200">Studio-Grade AI Voice Production</p>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#070B19]/85 via-transparent to-transparent flex items-end p-4">
                      <p className="text-xs text-slate-300">
                        Powered by Google Gemini 3.8 TTS &amp; Gemini 4 · Export WAV or MP3
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Live Interactive Studio Preview */}
              <div className="lg:col-span-6 flex flex-col">
                <div className="studio-surface-elevated rounded-2xl p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-5">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <h2 className="font-display text-base font-semibold text-white">
                        Live Voice Studio Preview
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Test real speech generation directly in your browser
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEnterStudio('dashboard')}
                      className="text-xs font-medium text-blue-400 hover:text-blue-300 whitespace-nowrap shrink-0"
                    >
                      Open Full Studio →
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="hero-voice" className="block text-xs font-medium text-slate-400 mb-1.5">
                          Voice Identifier
                        </label>
                        <select
                          id="hero-voice"
                          value={previewVoiceId}
                          onChange={(e) => setPreviewVoiceId(e.target.value)}
                          className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                        >
                          {config.voices.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.genderLabel})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="hero-lang" className="block text-xs font-medium text-slate-400 mb-1.5">
                          Language / Variety
                        </label>
                        <select
                          id="hero-lang"
                          value={previewLangCode}
                          onChange={(e) => {
                            const nextCode = e.target.value;
                            setPreviewLangCode(nextCode);
                            const matched = config.languages.find((l) => l.code === nextCode);
                            if (matched) setPreviewText(matched.sampleText);
                          }}
                          className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                        >
                          {config.languages.map((lang) => (
                            <option key={lang.code} value={lang.code}>
                              {lang.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="hero-script" className="text-xs font-medium text-slate-400">
                          Script Input (up to 2,000 words)
                        </label>
                        <span
                          className={`text-xs font-mono tabular-nums ${
                            previewWordCount > 2000 ? 'text-rose-400 font-semibold' : 'text-slate-400'
                          }`}
                        >
                          {previewWordCount.toLocaleString()} / 2,000 words · {previewText.length.toLocaleString()} chars
                        </span>
                      </div>
                      <textarea
                        id="hero-script"
                        rows={5}
                        maxLength={config.quotas.maxCharsPerRequest || 20000}
                        value={previewText}
                        onChange={(e) => setPreviewText(e.target.value)}
                        className="w-full rounded-xl bg-[#070B19] border border-slate-700 p-3.5 text-sm text-slate-100 leading-relaxed focus:outline-none focus:border-blue-500 resize-y"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={previewLoading}
                      onClick={handleGenerateHeroPreview}
                      className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      {previewLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating Real Speech...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Generate Voice Preview
                        </>
                      )}
                    </button>

                    {previewError && (
                      <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
                        {previewError}
                      </div>
                    )}

                    {previewAudio ? (
                      <AudioPlayer
                        title={`Preview · ${previewVoiceId}`}
                        subtitle={config.languages.find((l) => l.code === previewLangCode)?.name}
                        audioBase64={previewAudio.audioBase64}
                        mimeType={previewAudio.mimeType}
                        format="wav"
                        durationSeconds={previewAudio.durationSeconds}
                      />
                    ) : (
                      <div className="rounded-xl border border-slate-800/90 bg-[#070B19]/70 p-4 text-xs text-slate-400 flex items-center justify-between gap-3">
                        <span>Click "Generate Voice Preview" above to hear real synthesized audio.</span>
                        <span className="font-mono text-slate-500 shrink-0">24kHz WAV</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <AdSlot placement="homepage-banner" adsense={config.adsense} />

        {/* 2. How VoxCraft AI Works */}
        <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-b border-slate-800/70">
          <div className="max-w-2xl mb-10">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
              How VoxCraft AI Works
            </h2>
            <p className="text-slate-400 mt-2">
              Move from raw idea to mastered downloadable audio in three connected steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01. Draft or Translate Your Script',
                desc: 'Write directly in the editor, generate structured narration with AI Script Writer, or translate existing copy into another language without losing the original.',
              },
              {
                step: '02. Select Voice, Delivery & Pronunciation',
                desc: 'Choose a verified Gemini voice, configure emotional delivery instructions, and refine tricky brand names or regional words with Pronunciation Control.',
              },
              {
                step: '03. Generate, Edit & Export WAV or MP3',
                desc: 'Synthesize speech securely server-side, arrange clips with fades in the Audio Editing Studio, and export ready-to-publish audio.',
              },
            ].map((item) => (
              <div key={item.step} className="studio-surface rounded-2xl p-6 space-y-2.5">
                <h3 className="font-display text-lg font-semibold text-white">{item.step}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 3. AI Voice Generation Features */}
        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-b border-slate-800/70">
          <div className="max-w-2xl mb-10">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Complete AI Voice Production Suite
            </h2>
            <p className="text-slate-400 mt-2">
              Purpose-built studios for creators, educators, authors, and marketing teams.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 studio-surface rounded-2xl p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <h3 className="font-display text-xl font-semibold text-white">
                  Advanced Text-to-Speech &amp; Emotion Control
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
                  Switch seamlessly between low-latency Gemini 3.8 Flash Lite TTS and flagship Gemini 3.8 Flash TTS
                  for expressive storytelling, news delivery, calm tutorials, or persuasive commercial reads.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => onEnterStudio('tts')}
                  className="text-sm font-semibold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1.5"
                >
                  Open Text-to-Speech Studio <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="studio-surface rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-violet-600/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
                <Mic2 className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-semibold text-white">Pronunciation Assistance</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Analyze names, acronyms, and regional terms before generation to add phonetic hints or clearer word
                alternatives.
              </p>
            </div>
          </div>
        </section>

        {/* 4. International Language Support */}
        <section id="languages" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-b border-slate-800/70">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                International Language Support
              </h2>
              <p className="text-slate-400 mt-2">
                Multilingual speech generation and transparent dialect availability across global regions.
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0D1326] border border-slate-800">
              {(
                [
                  { id: 'all', label: 'All Languages' },
                  { id: 'global', label: 'International' },
                  { id: 'african', label: 'African Collection' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLangRegionFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    langRegionFilter === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredLanguages.map((lang) => (
              <div key={lang.code} className="studio-surface rounded-xl p-4 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold text-white truncate">{lang.name}</h3>
                  <Globe2 className="w-4 h-4 text-slate-500 shrink-0" />
                </div>
                <p className="text-xs text-slate-400">
                  {lang.region} ·{' '}
                  {lang.supportTier === 'multilingual-native'
                    ? 'Multilingual'
                    : lang.supportTier === 'style-guided'
                    ? 'Style-Guided'
                    : 'Pronunciation-Guided'}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 5. African Voice Collection */}
        <section id="african-voices" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-b border-slate-800/70">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-5">
              <div className="rounded-2xl overflow-hidden border border-slate-800 bg-[#0D1326] h-full min-h-[280px]">
                <img
                  src="/src/assets/images/african_voices_spotlight_1794585720833.jpg"
                  alt="West African studio presenter recording voiceover narration"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                Dedicated African Voice Collection
              </h2>
              <p className="text-slate-300 leading-relaxed">
                Built for creators, advertisers, and educators across Nigeria, Ghana, Kenya, South Africa, and the
                diaspora. VoxCraft AI pairs Gemini 3.8 Voice Design instructions and pronunciation guidance with honest
                availability indicators—never fabricating fake native accent labels.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {africanLanguages.slice(0, 8).map((lang) => (
                  <div key={lang.code} className="studio-surface rounded-xl p-3.5">
                    <p className="text-sm font-semibold text-white">{lang.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{lang.availabilityNote}</p>
                  </div>
                ))}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => onEnterStudio('voice-library')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
                >
                  Explore African Voice Collection
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 6 & 7. YouTube Voiceover Creation & Business Advertising Voiceovers */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-b border-slate-800/70">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="studio-surface rounded-2xl p-7 space-y-4">
              <div className="w-11 h-11 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Video className="w-5 h-5" />
              </div>
              <h2 className="font-display text-2xl font-bold text-white">YouTube Voiceover Creation</h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Generate narration-ready scripts tailored for educational channels, documentaries, storytelling,
                explainers, and faceless YouTube videos with natural paragraph pacing.
              </p>
              <ul className="text-sm text-slate-400 space-y-1.5">
                <li>· 8 specialized YouTube narration styles</li>
                <li>· Inline script editing and direct audio generation</li>
                <li>· Export WAV or MP3 for your video timeline</li>
              </ul>
              <button
                type="button"
                onClick={() => onEnterStudio('youtube')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-300"
              >
                Open YouTube Voiceover Studio <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="studio-surface rounded-2xl p-7 space-y-4">
              <div className="w-11 h-11 rounded-xl bg-violet-600/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
                <Megaphone className="w-5 h-5" />
              </div>
              <h2 className="font-display text-2xl font-bold text-white">Business Advertising Voiceovers</h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Create radio spots, social ads, and product promos. Enter your business name, key selling point, and
                contact info to generate persuasive scripts with an estimated read duration.
              </p>
              <ul className="text-sm text-slate-400 space-y-1.5">
                <li>· Luxury, Urgent Promotional, Corporate, and Friendly styles</li>
                <li>· Optional opening hook and call-to-action generator</li>
                <li>· Estimated duration calculator for 15s, 30s, or 60s spots</li>
              </ul>
              <button
                type="button"
                onClick={() => onEnterStudio('advert')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-400 hover:text-violet-300"
              >
                Open Business Advert Generator <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* 8. Audiobook Production & 9. AI Translation and Narration */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-b border-slate-800/70">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-6 studio-surface rounded-2xl overflow-hidden flex flex-col">
              <div className="aspect-[4/3] max-h-64 overflow-hidden bg-[#070B19]">
                <img
                  src="/src/assets/images/audiobook_production_studio_1794585721876.jpg"
                  alt="Open manuscript and headphones in audiobook narration booth"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-blue-400 text-sm font-medium">
                    <BookOpen className="w-4 h-4" />
                    <span>Audiobook Maker</span>
                  </div>
                  <h2 className="font-display text-2xl font-bold text-white">Long-Form Audiobook Production</h2>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Upload documents or paste manuscripts chapter by chapter. VoxCraft AI divides long chapters at
                    sentence boundaries, preserves consistent voice selection, tracks chunk progress, and merges
                    finished audio cleanly.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onEnterStudio('audiobook')}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-300"
                >
                  Launch Audiobook Maker <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 studio-surface rounded-2xl p-7 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-11 h-11 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Languages className="w-5 h-5" />
                </div>
                <h2 className="font-display text-2xl font-bold text-white">AI Translation and Narration</h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Keep your original text side-by-side with the translated script—never silently overwriting your source.
                  Edit any translated phrase, regenerate on demand, and speak it naturally in the target language.
                </p>
                <div className="rounded-xl bg-[#070B19] border border-slate-800 p-4 space-y-2 text-xs">
                  <p className="text-slate-400">Workflow preview</p>
                  <p className="text-slate-200">Source Text (Auto-detect or Manual) → Gemini Translation → Editable Target Script → Target-Language Voiceover</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onEnterStudio('translate')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-300"
              >
                Open Translate &amp; Speak <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* 10. Multi-Speaker Conversations & 11. Audio Editing Studio */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-b border-slate-800/70">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-6 studio-surface rounded-2xl overflow-hidden flex flex-col">
              <div className="aspect-[4/3] max-h-64 overflow-hidden bg-[#070B19]">
                <img
                  src="/src/assets/images/podcast_conversation_studio_1794585720842.jpg"
                  alt="Two podcast hosts recording a multi-speaker dialogue"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-violet-400 text-sm font-medium">
                    <Users className="w-4 h-4" />
                    <span>Conversation Studio</span>
                  </div>
                  <h2 className="font-display text-2xl font-bold text-white">Multi-Speaker Conversations</h2>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Build podcasts, interviews, and educational dialogues. Uses native dual-speaker Gemini 3.8 Flash
                    TTS (supporting cues like <code className="font-mono text-xs text-blue-300">|yeah|</code> or{' '}
                    <code className="font-mono text-xs text-blue-300">&lt;breath&gt;</code>) with automatic sequential
                    combining for 3+ speakers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onEnterStudio('conversation')}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-400 hover:text-violet-300"
                >
                  Open Conversation Studio <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="lg:col-span-6 studio-surface rounded-2xl p-7 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-11 h-11 rounded-xl bg-violet-600/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
                  <Scissors className="w-5 h-5" />
                </div>
                <h2 className="font-display text-2xl font-bold text-white">Browser Audio Editing Studio</h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Import your generated voiceovers or local WAV/MP3 files into a visual timeline workspace. Reorder
                  clips, adjust start timing, fine-tune clip volume, apply fade-in and fade-out curves, preview the
                  master mix, and export a combined audio file.
                </p>
                <ul className="text-sm text-slate-400 space-y-1.5">
                  <li>· Real decoded waveform visualization per clip</li>
                  <li>· OfflineAudioContext mixdown rendering</li>
                  <li>· Direct WAV and MP3 master export</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => onEnterStudio('audio-editor')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-400 hover:text-violet-300"
              >
                Open Audio Editing Studio <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* 12. Frequently Asked Questions */}
        <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-10">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-400 mt-2">
              Honest answers about models, supported languages, formats, and free usage limits.
            </p>
          </div>

          <div className="space-y-3">
            {FAQS.map((item, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div key={item.q} className="studio-surface rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left"
                  >
                    <span className="font-display text-sm sm:text-base font-semibold text-white">{item.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-sm text-slate-300 leading-relaxed border-t border-slate-800/70 pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 13. Final Call to Action */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="rounded-2xl bg-gradient-to-r from-blue-600/20 via-[#111936] to-violet-600/20 border border-slate-700/80 p-8 sm:p-12 text-center space-y-5">
            <h2 className="font-display text-2xl sm:text-4xl font-bold text-white hero-headline-balance">
              Ready to Give Your Words a Voice?
            </h2>
            <p className="text-slate-300 max-w-xl mx-auto text-sm sm:text-base">
              Enter the VoxCraft AI production studio to write scripts, generate expressive voiceovers, translate
              content, and export clean audio for free.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => onEnterStudio('tts')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm sm:text-base transition-colors"
              >
                Start Creating Free
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onEnterStudio('script-writer')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-semibold text-sm sm:text-base transition-colors"
              >
                Try AI Script Writer
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* 14. Professional Footer */}
      <footer className="border-t border-slate-800/80 bg-[#050814]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <Logo />
              <p className="text-xs text-slate-400 leading-relaxed">
                Give Your Words a Voice. International AI voice production platform for creators, educators, authors,
                and businesses.
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Studio Tools</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <button type="button" onClick={() => onEnterStudio('tts')} className="hover:text-white">
                    Text to Speech
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onEnterStudio('script-writer')} className="hover:text-white">
                    AI Script Writer
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onEnterStudio('youtube')} className="hover:text-white">
                    YouTube Voiceover
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onEnterStudio('advert')} className="hover:text-white">
                    Business Advert Generator
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">Production</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <button type="button" onClick={() => onEnterStudio('translate')} className="hover:text-white">
                    Translate and Speak
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onEnterStudio('conversation')} className="hover:text-white">
                    Conversation Studio
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onEnterStudio('audiobook')} className="hover:text-white">
                    Audiobook Maker
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => onEnterStudio('audio-editor')} className="hover:text-white">
                    Audio Editing Studio
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">
                Legal &amp; Support
              </h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <button type="button" onClick={() => setLegalTab('privacy')} className="hover:text-white">
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setLegalTab('terms')} className="hover:text-white">
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setLegalTab('adsense')} className="hover:text-white">
                    AdSense &amp; Monetization
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => setLegalTab('contact')} className="hover:text-white">
                    Contact Us
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} VoxCraft AI. All rights reserved.</p>
            <p>Powered by server-side Google Gemini speech &amp; language models.</p>
          </div>
        </div>
      </footer>

      <LegalModal
        activeTab={legalTab}
        onClose={() => setLegalTab(null)}
        onSwitchTab={(tab) => setLegalTab(tab)}
      />
    </div>
  );
}
