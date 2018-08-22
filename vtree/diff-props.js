var isObject = require("is-object")
var isHook = require("../vnode/is-vhook")

module.exports = diffProps

function diffProps(a, b) {
    var diff

    // 我们先对 a 的 props 进行 diff
    for (var aKey in a) {
        // 如果在 b 中没有这个 aKey 了，代表被删除了，我们就置为 undefined
        if (!(aKey in b)) {
            diff = diff || {}
            diff[aKey] = undefined
        }

        var aValue = a[aKey]
        var bValue = b[aKey]

        // 我们进行对比，如果没有变化，就继续
        if (aValue === bValue) {
            continue
        } else if (isObject(aValue) && isObject(bValue)) {
            // 如果 aValue 和 bValue 是引用类型，我们就判断是否是同一个构造函数的实例
            if (getPrototype(bValue) !== getPrototype(aValue)) {
                // 如果不是，那么 bValue 就是新的是实例，需要添加到 diff
                diff = diff || {}
                diff[aKey] = bValue
            } else if (isHook(bValue)) {
                diff = diff || {}
                diff[aKey] = bValue
            } else {
                // 如果是同一个构造函数的实例，我们再 diff
                // 但这种情况还是不能预防循环引用的问题
                var objectDiff = diffProps(aValue, bValue)
                if (objectDiff) {
                    diff = diff || {}
                    diff[aKey] = objectDiff
                }
            }
        } else {
            // 如果一个是引用类型，一个是基础类型，那肯定就是有变化了
            diff = diff || {}
            diff[aKey] = bValue
        }
    }

    // 我们再循环 b
    for (var bKey in b) {
        // bKey 在 a 中没有，代表是新增的
        // 删除和相同 key 在上一个循环处理过了
        if (!(bKey in a)) {
            diff = diff || {}
            diff[bKey] = b[bKey]
        }
    }

    return diff
}

function getPrototype(value) {
  if (Object.getPrototypeOf) {
    return Object.getPrototypeOf(value)
  } else if (value.__proto__) {
    return value.__proto__
  } else if (value.constructor) {
    return value.constructor.prototype
  }
}
