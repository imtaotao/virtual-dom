var isArray = require("x-is-array")

var VPatch = require("../vnode/vpatch")
var isVNode = require("../vnode/is-vnode")
var isVText = require("../vnode/is-vtext")
var isWidget = require("../vnode/is-widget")
var isThunk = require("../vnode/is-thunk")
var handleThunk = require("../vnode/handle-thunk")

var diffProps = require("./diff-props")

module.exports = diff

// diff 最终会生成一个 patchs 用于 patch 方法来对真实的 dom 节点进行更改
function diff(a, b) {
    // a 始终记录最原始的旧的 vnodeTree
    var patch = { a: a }
    // 需要注意的是，index 这个索引是扁平化的 节点树 索引
    walk(a, b, patch, 0)
    return patch
}

function walk(a, b, patch, index) {
    // 如果是相同的 vnode 没必要进行 diff
    if (a === b) {
        return
    }

    // 预定义好 apply, 在最后如果我们得到的 apply 不为 undefined 就会插入到 patch 中
    var apply = patch[index]
    // 后续所有的 applyClear 为 true 的情况都是整个 vnode 的变化（不管是 widget, vnode, vtext）
    // 我们需要对原先的 vnode（a）进行便利，对其内部所有的 widget 进行 patch，因为要在清除真实 dom 的时候调用 destroy 方法
    var applyClear = false

    if (isThunk(a) || isThunk(b)) {
        thunks(a, b, patch, index)
    } else if (b == null) {

        // If a is a widget we will add a remove patch for it
        // Otherwise any child widgets/hooks must be destroyed.
        // This prevents adding two remove patches for a widget.
        // 如果 b 不存在的话
        // 如果不是我们自定义的一个组件，必须要给清除里面的 widget
        if (!isWidget(a)) {
            clearState(a, patch, index)
            apply = patch[index]
        }

        // 我们添加 apply
        apply = appendPatch(apply, new VPatch(VPatch.REMOVE, a, b))
    } else if (isVNode(b)) {
        // 如果新的 b 是一个 vnode，我们就需要判断 a 是什么，分别进行怎样的操作

        // 如果 a 和 b 都是 vnode
        if (isVNode(a)) {
            // 如果是同一种元素，key 也相同
            if (a.tagName === b.tagName &&
                a.namespace === b.namespace &&
                a.key === b.key) {

                // 这个元素可能 props 改变了，我们需要 diff 这个元素的 props
                var propsPatch = diffProps(a.properties, b.properties)
                if (propsPatch) {
                    // append
                    apply = appendPatch(apply,
                        new VPatch(VPatch.PROPS, a, propsPatch))
                }
                // 然后我们需要对当前这个 vnode 的子 vnode 进行 diff
                apply = diffChildren(a, b, patch, apply, index)
            } else {
                // 如果这个 a 和 b 不一样，代表要么替换我一个新的 vnode 或者重新排序了
                // 直接 append
                apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
                // 我们不需要继续下去了，因为整个 vnode 都要替换掉
                applyClear = true
            }
        } else {
            // 否则我们就 append
            apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
            // 同上
            applyClear = true
        }
    } else if (isVText(b)) {
        // 同上 vnode 一样，我们需要对 vtext 做同样的操作，只不过不需要 diff props 和 children
        if (!isVText(a)) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
            // 同上
            applyClear = true
        } else if (a.text !== b.text) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
        }
    } else if (isWidget(b)) {
        // 我们对于自定义的组件，直接 append
        if (!isWidget(a)) {
            applyClear = true
        }

        // 对于不同的 widget node 我们没法进行 diff，直接标记为 a b 不同
        // 我们会调用 widget 元素的内部方法进行处理
        // 所以我们在 Grass 里面才要缓存子组件，避免进行 diff, 重新生成新的 widget
        apply = appendPatch(apply, new VPatch(VPatch.WIDGET, a, b))
    }

    if (apply) {
        // 此时的 index 并不是一定是按照 1 2 3 这样排序的
        // 因为有可能中间的某些 vnode 没有改变，跳过了
        // 此时我们只记录有变化的 apply
        patch[index] = apply
    }

    if (applyClear) {
        // 清除对 widget 节点的引用
        clearState(a, patch, index)
    }
}

