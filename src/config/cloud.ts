/**
 * Where logged-in learners' progress is saved: one JSON file per learner in a
 * public S3 bucket (no backend). Set VITE_PROGRESS_BASE_URL in .env to change it,
 * or to an empty string to turn login off.
 *
 * The bucket name has dots (com.shubham.devguru), so the virtual-hosted address
 * https://com.shubham.devguru.s3.ap-south-1.amazonaws.com fails HTTPS (the
 * certificate covers only one name level). The path-style address below works.
 */
const DEFAULT_BASE_URL = 'https://s3.ap-south-1.amazonaws.com/com.shubham.devguru';

const fromEnv = import.meta.env.VITE_PROGRESS_BASE_URL as string | undefined;

export const PROGRESS_BASE_URL = (fromEnv ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
export const PROGRESS_PREFIX = 'progress/';
export const CLOUD_SYNC_ENABLED = PROGRESS_BASE_URL !== '';
