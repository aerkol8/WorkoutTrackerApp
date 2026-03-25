import Constants from 'expo-constants';
import SourceCode from 'react-native/Libraries/NativeModules/specs/NativeSourceCode';

const DEFAULT_MEDIA_PROTOCOL = 'http:';
const DEFAULT_MEDIA_PORT = '8788';
const LOCAL_HOSTNAME_PATTERN = /^(localhost|0\.0\.0\.0|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/i;

function uniqueValues(values = []) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function sanitizeUrl(value = '') {
  return String(value || '').trim().replace(/\/+$/g, '');
}

function isAbsoluteUrl(value = '') {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function parseUrl(value = '') {
  try {
    return new URL(value);
  } catch (error) {
    return null;
  }
}

function extractHost(value = '') {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';

  const parsed = parseUrl(rawValue);
  if (parsed?.hostname) return parsed.hostname;

  const strippedProtocol = rawValue.replace(/^[a-z]+:\/\//i, '');
  const authority = strippedProtocol.split('/')[0] || '';
  const hostname = authority.split('@').pop()?.split(':')[0] || '';
  return hostname.replace(/^\[|\]$/g, '');
}

function isLocalHostname(value = '') {
  const hostname = String(value || '').trim().toLowerCase();
  if (!hostname) return false;
  return LOCAL_HOSTNAME_PATTERN.test(hostname) || hostname.endsWith('.local');
}

function buildBaseUrl(hostname = '', options = {}) {
  const safeHost = String(hostname || '').trim();
  if (!safeHost) return '';

  const protocol = options.protocol || DEFAULT_MEDIA_PROTOCOL;
  const port = options.port || DEFAULT_MEDIA_PORT;
  const basePath = String(options.basePath || '').trim().replace(/\/+$/g, '');

  return sanitizeUrl(`${protocol}//${safeHost}${port ? `:${port}` : ''}${basePath}`);
}

function getConfiguredMediaBaseUrl() {
  return sanitizeUrl(process.env.EXPO_PUBLIC_EXERCISE_MEDIA_BASE_URL || '');
}

function getBundleScriptUrl() {
  try {
    return String(SourceCode?.getConstants?.().scriptURL || '').trim();
  } catch (error) {
    return '';
  }
}

function getBundleHost() {
  return extractHost(getBundleScriptUrl());
}

function shouldSkipLocalMediaInCurrentMode() {
  const bundleHost = getBundleHost();
  if (!bundleHost || isLocalHostname(bundleHost)) return false;

  const configuredBaseUrl = getConfiguredMediaBaseUrl();
  const configuredHost = parseUrl(configuredBaseUrl)?.hostname || '';
  return !configuredHost || isLocalHostname(configuredHost);
}

function getExpoHostCandidates() {
  return uniqueValues([
    getBundleHost(),
    extractHost(Constants.expoConfig?.hostUri),
    extractHost(Constants.expoGoConfig?.hostUri),
    extractHost(Constants.expoGoConfig?.debuggerHost),
    extractHost(Constants.linkingUri),
    extractHost(Constants.experienceUrl),
  ].filter(Boolean));
}

function deriveRelativeMediaPath(value = '') {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';
  if (!isAbsoluteUrl(rawValue)) return rawValue.replace(/^\/+/g, '');

  const parsed = parseUrl(rawValue);
  if (!parsed) return '';

  const matchedPath = parsed.pathname.match(/\/((?:images|videos)\/.+)$/i);
  return matchedPath ? matchedPath[1].replace(/^\/+/g, '') : '';
}

export function getExerciseMediaBaseCandidates() {
  const configuredBaseUrl = getConfiguredMediaBaseUrl();
  const configuredUrl = parseUrl(configuredBaseUrl);
  const configuredHost = configuredUrl?.hostname || '';
  const protocol = configuredUrl?.protocol || DEFAULT_MEDIA_PROTOCOL;
  const port = configuredUrl?.port || DEFAULT_MEDIA_PORT;
  const basePath = configuredUrl?.pathname?.replace(/\/+$/g, '') || '';

  const bases = [];
  const addBase = (url) => {
    const normalized = sanitizeUrl(url);
    if (normalized) bases.push(normalized);
  };

  if (configuredBaseUrl && !isLocalHostname(configuredHost)) {
    addBase(configuredBaseUrl);
  }

  getExpoHostCandidates().forEach(hostname => {
    addBase(buildBaseUrl(hostname, { protocol, port, basePath }));
  });

  if (configuredBaseUrl && isLocalHostname(configuredHost)) {
    addBase(configuredBaseUrl);
  }

  ['10.0.2.2', '127.0.0.1', 'localhost'].forEach(hostname => {
    addBase(buildBaseUrl(hostname, { protocol, port, basePath }));
  });

  return uniqueValues(bases);
}

export function resolveExerciseMediaCandidates(mediaRef = '', resolvedUrl = '') {
  const relativePath = deriveRelativeMediaPath(mediaRef) || deriveRelativeMediaPath(resolvedUrl);

  if (!relativePath) {
    return uniqueValues([
      sanitizeUrl(mediaRef),
      sanitizeUrl(resolvedUrl),
    ].filter(Boolean));
  }

  if (shouldSkipLocalMediaInCurrentMode()) {
    return [];
  }

  return uniqueValues(
    getExerciseMediaBaseCandidates().map(baseUrl => `${baseUrl}/${relativePath}`)
  );
}

export function resolveExerciseMediaLink(mediaRef = '', resolvedUrl = '') {
  return resolveExerciseMediaCandidates(mediaRef, resolvedUrl)[0] || null;
}