function diffChildren(a, b, patch, apply, index) {
    var aChildren = a.children
    // 我们需要把 b 的 children 排序到跟 a 的 children 一样
    // 因为 b 的 children 顺序有可能是与 a 的 children 不一样，但只是需要重新排序而已
    var orderedSet = reorder(aChildren, b.children)
    var bChildren = orderedSet.children

    var aLen = aChildren.length
    var bLen = bChildren.length
    // 因为新的差异节点树（bChildren）有可能删掉了某些元素，也可能新加了很多元素
    // 所以此处的 len 为元素多了那颗数，毕竟我们需要全面的对所有差异元素进行 diff
    var len = aLen > bLen ? aLen : bLen

    for (var i = 0; i < len; i++) {
        // 此处我们拿到左右俩节点
        var leftNode = aChildren[i]
        var rightNode = bChildren[i]
        index += 1

        // 如果左节点没有，而右边节点有，代表右边的节点是新增的，append apply
        // 如果右边节点没有，有可能是 null，因为我们再排序的时候进行了
        if (!leftNode) {
            if (rightNode) {
                // Excess nodes in b need to be added
                apply = appendPatch(apply,
                    new VPatch(VPatch.INSERT, null, rightNode))
            }
        } else {
            // 否则，我们需要对这个子节点进行从头到尾的 diff
            walk(leftNode, rightNode, patch, index)
        }

        // 此处是为了记录扁平化数组的 length，保证正确的 index（上面有说过）
        if (isVNode(leftNode) && leftNode.count) {
            index += leftNode.count
        }
    }

    // 如果两颗书排序后发现有移动的（moves）节点
    if (orderedSet.moves) {
        // Reorder nodes last
        // 我们放到最后面处理排序节点，现在 append apply
        apply = appendPatch(apply, new VPatch(
            VPatch.ORDER,
            a,
            orderedSet.moves
        ))
    }

    return apply
}

function clearState(vNode, patch, index) {
    // TODO: Make this a single walk, not two
    unhook(vNode, patch, index)
    destroyWidgets(vNode, patch, index)
}

// Patch records for all destroyed widgets must be added because we need
// a DOM node reference for the destroy function
function destroyWidgets(vNode, patch, index) {
    if (isWidget(vNode)) {
        if (typeof vNode.destroy === "function") {
            // 如果自定义的元素有 destroy 方法，我们就需进行标记为 remove
            // 并且生成 patch
            patch[index] = appendPatch(
                patch[index],
                new VPatch(VPatch.REMOVE, vNode, null)
            )
        }
    } else if (isVNode(vNode) && (vNode.hasWidgets || vNode.hasThunks)) {
        // 此处不过是对 vnode 的 children 进行递归，使得整课旧的 vnodeTree 都清空 widget 元素
        var children = vNode.children
        var len = children.length
        for (var i = 0; i < len; i++) {
            var child = children[i]
            index += 1

            destroyWidgets(child, patch, index)

            if (isVNode(child) && child.count) {
                // 此处是为了使得多维数组扁平化，以一维数组的形式进行展现
                // index 就是所有元素的和（一维数组的 length）
                // [1, [2, 3 , [4, 5, [6]]]] => [1, 2, 3, 4, 5, 6]
                // 并且我们在 patch 的时候也是以同样的方法进行展开，并一一对应真实 dom 与 vnode
                index += child.count
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

// Create a sub-patch for thunks
function thunks(a, b, patch, index) {
    var nodes = handleThunk(a, b)
    var thunkPatch = diff(nodes.a, nodes.b)
    if (hasPatches(thunkPatch)) {
        patch[index] = new VPatch(VPatch.THUNK, null, thunkPatch)
    }
}

function hasPatches(patch) {
    for (var index in patch) {
        if (index !== "a") {
            return true
        }
    }

    return false
}

// Execute hooks when two nodes are identical
function unhook(vNode, patch, index) {
    if (isVNode(vNode)) {
        if (vNode.hooks) {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(
                    VPatch.PROPS,
                    vNode,
                    undefinedKeys(vNode.hooks)
                )
            )
        }

        if (vNode.descendantHooks || vNode.hasThunks) {
            var children = vNode.children
            var len = children.length
            for (var i = 0; i < len; i++) {
                var child = children[i]
                index += 1

                unhook(child, patch, index)

                if (isVNode(child) && child.count) {
                    index += child.count
                }
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

function undefinedKeys(obj) {
    var result = {}

    for (var key in obj) {
        result[key] = undefined
    }

    return result
}

// List diff, naive left to right reordering
// 一定要记住此函数的目的只不过是为了把 bChildren 排序到跟 aChildren 一样
// 关键点在于 key，没有 key 的我们按顺序排，记住这个规则
function reorder(aChildren, bChildren) {
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
                    console.log(bKeys[simulateItem.key], simulateItem.key, i + 1);
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
    console.log(inserts, removes);

    // remove all the remaining nodes from simulate
    while(simulateIndex < simulate.length) {
        simulateItem = simulate[simulateIndex]
        removes.push(remove(simulate, simulateIndex, simulateItem && simulateItem.key))
    }

    // If the only moves we have are deletes then we can just
    // let the delete patch remove these items.
    if (removes.length === deletedItems && !inserts.length) {
        return {
            children: newChildren,
            moves: null
        }
    }


    return {
        children: newChildren,
        moves: {
            removes: removes,
            inserts: inserts
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

function appendPatch(apply, patch) {
    if (apply) {
        if (isArray(apply)) {
            apply.push(patch)
        } else {
            apply = [apply, patch]
        }

        return apply
    } else {
        return patch
    }
}
