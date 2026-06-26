export interface SubtitleSegment {
  id: number;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
}

export function formatTimeSRT(seconds: number): string {
  const ms = Math.round((seconds % 1) * 1000);
  const totalSeconds = Math.floor(seconds) + (ms === 1000 ? 1 : 0);
  const finalMs = ms === 1000 ? 0 : ms;
  
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${finalMs.toString().padStart(3, '0')}`;
}

export function formatTimeVTT(seconds: number): string {
  const ms = Math.round((seconds % 1) * 1000);
  const totalSeconds = Math.floor(seconds) + (ms === 1000 ? 1 : 0);
  const finalMs = ms === 1000 ? 0 : ms;
  
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${finalMs.toString().padStart(3, '0')}`;
}

export function formatTimeASS(seconds: number): string {
  const cs = Math.round((seconds % 1) * 100);
  const totalSeconds = Math.floor(seconds) + (cs === 100 ? 1 : 0);
  const finalCs = cs === 100 ? 0 : cs;
  
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${finalCs.toString().padStart(2, '0')}`;
}

export function exportToSRT(segments: SubtitleSegment[]): string {
  return segments
    .map(seg => {
      const startStr = formatTimeSRT(seg.start);
      const endStr = formatTimeSRT(seg.end);
      return `${seg.id}\n${startStr} --> ${endStr}\n${seg.text}\n`;
    })
    .join('\n');
}

export function exportToVTT(segments: SubtitleSegment[]): string {
  const body = segments
    .map(seg => {
      const startStr = formatTimeVTT(seg.start);
      const endStr = formatTimeVTT(seg.end);
      return `${seg.id}\n${startStr} --> ${endStr}\n${seg.text}\n`;
    })
    .join('\n');
  return `WEBVTT\n\n${body}`;
}

export function exportToASS(segments: SubtitleSegment[]): string {
  let ass = `[Script Info]
Title: Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: 640
PlayResY: 360
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  for (const seg of segments) {
    const startStr = formatTimeASS(seg.start);
    const endStr = formatTimeASS(seg.end);
    const cleanText = seg.text.replace(/\r?\n/g, '\\N');
    ass += `Dialogue: 0,${startStr},${endStr},Default,,0000,0000,0000,,${cleanText}\n`;
  }
  return ass;
}
