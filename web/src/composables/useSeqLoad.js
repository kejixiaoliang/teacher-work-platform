import { ref } from 'vue';

/**
 * 竞态防护：快速切换（班级/学生/筛选）时，旧请求的响应不会覆盖新数据。
 * 用法：
 *   const { seq, isStale, run } = useSeqLoad();
 *   async function load() {
 *     const mySeq = seq();            // 取当前序号（每次调用自增）
 *     const data = await api.xxx();
 *     if (isStale(mySeq)) return;     // 已有更新的请求，丢弃本次结果
 *     list.value = data;
 *   }
 */
export function useSeqLoad() {
  let counter = 0;

  /** 递增并返回本次请求序号 */
  function seq() { return ++counter; }

  /** 判断某次请求是否已被更新的请求取代 */
  function isStale(s) { return s !== counter; }

  /** 包装异步函数：自动套序号，过期则丢弃结果（不执行 onOk） */
  function run(fn, onOk) {
    const s = seq();
    return fn().then(r => {
      if (isStale(s)) return undefined;
      onOk(r);
      return r;
    });
  }

  return { seq, isStale, run };
}
