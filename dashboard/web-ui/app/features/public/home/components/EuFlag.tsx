import React from 'react';

export const EuFlag: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg viewBox="0 0 48 32" className={className} role="img" aria-label="European Union flag">
        <rect width="48" height="32" rx="6" fill="#1d4ed8" />
        {Array.from({ length: 12 }).map((_, index) => {
            const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
            const cx = (24 + Math.cos(angle) * 8.5).toFixed(3);
            const cy = (16 + Math.sin(angle) * 8.5).toFixed(3);
            return <circle key={index} cx={cx} cy={cy} r="1.2" fill="#fde047" />;
        })}
    </svg>
);
