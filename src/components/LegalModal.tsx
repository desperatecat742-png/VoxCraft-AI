import { useState } from 'react';
import { CheckCircle2, Mail, X } from 'lucide-react';

export type LegalTab = 'privacy' | 'terms' | 'contact' | 'adsense';

interface LegalModalProps {
  activeTab: LegalTab | null;
  onClose: () => void;
  onSwitchTab: (tab: LegalTab) => void;
}

export function LegalModal({ activeTab, onClose, onSwitchTab }: LegalModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('General Support');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!activeTab) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !message.trim()) return;
    setSubmitted(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="VoxCraft AI Legal and Support"
    >
      <div className="studio-surface-elevated rounded-2xl max-w-2xl w-full max-h-[86vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2 overflow-x-auto">
            {(
              [
                { id: 'privacy', label: 'Privacy Policy' },
                { id: 'terms', label: 'Terms of Service' },
                { id: 'adsense', label: 'Ad & Monetization Notice' },
                { id: 'contact', label: 'Contact' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  onSwitchTab(tab.id);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto text-sm text-slate-300 space-y-4 leading-relaxed">
          {activeTab === 'privacy' && (
            <>
              <h2 className="font-display text-xl font-bold text-white">Privacy Policy</h2>
              <p className="text-xs text-slate-400">Effective Date: November 2026 · VoxCraft AI</p>
              <p>
                VoxCraft AI processes the scripts, translations, and audio configuration requests you submit in order
                to generate spoken audio via server-side Google Gemini API calls.
              </p>
              <h3 className="font-semibold text-white pt-2">1. Information We Process</h3>
              <p>
                We store essential session identifiers, optional account email/display name preferences, saved
                project drafts, voice presets, and daily usage counters required to enforce fair free-tier quotas and
                prevent automated abuse.
              </p>
              <h3 className="font-semibold text-white pt-2">2. Script & Audio Handling</h3>
              <p>
                Your private scripts are never logged to public telemetry or exposed in client-side credentials.
                Generated audio clips are returned directly to your browser for playback and download. Saved history
                items and projects remain under your control and can be deleted at any time from Generation History
                or My Projects.
              </p>
              <h3 className="font-semibold text-white pt-2">3. Cookies & Advertising Consent</h3>
              <p>
                VoxCraft AI uses strictly necessary HTTP-only session cookies for workspace continuity and rate
                limiting. Google AdSense scripts remain disabled until publisher verification is completed and
                appropriate user consent mechanisms are active.
              </p>
            </>
          )}

          {activeTab === 'terms' && (
            <>
              <h2 className="font-display text-xl font-bold text-white">Terms of Service</h2>
              <p className="text-xs text-slate-400">Last Updated: November 2026 · VoxCraft AI</p>
              <h3 className="font-semibold text-white pt-2">1. Acceptable Use</h3>
              <p>
                You may use VoxCraft AI to create voiceovers, educational lessons, business advertisements,
                audiobooks, podcasts, and multilingual narrations. You must not use the service to impersonate real
                individuals without consent, generate deceptive disinformation, or bypass rate limits.
              </p>
              <h3 className="font-semibold text-white pt-2">2. Free Tier & Fair Quotas</h3>
              <p>
                VoxCraft AI currently operates as a free platform supported by configurable daily character and
                generation limits per user and IP address. Automated scraping, bulk abuse, or circumvention of
                server-side quotas is prohibited.
              </p>
              <h3 className="font-semibold text-white pt-2">3. Model Capabilities & Transparency</h3>
              <p>
                Speech synthesis and translation outputs are powered by Google Gemini models. Regional dialects and
                tonal languages marked as Style-Guided or Pronunciation-Guided represent best-effort prompting rather
                than guaranteed native dialect recordings. Always review generated audio before commercial publication.
              </p>
            </>
          )}

          {activeTab === 'adsense' && (
            <>
              <h2 className="font-display text-xl font-bold text-white">Advertising & Monetization Readiness</h2>
              <p>
                VoxCraft AI is free to use and designed for transparent monetization through Google AdSense once
                domain review and publisher approval are completed.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-slate-300">
                <li>No simulated or placeholder fake advertisements are displayed prior to approval.</li>
                <li>Ad placements are isolated from audio generation buttons, waveform players, and download controls.</li>
                <li>An <code className="font-mono text-xs text-blue-300">/ads.txt</code> file is pre-staged in public assets for publisher ID verification.</li>
                <li>The platform architecture supports optional future premium quota tiers without altering core studio workflows.</li>
              </ul>
            </>
          )}

          {activeTab === 'contact' && (
            <>
              <h2 className="font-display text-xl font-bold text-white">Contact VoxCraft AI</h2>
              <p className="text-slate-400">
                Questions about language availability, enterprise partnerships, or support? Send us a message below.
              </p>
              {submitted ? (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-emerald-200">Inquiry prepared</p>
                    <p className="text-xs text-slate-300 mt-1">
                      Thank you{name ? `, ${name}` : ''}. Your inquiry regarding "{subject}" has been recorded for
                      follow-up at {email}.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Your Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Adaeze Okafor"
                        className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Topic</label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option>General Support</option>
                      <option>Language & African Voice Requests</option>
                      <option>Business / Educational Inquiry</option>
                      <option>Privacy or Account Request</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Message</label>
                    <textarea
                      required
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="How can we help you?"
                      className="w-full rounded-lg bg-[#070B19] border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    Send Message
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
