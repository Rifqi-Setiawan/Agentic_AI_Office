/**
 * Binary MinHeap berkinerja tinggi berbasis flat typed array.
 * Dirancang untuk A* pathfinding dengan alokasi memori nol saat push dan pop.
 */
export class IndexMinHeap {
  private heap: Int32Array;
  private score: Float64Array;
  private _size = 0;

  constructor(initialCapacity = 2048) {
    this.heap = new Int32Array(initialCapacity);
    this.score = new Float64Array(initialCapacity);
  }

  public get size(): number {
    return this._size;
  }

  public isEmpty(): boolean {
    return this._size === 0;
  }

  public clear(): void {
    this._size = 0;
  }

  private ensureCapacity(needed: number): void {
    if (needed <= this.heap.length) return;
    let nextCap = this.heap.length * 2;
    while (nextCap < needed) {
      nextCap *= 2;
    }
    const nextHeap = new Int32Array(nextCap);
    const nextScore = new Float64Array(nextCap);
    nextHeap.set(this.heap);
    nextScore.set(this.score);
    this.heap = nextHeap;
    this.score = nextScore;
  }

  public push(index: number, fScore: number): void {
    this.ensureCapacity(this._size + 1);

    let i = this._size;
    this._size++;

    this.heap[i] = index;
    this.score[i] = fScore;

    // Sift up
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.score[i] < this.score[p]) {
        // Swap
        const tmpIdx = this.heap[i];
        this.heap[i] = this.heap[p];
        this.heap[p] = tmpIdx;

        const tmpScore = this.score[i];
        this.score[i] = this.score[p];
        this.score[p] = tmpScore;

        i = p;
      } else {
        break;
      }
    }
  }

  public pop(): number {
    if (this._size === 0) {
      return -1;
    }

    const root = this.heap[0];
    this._size--;

    if (this._size > 0) {
      this.heap[0] = this.heap[this._size];
      this.score[0] = this.score[this._size];

      // Sift down
      let i = 0;
      while (true) {
        let smallest = i;
        const left = (i << 1) + 1;
        const right = left + 1;

        if (left < this._size && this.score[left] < this.score[smallest]) {
          smallest = left;
        }
        if (right < this._size && this.score[right] < this.score[smallest]) {
          smallest = right;
        }

        if (smallest !== i) {
          const tmpIdx = this.heap[i];
          this.heap[i] = this.heap[smallest];
          this.heap[smallest] = tmpIdx;

          const tmpScore = this.score[i];
          this.score[i] = this.score[smallest];
          this.score[smallest] = tmpScore;

          i = smallest;
        } else {
          break;
        }
      }
    }

    return root;
  }

  public peekIndex(): number {
    return this._size > 0 ? this.heap[0] : -1;
  }

  public peekScore(): number {
    return this._size > 0 ? this.score[0] : Infinity;
  }
}
