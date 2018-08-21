import VPatch from '../vnode/vpatch'
import diffProps from './diff-props'
import { isVNode, isVText, isWidget } from '../vnode/typeof-vnode'

export default function diff (a, b) {
  const patch = { a }
  walk(a, b, patch, 0)
  return patch
}

function walk (a, b, patch, index) {
  if (a === b) {
    return
  }

  let apply = patch[index]
  let applyClear = false

  if (isUndef(b)) {
    if (!isWidget(a)) {
      destroyWidgets(a, patch, index)
      // 此时的 patch[index] 可能已经改变，有 thunk 函数的情况下
      // applyClear = true
      apply = patch[index]
    }

    apply = appendPatch(apply, new VPatch(VPatch.REMOVE, a, b))
  } else if (isVNode(b)) {
    if (isVNode(a) && isSameVnode(a, b)) {
      const propsPatch = diffProps(a.properties, b.properties)

      if (propsPatch) {
        apply = appendPatch(apply, new VPatch(VPatch.PROPS, a, propsPatch))
      }

      // 继续 diff 子节点
      diffChildren(a, b, patch, apply, index)
    } else {
      // a 有可能是 text 和 widget
      applyClear = true
      apply = appendPatch(apply, new VPatch(VPatch.vNode, a, b))
    }
  } else if (isVText(b)) {
    if (!isVText(a)) {
      // 此时 a 为 vnode 或者 widget
      apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
      applyClear = true
    } else if (a.text !== b.text) {
      apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
    }
  } else if (isWidget(b)) {
    if (!isWidget(a)) {
      applyClear = true
    }

    apply = appendPatch(apply, new VPatch(VPatch.WIDGET, a, b))
  }

  // 我们只记录有变化的，apply 记录着当前这个 vnode 的变化
  // 比如 props 子元素的增删，移动等，可能是一个数组
  if (apply) {
    patch[index] = apply
  }

  if (applyClear) {
    destroyWidgets(a, patch, index)
  }
}

function destroyWidgets (vNode, patch, index) {
  if (isWidget(vNode)) {
    // 我们对 widget 节点进行 patch 主要是为了调用 destroy
    // 不然我们在直接替换节点的时候就把这个 widget 直接删掉了都不用管
    if (typeof vNode.destroy === 'function') {
      patch
    }
  } else if (isVNode(vNode) && vNode.hasWidgets) {

  }
}

function diffChildren(a, b, patch, apply, index) {

}

function appendPatch(apply, patch) {
  if (apply) {
    Array.isArray(apply)
      ? apply.push(patch)
      : apply = [apply, patch]

    return apply
  }
  return patch
}

function isSameVnode (a, b) {
  return (
      a.tagName === b.tagName &&
      a.namespace === b.namespace &&
      a.key === b.key
  )
}

function isUndef (v) {
  return v === undefined || v === null
}