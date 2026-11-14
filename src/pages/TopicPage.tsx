import { Link, useParams } from 'react-router-dom';
import ComingSoon from '../components/layout/ComingSoon';
import { getTrack } from '../registry/tracks';
import NotFound from './NotFound';

export default function TopicPage() {
  const { tech, topic } = useParams();
  const track = getTrack(tech);
  if (!track || !topic) return <NotFound />;

  return (
    <ComingSoon title={`${track.name}: ${topic}`} step="Step 2 (content system)">
      <p>
        This page will show the topic template: analogy, explanation, code, playground, common
        mistakes, interview questions, quiz and cheat sheet.
      </p>
      <p className="mt-3">
        <Link
          to={`/track/${track.slug}`}
          className="font-semibold text-brand-700 underline dark:text-brand-300"
        >
          Back to {track.name}
        </Link>
      </p>
    </ComingSoon>
  );
}
