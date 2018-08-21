export const version = '2'

export function isVirtualNode(x) {
  return x && x.type === "VirtualNode" && x.version === version
}

export function isVirtualText(x) {
  return x && x.type === "VirtualText" && x.version === version
}

export function isWidget(w) {
  return w && w.type === "Widget"
}
