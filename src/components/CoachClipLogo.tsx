/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface CoachClipLogoProps {
  className?: string;
  size?: number;
}

export const CoachClipLogo: React.FC<CoachClipLogoProps> = ({ className = "w-10 h-10", size = 40 }) => {
  return (
    <div className={`relative flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 shadow-lg shadow-blue-600/30 border border-blue-400/30 overflow-hidden shrink-0 transition-transform active:scale-95 ${className}`}>
      {/* Subtle radial ambient highlight */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(251,191,36,0.3),transparent_65%)] pointer-events-none" />

      <svg
        width={size * 0.65}
        height={size * 0.65}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 text-white drop-shadow-md"
      >
        {/* Tactical Playbook Frame */}
        <rect x="2.5" y="3.5" width="19" height="17" rx="3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
        
        {/* Top Film perforations */}
        <path d="M6 3.5V6.5M10 3.5V6.5M14 3.5V6.5M18 3.5V6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        
        {/* Play Triangle Symbol with glowing yellow fill */}
        <path
          d="M9.5 8.5L16 12L9.5 15.5V8.5Z"
          fill="#FBBF24"
          stroke="#FBBF24"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />

        {/* Tactical Diagram Dotted Arrow Path */}
        <circle cx="6.5" cy="17" r="1" fill="#FBBF24" />
        <path d="M6.5 17C9 17 11 15 13 15" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="1.5 1.5" strokeLinecap="round" opacity="0.9" />
      </svg>
    </div>
  );
};
