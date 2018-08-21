const aChildren = [
  {key: '_1'},
  {},
  {},
  {a: 'taotao'},
  {key: '_3'},
  {key: '_5'},
]

const bChildren = [
  {key: '_3'},
  {key: '_4'},
  {},
  {},
  {key: '_1'},
  {key: '_5'},
  {key: '_6'},
]
// reorder(aChildren, bChildren)

export function reorder (aChildren, bChildren) {
  const bChildIndex = keyIndex(bChildren)
  const bKeys = bChildIndex.keys
  const bFree = bChildIndex.free

  if (bFree.length === bChildren.length) {
    return {
      children: bChildren,
      moves: null,
    }
  }

  const aChildIndex = keyIndex(aChildren)
  const aKeys = aChildIndex.keys
  const aFree = aChildIndex.free

  if (aFree.length === aChildren.length) {
    return {
      children: bChildren,
      moves: null,
    }
  }

  const newChildren = []
  const freeCount = bFree.length
  let freeIndex = 0
  let deletedItems = 0

  // 第一步：先按照 a 的循环，把 b 中能与之一一对应的给排序起来
  for (let i = 0, len = aChildren.length; i < len; i++) {
    const aItem = aChildren[i]
    let itemIndex

    if (aItem.key) {
        if (bKeys.hasOwnProperty(aItem.key)) {
          itemIndex = bKeys[aItem.key]
          newChildren.push(bChildren[itemIndex])
        } else {
          // 我们添加个 null 代表此处在后续是要给删除的
          deletedItems++
          newChildren.push(null)
        }
    } else {
      // 找到 bChildren 的 free 元素，一一对应添加
      if (freeIndex < freeCount) {
        itemIndex = bFree[freeIndex++]
        newChildren.push(bChildren[itemIndex])
      } else {
        // 如果 a 中的 free 比 b 中的 free 多，多的我们删掉
        deletedItems++
        newChildren.push(null)
      }
    }
  }

  // 第二步：我们对剩下的 bChildren 中的 item 进行处理（例如例子中的 {key: '_6'} 到这里还没有放到 newChildren 中）
  // 用 >= 是因为 freeIndex++ 了，比如 bFree: [0: xx]，而 freeIndex -> 1
  const lastFreeIndex = freeIndex >= bFree.length ? bChildren.length : bFree[freeIndex]

  for (let j = 0, len = bChildren.length; j < len; j++) {
    const newItem = bChildren[j]

    if (newItem.key) {
      // 如果 aKeys 中没有找到，代表是新建的 item
      if (!aKeys.hasOwnProperty(newItem.key)) {
        newChildren.push(newItem)
      }
    } else {
      // 有可能在上一次循环，b 中的 free 元素没有被取干净，那么此时 j 是有可能 >= lastFreeIndex 的
      if (j >= lastFreeIndex) {
        newChildren.push(newItem)
      }
    }
  }

  // 此时我们已经把 b 按照 a 的顺序排列好了，这样 a 就可以与排好序的 b 进行 diff 了
  // 但是现在的 b 与原来的 b 是有顺序区别的，我们要记录下这种移动顺序，在真实节点中去移动
  // 第三步：记录节点的移动

  const simulate = newChildren.slice()
  const removes = []
  const inserts = []
  let simulateIndex = 0
  let simulateItem

  for (let k = 0, len = bChildren.length; k < len;) {
    const wantedItem = bChildren[k]
    simulateItem = simulate[simulateIndex]

    // 如果 simulateItem 为 null，代表是原先 a 中需要删除的元素（有点像 promise 那个拿最底层的 promise 实例哈）
    while (simulateItem === null && simulate.length) {
      // key 为 null 代表 b 中没有与 a 对应的元素，是要直接删掉的
      removes.push(remove(simulate, simulateIndex, null))
      simulateItem = simulate[simulateIndex]
    }

    if (simulateItem && simulateItem.key === wantedItem.key) {
      // 如果重新排序后的 simulate 还是在原来的位置，就没必要记录差异
      k++
      simulateIndex++
    } else {
      if (wantedItem.key) {
        if (simulateItem && simulateItem.key) {
          const positionInBkeys = bKeys[simulateItem.key]

          if (positionInBkeys === k + 1) {
            // 如果 positionInBkeys === k + 1 代表这个 simulateItem 应该是在当前这个 wantedItem 后面的
            // 是应该出现的位置
            inserts.push({key: wantedItem.key, to: k})
          } else {
            // 如果这里不是应该出现的位置，而 simulateItem.key 也不等于 wantedItem.key，那么代表这个位置应该是
            // 移动到一个不相邻的距离，我们让他消失，并记录这个 item 的位置
            removes.push(remove(simulate, simulateIndex, simulateItem.key))
            simulateItem = simulate[simulateIndex]

            // 我们现在拿到下一个元素，如果相等，那么 simulateItem 就是在正常的位置，调到下一次循环
            if (simulateItem && simulateItem.key === wantedItem.key) {
              simulateIndex++
            } else {
              // 如果不相等，我们就把 wantedItem 插入到 k 这个位置（以 bChildren 的位置位置，所以按照 wantedItem 的顺序走肯定没错）
              inserts.push({key: wantedItem.key, to: k})
            }
          }
        } else {
          // 代表此时的 simulateItem 是 free 元素，一直加（复位）
          inserts.push({key: wantedItem.key, to: k})
        }
        k++
      } else if (simulateItem && simulateItem.key) {
        // 代表此时的 wantedItem 是 free 元素，simulateItem 有 key，位置肯定不对，一直删（移动）
        removes.push(remove(simulate, simulateIndex, simulateItem.key))
      }
    }
  }

  /**
   *  我们总结，只要新旧俩节点 key 不等，那么分为以下两种情况处理
   *  1. 如果是相邻俩节点的位移，我们只要把 后面的一个元素 插入 到前面即可（positionInBkeys === k + 1）
   *  2. 如果不是相邻的位移的节点，那么代表是多距离位移，我们直接把当前的元素 remove（这个 item 瞬移开始😁）
   *     然后我们对比删除后的 simulate 集合的最前面一个元素，如果和当前 wantedItem key 是相等的，那么
   *     现在的顺序是对的，跳过，如果不等，我们直接插入 wantedItem（我们以新的 children 顺序为准），此时的
   *     wantedItem 就是正确的位置，就放在这里，如果有 remove 掉的元素找到了此时的 wantedItem，那就是移动
   *     否则，这个 wantedItem 就是新增的
   *
   *  那么还存在没有 wantedItem 和 没有 simulateItem 的情况
   *  1. wantedItem 没有 key，那么此时 wantedItem 肯定不相等 simulateItem(相等已过滤)，而且 wantedItem 肯定是 free 元素
   *     那么把 simulateItem 如果有 key，那肯定不算 free 元素，那位置肯定不对，就要 remove（瞬移），知道找到相等的为止
   *     （肯定有，应为我们在上一次循环中，把新旧节点的都放到 newChildren 中了，只不过去重了）然后我们再对 bChildren 中剩下的，
   *     继续进行循环，进行判断，最终 insert 里面的，其实这些就是那些瞬移的节点，只不过，这里可能少了，如果少了的，那就是真删了，
   *     如果多了的，那就是真的新增的，如果找到了瞬移对应的节点，那就是真的移动了。
   *
   *  2. simulateItem 没有 key，那就是 free 元素，(想想 wantedItem 没有 key，开始了 free 元素的 move)，这里就是要
   *     开始 free 元素的 insert (复位)，此处一直 insert wantedItem, 直到找到相等的为止，然后继续判断
   *
   *  3. 如果 simulateItem 没有，那有可能是我们再 remove 的时候给删没了（想想 wantedItem 没有 key 的 时候），我们只要
   *     把当前的 wantedItem 插入到 insert 数组中
   *
   *  可以看到针对 wantedItem 和 simulateItem 为 free 元素的时候，一个使劲删，一个使劲加，知道找到相等的为止，因为没有 key
   *  也不用管 key 对不对了，只要按照新的 item 顺序排列就好了
   * */

  // 删除 simulate 中多余的元素，也就是残留的旧节点，因为我们把 bChildren 的节点都处理过，剩下的都是不需要的
  // 这里的 simulateIndex 是相同属性的节点计数，每次计数的时候，simulate 都会过掉一个元素，所以只要一般
  // 情况下都是想相等的，除非 simulate 有多余的节点
  while(simulateIndex < simulate.length) {
    simulateItem = simulate[simulateIndex]
    removes.push(remove(simulate, simulateIndex, simulateItem && simulateItem.key))
  }

  // 全部都是删除，没有插入（就是没有移动与新增）
  if (removes.length === deletedItems && !inserts.length) {
    return {
      children: newChildren,
      moves: null,
    }
  }

  return {
    children: newChildren,
    moves: {
      removes: removes,
      inserts: inserts,
    }
  }
}

