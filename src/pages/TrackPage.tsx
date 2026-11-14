import { useParams } from 'react-router-dom';
import ComingSoon from '../components/layout/ComingSoon';
import { getTrack } from '../registry/tracks';
import NotFound from './NotFound';

export default function TrackPage() {
  const { tech } = useParams();
  const track = getTrack(tech);
  if (!track) return <NotFound />;

  return (
    <ComingSoon title={`${track.icon} ${track.name}`} step="Step 3 (syllabus)">
      <p>{track.tagline}. The modules and topics for this track will be listed here.</p>
    </ComingSoon>
  );
}
