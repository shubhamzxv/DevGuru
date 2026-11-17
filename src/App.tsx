import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Home from './pages/Home';

// Each page is its own chunk, so phones download only what they open.
const TrackPage = lazy(() => import('./pages/TrackPage'));
const TopicPage = lazy(() => import('./pages/TopicPage'));
const PlaygroundPage = lazy(() => import('./pages/PlaygroundPage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const ProgressPage = lazy(() => import('./pages/ProgressPage'));
const CheatsheetsPage = lazy(() => import('./pages/CheatsheetsPage'));
const InterviewPage = lazy(() => import('./pages/InterviewPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="track/:tech" element={<TrackPage />} />
        <Route path="track/:tech/:topic" element={<TopicPage />} />
        <Route path="playground/:lang" element={<PlaygroundPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="cheatsheets" element={<CheatsheetsPage />} />
        <Route path="interview" element={<InterviewPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
