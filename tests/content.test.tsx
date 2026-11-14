import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import CodeBlock from '../src/components/content/CodeBlock';
import { mdxComponents } from '../src/registry/mdxComponents';
import { allTopics, findTopic, getTopicLoader, writtenTopics } from '../src/registry/topics';
import { getTrack, TRACKS } from '../src/registry/tracks';

const written = TRACKS.flatMap((track) =>
  writtenTopics(track).map((topic) => ({ track, topic, name: `${track.slug}/${topic.slug}` })),
);

describe('topic content', () => {
  it('has at least one written topic', () => {
    expect(written.length).toBeGreaterThan(0);
  });

  it.each(written)('$name renders every template block', async ({ track, topic }) => {
    const loader = getTopicLoader(track.slug, topic.slug);
    expect(loader).toBeDefined();
    const { default: Content, frontmatter } = await loader!();

    expect(frontmatter.id).toBe(topic.id);
    expect(frontmatter.title).toBe(topic.title);
    expect(frontmatter.summary.length).toBeGreaterThan(10);
    expect(frontmatter.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Content components={mdxComponents} />
      </MemoryRouter>,
    );
    for (const heading of [
      'Real-life example',
      'Common mistakes',
      'Interview questions',
      'Quick quiz',
      'Cheat sheet',
    ]) {
      expect(html).toContain(heading);
    }
    expect(html).toContain('token'); // code was syntax highlighted
    expect(html).not.toMatch(/lorem ipsum/i);
  });
});

describe('topic registry', () => {
  it('finds a topic and its neighbours', () => {
    const python = getTrack('python');
    expect(python).toBeDefined();
    const first = allTopics(python!)[0];
    expect(first).toBeDefined();
    const position = findTopic(python!, first!.slug);
    expect(position?.current.id).toBe(first!.id);
    expect(position?.prev).toBeUndefined();
    expect(findTopic(python!, 'no-such-topic')).toBeUndefined();
  });
});

describe('CodeBlock', () => {
  it('highlights the extra languages (SQL, Bash)', () => {
    const sql = renderToStaticMarkup(
      <MemoryRouter>
        <CodeBlock code="SELECT name FROM employees;" language="sql" />
      </MemoryRouter>,
    );
    expect(sql).toContain('keyword');
    const bash = renderToStaticMarkup(<CodeBlock code={'echo "hi" # say hi'} language="bash" />);
    expect(bash).toContain('comment');
  });
});
