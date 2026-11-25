import React from 'react';
import type { MarkdownBlock } from '../../types.js';
import { RichMarkdown } from '../RichMarkdown.js';

interface Props {
  block: MarkdownBlock;
}

export const MarkdownBlockView: React.FC<Props> = ({ block }) => {
  return <RichMarkdown content={block.content} />;
};
