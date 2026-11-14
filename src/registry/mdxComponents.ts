import type { MDXComponents } from 'mdx/types';
import Analogy from '../components/content/Analogy';
import CheatSheet from '../components/content/CheatSheet';
import { InterviewQA, QA } from '../components/content/InterviewQA';
import { Mistake, Mistakes, Right, Wrong } from '../components/content/MistakeBox';
import {
  A,
  Blockquote,
  H2,
  H3,
  Hr,
  InlineCode,
  Li,
  MdxPre,
  Ol,
  P,
  Table,
  Td,
  Th,
  Ul,
} from '../components/content/Prose';
import Visual from '../components/content/Visual';
import Playground from '../components/playground/Playground';
import Quiz from '../components/quiz/Quiz';

/**
 * Everything a topic MDX file can use WITHOUT importing it.
 * - lower-case keys style normal Markdown (## heading, lists, `code`, tables)
 * - Capital keys are the template blocks: <Analogy>, <Quiz>, ...
 * To offer a new block to content writers, add it here.
 */
export const mdxComponents: MDXComponents = {
  h2: H2,
  h3: H3,
  p: P,
  ul: Ul,
  ol: Ol,
  li: Li,
  a: A,
  blockquote: Blockquote,
  hr: Hr,
  table: Table,
  th: Th,
  td: Td,
  code: InlineCode,
  pre: MdxPre,
  Analogy,
  Visual,
  Playground,
  Mistakes,
  Mistake,
  Wrong,
  Right,
  InterviewQA,
  QA,
  Quiz,
  CheatSheet,
};
