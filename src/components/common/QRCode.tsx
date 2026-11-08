import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeSVGProps {
  value: string;
  size?: number;
  className?: string;
}

export const QRCodeSVG: React.FC<QRCodeSVGProps> = ({ value, size = 200, className = '' }) => {
  const [svgString, setSvgString] = useState<string>('');

  useEffect(() => {
    if (!value) return;

    QRCode.toString(value, {
      type: 'svg',
      margin: 1,
      width: size,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((svg) => {
        setSvgString(svg);
      })
      .catch((err) => {
        console.error('Failed to generate QR code', err);
      });
  }, [value, size]);

  if (!svgString) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`bg-slate-100 animate-pulse rounded-lg flex items-center justify-center ${className}`}
      />
    );
  }

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  );
};

