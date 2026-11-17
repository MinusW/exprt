import React from 'react';
import { PlayCircle, Image as ImageIcon, Headphones, Sparkles } from 'lucide-react';
import type { MediaBlock } from '../../types.js';
import { MathText } from '../MathText.js';

interface Props {
  block: MediaBlock;
}

function getYouTubeEmbedUrl(url: string, startTime?: number): string | null {
  try {
    let videoId = '';
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com')) {
      videoId = parsed.searchParams.get('v') || '';
      if (!videoId && parsed.pathname.startsWith('/embed/')) {
        videoId = parsed.pathname.replace('/embed/', '');
      }
    } else if (parsed.hostname.includes('youtu.be')) {
      videoId = parsed.pathname.replace('/', '');
    }

    if (!videoId) return null;
    const startParam = startTime ? `?start=${Math.floor(startTime)}` : '';
    return `https://www.youtube-nocookie.com/embed/${videoId}${startParam}`;
  } catch {
    return null;
  }
}

export const MediaBlockView: React.FC<Props> = ({ block }) => {
  const isYouTube = block.media_type === 'youtube';
  const embedUrl = isYouTube ? getYouTubeEmbedUrl(block.url, block.start_time) : null;
  const resolvedUrl = /^https?:\/\//i.test(block.url)
    ? block.url
    : `./${block.url.replace(/^\.\//, '').replace(/^\//, '')}`;

  return (
    <div className="my-6 border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Title / Type Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200 text-slate-700 text-xs">
        <div className="flex items-center space-x-2">
          {block.media_type === 'youtube' || block.media_type === 'video' ? (
            <PlayCircle className="w-4 h-4 text-rose-500" />
          ) : block.media_type === 'audio' ? (
            <Headphones className="w-4 h-4 text-emerald-500" />
          ) : (
            <ImageIcon className="w-4 h-4 text-sky-500" />
          )}
          <span className="font-semibold text-slate-800">
            {block.title || `${block.media_type.toUpperCase()} Resource`}
          </span>
        </div>
        {block.start_time !== undefined && block.start_time > 0 && (
          <span className="text-[11px] font-mono text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded">
            Starts at {Math.floor(block.start_time / 60)}:
            {String(Math.floor(block.start_time % 60)).padStart(2, '0')}
          </span>
        )}
      </div>

      {/* Why Watch / Listen Callout */}
      {block.why_watch && (
        <div className="p-3.5 bg-amber-50/80 border-b border-amber-100 flex items-start space-x-2.5 text-xs text-amber-900">
          <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold uppercase tracking-wider text-[10px] text-amber-700 block mb-0.5">
              Pedagogical Objective
            </span>
            <MathText text={block.why_watch} className="leading-relaxed" />
          </div>
        </div>
      )}

      {/* Media Player / Container */}
      <div className="p-4 bg-slate-900/5 flex items-center justify-center">
        {block.media_type === 'youtube' && (
          <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-inner bg-black">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title={block.title || 'YouTube video'}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                Invalid YouTube URL
              </div>
            )}
          </div>
        )}

        {block.media_type === 'video' && (
          <video
            controls
            src={resolvedUrl}
            className="w-full rounded-lg max-h-[460px] bg-black shadow"
          >
            Your browser does not support the video tag.
          </video>
        )}

        {block.media_type === 'audio' && (
          <div className="w-full py-4 px-2">
            <audio controls src={resolvedUrl} className="w-full">
              Your browser does not support the audio element.
            </audio>
          </div>
        )}

        {block.media_type === 'image' && (
          <div className="flex flex-col items-center">
            <img
              src={resolvedUrl}
              alt={block.caption || block.title || 'Media asset'}
              className="max-h-[500px] w-auto rounded-lg shadow-sm object-contain"
              loading="lazy"
            />
          </div>
        )}
      </div>

      {block.caption && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-600 italic text-center">
          {block.caption}
        </div>
      )}
    </div>
  );
};
