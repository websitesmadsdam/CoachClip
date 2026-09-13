/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  HelpCircle,
  Video,
  Scissors,
  Edit3,
  Share2,
  HardDrive,
  FolderDown,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
  CheckCircle,
  Info
} from "lucide-react";

export const UserGuide: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const steps = [
    {
      num: 1,
      icon: Video,
      title: "1. Vælg din video",
      desc: "Upload en kamp- eller træningsvideo fra din enhed. CoachClip understøtter alle gængse format som MP4 og MOV.",
      color: "bg-blue-500/10 text-blue-600 border-blue-200"
    },
    {
      num: 2,
      icon: Scissors,
      title: "2. Isoler situationen",
      desc: "Vælg det præcise tidsudsnit med slideren. Hold klippet kort og præcist (typisk 5–15 sekunder) for maksimal opmærksomhed.",
      color: "bg-indigo-500/10 text-indigo-600 border-indigo-200"
    },
    {
      num: 3,
      icon: Edit3,
      title: "3. Tilføj visuel taktik",
      desc: "Indsæt cirkler om nøglespillere, tegn løbepile eller tilføj Freeze Frames (pause) med forklarende tekst i afgørende sekunder.",
      color: "bg-amber-500/10 text-amber-600 border-amber-200"
    },
    {
      num: 4,
      icon: Share2,
      title: "4. Gem, eksportér & del",
      desc: "Eksportér det færdige taktiske klip til en samlet MP4-video, og del det direkte med holdet via WhatsApp, Holdsport eller Messenger.",
      color: "bg-emerald-500/10 text-emerald-600 border-emerald-200"
    }
  ];

  const faqs = [
    {
      q: "Gælder den samme lagring på computer og iPhone?",
      a: "Ja! Princippet om lokal lagring (IndexedDB) og download af MP4-filer til din enheds 'Overførsler'-mappe er nøjagtig det samme. Bemærk dog, at lagringen er knyttet til den enkelte enhed og browser. Projekter oprettet på din computer ligger på computeren, og projekter oprettet på din iPhone ligger lokalt på din iPhone."
    },
    {
      q: "Hvor bliver mine analyserede klip og projekter gemt?",
      a: "Dine arbejdsprojekter, tidskoder, tekster og taktiske tegninger gemmes lokalt i din browser via din enheds database (IndexedDB). Eksportklip, du downloader (MP4-filer), gemmes direkte i din enheds standard Overførsler-mappe (Downloads)."
    },
    {
      q: "Gemmes mine tunge rå-videoer i skyen?",
      a: "Nej. CoachClip arbejder direkte på den videofil, du vælger på din enhed, og selve eksporten sker også i din browser. Videoen sendes ingen steder."
    },
    {
      q: "Hvorfor beder CoachClip mig om at 'Vælg videofil igen'?",
      a: "Hvis browserens midlertidige hukommelsessti udløber (f.eks. efter genstart af din telefon eller browser), beder CoachClip dig om at pege på den samme videofil igen. Når du gør det, genindlæses alle dine markeringer og tidskoder automatisk uden tab af data!"
    },
    {
      q: "Kan jeg bruge CoachClip uden internet?",
      a: "Appen skal have internet for at åbne. Når den er åben, sker redigering og eksport på din enhed."
    }
  ];

  return (
    <div className="flex flex-col gap-6 text-slate-800">
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-brand-dark via-slate-900 to-blue-950 text-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-800 relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-clear/20 border border-brand-clear/30 text-brand-clear text-xs font-bold uppercase tracking-wider mb-3">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>CoachClip Brugervejledning</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Sådan får du mest ud af CoachClip
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm mt-2 max-w-xl leading-relaxed">
            Lær hvordan du hurtigt opretter taktiske klip, forstår hvor dine data opbevares, og deler professionelle videosekvenser med spillere og trænerteam.
          </p>
        </div>
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-brand-clear/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* STEP BY STEP GUIDE */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-xl bg-brand-clear/10 text-brand-clear flex items-center justify-center font-black text-sm">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-brand-dark leading-none">Arbejdsgang i 4 enkle trin</h3>
            <span className="text-xs text-slate-400 font-medium">Fra rå kampvideo til færdigt taktisk analysbillede</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {steps.map((step) => {
            const IconComp = step.icon;
            return (
              <div
                key={step.num}
                className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 flex flex-col gap-3 transition-all hover:border-slate-300 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold text-sm ${step.color}`}>
                    <IconComp className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white px-2.5 py-1 rounded-md border border-slate-100">
                    Trin {step.num}
                  </span>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-850 text-sm mb-1">{step.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-normal">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* STORAGE EXPLANATION SECTION */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black text-sm">
            <HardDrive className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-brand-dark leading-none">Hvor bliver mine klip og data gemt?</h3>
            <span className="text-xs text-slate-400 font-medium">Gennemskuelig information om din enheds lager og eksportfiler</span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Card 1: Local DB */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 sm:p-5 flex gap-4 items-start">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-extrabold text-slate-850 text-sm">1. Lokalt i din browser (IndexedDB)</h4>
                <span className="bg-blue-100 text-blue-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">Primær lagring</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Alle dine oprettede projekter, titler, tidsintervaller, tegninger og samlinger gemmes <strong>sikkert og lynhurtigt i browserens lokale database på din enhed (CoachClipDB)</strong>. Du behøver ikke at logge ind eller uploade private projekter til eksterne servere for at arbejde videre.
              </p>
            </div>
          </div>

          {/* Card 2: Exports / Downloads */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 sm:p-5 flex gap-4 items-start">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
              <FolderDown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-extrabold text-slate-850 text-sm">2. Færdige MP4-videofiler (Downloads)</h4>
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">Overførsler</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Når klippet er færdigt, kan du trykke <strong>Del klip</strong> for at sende det via WhatsApp, AirDrop eller gemme det i Fotos, eller <strong>Download MP4</strong> for at gemme filen i din enheds <strong>Overførsler-mappe (Downloads)</strong>.
              </p>
            </div>
          </div>

          {/* Card 3: Privacy */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 sm:p-5 flex gap-4 items-start">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-extrabold text-slate-850 text-sm">3. Fortrolighed: alt sker på din enhed</h4>
                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">Sikkerhed</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Klippet laves direkte i din browser. Videoen og det færdige klip forlader aldrig din enhed, og den midlertidige eksportfil slettes, når du forlader skærmen med det færdige klip. Dine videoer og holddata tilhører 100% dig.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* TIPS FOR COACHES */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 rounded-3xl p-6 sm:p-7 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between">
        <div className="flex gap-4 items-center">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-850 text-sm">Hurtig taktisk tip til pausen</h4>
            <p className="text-xs text-slate-600 mt-0.5 max-w-lg">
              Brug <strong>Freeze Frames (Pause)</strong> i stedet for lange forklaringer. Sæt videoen på pause i 3 sekunder lige inden en afgørende aflevering, og tegn en gul cirkel om rummet – det giver øjeblikkelig forståelse hos spillerne!
            </p>
          </div>
        </div>
      </div>

      {/* ACCORDION FAQ */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black text-sm">
            <Info className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-brand-dark leading-none">Spørgsmål og svar</h3>
            <span className="text-xs text-slate-400 font-medium">Ofte stillede spørgsmål om CoachClip</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="border border-slate-200 rounded-2xl overflow-hidden transition-all bg-slate-50/50"
            >
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full text-left p-4 sm:p-4.5 font-bold text-xs sm:text-sm text-slate-800 flex items-center justify-between gap-3 hover:bg-slate-100/80 transition-colors cursor-pointer"
              >
                <span>{faq.q}</span>
                {openFaq === idx ? (
                  <ChevronUp className="w-4.5 h-4.5 text-brand-clear shrink-0" />
                ) : (
                  <ChevronDown className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                )}
              </button>
              {openFaq === idx && (
                <div className="p-4 sm:p-4.5 pt-0 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-white">
                  <div className="flex gap-2 items-start mt-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{faq.a}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
