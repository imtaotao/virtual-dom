const noChild = {}

// 我们查找真是需要进行 patch 的真实节点，这样我们就不用遍历所有的节点
export default function domIndex (rootNode, tree, indices) {
  indices.sort((a, b) => a > b)

  return recurse(rootNode, tree, indices, null, 0)
}

function recurse (rootNode, tree, indices, nodes, rootIndex) {
  nodes = nodes || {}

  console.log(rootNode, tree, indices, nodes, rootIndex);
}