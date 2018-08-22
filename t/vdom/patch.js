import render from './create-element'
import domIndex from './dom-index'
import patchOp from './patch-op'

export default function patch (rootNode, patches, renderOptions) {
  console.log(patches);
  renderOptions = renderOptions || {}
  renderOptions.patch = renderOptions.patch && renderOptions.patch !== patch
    ? renderOptions.patch
    : patchRecursive
  renderOptions.render = renderOptions.render || render

  return renderOptions.patch(rootNode, patches, renderOptions)
}

function patchRecursive (rootNode, patches, renderOptions) {
  // console.log(rootNode, patches, renderOptions);
}
