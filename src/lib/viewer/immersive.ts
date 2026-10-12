/** Only completed-run Watch routes remove the authenticated dashboard chrome. */
export function isImmersiveViewerPath(pathname: string) {
  return /^\/simulations\/[^/]+\/runs\/[^/]+\/watch\/?$/.test(pathname) ||
    /^\/anything-wars\/events\/[^/]+\/runs\/[^/]+\/watch\/?$/.test(pathname);
}