function remove(arr, index, key) {
  arr.splice(index, 1)

  return {
      from: index,
      key: key
  }
}

function keyIndex(children) {
  var keys = {}
  var free = []
  var length = children.length

  for (var i = 0; i < length; i++) {
      var child = children[i]
      if (child.key) {
          keys[child.key] = i
      } else {
          free.push(i)
      }
  }

  return {
      keys: keys,     // A hash of key name to index
      free: free      // An array of unkeyed item indices
  }
}

// _d(aChildren, bChildren)
function _d (aChildren, bChildren) {
  // O(M) time, O(M) memory
    // 我们需要拿到新的子元素 key 值，我们需要通过这个 key 进行排序
    // 可以看这篇文章关于 react 子元素 diff 排序的问题
    // https://zhuanlan.zhihu.com/p/20346379
    var bChildIndex = keyIndex(bChildren)
    var bKeys = bChildIndex.keys
    var bFree = bChildIndex.free

    // 如果我们发现没有一个 key（全是 free）,我们认为没有可以排序的，直接 return
    if (bFree.length === bChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(N) time, O(N) memory
    // 同样的，我们拿到旧的 vnodeTree
    var aChildIndex = keyIndex(aChildren)
    var aKeys = aChildIndex.keys
    var aFree = aChildIndex.free

    // 同样的，没有 keys 供排序，直接 return
    if (aFree.length === aChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(MAX(N, M)) memory
    var newChildren = []

    var freeIndex = 0
    // 这里的 bFree length 不一定是等于 aFree length 的，意思是新的节点可能删掉了几个 key
    var freeCount = bFree.length
    var deletedItems = 0

    // Iterate through a and match a node in b
    // O(N) time,
    for (var i = 0 ; i < aChildren.length; i++) {
        var aItem = aChildren[i]
        var itemIndex

        // 我们拿到旧的子节点 key
        if (aItem.key) {
            // 如果对应的新的子 children 里面也有这个 key，我们认为就是移动了
            if (bKeys.hasOwnProperty(aItem.key)) {
                // Match up the old keys
                itemIndex = bKeys[aItem.key]
                newChildren.push(bChildren[itemIndex])

            } else {
                // 如果没有找到，那么我们认为在新节点中，这个元素被删除掉了（删除旧节点）
                // Remove old keyed items
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        } else { // 一般情况下不会出现 else 的情况
            // Match the item in a with the next free item in b
            // 匹配 a 中的 item 与 b 中的下一个 free item
            // 如果此时，freeIndex 还是小于 freeCount
            // 我们就需要拿到当前的元素的索引
            /**
             *  因为在有对应 key 的节点中，我们已经拿到了对应的节点，
             *  剩下的没有 key 的节点中，都是从前到后排序的（排除了拥有 keys 的元素）
             *  我们此时不用关心那些 free 元素的顺序，直接加到 newChildren 中去，
             *  因为没有办法进行比较（没有最重要的 key），所以只能按照顺序添加
             *  后面对这些没有 key 的元素一一比较，要么删除，要么继续 diff 子元素（等于是递归 walk）
             * */
            // freeIndex < bFree.length
            if (freeIndex < freeCount) {
                itemIndex = bFree[freeIndex++]
                newChildren.push(bChildren[itemIndex])
            } else {
                // b 中没有与之匹配的 free items
                // a 中的 free item，所以额外的 free 节点被删除
                // 代表有可能新的这个节点增加了 key ，但是我们也没有办法进行比较了，所以直接把原先的给删掉，重新生成
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        }
    }

    // 我们拿到最后一个 freeIndex，这里以新生成的子的节点为准，毕竟新的才是最后要添加到真实 dom 的
    // 如果 freeIndex >= bFree.length，代表 aChildren 中的 free 元素比 bChildren 中要多
    // bChildren 中的带 key 的元素要更多，所有采用 bChildren.length（尼玛你 a 中的 free 再多，我们还是以 b 为准，
    // 毕竟我们是对 b 进行排序）
    // 当然，如果反过来，b 中的 free 元素多，那么就以 bFree 为准
    var lastFreeIndex = freeIndex >= bFree.length ?
        bChildren.length :
        bFree[freeIndex]

    // Iterate through b and append any new keys
    // 迭代 b 并添加任何新的 keys
    // O(M) time
    // 在上一个循环中，我们对 bChilren 中的元素进行了过滤，其中有以下两种被放入到了 newChildren 数组中
    // 1. aChildren 中带有 key 的元素与之在 bChildren 中能找到对应的，
    // 2. aChildren 中没有带 key 的元素（free 元素），但与 bChidlre 一一对应的

    // bChidlren 中此时还可能剩下以下两种没有被放到 newChildren 中去
    // 1. bChildren 中带有 key 而 aChildren 中没有
    // 2. bChildren 中没有 key（free元素） 而 aChildren 中有的，于是这个元素虽然没有 key，但是并没有被放到 newChildren，
    //    因为在上一个循环中，只是以 aChildren free 元素做基准的，所有 bChlidren 中依然存在 free 元素的可能性
    for (var j = 0; j < bChildren.length; j++) {
        var newItem = bChildren[j]

        if (newItem.key) {
            // 我们在这里只需要判断 akeys 中没有的情况，因为有 keys 的情况在上一个循环处理过了
            if (!aKeys.hasOwnProperty(newItem.key)) {
                // Add any new keyed items
                // We are adding new items to the end and then sorting them
                // in place. In future we should insert new items in place.
                newChildren.push(newItem)
            }
        } else if (j >= lastFreeIndex) {
            // 这里 j 一定要 >= lastFreeIndex 的原因是：
            // 如果 j < lastFreeIndex，在上一轮循环就已经被添加过了（a 中的 free 元素 ---> b 中的 free 元素）
            // 添加任何剩余的 non-keyed 元素（只要是 free 元素我们就添加）
            newChildren.push(newItem)
        }
    }

    // -------------------------------------- 华丽丽的分割线 ----------------------------------------------------
    // 经过上面两层判断，两层循环，我们已经把 bChildren 全部给重新按照 aChildren 的元素进行了排序，还得到了需要删除的元素个数
    // 但是 newChildren 的元素是有多余的（可能比 a 和 b 的length 多），有些为 null 的节点是代表 a 中需要删除的节点
    // 比如： a -> [1, 2, 3]  b -> [1, 3, 4] 得到的 newChildren -> [1, null, 3, 4]
    // 下面我们需要进行找出哪些是需要 move 和 insert 的

    // 先拷贝一波（不是深拷贝, 也不需要深拷贝，我们只对 newChildren 的直接子元素进行操作，也就是 vnode）
    var simulate = newChildren.slice()
    // 先预定义
    var simulateIndex = 0
    var removes = []
    var inserts = []
    var simulateItem

    console.log(bChildren, simulateItem, bKeys);

    for (var k = 0; k < bChildren.length;) {
        // wantedItem 为没有排序的节点，simulateItem为依据排过序的节点
        var wantedItem = bChildren[k]
        simulateItem = simulate[simulateIndex]

        // remove items
        // simulate 会在 remove 时进行删减，所有要用 simulate.length 防一手
        // 使用 while 是可以删除连续的为 null 的元素
        while (simulateItem === null && simulate.length) {
            // 如果 simulateItem 为 null 代表需要删除
            removes.push(remove(simulate, simulateIndex, null))
            simulateItem = simulate[simulateIndex]
        }

        // simulateItem 可能为空字符或 undefined
        // 如果 simulateItem key 与 wantedItem 不能对应，说明要么是需要 remove 的要么是 insert 的
        // 否则如果 key 一致，代表他们俩是在相同的位置上（重新排序后还是在原来的位置），不需要操作它
        // debugger
        console.log(wantedItem, simulateItem);
        if (!simulateItem || simulateItem.key !== wantedItem.key) {
            // 这里好像是通过 key 进行对比，如果没有当前的 simulateItem的 key 与当前的 wantedItem key 不等
            // 而且与 simulateItem.key 在 bChildren 中所在的位置也不在下一个 wantedItem 中相等（这里加 1 是因为下次循环，
            // 我们就相等了，记住，此时的 k++ 了，而 simulateIndex 还没++）就代表我们需要开始进行删除（移动），因为和原始坐标（bChildre）
            // 不一致, 可不就是要移动了吗。从哪里删除 from 到哪里插入 to
            // 代表移动 from - to （想象一个东西再某一个地方消失又从另一个地方出现，同时又记录这两地的坐标，是不是就是移动了）
            // 还是很巧妙的
            // if we need a key in this position...
            if (wantedItem.key) {
                // 如果相应的 simulateItem 也存在 key
                if (simulateItem && simulateItem.key) {
                    // if an insert doesn't put this key in place, it needs to move
                    // 如果插入没有将此键放置到位，则需要移动
                    // + 1 的原因是每次开始移动都要 remove，simulate 减少的也是 1 个元素
                    // console.log(bKeys[simulateItem.key], simulateItem.key, i + 1);
                    if (bKeys[simulateItem.key] !== k + 1) {
                        // remove 可以理解为开始移动，记录初始坐标
                        removes.push(remove(simulate, simulateIndex, simulateItem.key))
                        simulateItem = simulate[simulateIndex]
                        // if the remove didn't put the wanted item in place, we need to insert it
                        // 如果删除没有把想要的 元素 放在适当的位置，我们需要插入它
                        // 意思是此处还是不相等，代表此处还是缺一位 和 wantedItem 一样 key 的 sumulateItem
                        if (!simulateItem || simulateItem.key !== wantedItem.key) {
                            inserts.push({key: wantedItem.key, to: k})
                        }
                        // items are matching, so skip ahead
                        else {
                            simulateIndex++
                        }
                    }
                    // 如果等于下一位，代表 simulateItem 当前的这里本来应该和 wantendItem 一样 key 的元素，
                    // 只不过前面被删除掉了，所以错了一位，此时我们发现前面被删除的元素应该出现的地方，所有我们要 inserts
                    // 记录下坐标，这样就完成了一次 move
                    // 所以我们认为只要相等就代表此处缺一个 sumulateItem
                    else {
                        inserts.push({key: wantedItem.key, to: k})
                    }
                }
                // 如果没有 simulateItem 或 key
                else {
                    inserts.push({key: wantedItem.key, to: k})
                }
                k++
            }
            // a key in simulate has no matching wanted key, remove it
            // 如果 wantedItem 中没有 key，但是 simulateItem 中有，我们就需要删除这个元素，因为这个元素肯定是旧的 aChildren 中的
            // 因为 wantedItem 代表最新的 vnodeTree，我们不能凭空把 simulateItem 给增加到真实的 dom 中
            // 删掉当前的 simulateItem 后拿到下一个 simulateItem 继续进入循环
            else if (simulateItem && simulateItem.key) {
                removes.push(remove(simulate, simulateIndex, simulateItem.key))
            }

        // 到这里我们发现如果走到了 else if 或者都没有进入这个俩判断分支，那么会进入死循环，其实不然
        // 当我们进入第二次循环，会重新判断 simulateItem.key 和 wantedItem.key，
        // 因为我们直到我们判断完所有 key 不等的情况
        // 但是我们任务 !simulateItem 和 !wantedItem.key 不会同时出现，不然真的会进入死循环🤣
        }
        else {
            // 如果 simulateItem.key 和 wantedItem.key 相等，那么
            simulateIndex++
            k++
        }
    }
    console.log(removes, inserts);
}