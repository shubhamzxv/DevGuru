import ComingSoon from '../components/layout/ComingSoon';
import { TRACKS } from '../registry/tracks';

export default function CheatsheetsPage() {
  return (
    <ComingSoon title="Cheat sheets" step="Step 6">
      <p>One-glance summaries for all {TRACKS.length} tracks in one place.</p>
    </ComingSoon>
  );
}
