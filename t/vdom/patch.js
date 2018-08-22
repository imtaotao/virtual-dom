import render from './create-element'
import domIndex from './dom-index'
import patchOp from './patch-op'

export default function patch (rootNode, patches, renderOptions) {
  renderOptions = renderOptions || {}
  renderOptions.patch = renderOptions.patch && renderOptions.patch !== patch
    ? renderOptions.patch
    : patchRecursive
  renderOptions.render = renderOptions.render || render

  return renderOptions.patch(rootNode, patches, renderOptions)
}

function patchRecursive (rootNode, patches, renderOptions) {
  console.log(patches, renderOptions);
  const indices = patchIndices(patches)

  if (!indices.length) {
    return rootNode
  }

  const index = domIndex(rootNode, patches.a, indices)
  const ownerDocument = rootNode.ownerDocument
}

function applyPatch () {
  
}

function patchIndices (patches) {
  const indices = []

  for (let key in patches) {
    if (key !== 'a') {
      indices.push(Number(key))
    }    
  }

  return indices
}
