/** Completed-run Watch routes and the isolated Earth 3D proof remove dashboard chrome. */
export function isImmersiveViewerPath(pathname: string) {
  return /^\/earth\/neighborhood\/?$/.test(pathname) ||
    /^\/simulations\/[^/]+\/runs\/[^/]+\/watch\/?$/.test(pathname) ||
    /^\/anything-wars\/events\/[^/]+\/runs\/[^/]+\/watch\/?$/.test(pathname);
}
