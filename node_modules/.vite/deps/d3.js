//#region node_modules/d3-array/src/ascending.js
function ascending(a$3, b) {
	return a$3 == null || b == null ? NaN : a$3 < b ? -1 : a$3 > b ? 1 : a$3 >= b ? 0 : NaN;
}

//#endregion
//#region node_modules/d3-array/src/descending.js
function descending(a$3, b) {
	return a$3 == null || b == null ? NaN : b < a$3 ? -1 : b > a$3 ? 1 : b >= a$3 ? 0 : NaN;
}

//#endregion
//#region node_modules/d3-array/src/bisector.js
function bisector(f) {
	let compare1, compare2, delta;
	if (f.length !== 2) {
		compare1 = ascending;
		compare2 = (d, x$3) => ascending(f(d), x$3);
		delta = (d, x$3) => f(d) - x$3;
	} else {
		compare1 = f === ascending || f === descending ? f : zero$1;
		compare2 = f;
		delta = f;
	}
	function left$1(a$3, x$3, lo = 0, hi = a$3.length) {
		if (lo < hi) {
			if (compare1(x$3, x$3) !== 0) return hi;
			do {
				const mid = lo + hi >>> 1;
				if (compare2(a$3[mid], x$3) < 0) lo = mid + 1;
				else hi = mid;
			} while (lo < hi);
		}
		return lo;
	}
	function right$1(a$3, x$3, lo = 0, hi = a$3.length) {
		if (lo < hi) {
			if (compare1(x$3, x$3) !== 0) return hi;
			do {
				const mid = lo + hi >>> 1;
				if (compare2(a$3[mid], x$3) <= 0) lo = mid + 1;
				else hi = mid;
			} while (lo < hi);
		}
		return lo;
	}
	function center$1(a$3, x$3, lo = 0, hi = a$3.length) {
		const i = left$1(a$3, x$3, lo, hi - 1);
		return i > lo && delta(a$3[i - 1], x$3) > -delta(a$3[i], x$3) ? i - 1 : i;
	}
	return {
		left: left$1,
		center: center$1,
		right: right$1
	};
}
function zero$1() {
	return 0;
}

//#endregion
//#region node_modules/d3-array/src/number.js
function number$3(x$3) {
	return x$3 === null ? NaN : +x$3;
}
function* numbers(values, valueof) {
	if (valueof === void 0) {
		for (let value of values) if (value != null && (value = +value) >= value) yield value;
	} else {
		let index$2 = -1;
		for (let value of values) if ((value = valueof(value, ++index$2, values)) != null && (value = +value) >= value) yield value;
	}
}

//#endregion
//#region node_modules/d3-array/src/bisect.js
var ascendingBisect = bisector(ascending);
const bisectRight = ascendingBisect.right;
const bisectLeft = ascendingBisect.left;
const bisectCenter = bisector(number$3).center;
var bisect_default = bisectRight;

//#endregion
//#region node_modules/d3-array/src/blur.js
function blur(values, r) {
	if (!((r = +r) >= 0)) throw new RangeError("invalid r");
	let length$2 = values.length;
	if (!((length$2 = Math.floor(length$2)) >= 0)) throw new RangeError("invalid length");
	if (!length$2 || !r) return values;
	const blur$1 = blurf(r);
	const temp = values.slice();
	blur$1(values, temp, 0, length$2, 1);
	blur$1(temp, values, 0, length$2, 1);
	blur$1(values, temp, 0, length$2, 1);
	return values;
}
const blur2 = Blur2(blurf);
const blurImage = Blur2(blurfImage);
function Blur2(blur$1) {
	return function(data, rx, ry = rx) {
		if (!((rx = +rx) >= 0)) throw new RangeError("invalid rx");
		if (!((ry = +ry) >= 0)) throw new RangeError("invalid ry");
		let { data: values, width, height } = data;
		if (!((width = Math.floor(width)) >= 0)) throw new RangeError("invalid width");
		if (!((height = Math.floor(height !== void 0 ? height : values.length / width)) >= 0)) throw new RangeError("invalid height");
		if (!width || !height || !rx && !ry) return data;
		const blurx = rx && blur$1(rx);
		const blury = ry && blur$1(ry);
		const temp = values.slice();
		if (blurx && blury) {
			blurh(blurx, temp, values, width, height);
			blurh(blurx, values, temp, width, height);
			blurh(blurx, temp, values, width, height);
			blurv(blury, values, temp, width, height);
			blurv(blury, temp, values, width, height);
			blurv(blury, values, temp, width, height);
		} else if (blurx) {
			blurh(blurx, values, temp, width, height);
			blurh(blurx, temp, values, width, height);
			blurh(blurx, values, temp, width, height);
		} else if (blury) {
			blurv(blury, values, temp, width, height);
			blurv(blury, temp, values, width, height);
			blurv(blury, values, temp, width, height);
		}
		return data;
	};
}
function blurh(blur$1, T, S, w, h) {
	for (let y$3 = 0, n = w * h; y$3 < n;) blur$1(T, S, y$3, y$3 += w, 1);
}
function blurv(blur$1, T, S, w, h) {
	for (let x$3 = 0, n = w * h; x$3 < w; ++x$3) blur$1(T, S, x$3, x$3 + n, w);
}
function blurfImage(radius) {
	const blur$1 = blurf(radius);
	return (T, S, start$1, stop, step) => {
		start$1 <<= 2, stop <<= 2, step <<= 2;
		blur$1(T, S, start$1 + 0, stop + 0, step);
		blur$1(T, S, start$1 + 1, stop + 1, step);
		blur$1(T, S, start$1 + 2, stop + 2, step);
		blur$1(T, S, start$1 + 3, stop + 3, step);
	};
}
function blurf(radius) {
	const radius0 = Math.floor(radius);
	if (radius0 === radius) return bluri(radius);
	const t = radius - radius0;
	const w = 2 * radius + 1;
	return (T, S, start$1, stop, step) => {
		if (!((stop -= step) >= start$1)) return;
		let sum$3 = radius0 * S[start$1];
		const s0 = step * radius0;
		const s1 = s0 + step;
		for (let i = start$1, j = start$1 + s0; i < j; i += step) sum$3 += S[Math.min(stop, i)];
		for (let i = start$1, j = stop; i <= j; i += step) {
			sum$3 += S[Math.min(stop, i + s0)];
			T[i] = (sum$3 + t * (S[Math.max(start$1, i - s1)] + S[Math.min(stop, i + s1)])) / w;
			sum$3 -= S[Math.max(start$1, i - s0)];
		}
	};
}
function bluri(radius) {
	const w = 2 * radius + 1;
	return (T, S, start$1, stop, step) => {
		if (!((stop -= step) >= start$1)) return;
		let sum$3 = radius * S[start$1];
		const s$1 = step * radius;
		for (let i = start$1, j = start$1 + s$1; i < j; i += step) sum$3 += S[Math.min(stop, i)];
		for (let i = start$1, j = stop; i <= j; i += step) {
			sum$3 += S[Math.min(stop, i + s$1)];
			T[i] = sum$3 / w;
			sum$3 -= S[Math.max(start$1, i - s$1)];
		}
	};
}

//#endregion
//#region node_modules/d3-array/src/count.js
function count(values, valueof) {
	let count$2 = 0;
	if (valueof === void 0) {
		for (let value of values) if (value != null && (value = +value) >= value) ++count$2;
	} else {
		let index$2 = -1;
		for (let value of values) if ((value = valueof(value, ++index$2, values)) != null && (value = +value) >= value) ++count$2;
	}
	return count$2;
}

//#endregion
//#region node_modules/d3-array/src/cross.js
function length$1(array$3) {
	return array$3.length | 0;
}
function empty$2(length$2) {
	return !(length$2 > 0);
}
function arrayify(values) {
	return typeof values !== "object" || "length" in values ? values : Array.from(values);
}
function reducer(reduce$1) {
	return (values) => reduce$1(...values);
}
function cross(...values) {
	const reduce$1 = typeof values[values.length - 1] === "function" && reducer(values.pop());
	values = values.map(arrayify);
	const lengths = values.map(length$1);
	const j = values.length - 1;
	const index$2 = new Array(j + 1).fill(0);
	const product = [];
	if (j < 0 || lengths.some(empty$2)) return product;
	while (true) {
		product.push(index$2.map((j$1, i$1) => values[i$1][j$1]));
		let i = j;
		while (++index$2[i] === lengths[i]) {
			if (i === 0) return reduce$1 ? product.map(reduce$1) : product;
			index$2[i--] = 0;
		}
	}
}

//#endregion
//#region node_modules/d3-array/src/cumsum.js
function cumsum(values, valueof) {
	var sum$3 = 0, index$2 = 0;
	return Float64Array.from(values, valueof === void 0 ? (v$1) => sum$3 += +v$1 || 0 : (v$1) => sum$3 += +valueof(v$1, index$2++, values) || 0);
}

//#endregion
//#region node_modules/d3-array/src/variance.js
function variance(values, valueof) {
	let count$2 = 0;
	let delta;
	let mean$1 = 0;
	let sum$3 = 0;
	if (valueof === void 0) {
		for (let value of values) if (value != null && (value = +value) >= value) {
			delta = value - mean$1;
			mean$1 += delta / ++count$2;
			sum$3 += delta * (value - mean$1);
		}
	} else {
		let index$2 = -1;
		for (let value of values) if ((value = valueof(value, ++index$2, values)) != null && (value = +value) >= value) {
			delta = value - mean$1;
			mean$1 += delta / ++count$2;
			sum$3 += delta * (value - mean$1);
		}
	}
	if (count$2 > 1) return sum$3 / (count$2 - 1);
}

//#endregion
//#region node_modules/d3-array/src/deviation.js
function deviation(values, valueof) {
	const v$1 = variance(values, valueof);
	return v$1 ? Math.sqrt(v$1) : v$1;
}

//#endregion
//#region node_modules/d3-array/src/extent.js
function extent(values, valueof) {
	let min$3;
	let max$4;
	if (valueof === void 0) {
		for (const value of values) if (value != null) if (min$3 === void 0) {
			if (value >= value) min$3 = max$4 = value;
		} else {
			if (min$3 > value) min$3 = value;
			if (max$4 < value) max$4 = value;
		}
	} else {
		let index$2 = -1;
		for (let value of values) if ((value = valueof(value, ++index$2, values)) != null) if (min$3 === void 0) {
			if (value >= value) min$3 = max$4 = value;
		} else {
			if (min$3 > value) min$3 = value;
			if (max$4 < value) max$4 = value;
		}
	}
	return [min$3, max$4];
}

//#endregion
//#region node_modules/d3-array/src/fsum.js
var Adder = class {
	constructor() {
		this._partials = new Float64Array(32);
		this._n = 0;
	}
	add(x$3) {
		const p = this._partials;
		let i = 0;
		for (let j = 0; j < this._n && j < 32; j++) {
			const y$3 = p[j], hi = x$3 + y$3, lo = Math.abs(x$3) < Math.abs(y$3) ? x$3 - (hi - y$3) : y$3 - (hi - x$3);
			if (lo) p[i++] = lo;
			x$3 = hi;
		}
		p[i] = x$3;
		this._n = i + 1;
		return this;
	}
	valueOf() {
		const p = this._partials;
		let n = this._n, x$3, y$3, lo, hi = 0;
		if (n > 0) {
			hi = p[--n];
			while (n > 0) {
				x$3 = hi;
				y$3 = p[--n];
				hi = x$3 + y$3;
				lo = y$3 - (hi - x$3);
				if (lo) break;
			}
			if (n > 0 && (lo < 0 && p[n - 1] < 0 || lo > 0 && p[n - 1] > 0)) {
				y$3 = lo * 2;
				x$3 = hi + y$3;
				if (y$3 == x$3 - hi) hi = x$3;
			}
		}
		return hi;
	}
};
function fsum(values, valueof) {
	const adder = new Adder();
	if (valueof === void 0) {
		for (let value of values) if (value = +value) adder.add(value);
	} else {
		let index$2 = -1;
		for (let value of values) if (value = +valueof(value, ++index$2, values)) adder.add(value);
	}
	return +adder;
}
function fcumsum(values, valueof) {
	const adder = new Adder();
	let index$2 = -1;
	return Float64Array.from(values, valueof === void 0 ? (v$1) => adder.add(+v$1 || 0) : (v$1) => adder.add(+valueof(v$1, ++index$2, values) || 0));
}

//#endregion
//#region node_modules/internmap/src/index.js
var InternMap = class extends Map {
	constructor(entries, key = keyof) {
		super();
		Object.defineProperties(this, {
			_intern: { value: /* @__PURE__ */ new Map() },
			_key: { value: key }
		});
		if (entries != null) for (const [key$1, value] of entries) this.set(key$1, value);
	}
	get(key) {
		return super.get(intern_get(this, key));
	}
	has(key) {
		return super.has(intern_get(this, key));
	}
	set(key, value) {
		return super.set(intern_set(this, key), value);
	}
	delete(key) {
		return super.delete(intern_delete(this, key));
	}
};
var InternSet = class extends Set {
	constructor(values, key = keyof) {
		super();
		Object.defineProperties(this, {
			_intern: { value: /* @__PURE__ */ new Map() },
			_key: { value: key }
		});
		if (values != null) for (const value of values) this.add(value);
	}
	has(value) {
		return super.has(intern_get(this, value));
	}
	add(value) {
		return super.add(intern_set(this, value));
	}
	delete(value) {
		return super.delete(intern_delete(this, value));
	}
};
function intern_get({ _intern, _key }, value) {
	const key = _key(value);
	return _intern.has(key) ? _intern.get(key) : value;
}
function intern_set({ _intern, _key }, value) {
	const key = _key(value);
	if (_intern.has(key)) return _intern.get(key);
	_intern.set(key, value);
	return value;
}
function intern_delete({ _intern, _key }, value) {
	const key = _key(value);
	if (_intern.has(key)) {
		value = _intern.get(key);
		_intern.delete(key);
	}
	return value;
}
function keyof(value) {
	return value !== null && typeof value === "object" ? value.valueOf() : value;
}

//#endregion
//#region node_modules/d3-array/src/identity.js
function identity$4(x$3) {
	return x$3;
}

//#endregion
//#region node_modules/d3-array/src/group.js
function group(values, ...keys) {
	return nest(values, identity$4, identity$4, keys);
}
function groups(values, ...keys) {
	return nest(values, Array.from, identity$4, keys);
}
function flatten$1(groups$1, keys) {
	for (let i = 1, n = keys.length; i < n; ++i) groups$1 = groups$1.flatMap((g) => g.pop().map(([key, value]) => [
		...g,
		key,
		value
	]));
	return groups$1;
}
function flatGroup(values, ...keys) {
	return flatten$1(groups(values, ...keys), keys);
}
function flatRollup(values, reduce$1, ...keys) {
	return flatten$1(rollups(values, reduce$1, ...keys), keys);
}
function rollup(values, reduce$1, ...keys) {
	return nest(values, identity$4, reduce$1, keys);
}
function rollups(values, reduce$1, ...keys) {
	return nest(values, Array.from, reduce$1, keys);
}
function index(values, ...keys) {
	return nest(values, identity$4, unique, keys);
}
function indexes(values, ...keys) {
	return nest(values, Array.from, unique, keys);
}
function unique(values) {
	if (values.length !== 1) throw new Error("duplicate key");
	return values[0];
}
function nest(values, map$3, reduce$1, keys) {
	return (function regroup(values$1, i) {
		if (i >= keys.length) return reduce$1(values$1);
		const groups$1 = new InternMap();
		const keyof$1 = keys[i++];
		let index$2 = -1;
		for (const value of values$1) {
			const key = keyof$1(value, ++index$2, values$1);
			const group$1 = groups$1.get(key);
			if (group$1) group$1.push(value);
			else groups$1.set(key, [value]);
		}
		for (const [key, values$2] of groups$1) groups$1.set(key, regroup(values$2, i));
		return map$3(groups$1);
	})(values, 0);
}

//#endregion
//#region node_modules/d3-array/src/permute.js
function permute(source, keys) {
	return Array.from(keys, (key) => source[key]);
}

//#endregion
//#region node_modules/d3-array/src/sort.js
function sort(values, ...F) {
	if (typeof values[Symbol.iterator] !== "function") throw new TypeError("values is not iterable");
	values = Array.from(values);
	let [f] = F;
	if (f && f.length !== 2 || F.length > 1) {
		const index$2 = Uint32Array.from(values, (d, i) => i);
		if (F.length > 1) {
			F = F.map((f$1) => values.map(f$1));
			index$2.sort((i, j) => {
				for (const f$1 of F) {
					const c$5 = ascendingDefined(f$1[i], f$1[j]);
					if (c$5) return c$5;
				}
			});
		} else {
			f = values.map(f);
			index$2.sort((i, j) => ascendingDefined(f[i], f[j]));
		}
		return permute(values, index$2);
	}
	return values.sort(compareDefined(f));
}
function compareDefined(compare = ascending) {
	if (compare === ascending) return ascendingDefined;
	if (typeof compare !== "function") throw new TypeError("compare is not a function");
	return (a$3, b) => {
		const x$3 = compare(a$3, b);
		if (x$3 || x$3 === 0) return x$3;
		return (compare(b, b) === 0) - (compare(a$3, a$3) === 0);
	};
}
function ascendingDefined(a$3, b) {
	return (a$3 == null || !(a$3 >= a$3)) - (b == null || !(b >= b)) || (a$3 < b ? -1 : a$3 > b ? 1 : 0);
}

//#endregion
//#region node_modules/d3-array/src/groupSort.js
function groupSort(values, reduce$1, key) {
	return (reduce$1.length !== 2 ? sort(rollup(values, reduce$1, key), (([ak, av], [bk, bv]) => ascending(av, bv) || ascending(ak, bk))) : sort(group(values, key), (([ak, av], [bk, bv]) => reduce$1(av, bv) || ascending(ak, bk)))).map(([key$1]) => key$1);
}

//#endregion
//#region node_modules/d3-array/src/array.js
var array$2 = Array.prototype;
var slice$3 = array$2.slice;
var map$2 = array$2.map;

//#endregion
//#region node_modules/d3-array/src/constant.js
function constant(x$3) {
	return () => x$3;
}

//#endregion
//#region node_modules/d3-array/src/ticks.js
var e10 = Math.sqrt(50), e5 = Math.sqrt(10), e2 = Math.sqrt(2);
function tickSpec(start$1, stop, count$2) {
	const step = (stop - start$1) / Math.max(0, count$2), power = Math.floor(Math.log10(step)), error = step / Math.pow(10, power), factor = error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1;
	let i1, i2, inc$1;
	if (power < 0) {
		inc$1 = Math.pow(10, -power) / factor;
		i1 = Math.round(start$1 * inc$1);
		i2 = Math.round(stop * inc$1);
		if (i1 / inc$1 < start$1) ++i1;
		if (i2 / inc$1 > stop) --i2;
		inc$1 = -inc$1;
	} else {
		inc$1 = Math.pow(10, power) * factor;
		i1 = Math.round(start$1 / inc$1);
		i2 = Math.round(stop / inc$1);
		if (i1 * inc$1 < start$1) ++i1;
		if (i2 * inc$1 > stop) --i2;
	}
	if (i2 < i1 && .5 <= count$2 && count$2 < 2) return tickSpec(start$1, stop, count$2 * 2);
	return [
		i1,
		i2,
		inc$1
	];
}
function ticks(start$1, stop, count$2) {
	stop = +stop, start$1 = +start$1, count$2 = +count$2;
	if (!(count$2 > 0)) return [];
	if (start$1 === stop) return [start$1];
	const reverse$1 = stop < start$1, [i1, i2, inc$1] = reverse$1 ? tickSpec(stop, start$1, count$2) : tickSpec(start$1, stop, count$2);
	if (!(i2 >= i1)) return [];
	const n = i2 - i1 + 1, ticks$1 = new Array(n);
	if (reverse$1) if (inc$1 < 0) for (let i = 0; i < n; ++i) ticks$1[i] = (i2 - i) / -inc$1;
	else for (let i = 0; i < n; ++i) ticks$1[i] = (i2 - i) * inc$1;
	else if (inc$1 < 0) for (let i = 0; i < n; ++i) ticks$1[i] = (i1 + i) / -inc$1;
	else for (let i = 0; i < n; ++i) ticks$1[i] = (i1 + i) * inc$1;
	return ticks$1;
}
function tickIncrement(start$1, stop, count$2) {
	stop = +stop, start$1 = +start$1, count$2 = +count$2;
	return tickSpec(start$1, stop, count$2)[2];
}
function tickStep(start$1, stop, count$2) {
	stop = +stop, start$1 = +start$1, count$2 = +count$2;
	const reverse$1 = stop < start$1, inc$1 = reverse$1 ? tickIncrement(stop, start$1, count$2) : tickIncrement(start$1, stop, count$2);
	return (reverse$1 ? -1 : 1) * (inc$1 < 0 ? 1 / -inc$1 : inc$1);
}

//#endregion
//#region node_modules/d3-array/src/nice.js
function nice(start$1, stop, count$2) {
	let prestep;
	while (true) {
		const step = tickIncrement(start$1, stop, count$2);
		if (step === prestep || step === 0 || !isFinite(step)) return [start$1, stop];
		else if (step > 0) {
			start$1 = Math.floor(start$1 / step) * step;
			stop = Math.ceil(stop / step) * step;
		} else if (step < 0) {
			start$1 = Math.ceil(start$1 * step) / step;
			stop = Math.floor(stop * step) / step;
		}
		prestep = step;
	}
}

//#endregion
//#region node_modules/d3-array/src/threshold/sturges.js
function thresholdSturges(values) {
	return Math.max(1, Math.ceil(Math.log(count(values)) / Math.LN2) + 1);
}

//#endregion
//#region node_modules/d3-array/src/bin.js
function bin() {
	var value = identity$4, domain = extent, threshold$1 = thresholdSturges;
	function histogram(data) {
		if (!Array.isArray(data)) data = Array.from(data);
		var i, n = data.length, x$3, step, values = new Array(n);
		for (i = 0; i < n; ++i) values[i] = value(data[i], i, data);
		var xz = domain(values), x0$5 = xz[0], x1$1 = xz[1], tz = threshold$1(values, x0$5, x1$1);
		if (!Array.isArray(tz)) {
			const max$4 = x1$1, tn = +tz;
			if (domain === extent) [x0$5, x1$1] = nice(x0$5, x1$1, tn);
			tz = ticks(x0$5, x1$1, tn);
			if (tz[0] <= x0$5) step = tickIncrement(x0$5, x1$1, tn);
			if (tz[tz.length - 1] >= x1$1) if (max$4 >= x1$1 && domain === extent) {
				const step$1 = tickIncrement(x0$5, x1$1, tn);
				if (isFinite(step$1)) {
					if (step$1 > 0) x1$1 = (Math.floor(x1$1 / step$1) + 1) * step$1;
					else if (step$1 < 0) x1$1 = (Math.ceil(x1$1 * -step$1) + 1) / -step$1;
				}
			} else tz.pop();
		}
		var m$2 = tz.length, a$3 = 0, b = m$2;
		while (tz[a$3] <= x0$5) ++a$3;
		while (tz[b - 1] > x1$1) --b;
		if (a$3 || b < m$2) tz = tz.slice(a$3, b), m$2 = b - a$3;
		var bins = new Array(m$2 + 1), bin$1;
		for (i = 0; i <= m$2; ++i) {
			bin$1 = bins[i] = [];
			bin$1.x0 = i > 0 ? tz[i - 1] : x0$5;
			bin$1.x1 = i < m$2 ? tz[i] : x1$1;
		}
		if (isFinite(step)) {
			if (step > 0) {
				for (i = 0; i < n; ++i) if ((x$3 = values[i]) != null && x0$5 <= x$3 && x$3 <= x1$1) bins[Math.min(m$2, Math.floor((x$3 - x0$5) / step))].push(data[i]);
			} else if (step < 0) {
				for (i = 0; i < n; ++i) if ((x$3 = values[i]) != null && x0$5 <= x$3 && x$3 <= x1$1) {
					const j = Math.floor((x0$5 - x$3) * step);
					bins[Math.min(m$2, j + (tz[j] <= x$3))].push(data[i]);
				}
			}
		} else for (i = 0; i < n; ++i) if ((x$3 = values[i]) != null && x0$5 <= x$3 && x$3 <= x1$1) bins[bisect_default(tz, x$3, 0, m$2)].push(data[i]);
		return bins;
	}
	histogram.value = function(_) {
		return arguments.length ? (value = typeof _ === "function" ? _ : constant(_), histogram) : value;
	};
	histogram.domain = function(_) {
		return arguments.length ? (domain = typeof _ === "function" ? _ : constant([_[0], _[1]]), histogram) : domain;
	};
	histogram.thresholds = function(_) {
		return arguments.length ? (threshold$1 = typeof _ === "function" ? _ : constant(Array.isArray(_) ? slice$3.call(_) : _), histogram) : threshold$1;
	};
	return histogram;
}

//#endregion
//#region node_modules/d3-array/src/max.js
function max(values, valueof) {
	let max$4;
	if (valueof === void 0) {
		for (const value of values) if (value != null && (max$4 < value || max$4 === void 0 && value >= value)) max$4 = value;
	} else {
		let index$2 = -1;
		for (let value of values) if ((value = valueof(value, ++index$2, values)) != null && (max$4 < value || max$4 === void 0 && value >= value)) max$4 = value;
	}
	return max$4;
}

//#endregion
//#region node_modules/d3-array/src/maxIndex.js
function maxIndex(values, valueof) {
	let max$4;
	let maxIndex$1 = -1;
	let index$2 = -1;
	if (valueof === void 0) for (const value of values) {
		++index$2;
		if (value != null && (max$4 < value || max$4 === void 0 && value >= value)) max$4 = value, maxIndex$1 = index$2;
	}
	else for (let value of values) if ((value = valueof(value, ++index$2, values)) != null && (max$4 < value || max$4 === void 0 && value >= value)) max$4 = value, maxIndex$1 = index$2;
	return maxIndex$1;
}

//#endregion
//#region node_modules/d3-array/src/min.js
function min(values, valueof) {
	let min$3;
	if (valueof === void 0) {
		for (const value of values) if (value != null && (min$3 > value || min$3 === void 0 && value >= value)) min$3 = value;
	} else {
		let index$2 = -1;
		for (let value of values) if ((value = valueof(value, ++index$2, values)) != null && (min$3 > value || min$3 === void 0 && value >= value)) min$3 = value;
	}
	return min$3;
}

//#endregion
//#region node_modules/d3-array/src/minIndex.js
function minIndex(values, valueof) {
	let min$3;
	let minIndex$1 = -1;
	let index$2 = -1;
	if (valueof === void 0) for (const value of values) {
		++index$2;
		if (value != null && (min$3 > value || min$3 === void 0 && value >= value)) min$3 = value, minIndex$1 = index$2;
	}
	else for (let value of values) if ((value = valueof(value, ++index$2, values)) != null && (min$3 > value || min$3 === void 0 && value >= value)) min$3 = value, minIndex$1 = index$2;
	return minIndex$1;
}

//#endregion
//#region node_modules/d3-array/src/quickselect.js
function quickselect(array$3, k$1, left$1 = 0, right$1 = Infinity, compare) {
	k$1 = Math.floor(k$1);
	left$1 = Math.floor(Math.max(0, left$1));
	right$1 = Math.floor(Math.min(array$3.length - 1, right$1));
	if (!(left$1 <= k$1 && k$1 <= right$1)) return array$3;
	compare = compare === void 0 ? ascendingDefined : compareDefined(compare);
	while (right$1 > left$1) {
		if (right$1 - left$1 > 600) {
			const n = right$1 - left$1 + 1;
			const m$2 = k$1 - left$1 + 1;
			const z = Math.log(n);
			const s$1 = .5 * Math.exp(2 * z / 3);
			const sd = .5 * Math.sqrt(z * s$1 * (n - s$1) / n) * (m$2 - n / 2 < 0 ? -1 : 1);
			const newLeft = Math.max(left$1, Math.floor(k$1 - m$2 * s$1 / n + sd));
			const newRight = Math.min(right$1, Math.floor(k$1 + (n - m$2) * s$1 / n + sd));
			quickselect(array$3, k$1, newLeft, newRight, compare);
		}
		const t = array$3[k$1];
		let i = left$1;
		let j = right$1;
		swap$1(array$3, left$1, k$1);
		if (compare(array$3[right$1], t) > 0) swap$1(array$3, left$1, right$1);
		while (i < j) {
			swap$1(array$3, i, j), ++i, --j;
			while (compare(array$3[i], t) < 0) ++i;
			while (compare(array$3[j], t) > 0) --j;
		}
		if (compare(array$3[left$1], t) === 0) swap$1(array$3, left$1, j);
		else ++j, swap$1(array$3, j, right$1);
		if (j <= k$1) left$1 = j + 1;
		if (k$1 <= j) right$1 = j - 1;
	}
	return array$3;
}
function swap$1(array$3, i, j) {
	const t = array$3[i];
	array$3[i] = array$3[j];
	array$3[j] = t;
}

//#endregion
//#region node_modules/d3-array/src/greatest.js
function greatest(values, compare = ascending) {
	let max$4;
	let defined = false;
	if (compare.length === 1) {
		let maxValue;
		for (const element of values) {
			const value = compare(element);
			if (defined ? ascending(value, maxValue) > 0 : ascending(value, value) === 0) {
				max$4 = element;
				maxValue = value;
				defined = true;
			}
		}
	} else for (const value of values) if (defined ? compare(value, max$4) > 0 : compare(value, value) === 0) {
		max$4 = value;
		defined = true;
	}
	return max$4;
}

//#endregion
//#region node_modules/d3-array/src/quantile.js
function quantile(values, p, valueof) {
	values = Float64Array.from(numbers(values, valueof));
	if (!(n = values.length) || isNaN(p = +p)) return;
	if (p <= 0 || n < 2) return min(values);
	if (p >= 1) return max(values);
	var n, i = (n - 1) * p, i0 = Math.floor(i), value0 = max(quickselect(values, i0).subarray(0, i0 + 1)), value1 = min(values.subarray(i0 + 1));
	return value0 + (value1 - value0) * (i - i0);
}
function quantileSorted(values, p, valueof = number$3) {
	if (!(n = values.length) || isNaN(p = +p)) return;
	if (p <= 0 || n < 2) return +valueof(values[0], 0, values);
	if (p >= 1) return +valueof(values[n - 1], n - 1, values);
	var n, i = (n - 1) * p, i0 = Math.floor(i), value0 = +valueof(values[i0], i0, values), value1 = +valueof(values[i0 + 1], i0 + 1, values);
	return value0 + (value1 - value0) * (i - i0);
}
function quantileIndex(values, p, valueof = number$3) {
	if (isNaN(p = +p)) return;
	numbers$1 = Float64Array.from(values, (_, i$1) => number$3(valueof(values[i$1], i$1, values)));
	if (p <= 0) return minIndex(numbers$1);
	if (p >= 1) return maxIndex(numbers$1);
	var numbers$1, index$2 = Uint32Array.from(values, (_, i$1) => i$1), j = numbers$1.length - 1, i = Math.floor(j * p);
	quickselect(index$2, i, 0, j, (i$1, j$1) => ascendingDefined(numbers$1[i$1], numbers$1[j$1]));
	i = greatest(index$2.subarray(0, i + 1), (i$1) => numbers$1[i$1]);
	return i >= 0 ? i : -1;
}

//#endregion
//#region node_modules/d3-array/src/threshold/freedmanDiaconis.js
function thresholdFreedmanDiaconis(values, min$3, max$4) {
	const c$5 = count(values), d = quantile(values, .75) - quantile(values, .25);
	return c$5 && d ? Math.ceil((max$4 - min$3) / (2 * d * Math.pow(c$5, -1 / 3))) : 1;
}

//#endregion
//#region node_modules/d3-array/src/threshold/scott.js
function thresholdScott(values, min$3, max$4) {
	const c$5 = count(values), d = deviation(values);
	return c$5 && d ? Math.ceil((max$4 - min$3) * Math.cbrt(c$5) / (3.49 * d)) : 1;
}

//#endregion
//#region node_modules/d3-array/src/mean.js
function mean(values, valueof) {
	let count$2 = 0;
	let sum$3 = 0;
	if (valueof === void 0) {
		for (let value of values) if (value != null && (value = +value) >= value) ++count$2, sum$3 += value;
	} else {
		let index$2 = -1;
		for (let value of values) if ((value = valueof(value, ++index$2, values)) != null && (value = +value) >= value) ++count$2, sum$3 += value;
	}
	if (count$2) return sum$3 / count$2;
}

//#endregion
//#region node_modules/d3-array/src/median.js
function median(values, valueof) {
	return quantile(values, .5, valueof);
}
function medianIndex(values, valueof) {
	return quantileIndex(values, .5, valueof);
}

//#endregion
//#region node_modules/d3-array/src/merge.js
function* flatten(arrays) {
	for (const array$3 of arrays) yield* array$3;
}
function merge(arrays) {
	return Array.from(flatten(arrays));
}

//#endregion
//#region node_modules/d3-array/src/mode.js
function mode(values, valueof) {
	const counts = new InternMap();
	if (valueof === void 0) {
		for (let value of values) if (value != null && value >= value) counts.set(value, (counts.get(value) || 0) + 1);
	} else {
		let index$2 = -1;
		for (let value of values) if ((value = valueof(value, ++index$2, values)) != null && value >= value) counts.set(value, (counts.get(value) || 0) + 1);
	}
	let modeValue;
	let modeCount = 0;
	for (const [value, count$2] of counts) if (count$2 > modeCount) {
		modeCount = count$2;
		modeValue = value;
	}
	return modeValue;
}

//#endregion
//#region node_modules/d3-array/src/pairs.js
function pairs(values, pairof = pair) {
	const pairs$1 = [];
	let previous;
	let first = false;
	for (const value of values) {
		if (first) pairs$1.push(pairof(previous, value));
		previous = value;
		first = true;
	}
	return pairs$1;
}
function pair(a$3, b) {
	return [a$3, b];
}

//#endregion
//#region node_modules/d3-array/src/range.js
function range(start$1, stop, step) {
	start$1 = +start$1, stop = +stop, step = (n = arguments.length) < 2 ? (stop = start$1, start$1 = 0, 1) : n < 3 ? 1 : +step;
	var i = -1, n = Math.max(0, Math.ceil((stop - start$1) / step)) | 0, range$3 = new Array(n);
	while (++i < n) range$3[i] = start$1 + i * step;
	return range$3;
}

//#endregion
//#region node_modules/d3-array/src/rank.js
function rank(values, valueof = ascending) {
	if (typeof values[Symbol.iterator] !== "function") throw new TypeError("values is not iterable");
	let V = Array.from(values);
	const R = new Float64Array(V.length);
	if (valueof.length !== 2) V = V.map(valueof), valueof = ascending;
	const compareIndex = (i, j) => valueof(V[i], V[j]);
	let k$1, r;
	values = Uint32Array.from(V, (_, i) => i);
	values.sort(valueof === ascending ? (i, j) => ascendingDefined(V[i], V[j]) : compareDefined(compareIndex));
	values.forEach((j, i) => {
		const c$5 = compareIndex(j, k$1 === void 0 ? j : k$1);
		if (c$5 >= 0) {
			if (k$1 === void 0 || c$5 > 0) k$1 = j, r = i;
			R[j] = r;
		} else R[j] = NaN;
	});
	return R;
}

//#endregion
//#region node_modules/d3-array/src/least.js
function least(values, compare = ascending) {
	let min$3;
	let defined = false;
	if (compare.length === 1) {
		let minValue;
		for (const element of values) {
			const value = compare(element);
			if (defined ? ascending(value, minValue) < 0 : ascending(value, value) === 0) {
				min$3 = element;
				minValue = value;
				defined = true;
			}
		}
	} else for (const value of values) if (defined ? compare(value, min$3) < 0 : compare(value, value) === 0) {
		min$3 = value;
		defined = true;
	}
	return min$3;
}

//#endregion
//#region node_modules/d3-array/src/leastIndex.js
function leastIndex(values, compare = ascending) {
	if (compare.length === 1) return minIndex(values, compare);
	let minValue;
	let min$3 = -1;
	let index$2 = -1;
	for (const value of values) {
		++index$2;
		if (min$3 < 0 ? compare(value, value) === 0 : compare(value, minValue) < 0) {
			minValue = value;
			min$3 = index$2;
		}
	}
	return min$3;
}

//#endregion
//#region node_modules/d3-array/src/greatestIndex.js
function greatestIndex(values, compare = ascending) {
	if (compare.length === 1) return maxIndex(values, compare);
	let maxValue;
	let max$4 = -1;
	let index$2 = -1;
	for (const value of values) {
		++index$2;
		if (max$4 < 0 ? compare(value, value) === 0 : compare(value, maxValue) > 0) {
			maxValue = value;
			max$4 = index$2;
		}
	}
	return max$4;
}

//#endregion
//#region node_modules/d3-array/src/scan.js
function scan(values, compare) {
	const index$2 = leastIndex(values, compare);
	return index$2 < 0 ? void 0 : index$2;
}

//#endregion
//#region node_modules/d3-array/src/shuffle.js
var shuffle_default = shuffler(Math.random);
function shuffler(random) {
	return function shuffle$1(array$3, i0 = 0, i1 = array$3.length) {
		let m$2 = i1 - (i0 = +i0);
		while (m$2) {
			const i = random() * m$2-- | 0, t = array$3[m$2 + i0];
			array$3[m$2 + i0] = array$3[i + i0];
			array$3[i + i0] = t;
		}
		return array$3;
	};
}

//#endregion
//#region node_modules/d3-array/src/sum.js
function sum(values, valueof) {
	let sum$3 = 0;
	if (valueof === void 0) {
		for (let value of values) if (value = +value) sum$3 += value;
	} else {
		let index$2 = -1;
		for (let value of values) if (value = +valueof(value, ++index$2, values)) sum$3 += value;
	}
	return sum$3;
}

//#endregion
//#region node_modules/d3-array/src/transpose.js
function transpose(matrix) {
	if (!(n = matrix.length)) return [];
	for (var i = -1, m$2 = min(matrix, length), transpose$1 = new Array(m$2); ++i < m$2;) for (var j = -1, n, row = transpose$1[i] = new Array(n); ++j < n;) row[j] = matrix[j][i];
	return transpose$1;
}
function length(d) {
	return d.length;
}

//#endregion
//#region node_modules/d3-array/src/zip.js
function zip() {
	return transpose(arguments);
}

//#endregion
//#region node_modules/d3-array/src/every.js
function every(values, test) {
	if (typeof test !== "function") throw new TypeError("test is not a function");
	let index$2 = -1;
	for (const value of values) if (!test(value, ++index$2, values)) return false;
	return true;
}

//#endregion
//#region node_modules/d3-array/src/some.js
function some(values, test) {
	if (typeof test !== "function") throw new TypeError("test is not a function");
	let index$2 = -1;
	for (const value of values) if (test(value, ++index$2, values)) return true;
	return false;
}

//#endregion
//#region node_modules/d3-array/src/filter.js
function filter(values, test) {
	if (typeof test !== "function") throw new TypeError("test is not a function");
	const array$3 = [];
	let index$2 = -1;
	for (const value of values) if (test(value, ++index$2, values)) array$3.push(value);
	return array$3;
}

//#endregion
//#region node_modules/d3-array/src/map.js
function map(values, mapper) {
	if (typeof values[Symbol.iterator] !== "function") throw new TypeError("values is not iterable");
	if (typeof mapper !== "function") throw new TypeError("mapper is not a function");
	return Array.from(values, (value, index$2) => mapper(value, index$2, values));
}

//#endregion
//#region node_modules/d3-array/src/reduce.js
function reduce(values, reducer$1, value) {
	if (typeof reducer$1 !== "function") throw new TypeError("reducer is not a function");
	const iterator = values[Symbol.iterator]();
	let done, next, index$2 = -1;
	if (arguments.length < 3) {
		({done, value} = iterator.next());
		if (done) return;
		++index$2;
	}
	while ({done, value: next} = iterator.next(), !done) value = reducer$1(value, next, ++index$2, values);
	return value;
}

//#endregion
//#region node_modules/d3-array/src/reverse.js
function reverse(values) {
	if (typeof values[Symbol.iterator] !== "function") throw new TypeError("values is not iterable");
	return Array.from(values).reverse();
}

//#endregion
//#region node_modules/d3-array/src/difference.js
function difference(values, ...others) {
	values = new InternSet(values);
	for (const other of others) for (const value of other) values.delete(value);
	return values;
}

//#endregion
//#region node_modules/d3-array/src/disjoint.js
function disjoint(values, other) {
	const iterator = other[Symbol.iterator](), set$3 = new InternSet();
	for (const v$1 of values) {
		if (set$3.has(v$1)) return false;
		let value, done;
		while ({value, done} = iterator.next()) {
			if (done) break;
			if (Object.is(v$1, value)) return false;
			set$3.add(value);
		}
	}
	return true;
}

//#endregion
//#region node_modules/d3-array/src/intersection.js
function intersection(values, ...others) {
	values = new InternSet(values);
	others = others.map(set$2);
	out: for (const value of values) for (const other of others) if (!other.has(value)) {
		values.delete(value);
		continue out;
	}
	return values;
}
function set$2(values) {
	return values instanceof InternSet ? values : new InternSet(values);
}

//#endregion
//#region node_modules/d3-array/src/superset.js
function superset(values, other) {
	const iterator = values[Symbol.iterator](), set$3 = /* @__PURE__ */ new Set();
	for (const o of other) {
		const io = intern(o);
		if (set$3.has(io)) continue;
		let value, done;
		while ({value, done} = iterator.next()) {
			if (done) return false;
			const ivalue = intern(value);
			set$3.add(ivalue);
			if (Object.is(io, ivalue)) break;
		}
	}
	return true;
}
function intern(value) {
	return value !== null && typeof value === "object" ? value.valueOf() : value;
}

//#endregion
//#region node_modules/d3-array/src/subset.js
function subset(values, other) {
	return superset(other, values);
}

//#endregion
//#region node_modules/d3-array/src/union.js
function union(...others) {
	const set$3 = new InternSet();
	for (const other of others) for (const o of other) set$3.add(o);
	return set$3;
}

//#endregion
//#region node_modules/d3-axis/src/identity.js
function identity_default$4(x$3) {
	return x$3;
}

//#endregion
//#region node_modules/d3-axis/src/axis.js
var top = 1, right = 2, bottom = 3, left = 4, epsilon$6 = 1e-6;
function translateX(x$3) {
	return "translate(" + x$3 + ",0)";
}
function translateY(y$3) {
	return "translate(0," + y$3 + ")";
}
function number$2(scale$1) {
	return (d) => +scale$1(d);
}
function center(scale$1, offset) {
	offset = Math.max(0, scale$1.bandwidth() - offset * 2) / 2;
	if (scale$1.round()) offset = Math.round(offset);
	return (d) => +scale$1(d) + offset;
}
function entering() {
	return !this.__axis;
}
function axis(orient, scale$1) {
	var tickArguments = [], tickValues = null, tickFormat$1 = null, tickSizeInner = 6, tickSizeOuter = 6, tickPadding = 3, offset = typeof window !== "undefined" && window.devicePixelRatio > 1 ? 0 : .5, k$1 = orient === top || orient === left ? -1 : 1, x$3 = orient === left || orient === right ? "x" : "y", transform$1 = orient === top || orient === bottom ? translateX : translateY;
	function axis$1(context) {
		var values = tickValues == null ? scale$1.ticks ? scale$1.ticks.apply(scale$1, tickArguments) : scale$1.domain() : tickValues, format$1 = tickFormat$1 == null ? scale$1.tickFormat ? scale$1.tickFormat.apply(scale$1, tickArguments) : identity_default$4 : tickFormat$1, spacing = Math.max(tickSizeInner, 0) + tickPadding, range$3 = scale$1.range(), range0 = +range$3[0] + offset, range1 = +range$3[range$3.length - 1] + offset, position = (scale$1.bandwidth ? center : number$2)(scale$1.copy(), offset), selection$1 = context.selection ? context.selection() : context, path$1 = selection$1.selectAll(".domain").data([null]), tick = selection$1.selectAll(".tick").data(values, scale$1).order(), tickExit = tick.exit(), tickEnter = tick.enter().append("g").attr("class", "tick"), line = tick.select("line"), text = tick.select("text");
		path$1 = path$1.merge(path$1.enter().insert("path", ".tick").attr("class", "domain").attr("stroke", "currentColor"));
		tick = tick.merge(tickEnter);
		line = line.merge(tickEnter.append("line").attr("stroke", "currentColor").attr(x$3 + "2", k$1 * tickSizeInner));
		text = text.merge(tickEnter.append("text").attr("fill", "currentColor").attr(x$3, k$1 * spacing).attr("dy", orient === top ? "0em" : orient === bottom ? "0.71em" : "0.32em"));
		if (context !== selection$1) {
			path$1 = path$1.transition(context);
			tick = tick.transition(context);
			line = line.transition(context);
			text = text.transition(context);
			tickExit = tickExit.transition(context).attr("opacity", epsilon$6).attr("transform", function(d) {
				return isFinite(d = position(d)) ? transform$1(d + offset) : this.getAttribute("transform");
			});
			tickEnter.attr("opacity", epsilon$6).attr("transform", function(d) {
				var p = this.parentNode.__axis;
				return transform$1((p && isFinite(p = p(d)) ? p : position(d)) + offset);
			});
		}
		tickExit.remove();
		path$1.attr("d", orient === left || orient === right ? tickSizeOuter ? "M" + k$1 * tickSizeOuter + "," + range0 + "H" + offset + "V" + range1 + "H" + k$1 * tickSizeOuter : "M" + offset + "," + range0 + "V" + range1 : tickSizeOuter ? "M" + range0 + "," + k$1 * tickSizeOuter + "V" + offset + "H" + range1 + "V" + k$1 * tickSizeOuter : "M" + range0 + "," + offset + "H" + range1);
		tick.attr("opacity", 1).attr("transform", function(d) {
			return transform$1(position(d) + offset);
		});
		line.attr(x$3 + "2", k$1 * tickSizeInner);
		text.attr(x$3, k$1 * spacing).text(format$1);
		selection$1.filter(entering).attr("fill", "none").attr("font-size", 10).attr("font-family", "sans-serif").attr("text-anchor", orient === right ? "start" : orient === left ? "end" : "middle");
		selection$1.each(function() {
			this.__axis = position;
		});
	}
	axis$1.scale = function(_) {
		return arguments.length ? (scale$1 = _, axis$1) : scale$1;
	};
	axis$1.ticks = function() {
		return tickArguments = Array.from(arguments), axis$1;
	};
	axis$1.tickArguments = function(_) {
		return arguments.length ? (tickArguments = _ == null ? [] : Array.from(_), axis$1) : tickArguments.slice();
	};
	axis$1.tickValues = function(_) {
		return arguments.length ? (tickValues = _ == null ? null : Array.from(_), axis$1) : tickValues && tickValues.slice();
	};
	axis$1.tickFormat = function(_) {
		return arguments.length ? (tickFormat$1 = _, axis$1) : tickFormat$1;
	};
	axis$1.tickSize = function(_) {
		return arguments.length ? (tickSizeInner = tickSizeOuter = +_, axis$1) : tickSizeInner;
	};
	axis$1.tickSizeInner = function(_) {
		return arguments.length ? (tickSizeInner = +_, axis$1) : tickSizeInner;
	};
	axis$1.tickSizeOuter = function(_) {
		return arguments.length ? (tickSizeOuter = +_, axis$1) : tickSizeOuter;
	};
	axis$1.tickPadding = function(_) {
		return arguments.length ? (tickPadding = +_, axis$1) : tickPadding;
	};
	axis$1.offset = function(_) {
		return arguments.length ? (offset = +_, axis$1) : offset;
	};
	return axis$1;
}
function axisTop(scale$1) {
	return axis(top, scale$1);
}
function axisRight(scale$1) {
	return axis(right, scale$1);
}
function axisBottom(scale$1) {
	return axis(bottom, scale$1);
}
function axisLeft(scale$1) {
	return axis(left, scale$1);
}

//#endregion
//#region node_modules/d3-dispatch/src/dispatch.js
var noop$1 = { value: () => {} };
function dispatch() {
	for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
		if (!(t = arguments[i] + "") || t in _ || /[\s.]/.test(t)) throw new Error("illegal type: " + t);
		_[t] = [];
	}
	return new Dispatch(_);
}
function Dispatch(_) {
	this._ = _;
}
function parseTypenames$1(typenames, types) {
	return typenames.trim().split(/^|\s+/).map(function(t) {
		var name = "", i = t.indexOf(".");
		if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
		if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
		return {
			type: t,
			name
		};
	});
}
Dispatch.prototype = dispatch.prototype = {
	constructor: Dispatch,
	on: function(typename, callback) {
		var _ = this._, T = parseTypenames$1(typename + "", _), t, i = -1, n = T.length;
		if (arguments.length < 2) {
			while (++i < n) if ((t = (typename = T[i]).type) && (t = get$1(_[t], typename.name))) return t;
			return;
		}
		if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
		while (++i < n) if (t = (typename = T[i]).type) _[t] = set$1(_[t], typename.name, callback);
		else if (callback == null) for (t in _) _[t] = set$1(_[t], typename.name, null);
		return this;
	},
	copy: function() {
		var copy$2 = {}, _ = this._;
		for (var t in _) copy$2[t] = _[t].slice();
		return new Dispatch(copy$2);
	},
	call: function(type$1, that) {
		if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
		if (!this._.hasOwnProperty(type$1)) throw new Error("unknown type: " + type$1);
		for (t = this._[type$1], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
	},
	apply: function(type$1, that, args) {
		if (!this._.hasOwnProperty(type$1)) throw new Error("unknown type: " + type$1);
		for (var t = this._[type$1], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
	}
};
function get$1(type$1, name) {
	for (var i = 0, n = type$1.length, c$5; i < n; ++i) if ((c$5 = type$1[i]).name === name) return c$5.value;
}
function set$1(type$1, name, callback) {
	for (var i = 0, n = type$1.length; i < n; ++i) if (type$1[i].name === name) {
		type$1[i] = noop$1, type$1 = type$1.slice(0, i).concat(type$1.slice(i + 1));
		break;
	}
	if (callback != null) type$1.push({
		name,
		value: callback
	});
	return type$1;
}
var dispatch_default = dispatch;

//#endregion
//#region node_modules/d3-selection/src/namespaces.js
var xhtml = "http://www.w3.org/1999/xhtml";
var namespaces_default = {
	svg: "http://www.w3.org/2000/svg",
	xhtml,
	xlink: "http://www.w3.org/1999/xlink",
	xml: "http://www.w3.org/XML/1998/namespace",
	xmlns: "http://www.w3.org/2000/xmlns/"
};

//#endregion
//#region node_modules/d3-selection/src/namespace.js
function namespace_default(name) {
	var prefix = name += "", i = prefix.indexOf(":");
	if (i >= 0 && (prefix = name.slice(0, i)) !== "xmlns") name = name.slice(i + 1);
	return namespaces_default.hasOwnProperty(prefix) ? {
		space: namespaces_default[prefix],
		local: name
	} : name;
}

//#endregion
//#region node_modules/d3-selection/src/creator.js
function creatorInherit(name) {
	return function() {
		var document$1 = this.ownerDocument, uri = this.namespaceURI;
		return uri === xhtml && document$1.documentElement.namespaceURI === xhtml ? document$1.createElement(name) : document$1.createElementNS(uri, name);
	};
}
function creatorFixed(fullname) {
	return function() {
		return this.ownerDocument.createElementNS(fullname.space, fullname.local);
	};
}
function creator_default(name) {
	var fullname = namespace_default(name);
	return (fullname.local ? creatorFixed : creatorInherit)(fullname);
}

//#endregion
//#region node_modules/d3-selection/src/selector.js
function none() {}
function selector_default(selector) {
	return selector == null ? none : function() {
		return this.querySelector(selector);
	};
}

//#endregion
//#region node_modules/d3-selection/src/selection/select.js
function select_default$2(select) {
	if (typeof select !== "function") select = selector_default(select);
	for (var groups$1 = this._groups, m$2 = groups$1.length, subgroups = new Array(m$2), j = 0; j < m$2; ++j) for (var group$1 = groups$1[j], n = group$1.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) if ((node = group$1[i]) && (subnode = select.call(node, node.__data__, i, group$1))) {
		if ("__data__" in node) subnode.__data__ = node.__data__;
		subgroup[i] = subnode;
	}
	return new Selection$1(subgroups, this._parents);
}

//#endregion
//#region node_modules/d3-selection/src/array.js
function array$1(x$3) {
	return x$3 == null ? [] : Array.isArray(x$3) ? x$3 : Array.from(x$3);
}

//#endregion
//#region node_modules/d3-selection/src/selectorAll.js
function empty$1() {
	return [];
}
function selectorAll_default(selector) {
	return selector == null ? empty$1 : function() {
		return this.querySelectorAll(selector);
	};
}

//#endregion
//#region node_modules/d3-selection/src/selection/selectAll.js
function arrayAll(select) {
	return function() {
		return array$1(select.apply(this, arguments));
	};
}
function selectAll_default$2(select) {
	if (typeof select === "function") select = arrayAll(select);
	else select = selectorAll_default(select);
	for (var groups$1 = this._groups, m$2 = groups$1.length, subgroups = [], parents = [], j = 0; j < m$2; ++j) for (var group$1 = groups$1[j], n = group$1.length, node, i = 0; i < n; ++i) if (node = group$1[i]) {
		subgroups.push(select.call(node, node.__data__, i, group$1));
		parents.push(node);
	}
	return new Selection$1(subgroups, parents);
}

//#endregion
//#region node_modules/d3-selection/src/matcher.js
function matcher_default(selector) {
	return function() {
		return this.matches(selector);
	};
}
function childMatcher(selector) {
	return function(node) {
		return node.matches(selector);
	};
}

//#endregion
//#region node_modules/d3-selection/src/selection/selectChild.js
var find$1 = Array.prototype.find;
function childFind(match) {
	return function() {
		return find$1.call(this.children, match);
	};
}
function childFirst() {
	return this.firstElementChild;
}
function selectChild_default(match) {
	return this.select(match == null ? childFirst : childFind(typeof match === "function" ? match : childMatcher(match)));
}

//#endregion
//#region node_modules/d3-selection/src/selection/selectChildren.js
var filter$1 = Array.prototype.filter;
function children() {
	return Array.from(this.children);
}
function childrenFilter(match) {
	return function() {
		return filter$1.call(this.children, match);
	};
}
function selectChildren_default(match) {
	return this.selectAll(match == null ? children : childrenFilter(typeof match === "function" ? match : childMatcher(match)));
}

//#endregion
//#region node_modules/d3-selection/src/selection/filter.js
function filter_default$1(match) {
	if (typeof match !== "function") match = matcher_default(match);
	for (var groups$1 = this._groups, m$2 = groups$1.length, subgroups = new Array(m$2), j = 0; j < m$2; ++j) for (var group$1 = groups$1[j], n = group$1.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) if ((node = group$1[i]) && match.call(node, node.__data__, i, group$1)) subgroup.push(node);
	return new Selection$1(subgroups, this._parents);
}

//#endregion
//#region node_modules/d3-selection/src/selection/sparse.js
function sparse_default(update) {
	return new Array(update.length);
}

//#endregion
//#region node_modules/d3-selection/src/selection/enter.js
function enter_default() {
	return new Selection$1(this._enter || this._groups.map(sparse_default), this._parents);
}
function EnterNode(parent, datum$1) {
	this.ownerDocument = parent.ownerDocument;
	this.namespaceURI = parent.namespaceURI;
	this._next = null;
	this._parent = parent;
	this.__data__ = datum$1;
}
EnterNode.prototype = {
	constructor: EnterNode,
	appendChild: function(child) {
		return this._parent.insertBefore(child, this._next);
	},
	insertBefore: function(child, next) {
		return this._parent.insertBefore(child, next);
	},
	querySelector: function(selector) {
		return this._parent.querySelector(selector);
	},
	querySelectorAll: function(selector) {
		return this._parent.querySelectorAll(selector);
	}
};

//#endregion
//#region node_modules/d3-selection/src/constant.js
function constant_default$10(x$3) {
	return function() {
		return x$3;
	};
}

//#endregion
//#region node_modules/d3-selection/src/selection/data.js
function bindIndex(parent, group$1, enter, update, exit, data) {
	var i = 0, node, groupLength = group$1.length, dataLength = data.length;
	for (; i < dataLength; ++i) if (node = group$1[i]) {
		node.__data__ = data[i];
		update[i] = node;
	} else enter[i] = new EnterNode(parent, data[i]);
	for (; i < groupLength; ++i) if (node = group$1[i]) exit[i] = node;
}
function bindKey(parent, group$1, enter, update, exit, data, key) {
	var i, node, nodeByKeyValue = /* @__PURE__ */ new Map(), groupLength = group$1.length, dataLength = data.length, keyValues = new Array(groupLength), keyValue;
	for (i = 0; i < groupLength; ++i) if (node = group$1[i]) {
		keyValues[i] = keyValue = key.call(node, node.__data__, i, group$1) + "";
		if (nodeByKeyValue.has(keyValue)) exit[i] = node;
		else nodeByKeyValue.set(keyValue, node);
	}
	for (i = 0; i < dataLength; ++i) {
		keyValue = key.call(parent, data[i], i, data) + "";
		if (node = nodeByKeyValue.get(keyValue)) {
			update[i] = node;
			node.__data__ = data[i];
			nodeByKeyValue.delete(keyValue);
		} else enter[i] = new EnterNode(parent, data[i]);
	}
	for (i = 0; i < groupLength; ++i) if ((node = group$1[i]) && nodeByKeyValue.get(keyValues[i]) === node) exit[i] = node;
}
function datum(node) {
	return node.__data__;
}
function data_default$1(value, key) {
	if (!arguments.length) return Array.from(this, datum);
	var bind = key ? bindKey : bindIndex, parents = this._parents, groups$1 = this._groups;
	if (typeof value !== "function") value = constant_default$10(value);
	for (var m$2 = groups$1.length, update = new Array(m$2), enter = new Array(m$2), exit = new Array(m$2), j = 0; j < m$2; ++j) {
		var parent = parents[j], group$1 = groups$1[j], groupLength = group$1.length, data = arraylike(value.call(parent, parent && parent.__data__, j, parents)), dataLength = data.length, enterGroup = enter[j] = new Array(dataLength), updateGroup = update[j] = new Array(dataLength), exitGroup = exit[j] = new Array(groupLength);
		bind(parent, group$1, enterGroup, updateGroup, exitGroup, data, key);
		for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) if (previous = enterGroup[i0]) {
			if (i0 >= i1) i1 = i0 + 1;
			while (!(next = updateGroup[i1]) && ++i1 < dataLength);
			previous._next = next || null;
		}
	}
	update = new Selection$1(update, parents);
	update._enter = enter;
	update._exit = exit;
	return update;
}
function arraylike(data) {
	return typeof data === "object" && "length" in data ? data : Array.from(data);
}

//#endregion
//#region node_modules/d3-selection/src/selection/exit.js
function exit_default() {
	return new Selection$1(this._exit || this._groups.map(sparse_default), this._parents);
}

//#endregion
//#region node_modules/d3-selection/src/selection/join.js
function join_default(onenter, onupdate, onexit) {
	var enter = this.enter(), update = this, exit = this.exit();
	if (typeof onenter === "function") {
		enter = onenter(enter);
		if (enter) enter = enter.selection();
	} else enter = enter.append(onenter + "");
	if (onupdate != null) {
		update = onupdate(update);
		if (update) update = update.selection();
	}
	if (onexit == null) exit.remove();
	else onexit(exit);
	return enter && update ? enter.merge(update).order() : update;
}

//#endregion
//#region node_modules/d3-selection/src/selection/merge.js
function merge_default$1(context) {
	var selection$1 = context.selection ? context.selection() : context;
	for (var groups0 = this._groups, groups1 = selection$1._groups, m0 = groups0.length, m1 = groups1.length, m$2 = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m$2; ++j) for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge$1 = merges[j] = new Array(n), node, i = 0; i < n; ++i) if (node = group0[i] || group1[i]) merge$1[i] = node;
	for (; j < m0; ++j) merges[j] = groups0[j];
	return new Selection$1(merges, this._parents);
}

//#endregion
//#region node_modules/d3-selection/src/selection/order.js
function order_default() {
	for (var groups$1 = this._groups, j = -1, m$2 = groups$1.length; ++j < m$2;) for (var group$1 = groups$1[j], i = group$1.length - 1, next = group$1[i], node; --i >= 0;) if (node = group$1[i]) {
		if (next && node.compareDocumentPosition(next) ^ 4) next.parentNode.insertBefore(node, next);
		next = node;
	}
	return this;
}

//#endregion
//#region node_modules/d3-selection/src/selection/sort.js
function sort_default$1(compare) {
	if (!compare) compare = ascending$1;
	function compareNode(a$3, b) {
		return a$3 && b ? compare(a$3.__data__, b.__data__) : !a$3 - !b;
	}
	for (var groups$1 = this._groups, m$2 = groups$1.length, sortgroups = new Array(m$2), j = 0; j < m$2; ++j) {
		for (var group$1 = groups$1[j], n = group$1.length, sortgroup = sortgroups[j] = new Array(n), node, i = 0; i < n; ++i) if (node = group$1[i]) sortgroup[i] = node;
		sortgroup.sort(compareNode);
	}
	return new Selection$1(sortgroups, this._parents).order();
}
function ascending$1(a$3, b) {
	return a$3 < b ? -1 : a$3 > b ? 1 : a$3 >= b ? 0 : NaN;
}

//#endregion
//#region node_modules/d3-selection/src/selection/call.js
function call_default() {
	var callback = arguments[0];
	arguments[0] = this;
	callback.apply(null, arguments);
	return this;
}

//#endregion
//#region node_modules/d3-selection/src/selection/nodes.js
function nodes_default() {
	return Array.from(this);
}

//#endregion
//#region node_modules/d3-selection/src/selection/node.js
function node_default() {
	for (var groups$1 = this._groups, j = 0, m$2 = groups$1.length; j < m$2; ++j) for (var group$1 = groups$1[j], i = 0, n = group$1.length; i < n; ++i) {
		var node = group$1[i];
		if (node) return node;
	}
	return null;
}

//#endregion
//#region node_modules/d3-selection/src/selection/size.js
function size_default$1() {
	let size = 0;
	for (const node of this) ++size;
	return size;
}

//#endregion
//#region node_modules/d3-selection/src/selection/empty.js
function empty_default() {
	return !this.node();
}

//#endregion
//#region node_modules/d3-selection/src/selection/each.js
function each_default$1(callback) {
	for (var groups$1 = this._groups, j = 0, m$2 = groups$1.length; j < m$2; ++j) for (var group$1 = groups$1[j], i = 0, n = group$1.length, node; i < n; ++i) if (node = group$1[i]) callback.call(node, node.__data__, i, group$1);
	return this;
}

//#endregion
//#region node_modules/d3-selection/src/selection/attr.js
function attrRemove$1(name) {
	return function() {
		this.removeAttribute(name);
	};
}
function attrRemoveNS$1(fullname) {
	return function() {
		this.removeAttributeNS(fullname.space, fullname.local);
	};
}
function attrConstant$1(name, value) {
	return function() {
		this.setAttribute(name, value);
	};
}
function attrConstantNS$1(fullname, value) {
	return function() {
		this.setAttributeNS(fullname.space, fullname.local, value);
	};
}
function attrFunction$1(name, value) {
	return function() {
		var v$1 = value.apply(this, arguments);
		if (v$1 == null) this.removeAttribute(name);
		else this.setAttribute(name, v$1);
	};
}
function attrFunctionNS$1(fullname, value) {
	return function() {
		var v$1 = value.apply(this, arguments);
		if (v$1 == null) this.removeAttributeNS(fullname.space, fullname.local);
		else this.setAttributeNS(fullname.space, fullname.local, v$1);
	};
}
function attr_default$1(name, value) {
	var fullname = namespace_default(name);
	if (arguments.length < 2) {
		var node = this.node();
		return fullname.local ? node.getAttributeNS(fullname.space, fullname.local) : node.getAttribute(fullname);
	}
	return this.each((value == null ? fullname.local ? attrRemoveNS$1 : attrRemove$1 : typeof value === "function" ? fullname.local ? attrFunctionNS$1 : attrFunction$1 : fullname.local ? attrConstantNS$1 : attrConstant$1)(fullname, value));
}

//#endregion
//#region node_modules/d3-selection/src/window.js
function window_default(node) {
	return node.ownerDocument && node.ownerDocument.defaultView || node.document && node || node.defaultView;
}

//#endregion
//#region node_modules/d3-selection/src/selection/style.js
function styleRemove$1(name) {
	return function() {
		this.style.removeProperty(name);
	};
}
function styleConstant$1(name, value, priority) {
	return function() {
		this.style.setProperty(name, value, priority);
	};
}
function styleFunction$1(name, value, priority) {
	return function() {
		var v$1 = value.apply(this, arguments);
		if (v$1 == null) this.style.removeProperty(name);
		else this.style.setProperty(name, v$1, priority);
	};
}
function style_default$1(name, value, priority) {
	return arguments.length > 1 ? this.each((value == null ? styleRemove$1 : typeof value === "function" ? styleFunction$1 : styleConstant$1)(name, value, priority == null ? "" : priority)) : styleValue(this.node(), name);
}
function styleValue(node, name) {
	return node.style.getPropertyValue(name) || window_default(node).getComputedStyle(node, null).getPropertyValue(name);
}

//#endregion
//#region node_modules/d3-selection/src/selection/property.js
function propertyRemove(name) {
	return function() {
		delete this[name];
	};
}
function propertyConstant(name, value) {
	return function() {
		this[name] = value;
	};
}
function propertyFunction(name, value) {
	return function() {
		var v$1 = value.apply(this, arguments);
		if (v$1 == null) delete this[name];
		else this[name] = v$1;
	};
}
function property_default(name, value) {
	return arguments.length > 1 ? this.each((value == null ? propertyRemove : typeof value === "function" ? propertyFunction : propertyConstant)(name, value)) : this.node()[name];
}

//#endregion
//#region node_modules/d3-selection/src/selection/classed.js
function classArray(string) {
	return string.trim().split(/^|\s+/);
}
function classList(node) {
	return node.classList || new ClassList(node);
}
function ClassList(node) {
	this._node = node;
	this._names = classArray(node.getAttribute("class") || "");
}
ClassList.prototype = {
	add: function(name) {
		if (this._names.indexOf(name) < 0) {
			this._names.push(name);
			this._node.setAttribute("class", this._names.join(" "));
		}
	},
	remove: function(name) {
		var i = this._names.indexOf(name);
		if (i >= 0) {
			this._names.splice(i, 1);
			this._node.setAttribute("class", this._names.join(" "));
		}
	},
	contains: function(name) {
		return this._names.indexOf(name) >= 0;
	}
};
function classedAdd(node, names) {
	var list = classList(node), i = -1, n = names.length;
	while (++i < n) list.add(names[i]);
}
function classedRemove(node, names) {
	var list = classList(node), i = -1, n = names.length;
	while (++i < n) list.remove(names[i]);
}
function classedTrue(names) {
	return function() {
		classedAdd(this, names);
	};
}
function classedFalse(names) {
	return function() {
		classedRemove(this, names);
	};
}
function classedFunction(names, value) {
	return function() {
		(value.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
	};
}
function classed_default(name, value) {
	var names = classArray(name + "");
	if (arguments.length < 2) {
		var list = classList(this.node()), i = -1, n = names.length;
		while (++i < n) if (!list.contains(names[i])) return false;
		return true;
	}
	return this.each((typeof value === "function" ? classedFunction : value ? classedTrue : classedFalse)(names, value));
}

//#endregion
//#region node_modules/d3-selection/src/selection/text.js
function textRemove() {
	this.textContent = "";
}
function textConstant$1(value) {
	return function() {
		this.textContent = value;
	};
}
function textFunction$1(value) {
	return function() {
		var v$1 = value.apply(this, arguments);
		this.textContent = v$1 == null ? "" : v$1;
	};
}
function text_default$2(value) {
	return arguments.length ? this.each(value == null ? textRemove : (typeof value === "function" ? textFunction$1 : textConstant$1)(value)) : this.node().textContent;
}

//#endregion
//#region node_modules/d3-selection/src/selection/html.js
function htmlRemove() {
	this.innerHTML = "";
}
function htmlConstant(value) {
	return function() {
		this.innerHTML = value;
	};
}
function htmlFunction(value) {
	return function() {
		var v$1 = value.apply(this, arguments);
		this.innerHTML = v$1 == null ? "" : v$1;
	};
}
function html_default(value) {
	return arguments.length ? this.each(value == null ? htmlRemove : (typeof value === "function" ? htmlFunction : htmlConstant)(value)) : this.node().innerHTML;
}

//#endregion
//#region node_modules/d3-selection/src/selection/raise.js
function raise() {
	if (this.nextSibling) this.parentNode.appendChild(this);
}
function raise_default() {
	return this.each(raise);
}

//#endregion
//#region node_modules/d3-selection/src/selection/lower.js
function lower() {
	if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
}
function lower_default() {
	return this.each(lower);
}

//#endregion
//#region node_modules/d3-selection/src/selection/append.js
function append_default(name) {
	var create$1 = typeof name === "function" ? name : creator_default(name);
	return this.select(function() {
		return this.appendChild(create$1.apply(this, arguments));
	});
}

//#endregion
//#region node_modules/d3-selection/src/selection/insert.js
function constantNull() {
	return null;
}
function insert_default(name, before) {
	var create$1 = typeof name === "function" ? name : creator_default(name), select = before == null ? constantNull : typeof before === "function" ? before : selector_default(before);
	return this.select(function() {
		return this.insertBefore(create$1.apply(this, arguments), select.apply(this, arguments) || null);
	});
}

//#endregion
//#region node_modules/d3-selection/src/selection/remove.js
function remove() {
	var parent = this.parentNode;
	if (parent) parent.removeChild(this);
}
function remove_default$2() {
	return this.each(remove);
}

//#endregion
//#region node_modules/d3-selection/src/selection/clone.js
function selection_cloneShallow() {
	var clone = this.cloneNode(false), parent = this.parentNode;
	return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
}
function selection_cloneDeep() {
	var clone = this.cloneNode(true), parent = this.parentNode;
	return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
}
function clone_default(deep) {
	return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
}

//#endregion
//#region node_modules/d3-selection/src/selection/datum.js
function datum_default(value) {
	return arguments.length ? this.property("__data__", value) : this.node().__data__;
}

//#endregion
//#region node_modules/d3-selection/src/selection/on.js
function contextListener(listener) {
	return function(event) {
		listener.call(this, event, this.__data__);
	};
}
function parseTypenames(typenames) {
	return typenames.trim().split(/^|\s+/).map(function(t) {
		var name = "", i = t.indexOf(".");
		if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
		return {
			type: t,
			name
		};
	});
}
function onRemove(typename) {
	return function() {
		var on = this.__on;
		if (!on) return;
		for (var j = 0, i = -1, m$2 = on.length, o; j < m$2; ++j) if (o = on[j], (!typename.type || o.type === typename.type) && o.name === typename.name) this.removeEventListener(o.type, o.listener, o.options);
		else on[++i] = o;
		if (++i) on.length = i;
		else delete this.__on;
	};
}
function onAdd(typename, value, options) {
	return function() {
		var on = this.__on, o, listener = contextListener(value);
		if (on) {
			for (var j = 0, m$2 = on.length; j < m$2; ++j) if ((o = on[j]).type === typename.type && o.name === typename.name) {
				this.removeEventListener(o.type, o.listener, o.options);
				this.addEventListener(o.type, o.listener = listener, o.options = options);
				o.value = value;
				return;
			}
		}
		this.addEventListener(typename.type, listener, options);
		o = {
			type: typename.type,
			name: typename.name,
			value,
			listener,
			options
		};
		if (!on) this.__on = [o];
		else on.push(o);
	};
}
function on_default$1(typename, value, options) {
	var typenames = parseTypenames(typename + ""), i, n = typenames.length, t;
	if (arguments.length < 2) {
		var on = this.node().__on;
		if (on) {
			for (var j = 0, m$2 = on.length, o; j < m$2; ++j) for (i = 0, o = on[j]; i < n; ++i) if ((t = typenames[i]).type === o.type && t.name === o.name) return o.value;
		}
		return;
	}
	on = value ? onAdd : onRemove;
	for (i = 0; i < n; ++i) this.each(on(typenames[i], value, options));
	return this;
}

//#endregion
//#region node_modules/d3-selection/src/selection/dispatch.js
function dispatchEvent(node, type$1, params) {
	var window$1 = window_default(node), event = window$1.CustomEvent;
	if (typeof event === "function") event = new event(type$1, params);
	else {
		event = window$1.document.createEvent("Event");
		if (params) event.initEvent(type$1, params.bubbles, params.cancelable), event.detail = params.detail;
		else event.initEvent(type$1, false, false);
	}
	node.dispatchEvent(event);
}
function dispatchConstant(type$1, params) {
	return function() {
		return dispatchEvent(this, type$1, params);
	};
}
function dispatchFunction(type$1, params) {
	return function() {
		return dispatchEvent(this, type$1, params.apply(this, arguments));
	};
}
function dispatch_default$1(type$1, params) {
	return this.each((typeof params === "function" ? dispatchFunction : dispatchConstant)(type$1, params));
}

//#endregion
//#region node_modules/d3-selection/src/selection/iterator.js
function* iterator_default$1() {
	for (var groups$1 = this._groups, j = 0, m$2 = groups$1.length; j < m$2; ++j) for (var group$1 = groups$1[j], i = 0, n = group$1.length, node; i < n; ++i) if (node = group$1[i]) yield node;
}

//#endregion
//#region node_modules/d3-selection/src/selection/index.js
var root$1 = [null];
function Selection$1(groups$1, parents) {
	this._groups = groups$1;
	this._parents = parents;
}
function selection() {
	return new Selection$1([[document.documentElement]], root$1);
}
function selection_selection() {
	return this;
}
Selection$1.prototype = selection.prototype = {
	constructor: Selection$1,
	select: select_default$2,
	selectAll: selectAll_default$2,
	selectChild: selectChild_default,
	selectChildren: selectChildren_default,
	filter: filter_default$1,
	data: data_default$1,
	enter: enter_default,
	exit: exit_default,
	join: join_default,
	merge: merge_default$1,
	selection: selection_selection,
	order: order_default,
	sort: sort_default$1,
	call: call_default,
	nodes: nodes_default,
	node: node_default,
	size: size_default$1,
	empty: empty_default,
	each: each_default$1,
	attr: attr_default$1,
	style: style_default$1,
	property: property_default,
	classed: classed_default,
	text: text_default$2,
	html: html_default,
	raise: raise_default,
	lower: lower_default,
	append: append_default,
	insert: insert_default,
	remove: remove_default$2,
	clone: clone_default,
	datum: datum_default,
	on: on_default$1,
	dispatch: dispatch_default$1,
	[Symbol.iterator]: iterator_default$1
};
var selection_default = selection;

//#endregion
//#region node_modules/d3-selection/src/select.js
function select_default(selector) {
	return typeof selector === "string" ? new Selection$1([[document.querySelector(selector)]], [document.documentElement]) : new Selection$1([[selector]], root$1);
}

//#endregion
//#region node_modules/d3-selection/src/create.js
function create_default(name) {
	return select_default(creator_default(name).call(document.documentElement));
}

//#endregion
//#region node_modules/d3-selection/src/local.js
var nextId = 0;
function local() {
	return new Local();
}
function Local() {
	this._ = "@" + (++nextId).toString(36);
}
Local.prototype = local.prototype = {
	constructor: Local,
	get: function(node) {
		var id$1 = this._;
		while (!(id$1 in node)) if (!(node = node.parentNode)) return;
		return node[id$1];
	},
	set: function(node, value) {
		return node[this._] = value;
	},
	remove: function(node) {
		return this._ in node && delete node[this._];
	},
	toString: function() {
		return this._;
	}
};

//#endregion
//#region node_modules/d3-selection/src/sourceEvent.js
function sourceEvent_default(event) {
	let sourceEvent;
	while (sourceEvent = event.sourceEvent) event = sourceEvent;
	return event;
}

//#endregion
//#region node_modules/d3-selection/src/pointer.js
function pointer_default(event, node) {
	event = sourceEvent_default(event);
	if (node === void 0) node = event.currentTarget;
	if (node) {
		var svg$1 = node.ownerSVGElement || node;
		if (svg$1.createSVGPoint) {
			var point$5 = svg$1.createSVGPoint();
			point$5.x = event.clientX, point$5.y = event.clientY;
			point$5 = point$5.matrixTransform(node.getScreenCTM().inverse());
			return [point$5.x, point$5.y];
		}
		if (node.getBoundingClientRect) {
			var rect = node.getBoundingClientRect();
			return [event.clientX - rect.left - node.clientLeft, event.clientY - rect.top - node.clientTop];
		}
	}
	return [event.pageX, event.pageY];
}

//#endregion
//#region node_modules/d3-selection/src/pointers.js
function pointers_default(events, node) {
	if (events.target) {
		events = sourceEvent_default(events);
		if (node === void 0) node = events.currentTarget;
		events = events.touches || [events];
	}
	return Array.from(events, (event) => pointer_default(event, node));
}

//#endregion
//#region node_modules/d3-selection/src/selectAll.js
function selectAll_default(selector) {
	return typeof selector === "string" ? new Selection$1([document.querySelectorAll(selector)], [document.documentElement]) : new Selection$1([array$1(selector)], root$1);
}

//#endregion
//#region node_modules/d3-drag/src/noevent.js
const nonpassive = { passive: false };
const nonpassivecapture = {
	capture: true,
	passive: false
};
function nopropagation$2(event) {
	event.stopImmediatePropagation();
}
function noevent_default$2(event) {
	event.preventDefault();
	event.stopImmediatePropagation();
}

//#endregion
//#region node_modules/d3-drag/src/nodrag.js
function nodrag_default(view) {
	var root$2 = view.document.documentElement, selection$1 = select_default(view).on("dragstart.drag", noevent_default$2, nonpassivecapture);
	if ("onselectstart" in root$2) selection$1.on("selectstart.drag", noevent_default$2, nonpassivecapture);
	else {
		root$2.__noselect = root$2.style.MozUserSelect;
		root$2.style.MozUserSelect = "none";
	}
}
function yesdrag(view, noclick) {
	var root$2 = view.document.documentElement, selection$1 = select_default(view).on("dragstart.drag", null);
	if (noclick) {
		selection$1.on("click.drag", noevent_default$2, nonpassivecapture);
		setTimeout(function() {
			selection$1.on("click.drag", null);
		}, 0);
	}
	if ("onselectstart" in root$2) selection$1.on("selectstart.drag", null);
	else {
		root$2.style.MozUserSelect = root$2.__noselect;
		delete root$2.__noselect;
	}
}

//#endregion
//#region node_modules/d3-drag/src/constant.js
var constant_default$9 = (x$3) => () => x$3;

//#endregion
//#region node_modules/d3-drag/src/event.js
function DragEvent(type$1, { sourceEvent, subject, target, identifier, active, x: x$3, y: y$3, dx, dy, dispatch: dispatch$1 }) {
	Object.defineProperties(this, {
		type: {
			value: type$1,
			enumerable: true,
			configurable: true
		},
		sourceEvent: {
			value: sourceEvent,
			enumerable: true,
			configurable: true
		},
		subject: {
			value: subject,
			enumerable: true,
			configurable: true
		},
		target: {
			value: target,
			enumerable: true,
			configurable: true
		},
		identifier: {
			value: identifier,
			enumerable: true,
			configurable: true
		},
		active: {
			value: active,
			enumerable: true,
			configurable: true
		},
		x: {
			value: x$3,
			enumerable: true,
			configurable: true
		},
		y: {
			value: y$3,
			enumerable: true,
			configurable: true
		},
		dx: {
			value: dx,
			enumerable: true,
			configurable: true
		},
		dy: {
			value: dy,
			enumerable: true,
			configurable: true
		},
		_: { value: dispatch$1 }
	});
}
DragEvent.prototype.on = function() {
	var value = this._.on.apply(this._, arguments);
	return value === this._ ? this : value;
};

//#endregion
//#region node_modules/d3-drag/src/drag.js
function defaultFilter$2(event) {
	return !event.ctrlKey && !event.button;
}
function defaultContainer() {
	return this.parentNode;
}
function defaultSubject(event, d) {
	return d == null ? {
		x: event.x,
		y: event.y
	} : d;
}
function defaultTouchable$2() {
	return navigator.maxTouchPoints || "ontouchstart" in this;
}
function drag_default() {
	var filter$2 = defaultFilter$2, container = defaultContainer, subject = defaultSubject, touchable = defaultTouchable$2, gestures = {}, listeners = dispatch_default("start", "drag", "end"), active = 0, mousedownx, mousedowny, mousemoving, touchending, clickDistance2 = 0;
	function drag(selection$1) {
		selection$1.on("mousedown.drag", mousedowned).filter(touchable).on("touchstart.drag", touchstarted).on("touchmove.drag", touchmoved, nonpassive).on("touchend.drag touchcancel.drag", touchended).style("touch-action", "none").style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
	}
	function mousedowned(event, d) {
		if (touchending || !filter$2.call(this, event, d)) return;
		var gesture = beforestart(this, container.call(this, event, d), event, d, "mouse");
		if (!gesture) return;
		select_default(event.view).on("mousemove.drag", mousemoved, nonpassivecapture).on("mouseup.drag", mouseupped, nonpassivecapture);
		nodrag_default(event.view);
		nopropagation$2(event);
		mousemoving = false;
		mousedownx = event.clientX;
		mousedowny = event.clientY;
		gesture("start", event);
	}
	function mousemoved(event) {
		noevent_default$2(event);
		if (!mousemoving) {
			var dx = event.clientX - mousedownx, dy = event.clientY - mousedowny;
			mousemoving = dx * dx + dy * dy > clickDistance2;
		}
		gestures.mouse("drag", event);
	}
	function mouseupped(event) {
		select_default(event.view).on("mousemove.drag mouseup.drag", null);
		yesdrag(event.view, mousemoving);
		noevent_default$2(event);
		gestures.mouse("end", event);
	}
	function touchstarted(event, d) {
		if (!filter$2.call(this, event, d)) return;
		var touches = event.changedTouches, c$5 = container.call(this, event, d), n = touches.length, i, gesture;
		for (i = 0; i < n; ++i) if (gesture = beforestart(this, c$5, event, d, touches[i].identifier, touches[i])) {
			nopropagation$2(event);
			gesture("start", event, touches[i]);
		}
	}
	function touchmoved(event) {
		var touches = event.changedTouches, n = touches.length, i, gesture;
		for (i = 0; i < n; ++i) if (gesture = gestures[touches[i].identifier]) {
			noevent_default$2(event);
			gesture("drag", event, touches[i]);
		}
	}
	function touchended(event) {
		var touches = event.changedTouches, n = touches.length, i, gesture;
		if (touchending) clearTimeout(touchending);
		touchending = setTimeout(function() {
			touchending = null;
		}, 500);
		for (i = 0; i < n; ++i) if (gesture = gestures[touches[i].identifier]) {
			nopropagation$2(event);
			gesture("end", event, touches[i]);
		}
	}
	function beforestart(that, container$1, event, d, identifier, touch) {
		var dispatch$1 = listeners.copy(), p = pointer_default(touch || event, container$1), dx, dy, s$1;
		if ((s$1 = subject.call(that, new DragEvent("beforestart", {
			sourceEvent: event,
			target: drag,
			identifier,
			active,
			x: p[0],
			y: p[1],
			dx: 0,
			dy: 0,
			dispatch: dispatch$1
		}), d)) == null) return;
		dx = s$1.x - p[0] || 0;
		dy = s$1.y - p[1] || 0;
		return function gesture(type$1, event$1, touch$1) {
			var p0$1 = p, n;
			switch (type$1) {
				case "start":
					gestures[identifier] = gesture, n = active++;
					break;
				case "end": delete gestures[identifier], --active;
				case "drag":
					p = pointer_default(touch$1 || event$1, container$1), n = active;
					break;
			}
			dispatch$1.call(type$1, that, new DragEvent(type$1, {
				sourceEvent: event$1,
				subject: s$1,
				target: drag,
				identifier,
				active: n,
				x: p[0] + dx,
				y: p[1] + dy,
				dx: p[0] - p0$1[0],
				dy: p[1] - p0$1[1],
				dispatch: dispatch$1
			}), d);
		};
	}
	drag.filter = function(_) {
		return arguments.length ? (filter$2 = typeof _ === "function" ? _ : constant_default$9(!!_), drag) : filter$2;
	};
	drag.container = function(_) {
		return arguments.length ? (container = typeof _ === "function" ? _ : constant_default$9(_), drag) : container;
	};
	drag.subject = function(_) {
		return arguments.length ? (subject = typeof _ === "function" ? _ : constant_default$9(_), drag) : subject;
	};
	drag.touchable = function(_) {
		return arguments.length ? (touchable = typeof _ === "function" ? _ : constant_default$9(!!_), drag) : touchable;
	};
	drag.on = function() {
		var value = listeners.on.apply(listeners, arguments);
		return value === listeners ? drag : value;
	};
	drag.clickDistance = function(_) {
		return arguments.length ? (clickDistance2 = (_ = +_) * _, drag) : Math.sqrt(clickDistance2);
	};
	return drag;
}

//#endregion
//#region node_modules/d3-color/src/define.js
function define_default(constructor, factory, prototype) {
	constructor.prototype = factory.prototype = prototype;
	prototype.constructor = constructor;
}
function extend(parent, definition) {
	var prototype = Object.create(parent.prototype);
	for (var key in definition) prototype[key] = definition[key];
	return prototype;
}

//#endregion
//#region node_modules/d3-color/src/color.js
function Color() {}
var darker = .7;
var brighter = 1 / darker;
var reI = "\\s*([+-]?\\d+)\\s*", reN = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*", reP = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*", reHex = /^#([0-9a-f]{3,8})$/, reRgbInteger = /* @__PURE__ */ new RegExp(`^rgb\\(${reI},${reI},${reI}\\)$`), reRgbPercent = /* @__PURE__ */ new RegExp(`^rgb\\(${reP},${reP},${reP}\\)$`), reRgbaInteger = /* @__PURE__ */ new RegExp(`^rgba\\(${reI},${reI},${reI},${reN}\\)$`), reRgbaPercent = /* @__PURE__ */ new RegExp(`^rgba\\(${reP},${reP},${reP},${reN}\\)$`), reHslPercent = /* @__PURE__ */ new RegExp(`^hsl\\(${reN},${reP},${reP}\\)$`), reHslaPercent = /* @__PURE__ */ new RegExp(`^hsla\\(${reN},${reP},${reP},${reN}\\)$`);
var named = {
	aliceblue: 15792383,
	antiquewhite: 16444375,
	aqua: 65535,
	aquamarine: 8388564,
	azure: 15794175,
	beige: 16119260,
	bisque: 16770244,
	black: 0,
	blanchedalmond: 16772045,
	blue: 255,
	blueviolet: 9055202,
	brown: 10824234,
	burlywood: 14596231,
	cadetblue: 6266528,
	chartreuse: 8388352,
	chocolate: 13789470,
	coral: 16744272,
	cornflowerblue: 6591981,
	cornsilk: 16775388,
	crimson: 14423100,
	cyan: 65535,
	darkblue: 139,
	darkcyan: 35723,
	darkgoldenrod: 12092939,
	darkgray: 11119017,
	darkgreen: 25600,
	darkgrey: 11119017,
	darkkhaki: 12433259,
	darkmagenta: 9109643,
	darkolivegreen: 5597999,
	darkorange: 16747520,
	darkorchid: 10040012,
	darkred: 9109504,
	darksalmon: 15308410,
	darkseagreen: 9419919,
	darkslateblue: 4734347,
	darkslategray: 3100495,
	darkslategrey: 3100495,
	darkturquoise: 52945,
	darkviolet: 9699539,
	deeppink: 16716947,
	deepskyblue: 49151,
	dimgray: 6908265,
	dimgrey: 6908265,
	dodgerblue: 2003199,
	firebrick: 11674146,
	floralwhite: 16775920,
	forestgreen: 2263842,
	fuchsia: 16711935,
	gainsboro: 14474460,
	ghostwhite: 16316671,
	gold: 16766720,
	goldenrod: 14329120,
	gray: 8421504,
	green: 32768,
	greenyellow: 11403055,
	grey: 8421504,
	honeydew: 15794160,
	hotpink: 16738740,
	indianred: 13458524,
	indigo: 4915330,
	ivory: 16777200,
	khaki: 15787660,
	lavender: 15132410,
	lavenderblush: 16773365,
	lawngreen: 8190976,
	lemonchiffon: 16775885,
	lightblue: 11393254,
	lightcoral: 15761536,
	lightcyan: 14745599,
	lightgoldenrodyellow: 16448210,
	lightgray: 13882323,
	lightgreen: 9498256,
	lightgrey: 13882323,
	lightpink: 16758465,
	lightsalmon: 16752762,
	lightseagreen: 2142890,
	lightskyblue: 8900346,
	lightslategray: 7833753,
	lightslategrey: 7833753,
	lightsteelblue: 11584734,
	lightyellow: 16777184,
	lime: 65280,
	limegreen: 3329330,
	linen: 16445670,
	magenta: 16711935,
	maroon: 8388608,
	mediumaquamarine: 6737322,
	mediumblue: 205,
	mediumorchid: 12211667,
	mediumpurple: 9662683,
	mediumseagreen: 3978097,
	mediumslateblue: 8087790,
	mediumspringgreen: 64154,
	mediumturquoise: 4772300,
	mediumvioletred: 13047173,
	midnightblue: 1644912,
	mintcream: 16121850,
	mistyrose: 16770273,
	moccasin: 16770229,
	navajowhite: 16768685,
	navy: 128,
	oldlace: 16643558,
	olive: 8421376,
	olivedrab: 7048739,
	orange: 16753920,
	orangered: 16729344,
	orchid: 14315734,
	palegoldenrod: 15657130,
	palegreen: 10025880,
	paleturquoise: 11529966,
	palevioletred: 14381203,
	papayawhip: 16773077,
	peachpuff: 16767673,
	peru: 13468991,
	pink: 16761035,
	plum: 14524637,
	powderblue: 11591910,
	purple: 8388736,
	rebeccapurple: 6697881,
	red: 16711680,
	rosybrown: 12357519,
	royalblue: 4286945,
	saddlebrown: 9127187,
	salmon: 16416882,
	sandybrown: 16032864,
	seagreen: 3050327,
	seashell: 16774638,
	sienna: 10506797,
	silver: 12632256,
	skyblue: 8900331,
	slateblue: 6970061,
	slategray: 7372944,
	slategrey: 7372944,
	snow: 16775930,
	springgreen: 65407,
	steelblue: 4620980,
	tan: 13808780,
	teal: 32896,
	thistle: 14204888,
	tomato: 16737095,
	turquoise: 4251856,
	violet: 15631086,
	wheat: 16113331,
	white: 16777215,
	whitesmoke: 16119285,
	yellow: 16776960,
	yellowgreen: 10145074
};
define_default(Color, color, {
	copy(channels) {
		return Object.assign(new this.constructor(), this, channels);
	},
	displayable() {
		return this.rgb().displayable();
	},
	hex: color_formatHex,
	formatHex: color_formatHex,
	formatHex8: color_formatHex8,
	formatHsl: color_formatHsl,
	formatRgb: color_formatRgb,
	toString: color_formatRgb
});
function color_formatHex() {
	return this.rgb().formatHex();
}
function color_formatHex8() {
	return this.rgb().formatHex8();
}
function color_formatHsl() {
	return hslConvert(this).formatHsl();
}
function color_formatRgb() {
	return this.rgb().formatRgb();
}
function color(format$1) {
	var m$2, l;
	format$1 = (format$1 + "").trim().toLowerCase();
	return (m$2 = reHex.exec(format$1)) ? (l = m$2[1].length, m$2 = parseInt(m$2[1], 16), l === 6 ? rgbn(m$2) : l === 3 ? new Rgb(m$2 >> 8 & 15 | m$2 >> 4 & 240, m$2 >> 4 & 15 | m$2 & 240, (m$2 & 15) << 4 | m$2 & 15, 1) : l === 8 ? rgba(m$2 >> 24 & 255, m$2 >> 16 & 255, m$2 >> 8 & 255, (m$2 & 255) / 255) : l === 4 ? rgba(m$2 >> 12 & 15 | m$2 >> 8 & 240, m$2 >> 8 & 15 | m$2 >> 4 & 240, m$2 >> 4 & 15 | m$2 & 240, ((m$2 & 15) << 4 | m$2 & 15) / 255) : null) : (m$2 = reRgbInteger.exec(format$1)) ? new Rgb(m$2[1], m$2[2], m$2[3], 1) : (m$2 = reRgbPercent.exec(format$1)) ? new Rgb(m$2[1] * 255 / 100, m$2[2] * 255 / 100, m$2[3] * 255 / 100, 1) : (m$2 = reRgbaInteger.exec(format$1)) ? rgba(m$2[1], m$2[2], m$2[3], m$2[4]) : (m$2 = reRgbaPercent.exec(format$1)) ? rgba(m$2[1] * 255 / 100, m$2[2] * 255 / 100, m$2[3] * 255 / 100, m$2[4]) : (m$2 = reHslPercent.exec(format$1)) ? hsla(m$2[1], m$2[2] / 100, m$2[3] / 100, 1) : (m$2 = reHslaPercent.exec(format$1)) ? hsla(m$2[1], m$2[2] / 100, m$2[3] / 100, m$2[4]) : named.hasOwnProperty(format$1) ? rgbn(named[format$1]) : format$1 === "transparent" ? new Rgb(NaN, NaN, NaN, 0) : null;
}
function rgbn(n) {
	return new Rgb(n >> 16 & 255, n >> 8 & 255, n & 255, 1);
}
function rgba(r, g, b, a$3) {
	if (a$3 <= 0) r = g = b = NaN;
	return new Rgb(r, g, b, a$3);
}
function rgbConvert(o) {
	if (!(o instanceof Color)) o = color(o);
	if (!o) return new Rgb();
	o = o.rgb();
	return new Rgb(o.r, o.g, o.b, o.opacity);
}
function rgb(r, g, b, opacity) {
	return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
}
function Rgb(r, g, b, opacity) {
	this.r = +r;
	this.g = +g;
	this.b = +b;
	this.opacity = +opacity;
}
define_default(Rgb, rgb, extend(Color, {
	brighter(k$1) {
		k$1 = k$1 == null ? brighter : Math.pow(brighter, k$1);
		return new Rgb(this.r * k$1, this.g * k$1, this.b * k$1, this.opacity);
	},
	darker(k$1) {
		k$1 = k$1 == null ? darker : Math.pow(darker, k$1);
		return new Rgb(this.r * k$1, this.g * k$1, this.b * k$1, this.opacity);
	},
	rgb() {
		return this;
	},
	clamp() {
		return new Rgb(clampi(this.r), clampi(this.g), clampi(this.b), clampa(this.opacity));
	},
	displayable() {
		return -.5 <= this.r && this.r < 255.5 && -.5 <= this.g && this.g < 255.5 && -.5 <= this.b && this.b < 255.5 && 0 <= this.opacity && this.opacity <= 1;
	},
	hex: rgb_formatHex,
	formatHex: rgb_formatHex,
	formatHex8: rgb_formatHex8,
	formatRgb: rgb_formatRgb,
	toString: rgb_formatRgb
}));
function rgb_formatHex() {
	return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}`;
}
function rgb_formatHex8() {
	return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}${hex((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}
function rgb_formatRgb() {
	const a$3 = clampa(this.opacity);
	return `${a$3 === 1 ? "rgb(" : "rgba("}${clampi(this.r)}, ${clampi(this.g)}, ${clampi(this.b)}${a$3 === 1 ? ")" : `, ${a$3})`}`;
}
function clampa(opacity) {
	return isNaN(opacity) ? 1 : Math.max(0, Math.min(1, opacity));
}
function clampi(value) {
	return Math.max(0, Math.min(255, Math.round(value) || 0));
}
function hex(value) {
	value = clampi(value);
	return (value < 16 ? "0" : "") + value.toString(16);
}
function hsla(h, s$1, l, a$3) {
	if (a$3 <= 0) h = s$1 = l = NaN;
	else if (l <= 0 || l >= 1) h = s$1 = NaN;
	else if (s$1 <= 0) h = NaN;
	return new Hsl(h, s$1, l, a$3);
}
function hslConvert(o) {
	if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
	if (!(o instanceof Color)) o = color(o);
	if (!o) return new Hsl();
	if (o instanceof Hsl) return o;
	o = o.rgb();
	var r = o.r / 255, g = o.g / 255, b = o.b / 255, min$3 = Math.min(r, g, b), max$4 = Math.max(r, g, b), h = NaN, s$1 = max$4 - min$3, l = (max$4 + min$3) / 2;
	if (s$1) {
		if (r === max$4) h = (g - b) / s$1 + (g < b) * 6;
		else if (g === max$4) h = (b - r) / s$1 + 2;
		else h = (r - g) / s$1 + 4;
		s$1 /= l < .5 ? max$4 + min$3 : 2 - max$4 - min$3;
		h *= 60;
	} else s$1 = l > 0 && l < 1 ? 0 : h;
	return new Hsl(h, s$1, l, o.opacity);
}
function hsl(h, s$1, l, opacity) {
	return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s$1, l, opacity == null ? 1 : opacity);
}
function Hsl(h, s$1, l, opacity) {
	this.h = +h;
	this.s = +s$1;
	this.l = +l;
	this.opacity = +opacity;
}
define_default(Hsl, hsl, extend(Color, {
	brighter(k$1) {
		k$1 = k$1 == null ? brighter : Math.pow(brighter, k$1);
		return new Hsl(this.h, this.s, this.l * k$1, this.opacity);
	},
	darker(k$1) {
		k$1 = k$1 == null ? darker : Math.pow(darker, k$1);
		return new Hsl(this.h, this.s, this.l * k$1, this.opacity);
	},
	rgb() {
		var h = this.h % 360 + (this.h < 0) * 360, s$1 = isNaN(h) || isNaN(this.s) ? 0 : this.s, l = this.l, m2 = l + (l < .5 ? l : 1 - l) * s$1, m1 = 2 * l - m2;
		return new Rgb(hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2), hsl2rgb(h, m1, m2), hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2), this.opacity);
	},
	clamp() {
		return new Hsl(clamph(this.h), clampt(this.s), clampt(this.l), clampa(this.opacity));
	},
	displayable() {
		return (0 <= this.s && this.s <= 1 || isNaN(this.s)) && 0 <= this.l && this.l <= 1 && 0 <= this.opacity && this.opacity <= 1;
	},
	formatHsl() {
		const a$3 = clampa(this.opacity);
		return `${a$3 === 1 ? "hsl(" : "hsla("}${clamph(this.h)}, ${clampt(this.s) * 100}%, ${clampt(this.l) * 100}%${a$3 === 1 ? ")" : `, ${a$3})`}`;
	}
}));
function clamph(value) {
	value = (value || 0) % 360;
	return value < 0 ? value + 360 : value;
}
function clampt(value) {
	return Math.max(0, Math.min(1, value || 0));
}
function hsl2rgb(h, m1, m2) {
	return (h < 60 ? m1 + (m2 - m1) * h / 60 : h < 180 ? m2 : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60 : m1) * 255;
}

//#endregion
//#region node_modules/d3-color/src/math.js
const radians$1 = Math.PI / 180;
const degrees$2 = 180 / Math.PI;

//#endregion
//#region node_modules/d3-color/src/lab.js
var K = 18, Xn = .96422, Yn = 1, Zn = .82521, t0$1 = 4 / 29, t1$1 = 6 / 29, t2 = 3 * t1$1 * t1$1, t3 = t1$1 * t1$1 * t1$1;
function labConvert(o) {
	if (o instanceof Lab) return new Lab(o.l, o.a, o.b, o.opacity);
	if (o instanceof Hcl) return hcl2lab(o);
	if (!(o instanceof Rgb)) o = rgbConvert(o);
	var r = rgb2lrgb(o.r), g = rgb2lrgb(o.g), b = rgb2lrgb(o.b), y$3 = xyz2lab((.2225045 * r + .7168786 * g + .0606169 * b) / Yn), x$3, z;
	if (r === g && g === b) x$3 = z = y$3;
	else {
		x$3 = xyz2lab((.4360747 * r + .3850649 * g + .1430804 * b) / Xn);
		z = xyz2lab((.0139322 * r + .0971045 * g + .7141733 * b) / Zn);
	}
	return new Lab(116 * y$3 - 16, 500 * (x$3 - y$3), 200 * (y$3 - z), o.opacity);
}
function gray(l, opacity) {
	return new Lab(l, 0, 0, opacity == null ? 1 : opacity);
}
function lab$1(l, a$3, b, opacity) {
	return arguments.length === 1 ? labConvert(l) : new Lab(l, a$3, b, opacity == null ? 1 : opacity);
}
function Lab(l, a$3, b, opacity) {
	this.l = +l;
	this.a = +a$3;
	this.b = +b;
	this.opacity = +opacity;
}
define_default(Lab, lab$1, extend(Color, {
	brighter(k$1) {
		return new Lab(this.l + K * (k$1 == null ? 1 : k$1), this.a, this.b, this.opacity);
	},
	darker(k$1) {
		return new Lab(this.l - K * (k$1 == null ? 1 : k$1), this.a, this.b, this.opacity);
	},
	rgb() {
		var y$3 = (this.l + 16) / 116, x$3 = isNaN(this.a) ? y$3 : y$3 + this.a / 500, z = isNaN(this.b) ? y$3 : y$3 - this.b / 200;
		x$3 = Xn * lab2xyz(x$3);
		y$3 = Yn * lab2xyz(y$3);
		z = Zn * lab2xyz(z);
		return new Rgb(lrgb2rgb(3.1338561 * x$3 - 1.6168667 * y$3 - .4906146 * z), lrgb2rgb(-.9787684 * x$3 + 1.9161415 * y$3 + .033454 * z), lrgb2rgb(.0719453 * x$3 - .2289914 * y$3 + 1.4052427 * z), this.opacity);
	}
}));
function xyz2lab(t) {
	return t > t3 ? Math.pow(t, 1 / 3) : t / t2 + t0$1;
}
function lab2xyz(t) {
	return t > t1$1 ? t * t * t : t2 * (t - t0$1);
}
function lrgb2rgb(x$3) {
	return 255 * (x$3 <= .0031308 ? 12.92 * x$3 : 1.055 * Math.pow(x$3, 1 / 2.4) - .055);
}
function rgb2lrgb(x$3) {
	return (x$3 /= 255) <= .04045 ? x$3 / 12.92 : Math.pow((x$3 + .055) / 1.055, 2.4);
}
function hclConvert(o) {
	if (o instanceof Hcl) return new Hcl(o.h, o.c, o.l, o.opacity);
	if (!(o instanceof Lab)) o = labConvert(o);
	if (o.a === 0 && o.b === 0) return new Hcl(NaN, 0 < o.l && o.l < 100 ? 0 : NaN, o.l, o.opacity);
	var h = Math.atan2(o.b, o.a) * degrees$2;
	return new Hcl(h < 0 ? h + 360 : h, Math.sqrt(o.a * o.a + o.b * o.b), o.l, o.opacity);
}
function lch(l, c$5, h, opacity) {
	return arguments.length === 1 ? hclConvert(l) : new Hcl(h, c$5, l, opacity == null ? 1 : opacity);
}
function hcl(h, c$5, l, opacity) {
	return arguments.length === 1 ? hclConvert(h) : new Hcl(h, c$5, l, opacity == null ? 1 : opacity);
}
function Hcl(h, c$5, l, opacity) {
	this.h = +h;
	this.c = +c$5;
	this.l = +l;
	this.opacity = +opacity;
}
function hcl2lab(o) {
	if (isNaN(o.h)) return new Lab(o.l, 0, 0, o.opacity);
	var h = o.h * radians$1;
	return new Lab(o.l, Math.cos(h) * o.c, Math.sin(h) * o.c, o.opacity);
}
define_default(Hcl, hcl, extend(Color, {
	brighter(k$1) {
		return new Hcl(this.h, this.c, this.l + K * (k$1 == null ? 1 : k$1), this.opacity);
	},
	darker(k$1) {
		return new Hcl(this.h, this.c, this.l - K * (k$1 == null ? 1 : k$1), this.opacity);
	},
	rgb() {
		return hcl2lab(this).rgb();
	}
}));

//#endregion
//#region node_modules/d3-color/src/cubehelix.js
var A = -.14861, B$1 = 1.78277, C = -.29227, D$1 = -.90649, E = 1.97294, ED = E * D$1, EB = E * B$1, BC_DA = B$1 * C - D$1 * A;
function cubehelixConvert(o) {
	if (o instanceof Cubehelix) return new Cubehelix(o.h, o.s, o.l, o.opacity);
	if (!(o instanceof Rgb)) o = rgbConvert(o);
	var r = o.r / 255, g = o.g / 255, b = o.b / 255, l = (BC_DA * b + ED * r - EB * g) / (BC_DA + ED - EB), bl = b - l, k$1 = (E * (g - l) - C * bl) / D$1, s$1 = Math.sqrt(k$1 * k$1 + bl * bl) / (E * l * (1 - l)), h = s$1 ? Math.atan2(k$1, bl) * degrees$2 - 120 : NaN;
	return new Cubehelix(h < 0 ? h + 360 : h, s$1, l, o.opacity);
}
function cubehelix(h, s$1, l, opacity) {
	return arguments.length === 1 ? cubehelixConvert(h) : new Cubehelix(h, s$1, l, opacity == null ? 1 : opacity);
}
function Cubehelix(h, s$1, l, opacity) {
	this.h = +h;
	this.s = +s$1;
	this.l = +l;
	this.opacity = +opacity;
}
define_default(Cubehelix, cubehelix, extend(Color, {
	brighter(k$1) {
		k$1 = k$1 == null ? brighter : Math.pow(brighter, k$1);
		return new Cubehelix(this.h, this.s, this.l * k$1, this.opacity);
	},
	darker(k$1) {
		k$1 = k$1 == null ? darker : Math.pow(darker, k$1);
		return new Cubehelix(this.h, this.s, this.l * k$1, this.opacity);
	},
	rgb() {
		var h = isNaN(this.h) ? 0 : (this.h + 120) * radians$1, l = +this.l, a$3 = isNaN(this.s) ? 0 : this.s * l * (1 - l), cosh$1 = Math.cos(h), sinh$1 = Math.sin(h);
		return new Rgb(255 * (l + a$3 * (A * cosh$1 + B$1 * sinh$1)), 255 * (l + a$3 * (C * cosh$1 + D$1 * sinh$1)), 255 * (l + a$3 * (E * cosh$1)), this.opacity);
	}
}));

//#endregion
//#region node_modules/d3-interpolate/src/basis.js
function basis(t1$2, v0, v1, v2, v3) {
	var t2$1 = t1$2 * t1$2, t3$1 = t2$1 * t1$2;
	return ((1 - 3 * t1$2 + 3 * t2$1 - t3$1) * v0 + (4 - 6 * t2$1 + 3 * t3$1) * v1 + (1 + 3 * t1$2 + 3 * t2$1 - 3 * t3$1) * v2 + t3$1 * v3) / 6;
}
function basis_default$1(values) {
	var n = values.length - 1;
	return function(t) {
		var i = t <= 0 ? t = 0 : t >= 1 ? (t = 1, n - 1) : Math.floor(t * n), v1 = values[i], v2 = values[i + 1], v0 = i > 0 ? values[i - 1] : 2 * v1 - v2, v3 = i < n - 1 ? values[i + 2] : 2 * v2 - v1;
		return basis((t - i / n) * n, v0, v1, v2, v3);
	};
}

//#endregion
//#region node_modules/d3-interpolate/src/basisClosed.js
function basisClosed_default$1(values) {
	var n = values.length;
	return function(t) {
		var i = Math.floor(((t %= 1) < 0 ? ++t : t) * n), v0 = values[(i + n - 1) % n], v1 = values[i % n], v2 = values[(i + 1) % n], v3 = values[(i + 2) % n];
		return basis((t - i / n) * n, v0, v1, v2, v3);
	};
}

//#endregion
//#region node_modules/d3-interpolate/src/constant.js
var constant_default$8 = (x$3) => () => x$3;

//#endregion
//#region node_modules/d3-interpolate/src/color.js
function linear$2(a$3, d) {
	return function(t) {
		return a$3 + t * d;
	};
}
function exponential(a$3, b, y$3) {
	return a$3 = Math.pow(a$3, y$3), b = Math.pow(b, y$3) - a$3, y$3 = 1 / y$3, function(t) {
		return Math.pow(a$3 + t * b, y$3);
	};
}
function hue(a$3, b) {
	var d = b - a$3;
	return d ? linear$2(a$3, d > 180 || d < -180 ? d - 360 * Math.round(d / 360) : d) : constant_default$8(isNaN(a$3) ? b : a$3);
}
function gamma(y$3) {
	return (y$3 = +y$3) === 1 ? nogamma : function(a$3, b) {
		return b - a$3 ? exponential(a$3, b, y$3) : constant_default$8(isNaN(a$3) ? b : a$3);
	};
}
function nogamma(a$3, b) {
	var d = b - a$3;
	return d ? linear$2(a$3, d) : constant_default$8(isNaN(a$3) ? b : a$3);
}

//#endregion
//#region node_modules/d3-interpolate/src/rgb.js
var rgb_default = (function rgbGamma(y$3) {
	var color$1 = gamma(y$3);
	function rgb$1(start$1, end) {
		var r = color$1((start$1 = rgb(start$1)).r, (end = rgb(end)).r), g = color$1(start$1.g, end.g), b = color$1(start$1.b, end.b), opacity = nogamma(start$1.opacity, end.opacity);
		return function(t) {
			start$1.r = r(t);
			start$1.g = g(t);
			start$1.b = b(t);
			start$1.opacity = opacity(t);
			return start$1 + "";
		};
	}
	rgb$1.gamma = rgbGamma;
	return rgb$1;
})(1);
function rgbSpline(spline) {
	return function(colors) {
		var n = colors.length, r = new Array(n), g = new Array(n), b = new Array(n), i, color$1;
		for (i = 0; i < n; ++i) {
			color$1 = rgb(colors[i]);
			r[i] = color$1.r || 0;
			g[i] = color$1.g || 0;
			b[i] = color$1.b || 0;
		}
		r = spline(r);
		g = spline(g);
		b = spline(b);
		color$1.opacity = 1;
		return function(t) {
			color$1.r = r(t);
			color$1.g = g(t);
			color$1.b = b(t);
			return color$1 + "";
		};
	};
}
var rgbBasis = rgbSpline(basis_default$1);
var rgbBasisClosed = rgbSpline(basisClosed_default$1);

//#endregion
//#region node_modules/d3-interpolate/src/numberArray.js
function numberArray_default(a$3, b) {
	if (!b) b = [];
	var n = a$3 ? Math.min(b.length, a$3.length) : 0, c$5 = b.slice(), i;
	return function(t) {
		for (i = 0; i < n; ++i) c$5[i] = a$3[i] * (1 - t) + b[i] * t;
		return c$5;
	};
}
function isNumberArray(x$3) {
	return ArrayBuffer.isView(x$3) && !(x$3 instanceof DataView);
}

//#endregion
//#region node_modules/d3-interpolate/src/array.js
function array_default(a$3, b) {
	return (isNumberArray(b) ? numberArray_default : genericArray)(a$3, b);
}
function genericArray(a$3, b) {
	var nb = b ? b.length : 0, na = a$3 ? Math.min(nb, a$3.length) : 0, x$3 = new Array(na), c$5 = new Array(nb), i;
	for (i = 0; i < na; ++i) x$3[i] = value_default(a$3[i], b[i]);
	for (; i < nb; ++i) c$5[i] = b[i];
	return function(t) {
		for (i = 0; i < na; ++i) c$5[i] = x$3[i](t);
		return c$5;
	};
}

//#endregion
//#region node_modules/d3-interpolate/src/date.js
function date_default(a$3, b) {
	var d = /* @__PURE__ */ new Date();
	return a$3 = +a$3, b = +b, function(t) {
		return d.setTime(a$3 * (1 - t) + b * t), d;
	};
}

//#endregion
//#region node_modules/d3-interpolate/src/number.js
function number_default(a$3, b) {
	return a$3 = +a$3, b = +b, function(t) {
		return a$3 * (1 - t) + b * t;
	};
}

//#endregion
//#region node_modules/d3-interpolate/src/object.js
function object_default(a$3, b) {
	var i = {}, c$5 = {}, k$1;
	if (a$3 === null || typeof a$3 !== "object") a$3 = {};
	if (b === null || typeof b !== "object") b = {};
	for (k$1 in b) if (k$1 in a$3) i[k$1] = value_default(a$3[k$1], b[k$1]);
	else c$5[k$1] = b[k$1];
	return function(t) {
		for (k$1 in i) c$5[k$1] = i[k$1](t);
		return c$5;
	};
}

//#endregion
//#region node_modules/d3-interpolate/src/string.js
var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g, reB = new RegExp(reA.source, "g");
function zero(b) {
	return function() {
		return b;
	};
}
function one(b) {
	return function(t) {
		return b(t) + "";
	};
}
function string_default(a$3, b) {
	var bi = reA.lastIndex = reB.lastIndex = 0, am, bm, bs, i = -1, s$1 = [], q = [];
	a$3 = a$3 + "", b = b + "";
	while ((am = reA.exec(a$3)) && (bm = reB.exec(b))) {
		if ((bs = bm.index) > bi) {
			bs = b.slice(bi, bs);
			if (s$1[i]) s$1[i] += bs;
			else s$1[++i] = bs;
		}
		if ((am = am[0]) === (bm = bm[0])) if (s$1[i]) s$1[i] += bm;
		else s$1[++i] = bm;
		else {
			s$1[++i] = null;
			q.push({
				i,
				x: number_default(am, bm)
			});
		}
		bi = reB.lastIndex;
	}
	if (bi < b.length) {
		bs = b.slice(bi);
		if (s$1[i]) s$1[i] += bs;
		else s$1[++i] = bs;
	}
	return s$1.length < 2 ? q[0] ? one(q[0].x) : zero(b) : (b = q.length, function(t) {
		for (var i$1 = 0, o; i$1 < b; ++i$1) s$1[(o = q[i$1]).i] = o.x(t);
		return s$1.join("");
	});
}

//#endregion
//#region node_modules/d3-interpolate/src/value.js
function value_default(a$3, b) {
	var t = typeof b, c$5;
	return b == null || t === "boolean" ? constant_default$8(b) : (t === "number" ? number_default : t === "string" ? (c$5 = color(b)) ? (b = c$5, rgb_default) : string_default : b instanceof color ? rgb_default : b instanceof Date ? date_default : isNumberArray(b) ? numberArray_default : Array.isArray(b) ? genericArray : typeof b.valueOf !== "function" && typeof b.toString !== "function" || isNaN(b) ? object_default : number_default)(a$3, b);
}

//#endregion
//#region node_modules/d3-interpolate/src/discrete.js
function discrete_default(range$3) {
	var n = range$3.length;
	return function(t) {
		return range$3[Math.max(0, Math.min(n - 1, Math.floor(t * n)))];
	};
}

//#endregion
//#region node_modules/d3-interpolate/src/hue.js
function hue_default(a$3, b) {
	var i = hue(+a$3, +b);
	return function(t) {
		var x$3 = i(t);
		return x$3 - 360 * Math.floor(x$3 / 360);
	};
}

//#endregion
//#region node_modules/d3-interpolate/src/round.js
function round_default(a$3, b) {
	return a$3 = +a$3, b = +b, function(t) {
		return Math.round(a$3 * (1 - t) + b * t);
	};
}

//#endregion
//#region node_modules/d3-interpolate/src/transform/decompose.js
var degrees$1 = 180 / Math.PI;
var identity$3 = {
	translateX: 0,
	translateY: 0,
	rotate: 0,
	skewX: 0,
	scaleX: 1,
	scaleY: 1
};
function decompose_default(a$3, b, c$5, d, e, f) {
	var scaleX, scaleY, skewX;
	if (scaleX = Math.sqrt(a$3 * a$3 + b * b)) a$3 /= scaleX, b /= scaleX;
	if (skewX = a$3 * c$5 + b * d) c$5 -= a$3 * skewX, d -= b * skewX;
	if (scaleY = Math.sqrt(c$5 * c$5 + d * d)) c$5 /= scaleY, d /= scaleY, skewX /= scaleY;
	if (a$3 * d < b * c$5) a$3 = -a$3, b = -b, skewX = -skewX, scaleX = -scaleX;
	return {
		translateX: e,
		translateY: f,
		rotate: Math.atan2(b, a$3) * degrees$1,
		skewX: Math.atan(skewX) * degrees$1,
		scaleX,
		scaleY
	};
}

//#endregion
//#region node_modules/d3-interpolate/src/transform/parse.js
var svgNode;
function parseCss(value) {
	const m$2 = new (typeof DOMMatrix === "function" ? DOMMatrix : WebKitCSSMatrix)(value + "");
	return m$2.isIdentity ? identity$3 : decompose_default(m$2.a, m$2.b, m$2.c, m$2.d, m$2.e, m$2.f);
}
function parseSvg(value) {
	if (value == null) return identity$3;
	if (!svgNode) svgNode = document.createElementNS("http://www.w3.org/2000/svg", "g");
	svgNode.setAttribute("transform", value);
	if (!(value = svgNode.transform.baseVal.consolidate())) return identity$3;
	value = value.matrix;
	return decompose_default(value.a, value.b, value.c, value.d, value.e, value.f);
}

//#endregion
//#region node_modules/d3-interpolate/src/transform/index.js
function interpolateTransform(parse, pxComma, pxParen, degParen) {
	function pop(s$1) {
		return s$1.length ? s$1.pop() + " " : "";
	}
	function translate(xa, ya, xb, yb, s$1, q) {
		if (xa !== xb || ya !== yb) {
			var i = s$1.push("translate(", null, pxComma, null, pxParen);
			q.push({
				i: i - 4,
				x: number_default(xa, xb)
			}, {
				i: i - 2,
				x: number_default(ya, yb)
			});
		} else if (xb || yb) s$1.push("translate(" + xb + pxComma + yb + pxParen);
	}
	function rotate(a$3, b, s$1, q) {
		if (a$3 !== b) {
			if (a$3 - b > 180) b += 360;
			else if (b - a$3 > 180) a$3 += 360;
			q.push({
				i: s$1.push(pop(s$1) + "rotate(", null, degParen) - 2,
				x: number_default(a$3, b)
			});
		} else if (b) s$1.push(pop(s$1) + "rotate(" + b + degParen);
	}
	function skewX(a$3, b, s$1, q) {
		if (a$3 !== b) q.push({
			i: s$1.push(pop(s$1) + "skewX(", null, degParen) - 2,
			x: number_default(a$3, b)
		});
		else if (b) s$1.push(pop(s$1) + "skewX(" + b + degParen);
	}
	function scale$1(xa, ya, xb, yb, s$1, q) {
		if (xa !== xb || ya !== yb) {
			var i = s$1.push(pop(s$1) + "scale(", null, ",", null, ")");
			q.push({
				i: i - 4,
				x: number_default(xa, xb)
			}, {
				i: i - 2,
				x: number_default(ya, yb)
			});
		} else if (xb !== 1 || yb !== 1) s$1.push(pop(s$1) + "scale(" + xb + "," + yb + ")");
	}
	return function(a$3, b) {
		var s$1 = [], q = [];
		a$3 = parse(a$3), b = parse(b);
		translate(a$3.translateX, a$3.translateY, b.translateX, b.translateY, s$1, q);
		rotate(a$3.rotate, b.rotate, s$1, q);
		skewX(a$3.skewX, b.skewX, s$1, q);
		scale$1(a$3.scaleX, a$3.scaleY, b.scaleX, b.scaleY, s$1, q);
		a$3 = b = null;
		return function(t) {
			var i = -1, n = q.length, o;
			while (++i < n) s$1[(o = q[i]).i] = o.x(t);
			return s$1.join("");
		};
	};
}
var interpolateTransformCss = interpolateTransform(parseCss, "px, ", "px)", "deg)");
var interpolateTransformSvg = interpolateTransform(parseSvg, ", ", ")", ")");

//#endregion
//#region node_modules/d3-interpolate/src/zoom.js
var epsilon2$1 = 1e-12;
function cosh(x$3) {
	return ((x$3 = Math.exp(x$3)) + 1 / x$3) / 2;
}
function sinh(x$3) {
	return ((x$3 = Math.exp(x$3)) - 1 / x$3) / 2;
}
function tanh(x$3) {
	return ((x$3 = Math.exp(2 * x$3)) - 1) / (x$3 + 1);
}
var zoom_default = (function zoomRho(rho, rho2, rho4) {
	function zoom(p0$1, p1) {
		var ux0 = p0$1[0], uy0 = p0$1[1], w0 = p0$1[2], ux1 = p1[0], uy1 = p1[1], w1 = p1[2], dx = ux1 - ux0, dy = uy1 - uy0, d2 = dx * dx + dy * dy, i, S;
		if (d2 < epsilon2$1) {
			S = Math.log(w1 / w0) / rho;
			i = function(t) {
				return [
					ux0 + t * dx,
					uy0 + t * dy,
					w0 * Math.exp(rho * t * S)
				];
			};
		} else {
			var d1 = Math.sqrt(d2), b0$1 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1), b1$1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1), r0 = Math.log(Math.sqrt(b0$1 * b0$1 + 1) - b0$1);
			S = (Math.log(Math.sqrt(b1$1 * b1$1 + 1) - b1$1) - r0) / rho;
			i = function(t) {
				var s$1 = t * S, coshr0 = cosh(r0), u$3 = w0 / (rho2 * d1) * (coshr0 * tanh(rho * s$1 + r0) - sinh(r0));
				return [
					ux0 + u$3 * dx,
					uy0 + u$3 * dy,
					w0 * coshr0 / cosh(rho * s$1 + r0)
				];
			};
		}
		i.duration = S * 1e3 * rho / Math.SQRT2;
		return i;
	}
	zoom.rho = function(_) {
		var _1 = Math.max(.001, +_), _2 = _1 * _1, _4 = _2 * _2;
		return zoomRho(_1, _2, _4);
	};
	return zoom;
})(Math.SQRT2, 2, 4);

//#endregion
//#region node_modules/d3-interpolate/src/hsl.js
function hsl$1(hue$1) {
	return function(start$1, end) {
		var h = hue$1((start$1 = hsl(start$1)).h, (end = hsl(end)).h), s$1 = nogamma(start$1.s, end.s), l = nogamma(start$1.l, end.l), opacity = nogamma(start$1.opacity, end.opacity);
		return function(t) {
			start$1.h = h(t);
			start$1.s = s$1(t);
			start$1.l = l(t);
			start$1.opacity = opacity(t);
			return start$1 + "";
		};
	};
}
var hsl_default = hsl$1(hue);
var hslLong = hsl$1(nogamma);

//#endregion
//#region node_modules/d3-interpolate/src/lab.js
function lab(start$1, end) {
	var l = nogamma((start$1 = lab$1(start$1)).l, (end = lab$1(end)).l), a$3 = nogamma(start$1.a, end.a), b = nogamma(start$1.b, end.b), opacity = nogamma(start$1.opacity, end.opacity);
	return function(t) {
		start$1.l = l(t);
		start$1.a = a$3(t);
		start$1.b = b(t);
		start$1.opacity = opacity(t);
		return start$1 + "";
	};
}

//#endregion
//#region node_modules/d3-interpolate/src/hcl.js
function hcl$1(hue$1) {
	return function(start$1, end) {
		var h = hue$1((start$1 = hcl(start$1)).h, (end = hcl(end)).h), c$5 = nogamma(start$1.c, end.c), l = nogamma(start$1.l, end.l), opacity = nogamma(start$1.opacity, end.opacity);
		return function(t) {
			start$1.h = h(t);
			start$1.c = c$5(t);
			start$1.l = l(t);
			start$1.opacity = opacity(t);
			return start$1 + "";
		};
	};
}
var hcl_default = hcl$1(hue);
var hclLong = hcl$1(nogamma);

//#endregion
//#region node_modules/d3-interpolate/src/cubehelix.js
function cubehelix$1(hue$1) {
	return (function cubehelixGamma(y$3) {
		y$3 = +y$3;
		function cubehelix$2(start$1, end) {
			var h = hue$1((start$1 = cubehelix(start$1)).h, (end = cubehelix(end)).h), s$1 = nogamma(start$1.s, end.s), l = nogamma(start$1.l, end.l), opacity = nogamma(start$1.opacity, end.opacity);
			return function(t) {
				start$1.h = h(t);
				start$1.s = s$1(t);
				start$1.l = l(Math.pow(t, y$3));
				start$1.opacity = opacity(t);
				return start$1 + "";
			};
		}
		cubehelix$2.gamma = cubehelixGamma;
		return cubehelix$2;
	})(1);
}
var cubehelix_default = cubehelix$1(hue);
var cubehelixLong = cubehelix$1(nogamma);

//#endregion
//#region node_modules/d3-interpolate/src/piecewise.js
function piecewise(interpolate, values) {
	if (values === void 0) values = interpolate, interpolate = value_default;
	var i = 0, n = values.length - 1, v$1 = values[0], I = new Array(n < 0 ? 0 : n);
	while (i < n) I[i] = interpolate(v$1, v$1 = values[++i]);
	return function(t) {
		var i$1 = Math.max(0, Math.min(n - 1, Math.floor(t *= n)));
		return I[i$1](t - i$1);
	};
}

//#endregion
//#region node_modules/d3-interpolate/src/quantize.js
function quantize_default(interpolator, n) {
	var samples = new Array(n);
	for (var i = 0; i < n; ++i) samples[i] = interpolator(i / (n - 1));
	return samples;
}

//#endregion
//#region node_modules/d3-timer/src/timer.js
var frame = 0, timeout = 0, interval = 0, pokeDelay = 1e3, taskHead, taskTail, clockLast = 0, clockNow = 0, clockSkew = 0, clock = typeof performance === "object" && performance.now ? performance : Date, setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) {
	setTimeout(f, 17);
};
function now() {
	return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
}
function clearNow() {
	clockNow = 0;
}
function Timer() {
	this._call = this._time = this._next = null;
}
Timer.prototype = timer.prototype = {
	constructor: Timer,
	restart: function(callback, delay, time$1) {
		if (typeof callback !== "function") throw new TypeError("callback is not a function");
		time$1 = (time$1 == null ? now() : +time$1) + (delay == null ? 0 : +delay);
		if (!this._next && taskTail !== this) {
			if (taskTail) taskTail._next = this;
			else taskHead = this;
			taskTail = this;
		}
		this._call = callback;
		this._time = time$1;
		sleep();
	},
	stop: function() {
		if (this._call) {
			this._call = null;
			this._time = Infinity;
			sleep();
		}
	}
};
function timer(callback, delay, time$1) {
	var t = new Timer();
	t.restart(callback, delay, time$1);
	return t;
}
function timerFlush() {
	now();
	++frame;
	var t = taskHead, e;
	while (t) {
		if ((e = clockNow - t._time) >= 0) t._call.call(void 0, e);
		t = t._next;
	}
	--frame;
}
function wake() {
	clockNow = (clockLast = clock.now()) + clockSkew;
	frame = timeout = 0;
	try {
		timerFlush();
	} finally {
		frame = 0;
		nap();
		clockNow = 0;
	}
}
function poke() {
	var now$1 = clock.now(), delay = now$1 - clockLast;
	if (delay > pokeDelay) clockSkew -= delay, clockLast = now$1;
}
function nap() {
	var t0$2, t1$2 = taskHead, t2$1, time$1 = Infinity;
	while (t1$2) if (t1$2._call) {
		if (time$1 > t1$2._time) time$1 = t1$2._time;
		t0$2 = t1$2, t1$2 = t1$2._next;
	} else {
		t2$1 = t1$2._next, t1$2._next = null;
		t1$2 = t0$2 ? t0$2._next = t2$1 : taskHead = t2$1;
	}
	taskTail = t0$2;
	sleep(time$1);
}
function sleep(time$1) {
	if (frame) return;
	if (timeout) timeout = clearTimeout(timeout);
	if (time$1 - clockNow > 24) {
		if (time$1 < Infinity) timeout = setTimeout(wake, time$1 - clock.now() - clockSkew);
		if (interval) interval = clearInterval(interval);
	} else {
		if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
		frame = 1, setFrame(wake);
	}
}

//#endregion
//#region node_modules/d3-timer/src/timeout.js
function timeout_default(callback, delay, time$1) {
	var t = new Timer();
	delay = delay == null ? 0 : +delay;
	t.restart((elapsed) => {
		t.stop();
		callback(elapsed + delay);
	}, delay, time$1);
	return t;
}

//#endregion
//#region node_modules/d3-timer/src/interval.js
function interval_default(callback, delay, time$1) {
	var t = new Timer(), total = delay;
	if (delay == null) return t.restart(callback, delay, time$1), t;
	t._restart = t.restart;
	t.restart = function(callback$1, delay$1, time$2) {
		delay$1 = +delay$1, time$2 = time$2 == null ? now() : +time$2;
		t._restart(function tick(elapsed) {
			elapsed += total;
			t._restart(tick, total += delay$1, time$2);
			callback$1(elapsed);
		}, delay$1, time$2);
	};
	t.restart(callback, delay, time$1);
	return t;
}

//#endregion
//#region node_modules/d3-transition/src/transition/schedule.js
var emptyOn = dispatch_default("start", "end", "cancel", "interrupt");
var emptyTween = [];
var CREATED = 0;
var SCHEDULED = 1;
var STARTING = 2;
var STARTED = 3;
var RUNNING = 4;
var ENDING = 5;
var ENDED = 6;
function schedule_default(node, name, id$1, index$2, group$1, timing) {
	var schedules = node.__transition;
	if (!schedules) node.__transition = {};
	else if (id$1 in schedules) return;
	create(node, id$1, {
		name,
		index: index$2,
		group: group$1,
		on: emptyOn,
		tween: emptyTween,
		time: timing.time,
		delay: timing.delay,
		duration: timing.duration,
		ease: timing.ease,
		timer: null,
		state: CREATED
	});
}
function init(node, id$1) {
	var schedule = get(node, id$1);
	if (schedule.state > CREATED) throw new Error("too late; already scheduled");
	return schedule;
}
function set(node, id$1) {
	var schedule = get(node, id$1);
	if (schedule.state > STARTED) throw new Error("too late; already running");
	return schedule;
}
function get(node, id$1) {
	var schedule = node.__transition;
	if (!schedule || !(schedule = schedule[id$1])) throw new Error("transition not found");
	return schedule;
}
function create(node, id$1, self) {
	var schedules = node.__transition, tween;
	schedules[id$1] = self;
	self.timer = timer(schedule, 0, self.time);
	function schedule(elapsed) {
		self.state = SCHEDULED;
		self.timer.restart(start$1, self.delay, self.time);
		if (self.delay <= elapsed) start$1(elapsed - self.delay);
	}
	function start$1(elapsed) {
		var i, j, n, o;
		if (self.state !== SCHEDULED) return stop();
		for (i in schedules) {
			o = schedules[i];
			if (o.name !== self.name) continue;
			if (o.state === STARTED) return timeout_default(start$1);
			if (o.state === RUNNING) {
				o.state = ENDED;
				o.timer.stop();
				o.on.call("interrupt", node, node.__data__, o.index, o.group);
				delete schedules[i];
			} else if (+i < id$1) {
				o.state = ENDED;
				o.timer.stop();
				o.on.call("cancel", node, node.__data__, o.index, o.group);
				delete schedules[i];
			}
		}
		timeout_default(function() {
			if (self.state === STARTED) {
				self.state = RUNNING;
				self.timer.restart(tick, self.delay, self.time);
				tick(elapsed);
			}
		});
		self.state = STARTING;
		self.on.call("start", node, node.__data__, self.index, self.group);
		if (self.state !== STARTING) return;
		self.state = STARTED;
		tween = new Array(n = self.tween.length);
		for (i = 0, j = -1; i < n; ++i) if (o = self.tween[i].value.call(node, node.__data__, self.index, self.group)) tween[++j] = o;
		tween.length = j + 1;
	}
	function tick(elapsed) {
		var t = elapsed < self.duration ? self.ease.call(null, elapsed / self.duration) : (self.timer.restart(stop), self.state = ENDING, 1), i = -1, n = tween.length;
		while (++i < n) tween[i].call(node, t);
		if (self.state === ENDING) {
			self.on.call("end", node, node.__data__, self.index, self.group);
			stop();
		}
	}
	function stop() {
		self.state = ENDED;
		self.timer.stop();
		delete schedules[id$1];
		for (var i in schedules) return;
		delete node.__transition;
	}
}

//#endregion
//#region node_modules/d3-transition/src/interrupt.js
function interrupt_default(node, name) {
	var schedules = node.__transition, schedule, active, empty$3 = true, i;
	if (!schedules) return;
	name = name == null ? null : name + "";
	for (i in schedules) {
		if ((schedule = schedules[i]).name !== name) {
			empty$3 = false;
			continue;
		}
		active = schedule.state > STARTING && schedule.state < ENDING;
		schedule.state = ENDED;
		schedule.timer.stop();
		schedule.on.call(active ? "interrupt" : "cancel", node, node.__data__, schedule.index, schedule.group);
		delete schedules[i];
	}
	if (empty$3) delete node.__transition;
}

//#endregion
//#region node_modules/d3-transition/src/selection/interrupt.js
function interrupt_default$1(name) {
	return this.each(function() {
		interrupt_default(this, name);
	});
}

//#endregion
//#region node_modules/d3-transition/src/transition/tween.js
function tweenRemove(id$1, name) {
	var tween0, tween1;
	return function() {
		var schedule = set(this, id$1), tween = schedule.tween;
		if (tween !== tween0) {
			tween1 = tween0 = tween;
			for (var i = 0, n = tween1.length; i < n; ++i) if (tween1[i].name === name) {
				tween1 = tween1.slice();
				tween1.splice(i, 1);
				break;
			}
		}
		schedule.tween = tween1;
	};
}
function tweenFunction(id$1, name, value) {
	var tween0, tween1;
	if (typeof value !== "function") throw new Error();
	return function() {
		var schedule = set(this, id$1), tween = schedule.tween;
		if (tween !== tween0) {
			tween1 = (tween0 = tween).slice();
			for (var t = {
				name,
				value
			}, i = 0, n = tween1.length; i < n; ++i) if (tween1[i].name === name) {
				tween1[i] = t;
				break;
			}
			if (i === n) tween1.push(t);
		}
		schedule.tween = tween1;
	};
}
function tween_default(name, value) {
	var id$1 = this._id;
	name += "";
	if (arguments.length < 2) {
		var tween = get(this.node(), id$1).tween;
		for (var i = 0, n = tween.length, t; i < n; ++i) if ((t = tween[i]).name === name) return t.value;
		return null;
	}
	return this.each((value == null ? tweenRemove : tweenFunction)(id$1, name, value));
}
function tweenValue(transition$1, name, value) {
	var id$1 = transition$1._id;
	transition$1.each(function() {
		var schedule = set(this, id$1);
		(schedule.value || (schedule.value = {}))[name] = value.apply(this, arguments);
	});
	return function(node) {
		return get(node, id$1).value[name];
	};
}

//#endregion
//#region node_modules/d3-transition/src/transition/interpolate.js
function interpolate_default$1(a$3, b) {
	var c$5;
	return (typeof b === "number" ? number_default : b instanceof color ? rgb_default : (c$5 = color(b)) ? (b = c$5, rgb_default) : string_default)(a$3, b);
}

//#endregion
//#region node_modules/d3-transition/src/transition/attr.js
function attrRemove(name) {
	return function() {
		this.removeAttribute(name);
	};
}
function attrRemoveNS(fullname) {
	return function() {
		this.removeAttributeNS(fullname.space, fullname.local);
	};
}
function attrConstant(name, interpolate, value1) {
	var string00, string1 = value1 + "", interpolate0;
	return function() {
		var string0 = this.getAttribute(name);
		return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
	};
}
function attrConstantNS(fullname, interpolate, value1) {
	var string00, string1 = value1 + "", interpolate0;
	return function() {
		var string0 = this.getAttributeNS(fullname.space, fullname.local);
		return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
	};
}
function attrFunction(name, interpolate, value) {
	var string00, string10, interpolate0;
	return function() {
		var string0, value1 = value(this), string1;
		if (value1 == null) return void this.removeAttribute(name);
		string0 = this.getAttribute(name);
		string1 = value1 + "";
		return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
	};
}
function attrFunctionNS(fullname, interpolate, value) {
	var string00, string10, interpolate0;
	return function() {
		var string0, value1 = value(this), string1;
		if (value1 == null) return void this.removeAttributeNS(fullname.space, fullname.local);
		string0 = this.getAttributeNS(fullname.space, fullname.local);
		string1 = value1 + "";
		return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
	};
}
function attr_default(name, value) {
	var fullname = namespace_default(name), i = fullname === "transform" ? interpolateTransformSvg : interpolate_default$1;
	return this.attrTween(name, typeof value === "function" ? (fullname.local ? attrFunctionNS : attrFunction)(fullname, i, tweenValue(this, "attr." + name, value)) : value == null ? (fullname.local ? attrRemoveNS : attrRemove)(fullname) : (fullname.local ? attrConstantNS : attrConstant)(fullname, i, value));
}

//#endregion
//#region node_modules/d3-transition/src/transition/attrTween.js
function attrInterpolate(name, i) {
	return function(t) {
		this.setAttribute(name, i.call(this, t));
	};
}
function attrInterpolateNS(fullname, i) {
	return function(t) {
		this.setAttributeNS(fullname.space, fullname.local, i.call(this, t));
	};
}
function attrTweenNS(fullname, value) {
	var t0$2, i0;
	function tween() {
		var i = value.apply(this, arguments);
		if (i !== i0) t0$2 = (i0 = i) && attrInterpolateNS(fullname, i);
		return t0$2;
	}
	tween._value = value;
	return tween;
}
function attrTween(name, value) {
	var t0$2, i0;
	function tween() {
		var i = value.apply(this, arguments);
		if (i !== i0) t0$2 = (i0 = i) && attrInterpolate(name, i);
		return t0$2;
	}
	tween._value = value;
	return tween;
}
function attrTween_default(name, value) {
	var key = "attr." + name;
	if (arguments.length < 2) return (key = this.tween(key)) && key._value;
	if (value == null) return this.tween(key, null);
	if (typeof value !== "function") throw new Error();
	var fullname = namespace_default(name);
	return this.tween(key, (fullname.local ? attrTweenNS : attrTween)(fullname, value));
}

//#endregion
//#region node_modules/d3-transition/src/transition/delay.js
function delayFunction(id$1, value) {
	return function() {
		init(this, id$1).delay = +value.apply(this, arguments);
	};
}
function delayConstant(id$1, value) {
	return value = +value, function() {
		init(this, id$1).delay = value;
	};
}
function delay_default(value) {
	var id$1 = this._id;
	return arguments.length ? this.each((typeof value === "function" ? delayFunction : delayConstant)(id$1, value)) : get(this.node(), id$1).delay;
}

//#endregion
//#region node_modules/d3-transition/src/transition/duration.js
function durationFunction(id$1, value) {
	return function() {
		set(this, id$1).duration = +value.apply(this, arguments);
	};
}
function durationConstant(id$1, value) {
	return value = +value, function() {
		set(this, id$1).duration = value;
	};
}
function duration_default(value) {
	var id$1 = this._id;
	return arguments.length ? this.each((typeof value === "function" ? durationFunction : durationConstant)(id$1, value)) : get(this.node(), id$1).duration;
}

//#endregion
//#region node_modules/d3-transition/src/transition/ease.js
function easeConstant(id$1, value) {
	if (typeof value !== "function") throw new Error();
	return function() {
		set(this, id$1).ease = value;
	};
}
function ease_default(value) {
	var id$1 = this._id;
	return arguments.length ? this.each(easeConstant(id$1, value)) : get(this.node(), id$1).ease;
}

//#endregion
//#region node_modules/d3-transition/src/transition/easeVarying.js
function easeVarying(id$1, value) {
	return function() {
		var v$1 = value.apply(this, arguments);
		if (typeof v$1 !== "function") throw new Error();
		set(this, id$1).ease = v$1;
	};
}
function easeVarying_default(value) {
	if (typeof value !== "function") throw new Error();
	return this.each(easeVarying(this._id, value));
}

//#endregion
//#region node_modules/d3-transition/src/transition/filter.js
function filter_default(match) {
	if (typeof match !== "function") match = matcher_default(match);
	for (var groups$1 = this._groups, m$2 = groups$1.length, subgroups = new Array(m$2), j = 0; j < m$2; ++j) for (var group$1 = groups$1[j], n = group$1.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) if ((node = group$1[i]) && match.call(node, node.__data__, i, group$1)) subgroup.push(node);
	return new Transition(subgroups, this._parents, this._name, this._id);
}

//#endregion
//#region node_modules/d3-transition/src/transition/merge.js
function merge_default(transition$1) {
	if (transition$1._id !== this._id) throw new Error();
	for (var groups0 = this._groups, groups1 = transition$1._groups, m0 = groups0.length, m1 = groups1.length, m$2 = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m$2; ++j) for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge$1 = merges[j] = new Array(n), node, i = 0; i < n; ++i) if (node = group0[i] || group1[i]) merge$1[i] = node;
	for (; j < m0; ++j) merges[j] = groups0[j];
	return new Transition(merges, this._parents, this._name, this._id);
}

//#endregion
//#region node_modules/d3-transition/src/transition/on.js
function start(name) {
	return (name + "").trim().split(/^|\s+/).every(function(t) {
		var i = t.indexOf(".");
		if (i >= 0) t = t.slice(0, i);
		return !t || t === "start";
	});
}
function onFunction(id$1, name, listener) {
	var on0, on1, sit = start(name) ? init : set;
	return function() {
		var schedule = sit(this, id$1), on = schedule.on;
		if (on !== on0) (on1 = (on0 = on).copy()).on(name, listener);
		schedule.on = on1;
	};
}
function on_default(name, listener) {
	var id$1 = this._id;
	return arguments.length < 2 ? get(this.node(), id$1).on.on(name) : this.each(onFunction(id$1, name, listener));
}

//#endregion
//#region node_modules/d3-transition/src/transition/remove.js
function removeFunction(id$1) {
	return function() {
		var parent = this.parentNode;
		for (var i in this.__transition) if (+i !== id$1) return;
		if (parent) parent.removeChild(this);
	};
}
function remove_default$1() {
	return this.on("end.remove", removeFunction(this._id));
}

//#endregion
//#region node_modules/d3-transition/src/transition/select.js
function select_default$1(select) {
	var name = this._name, id$1 = this._id;
	if (typeof select !== "function") select = selector_default(select);
	for (var groups$1 = this._groups, m$2 = groups$1.length, subgroups = new Array(m$2), j = 0; j < m$2; ++j) for (var group$1 = groups$1[j], n = group$1.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) if ((node = group$1[i]) && (subnode = select.call(node, node.__data__, i, group$1))) {
		if ("__data__" in node) subnode.__data__ = node.__data__;
		subgroup[i] = subnode;
		schedule_default(subgroup[i], name, id$1, i, subgroup, get(node, id$1));
	}
	return new Transition(subgroups, this._parents, name, id$1);
}

//#endregion
//#region node_modules/d3-transition/src/transition/selectAll.js
function selectAll_default$1(select) {
	var name = this._name, id$1 = this._id;
	if (typeof select !== "function") select = selectorAll_default(select);
	for (var groups$1 = this._groups, m$2 = groups$1.length, subgroups = [], parents = [], j = 0; j < m$2; ++j) for (var group$1 = groups$1[j], n = group$1.length, node, i = 0; i < n; ++i) if (node = group$1[i]) {
		for (var children$1 = select.call(node, node.__data__, i, group$1), child, inherit$1 = get(node, id$1), k$1 = 0, l = children$1.length; k$1 < l; ++k$1) if (child = children$1[k$1]) schedule_default(child, name, id$1, k$1, children$1, inherit$1);
		subgroups.push(children$1);
		parents.push(node);
	}
	return new Transition(subgroups, parents, name, id$1);
}

//#endregion
//#region node_modules/d3-transition/src/transition/selection.js
var Selection = selection_default.prototype.constructor;
function selection_default$1() {
	return new Selection(this._groups, this._parents);
}

//#endregion
//#region node_modules/d3-transition/src/transition/style.js
function styleNull(name, interpolate) {
	var string00, string10, interpolate0;
	return function() {
		var string0 = styleValue(this, name), string1 = (this.style.removeProperty(name), styleValue(this, name));
		return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : interpolate0 = interpolate(string00 = string0, string10 = string1);
	};
}
function styleRemove(name) {
	return function() {
		this.style.removeProperty(name);
	};
}
function styleConstant(name, interpolate, value1) {
	var string00, string1 = value1 + "", interpolate0;
	return function() {
		var string0 = styleValue(this, name);
		return string0 === string1 ? null : string0 === string00 ? interpolate0 : interpolate0 = interpolate(string00 = string0, value1);
	};
}
function styleFunction(name, interpolate, value) {
	var string00, string10, interpolate0;
	return function() {
		var string0 = styleValue(this, name), value1 = value(this), string1 = value1 + "";
		if (value1 == null) string1 = value1 = (this.style.removeProperty(name), styleValue(this, name));
		return string0 === string1 ? null : string0 === string00 && string1 === string10 ? interpolate0 : (string10 = string1, interpolate0 = interpolate(string00 = string0, value1));
	};
}
function styleMaybeRemove(id$1, name) {
	var on0, on1, listener0, key = "style." + name, event = "end." + key, remove$1;
	return function() {
		var schedule = set(this, id$1), on = schedule.on, listener = schedule.value[key] == null ? remove$1 || (remove$1 = styleRemove(name)) : void 0;
		if (on !== on0 || listener0 !== listener) (on1 = (on0 = on).copy()).on(event, listener0 = listener);
		schedule.on = on1;
	};
}
function style_default(name, value, priority) {
	var i = (name += "") === "transform" ? interpolateTransformCss : interpolate_default$1;
	return value == null ? this.styleTween(name, styleNull(name, i)).on("end.style." + name, styleRemove(name)) : typeof value === "function" ? this.styleTween(name, styleFunction(name, i, tweenValue(this, "style." + name, value))).each(styleMaybeRemove(this._id, name)) : this.styleTween(name, styleConstant(name, i, value), priority).on("end.style." + name, null);
}

//#endregion
//#region node_modules/d3-transition/src/transition/styleTween.js
function styleInterpolate(name, i, priority) {
	return function(t) {
		this.style.setProperty(name, i.call(this, t), priority);
	};
}
function styleTween(name, value, priority) {
	var t, i0;
	function tween() {
		var i = value.apply(this, arguments);
		if (i !== i0) t = (i0 = i) && styleInterpolate(name, i, priority);
		return t;
	}
	tween._value = value;
	return tween;
}
function styleTween_default(name, value, priority) {
	var key = "style." + (name += "");
	if (arguments.length < 2) return (key = this.tween(key)) && key._value;
	if (value == null) return this.tween(key, null);
	if (typeof value !== "function") throw new Error();
	return this.tween(key, styleTween(name, value, priority == null ? "" : priority));
}

//#endregion
//#region node_modules/d3-transition/src/transition/text.js
function textConstant(value) {
	return function() {
		this.textContent = value;
	};
}
function textFunction(value) {
	return function() {
		var value1 = value(this);
		this.textContent = value1 == null ? "" : value1;
	};
}
function text_default$1(value) {
	return this.tween("text", typeof value === "function" ? textFunction(tweenValue(this, "text", value)) : textConstant(value == null ? "" : value + ""));
}

//#endregion
//#region node_modules/d3-transition/src/transition/textTween.js
function textInterpolate(i) {
	return function(t) {
		this.textContent = i.call(this, t);
	};
}
function textTween(value) {
	var t0$2, i0;
	function tween() {
		var i = value.apply(this, arguments);
		if (i !== i0) t0$2 = (i0 = i) && textInterpolate(i);
		return t0$2;
	}
	tween._value = value;
	return tween;
}
function textTween_default(value) {
	var key = "text";
	if (arguments.length < 1) return (key = this.tween(key)) && key._value;
	if (value == null) return this.tween(key, null);
	if (typeof value !== "function") throw new Error();
	return this.tween(key, textTween(value));
}

//#endregion
//#region node_modules/d3-transition/src/transition/transition.js
function transition_default$1() {
	var name = this._name, id0 = this._id, id1 = newId();
	for (var groups$1 = this._groups, m$2 = groups$1.length, j = 0; j < m$2; ++j) for (var group$1 = groups$1[j], n = group$1.length, node, i = 0; i < n; ++i) if (node = group$1[i]) {
		var inherit$1 = get(node, id0);
		schedule_default(node, name, id1, i, group$1, {
			time: inherit$1.time + inherit$1.delay + inherit$1.duration,
			delay: 0,
			duration: inherit$1.duration,
			ease: inherit$1.ease
		});
	}
	return new Transition(groups$1, this._parents, name, id1);
}

//#endregion
//#region node_modules/d3-transition/src/transition/end.js
function end_default() {
	var on0, on1, that = this, id$1 = that._id, size = that.size();
	return new Promise(function(resolve, reject) {
		var cancel = { value: reject }, end = { value: function() {
			if (--size === 0) resolve();
		} };
		that.each(function() {
			var schedule = set(this, id$1), on = schedule.on;
			if (on !== on0) {
				on1 = (on0 = on).copy();
				on1._.cancel.push(cancel);
				on1._.interrupt.push(cancel);
				on1._.end.push(end);
			}
			schedule.on = on1;
		});
		if (size === 0) resolve();
	});
}

//#endregion
//#region node_modules/d3-transition/src/transition/index.js
var id = 0;
function Transition(groups$1, parents, name, id$1) {
	this._groups = groups$1;
	this._parents = parents;
	this._name = name;
	this._id = id$1;
}
function transition(name) {
	return selection_default().transition(name);
}
function newId() {
	return ++id;
}
var selection_prototype = selection_default.prototype;
Transition.prototype = transition.prototype = {
	constructor: Transition,
	select: select_default$1,
	selectAll: selectAll_default$1,
	selectChild: selection_prototype.selectChild,
	selectChildren: selection_prototype.selectChildren,
	filter: filter_default,
	merge: merge_default,
	selection: selection_default$1,
	transition: transition_default$1,
	call: selection_prototype.call,
	nodes: selection_prototype.nodes,
	node: selection_prototype.node,
	size: selection_prototype.size,
	empty: selection_prototype.empty,
	each: selection_prototype.each,
	on: on_default,
	attr: attr_default,
	attrTween: attrTween_default,
	style: style_default,
	styleTween: styleTween_default,
	text: text_default$1,
	textTween: textTween_default,
	remove: remove_default$1,
	tween: tween_default,
	delay: delay_default,
	duration: duration_default,
	ease: ease_default,
	easeVarying: easeVarying_default,
	end: end_default,
	[Symbol.iterator]: selection_prototype[Symbol.iterator]
};

//#endregion
//#region node_modules/d3-ease/src/linear.js
const linear = (t) => +t;

//#endregion
//#region node_modules/d3-ease/src/quad.js
function quadIn(t) {
	return t * t;
}
function quadOut(t) {
	return t * (2 - t);
}
function quadInOut(t) {
	return ((t *= 2) <= 1 ? t * t : --t * (2 - t) + 1) / 2;
}

//#endregion
//#region node_modules/d3-ease/src/cubic.js
function cubicIn(t) {
	return t * t * t;
}
function cubicOut(t) {
	return --t * t * t + 1;
}
function cubicInOut(t) {
	return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
}

//#endregion
//#region node_modules/d3-ease/src/poly.js
var exponent = 3;
var polyIn = (function custom(e) {
	e = +e;
	function polyIn$1(t) {
		return Math.pow(t, e);
	}
	polyIn$1.exponent = custom;
	return polyIn$1;
})(exponent);
var polyOut = (function custom(e) {
	e = +e;
	function polyOut$1(t) {
		return 1 - Math.pow(1 - t, e);
	}
	polyOut$1.exponent = custom;
	return polyOut$1;
})(exponent);
var polyInOut = (function custom(e) {
	e = +e;
	function polyInOut$1(t) {
		return ((t *= 2) <= 1 ? Math.pow(t, e) : 2 - Math.pow(2 - t, e)) / 2;
	}
	polyInOut$1.exponent = custom;
	return polyInOut$1;
})(exponent);

//#endregion
//#region node_modules/d3-ease/src/sin.js
var pi$4 = Math.PI, halfPi$3 = pi$4 / 2;
function sinIn(t) {
	return +t === 1 ? 1 : 1 - Math.cos(t * halfPi$3);
}
function sinOut(t) {
	return Math.sin(t * halfPi$3);
}
function sinInOut(t) {
	return (1 - Math.cos(pi$4 * t)) / 2;
}

//#endregion
//#region node_modules/d3-ease/src/math.js
function tpmt(x$3) {
	return (Math.pow(2, -10 * x$3) - .0009765625) * 1.0009775171065494;
}

//#endregion
//#region node_modules/d3-ease/src/exp.js
function expIn(t) {
	return tpmt(1 - +t);
}
function expOut(t) {
	return 1 - tpmt(t);
}
function expInOut(t) {
	return ((t *= 2) <= 1 ? tpmt(1 - t) : 2 - tpmt(t - 1)) / 2;
}

//#endregion
//#region node_modules/d3-ease/src/circle.js
function circleIn(t) {
	return 1 - Math.sqrt(1 - t * t);
}
function circleOut(t) {
	return Math.sqrt(1 - --t * t);
}
function circleInOut(t) {
	return ((t *= 2) <= 1 ? 1 - Math.sqrt(1 - t * t) : Math.sqrt(1 - (t -= 2) * t) + 1) / 2;
}

//#endregion
//#region node_modules/d3-ease/src/bounce.js
var b1 = 4 / 11, b2 = 6 / 11, b3 = 8 / 11, b4 = 3 / 4, b5 = 9 / 11, b6 = 10 / 11, b7 = 15 / 16, b8 = 21 / 22, b9 = 63 / 64, b0 = 1 / b1 / b1;
function bounceIn(t) {
	return 1 - bounceOut(1 - t);
}
function bounceOut(t) {
	return (t = +t) < b1 ? b0 * t * t : t < b3 ? b0 * (t -= b2) * t + b4 : t < b6 ? b0 * (t -= b5) * t + b7 : b0 * (t -= b8) * t + b9;
}
function bounceInOut(t) {
	return ((t *= 2) <= 1 ? 1 - bounceOut(1 - t) : bounceOut(t - 1) + 1) / 2;
}

//#endregion
//#region node_modules/d3-ease/src/back.js
var overshoot = 1.70158;
var backIn = (function custom(s$1) {
	s$1 = +s$1;
	function backIn$1(t) {
		return (t = +t) * t * (s$1 * (t - 1) + t);
	}
	backIn$1.overshoot = custom;
	return backIn$1;
})(overshoot);
var backOut = (function custom(s$1) {
	s$1 = +s$1;
	function backOut$1(t) {
		return --t * t * ((t + 1) * s$1 + t) + 1;
	}
	backOut$1.overshoot = custom;
	return backOut$1;
})(overshoot);
var backInOut = (function custom(s$1) {
	s$1 = +s$1;
	function backInOut$1(t) {
		return ((t *= 2) < 1 ? t * t * ((s$1 + 1) * t - s$1) : (t -= 2) * t * ((s$1 + 1) * t + s$1) + 2) / 2;
	}
	backInOut$1.overshoot = custom;
	return backInOut$1;
})(overshoot);

//#endregion
//#region node_modules/d3-ease/src/elastic.js
var tau$5 = 2 * Math.PI, amplitude = 1, period = .3;
var elasticIn = (function custom(a$3, p) {
	var s$1 = Math.asin(1 / (a$3 = Math.max(1, a$3))) * (p /= tau$5);
	function elasticIn$1(t) {
		return a$3 * tpmt(- --t) * Math.sin((s$1 - t) / p);
	}
	elasticIn$1.amplitude = function(a$4) {
		return custom(a$4, p * tau$5);
	};
	elasticIn$1.period = function(p$1) {
		return custom(a$3, p$1);
	};
	return elasticIn$1;
})(amplitude, period);
var elasticOut = (function custom(a$3, p) {
	var s$1 = Math.asin(1 / (a$3 = Math.max(1, a$3))) * (p /= tau$5);
	function elasticOut$1(t) {
		return 1 - a$3 * tpmt(t = +t) * Math.sin((t + s$1) / p);
	}
	elasticOut$1.amplitude = function(a$4) {
		return custom(a$4, p * tau$5);
	};
	elasticOut$1.period = function(p$1) {
		return custom(a$3, p$1);
	};
	return elasticOut$1;
})(amplitude, period);
var elasticInOut = (function custom(a$3, p) {
	var s$1 = Math.asin(1 / (a$3 = Math.max(1, a$3))) * (p /= tau$5);
	function elasticInOut$1(t) {
		return ((t = t * 2 - 1) < 0 ? a$3 * tpmt(-t) * Math.sin((s$1 - t) / p) : 2 - a$3 * tpmt(t) * Math.sin((s$1 + t) / p)) / 2;
	}
	elasticInOut$1.amplitude = function(a$4) {
		return custom(a$4, p * tau$5);
	};
	elasticInOut$1.period = function(p$1) {
		return custom(a$3, p$1);
	};
	return elasticInOut$1;
})(amplitude, period);

//#endregion
//#region node_modules/d3-transition/src/selection/transition.js
var defaultTiming = {
	time: null,
	delay: 0,
	duration: 250,
	ease: cubicInOut
};
function inherit(node, id$1) {
	var timing;
	while (!(timing = node.__transition) || !(timing = timing[id$1])) if (!(node = node.parentNode)) throw new Error(`transition ${id$1} not found`);
	return timing;
}
function transition_default(name) {
	var id$1, timing;
	if (name instanceof Transition) id$1 = name._id, name = name._name;
	else id$1 = newId(), (timing = defaultTiming).time = now(), name = name == null ? null : name + "";
	for (var groups$1 = this._groups, m$2 = groups$1.length, j = 0; j < m$2; ++j) for (var group$1 = groups$1[j], n = group$1.length, node, i = 0; i < n; ++i) if (node = group$1[i]) schedule_default(node, name, id$1, i, group$1, timing || inherit(node, id$1));
	return new Transition(groups$1, this._parents, name, id$1);
}

//#endregion
//#region node_modules/d3-transition/src/selection/index.js
selection_default.prototype.interrupt = interrupt_default$1;
selection_default.prototype.transition = transition_default;

//#endregion
//#region node_modules/d3-transition/src/active.js
var root = [null];
function active_default(node, name) {
	var schedules = node.__transition, schedule, i;
	if (schedules) {
		name = name == null ? null : name + "";
		for (i in schedules) if ((schedule = schedules[i]).state > SCHEDULED && schedule.name === name) return new Transition([[node]], root, name, +i);
	}
	return null;
}

//#endregion
//#region node_modules/d3-brush/src/constant.js
var constant_default$7 = (x$3) => () => x$3;

//#endregion
//#region node_modules/d3-brush/src/event.js
function BrushEvent(type$1, { sourceEvent, target, selection: selection$1, mode: mode$1, dispatch: dispatch$1 }) {
	Object.defineProperties(this, {
		type: {
			value: type$1,
			enumerable: true,
			configurable: true
		},
		sourceEvent: {
			value: sourceEvent,
			enumerable: true,
			configurable: true
		},
		target: {
			value: target,
			enumerable: true,
			configurable: true
		},
		selection: {
			value: selection$1,
			enumerable: true,
			configurable: true
		},
		mode: {
			value: mode$1,
			enumerable: true,
			configurable: true
		},
		_: { value: dispatch$1 }
	});
}

//#endregion
//#region node_modules/d3-brush/src/noevent.js
function nopropagation$1(event) {
	event.stopImmediatePropagation();
}
function noevent_default$1(event) {
	event.preventDefault();
	event.stopImmediatePropagation();
}

//#endregion
//#region node_modules/d3-brush/src/brush.js
var MODE_DRAG = { name: "drag" }, MODE_SPACE = { name: "space" }, MODE_HANDLE = { name: "handle" }, MODE_CENTER = { name: "center" };
var { abs: abs$3, max: max$3, min: min$2 } = Math;
function number1(e) {
	return [+e[0], +e[1]];
}
function number2(e) {
	return [number1(e[0]), number1(e[1])];
}
var X = {
	name: "x",
	handles: ["w", "e"].map(type),
	input: function(x$3, e) {
		return x$3 == null ? null : [[+x$3[0], e[0][1]], [+x$3[1], e[1][1]]];
	},
	output: function(xy) {
		return xy && [xy[0][0], xy[1][0]];
	}
};
var Y = {
	name: "y",
	handles: ["n", "s"].map(type),
	input: function(y$3, e) {
		return y$3 == null ? null : [[e[0][0], +y$3[0]], [e[1][0], +y$3[1]]];
	},
	output: function(xy) {
		return xy && [xy[0][1], xy[1][1]];
	}
};
var XY = {
	name: "xy",
	handles: [
		"n",
		"w",
		"e",
		"s",
		"nw",
		"ne",
		"sw",
		"se"
	].map(type),
	input: function(xy) {
		return xy == null ? null : number2(xy);
	},
	output: function(xy) {
		return xy;
	}
};
var cursors = {
	overlay: "crosshair",
	selection: "move",
	n: "ns-resize",
	e: "ew-resize",
	s: "ns-resize",
	w: "ew-resize",
	nw: "nwse-resize",
	ne: "nesw-resize",
	se: "nwse-resize",
	sw: "nesw-resize"
};
var flipX = {
	e: "w",
	w: "e",
	nw: "ne",
	ne: "nw",
	se: "sw",
	sw: "se"
};
var flipY = {
	n: "s",
	s: "n",
	nw: "sw",
	ne: "se",
	se: "ne",
	sw: "nw"
};
var signsX = {
	overlay: 1,
	selection: 1,
	n: null,
	e: 1,
	s: null,
	w: -1,
	nw: -1,
	ne: 1,
	se: 1,
	sw: -1
};
var signsY = {
	overlay: 1,
	selection: 1,
	n: -1,
	e: null,
	s: 1,
	w: null,
	nw: -1,
	ne: -1,
	se: 1,
	sw: 1
};
function type(t) {
	return { type: t };
}
function defaultFilter$1(event) {
	return !event.ctrlKey && !event.button;
}
function defaultExtent$1() {
	var svg$1 = this.ownerSVGElement || this;
	if (svg$1.hasAttribute("viewBox")) {
		svg$1 = svg$1.viewBox.baseVal;
		return [[svg$1.x, svg$1.y], [svg$1.x + svg$1.width, svg$1.y + svg$1.height]];
	}
	return [[0, 0], [svg$1.width.baseVal.value, svg$1.height.baseVal.value]];
}
function defaultTouchable$1() {
	return navigator.maxTouchPoints || "ontouchstart" in this;
}
function local$1(node) {
	while (!node.__brush) if (!(node = node.parentNode)) return;
	return node.__brush;
}
function empty(extent$1) {
	return extent$1[0][0] === extent$1[1][0] || extent$1[0][1] === extent$1[1][1];
}
function brushSelection(node) {
	var state = node.__brush;
	return state ? state.dim.output(state.selection) : null;
}
function brushX() {
	return brush(X);
}
function brushY() {
	return brush(Y);
}
function brush_default() {
	return brush(XY);
}
function brush(dim) {
	var extent$1 = defaultExtent$1, filter$2 = defaultFilter$1, touchable = defaultTouchable$1, keys = true, listeners = dispatch_default("start", "brush", "end"), handleSize = 6, touchending;
	function brush$1(group$1) {
		var overlay = group$1.property("__brush", initialize).selectAll(".overlay").data([type("overlay")]);
		overlay.enter().append("rect").attr("class", "overlay").attr("pointer-events", "all").attr("cursor", cursors.overlay).merge(overlay).each(function() {
			var extent$2 = local$1(this).extent;
			select_default(this).attr("x", extent$2[0][0]).attr("y", extent$2[0][1]).attr("width", extent$2[1][0] - extent$2[0][0]).attr("height", extent$2[1][1] - extent$2[0][1]);
		});
		group$1.selectAll(".selection").data([type("selection")]).enter().append("rect").attr("class", "selection").attr("cursor", cursors.selection).attr("fill", "#777").attr("fill-opacity", .3).attr("stroke", "#fff").attr("shape-rendering", "crispEdges");
		var handle = group$1.selectAll(".handle").data(dim.handles, function(d) {
			return d.type;
		});
		handle.exit().remove();
		handle.enter().append("rect").attr("class", function(d) {
			return "handle handle--" + d.type;
		}).attr("cursor", function(d) {
			return cursors[d.type];
		});
		group$1.each(redraw).attr("fill", "none").attr("pointer-events", "all").on("mousedown.brush", started).filter(touchable).on("touchstart.brush", started).on("touchmove.brush", touchmoved).on("touchend.brush touchcancel.brush", touchended).style("touch-action", "none").style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
	}
	brush$1.move = function(group$1, selection$1, event) {
		if (group$1.tween) group$1.on("start.brush", function(event$1) {
			emitter(this, arguments).beforestart().start(event$1);
		}).on("interrupt.brush end.brush", function(event$1) {
			emitter(this, arguments).end(event$1);
		}).tween("brush", function() {
			var that = this, state = that.__brush, emit = emitter(that, arguments), selection0 = state.selection, selection1 = dim.input(typeof selection$1 === "function" ? selection$1.apply(this, arguments) : selection$1, state.extent), i = value_default(selection0, selection1);
			function tween(t) {
				state.selection = t === 1 && selection1 === null ? null : i(t);
				redraw.call(that);
				emit.brush();
			}
			return selection0 !== null && selection1 !== null ? tween : tween(1);
		});
		else group$1.each(function() {
			var that = this, args = arguments, state = that.__brush, selection1 = dim.input(typeof selection$1 === "function" ? selection$1.apply(that, args) : selection$1, state.extent), emit = emitter(that, args).beforestart();
			interrupt_default(that);
			state.selection = selection1 === null ? null : selection1;
			redraw.call(that);
			emit.start(event).brush(event).end(event);
		});
	};
	brush$1.clear = function(group$1, event) {
		brush$1.move(group$1, null, event);
	};
	function redraw() {
		var group$1 = select_default(this), selection$1 = local$1(this).selection;
		if (selection$1) {
			group$1.selectAll(".selection").style("display", null).attr("x", selection$1[0][0]).attr("y", selection$1[0][1]).attr("width", selection$1[1][0] - selection$1[0][0]).attr("height", selection$1[1][1] - selection$1[0][1]);
			group$1.selectAll(".handle").style("display", null).attr("x", function(d) {
				return d.type[d.type.length - 1] === "e" ? selection$1[1][0] - handleSize / 2 : selection$1[0][0] - handleSize / 2;
			}).attr("y", function(d) {
				return d.type[0] === "s" ? selection$1[1][1] - handleSize / 2 : selection$1[0][1] - handleSize / 2;
			}).attr("width", function(d) {
				return d.type === "n" || d.type === "s" ? selection$1[1][0] - selection$1[0][0] + handleSize : handleSize;
			}).attr("height", function(d) {
				return d.type === "e" || d.type === "w" ? selection$1[1][1] - selection$1[0][1] + handleSize : handleSize;
			});
		} else group$1.selectAll(".selection,.handle").style("display", "none").attr("x", null).attr("y", null).attr("width", null).attr("height", null);
	}
	function emitter(that, args, clean) {
		var emit = that.__brush.emitter;
		return emit && (!clean || !emit.clean) ? emit : new Emitter(that, args, clean);
	}
	function Emitter(that, args, clean) {
		this.that = that;
		this.args = args;
		this.state = that.__brush;
		this.active = 0;
		this.clean = clean;
	}
	Emitter.prototype = {
		beforestart: function() {
			if (++this.active === 1) this.state.emitter = this, this.starting = true;
			return this;
		},
		start: function(event, mode$1) {
			if (this.starting) this.starting = false, this.emit("start", event, mode$1);
			else this.emit("brush", event);
			return this;
		},
		brush: function(event, mode$1) {
			this.emit("brush", event, mode$1);
			return this;
		},
		end: function(event, mode$1) {
			if (--this.active === 0) delete this.state.emitter, this.emit("end", event, mode$1);
			return this;
		},
		emit: function(type$1, event, mode$1) {
			var d = select_default(this.that).datum();
			listeners.call(type$1, this.that, new BrushEvent(type$1, {
				sourceEvent: event,
				target: brush$1,
				selection: dim.output(this.state.selection),
				mode: mode$1,
				dispatch: listeners
			}), d);
		}
	};
	function started(event) {
		if (touchending && !event.touches) return;
		if (!filter$2.apply(this, arguments)) return;
		var that = this, type$1 = event.target.__data__.type, mode$1 = (keys && event.metaKey ? type$1 = "overlay" : type$1) === "selection" ? MODE_DRAG : keys && event.altKey ? MODE_CENTER : MODE_HANDLE, signX = dim === Y ? null : signsX[type$1], signY = dim === X ? null : signsY[type$1], state = local$1(that), extent$2 = state.extent, selection$1 = state.selection, W = extent$2[0][0], w0, w1, N = extent$2[0][1], n0, n1, E$1 = extent$2[1][0], e0, e1, S = extent$2[1][1], s0, s1, dx = 0, dy = 0, moving, shifting = signX && signY && keys && event.shiftKey, lockX, lockY, points = Array.from(event.touches || [event], (t) => {
			const i = t.identifier;
			t = pointer_default(t, that);
			t.point0 = t.slice();
			t.identifier = i;
			return t;
		});
		interrupt_default(that);
		var emit = emitter(that, arguments, true).beforestart();
		if (type$1 === "overlay") {
			if (selection$1) moving = true;
			const pts = [points[0], points[1] || points[0]];
			state.selection = selection$1 = [[w0 = dim === Y ? W : min$2(pts[0][0], pts[1][0]), n0 = dim === X ? N : min$2(pts[0][1], pts[1][1])], [e0 = dim === Y ? E$1 : max$3(pts[0][0], pts[1][0]), s0 = dim === X ? S : max$3(pts[0][1], pts[1][1])]];
			if (points.length > 1) move(event);
		} else {
			w0 = selection$1[0][0];
			n0 = selection$1[0][1];
			e0 = selection$1[1][0];
			s0 = selection$1[1][1];
		}
		w1 = w0;
		n1 = n0;
		e1 = e0;
		s1 = s0;
		var group$1 = select_default(that).attr("pointer-events", "none");
		var overlay = group$1.selectAll(".overlay").attr("cursor", cursors[type$1]);
		if (event.touches) {
			emit.moved = moved;
			emit.ended = ended;
		} else {
			var view = select_default(event.view).on("mousemove.brush", moved, true).on("mouseup.brush", ended, true);
			if (keys) view.on("keydown.brush", keydowned, true).on("keyup.brush", keyupped, true);
			nodrag_default(event.view);
		}
		redraw.call(that);
		emit.start(event, mode$1.name);
		function moved(event$1) {
			for (const p of event$1.changedTouches || [event$1]) for (const d of points) if (d.identifier === p.identifier) d.cur = pointer_default(p, that);
			if (shifting && !lockX && !lockY && points.length === 1) {
				const point$5 = points[0];
				if (abs$3(point$5.cur[0] - point$5[0]) > abs$3(point$5.cur[1] - point$5[1])) lockY = true;
				else lockX = true;
			}
			for (const point$5 of points) if (point$5.cur) point$5[0] = point$5.cur[0], point$5[1] = point$5.cur[1];
			moving = true;
			noevent_default$1(event$1);
			move(event$1);
		}
		function move(event$1) {
			const point$5 = points[0], point0 = point$5.point0;
			var t;
			dx = point$5[0] - point0[0];
			dy = point$5[1] - point0[1];
			switch (mode$1) {
				case MODE_SPACE:
				case MODE_DRAG:
					if (signX) dx = max$3(W - w0, min$2(E$1 - e0, dx)), w1 = w0 + dx, e1 = e0 + dx;
					if (signY) dy = max$3(N - n0, min$2(S - s0, dy)), n1 = n0 + dy, s1 = s0 + dy;
					break;
				case MODE_HANDLE:
					if (points[1]) {
						if (signX) w1 = max$3(W, min$2(E$1, points[0][0])), e1 = max$3(W, min$2(E$1, points[1][0])), signX = 1;
						if (signY) n1 = max$3(N, min$2(S, points[0][1])), s1 = max$3(N, min$2(S, points[1][1])), signY = 1;
					} else {
						if (signX < 0) dx = max$3(W - w0, min$2(E$1 - w0, dx)), w1 = w0 + dx, e1 = e0;
						else if (signX > 0) dx = max$3(W - e0, min$2(E$1 - e0, dx)), w1 = w0, e1 = e0 + dx;
						if (signY < 0) dy = max$3(N - n0, min$2(S - n0, dy)), n1 = n0 + dy, s1 = s0;
						else if (signY > 0) dy = max$3(N - s0, min$2(S - s0, dy)), n1 = n0, s1 = s0 + dy;
					}
					break;
				case MODE_CENTER:
					if (signX) w1 = max$3(W, min$2(E$1, w0 - dx * signX)), e1 = max$3(W, min$2(E$1, e0 + dx * signX));
					if (signY) n1 = max$3(N, min$2(S, n0 - dy * signY)), s1 = max$3(N, min$2(S, s0 + dy * signY));
					break;
			}
			if (e1 < w1) {
				signX *= -1;
				t = w0, w0 = e0, e0 = t;
				t = w1, w1 = e1, e1 = t;
				if (type$1 in flipX) overlay.attr("cursor", cursors[type$1 = flipX[type$1]]);
			}
			if (s1 < n1) {
				signY *= -1;
				t = n0, n0 = s0, s0 = t;
				t = n1, n1 = s1, s1 = t;
				if (type$1 in flipY) overlay.attr("cursor", cursors[type$1 = flipY[type$1]]);
			}
			if (state.selection) selection$1 = state.selection;
			if (lockX) w1 = selection$1[0][0], e1 = selection$1[1][0];
			if (lockY) n1 = selection$1[0][1], s1 = selection$1[1][1];
			if (selection$1[0][0] !== w1 || selection$1[0][1] !== n1 || selection$1[1][0] !== e1 || selection$1[1][1] !== s1) {
				state.selection = [[w1, n1], [e1, s1]];
				redraw.call(that);
				emit.brush(event$1, mode$1.name);
			}
		}
		function ended(event$1) {
			nopropagation$1(event$1);
			if (event$1.touches) {
				if (event$1.touches.length) return;
				if (touchending) clearTimeout(touchending);
				touchending = setTimeout(function() {
					touchending = null;
				}, 500);
			} else {
				yesdrag(event$1.view, moving);
				view.on("keydown.brush keyup.brush mousemove.brush mouseup.brush", null);
			}
			group$1.attr("pointer-events", "all");
			overlay.attr("cursor", cursors.overlay);
			if (state.selection) selection$1 = state.selection;
			if (empty(selection$1)) state.selection = null, redraw.call(that);
			emit.end(event$1, mode$1.name);
		}
		function keydowned(event$1) {
			switch (event$1.keyCode) {
				case 16:
					shifting = signX && signY;
					break;
				case 18:
					if (mode$1 === MODE_HANDLE) {
						if (signX) e0 = e1 - dx * signX, w0 = w1 + dx * signX;
						if (signY) s0 = s1 - dy * signY, n0 = n1 + dy * signY;
						mode$1 = MODE_CENTER;
						move(event$1);
					}
					break;
				case 32:
					if (mode$1 === MODE_HANDLE || mode$1 === MODE_CENTER) {
						if (signX < 0) e0 = e1 - dx;
						else if (signX > 0) w0 = w1 - dx;
						if (signY < 0) s0 = s1 - dy;
						else if (signY > 0) n0 = n1 - dy;
						mode$1 = MODE_SPACE;
						overlay.attr("cursor", cursors.selection);
						move(event$1);
					}
					break;
				default: return;
			}
			noevent_default$1(event$1);
		}
		function keyupped(event$1) {
			switch (event$1.keyCode) {
				case 16:
					if (shifting) {
						lockX = lockY = shifting = false;
						move(event$1);
					}
					break;
				case 18:
					if (mode$1 === MODE_CENTER) {
						if (signX < 0) e0 = e1;
						else if (signX > 0) w0 = w1;
						if (signY < 0) s0 = s1;
						else if (signY > 0) n0 = n1;
						mode$1 = MODE_HANDLE;
						move(event$1);
					}
					break;
				case 32:
					if (mode$1 === MODE_SPACE) {
						if (event$1.altKey) {
							if (signX) e0 = e1 - dx * signX, w0 = w1 + dx * signX;
							if (signY) s0 = s1 - dy * signY, n0 = n1 + dy * signY;
							mode$1 = MODE_CENTER;
						} else {
							if (signX < 0) e0 = e1;
							else if (signX > 0) w0 = w1;
							if (signY < 0) s0 = s1;
							else if (signY > 0) n0 = n1;
							mode$1 = MODE_HANDLE;
						}
						overlay.attr("cursor", cursors[type$1]);
						move(event$1);
					}
					break;
				default: return;
			}
			noevent_default$1(event$1);
		}
	}
	function touchmoved(event) {
		emitter(this, arguments).moved(event);
	}
	function touchended(event) {
		emitter(this, arguments).ended(event);
	}
	function initialize() {
		var state = this.__brush || { selection: null };
		state.extent = number2(extent$1.apply(this, arguments));
		state.dim = dim;
		return state;
	}
	brush$1.extent = function(_) {
		return arguments.length ? (extent$1 = typeof _ === "function" ? _ : constant_default$7(number2(_)), brush$1) : extent$1;
	};
	brush$1.filter = function(_) {
		return arguments.length ? (filter$2 = typeof _ === "function" ? _ : constant_default$7(!!_), brush$1) : filter$2;
	};
	brush$1.touchable = function(_) {
		return arguments.length ? (touchable = typeof _ === "function" ? _ : constant_default$7(!!_), brush$1) : touchable;
	};
	brush$1.handleSize = function(_) {
		return arguments.length ? (handleSize = +_, brush$1) : handleSize;
	};
	brush$1.keyModifiers = function(_) {
		return arguments.length ? (keys = !!_, brush$1) : keys;
	};
	brush$1.on = function() {
		var value = listeners.on.apply(listeners, arguments);
		return value === listeners ? brush$1 : value;
	};
	return brush$1;
}

//#endregion
//#region node_modules/d3-chord/src/math.js
var abs$2 = Math.abs;
var cos$2 = Math.cos;
var sin$2 = Math.sin;
var pi$3 = Math.PI;
var halfPi$2 = pi$3 / 2;
var tau$4 = pi$3 * 2;
var max$2 = Math.max;
var epsilon$4 = 1e-12;

//#endregion
//#region node_modules/d3-chord/src/chord.js
function range$2(i, j) {
	return Array.from({ length: j - i }, (_, k$1) => i + k$1);
}
function compareValue(compare) {
	return function(a$3, b) {
		return compare(a$3.source.value + a$3.target.value, b.source.value + b.target.value);
	};
}
function chord_default() {
	return chord(false, false);
}
function chordTranspose() {
	return chord(false, true);
}
function chordDirected() {
	return chord(true, false);
}
function chord(directed, transpose$1) {
	var padAngle = 0, sortGroups = null, sortSubgroups = null, sortChords = null;
	function chord$1(matrix) {
		var n = matrix.length, groupSums = new Array(n), groupIndex = range$2(0, n), chords = new Array(n * n), groups$1 = new Array(n), k$1 = 0, dx;
		matrix = Float64Array.from({ length: n * n }, transpose$1 ? (_, i) => matrix[i % n][i / n | 0] : (_, i) => matrix[i / n | 0][i % n]);
		for (let i = 0; i < n; ++i) {
			let x$3 = 0;
			for (let j = 0; j < n; ++j) x$3 += matrix[i * n + j] + directed * matrix[j * n + i];
			k$1 += groupSums[i] = x$3;
		}
		k$1 = max$2(0, tau$4 - padAngle * n) / k$1;
		dx = k$1 ? padAngle : tau$4 / n;
		{
			let x$3 = 0;
			if (sortGroups) groupIndex.sort((a$3, b) => sortGroups(groupSums[a$3], groupSums[b]));
			for (const i of groupIndex) {
				const x0$5 = x$3;
				if (directed) {
					const subgroupIndex = range$2(~n + 1, n).filter((j) => j < 0 ? matrix[~j * n + i] : matrix[i * n + j]);
					if (sortSubgroups) subgroupIndex.sort((a$3, b) => sortSubgroups(a$3 < 0 ? -matrix[~a$3 * n + i] : matrix[i * n + a$3], b < 0 ? -matrix[~b * n + i] : matrix[i * n + b]));
					for (const j of subgroupIndex) if (j < 0) {
						const chord$2 = chords[~j * n + i] || (chords[~j * n + i] = {
							source: null,
							target: null
						});
						chord$2.target = {
							index: i,
							startAngle: x$3,
							endAngle: x$3 += matrix[~j * n + i] * k$1,
							value: matrix[~j * n + i]
						};
					} else {
						const chord$2 = chords[i * n + j] || (chords[i * n + j] = {
							source: null,
							target: null
						});
						chord$2.source = {
							index: i,
							startAngle: x$3,
							endAngle: x$3 += matrix[i * n + j] * k$1,
							value: matrix[i * n + j]
						};
					}
					groups$1[i] = {
						index: i,
						startAngle: x0$5,
						endAngle: x$3,
						value: groupSums[i]
					};
				} else {
					const subgroupIndex = range$2(0, n).filter((j) => matrix[i * n + j] || matrix[j * n + i]);
					if (sortSubgroups) subgroupIndex.sort((a$3, b) => sortSubgroups(matrix[i * n + a$3], matrix[i * n + b]));
					for (const j of subgroupIndex) {
						let chord$2;
						if (i < j) {
							chord$2 = chords[i * n + j] || (chords[i * n + j] = {
								source: null,
								target: null
							});
							chord$2.source = {
								index: i,
								startAngle: x$3,
								endAngle: x$3 += matrix[i * n + j] * k$1,
								value: matrix[i * n + j]
							};
						} else {
							chord$2 = chords[j * n + i] || (chords[j * n + i] = {
								source: null,
								target: null
							});
							chord$2.target = {
								index: i,
								startAngle: x$3,
								endAngle: x$3 += matrix[i * n + j] * k$1,
								value: matrix[i * n + j]
							};
							if (i === j) chord$2.source = chord$2.target;
						}
						if (chord$2.source && chord$2.target && chord$2.source.value < chord$2.target.value) {
							const source = chord$2.source;
							chord$2.source = chord$2.target;
							chord$2.target = source;
						}
					}
					groups$1[i] = {
						index: i,
						startAngle: x0$5,
						endAngle: x$3,
						value: groupSums[i]
					};
				}
				x$3 += dx;
			}
		}
		chords = Object.values(chords);
		chords.groups = groups$1;
		return sortChords ? chords.sort(sortChords) : chords;
	}
	chord$1.padAngle = function(_) {
		return arguments.length ? (padAngle = max$2(0, _), chord$1) : padAngle;
	};
	chord$1.sortGroups = function(_) {
		return arguments.length ? (sortGroups = _, chord$1) : sortGroups;
	};
	chord$1.sortSubgroups = function(_) {
		return arguments.length ? (sortSubgroups = _, chord$1) : sortSubgroups;
	};
	chord$1.sortChords = function(_) {
		return arguments.length ? (_ == null ? sortChords = null : (sortChords = compareValue(_))._ = _, chord$1) : sortChords && sortChords._;
	};
	return chord$1;
}

//#endregion
//#region node_modules/d3-path/src/path.js
var pi$2 = Math.PI, tau$3 = 2 * pi$2, epsilon$5 = 1e-6, tauEpsilon = tau$3 - epsilon$5;
function append$1(strings) {
	this._ += strings[0];
	for (let i = 1, n = strings.length; i < n; ++i) this._ += arguments[i] + strings[i];
}
function appendRound$1(digits) {
	let d = Math.floor(digits);
	if (!(d >= 0)) throw new Error(`invalid digits: ${digits}`);
	if (d > 15) return append$1;
	const k$1 = 10 ** d;
	return function(strings) {
		this._ += strings[0];
		for (let i = 1, n = strings.length; i < n; ++i) this._ += Math.round(arguments[i] * k$1) / k$1 + strings[i];
	};
}
var Path = class {
	constructor(digits) {
		this._x0 = this._y0 = this._x1 = this._y1 = null;
		this._ = "";
		this._append = digits == null ? append$1 : appendRound$1(digits);
	}
	moveTo(x$3, y$3) {
		this._append`M${this._x0 = this._x1 = +x$3},${this._y0 = this._y1 = +y$3}`;
	}
	closePath() {
		if (this._x1 !== null) {
			this._x1 = this._x0, this._y1 = this._y0;
			this._append`Z`;
		}
	}
	lineTo(x$3, y$3) {
		this._append`L${this._x1 = +x$3},${this._y1 = +y$3}`;
	}
	quadraticCurveTo(x1$1, y1$1, x$3, y$3) {
		this._append`Q${+x1$1},${+y1$1},${this._x1 = +x$3},${this._y1 = +y$3}`;
	}
	bezierCurveTo(x1$1, y1$1, x2, y2, x$3, y$3) {
		this._append`C${+x1$1},${+y1$1},${+x2},${+y2},${this._x1 = +x$3},${this._y1 = +y$3}`;
	}
	arcTo(x1$1, y1$1, x2, y2, r) {
		x1$1 = +x1$1, y1$1 = +y1$1, x2 = +x2, y2 = +y2, r = +r;
		if (r < 0) throw new Error(`negative radius: ${r}`);
		let x0$5 = this._x1, y0$5 = this._y1, x21 = x2 - x1$1, y21 = y2 - y1$1, x01 = x0$5 - x1$1, y01 = y0$5 - y1$1, l01_2 = x01 * x01 + y01 * y01;
		if (this._x1 === null) this._append`M${this._x1 = x1$1},${this._y1 = y1$1}`;
		else if (!(l01_2 > epsilon$5));
		else if (!(Math.abs(y01 * x21 - y21 * x01) > epsilon$5) || !r) this._append`L${this._x1 = x1$1},${this._y1 = y1$1}`;
		else {
			let x20 = x2 - x0$5, y20 = y2 - y0$5, l21_2 = x21 * x21 + y21 * y21, l20_2 = x20 * x20 + y20 * y20, l21 = Math.sqrt(l21_2), l01 = Math.sqrt(l01_2), l = r * Math.tan((pi$2 - Math.acos((l21_2 + l01_2 - l20_2) / (2 * l21 * l01))) / 2), t01 = l / l01, t21 = l / l21;
			if (Math.abs(t01 - 1) > epsilon$5) this._append`L${x1$1 + t01 * x01},${y1$1 + t01 * y01}`;
			this._append`A${r},${r},0,0,${+(y01 * x20 > x01 * y20)},${this._x1 = x1$1 + t21 * x21},${this._y1 = y1$1 + t21 * y21}`;
		}
	}
	arc(x$3, y$3, r, a0, a1, ccw) {
		x$3 = +x$3, y$3 = +y$3, r = +r, ccw = !!ccw;
		if (r < 0) throw new Error(`negative radius: ${r}`);
		let dx = r * Math.cos(a0), dy = r * Math.sin(a0), x0$5 = x$3 + dx, y0$5 = y$3 + dy, cw = 1 ^ ccw, da$1 = ccw ? a0 - a1 : a1 - a0;
		if (this._x1 === null) this._append`M${x0$5},${y0$5}`;
		else if (Math.abs(this._x1 - x0$5) > epsilon$5 || Math.abs(this._y1 - y0$5) > epsilon$5) this._append`L${x0$5},${y0$5}`;
		if (!r) return;
		if (da$1 < 0) da$1 = da$1 % tau$3 + tau$3;
		if (da$1 > tauEpsilon) this._append`A${r},${r},0,1,${cw},${x$3 - dx},${y$3 - dy}A${r},${r},0,1,${cw},${this._x1 = x0$5},${this._y1 = y0$5}`;
		else if (da$1 > epsilon$5) this._append`A${r},${r},0,${+(da$1 >= pi$2)},${cw},${this._x1 = x$3 + r * Math.cos(a1)},${this._y1 = y$3 + r * Math.sin(a1)}`;
	}
	rect(x$3, y$3, w, h) {
		this._append`M${this._x0 = this._x1 = +x$3},${this._y0 = this._y1 = +y$3}h${w = +w}v${+h}h${-w}Z`;
	}
	toString() {
		return this._;
	}
};
function path() {
	return new Path();
}
path.prototype = Path.prototype;
function pathRound(digits = 3) {
	return new Path(+digits);
}

//#endregion
//#region node_modules/d3-chord/src/array.js
var slice$2 = Array.prototype.slice;

//#endregion
//#region node_modules/d3-chord/src/constant.js
function constant_default$6(x$3) {
	return function() {
		return x$3;
	};
}

//#endregion
//#region node_modules/d3-chord/src/ribbon.js
function defaultSource(d) {
	return d.source;
}
function defaultTarget(d) {
	return d.target;
}
function defaultRadius$1(d) {
	return d.radius;
}
function defaultStartAngle(d) {
	return d.startAngle;
}
function defaultEndAngle(d) {
	return d.endAngle;
}
function defaultPadAngle() {
	return 0;
}
function defaultArrowheadRadius() {
	return 10;
}
function ribbon(headRadius) {
	var source = defaultSource, target = defaultTarget, sourceRadius = defaultRadius$1, targetRadius = defaultRadius$1, startAngle = defaultStartAngle, endAngle = defaultEndAngle, padAngle = defaultPadAngle, context = null;
	function ribbon$1() {
		var buffer, s$1 = source.apply(this, arguments), t = target.apply(this, arguments), ap = padAngle.apply(this, arguments) / 2, argv = slice$2.call(arguments), sr = +sourceRadius.apply(this, (argv[0] = s$1, argv)), sa0 = startAngle.apply(this, argv) - halfPi$2, sa1 = endAngle.apply(this, argv) - halfPi$2, tr = +targetRadius.apply(this, (argv[0] = t, argv)), ta0 = startAngle.apply(this, argv) - halfPi$2, ta1 = endAngle.apply(this, argv) - halfPi$2;
		if (!context) context = buffer = path();
		if (ap > epsilon$4) {
			if (abs$2(sa1 - sa0) > ap * 2 + epsilon$4) sa1 > sa0 ? (sa0 += ap, sa1 -= ap) : (sa0 -= ap, sa1 += ap);
			else sa0 = sa1 = (sa0 + sa1) / 2;
			if (abs$2(ta1 - ta0) > ap * 2 + epsilon$4) ta1 > ta0 ? (ta0 += ap, ta1 -= ap) : (ta0 -= ap, ta1 += ap);
			else ta0 = ta1 = (ta0 + ta1) / 2;
		}
		context.moveTo(sr * cos$2(sa0), sr * sin$2(sa0));
		context.arc(0, 0, sr, sa0, sa1);
		if (sa0 !== ta0 || sa1 !== ta1) if (headRadius) {
			var hr = +headRadius.apply(this, arguments), tr2 = tr - hr, ta2 = (ta0 + ta1) / 2;
			context.quadraticCurveTo(0, 0, tr2 * cos$2(ta0), tr2 * sin$2(ta0));
			context.lineTo(tr * cos$2(ta2), tr * sin$2(ta2));
			context.lineTo(tr2 * cos$2(ta1), tr2 * sin$2(ta1));
		} else {
			context.quadraticCurveTo(0, 0, tr * cos$2(ta0), tr * sin$2(ta0));
			context.arc(0, 0, tr, ta0, ta1);
		}
		context.quadraticCurveTo(0, 0, sr * cos$2(sa0), sr * sin$2(sa0));
		context.closePath();
		if (buffer) return context = null, buffer + "" || null;
	}
	if (headRadius) ribbon$1.headRadius = function(_) {
		return arguments.length ? (headRadius = typeof _ === "function" ? _ : constant_default$6(+_), ribbon$1) : headRadius;
	};
	ribbon$1.radius = function(_) {
		return arguments.length ? (sourceRadius = targetRadius = typeof _ === "function" ? _ : constant_default$6(+_), ribbon$1) : sourceRadius;
	};
	ribbon$1.sourceRadius = function(_) {
		return arguments.length ? (sourceRadius = typeof _ === "function" ? _ : constant_default$6(+_), ribbon$1) : sourceRadius;
	};
	ribbon$1.targetRadius = function(_) {
		return arguments.length ? (targetRadius = typeof _ === "function" ? _ : constant_default$6(+_), ribbon$1) : targetRadius;
	};
	ribbon$1.startAngle = function(_) {
		return arguments.length ? (startAngle = typeof _ === "function" ? _ : constant_default$6(+_), ribbon$1) : startAngle;
	};
	ribbon$1.endAngle = function(_) {
		return arguments.length ? (endAngle = typeof _ === "function" ? _ : constant_default$6(+_), ribbon$1) : endAngle;
	};
	ribbon$1.padAngle = function(_) {
		return arguments.length ? (padAngle = typeof _ === "function" ? _ : constant_default$6(+_), ribbon$1) : padAngle;
	};
	ribbon$1.source = function(_) {
		return arguments.length ? (source = _, ribbon$1) : source;
	};
	ribbon$1.target = function(_) {
		return arguments.length ? (target = _, ribbon$1) : target;
	};
	ribbon$1.context = function(_) {
		return arguments.length ? (context = _ == null ? null : _, ribbon$1) : context;
	};
	return ribbon$1;
}
function ribbon_default() {
	return ribbon();
}
function ribbonArrow() {
	return ribbon(defaultArrowheadRadius);
}

//#endregion
//#region node_modules/d3-contour/src/array.js
var array = Array.prototype;
var slice$1 = array.slice;

//#endregion
//#region node_modules/d3-contour/src/ascending.js
function ascending_default$1(a$3, b) {
	return a$3 - b;
}

//#endregion
//#region node_modules/d3-contour/src/area.js
function area_default$4(ring) {
	var i = 0, n = ring.length, area = ring[n - 1][1] * ring[0][0] - ring[n - 1][0] * ring[0][1];
	while (++i < n) area += ring[i - 1][1] * ring[i][0] - ring[i - 1][0] * ring[i][1];
	return area;
}

//#endregion
//#region node_modules/d3-contour/src/constant.js
var constant_default$5 = (x$3) => () => x$3;

//#endregion
//#region node_modules/d3-contour/src/contains.js
function contains_default$2(ring, hole) {
	var i = -1, n = hole.length, c$5;
	while (++i < n) if (c$5 = ringContains(ring, hole[i])) return c$5;
	return 0;
}
function ringContains(ring, point$5) {
	var x$3 = point$5[0], y$3 = point$5[1], contains = -1;
	for (var i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
		var pi$5 = ring[i], xi = pi$5[0], yi = pi$5[1], pj = ring[j], xj = pj[0], yj = pj[1];
		if (segmentContains(pi$5, pj, point$5)) return 0;
		if (yi > y$3 !== yj > y$3 && x$3 < (xj - xi) * (y$3 - yi) / (yj - yi) + xi) contains = -contains;
	}
	return contains;
}
function segmentContains(a$3, b, c$5) {
	var i;
	return collinear$1(a$3, b, c$5) && within(a$3[i = +(a$3[0] === b[0])], c$5[i], b[i]);
}
function collinear$1(a$3, b, c$5) {
	return (b[0] - a$3[0]) * (c$5[1] - a$3[1]) === (c$5[0] - a$3[0]) * (b[1] - a$3[1]);
}
function within(p, q, r) {
	return p <= q && q <= r || r <= q && q <= p;
}

//#endregion
//#region node_modules/d3-contour/src/noop.js
function noop_default$1() {}

//#endregion
//#region node_modules/d3-contour/src/contours.js
var cases = [
	[],
	[[[1, 1.5], [.5, 1]]],
	[[[1.5, 1], [1, 1.5]]],
	[[[1.5, 1], [.5, 1]]],
	[[[1, .5], [1.5, 1]]],
	[[[1, 1.5], [.5, 1]], [[1, .5], [1.5, 1]]],
	[[[1, .5], [1, 1.5]]],
	[[[1, .5], [.5, 1]]],
	[[[.5, 1], [1, .5]]],
	[[[1, 1.5], [1, .5]]],
	[[[.5, 1], [1, .5]], [[1.5, 1], [1, 1.5]]],
	[[[1.5, 1], [1, .5]]],
	[[[.5, 1], [1.5, 1]]],
	[[[1, 1.5], [1.5, 1]]],
	[[[.5, 1], [1, 1.5]]],
	[]
];
function contours_default() {
	var dx = 1, dy = 1, threshold$1 = thresholdSturges, smooth = smoothLinear;
	function contours(values) {
		var tz = threshold$1(values);
		if (!Array.isArray(tz)) {
			const e = extent(values, finite);
			tz = ticks(...nice(e[0], e[1], tz), tz);
			while (tz[tz.length - 1] >= e[1]) tz.pop();
			while (tz[1] < e[0]) tz.shift();
		} else tz = tz.slice().sort(ascending_default$1);
		return tz.map((value) => contour(values, value));
	}
	function contour(values, value) {
		const v$1 = value == null ? NaN : +value;
		if (isNaN(v$1)) throw new Error(`invalid value: ${value}`);
		var polygons = [], holes = [];
		isorings(values, v$1, function(ring) {
			smooth(ring, values, v$1);
			if (area_default$4(ring) > 0) polygons.push([ring]);
			else holes.push(ring);
		});
		holes.forEach(function(hole) {
			for (var i = 0, n = polygons.length, polygon; i < n; ++i) if (contains_default$2((polygon = polygons[i])[0], hole) !== -1) {
				polygon.push(hole);
				return;
			}
		});
		return {
			type: "MultiPolygon",
			value,
			coordinates: polygons
		};
	}
	function isorings(values, value, callback) {
		var fragmentByStart = new Array(), fragmentByEnd = new Array(), x$3 = y$3 = -1, y$3, t0$2, t1$2 = above(values[0], value), t2$1, t3$1;
		cases[t1$2 << 1].forEach(stitch);
		while (++x$3 < dx - 1) {
			t0$2 = t1$2, t1$2 = above(values[x$3 + 1], value);
			cases[t0$2 | t1$2 << 1].forEach(stitch);
		}
		cases[t1$2 << 0].forEach(stitch);
		while (++y$3 < dy - 1) {
			x$3 = -1;
			t1$2 = above(values[y$3 * dx + dx], value);
			t2$1 = above(values[y$3 * dx], value);
			cases[t1$2 << 1 | t2$1 << 2].forEach(stitch);
			while (++x$3 < dx - 1) {
				t0$2 = t1$2, t1$2 = above(values[y$3 * dx + dx + x$3 + 1], value);
				t3$1 = t2$1, t2$1 = above(values[y$3 * dx + x$3 + 1], value);
				cases[t0$2 | t1$2 << 1 | t2$1 << 2 | t3$1 << 3].forEach(stitch);
			}
			cases[t1$2 | t2$1 << 3].forEach(stitch);
		}
		x$3 = -1;
		t2$1 = values[y$3 * dx] >= value;
		cases[t2$1 << 2].forEach(stitch);
		while (++x$3 < dx - 1) {
			t3$1 = t2$1, t2$1 = above(values[y$3 * dx + x$3 + 1], value);
			cases[t2$1 << 2 | t3$1 << 3].forEach(stitch);
		}
		cases[t2$1 << 3].forEach(stitch);
		function stitch(line) {
			var start$1 = [line[0][0] + x$3, line[0][1] + y$3], end = [line[1][0] + x$3, line[1][1] + y$3], startIndex = index$2(start$1), endIndex = index$2(end), f, g;
			if (f = fragmentByEnd[startIndex]) if (g = fragmentByStart[endIndex]) {
				delete fragmentByEnd[f.end];
				delete fragmentByStart[g.start];
				if (f === g) {
					f.ring.push(end);
					callback(f.ring);
				} else fragmentByStart[f.start] = fragmentByEnd[g.end] = {
					start: f.start,
					end: g.end,
					ring: f.ring.concat(g.ring)
				};
			} else {
				delete fragmentByEnd[f.end];
				f.ring.push(end);
				fragmentByEnd[f.end = endIndex] = f;
			}
			else if (f = fragmentByStart[endIndex]) if (g = fragmentByEnd[startIndex]) {
				delete fragmentByStart[f.start];
				delete fragmentByEnd[g.end];
				if (f === g) {
					f.ring.push(end);
					callback(f.ring);
				} else fragmentByStart[g.start] = fragmentByEnd[f.end] = {
					start: g.start,
					end: f.end,
					ring: g.ring.concat(f.ring)
				};
			} else {
				delete fragmentByStart[f.start];
				f.ring.unshift(start$1);
				fragmentByStart[f.start = startIndex] = f;
			}
			else fragmentByStart[startIndex] = fragmentByEnd[endIndex] = {
				start: startIndex,
				end: endIndex,
				ring: [start$1, end]
			};
		}
	}
	function index$2(point$5) {
		return point$5[0] * 2 + point$5[1] * (dx + 1) * 4;
	}
	function smoothLinear(ring, values, value) {
		ring.forEach(function(point$5) {
			var x$3 = point$5[0], y$3 = point$5[1], xt = x$3 | 0, yt = y$3 | 0, v1 = valid(values[yt * dx + xt]);
			if (x$3 > 0 && x$3 < dx && xt === x$3) point$5[0] = smooth1(x$3, valid(values[yt * dx + xt - 1]), v1, value);
			if (y$3 > 0 && y$3 < dy && yt === y$3) point$5[1] = smooth1(y$3, valid(values[(yt - 1) * dx + xt]), v1, value);
		});
	}
	contours.contour = contour;
	contours.size = function(_) {
		if (!arguments.length) return [dx, dy];
		var _0 = Math.floor(_[0]), _1 = Math.floor(_[1]);
		if (!(_0 >= 0 && _1 >= 0)) throw new Error("invalid size");
		return dx = _0, dy = _1, contours;
	};
	contours.thresholds = function(_) {
		return arguments.length ? (threshold$1 = typeof _ === "function" ? _ : Array.isArray(_) ? constant_default$5(slice$1.call(_)) : constant_default$5(_), contours) : threshold$1;
	};
	contours.smooth = function(_) {
		return arguments.length ? (smooth = _ ? smoothLinear : noop_default$1, contours) : smooth === smoothLinear;
	};
	return contours;
}
function finite(x$3) {
	return isFinite(x$3) ? x$3 : NaN;
}
function above(x$3, value) {
	return x$3 == null ? false : +x$3 >= value;
}
function valid(v$1) {
	return v$1 == null || isNaN(v$1 = +v$1) ? -Infinity : v$1;
}
function smooth1(x$3, v0, v1, value) {
	const a$3 = value - v0;
	const b = v1 - v0;
	const d = isFinite(a$3) || isFinite(b) ? a$3 / b : Math.sign(a$3) / Math.sign(b);
	return isNaN(d) ? x$3 : x$3 + d - .5;
}

//#endregion
//#region node_modules/d3-contour/src/density.js
function defaultX$1(d) {
	return d[0];
}
function defaultY$1(d) {
	return d[1];
}
function defaultWeight() {
	return 1;
}
function density_default() {
	var x$3 = defaultX$1, y$3 = defaultY$1, weight = defaultWeight, dx = 960, dy = 500, r = 20, k$1 = 2, o = r * 3, n = dx + o * 2 >> k$1, m$2 = dy + o * 2 >> k$1, threshold$1 = constant_default$5(20);
	function grid(data) {
		var values = new Float32Array(n * m$2), pow2k = Math.pow(2, -k$1), i = -1;
		for (const d of data) {
			var xi = (x$3(d, ++i, data) + o) * pow2k, yi = (y$3(d, i, data) + o) * pow2k, wi = +weight(d, i, data);
			if (wi && xi >= 0 && xi < n && yi >= 0 && yi < m$2) {
				var x0$5 = Math.floor(xi), y0$5 = Math.floor(yi), xt = xi - x0$5 - .5, yt = yi - y0$5 - .5;
				values[x0$5 + y0$5 * n] += (1 - xt) * (1 - yt) * wi;
				values[x0$5 + 1 + y0$5 * n] += xt * (1 - yt) * wi;
				values[x0$5 + 1 + (y0$5 + 1) * n] += xt * yt * wi;
				values[x0$5 + (y0$5 + 1) * n] += (1 - xt) * yt * wi;
			}
		}
		blur2({
			data: values,
			width: n,
			height: m$2
		}, r * pow2k);
		return values;
	}
	function density(data) {
		var values = grid(data), tz = threshold$1(values), pow4k = Math.pow(2, 2 * k$1);
		if (!Array.isArray(tz)) tz = ticks(Number.MIN_VALUE, max(values) / pow4k, tz);
		return contours_default().size([n, m$2]).thresholds(tz.map((d) => d * pow4k))(values).map((c$5, i) => (c$5.value = +tz[i], transform$1(c$5)));
	}
	density.contours = function(data) {
		var values = grid(data), contours = contours_default().size([n, m$2]), pow4k = Math.pow(2, 2 * k$1), contour = (value) => {
			value = +value;
			var c$5 = transform$1(contours.contour(values, value * pow4k));
			c$5.value = value;
			return c$5;
		};
		Object.defineProperty(contour, "max", { get: () => max(values) / pow4k });
		return contour;
	};
	function transform$1(geometry) {
		geometry.coordinates.forEach(transformPolygon);
		return geometry;
	}
	function transformPolygon(coordinates$1) {
		coordinates$1.forEach(transformRing);
	}
	function transformRing(coordinates$1) {
		coordinates$1.forEach(transformPoint);
	}
	function transformPoint(coordinates$1) {
		coordinates$1[0] = coordinates$1[0] * Math.pow(2, k$1) - o;
		coordinates$1[1] = coordinates$1[1] * Math.pow(2, k$1) - o;
	}
	function resize() {
		o = r * 3;
		n = dx + o * 2 >> k$1;
		m$2 = dy + o * 2 >> k$1;
		return density;
	}
	density.x = function(_) {
		return arguments.length ? (x$3 = typeof _ === "function" ? _ : constant_default$5(+_), density) : x$3;
	};
	density.y = function(_) {
		return arguments.length ? (y$3 = typeof _ === "function" ? _ : constant_default$5(+_), density) : y$3;
	};
	density.weight = function(_) {
		return arguments.length ? (weight = typeof _ === "function" ? _ : constant_default$5(+_), density) : weight;
	};
	density.size = function(_) {
		if (!arguments.length) return [dx, dy];
		var _0 = +_[0], _1 = +_[1];
		if (!(_0 >= 0 && _1 >= 0)) throw new Error("invalid size");
		return dx = _0, dy = _1, resize();
	};
	density.cellSize = function(_) {
		if (!arguments.length) return 1 << k$1;
		if (!((_ = +_) >= 1)) throw new Error("invalid cell size");
		return k$1 = Math.floor(Math.log(_) / Math.LN2), resize();
	};
	density.thresholds = function(_) {
		return arguments.length ? (threshold$1 = typeof _ === "function" ? _ : Array.isArray(_) ? constant_default$5(slice$1.call(_)) : constant_default$5(_), density) : threshold$1;
	};
	density.bandwidth = function(_) {
		if (!arguments.length) return Math.sqrt(r * (r + 1));
		if (!((_ = +_) >= 0)) throw new Error("invalid bandwidth");
		return r = (Math.sqrt(4 * _ * _ + 1) - 1) / 2, resize();
	};
	return density;
}

//#endregion
//#region node_modules/robust-predicates/esm/util.js
const epsilon$3 = 11102230246251565e-32;
const splitter = 134217729;
const resulterrbound = (3 + 8 * epsilon$3) * epsilon$3;
function sum$2(elen, e, flen, f, h) {
	let Q, Qnew, hh, bvirt;
	let enow = e[0];
	let fnow = f[0];
	let eindex = 0;
	let findex = 0;
	if (fnow > enow === fnow > -enow) {
		Q = enow;
		enow = e[++eindex];
	} else {
		Q = fnow;
		fnow = f[++findex];
	}
	let hindex = 0;
	if (eindex < elen && findex < flen) {
		if (fnow > enow === fnow > -enow) {
			Qnew = enow + Q;
			hh = Q - (Qnew - enow);
			enow = e[++eindex];
		} else {
			Qnew = fnow + Q;
			hh = Q - (Qnew - fnow);
			fnow = f[++findex];
		}
		Q = Qnew;
		if (hh !== 0) h[hindex++] = hh;
		while (eindex < elen && findex < flen) {
			if (fnow > enow === fnow > -enow) {
				Qnew = Q + enow;
				bvirt = Qnew - Q;
				hh = Q - (Qnew - bvirt) + (enow - bvirt);
				enow = e[++eindex];
			} else {
				Qnew = Q + fnow;
				bvirt = Qnew - Q;
				hh = Q - (Qnew - bvirt) + (fnow - bvirt);
				fnow = f[++findex];
			}
			Q = Qnew;
			if (hh !== 0) h[hindex++] = hh;
		}
	}
	while (eindex < elen) {
		Qnew = Q + enow;
		bvirt = Qnew - Q;
		hh = Q - (Qnew - bvirt) + (enow - bvirt);
		enow = e[++eindex];
		Q = Qnew;
		if (hh !== 0) h[hindex++] = hh;
	}
	while (findex < flen) {
		Qnew = Q + fnow;
		bvirt = Qnew - Q;
		hh = Q - (Qnew - bvirt) + (fnow - bvirt);
		fnow = f[++findex];
		Q = Qnew;
		if (hh !== 0) h[hindex++] = hh;
	}
	if (Q !== 0 || hindex === 0) h[hindex++] = Q;
	return hindex;
}
function estimate(elen, e) {
	let Q = e[0];
	for (let i = 1; i < elen; i++) Q += e[i];
	return Q;
}
function vec(n) {
	return new Float64Array(n);
}

//#endregion
//#region node_modules/robust-predicates/esm/orient2d.js
var ccwerrboundA = (3 + 16 * epsilon$3) * epsilon$3;
var ccwerrboundB = (2 + 12 * epsilon$3) * epsilon$3;
var ccwerrboundC = (9 + 64 * epsilon$3) * epsilon$3 * epsilon$3;
var B = vec(4);
var C1 = vec(8);
var C2 = vec(12);
var D = vec(16);
var u$2 = vec(4);
function orient2dadapt(ax, ay, bx, by, cx, cy, detsum) {
	let acxtail, acytail, bcxtail, bcytail;
	let bvirt, c$5, ahi, alo, bhi, blo, _i, _j, _0, s1, s0, t1$2, t0$2, u3;
	const acx = ax - cx;
	const bcx = bx - cx;
	const acy = ay - cy;
	const bcy = by - cy;
	s1 = acx * bcy;
	c$5 = splitter * acx;
	ahi = c$5 - (c$5 - acx);
	alo = acx - ahi;
	c$5 = splitter * bcy;
	bhi = c$5 - (c$5 - bcy);
	blo = bcy - bhi;
	s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
	t1$2 = acy * bcx;
	c$5 = splitter * acy;
	ahi = c$5 - (c$5 - acy);
	alo = acy - ahi;
	c$5 = splitter * bcx;
	bhi = c$5 - (c$5 - bcx);
	blo = bcx - bhi;
	t0$2 = alo * blo - (t1$2 - ahi * bhi - alo * bhi - ahi * blo);
	_i = s0 - t0$2;
	bvirt = s0 - _i;
	B[0] = s0 - (_i + bvirt) + (bvirt - t0$2);
	_j = s1 + _i;
	bvirt = _j - s1;
	_0 = s1 - (_j - bvirt) + (_i - bvirt);
	_i = _0 - t1$2;
	bvirt = _0 - _i;
	B[1] = _0 - (_i + bvirt) + (bvirt - t1$2);
	u3 = _j + _i;
	bvirt = u3 - _j;
	B[2] = _j - (u3 - bvirt) + (_i - bvirt);
	B[3] = u3;
	let det = estimate(4, B);
	let errbound = ccwerrboundB * detsum;
	if (det >= errbound || -det >= errbound) return det;
	bvirt = ax - acx;
	acxtail = ax - (acx + bvirt) + (bvirt - cx);
	bvirt = bx - bcx;
	bcxtail = bx - (bcx + bvirt) + (bvirt - cx);
	bvirt = ay - acy;
	acytail = ay - (acy + bvirt) + (bvirt - cy);
	bvirt = by - bcy;
	bcytail = by - (bcy + bvirt) + (bvirt - cy);
	if (acxtail === 0 && acytail === 0 && bcxtail === 0 && bcytail === 0) return det;
	errbound = ccwerrboundC * detsum + resulterrbound * Math.abs(det);
	det += acx * bcytail + bcy * acxtail - (acy * bcxtail + bcx * acytail);
	if (det >= errbound || -det >= errbound) return det;
	s1 = acxtail * bcy;
	c$5 = splitter * acxtail;
	ahi = c$5 - (c$5 - acxtail);
	alo = acxtail - ahi;
	c$5 = splitter * bcy;
	bhi = c$5 - (c$5 - bcy);
	blo = bcy - bhi;
	s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
	t1$2 = acytail * bcx;
	c$5 = splitter * acytail;
	ahi = c$5 - (c$5 - acytail);
	alo = acytail - ahi;
	c$5 = splitter * bcx;
	bhi = c$5 - (c$5 - bcx);
	blo = bcx - bhi;
	t0$2 = alo * blo - (t1$2 - ahi * bhi - alo * bhi - ahi * blo);
	_i = s0 - t0$2;
	bvirt = s0 - _i;
	u$2[0] = s0 - (_i + bvirt) + (bvirt - t0$2);
	_j = s1 + _i;
	bvirt = _j - s1;
	_0 = s1 - (_j - bvirt) + (_i - bvirt);
	_i = _0 - t1$2;
	bvirt = _0 - _i;
	u$2[1] = _0 - (_i + bvirt) + (bvirt - t1$2);
	u3 = _j + _i;
	bvirt = u3 - _j;
	u$2[2] = _j - (u3 - bvirt) + (_i - bvirt);
	u$2[3] = u3;
	const C1len = sum$2(4, B, 4, u$2, C1);
	s1 = acx * bcytail;
	c$5 = splitter * acx;
	ahi = c$5 - (c$5 - acx);
	alo = acx - ahi;
	c$5 = splitter * bcytail;
	bhi = c$5 - (c$5 - bcytail);
	blo = bcytail - bhi;
	s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
	t1$2 = acy * bcxtail;
	c$5 = splitter * acy;
	ahi = c$5 - (c$5 - acy);
	alo = acy - ahi;
	c$5 = splitter * bcxtail;
	bhi = c$5 - (c$5 - bcxtail);
	blo = bcxtail - bhi;
	t0$2 = alo * blo - (t1$2 - ahi * bhi - alo * bhi - ahi * blo);
	_i = s0 - t0$2;
	bvirt = s0 - _i;
	u$2[0] = s0 - (_i + bvirt) + (bvirt - t0$2);
	_j = s1 + _i;
	bvirt = _j - s1;
	_0 = s1 - (_j - bvirt) + (_i - bvirt);
	_i = _0 - t1$2;
	bvirt = _0 - _i;
	u$2[1] = _0 - (_i + bvirt) + (bvirt - t1$2);
	u3 = _j + _i;
	bvirt = u3 - _j;
	u$2[2] = _j - (u3 - bvirt) + (_i - bvirt);
	u$2[3] = u3;
	const C2len = sum$2(C1len, C1, 4, u$2, C2);
	s1 = acxtail * bcytail;
	c$5 = splitter * acxtail;
	ahi = c$5 - (c$5 - acxtail);
	alo = acxtail - ahi;
	c$5 = splitter * bcytail;
	bhi = c$5 - (c$5 - bcytail);
	blo = bcytail - bhi;
	s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
	t1$2 = acytail * bcxtail;
	c$5 = splitter * acytail;
	ahi = c$5 - (c$5 - acytail);
	alo = acytail - ahi;
	c$5 = splitter * bcxtail;
	bhi = c$5 - (c$5 - bcxtail);
	blo = bcxtail - bhi;
	t0$2 = alo * blo - (t1$2 - ahi * bhi - alo * bhi - ahi * blo);
	_i = s0 - t0$2;
	bvirt = s0 - _i;
	u$2[0] = s0 - (_i + bvirt) + (bvirt - t0$2);
	_j = s1 + _i;
	bvirt = _j - s1;
	_0 = s1 - (_j - bvirt) + (_i - bvirt);
	_i = _0 - t1$2;
	bvirt = _0 - _i;
	u$2[1] = _0 - (_i + bvirt) + (bvirt - t1$2);
	u3 = _j + _i;
	bvirt = u3 - _j;
	u$2[2] = _j - (u3 - bvirt) + (_i - bvirt);
	u$2[3] = u3;
	const Dlen = sum$2(C2len, C2, 4, u$2, D);
	return D[Dlen - 1];
}
function orient2d(ax, ay, bx, by, cx, cy) {
	const detleft = (ay - cy) * (bx - cx);
	const detright = (ax - cx) * (by - cy);
	const det = detleft - detright;
	const detsum = Math.abs(detleft + detright);
	if (Math.abs(det) >= ccwerrboundA * detsum) return det;
	return -orient2dadapt(ax, ay, bx, by, cx, cy, detsum);
}

//#endregion
//#region node_modules/robust-predicates/esm/orient3d.js
var o3derrboundA = (7 + 56 * epsilon$3) * epsilon$3;
var o3derrboundB = (3 + 28 * epsilon$3) * epsilon$3;
var o3derrboundC = (26 + 288 * epsilon$3) * epsilon$3 * epsilon$3;
var bc$2 = vec(4);
var ca$1 = vec(4);
var ab$2 = vec(4);
var at_b = vec(4);
var at_c = vec(4);
var bt_c = vec(4);
var bt_a = vec(4);
var ct_a = vec(4);
var ct_b = vec(4);
var bct$1 = vec(8);
var cat$1 = vec(8);
var abt$1 = vec(8);
var u$1 = vec(4);
var _8$2 = vec(8);
var _8b$1 = vec(8);
var _16$2 = vec(8);
var _12 = vec(12);
var fin$2 = vec(192);
var fin2$1 = vec(192);

//#endregion
//#region node_modules/robust-predicates/esm/incircle.js
var iccerrboundA = (10 + 96 * epsilon$3) * epsilon$3;
var iccerrboundB = (4 + 48 * epsilon$3) * epsilon$3;
var iccerrboundC = (44 + 576 * epsilon$3) * epsilon$3 * epsilon$3;
var bc$1 = vec(4);
var ca = vec(4);
var ab$1 = vec(4);
var aa = vec(4);
var bb = vec(4);
var cc = vec(4);
var u = vec(4);
var v = vec(4);
var axtbc = vec(8);
var aytbc = vec(8);
var bxtca = vec(8);
var bytca = vec(8);
var cxtab = vec(8);
var cytab = vec(8);
var abt = vec(8);
var bct = vec(8);
var cat = vec(8);
var abtt = vec(4);
var bctt = vec(4);
var catt = vec(4);
var _8$1 = vec(8);
var _16$1 = vec(16);
var _16b = vec(16);
var _16c = vec(16);
var _32 = vec(32);
var _32b = vec(32);
var _48$1 = vec(48);
var _64 = vec(64);
var fin$1 = vec(1152);
var fin2 = vec(1152);

//#endregion
//#region node_modules/robust-predicates/esm/insphere.js
var isperrboundA = (16 + 224 * epsilon$3) * epsilon$3;
var isperrboundB = (5 + 72 * epsilon$3) * epsilon$3;
var isperrboundC = (71 + 1408 * epsilon$3) * epsilon$3 * epsilon$3;
var ab = vec(4);
var bc = vec(4);
var cd = vec(4);
var de = vec(4);
var ea = vec(4);
var ac = vec(4);
var bd = vec(4);
var ce = vec(4);
var da = vec(4);
var eb = vec(4);
var abc = vec(24);
var bcd = vec(24);
var cde = vec(24);
var dea = vec(24);
var eab = vec(24);
var abd = vec(24);
var bce = vec(24);
var cda = vec(24);
var deb = vec(24);
var eac = vec(24);
var adet = vec(1152);
var bdet = vec(1152);
var cdet = vec(1152);
var ddet = vec(1152);
var edet = vec(1152);
var abdet = vec(2304);
var cddet = vec(2304);
var cdedet = vec(3456);
var deter = vec(5760);
var _8 = vec(8);
var _8b = vec(8);
var _8c = vec(8);
var _16 = vec(16);
var _24 = vec(24);
var _48 = vec(48);
var _48b = vec(48);
var _96 = vec(96);
var _192 = vec(192);
var _384x = vec(384);
var _384y = vec(384);
var _384z = vec(384);
var _768 = vec(768);
var xdet = vec(96);
var ydet = vec(96);
var zdet = vec(96);
var fin = vec(1152);

//#endregion
//#region node_modules/delaunator/index.js
var EPSILON = Math.pow(2, -52);
var EDGE_STACK = new Uint32Array(512);
var Delaunator = class Delaunator {
	static from(points, getX = defaultGetX, getY = defaultGetY) {
		const n = points.length;
		const coords = new Float64Array(n * 2);
		for (let i = 0; i < n; i++) {
			const p = points[i];
			coords[2 * i] = getX(p);
			coords[2 * i + 1] = getY(p);
		}
		return new Delaunator(coords);
	}
	constructor(coords) {
		const n = coords.length >> 1;
		if (n > 0 && typeof coords[0] !== "number") throw new Error("Expected coords to contain numbers.");
		this.coords = coords;
		const maxTriangles = Math.max(2 * n - 5, 0);
		this._triangles = new Uint32Array(maxTriangles * 3);
		this._halfedges = new Int32Array(maxTriangles * 3);
		this._hashSize = Math.ceil(Math.sqrt(n));
		this._hullPrev = new Uint32Array(n);
		this._hullNext = new Uint32Array(n);
		this._hullTri = new Uint32Array(n);
		this._hullHash = new Int32Array(this._hashSize);
		this._ids = new Uint32Array(n);
		this._dists = new Float64Array(n);
		this.update();
	}
	update() {
		const { coords, _hullPrev: hullPrev, _hullNext: hullNext, _hullTri: hullTri, _hullHash: hullHash } = this;
		const n = coords.length >> 1;
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY$1 = -Infinity;
		for (let i = 0; i < n; i++) {
			const x$3 = coords[2 * i];
			const y$3 = coords[2 * i + 1];
			if (x$3 < minX) minX = x$3;
			if (y$3 < minY) minY = y$3;
			if (x$3 > maxX) maxX = x$3;
			if (y$3 > maxY$1) maxY$1 = y$3;
			this._ids[i] = i;
		}
		const cx = (minX + maxX) / 2;
		const cy = (minY + maxY$1) / 2;
		let i0, i1, i2;
		for (let i = 0, minDist = Infinity; i < n; i++) {
			const d = dist(cx, cy, coords[2 * i], coords[2 * i + 1]);
			if (d < minDist) {
				i0 = i;
				minDist = d;
			}
		}
		const i0x = coords[2 * i0];
		const i0y = coords[2 * i0 + 1];
		for (let i = 0, minDist = Infinity; i < n; i++) {
			if (i === i0) continue;
			const d = dist(i0x, i0y, coords[2 * i], coords[2 * i + 1]);
			if (d < minDist && d > 0) {
				i1 = i;
				minDist = d;
			}
		}
		let i1x = coords[2 * i1];
		let i1y = coords[2 * i1 + 1];
		let minRadius = Infinity;
		for (let i = 0; i < n; i++) {
			if (i === i0 || i === i1) continue;
			const r = circumradius(i0x, i0y, i1x, i1y, coords[2 * i], coords[2 * i + 1]);
			if (r < minRadius) {
				i2 = i;
				minRadius = r;
			}
		}
		let i2x = coords[2 * i2];
		let i2y = coords[2 * i2 + 1];
		if (minRadius === Infinity) {
			for (let i = 0; i < n; i++) this._dists[i] = coords[2 * i] - coords[0] || coords[2 * i + 1] - coords[1];
			quicksort(this._ids, this._dists, 0, n - 1);
			const hull = new Uint32Array(n);
			let j = 0;
			for (let i = 0, d0 = -Infinity; i < n; i++) {
				const id$1 = this._ids[i];
				const d = this._dists[id$1];
				if (d > d0) {
					hull[j++] = id$1;
					d0 = d;
				}
			}
			this.hull = hull.subarray(0, j);
			this.triangles = new Uint32Array(0);
			this.halfedges = new Uint32Array(0);
			return;
		}
		if (orient2d(i0x, i0y, i1x, i1y, i2x, i2y) < 0) {
			const i = i1;
			const x$3 = i1x;
			const y$3 = i1y;
			i1 = i2;
			i1x = i2x;
			i1y = i2y;
			i2 = i;
			i2x = x$3;
			i2y = y$3;
		}
		const center$1 = circumcenter(i0x, i0y, i1x, i1y, i2x, i2y);
		this._cx = center$1.x;
		this._cy = center$1.y;
		for (let i = 0; i < n; i++) this._dists[i] = dist(coords[2 * i], coords[2 * i + 1], center$1.x, center$1.y);
		quicksort(this._ids, this._dists, 0, n - 1);
		this._hullStart = i0;
		let hullSize = 3;
		hullNext[i0] = hullPrev[i2] = i1;
		hullNext[i1] = hullPrev[i0] = i2;
		hullNext[i2] = hullPrev[i1] = i0;
		hullTri[i0] = 0;
		hullTri[i1] = 1;
		hullTri[i2] = 2;
		hullHash.fill(-1);
		hullHash[this._hashKey(i0x, i0y)] = i0;
		hullHash[this._hashKey(i1x, i1y)] = i1;
		hullHash[this._hashKey(i2x, i2y)] = i2;
		this.trianglesLen = 0;
		this._addTriangle(i0, i1, i2, -1, -1, -1);
		for (let k$1 = 0, xp, yp; k$1 < this._ids.length; k$1++) {
			const i = this._ids[k$1];
			const x$3 = coords[2 * i];
			const y$3 = coords[2 * i + 1];
			if (k$1 > 0 && Math.abs(x$3 - xp) <= EPSILON && Math.abs(y$3 - yp) <= EPSILON) continue;
			xp = x$3;
			yp = y$3;
			if (i === i0 || i === i1 || i === i2) continue;
			let start$1 = 0;
			for (let j = 0, key = this._hashKey(x$3, y$3); j < this._hashSize; j++) {
				start$1 = hullHash[(key + j) % this._hashSize];
				if (start$1 !== -1 && start$1 !== hullNext[start$1]) break;
			}
			start$1 = hullPrev[start$1];
			let e = start$1, q;
			while (q = hullNext[e], orient2d(x$3, y$3, coords[2 * e], coords[2 * e + 1], coords[2 * q], coords[2 * q + 1]) >= 0) {
				e = q;
				if (e === start$1) {
					e = -1;
					break;
				}
			}
			if (e === -1) continue;
			let t = this._addTriangle(e, i, hullNext[e], -1, -1, hullTri[e]);
			hullTri[i] = this._legalize(t + 2);
			hullTri[e] = t;
			hullSize++;
			let n$1 = hullNext[e];
			while (q = hullNext[n$1], orient2d(x$3, y$3, coords[2 * n$1], coords[2 * n$1 + 1], coords[2 * q], coords[2 * q + 1]) < 0) {
				t = this._addTriangle(n$1, i, q, hullTri[i], -1, hullTri[n$1]);
				hullTri[i] = this._legalize(t + 2);
				hullNext[n$1] = n$1;
				hullSize--;
				n$1 = q;
			}
			if (e === start$1) while (q = hullPrev[e], orient2d(x$3, y$3, coords[2 * q], coords[2 * q + 1], coords[2 * e], coords[2 * e + 1]) < 0) {
				t = this._addTriangle(q, i, e, -1, hullTri[e], hullTri[q]);
				this._legalize(t + 2);
				hullTri[q] = t;
				hullNext[e] = e;
				hullSize--;
				e = q;
			}
			this._hullStart = hullPrev[i] = e;
			hullNext[e] = hullPrev[n$1] = i;
			hullNext[i] = n$1;
			hullHash[this._hashKey(x$3, y$3)] = i;
			hullHash[this._hashKey(coords[2 * e], coords[2 * e + 1])] = e;
		}
		this.hull = new Uint32Array(hullSize);
		for (let i = 0, e = this._hullStart; i < hullSize; i++) {
			this.hull[i] = e;
			e = hullNext[e];
		}
		this.triangles = this._triangles.subarray(0, this.trianglesLen);
		this.halfedges = this._halfedges.subarray(0, this.trianglesLen);
	}
	_hashKey(x$3, y$3) {
		return Math.floor(pseudoAngle(x$3 - this._cx, y$3 - this._cy) * this._hashSize) % this._hashSize;
	}
	_legalize(a$3) {
		const { _triangles: triangles, _halfedges: halfedges, coords } = this;
		let i = 0;
		let ar = 0;
		while (true) {
			const b = halfedges[a$3];
			const a0 = a$3 - a$3 % 3;
			ar = a0 + (a$3 + 2) % 3;
			if (b === -1) {
				if (i === 0) break;
				a$3 = EDGE_STACK[--i];
				continue;
			}
			const b0$1 = b - b % 3;
			const al = a0 + (a$3 + 1) % 3;
			const bl = b0$1 + (b + 2) % 3;
			const p0$1 = triangles[ar];
			const pr = triangles[a$3];
			const pl = triangles[al];
			const p1 = triangles[bl];
			if (inCircle(coords[2 * p0$1], coords[2 * p0$1 + 1], coords[2 * pr], coords[2 * pr + 1], coords[2 * pl], coords[2 * pl + 1], coords[2 * p1], coords[2 * p1 + 1])) {
				triangles[a$3] = p1;
				triangles[b] = p0$1;
				const hbl = halfedges[bl];
				if (hbl === -1) {
					let e = this._hullStart;
					do {
						if (this._hullTri[e] === bl) {
							this._hullTri[e] = a$3;
							break;
						}
						e = this._hullPrev[e];
					} while (e !== this._hullStart);
				}
				this._link(a$3, hbl);
				this._link(b, halfedges[ar]);
				this._link(ar, bl);
				const br = b0$1 + (b + 1) % 3;
				if (i < EDGE_STACK.length) EDGE_STACK[i++] = br;
			} else {
				if (i === 0) break;
				a$3 = EDGE_STACK[--i];
			}
		}
		return ar;
	}
	_link(a$3, b) {
		this._halfedges[a$3] = b;
		if (b !== -1) this._halfedges[b] = a$3;
	}
	_addTriangle(i0, i1, i2, a$3, b, c$5) {
		const t = this.trianglesLen;
		this._triangles[t] = i0;
		this._triangles[t + 1] = i1;
		this._triangles[t + 2] = i2;
		this._link(t, a$3);
		this._link(t + 1, b);
		this._link(t + 2, c$5);
		this.trianglesLen += 3;
		return t;
	}
};
function pseudoAngle(dx, dy) {
	const p = dx / (Math.abs(dx) + Math.abs(dy));
	return (dy > 0 ? 3 - p : 1 + p) / 4;
}
function dist(ax, ay, bx, by) {
	const dx = ax - bx;
	const dy = ay - by;
	return dx * dx + dy * dy;
}
function inCircle(ax, ay, bx, by, cx, cy, px, py) {
	const dx = ax - px;
	const dy = ay - py;
	const ex = bx - px;
	const ey = by - py;
	const fx = cx - px;
	const fy = cy - py;
	const ap = dx * dx + dy * dy;
	const bp = ex * ex + ey * ey;
	const cp = fx * fx + fy * fy;
	return dx * (ey * cp - bp * fy) - dy * (ex * cp - bp * fx) + ap * (ex * fy - ey * fx) < 0;
}
function circumradius(ax, ay, bx, by, cx, cy) {
	const dx = bx - ax;
	const dy = by - ay;
	const ex = cx - ax;
	const ey = cy - ay;
	const bl = dx * dx + dy * dy;
	const cl = ex * ex + ey * ey;
	const d = .5 / (dx * ey - dy * ex);
	const x$3 = (ey * bl - dy * cl) * d;
	const y$3 = (dx * cl - ex * bl) * d;
	return x$3 * x$3 + y$3 * y$3;
}
function circumcenter(ax, ay, bx, by, cx, cy) {
	const dx = bx - ax;
	const dy = by - ay;
	const ex = cx - ax;
	const ey = cy - ay;
	const bl = dx * dx + dy * dy;
	const cl = ex * ex + ey * ey;
	const d = .5 / (dx * ey - dy * ex);
	const x$3 = ax + (ey * bl - dy * cl) * d;
	const y$3 = ay + (dx * cl - ex * bl) * d;
	return {
		x: x$3,
		y: y$3
	};
}
function quicksort(ids, dists, left$1, right$1) {
	if (right$1 - left$1 <= 20) for (let i = left$1 + 1; i <= right$1; i++) {
		const temp = ids[i];
		const tempDist = dists[temp];
		let j = i - 1;
		while (j >= left$1 && dists[ids[j]] > tempDist) ids[j + 1] = ids[j--];
		ids[j + 1] = temp;
	}
	else {
		const median$1 = left$1 + right$1 >> 1;
		let i = left$1 + 1;
		let j = right$1;
		swap(ids, median$1, i);
		if (dists[ids[left$1]] > dists[ids[right$1]]) swap(ids, left$1, right$1);
		if (dists[ids[i]] > dists[ids[right$1]]) swap(ids, i, right$1);
		if (dists[ids[left$1]] > dists[ids[i]]) swap(ids, left$1, i);
		const temp = ids[i];
		const tempDist = dists[temp];
		while (true) {
			do
				i++;
			while (dists[ids[i]] < tempDist);
			do
				j--;
			while (dists[ids[j]] > tempDist);
			if (j < i) break;
			swap(ids, i, j);
		}
		ids[left$1 + 1] = ids[j];
		ids[j] = temp;
		if (right$1 - i + 1 >= j - left$1) {
			quicksort(ids, dists, i, right$1);
			quicksort(ids, dists, left$1, j - 1);
		} else {
			quicksort(ids, dists, left$1, j - 1);
			quicksort(ids, dists, i, right$1);
		}
	}
}
function swap(arr, i, j) {
	const tmp = arr[i];
	arr[i] = arr[j];
	arr[j] = tmp;
}
function defaultGetX(p) {
	return p[0];
}
function defaultGetY(p) {
	return p[1];
}

//#endregion
//#region node_modules/d3-delaunay/src/path.js
var epsilon$2 = 1e-6;
var Path$1 = class {
	constructor() {
		this._x0 = this._y0 = this._x1 = this._y1 = null;
		this._ = "";
	}
	moveTo(x$3, y$3) {
		this._ += `M${this._x0 = this._x1 = +x$3},${this._y0 = this._y1 = +y$3}`;
	}
	closePath() {
		if (this._x1 !== null) {
			this._x1 = this._x0, this._y1 = this._y0;
			this._ += "Z";
		}
	}
	lineTo(x$3, y$3) {
		this._ += `L${this._x1 = +x$3},${this._y1 = +y$3}`;
	}
	arc(x$3, y$3, r) {
		x$3 = +x$3, y$3 = +y$3, r = +r;
		const x0$5 = x$3 + r;
		const y0$5 = y$3;
		if (r < 0) throw new Error("negative radius");
		if (this._x1 === null) this._ += `M${x0$5},${y0$5}`;
		else if (Math.abs(this._x1 - x0$5) > epsilon$2 || Math.abs(this._y1 - y0$5) > epsilon$2) this._ += "L" + x0$5 + "," + y0$5;
		if (!r) return;
		this._ += `A${r},${r},0,1,1,${x$3 - r},${y$3}A${r},${r},0,1,1,${this._x1 = x0$5},${this._y1 = y0$5}`;
	}
	rect(x$3, y$3, w, h) {
		this._ += `M${this._x0 = this._x1 = +x$3},${this._y0 = this._y1 = +y$3}h${+w}v${+h}h${-w}Z`;
	}
	value() {
		return this._ || null;
	}
};

//#endregion
//#region node_modules/d3-delaunay/src/polygon.js
var Polygon = class {
	constructor() {
		this._ = [];
	}
	moveTo(x$3, y$3) {
		this._.push([x$3, y$3]);
	}
	closePath() {
		this._.push(this._[0].slice());
	}
	lineTo(x$3, y$3) {
		this._.push([x$3, y$3]);
	}
	value() {
		return this._.length ? this._ : null;
	}
};

//#endregion
//#region node_modules/d3-delaunay/src/voronoi.js
var Voronoi = class {
	constructor(delaunay, [xmin, ymin, xmax, ymax] = [
		0,
		0,
		960,
		500
	]) {
		if (!((xmax = +xmax) >= (xmin = +xmin)) || !((ymax = +ymax) >= (ymin = +ymin))) throw new Error("invalid bounds");
		this.delaunay = delaunay;
		this._circumcenters = new Float64Array(delaunay.points.length * 2);
		this.vectors = new Float64Array(delaunay.points.length * 2);
		this.xmax = xmax, this.xmin = xmin;
		this.ymax = ymax, this.ymin = ymin;
		this._init();
	}
	update() {
		this.delaunay.update();
		this._init();
		return this;
	}
	_init() {
		const { delaunay: { points, hull, triangles }, vectors } = this;
		let bx, by;
		const circumcenters = this.circumcenters = this._circumcenters.subarray(0, triangles.length / 3 * 2);
		for (let i = 0, j = 0, n = triangles.length, x$3, y$3; i < n; i += 3, j += 2) {
			const t1$2 = triangles[i] * 2;
			const t2$1 = triangles[i + 1] * 2;
			const t3$1 = triangles[i + 2] * 2;
			const x1$2 = points[t1$2];
			const y1$2 = points[t1$2 + 1];
			const x2 = points[t2$1];
			const y2 = points[t2$1 + 1];
			const x3 = points[t3$1];
			const y3 = points[t3$1 + 1];
			const dx = x2 - x1$2;
			const dy = y2 - y1$2;
			const ex = x3 - x1$2;
			const ey = y3 - y1$2;
			const ab$3 = (dx * ey - dy * ex) * 2;
			if (Math.abs(ab$3) < 1e-9) {
				if (bx === void 0) {
					bx = by = 0;
					for (const i$1 of hull) bx += points[i$1 * 2], by += points[i$1 * 2 + 1];
					bx /= hull.length, by /= hull.length;
				}
				const a$3 = 1e9 * Math.sign((bx - x1$2) * ey - (by - y1$2) * ex);
				x$3 = (x1$2 + x3) / 2 - a$3 * ey;
				y$3 = (y1$2 + y3) / 2 + a$3 * ex;
			} else {
				const d = 1 / ab$3;
				const bl = dx * dx + dy * dy;
				const cl = ex * ex + ey * ey;
				x$3 = x1$2 + (ey * bl - dy * cl) * d;
				y$3 = y1$2 + (dx * cl - ex * bl) * d;
			}
			circumcenters[j] = x$3;
			circumcenters[j + 1] = y$3;
		}
		let h = hull[hull.length - 1];
		let p0$1, p1 = h * 4;
		let x0$5, x1$1 = points[2 * h];
		let y0$5, y1$1 = points[2 * h + 1];
		vectors.fill(0);
		for (let i = 0; i < hull.length; ++i) {
			h = hull[i];
			p0$1 = p1, x0$5 = x1$1, y0$5 = y1$1;
			p1 = h * 4, x1$1 = points[2 * h], y1$1 = points[2 * h + 1];
			vectors[p0$1 + 2] = vectors[p1] = y0$5 - y1$1;
			vectors[p0$1 + 3] = vectors[p1 + 1] = x1$1 - x0$5;
		}
	}
	render(context) {
		const buffer = context == null ? context = new Path$1() : void 0;
		const { delaunay: { halfedges, inedges, hull }, circumcenters, vectors } = this;
		if (hull.length <= 1) return null;
		for (let i = 0, n = halfedges.length; i < n; ++i) {
			const j = halfedges[i];
			if (j < i) continue;
			const ti = Math.floor(i / 3) * 2;
			const tj = Math.floor(j / 3) * 2;
			const xi = circumcenters[ti];
			const yi = circumcenters[ti + 1];
			const xj = circumcenters[tj];
			const yj = circumcenters[tj + 1];
			this._renderSegment(xi, yi, xj, yj, context);
		}
		let h0, h1 = hull[hull.length - 1];
		for (let i = 0; i < hull.length; ++i) {
			h0 = h1, h1 = hull[i];
			const t = Math.floor(inedges[h1] / 3) * 2;
			const x$3 = circumcenters[t];
			const y$3 = circumcenters[t + 1];
			const v$1 = h0 * 4;
			const p = this._project(x$3, y$3, vectors[v$1 + 2], vectors[v$1 + 3]);
			if (p) this._renderSegment(x$3, y$3, p[0], p[1], context);
		}
		return buffer && buffer.value();
	}
	renderBounds(context) {
		const buffer = context == null ? context = new Path$1() : void 0;
		context.rect(this.xmin, this.ymin, this.xmax - this.xmin, this.ymax - this.ymin);
		return buffer && buffer.value();
	}
	renderCell(i, context) {
		const buffer = context == null ? context = new Path$1() : void 0;
		const points = this._clip(i);
		if (points === null || !points.length) return;
		context.moveTo(points[0], points[1]);
		let n = points.length;
		while (points[0] === points[n - 2] && points[1] === points[n - 1] && n > 1) n -= 2;
		for (let i$1 = 2; i$1 < n; i$1 += 2) if (points[i$1] !== points[i$1 - 2] || points[i$1 + 1] !== points[i$1 - 1]) context.lineTo(points[i$1], points[i$1 + 1]);
		context.closePath();
		return buffer && buffer.value();
	}
	*cellPolygons() {
		const { delaunay: { points } } = this;
		for (let i = 0, n = points.length / 2; i < n; ++i) {
			const cell = this.cellPolygon(i);
			if (cell) cell.index = i, yield cell;
		}
	}
	cellPolygon(i) {
		const polygon = new Polygon();
		this.renderCell(i, polygon);
		return polygon.value();
	}
	_renderSegment(x0$5, y0$5, x1$1, y1$1, context) {
		let S;
		const c0 = this._regioncode(x0$5, y0$5);
		const c1 = this._regioncode(x1$1, y1$1);
		if (c0 === 0 && c1 === 0) {
			context.moveTo(x0$5, y0$5);
			context.lineTo(x1$1, y1$1);
		} else if (S = this._clipSegment(x0$5, y0$5, x1$1, y1$1, c0, c1)) {
			context.moveTo(S[0], S[1]);
			context.lineTo(S[2], S[3]);
		}
	}
	contains(i, x$3, y$3) {
		if ((x$3 = +x$3, x$3 !== x$3) || (y$3 = +y$3, y$3 !== y$3)) return false;
		return this.delaunay._step(i, x$3, y$3) === i;
	}
	*neighbors(i) {
		const ci = this._clip(i);
		if (ci) for (const j of this.delaunay.neighbors(i)) {
			const cj = this._clip(j);
			if (cj) {
				loop: for (let ai = 0, li = ci.length; ai < li; ai += 2) for (let aj = 0, lj = cj.length; aj < lj; aj += 2) if (ci[ai] === cj[aj] && ci[ai + 1] === cj[aj + 1] && ci[(ai + 2) % li] === cj[(aj + lj - 2) % lj] && ci[(ai + 3) % li] === cj[(aj + lj - 1) % lj]) {
					yield j;
					break loop;
				}
			}
		}
	}
	_cell(i) {
		const { circumcenters, delaunay: { inedges, halfedges, triangles } } = this;
		const e0 = inedges[i];
		if (e0 === -1) return null;
		const points = [];
		let e = e0;
		do {
			const t = Math.floor(e / 3);
			points.push(circumcenters[t * 2], circumcenters[t * 2 + 1]);
			e = e % 3 === 2 ? e - 2 : e + 1;
			if (triangles[e] !== i) break;
			e = halfedges[e];
		} while (e !== e0 && e !== -1);
		return points;
	}
	_clip(i) {
		if (i === 0 && this.delaunay.hull.length === 1) return [
			this.xmax,
			this.ymin,
			this.xmax,
			this.ymax,
			this.xmin,
			this.ymax,
			this.xmin,
			this.ymin
		];
		const points = this._cell(i);
		if (points === null) return null;
		const { vectors: V } = this;
		const v$1 = i * 4;
		return this._simplify(V[v$1] || V[v$1 + 1] ? this._clipInfinite(i, points, V[v$1], V[v$1 + 1], V[v$1 + 2], V[v$1 + 3]) : this._clipFinite(i, points));
	}
	_clipFinite(i, points) {
		const n = points.length;
		let P = null;
		let x0$5, y0$5, x1$1 = points[n - 2], y1$1 = points[n - 1];
		let c0, c1 = this._regioncode(x1$1, y1$1);
		let e0, e1 = 0;
		for (let j = 0; j < n; j += 2) {
			x0$5 = x1$1, y0$5 = y1$1, x1$1 = points[j], y1$1 = points[j + 1];
			c0 = c1, c1 = this._regioncode(x1$1, y1$1);
			if (c0 === 0 && c1 === 0) {
				e0 = e1, e1 = 0;
				if (P) P.push(x1$1, y1$1);
				else P = [x1$1, y1$1];
			} else {
				let S, sx0, sy0, sx1, sy1;
				if (c0 === 0) {
					if ((S = this._clipSegment(x0$5, y0$5, x1$1, y1$1, c0, c1)) === null) continue;
					[sx0, sy0, sx1, sy1] = S;
				} else {
					if ((S = this._clipSegment(x1$1, y1$1, x0$5, y0$5, c1, c0)) === null) continue;
					[sx1, sy1, sx0, sy0] = S;
					e0 = e1, e1 = this._edgecode(sx0, sy0);
					if (e0 && e1) this._edge(i, e0, e1, P, P.length);
					if (P) P.push(sx0, sy0);
					else P = [sx0, sy0];
				}
				e0 = e1, e1 = this._edgecode(sx1, sy1);
				if (e0 && e1) this._edge(i, e0, e1, P, P.length);
				if (P) P.push(sx1, sy1);
				else P = [sx1, sy1];
			}
		}
		if (P) {
			e0 = e1, e1 = this._edgecode(P[0], P[1]);
			if (e0 && e1) this._edge(i, e0, e1, P, P.length);
		} else if (this.contains(i, (this.xmin + this.xmax) / 2, (this.ymin + this.ymax) / 2)) return [
			this.xmax,
			this.ymin,
			this.xmax,
			this.ymax,
			this.xmin,
			this.ymax,
			this.xmin,
			this.ymin
		];
		return P;
	}
	_clipSegment(x0$5, y0$5, x1$1, y1$1, c0, c1) {
		const flip = c0 < c1;
		if (flip) [x0$5, y0$5, x1$1, y1$1, c0, c1] = [
			x1$1,
			y1$1,
			x0$5,
			y0$5,
			c1,
			c0
		];
		while (true) {
			if (c0 === 0 && c1 === 0) return flip ? [
				x1$1,
				y1$1,
				x0$5,
				y0$5
			] : [
				x0$5,
				y0$5,
				x1$1,
				y1$1
			];
			if (c0 & c1) return null;
			let x$3, y$3, c$5 = c0 || c1;
			if (c$5 & 8) x$3 = x0$5 + (x1$1 - x0$5) * (this.ymax - y0$5) / (y1$1 - y0$5), y$3 = this.ymax;
			else if (c$5 & 4) x$3 = x0$5 + (x1$1 - x0$5) * (this.ymin - y0$5) / (y1$1 - y0$5), y$3 = this.ymin;
			else if (c$5 & 2) y$3 = y0$5 + (y1$1 - y0$5) * (this.xmax - x0$5) / (x1$1 - x0$5), x$3 = this.xmax;
			else y$3 = y0$5 + (y1$1 - y0$5) * (this.xmin - x0$5) / (x1$1 - x0$5), x$3 = this.xmin;
			if (c0) x0$5 = x$3, y0$5 = y$3, c0 = this._regioncode(x0$5, y0$5);
			else x1$1 = x$3, y1$1 = y$3, c1 = this._regioncode(x1$1, y1$1);
		}
	}
	_clipInfinite(i, points, vx0, vy0, vxn, vyn) {
		let P = Array.from(points), p;
		if (p = this._project(P[0], P[1], vx0, vy0)) P.unshift(p[0], p[1]);
		if (p = this._project(P[P.length - 2], P[P.length - 1], vxn, vyn)) P.push(p[0], p[1]);
		if (P = this._clipFinite(i, P)) for (let j = 0, n = P.length, c0, c1 = this._edgecode(P[n - 2], P[n - 1]); j < n; j += 2) {
			c0 = c1, c1 = this._edgecode(P[j], P[j + 1]);
			if (c0 && c1) j = this._edge(i, c0, c1, P, j), n = P.length;
		}
		else if (this.contains(i, (this.xmin + this.xmax) / 2, (this.ymin + this.ymax) / 2)) P = [
			this.xmin,
			this.ymin,
			this.xmax,
			this.ymin,
			this.xmax,
			this.ymax,
			this.xmin,
			this.ymax
		];
		return P;
	}
	_edge(i, e0, e1, P, j) {
		while (e0 !== e1) {
			let x$3, y$3;
			switch (e0) {
				case 5:
					e0 = 4;
					continue;
				case 4:
					e0 = 6, x$3 = this.xmax, y$3 = this.ymin;
					break;
				case 6:
					e0 = 2;
					continue;
				case 2:
					e0 = 10, x$3 = this.xmax, y$3 = this.ymax;
					break;
				case 10:
					e0 = 8;
					continue;
				case 8:
					e0 = 9, x$3 = this.xmin, y$3 = this.ymax;
					break;
				case 9:
					e0 = 1;
					continue;
				case 1:
					e0 = 5, x$3 = this.xmin, y$3 = this.ymin;
					break;
			}
			if ((P[j] !== x$3 || P[j + 1] !== y$3) && this.contains(i, x$3, y$3)) P.splice(j, 0, x$3, y$3), j += 2;
		}
		return j;
	}
	_project(x0$5, y0$5, vx, vy) {
		let t = Infinity, c$5, x$3, y$3;
		if (vy < 0) {
			if (y0$5 <= this.ymin) return null;
			if ((c$5 = (this.ymin - y0$5) / vy) < t) y$3 = this.ymin, x$3 = x0$5 + (t = c$5) * vx;
		} else if (vy > 0) {
			if (y0$5 >= this.ymax) return null;
			if ((c$5 = (this.ymax - y0$5) / vy) < t) y$3 = this.ymax, x$3 = x0$5 + (t = c$5) * vx;
		}
		if (vx > 0) {
			if (x0$5 >= this.xmax) return null;
			if ((c$5 = (this.xmax - x0$5) / vx) < t) x$3 = this.xmax, y$3 = y0$5 + (t = c$5) * vy;
		} else if (vx < 0) {
			if (x0$5 <= this.xmin) return null;
			if ((c$5 = (this.xmin - x0$5) / vx) < t) x$3 = this.xmin, y$3 = y0$5 + (t = c$5) * vy;
		}
		return [x$3, y$3];
	}
	_edgecode(x$3, y$3) {
		return (x$3 === this.xmin ? 1 : x$3 === this.xmax ? 2 : 0) | (y$3 === this.ymin ? 4 : y$3 === this.ymax ? 8 : 0);
	}
	_regioncode(x$3, y$3) {
		return (x$3 < this.xmin ? 1 : x$3 > this.xmax ? 2 : 0) | (y$3 < this.ymin ? 4 : y$3 > this.ymax ? 8 : 0);
	}
	_simplify(P) {
		if (P && P.length > 4) {
			for (let i = 0; i < P.length; i += 2) {
				const j = (i + 2) % P.length, k$1 = (i + 4) % P.length;
				if (P[i] === P[j] && P[j] === P[k$1] || P[i + 1] === P[j + 1] && P[j + 1] === P[k$1 + 1]) P.splice(j, 2), i -= 2;
			}
			if (!P.length) P = null;
		}
		return P;
	}
};

//#endregion
//#region node_modules/d3-delaunay/src/delaunay.js
var tau$2 = 2 * Math.PI, pow$2 = Math.pow;
function pointX(p) {
	return p[0];
}
function pointY(p) {
	return p[1];
}
function collinear(d) {
	const { triangles, coords } = d;
	for (let i = 0; i < triangles.length; i += 3) {
		const a$3 = 2 * triangles[i], b = 2 * triangles[i + 1], c$5 = 2 * triangles[i + 2];
		if ((coords[c$5] - coords[a$3]) * (coords[b + 1] - coords[a$3 + 1]) - (coords[b] - coords[a$3]) * (coords[c$5 + 1] - coords[a$3 + 1]) > 1e-10) return false;
	}
	return true;
}
function jitter(x$3, y$3, r) {
	return [x$3 + Math.sin(x$3 + y$3) * r, y$3 + Math.cos(x$3 - y$3) * r];
}
var Delaunay = class Delaunay {
	static from(points, fx = pointX, fy = pointY, that) {
		return new Delaunay("length" in points ? flatArray(points, fx, fy, that) : Float64Array.from(flatIterable(points, fx, fy, that)));
	}
	constructor(points) {
		this._delaunator = new Delaunator(points);
		this.inedges = new Int32Array(points.length / 2);
		this._hullIndex = new Int32Array(points.length / 2);
		this.points = this._delaunator.coords;
		this._init();
	}
	update() {
		this._delaunator.update();
		this._init();
		return this;
	}
	_init() {
		const d = this._delaunator, points = this.points;
		if (d.hull && d.hull.length > 2 && collinear(d)) {
			this.collinear = Int32Array.from({ length: points.length / 2 }, (_, i) => i).sort((i, j) => points[2 * i] - points[2 * j] || points[2 * i + 1] - points[2 * j + 1]);
			const e = this.collinear[0], f = this.collinear[this.collinear.length - 1], bounds = [
				points[2 * e],
				points[2 * e + 1],
				points[2 * f],
				points[2 * f + 1]
			], r = 1e-8 * Math.hypot(bounds[3] - bounds[1], bounds[2] - bounds[0]);
			for (let i = 0, n = points.length / 2; i < n; ++i) {
				const p = jitter(points[2 * i], points[2 * i + 1], r);
				points[2 * i] = p[0];
				points[2 * i + 1] = p[1];
			}
			this._delaunator = new Delaunator(points);
		} else delete this.collinear;
		const halfedges = this.halfedges = this._delaunator.halfedges;
		const hull = this.hull = this._delaunator.hull;
		const triangles = this.triangles = this._delaunator.triangles;
		const inedges = this.inedges.fill(-1);
		const hullIndex = this._hullIndex.fill(-1);
		for (let e = 0, n = halfedges.length; e < n; ++e) {
			const p = triangles[e % 3 === 2 ? e - 2 : e + 1];
			if (halfedges[e] === -1 || inedges[p] === -1) inedges[p] = e;
		}
		for (let i = 0, n = hull.length; i < n; ++i) hullIndex[hull[i]] = i;
		if (hull.length <= 2 && hull.length > 0) {
			this.triangles = new Int32Array(3).fill(-1);
			this.halfedges = new Int32Array(3).fill(-1);
			this.triangles[0] = hull[0];
			inedges[hull[0]] = 1;
			if (hull.length === 2) {
				inedges[hull[1]] = 0;
				this.triangles[1] = hull[1];
				this.triangles[2] = hull[1];
			}
		}
	}
	voronoi(bounds) {
		return new Voronoi(this, bounds);
	}
	*neighbors(i) {
		const { inedges, hull, _hullIndex, halfedges, triangles, collinear: collinear$2 } = this;
		if (collinear$2) {
			const l = collinear$2.indexOf(i);
			if (l > 0) yield collinear$2[l - 1];
			if (l < collinear$2.length - 1) yield collinear$2[l + 1];
			return;
		}
		const e0 = inedges[i];
		if (e0 === -1) return;
		let e = e0, p0$1 = -1;
		do {
			yield p0$1 = triangles[e];
			e = e % 3 === 2 ? e - 2 : e + 1;
			if (triangles[e] !== i) return;
			e = halfedges[e];
			if (e === -1) {
				const p = hull[(_hullIndex[i] + 1) % hull.length];
				if (p !== p0$1) yield p;
				return;
			}
		} while (e !== e0);
	}
	find(x$3, y$3, i = 0) {
		if ((x$3 = +x$3, x$3 !== x$3) || (y$3 = +y$3, y$3 !== y$3)) return -1;
		const i0 = i;
		let c$5;
		while ((c$5 = this._step(i, x$3, y$3)) >= 0 && c$5 !== i && c$5 !== i0) i = c$5;
		return c$5;
	}
	_step(i, x$3, y$3) {
		const { inedges, hull, _hullIndex, halfedges, triangles, points } = this;
		if (inedges[i] === -1 || !points.length) return (i + 1) % (points.length >> 1);
		let c$5 = i;
		let dc = pow$2(x$3 - points[i * 2], 2) + pow$2(y$3 - points[i * 2 + 1], 2);
		const e0 = inedges[i];
		let e = e0;
		do {
			let t = triangles[e];
			const dt = pow$2(x$3 - points[t * 2], 2) + pow$2(y$3 - points[t * 2 + 1], 2);
			if (dt < dc) dc = dt, c$5 = t;
			e = e % 3 === 2 ? e - 2 : e + 1;
			if (triangles[e] !== i) break;
			e = halfedges[e];
			if (e === -1) {
				e = hull[(_hullIndex[i] + 1) % hull.length];
				if (e !== t) {
					if (pow$2(x$3 - points[e * 2], 2) + pow$2(y$3 - points[e * 2 + 1], 2) < dc) return e;
				}
				break;
			}
		} while (e !== e0);
		return c$5;
	}
	render(context) {
		const buffer = context == null ? context = new Path$1() : void 0;
		const { points, halfedges, triangles } = this;
		for (let i = 0, n = halfedges.length; i < n; ++i) {
			const j = halfedges[i];
			if (j < i) continue;
			const ti = triangles[i] * 2;
			const tj = triangles[j] * 2;
			context.moveTo(points[ti], points[ti + 1]);
			context.lineTo(points[tj], points[tj + 1]);
		}
		this.renderHull(context);
		return buffer && buffer.value();
	}
	renderPoints(context, r) {
		if (r === void 0 && (!context || typeof context.moveTo !== "function")) r = context, context = null;
		r = r == void 0 ? 2 : +r;
		const buffer = context == null ? context = new Path$1() : void 0;
		const { points } = this;
		for (let i = 0, n = points.length; i < n; i += 2) {
			const x$3 = points[i], y$3 = points[i + 1];
			context.moveTo(x$3 + r, y$3);
			context.arc(x$3, y$3, r, 0, tau$2);
		}
		return buffer && buffer.value();
	}
	renderHull(context) {
		const buffer = context == null ? context = new Path$1() : void 0;
		const { hull, points } = this;
		const h = hull[0] * 2, n = hull.length;
		context.moveTo(points[h], points[h + 1]);
		for (let i = 1; i < n; ++i) {
			const h$1 = 2 * hull[i];
			context.lineTo(points[h$1], points[h$1 + 1]);
		}
		context.closePath();
		return buffer && buffer.value();
	}
	hullPolygon() {
		const polygon = new Polygon();
		this.renderHull(polygon);
		return polygon.value();
	}
	renderTriangle(i, context) {
		const buffer = context == null ? context = new Path$1() : void 0;
		const { points, triangles } = this;
		const t0$2 = triangles[i *= 3] * 2;
		const t1$2 = triangles[i + 1] * 2;
		const t2$1 = triangles[i + 2] * 2;
		context.moveTo(points[t0$2], points[t0$2 + 1]);
		context.lineTo(points[t1$2], points[t1$2 + 1]);
		context.lineTo(points[t2$1], points[t2$1 + 1]);
		context.closePath();
		return buffer && buffer.value();
	}
	*trianglePolygons() {
		const { triangles } = this;
		for (let i = 0, n = triangles.length / 3; i < n; ++i) yield this.trianglePolygon(i);
	}
	trianglePolygon(i) {
		const polygon = new Polygon();
		this.renderTriangle(i, polygon);
		return polygon.value();
	}
};
function flatArray(points, fx, fy, that) {
	const n = points.length;
	const array$3 = new Float64Array(n * 2);
	for (let i = 0; i < n; ++i) {
		const p = points[i];
		array$3[i * 2] = fx.call(that, p, i, points);
		array$3[i * 2 + 1] = fy.call(that, p, i, points);
	}
	return array$3;
}
function* flatIterable(points, fx, fy, that) {
	let i = 0;
	for (const p of points) {
		yield fx.call(that, p, i, points);
		yield fy.call(that, p, i, points);
		++i;
	}
}

//#endregion
//#region node_modules/d3-dsv/src/dsv.js
var EOL = {}, EOF = {}, QUOTE = 34, NEWLINE = 10, RETURN = 13;
function objectConverter(columns) {
	return new Function("d", "return {" + columns.map(function(name, i) {
		return JSON.stringify(name) + ": d[" + i + "] || \"\"";
	}).join(",") + "}");
}
function customConverter(columns, f) {
	var object$1 = objectConverter(columns);
	return function(row, i) {
		return f(object$1(row), i, columns);
	};
}
function inferColumns(rows) {
	var columnSet = Object.create(null), columns = [];
	rows.forEach(function(row) {
		for (var column in row) if (!(column in columnSet)) columns.push(columnSet[column] = column);
	});
	return columns;
}
function pad$1(value, width) {
	var s$1 = value + "", length$2 = s$1.length;
	return length$2 < width ? new Array(width - length$2 + 1).join(0) + s$1 : s$1;
}
function formatYear$1(year) {
	return year < 0 ? "-" + pad$1(-year, 6) : year > 9999 ? "+" + pad$1(year, 6) : pad$1(year, 4);
}
function formatDate(date$1) {
	var hours = date$1.getUTCHours(), minutes = date$1.getUTCMinutes(), seconds$1 = date$1.getUTCSeconds(), milliseconds$1 = date$1.getUTCMilliseconds();
	return isNaN(date$1) ? "Invalid Date" : formatYear$1(date$1.getUTCFullYear(), 4) + "-" + pad$1(date$1.getUTCMonth() + 1, 2) + "-" + pad$1(date$1.getUTCDate(), 2) + (milliseconds$1 ? "T" + pad$1(hours, 2) + ":" + pad$1(minutes, 2) + ":" + pad$1(seconds$1, 2) + "." + pad$1(milliseconds$1, 3) + "Z" : seconds$1 ? "T" + pad$1(hours, 2) + ":" + pad$1(minutes, 2) + ":" + pad$1(seconds$1, 2) + "Z" : minutes || hours ? "T" + pad$1(hours, 2) + ":" + pad$1(minutes, 2) + "Z" : "");
}
function dsv_default(delimiter) {
	var reFormat = /* @__PURE__ */ new RegExp("[\"" + delimiter + "\n\r]"), DELIMITER = delimiter.charCodeAt(0);
	function parse(text, f) {
		var convert, columns, rows = parseRows(text, function(row, i) {
			if (convert) return convert(row, i - 1);
			columns = row, convert = f ? customConverter(row, f) : objectConverter(row);
		});
		rows.columns = columns || [];
		return rows;
	}
	function parseRows(text, f) {
		var rows = [], N = text.length, I = 0, n = 0, t, eof = N <= 0, eol = false;
		if (text.charCodeAt(N - 1) === NEWLINE) --N;
		if (text.charCodeAt(N - 1) === RETURN) --N;
		function token() {
			if (eof) return EOF;
			if (eol) return eol = false, EOL;
			var i, j = I, c$5;
			if (text.charCodeAt(j) === QUOTE) {
				while (I++ < N && text.charCodeAt(I) !== QUOTE || text.charCodeAt(++I) === QUOTE);
				if ((i = I) >= N) eof = true;
				else if ((c$5 = text.charCodeAt(I++)) === NEWLINE) eol = true;
				else if (c$5 === RETURN) {
					eol = true;
					if (text.charCodeAt(I) === NEWLINE) ++I;
				}
				return text.slice(j + 1, i - 1).replace(/""/g, "\"");
			}
			while (I < N) {
				if ((c$5 = text.charCodeAt(i = I++)) === NEWLINE) eol = true;
				else if (c$5 === RETURN) {
					eol = true;
					if (text.charCodeAt(I) === NEWLINE) ++I;
				} else if (c$5 !== DELIMITER) continue;
				return text.slice(j, i);
			}
			return eof = true, text.slice(j, N);
		}
		while ((t = token()) !== EOF) {
			var row = [];
			while (t !== EOL && t !== EOF) row.push(t), t = token();
			if (f && (row = f(row, n++)) == null) continue;
			rows.push(row);
		}
		return rows;
	}
	function preformatBody(rows, columns) {
		return rows.map(function(row) {
			return columns.map(function(column) {
				return formatValue(row[column]);
			}).join(delimiter);
		});
	}
	function format$1(rows, columns) {
		if (columns == null) columns = inferColumns(rows);
		return [columns.map(formatValue).join(delimiter)].concat(preformatBody(rows, columns)).join("\n");
	}
	function formatBody(rows, columns) {
		if (columns == null) columns = inferColumns(rows);
		return preformatBody(rows, columns).join("\n");
	}
	function formatRows(rows) {
		return rows.map(formatRow).join("\n");
	}
	function formatRow(row) {
		return row.map(formatValue).join(delimiter);
	}
	function formatValue(value) {
		return value == null ? "" : value instanceof Date ? formatDate(value) : reFormat.test(value += "") ? "\"" + value.replace(/"/g, "\"\"") + "\"" : value;
	}
	return {
		parse,
		parseRows,
		format: format$1,
		formatBody,
		formatRows,
		formatRow,
		formatValue
	};
}

//#endregion
//#region node_modules/d3-dsv/src/csv.js
var csv$1 = dsv_default(",");
var csvParse = csv$1.parse;
var csvParseRows = csv$1.parseRows;
var csvFormat = csv$1.format;
var csvFormatBody = csv$1.formatBody;
var csvFormatRows = csv$1.formatRows;
var csvFormatRow = csv$1.formatRow;
var csvFormatValue = csv$1.formatValue;

//#endregion
//#region node_modules/d3-dsv/src/tsv.js
var tsv$1 = dsv_default("	");
var tsvParse = tsv$1.parse;
var tsvParseRows = tsv$1.parseRows;
var tsvFormat = tsv$1.format;
var tsvFormatBody = tsv$1.formatBody;
var tsvFormatRows = tsv$1.formatRows;
var tsvFormatRow = tsv$1.formatRow;
var tsvFormatValue = tsv$1.formatValue;

//#endregion
//#region node_modules/d3-dsv/src/autoType.js
function autoType(object$1) {
	for (var key in object$1) {
		var value = object$1[key].trim(), number$4, m$2;
		if (!value) value = null;
		else if (value === "true") value = true;
		else if (value === "false") value = false;
		else if (value === "NaN") value = NaN;
		else if (!isNaN(number$4 = +value)) value = number$4;
		else if (m$2 = value.match(/^([-+]\d{2})?\d{4}(-\d{2}(-\d{2})?)?(T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z|[-+]\d{2}:\d{2})?)?$/)) {
			if (fixtz && !!m$2[4] && !m$2[7]) value = value.replace(/-/g, "/").replace(/T/, " ");
			value = new Date(value);
		} else continue;
		object$1[key] = value;
	}
	return object$1;
}
var fixtz = (/* @__PURE__ */ new Date("2019-01-01T00:00")).getHours() || (/* @__PURE__ */ new Date("2019-07-01T00:00")).getHours();

//#endregion
//#region node_modules/d3-fetch/src/blob.js
function responseBlob(response) {
	if (!response.ok) throw new Error(response.status + " " + response.statusText);
	return response.blob();
}
function blob_default(input, init$1) {
	return fetch(input, init$1).then(responseBlob);
}

//#endregion
//#region node_modules/d3-fetch/src/buffer.js
function responseArrayBuffer(response) {
	if (!response.ok) throw new Error(response.status + " " + response.statusText);
	return response.arrayBuffer();
}
function buffer_default(input, init$1) {
	return fetch(input, init$1).then(responseArrayBuffer);
}

//#endregion
//#region node_modules/d3-fetch/src/text.js
function responseText(response) {
	if (!response.ok) throw new Error(response.status + " " + response.statusText);
	return response.text();
}
function text_default(input, init$1) {
	return fetch(input, init$1).then(responseText);
}

//#endregion
//#region node_modules/d3-fetch/src/dsv.js
function dsvParse(parse) {
	return function(input, init$1, row) {
		if (arguments.length === 2 && typeof init$1 === "function") row = init$1, init$1 = void 0;
		return text_default(input, init$1).then(function(response) {
			return parse(response, row);
		});
	};
}
function dsv(delimiter, input, init$1, row) {
	if (arguments.length === 3 && typeof init$1 === "function") row = init$1, init$1 = void 0;
	var format$1 = dsv_default(delimiter);
	return text_default(input, init$1).then(function(response) {
		return format$1.parse(response, row);
	});
}
var csv = dsvParse(csvParse);
var tsv = dsvParse(tsvParse);

//#endregion
//#region node_modules/d3-fetch/src/image.js
function image_default(input, init$1) {
	return new Promise(function(resolve, reject) {
		var image = new Image();
		for (var key in init$1) image[key] = init$1[key];
		image.onerror = reject;
		image.onload = function() {
			resolve(image);
		};
		image.src = input;
	});
}

//#endregion
//#region node_modules/d3-fetch/src/json.js
function responseJson(response) {
	if (!response.ok) throw new Error(response.status + " " + response.statusText);
	if (response.status === 204 || response.status === 205) return;
	return response.json();
}
function json_default(input, init$1) {
	return fetch(input, init$1).then(responseJson);
}

//#endregion
//#region node_modules/d3-fetch/src/xml.js
function parser(type$1) {
	return (input, init$1) => text_default(input, init$1).then((text) => new DOMParser().parseFromString(text, type$1));
}
var xml_default = parser("application/xml");
var html = parser("text/html");
var svg = parser("image/svg+xml");

//#endregion
//#region node_modules/d3-force/src/center.js
function center_default(x$3, y$3) {
	var nodes, strength = 1;
	if (x$3 == null) x$3 = 0;
	if (y$3 == null) y$3 = 0;
	function force() {
		var i, n = nodes.length, node, sx = 0, sy = 0;
		for (i = 0; i < n; ++i) node = nodes[i], sx += node.x, sy += node.y;
		for (sx = (sx / n - x$3) * strength, sy = (sy / n - y$3) * strength, i = 0; i < n; ++i) node = nodes[i], node.x -= sx, node.y -= sy;
	}
	force.initialize = function(_) {
		nodes = _;
	};
	force.x = function(_) {
		return arguments.length ? (x$3 = +_, force) : x$3;
	};
	force.y = function(_) {
		return arguments.length ? (y$3 = +_, force) : y$3;
	};
	force.strength = function(_) {
		return arguments.length ? (strength = +_, force) : strength;
	};
	return force;
}

//#endregion
//#region node_modules/d3-quadtree/src/add.js
function add_default(d) {
	const x$3 = +this._x.call(null, d), y$3 = +this._y.call(null, d);
	return add(this.cover(x$3, y$3), x$3, y$3, d);
}
function add(tree, x$3, y$3, d) {
	if (isNaN(x$3) || isNaN(y$3)) return tree;
	var parent, node = tree._root, leaf = { data: d }, x0$5 = tree._x0, y0$5 = tree._y0, x1$1 = tree._x1, y1$1 = tree._y1, xm, ym, xp, yp, right$1, bottom$1, i, j;
	if (!node) return tree._root = leaf, tree;
	while (node.length) {
		if (right$1 = x$3 >= (xm = (x0$5 + x1$1) / 2)) x0$5 = xm;
		else x1$1 = xm;
		if (bottom$1 = y$3 >= (ym = (y0$5 + y1$1) / 2)) y0$5 = ym;
		else y1$1 = ym;
		if (parent = node, !(node = node[i = bottom$1 << 1 | right$1])) return parent[i] = leaf, tree;
	}
	xp = +tree._x.call(null, node.data);
	yp = +tree._y.call(null, node.data);
	if (x$3 === xp && y$3 === yp) return leaf.next = node, parent ? parent[i] = leaf : tree._root = leaf, tree;
	do {
		parent = parent ? parent[i] = new Array(4) : tree._root = new Array(4);
		if (right$1 = x$3 >= (xm = (x0$5 + x1$1) / 2)) x0$5 = xm;
		else x1$1 = xm;
		if (bottom$1 = y$3 >= (ym = (y0$5 + y1$1) / 2)) y0$5 = ym;
		else y1$1 = ym;
	} while ((i = bottom$1 << 1 | right$1) === (j = (yp >= ym) << 1 | xp >= xm));
	return parent[j] = node, parent[i] = leaf, tree;
}
function addAll(data) {
	var d, i, n = data.length, x$3, y$3, xz = new Array(n), yz = new Array(n), x0$5 = Infinity, y0$5 = Infinity, x1$1 = -Infinity, y1$1 = -Infinity;
	for (i = 0; i < n; ++i) {
		if (isNaN(x$3 = +this._x.call(null, d = data[i])) || isNaN(y$3 = +this._y.call(null, d))) continue;
		xz[i] = x$3;
		yz[i] = y$3;
		if (x$3 < x0$5) x0$5 = x$3;
		if (x$3 > x1$1) x1$1 = x$3;
		if (y$3 < y0$5) y0$5 = y$3;
		if (y$3 > y1$1) y1$1 = y$3;
	}
	if (x0$5 > x1$1 || y0$5 > y1$1) return this;
	this.cover(x0$5, y0$5).cover(x1$1, y1$1);
	for (i = 0; i < n; ++i) add(this, xz[i], yz[i], data[i]);
	return this;
}

//#endregion
//#region node_modules/d3-quadtree/src/cover.js
function cover_default(x$3, y$3) {
	if (isNaN(x$3 = +x$3) || isNaN(y$3 = +y$3)) return this;
	var x0$5 = this._x0, y0$5 = this._y0, x1$1 = this._x1, y1$1 = this._y1;
	if (isNaN(x0$5)) {
		x1$1 = (x0$5 = Math.floor(x$3)) + 1;
		y1$1 = (y0$5 = Math.floor(y$3)) + 1;
	} else {
		var z = x1$1 - x0$5 || 1, node = this._root, parent, i;
		while (x0$5 > x$3 || x$3 >= x1$1 || y0$5 > y$3 || y$3 >= y1$1) {
			i = (y$3 < y0$5) << 1 | x$3 < x0$5;
			parent = new Array(4), parent[i] = node, node = parent, z *= 2;
			switch (i) {
				case 0:
					x1$1 = x0$5 + z, y1$1 = y0$5 + z;
					break;
				case 1:
					x0$5 = x1$1 - z, y1$1 = y0$5 + z;
					break;
				case 2:
					x1$1 = x0$5 + z, y0$5 = y1$1 - z;
					break;
				case 3:
					x0$5 = x1$1 - z, y0$5 = y1$1 - z;
					break;
			}
		}
		if (this._root && this._root.length) this._root = node;
	}
	this._x0 = x0$5;
	this._y0 = y0$5;
	this._x1 = x1$1;
	this._y1 = y1$1;
	return this;
}

//#endregion
//#region node_modules/d3-quadtree/src/data.js
function data_default() {
	var data = [];
	this.visit(function(node) {
		if (!node.length) do
			data.push(node.data);
		while (node = node.next);
	});
	return data;
}

//#endregion
//#region node_modules/d3-quadtree/src/extent.js
function extent_default$1(_) {
	return arguments.length ? this.cover(+_[0][0], +_[0][1]).cover(+_[1][0], +_[1][1]) : isNaN(this._x0) ? void 0 : [[this._x0, this._y0], [this._x1, this._y1]];
}

//#endregion
//#region node_modules/d3-quadtree/src/quad.js
function quad_default(node, x0$5, y0$5, x1$1, y1$1) {
	this.node = node;
	this.x0 = x0$5;
	this.y0 = y0$5;
	this.x1 = x1$1;
	this.y1 = y1$1;
}

//#endregion
//#region node_modules/d3-quadtree/src/find.js
function find_default$1(x$3, y$3, radius) {
	var data, x0$5 = this._x0, y0$5 = this._y0, x1$1, y1$1, x2, y2, x3 = this._x1, y3 = this._y1, quads = [], node = this._root, q, i;
	if (node) quads.push(new quad_default(node, x0$5, y0$5, x3, y3));
	if (radius == null) radius = Infinity;
	else {
		x0$5 = x$3 - radius, y0$5 = y$3 - radius;
		x3 = x$3 + radius, y3 = y$3 + radius;
		radius *= radius;
	}
	while (q = quads.pop()) {
		if (!(node = q.node) || (x1$1 = q.x0) > x3 || (y1$1 = q.y0) > y3 || (x2 = q.x1) < x0$5 || (y2 = q.y1) < y0$5) continue;
		if (node.length) {
			var xm = (x1$1 + x2) / 2, ym = (y1$1 + y2) / 2;
			quads.push(new quad_default(node[3], xm, ym, x2, y2), new quad_default(node[2], x1$1, ym, xm, y2), new quad_default(node[1], xm, y1$1, x2, ym), new quad_default(node[0], x1$1, y1$1, xm, ym));
			if (i = (y$3 >= ym) << 1 | x$3 >= xm) {
				q = quads[quads.length - 1];
				quads[quads.length - 1] = quads[quads.length - 1 - i];
				quads[quads.length - 1 - i] = q;
			}
		} else {
			var dx = x$3 - +this._x.call(null, node.data), dy = y$3 - +this._y.call(null, node.data), d2 = dx * dx + dy * dy;
			if (d2 < radius) {
				var d = Math.sqrt(radius = d2);
				x0$5 = x$3 - d, y0$5 = y$3 - d;
				x3 = x$3 + d, y3 = y$3 + d;
				data = node.data;
			}
		}
	}
	return data;
}

//#endregion
//#region node_modules/d3-quadtree/src/remove.js
function remove_default(d) {
	if (isNaN(x$3 = +this._x.call(null, d)) || isNaN(y$3 = +this._y.call(null, d))) return this;
	var parent, node = this._root, retainer, previous, next, x0$5 = this._x0, y0$5 = this._y0, x1$1 = this._x1, y1$1 = this._y1, x$3, y$3, xm, ym, right$1, bottom$1, i, j;
	if (!node) return this;
	if (node.length) while (true) {
		if (right$1 = x$3 >= (xm = (x0$5 + x1$1) / 2)) x0$5 = xm;
		else x1$1 = xm;
		if (bottom$1 = y$3 >= (ym = (y0$5 + y1$1) / 2)) y0$5 = ym;
		else y1$1 = ym;
		if (!(parent = node, node = node[i = bottom$1 << 1 | right$1])) return this;
		if (!node.length) break;
		if (parent[i + 1 & 3] || parent[i + 2 & 3] || parent[i + 3 & 3]) retainer = parent, j = i;
	}
	while (node.data !== d) if (!(previous = node, node = node.next)) return this;
	if (next = node.next) delete node.next;
	if (previous) return next ? previous.next = next : delete previous.next, this;
	if (!parent) return this._root = next, this;
	next ? parent[i] = next : delete parent[i];
	if ((node = parent[0] || parent[1] || parent[2] || parent[3]) && node === (parent[3] || parent[2] || parent[1] || parent[0]) && !node.length) if (retainer) retainer[j] = node;
	else this._root = node;
	return this;
}
function removeAll(data) {
	for (var i = 0, n = data.length; i < n; ++i) this.remove(data[i]);
	return this;
}

//#endregion
//#region node_modules/d3-quadtree/src/root.js
function root_default() {
	return this._root;
}

//#endregion
//#region node_modules/d3-quadtree/src/size.js
function size_default() {
	var size = 0;
	this.visit(function(node) {
		if (!node.length) do
			++size;
		while (node = node.next);
	});
	return size;
}

//#endregion
//#region node_modules/d3-quadtree/src/visit.js
function visit_default(callback) {
	var quads = [], q, node = this._root, child, x0$5, y0$5, x1$1, y1$1;
	if (node) quads.push(new quad_default(node, this._x0, this._y0, this._x1, this._y1));
	while (q = quads.pop()) if (!callback(node = q.node, x0$5 = q.x0, y0$5 = q.y0, x1$1 = q.x1, y1$1 = q.y1) && node.length) {
		var xm = (x0$5 + x1$1) / 2, ym = (y0$5 + y1$1) / 2;
		if (child = node[3]) quads.push(new quad_default(child, xm, ym, x1$1, y1$1));
		if (child = node[2]) quads.push(new quad_default(child, x0$5, ym, xm, y1$1));
		if (child = node[1]) quads.push(new quad_default(child, xm, y0$5, x1$1, ym));
		if (child = node[0]) quads.push(new quad_default(child, x0$5, y0$5, xm, ym));
	}
	return this;
}

//#endregion
//#region node_modules/d3-quadtree/src/visitAfter.js
function visitAfter_default(callback) {
	var quads = [], next = [], q;
	if (this._root) quads.push(new quad_default(this._root, this._x0, this._y0, this._x1, this._y1));
	while (q = quads.pop()) {
		var node = q.node;
		if (node.length) {
			var child, x0$5 = q.x0, y0$5 = q.y0, x1$1 = q.x1, y1$1 = q.y1, xm = (x0$5 + x1$1) / 2, ym = (y0$5 + y1$1) / 2;
			if (child = node[0]) quads.push(new quad_default(child, x0$5, y0$5, xm, ym));
			if (child = node[1]) quads.push(new quad_default(child, xm, y0$5, x1$1, ym));
			if (child = node[2]) quads.push(new quad_default(child, x0$5, ym, xm, y1$1));
			if (child = node[3]) quads.push(new quad_default(child, xm, ym, x1$1, y1$1));
		}
		next.push(q);
	}
	while (q = next.pop()) callback(q.node, q.x0, q.y0, q.x1, q.y1);
	return this;
}

//#endregion
//#region node_modules/d3-quadtree/src/x.js
function defaultX(d) {
	return d[0];
}
function x_default$1(_) {
	return arguments.length ? (this._x = _, this) : this._x;
}

//#endregion
//#region node_modules/d3-quadtree/src/y.js
function defaultY(d) {
	return d[1];
}
function y_default$1(_) {
	return arguments.length ? (this._y = _, this) : this._y;
}

//#endregion
//#region node_modules/d3-quadtree/src/quadtree.js
function quadtree(nodes, x$3, y$3) {
	var tree = new Quadtree(x$3 == null ? defaultX : x$3, y$3 == null ? defaultY : y$3, NaN, NaN, NaN, NaN);
	return nodes == null ? tree : tree.addAll(nodes);
}
function Quadtree(x$3, y$3, x0$5, y0$5, x1$1, y1$1) {
	this._x = x$3;
	this._y = y$3;
	this._x0 = x0$5;
	this._y0 = y0$5;
	this._x1 = x1$1;
	this._y1 = y1$1;
	this._root = void 0;
}
function leaf_copy(leaf) {
	var copy$2 = { data: leaf.data }, next = copy$2;
	while (leaf = leaf.next) next = next.next = { data: leaf.data };
	return copy$2;
}
var treeProto = quadtree.prototype = Quadtree.prototype;
treeProto.copy = function() {
	var copy$2 = new Quadtree(this._x, this._y, this._x0, this._y0, this._x1, this._y1), node = this._root, nodes, child;
	if (!node) return copy$2;
	if (!node.length) return copy$2._root = leaf_copy(node), copy$2;
	nodes = [{
		source: node,
		target: copy$2._root = new Array(4)
	}];
	while (node = nodes.pop()) for (var i = 0; i < 4; ++i) if (child = node.source[i]) if (child.length) nodes.push({
		source: child,
		target: node.target[i] = new Array(4)
	});
	else node.target[i] = leaf_copy(child);
	return copy$2;
};
treeProto.add = add_default;
treeProto.addAll = addAll;
treeProto.cover = cover_default;
treeProto.data = data_default;
treeProto.extent = extent_default$1;
treeProto.find = find_default$1;
treeProto.remove = remove_default;
treeProto.removeAll = removeAll;
treeProto.root = root_default;
treeProto.size = size_default;
treeProto.visit = visit_default;
treeProto.visitAfter = visitAfter_default;
treeProto.x = x_default$1;
treeProto.y = y_default$1;

//#endregion
//#region node_modules/d3-force/src/constant.js
function constant_default$4(x$3) {
	return function() {
		return x$3;
	};
}

//#endregion
//#region node_modules/d3-force/src/jiggle.js
function jiggle_default(random) {
	return (random() - .5) * 1e-6;
}

//#endregion
//#region node_modules/d3-force/src/collide.js
function x$2(d) {
	return d.x + d.vx;
}
function y$2(d) {
	return d.y + d.vy;
}
function collide_default(radius) {
	var nodes, radii, random, strength = 1, iterations$1 = 1;
	if (typeof radius !== "function") radius = constant_default$4(radius == null ? 1 : +radius);
	function force() {
		var i, n = nodes.length, tree, node, xi, yi, ri, ri2;
		for (var k$1 = 0; k$1 < iterations$1; ++k$1) {
			tree = quadtree(nodes, x$2, y$2).visitAfter(prepare);
			for (i = 0; i < n; ++i) {
				node = nodes[i];
				ri = radii[node.index], ri2 = ri * ri;
				xi = node.x + node.vx;
				yi = node.y + node.vy;
				tree.visit(apply);
			}
		}
		function apply(quad, x0$5, y0$5, x1$1, y1$1) {
			var data = quad.data, rj = quad.r, r = ri + rj;
			if (data) {
				if (data.index > node.index) {
					var x$3 = xi - data.x - data.vx, y$3 = yi - data.y - data.vy, l = x$3 * x$3 + y$3 * y$3;
					if (l < r * r) {
						if (x$3 === 0) x$3 = jiggle_default(random), l += x$3 * x$3;
						if (y$3 === 0) y$3 = jiggle_default(random), l += y$3 * y$3;
						l = (r - (l = Math.sqrt(l))) / l * strength;
						node.vx += (x$3 *= l) * (r = (rj *= rj) / (ri2 + rj));
						node.vy += (y$3 *= l) * r;
						data.vx -= x$3 * (r = 1 - r);
						data.vy -= y$3 * r;
					}
				}
				return;
			}
			return x0$5 > xi + r || x1$1 < xi - r || y0$5 > yi + r || y1$1 < yi - r;
		}
	}
	function prepare(quad) {
		if (quad.data) return quad.r = radii[quad.data.index];
		for (var i = quad.r = 0; i < 4; ++i) if (quad[i] && quad[i].r > quad.r) quad.r = quad[i].r;
	}
	function initialize() {
		if (!nodes) return;
		var i, n = nodes.length, node;
		radii = new Array(n);
		for (i = 0; i < n; ++i) node = nodes[i], radii[node.index] = +radius(node, i, nodes);
	}
	force.initialize = function(_nodes, _random) {
		nodes = _nodes;
		random = _random;
		initialize();
	};
	force.iterations = function(_) {
		return arguments.length ? (iterations$1 = +_, force) : iterations$1;
	};
	force.strength = function(_) {
		return arguments.length ? (strength = +_, force) : strength;
	};
	force.radius = function(_) {
		return arguments.length ? (radius = typeof _ === "function" ? _ : constant_default$4(+_), initialize(), force) : radius;
	};
	return force;
}

//#endregion
//#region node_modules/d3-force/src/link.js
function index$1(d) {
	return d.index;
}
function find(nodeById, nodeId) {
	var node = nodeById.get(nodeId);
	if (!node) throw new Error("node not found: " + nodeId);
	return node;
}
function link_default(links) {
	var id$1 = index$1, strength = defaultStrength, strengths, distance = constant_default$4(30), distances, nodes, count$2, bias, random, iterations$1 = 1;
	if (links == null) links = [];
	function defaultStrength(link$2) {
		return 1 / Math.min(count$2[link$2.source.index], count$2[link$2.target.index]);
	}
	function force(alpha) {
		for (var k$1 = 0, n = links.length; k$1 < iterations$1; ++k$1) for (var i = 0, link$2, source, target, x$3, y$3, l, b; i < n; ++i) {
			link$2 = links[i], source = link$2.source, target = link$2.target;
			x$3 = target.x + target.vx - source.x - source.vx || jiggle_default(random);
			y$3 = target.y + target.vy - source.y - source.vy || jiggle_default(random);
			l = Math.sqrt(x$3 * x$3 + y$3 * y$3);
			l = (l - distances[i]) / l * alpha * strengths[i];
			x$3 *= l, y$3 *= l;
			target.vx -= x$3 * (b = bias[i]);
			target.vy -= y$3 * b;
			source.vx += x$3 * (b = 1 - b);
			source.vy += y$3 * b;
		}
	}
	function initialize() {
		if (!nodes) return;
		var i, n = nodes.length, m$2 = links.length, nodeById = new Map(nodes.map((d, i$1) => [id$1(d, i$1, nodes), d])), link$2;
		for (i = 0, count$2 = new Array(n); i < m$2; ++i) {
			link$2 = links[i], link$2.index = i;
			if (typeof link$2.source !== "object") link$2.source = find(nodeById, link$2.source);
			if (typeof link$2.target !== "object") link$2.target = find(nodeById, link$2.target);
			count$2[link$2.source.index] = (count$2[link$2.source.index] || 0) + 1;
			count$2[link$2.target.index] = (count$2[link$2.target.index] || 0) + 1;
		}
		for (i = 0, bias = new Array(m$2); i < m$2; ++i) link$2 = links[i], bias[i] = count$2[link$2.source.index] / (count$2[link$2.source.index] + count$2[link$2.target.index]);
		strengths = new Array(m$2), initializeStrength();
		distances = new Array(m$2), initializeDistance();
	}
	function initializeStrength() {
		if (!nodes) return;
		for (var i = 0, n = links.length; i < n; ++i) strengths[i] = +strength(links[i], i, links);
	}
	function initializeDistance() {
		if (!nodes) return;
		for (var i = 0, n = links.length; i < n; ++i) distances[i] = +distance(links[i], i, links);
	}
	force.initialize = function(_nodes, _random) {
		nodes = _nodes;
		random = _random;
		initialize();
	};
	force.links = function(_) {
		return arguments.length ? (links = _, initialize(), force) : links;
	};
	force.id = function(_) {
		return arguments.length ? (id$1 = _, force) : id$1;
	};
	force.iterations = function(_) {
		return arguments.length ? (iterations$1 = +_, force) : iterations$1;
	};
	force.strength = function(_) {
		return arguments.length ? (strength = typeof _ === "function" ? _ : constant_default$4(+_), initializeStrength(), force) : strength;
	};
	force.distance = function(_) {
		return arguments.length ? (distance = typeof _ === "function" ? _ : constant_default$4(+_), initializeDistance(), force) : distance;
	};
	return force;
}

//#endregion
//#region node_modules/d3-force/src/lcg.js
var a$2 = 1664525;
var c$4 = 1013904223;
var m$1 = 4294967296;
function lcg_default$1() {
	let s$1 = 1;
	return () => (s$1 = (a$2 * s$1 + c$4) % m$1) / m$1;
}

//#endregion
//#region node_modules/d3-force/src/simulation.js
function x$1(d) {
	return d.x;
}
function y$1(d) {
	return d.y;
}
var initialRadius = 10, initialAngle = Math.PI * (3 - Math.sqrt(5));
function simulation_default(nodes) {
	var simulation, alpha = 1, alphaMin = .001, alphaDecay = 1 - Math.pow(alphaMin, 1 / 300), alphaTarget = 0, velocityDecay = .6, forces = /* @__PURE__ */ new Map(), stepper = timer(step), event = dispatch_default("tick", "end"), random = lcg_default$1();
	if (nodes == null) nodes = [];
	function step() {
		tick();
		event.call("tick", simulation);
		if (alpha < alphaMin) {
			stepper.stop();
			event.call("end", simulation);
		}
	}
	function tick(iterations$1) {
		var i, n = nodes.length, node;
		if (iterations$1 === void 0) iterations$1 = 1;
		for (var k$1 = 0; k$1 < iterations$1; ++k$1) {
			alpha += (alphaTarget - alpha) * alphaDecay;
			forces.forEach(function(force) {
				force(alpha);
			});
			for (i = 0; i < n; ++i) {
				node = nodes[i];
				if (node.fx == null) node.x += node.vx *= velocityDecay;
				else node.x = node.fx, node.vx = 0;
				if (node.fy == null) node.y += node.vy *= velocityDecay;
				else node.y = node.fy, node.vy = 0;
			}
		}
		return simulation;
	}
	function initializeNodes() {
		for (var i = 0, n = nodes.length, node; i < n; ++i) {
			node = nodes[i], node.index = i;
			if (node.fx != null) node.x = node.fx;
			if (node.fy != null) node.y = node.fy;
			if (isNaN(node.x) || isNaN(node.y)) {
				var radius = initialRadius * Math.sqrt(.5 + i), angle$1 = i * initialAngle;
				node.x = radius * Math.cos(angle$1);
				node.y = radius * Math.sin(angle$1);
			}
			if (isNaN(node.vx) || isNaN(node.vy)) node.vx = node.vy = 0;
		}
	}
	function initializeForce(force) {
		if (force.initialize) force.initialize(nodes, random);
		return force;
	}
	initializeNodes();
	return simulation = {
		tick,
		restart: function() {
			return stepper.restart(step), simulation;
		},
		stop: function() {
			return stepper.stop(), simulation;
		},
		nodes: function(_) {
			return arguments.length ? (nodes = _, initializeNodes(), forces.forEach(initializeForce), simulation) : nodes;
		},
		alpha: function(_) {
			return arguments.length ? (alpha = +_, simulation) : alpha;
		},
		alphaMin: function(_) {
			return arguments.length ? (alphaMin = +_, simulation) : alphaMin;
		},
		alphaDecay: function(_) {
			return arguments.length ? (alphaDecay = +_, simulation) : +alphaDecay;
		},
		alphaTarget: function(_) {
			return arguments.length ? (alphaTarget = +_, simulation) : alphaTarget;
		},
		velocityDecay: function(_) {
			return arguments.length ? (velocityDecay = 1 - _, simulation) : 1 - velocityDecay;
		},
		randomSource: function(_) {
			return arguments.length ? (random = _, forces.forEach(initializeForce), simulation) : random;
		},
		force: function(name, _) {
			return arguments.length > 1 ? (_ == null ? forces.delete(name) : forces.set(name, initializeForce(_)), simulation) : forces.get(name);
		},
		find: function(x$3, y$3, radius) {
			var i = 0, n = nodes.length, dx, dy, d2, node, closest;
			if (radius == null) radius = Infinity;
			else radius *= radius;
			for (i = 0; i < n; ++i) {
				node = nodes[i];
				dx = x$3 - node.x;
				dy = y$3 - node.y;
				d2 = dx * dx + dy * dy;
				if (d2 < radius) closest = node, radius = d2;
			}
			return closest;
		},
		on: function(name, _) {
			return arguments.length > 1 ? (event.on(name, _), simulation) : event.on(name);
		}
	};
}

//#endregion
//#region node_modules/d3-force/src/manyBody.js
function manyBody_default() {
	var nodes, node, random, alpha, strength = constant_default$4(-30), strengths, distanceMin2 = 1, distanceMax2 = Infinity, theta2 = .81;
	function force(_) {
		var i, n = nodes.length, tree = quadtree(nodes, x$1, y$1).visitAfter(accumulate);
		for (alpha = _, i = 0; i < n; ++i) node = nodes[i], tree.visit(apply);
	}
	function initialize() {
		if (!nodes) return;
		var i, n = nodes.length, node$1;
		strengths = new Array(n);
		for (i = 0; i < n; ++i) node$1 = nodes[i], strengths[node$1.index] = +strength(node$1, i, nodes);
	}
	function accumulate(quad) {
		var strength$1 = 0, q, c$5, weight = 0, x$3, y$3, i;
		if (quad.length) {
			for (x$3 = y$3 = i = 0; i < 4; ++i) if ((q = quad[i]) && (c$5 = Math.abs(q.value))) strength$1 += q.value, weight += c$5, x$3 += c$5 * q.x, y$3 += c$5 * q.y;
			quad.x = x$3 / weight;
			quad.y = y$3 / weight;
		} else {
			q = quad;
			q.x = q.data.x;
			q.y = q.data.y;
			do
				strength$1 += strengths[q.data.index];
			while (q = q.next);
		}
		quad.value = strength$1;
	}
	function apply(quad, x1$1, _, x2) {
		if (!quad.value) return true;
		var x$3 = quad.x - node.x, y$3 = quad.y - node.y, w = x2 - x1$1, l = x$3 * x$3 + y$3 * y$3;
		if (w * w / theta2 < l) {
			if (l < distanceMax2) {
				if (x$3 === 0) x$3 = jiggle_default(random), l += x$3 * x$3;
				if (y$3 === 0) y$3 = jiggle_default(random), l += y$3 * y$3;
				if (l < distanceMin2) l = Math.sqrt(distanceMin2 * l);
				node.vx += x$3 * quad.value * alpha / l;
				node.vy += y$3 * quad.value * alpha / l;
			}
			return true;
		} else if (quad.length || l >= distanceMax2) return;
		if (quad.data !== node || quad.next) {
			if (x$3 === 0) x$3 = jiggle_default(random), l += x$3 * x$3;
			if (y$3 === 0) y$3 = jiggle_default(random), l += y$3 * y$3;
			if (l < distanceMin2) l = Math.sqrt(distanceMin2 * l);
		}
		do
			if (quad.data !== node) {
				w = strengths[quad.data.index] * alpha / l;
				node.vx += x$3 * w;
				node.vy += y$3 * w;
			}
		while (quad = quad.next);
	}
	force.initialize = function(_nodes, _random) {
		nodes = _nodes;
		random = _random;
		initialize();
	};
	force.strength = function(_) {
		return arguments.length ? (strength = typeof _ === "function" ? _ : constant_default$4(+_), initialize(), force) : strength;
	};
	force.distanceMin = function(_) {
		return arguments.length ? (distanceMin2 = _ * _, force) : Math.sqrt(distanceMin2);
	};
	force.distanceMax = function(_) {
		return arguments.length ? (distanceMax2 = _ * _, force) : Math.sqrt(distanceMax2);
	};
	force.theta = function(_) {
		return arguments.length ? (theta2 = _ * _, force) : Math.sqrt(theta2);
	};
	return force;
}

//#endregion
//#region node_modules/d3-force/src/radial.js
function radial_default(radius, x$3, y$3) {
	var nodes, strength = constant_default$4(.1), strengths, radiuses;
	if (typeof radius !== "function") radius = constant_default$4(+radius);
	if (x$3 == null) x$3 = 0;
	if (y$3 == null) y$3 = 0;
	function force(alpha) {
		for (var i = 0, n = nodes.length; i < n; ++i) {
			var node = nodes[i], dx = node.x - x$3 || 1e-6, dy = node.y - y$3 || 1e-6, r = Math.sqrt(dx * dx + dy * dy), k$1 = (radiuses[i] - r) * strengths[i] * alpha / r;
			node.vx += dx * k$1;
			node.vy += dy * k$1;
		}
	}
	function initialize() {
		if (!nodes) return;
		var i, n = nodes.length;
		strengths = new Array(n);
		radiuses = new Array(n);
		for (i = 0; i < n; ++i) {
			radiuses[i] = +radius(nodes[i], i, nodes);
			strengths[i] = isNaN(radiuses[i]) ? 0 : +strength(nodes[i], i, nodes);
		}
	}
	force.initialize = function(_) {
		nodes = _, initialize();
	};
	force.strength = function(_) {
		return arguments.length ? (strength = typeof _ === "function" ? _ : constant_default$4(+_), initialize(), force) : strength;
	};
	force.radius = function(_) {
		return arguments.length ? (radius = typeof _ === "function" ? _ : constant_default$4(+_), initialize(), force) : radius;
	};
	force.x = function(_) {
		return arguments.length ? (x$3 = +_, force) : x$3;
	};
	force.y = function(_) {
		return arguments.length ? (y$3 = +_, force) : y$3;
	};
	return force;
}

//#endregion
//#region node_modules/d3-force/src/x.js
function x_default(x$3) {
	var strength = constant_default$4(.1), nodes, strengths, xz;
	if (typeof x$3 !== "function") x$3 = constant_default$4(x$3 == null ? 0 : +x$3);
	function force(alpha) {
		for (var i = 0, n = nodes.length, node; i < n; ++i) node = nodes[i], node.vx += (xz[i] - node.x) * strengths[i] * alpha;
	}
	function initialize() {
		if (!nodes) return;
		var i, n = nodes.length;
		strengths = new Array(n);
		xz = new Array(n);
		for (i = 0; i < n; ++i) strengths[i] = isNaN(xz[i] = +x$3(nodes[i], i, nodes)) ? 0 : +strength(nodes[i], i, nodes);
	}
	force.initialize = function(_) {
		nodes = _;
		initialize();
	};
	force.strength = function(_) {
		return arguments.length ? (strength = typeof _ === "function" ? _ : constant_default$4(+_), initialize(), force) : strength;
	};
	force.x = function(_) {
		return arguments.length ? (x$3 = typeof _ === "function" ? _ : constant_default$4(+_), initialize(), force) : x$3;
	};
	return force;
}

//#endregion
//#region node_modules/d3-force/src/y.js
function y_default(y$3) {
	var strength = constant_default$4(.1), nodes, strengths, yz;
	if (typeof y$3 !== "function") y$3 = constant_default$4(y$3 == null ? 0 : +y$3);
	function force(alpha) {
		for (var i = 0, n = nodes.length, node; i < n; ++i) node = nodes[i], node.vy += (yz[i] - node.y) * strengths[i] * alpha;
	}
	function initialize() {
		if (!nodes) return;
		var i, n = nodes.length;
		strengths = new Array(n);
		yz = new Array(n);
		for (i = 0; i < n; ++i) strengths[i] = isNaN(yz[i] = +y$3(nodes[i], i, nodes)) ? 0 : +strength(nodes[i], i, nodes);
	}
	force.initialize = function(_) {
		nodes = _;
		initialize();
	};
	force.strength = function(_) {
		return arguments.length ? (strength = typeof _ === "function" ? _ : constant_default$4(+_), initialize(), force) : strength;
	};
	force.y = function(_) {
		return arguments.length ? (y$3 = typeof _ === "function" ? _ : constant_default$4(+_), initialize(), force) : y$3;
	};
	return force;
}

//#endregion
//#region node_modules/d3-format/src/formatDecimal.js
function formatDecimal_default(x$3) {
	return Math.abs(x$3 = Math.round(x$3)) >= 1e21 ? x$3.toLocaleString("en").replace(/,/g, "") : x$3.toString(10);
}
function formatDecimalParts(x$3, p) {
	if ((i = (x$3 = p ? x$3.toExponential(p - 1) : x$3.toExponential()).indexOf("e")) < 0) return null;
	var i, coefficient = x$3.slice(0, i);
	return [coefficient.length > 1 ? coefficient[0] + coefficient.slice(2) : coefficient, +x$3.slice(i + 1)];
}

//#endregion
//#region node_modules/d3-format/src/exponent.js
function exponent_default(x$3) {
	return x$3 = formatDecimalParts(Math.abs(x$3)), x$3 ? x$3[1] : NaN;
}

//#endregion
//#region node_modules/d3-format/src/formatGroup.js
function formatGroup_default(grouping, thousands) {
	return function(value, width) {
		var i = value.length, t = [], j = 0, g = grouping[0], length$2 = 0;
		while (i > 0 && g > 0) {
			if (length$2 + g + 1 > width) g = Math.max(1, width - length$2);
			t.push(value.substring(i -= g, i + g));
			if ((length$2 += g + 1) > width) break;
			g = grouping[j = (j + 1) % grouping.length];
		}
		return t.reverse().join(thousands);
	};
}

//#endregion
//#region node_modules/d3-format/src/formatNumerals.js
function formatNumerals_default(numerals) {
	return function(value) {
		return value.replace(/[0-9]/g, function(i) {
			return numerals[+i];
		});
	};
}

//#endregion
//#region node_modules/d3-format/src/formatSpecifier.js
var re = /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;
function formatSpecifier(specifier) {
	if (!(match = re.exec(specifier))) throw new Error("invalid format: " + specifier);
	var match;
	return new FormatSpecifier({
		fill: match[1],
		align: match[2],
		sign: match[3],
		symbol: match[4],
		zero: match[5],
		width: match[6],
		comma: match[7],
		precision: match[8] && match[8].slice(1),
		trim: match[9],
		type: match[10]
	});
}
formatSpecifier.prototype = FormatSpecifier.prototype;
function FormatSpecifier(specifier) {
	this.fill = specifier.fill === void 0 ? " " : specifier.fill + "";
	this.align = specifier.align === void 0 ? ">" : specifier.align + "";
	this.sign = specifier.sign === void 0 ? "-" : specifier.sign + "";
	this.symbol = specifier.symbol === void 0 ? "" : specifier.symbol + "";
	this.zero = !!specifier.zero;
	this.width = specifier.width === void 0 ? void 0 : +specifier.width;
	this.comma = !!specifier.comma;
	this.precision = specifier.precision === void 0 ? void 0 : +specifier.precision;
	this.trim = !!specifier.trim;
	this.type = specifier.type === void 0 ? "" : specifier.type + "";
}
FormatSpecifier.prototype.toString = function() {
	return this.fill + this.align + this.sign + this.symbol + (this.zero ? "0" : "") + (this.width === void 0 ? "" : Math.max(1, this.width | 0)) + (this.comma ? "," : "") + (this.precision === void 0 ? "" : "." + Math.max(0, this.precision | 0)) + (this.trim ? "~" : "") + this.type;
};

//#endregion
//#region node_modules/d3-format/src/formatTrim.js
function formatTrim_default(s$1) {
	out: for (var n = s$1.length, i = 1, i0 = -1, i1; i < n; ++i) switch (s$1[i]) {
		case ".":
			i0 = i1 = i;
			break;
		case "0":
			if (i0 === 0) i0 = i;
			i1 = i;
			break;
		default:
			if (!+s$1[i]) break out;
			if (i0 > 0) i0 = 0;
			break;
	}
	return i0 > 0 ? s$1.slice(0, i0) + s$1.slice(i1 + 1) : s$1;
}

//#endregion
//#region node_modules/d3-format/src/formatPrefixAuto.js
var prefixExponent;
function formatPrefixAuto_default(x$3, p) {
	var d = formatDecimalParts(x$3, p);
	if (!d) return x$3 + "";
	var coefficient = d[0], exponent$1 = d[1], i = exponent$1 - (prefixExponent = Math.max(-8, Math.min(8, Math.floor(exponent$1 / 3))) * 3) + 1, n = coefficient.length;
	return i === n ? coefficient : i > n ? coefficient + new Array(i - n + 1).join("0") : i > 0 ? coefficient.slice(0, i) + "." + coefficient.slice(i) : "0." + new Array(1 - i).join("0") + formatDecimalParts(x$3, Math.max(0, p + i - 1))[0];
}

//#endregion
//#region node_modules/d3-format/src/formatRounded.js
function formatRounded_default(x$3, p) {
	var d = formatDecimalParts(x$3, p);
	if (!d) return x$3 + "";
	var coefficient = d[0], exponent$1 = d[1];
	return exponent$1 < 0 ? "0." + new Array(-exponent$1).join("0") + coefficient : coefficient.length > exponent$1 + 1 ? coefficient.slice(0, exponent$1 + 1) + "." + coefficient.slice(exponent$1 + 1) : coefficient + new Array(exponent$1 - coefficient.length + 2).join("0");
}

//#endregion
//#region node_modules/d3-format/src/formatTypes.js
var formatTypes_default = {
	"%": (x$3, p) => (x$3 * 100).toFixed(p),
	"b": (x$3) => Math.round(x$3).toString(2),
	"c": (x$3) => x$3 + "",
	"d": formatDecimal_default,
	"e": (x$3, p) => x$3.toExponential(p),
	"f": (x$3, p) => x$3.toFixed(p),
	"g": (x$3, p) => x$3.toPrecision(p),
	"o": (x$3) => Math.round(x$3).toString(8),
	"p": (x$3, p) => formatRounded_default(x$3 * 100, p),
	"r": formatRounded_default,
	"s": formatPrefixAuto_default,
	"X": (x$3) => Math.round(x$3).toString(16).toUpperCase(),
	"x": (x$3) => Math.round(x$3).toString(16)
};

//#endregion
//#region node_modules/d3-format/src/identity.js
function identity_default$3(x$3) {
	return x$3;
}

//#endregion
//#region node_modules/d3-format/src/locale.js
var map$1 = Array.prototype.map, prefixes = [
	"y",
	"z",
	"a",
	"f",
	"p",
	"n",
	"µ",
	"m",
	"",
	"k",
	"M",
	"G",
	"T",
	"P",
	"E",
	"Z",
	"Y"
];
function locale_default(locale$2) {
	var group$1 = locale$2.grouping === void 0 || locale$2.thousands === void 0 ? identity_default$3 : formatGroup_default(map$1.call(locale$2.grouping, Number), locale$2.thousands + ""), currencyPrefix = locale$2.currency === void 0 ? "" : locale$2.currency[0] + "", currencySuffix = locale$2.currency === void 0 ? "" : locale$2.currency[1] + "", decimal = locale$2.decimal === void 0 ? "." : locale$2.decimal + "", numerals = locale$2.numerals === void 0 ? identity_default$3 : formatNumerals_default(map$1.call(locale$2.numerals, String)), percent = locale$2.percent === void 0 ? "%" : locale$2.percent + "", minus = locale$2.minus === void 0 ? "−" : locale$2.minus + "", nan = locale$2.nan === void 0 ? "NaN" : locale$2.nan + "";
	function newFormat(specifier) {
		specifier = formatSpecifier(specifier);
		var fill = specifier.fill, align = specifier.align, sign$2 = specifier.sign, symbol = specifier.symbol, zero$2 = specifier.zero, width = specifier.width, comma = specifier.comma, precision = specifier.precision, trim = specifier.trim, type$1 = specifier.type;
		if (type$1 === "n") comma = true, type$1 = "g";
		else if (!formatTypes_default[type$1]) precision === void 0 && (precision = 12), trim = true, type$1 = "g";
		if (zero$2 || fill === "0" && align === "=") zero$2 = true, fill = "0", align = "=";
		var prefix = symbol === "$" ? currencyPrefix : symbol === "#" && /[boxX]/.test(type$1) ? "0" + type$1.toLowerCase() : "", suffix = symbol === "$" ? currencySuffix : /[%p]/.test(type$1) ? percent : "";
		var formatType = formatTypes_default[type$1], maybeSuffix = /[defgprs%]/.test(type$1);
		precision = precision === void 0 ? 6 : /[gprs]/.test(type$1) ? Math.max(1, Math.min(21, precision)) : Math.max(0, Math.min(20, precision));
		function format$1(value) {
			var valuePrefix = prefix, valueSuffix = suffix, i, n, c$5;
			if (type$1 === "c") {
				valueSuffix = formatType(value) + valueSuffix;
				value = "";
			} else {
				value = +value;
				var valueNegative = value < 0 || 1 / value < 0;
				value = isNaN(value) ? nan : formatType(Math.abs(value), precision);
				if (trim) value = formatTrim_default(value);
				if (valueNegative && +value === 0 && sign$2 !== "+") valueNegative = false;
				valuePrefix = (valueNegative ? sign$2 === "(" ? sign$2 : minus : sign$2 === "-" || sign$2 === "(" ? "" : sign$2) + valuePrefix;
				valueSuffix = (type$1 === "s" ? prefixes[8 + prefixExponent / 3] : "") + valueSuffix + (valueNegative && sign$2 === "(" ? ")" : "");
				if (maybeSuffix) {
					i = -1, n = value.length;
					while (++i < n) if (c$5 = value.charCodeAt(i), 48 > c$5 || c$5 > 57) {
						valueSuffix = (c$5 === 46 ? decimal + value.slice(i + 1) : value.slice(i)) + valueSuffix;
						value = value.slice(0, i);
						break;
					}
				}
			}
			if (comma && !zero$2) value = group$1(value, Infinity);
			var length$2 = valuePrefix.length + value.length + valueSuffix.length, padding = length$2 < width ? new Array(width - length$2 + 1).join(fill) : "";
			if (comma && zero$2) value = group$1(padding + value, padding.length ? width - valueSuffix.length : Infinity), padding = "";
			switch (align) {
				case "<":
					value = valuePrefix + value + valueSuffix + padding;
					break;
				case "=":
					value = valuePrefix + padding + value + valueSuffix;
					break;
				case "^":
					value = padding.slice(0, length$2 = padding.length >> 1) + valuePrefix + value + valueSuffix + padding.slice(length$2);
					break;
				default:
					value = padding + valuePrefix + value + valueSuffix;
					break;
			}
			return numerals(value);
		}
		format$1.toString = function() {
			return specifier + "";
		};
		return format$1;
	}
	function formatPrefix$1(specifier, value) {
		var f = newFormat((specifier = formatSpecifier(specifier), specifier.type = "f", specifier)), e = Math.max(-8, Math.min(8, Math.floor(exponent_default(value) / 3))) * 3, k$1 = Math.pow(10, -e), prefix = prefixes[8 + e / 3];
		return function(value$1) {
			return f(k$1 * value$1) + prefix;
		};
	}
	return {
		format: newFormat,
		formatPrefix: formatPrefix$1
	};
}

//#endregion
//#region node_modules/d3-format/src/defaultLocale.js
var locale$1;
var format;
var formatPrefix;
defaultLocale({
	thousands: ",",
	grouping: [3],
	currency: ["$", ""]
});
function defaultLocale(definition) {
	locale$1 = locale_default(definition);
	format = locale$1.format;
	formatPrefix = locale$1.formatPrefix;
	return locale$1;
}

//#endregion
//#region node_modules/d3-format/src/precisionFixed.js
function precisionFixed_default(step) {
	return Math.max(0, -exponent_default(Math.abs(step)));
}

//#endregion
//#region node_modules/d3-format/src/precisionPrefix.js
function precisionPrefix_default(step, value) {
	return Math.max(0, Math.max(-8, Math.min(8, Math.floor(exponent_default(value) / 3))) * 3 - exponent_default(Math.abs(step)));
}

//#endregion
//#region node_modules/d3-format/src/precisionRound.js
function precisionRound_default(step, max$4) {
	step = Math.abs(step), max$4 = Math.abs(max$4) - step;
	return Math.max(0, exponent_default(max$4) - exponent_default(step)) + 1;
}

//#endregion
//#region node_modules/d3-geo/src/math.js
var epsilon$1 = 1e-6;
var epsilon2 = 1e-12;
var pi$1 = Math.PI;
var halfPi$1 = pi$1 / 2;
var quarterPi = pi$1 / 4;
var tau$1 = pi$1 * 2;
var degrees = 180 / pi$1;
var radians = pi$1 / 180;
var abs$1 = Math.abs;
var atan = Math.atan;
var atan2$1 = Math.atan2;
var cos$1 = Math.cos;
var ceil = Math.ceil;
var exp = Math.exp;
var hypot = Math.hypot;
var log$1 = Math.log;
var pow$1 = Math.pow;
var sin$1 = Math.sin;
var sign$1 = Math.sign || function(x$3) {
	return x$3 > 0 ? 1 : x$3 < 0 ? -1 : 0;
};
var sqrt$2 = Math.sqrt;
var tan = Math.tan;
function acos$1(x$3) {
	return x$3 > 1 ? 0 : x$3 < -1 ? pi$1 : Math.acos(x$3);
}
function asin$1(x$3) {
	return x$3 > 1 ? halfPi$1 : x$3 < -1 ? -halfPi$1 : Math.asin(x$3);
}
function haversin(x$3) {
	return (x$3 = sin$1(x$3 / 2)) * x$3;
}

//#endregion
//#region node_modules/d3-geo/src/noop.js
function noop() {}

//#endregion
//#region node_modules/d3-geo/src/stream.js
function streamGeometry(geometry, stream) {
	if (geometry && streamGeometryType.hasOwnProperty(geometry.type)) streamGeometryType[geometry.type](geometry, stream);
}
var streamObjectType = {
	Feature: function(object$1, stream) {
		streamGeometry(object$1.geometry, stream);
	},
	FeatureCollection: function(object$1, stream) {
		var features = object$1.features, i = -1, n = features.length;
		while (++i < n) streamGeometry(features[i].geometry, stream);
	}
};
var streamGeometryType = {
	Sphere: function(object$1, stream) {
		stream.sphere();
	},
	Point: function(object$1, stream) {
		object$1 = object$1.coordinates;
		stream.point(object$1[0], object$1[1], object$1[2]);
	},
	MultiPoint: function(object$1, stream) {
		var coordinates$1 = object$1.coordinates, i = -1, n = coordinates$1.length;
		while (++i < n) object$1 = coordinates$1[i], stream.point(object$1[0], object$1[1], object$1[2]);
	},
	LineString: function(object$1, stream) {
		streamLine(object$1.coordinates, stream, 0);
	},
	MultiLineString: function(object$1, stream) {
		var coordinates$1 = object$1.coordinates, i = -1, n = coordinates$1.length;
		while (++i < n) streamLine(coordinates$1[i], stream, 0);
	},
	Polygon: function(object$1, stream) {
		streamPolygon(object$1.coordinates, stream);
	},
	MultiPolygon: function(object$1, stream) {
		var coordinates$1 = object$1.coordinates, i = -1, n = coordinates$1.length;
		while (++i < n) streamPolygon(coordinates$1[i], stream);
	},
	GeometryCollection: function(object$1, stream) {
		var geometries = object$1.geometries, i = -1, n = geometries.length;
		while (++i < n) streamGeometry(geometries[i], stream);
	}
};
function streamLine(coordinates$1, stream, closed) {
	var i = -1, n = coordinates$1.length - closed, coordinate;
	stream.lineStart();
	while (++i < n) coordinate = coordinates$1[i], stream.point(coordinate[0], coordinate[1], coordinate[2]);
	stream.lineEnd();
}
function streamPolygon(coordinates$1, stream) {
	var i = -1, n = coordinates$1.length;
	stream.polygonStart();
	while (++i < n) streamLine(coordinates$1[i], stream, 1);
	stream.polygonEnd();
}
function stream_default(object$1, stream) {
	if (object$1 && streamObjectType.hasOwnProperty(object$1.type)) streamObjectType[object$1.type](object$1, stream);
	else streamGeometry(object$1, stream);
}

//#endregion
//#region node_modules/d3-geo/src/area.js
var areaRingSum$1 = new Adder();
var areaSum$1 = new Adder(), lambda00$2, phi00$2, lambda0$2, cosPhi0$1, sinPhi0$1;
var areaStream$1 = {
	point: noop,
	lineStart: noop,
	lineEnd: noop,
	polygonStart: function() {
		areaRingSum$1 = new Adder();
		areaStream$1.lineStart = areaRingStart$1;
		areaStream$1.lineEnd = areaRingEnd$1;
	},
	polygonEnd: function() {
		var areaRing = +areaRingSum$1;
		areaSum$1.add(areaRing < 0 ? tau$1 + areaRing : areaRing);
		this.lineStart = this.lineEnd = this.point = noop;
	},
	sphere: function() {
		areaSum$1.add(tau$1);
	}
};
function areaRingStart$1() {
	areaStream$1.point = areaPointFirst$1;
}
function areaRingEnd$1() {
	areaPoint$1(lambda00$2, phi00$2);
}
function areaPointFirst$1(lambda, phi$1) {
	areaStream$1.point = areaPoint$1;
	lambda00$2 = lambda, phi00$2 = phi$1;
	lambda *= radians, phi$1 *= radians;
	lambda0$2 = lambda, cosPhi0$1 = cos$1(phi$1 = phi$1 / 2 + quarterPi), sinPhi0$1 = sin$1(phi$1);
}
function areaPoint$1(lambda, phi$1) {
	lambda *= radians, phi$1 *= radians;
	phi$1 = phi$1 / 2 + quarterPi;
	var dLambda = lambda - lambda0$2, sdLambda = dLambda >= 0 ? 1 : -1, adLambda = sdLambda * dLambda, cosPhi = cos$1(phi$1), sinPhi = sin$1(phi$1), k$1 = sinPhi0$1 * sinPhi, u$3 = cosPhi0$1 * cosPhi + k$1 * cos$1(adLambda), v$1 = k$1 * sdLambda * sin$1(adLambda);
	areaRingSum$1.add(atan2$1(v$1, u$3));
	lambda0$2 = lambda, cosPhi0$1 = cosPhi, sinPhi0$1 = sinPhi;
}
function area_default$1(object$1) {
	areaSum$1 = new Adder();
	stream_default(object$1, areaStream$1);
	return areaSum$1 * 2;
}

//#endregion
//#region node_modules/d3-geo/src/cartesian.js
function spherical(cartesian$1) {
	return [atan2$1(cartesian$1[1], cartesian$1[0]), asin$1(cartesian$1[2])];
}
function cartesian(spherical$1) {
	var lambda = spherical$1[0], phi$1 = spherical$1[1], cosPhi = cos$1(phi$1);
	return [
		cosPhi * cos$1(lambda),
		cosPhi * sin$1(lambda),
		sin$1(phi$1)
	];
}
function cartesianDot(a$3, b) {
	return a$3[0] * b[0] + a$3[1] * b[1] + a$3[2] * b[2];
}
function cartesianCross(a$3, b) {
	return [
		a$3[1] * b[2] - a$3[2] * b[1],
		a$3[2] * b[0] - a$3[0] * b[2],
		a$3[0] * b[1] - a$3[1] * b[0]
	];
}
function cartesianAddInPlace(a$3, b) {
	a$3[0] += b[0], a$3[1] += b[1], a$3[2] += b[2];
}
function cartesianScale(vector, k$1) {
	return [
		vector[0] * k$1,
		vector[1] * k$1,
		vector[2] * k$1
	];
}
function cartesianNormalizeInPlace(d) {
	var l = sqrt$2(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
	d[0] /= l, d[1] /= l, d[2] /= l;
}

//#endregion
//#region node_modules/d3-geo/src/bounds.js
var lambda0$1, phi0, lambda1, phi1, lambda2, lambda00$1, phi00$1, p0, deltaSum, ranges, range$1;
var boundsStream$1 = {
	point: boundsPoint$1,
	lineStart: boundsLineStart,
	lineEnd: boundsLineEnd,
	polygonStart: function() {
		boundsStream$1.point = boundsRingPoint;
		boundsStream$1.lineStart = boundsRingStart;
		boundsStream$1.lineEnd = boundsRingEnd;
		deltaSum = new Adder();
		areaStream$1.polygonStart();
	},
	polygonEnd: function() {
		areaStream$1.polygonEnd();
		boundsStream$1.point = boundsPoint$1;
		boundsStream$1.lineStart = boundsLineStart;
		boundsStream$1.lineEnd = boundsLineEnd;
		if (areaRingSum$1 < 0) lambda0$1 = -(lambda1 = 180), phi0 = -(phi1 = 90);
		else if (deltaSum > epsilon$1) phi1 = 90;
		else if (deltaSum < -epsilon$1) phi0 = -90;
		range$1[0] = lambda0$1, range$1[1] = lambda1;
	},
	sphere: function() {
		lambda0$1 = -(lambda1 = 180), phi0 = -(phi1 = 90);
	}
};
function boundsPoint$1(lambda, phi$1) {
	ranges.push(range$1 = [lambda0$1 = lambda, lambda1 = lambda]);
	if (phi$1 < phi0) phi0 = phi$1;
	if (phi$1 > phi1) phi1 = phi$1;
}
function linePoint(lambda, phi$1) {
	var p = cartesian([lambda * radians, phi$1 * radians]);
	if (p0) {
		var normal = cartesianCross(p0, p), equatorial = [
			normal[1],
			-normal[0],
			0
		], inflection = cartesianCross(equatorial, normal);
		cartesianNormalizeInPlace(inflection);
		inflection = spherical(inflection);
		var delta = lambda - lambda2, sign$2 = delta > 0 ? 1 : -1, lambdai = inflection[0] * degrees * sign$2, phii, antimeridian = abs$1(delta) > 180;
		if (antimeridian ^ (sign$2 * lambda2 < lambdai && lambdai < sign$2 * lambda)) {
			phii = inflection[1] * degrees;
			if (phii > phi1) phi1 = phii;
		} else if (lambdai = (lambdai + 360) % 360 - 180, antimeridian ^ (sign$2 * lambda2 < lambdai && lambdai < sign$2 * lambda)) {
			phii = -inflection[1] * degrees;
			if (phii < phi0) phi0 = phii;
		} else {
			if (phi$1 < phi0) phi0 = phi$1;
			if (phi$1 > phi1) phi1 = phi$1;
		}
		if (antimeridian) {
			if (lambda < lambda2) {
				if (angle(lambda0$1, lambda) > angle(lambda0$1, lambda1)) lambda1 = lambda;
			} else if (angle(lambda, lambda1) > angle(lambda0$1, lambda1)) lambda0$1 = lambda;
		} else if (lambda1 >= lambda0$1) {
			if (lambda < lambda0$1) lambda0$1 = lambda;
			if (lambda > lambda1) lambda1 = lambda;
		} else if (lambda > lambda2) {
			if (angle(lambda0$1, lambda) > angle(lambda0$1, lambda1)) lambda1 = lambda;
		} else if (angle(lambda, lambda1) > angle(lambda0$1, lambda1)) lambda0$1 = lambda;
	} else ranges.push(range$1 = [lambda0$1 = lambda, lambda1 = lambda]);
	if (phi$1 < phi0) phi0 = phi$1;
	if (phi$1 > phi1) phi1 = phi$1;
	p0 = p, lambda2 = lambda;
}
function boundsLineStart() {
	boundsStream$1.point = linePoint;
}
function boundsLineEnd() {
	range$1[0] = lambda0$1, range$1[1] = lambda1;
	boundsStream$1.point = boundsPoint$1;
	p0 = null;
}
function boundsRingPoint(lambda, phi$1) {
	if (p0) {
		var delta = lambda - lambda2;
		deltaSum.add(abs$1(delta) > 180 ? delta + (delta > 0 ? 360 : -360) : delta);
	} else lambda00$1 = lambda, phi00$1 = phi$1;
	areaStream$1.point(lambda, phi$1);
	linePoint(lambda, phi$1);
}
function boundsRingStart() {
	areaStream$1.lineStart();
}
function boundsRingEnd() {
	boundsRingPoint(lambda00$1, phi00$1);
	areaStream$1.lineEnd();
	if (abs$1(deltaSum) > epsilon$1) lambda0$1 = -(lambda1 = 180);
	range$1[0] = lambda0$1, range$1[1] = lambda1;
	p0 = null;
}
function angle(lambda0$3, lambda1$1) {
	return (lambda1$1 -= lambda0$3) < 0 ? lambda1$1 + 360 : lambda1$1;
}
function rangeCompare(a$3, b) {
	return a$3[0] - b[0];
}
function rangeContains(range$3, x$3) {
	return range$3[0] <= range$3[1] ? range$3[0] <= x$3 && x$3 <= range$3[1] : x$3 < range$3[0] || range$3[1] < x$3;
}
function bounds_default(feature) {
	var i, n, a$3, b, merged, deltaMax, delta;
	phi1 = lambda1 = -(lambda0$1 = phi0 = Infinity);
	ranges = [];
	stream_default(feature, boundsStream$1);
	if (n = ranges.length) {
		ranges.sort(rangeCompare);
		for (i = 1, a$3 = ranges[0], merged = [a$3]; i < n; ++i) {
			b = ranges[i];
			if (rangeContains(a$3, b[0]) || rangeContains(a$3, b[1])) {
				if (angle(a$3[0], b[1]) > angle(a$3[0], a$3[1])) a$3[1] = b[1];
				if (angle(b[0], a$3[1]) > angle(a$3[0], a$3[1])) a$3[0] = b[0];
			} else merged.push(a$3 = b);
		}
		for (deltaMax = -Infinity, n = merged.length - 1, i = 0, a$3 = merged[n]; i <= n; a$3 = b, ++i) {
			b = merged[i];
			if ((delta = angle(a$3[1], b[0])) > deltaMax) deltaMax = delta, lambda0$1 = b[0], lambda1 = a$3[1];
		}
	}
	ranges = range$1 = null;
	return lambda0$1 === Infinity || phi0 === Infinity ? [[NaN, NaN], [NaN, NaN]] : [[lambda0$1, phi0], [lambda1, phi1]];
}

//#endregion
//#region node_modules/d3-geo/src/centroid.js
var W0, W1, X0$1, Y0$1, Z0$1, X1$1, Y1$1, Z1$1, X2$1, Y2$1, Z2$1, lambda00, phi00, x0$4, y0$4, z0;
var centroidStream$1 = {
	sphere: noop,
	point: centroidPoint$1,
	lineStart: centroidLineStart$1,
	lineEnd: centroidLineEnd$1,
	polygonStart: function() {
		centroidStream$1.lineStart = centroidRingStart$1;
		centroidStream$1.lineEnd = centroidRingEnd$1;
	},
	polygonEnd: function() {
		centroidStream$1.lineStart = centroidLineStart$1;
		centroidStream$1.lineEnd = centroidLineEnd$1;
	}
};
function centroidPoint$1(lambda, phi$1) {
	lambda *= radians, phi$1 *= radians;
	var cosPhi = cos$1(phi$1);
	centroidPointCartesian(cosPhi * cos$1(lambda), cosPhi * sin$1(lambda), sin$1(phi$1));
}
function centroidPointCartesian(x$3, y$3, z) {
	++W0;
	X0$1 += (x$3 - X0$1) / W0;
	Y0$1 += (y$3 - Y0$1) / W0;
	Z0$1 += (z - Z0$1) / W0;
}
function centroidLineStart$1() {
	centroidStream$1.point = centroidLinePointFirst;
}
function centroidLinePointFirst(lambda, phi$1) {
	lambda *= radians, phi$1 *= radians;
	var cosPhi = cos$1(phi$1);
	x0$4 = cosPhi * cos$1(lambda);
	y0$4 = cosPhi * sin$1(lambda);
	z0 = sin$1(phi$1);
	centroidStream$1.point = centroidLinePoint;
	centroidPointCartesian(x0$4, y0$4, z0);
}
function centroidLinePoint(lambda, phi$1) {
	lambda *= radians, phi$1 *= radians;
	var cosPhi = cos$1(phi$1), x$3 = cosPhi * cos$1(lambda), y$3 = cosPhi * sin$1(lambda), z = sin$1(phi$1), w = atan2$1(sqrt$2((w = y0$4 * z - z0 * y$3) * w + (w = z0 * x$3 - x0$4 * z) * w + (w = x0$4 * y$3 - y0$4 * x$3) * w), x0$4 * x$3 + y0$4 * y$3 + z0 * z);
	W1 += w;
	X1$1 += w * (x0$4 + (x0$4 = x$3));
	Y1$1 += w * (y0$4 + (y0$4 = y$3));
	Z1$1 += w * (z0 + (z0 = z));
	centroidPointCartesian(x0$4, y0$4, z0);
}
function centroidLineEnd$1() {
	centroidStream$1.point = centroidPoint$1;
}
function centroidRingStart$1() {
	centroidStream$1.point = centroidRingPointFirst;
}
function centroidRingEnd$1() {
	centroidRingPoint(lambda00, phi00);
	centroidStream$1.point = centroidPoint$1;
}
function centroidRingPointFirst(lambda, phi$1) {
	lambda00 = lambda, phi00 = phi$1;
	lambda *= radians, phi$1 *= radians;
	centroidStream$1.point = centroidRingPoint;
	var cosPhi = cos$1(phi$1);
	x0$4 = cosPhi * cos$1(lambda);
	y0$4 = cosPhi * sin$1(lambda);
	z0 = sin$1(phi$1);
	centroidPointCartesian(x0$4, y0$4, z0);
}
function centroidRingPoint(lambda, phi$1) {
	lambda *= radians, phi$1 *= radians;
	var cosPhi = cos$1(phi$1), x$3 = cosPhi * cos$1(lambda), y$3 = cosPhi * sin$1(lambda), z = sin$1(phi$1), cx = y0$4 * z - z0 * y$3, cy = z0 * x$3 - x0$4 * z, cz = x0$4 * y$3 - y0$4 * x$3, m$2 = hypot(cx, cy, cz), w = asin$1(m$2), v$1 = m$2 && -w / m$2;
	X2$1.add(v$1 * cx);
	Y2$1.add(v$1 * cy);
	Z2$1.add(v$1 * cz);
	W1 += w;
	X1$1 += w * (x0$4 + (x0$4 = x$3));
	Y1$1 += w * (y0$4 + (y0$4 = y$3));
	Z1$1 += w * (z0 + (z0 = z));
	centroidPointCartesian(x0$4, y0$4, z0);
}
function centroid_default(object$1) {
	W0 = W1 = X0$1 = Y0$1 = Z0$1 = X1$1 = Y1$1 = Z1$1 = 0;
	X2$1 = new Adder();
	Y2$1 = new Adder();
	Z2$1 = new Adder();
	stream_default(object$1, centroidStream$1);
	var x$3 = +X2$1, y$3 = +Y2$1, z = +Z2$1, m$2 = hypot(x$3, y$3, z);
	if (m$2 < epsilon2) {
		x$3 = X1$1, y$3 = Y1$1, z = Z1$1;
		if (W1 < epsilon$1) x$3 = X0$1, y$3 = Y0$1, z = Z0$1;
		m$2 = hypot(x$3, y$3, z);
		if (m$2 < epsilon2) return [NaN, NaN];
	}
	return [atan2$1(y$3, x$3) * degrees, asin$1(z / m$2) * degrees];
}

//#endregion
//#region node_modules/d3-geo/src/constant.js
function constant_default$3(x$3) {
	return function() {
		return x$3;
	};
}

//#endregion
//#region node_modules/d3-geo/src/compose.js
function compose_default(a$3, b) {
	function compose(x$3, y$3) {
		return x$3 = a$3(x$3, y$3), b(x$3[0], x$3[1]);
	}
	if (a$3.invert && b.invert) compose.invert = function(x$3, y$3) {
		return x$3 = b.invert(x$3, y$3), x$3 && a$3.invert(x$3[0], x$3[1]);
	};
	return compose;
}

//#endregion
//#region node_modules/d3-geo/src/rotation.js
function rotationIdentity(lambda, phi$1) {
	if (abs$1(lambda) > pi$1) lambda -= Math.round(lambda / tau$1) * tau$1;
	return [lambda, phi$1];
}
rotationIdentity.invert = rotationIdentity;
function rotateRadians(deltaLambda, deltaPhi, deltaGamma) {
	return (deltaLambda %= tau$1) ? deltaPhi || deltaGamma ? compose_default(rotationLambda(deltaLambda), rotationPhiGamma(deltaPhi, deltaGamma)) : rotationLambda(deltaLambda) : deltaPhi || deltaGamma ? rotationPhiGamma(deltaPhi, deltaGamma) : rotationIdentity;
}
function forwardRotationLambda(deltaLambda) {
	return function(lambda, phi$1) {
		lambda += deltaLambda;
		if (abs$1(lambda) > pi$1) lambda -= Math.round(lambda / tau$1) * tau$1;
		return [lambda, phi$1];
	};
}
function rotationLambda(deltaLambda) {
	var rotation = forwardRotationLambda(deltaLambda);
	rotation.invert = forwardRotationLambda(-deltaLambda);
	return rotation;
}
function rotationPhiGamma(deltaPhi, deltaGamma) {
	var cosDeltaPhi = cos$1(deltaPhi), sinDeltaPhi = sin$1(deltaPhi), cosDeltaGamma = cos$1(deltaGamma), sinDeltaGamma = sin$1(deltaGamma);
	function rotation(lambda, phi$1) {
		var cosPhi = cos$1(phi$1), x$3 = cos$1(lambda) * cosPhi, y$3 = sin$1(lambda) * cosPhi, z = sin$1(phi$1), k$1 = z * cosDeltaPhi + x$3 * sinDeltaPhi;
		return [atan2$1(y$3 * cosDeltaGamma - k$1 * sinDeltaGamma, x$3 * cosDeltaPhi - z * sinDeltaPhi), asin$1(k$1 * cosDeltaGamma + y$3 * sinDeltaGamma)];
	}
	rotation.invert = function(lambda, phi$1) {
		var cosPhi = cos$1(phi$1), x$3 = cos$1(lambda) * cosPhi, y$3 = sin$1(lambda) * cosPhi, z = sin$1(phi$1), k$1 = z * cosDeltaGamma - y$3 * sinDeltaGamma;
		return [atan2$1(y$3 * cosDeltaGamma + z * sinDeltaGamma, x$3 * cosDeltaPhi + k$1 * sinDeltaPhi), asin$1(k$1 * cosDeltaPhi - x$3 * sinDeltaPhi)];
	};
	return rotation;
}
function rotation_default(rotate) {
	rotate = rotateRadians(rotate[0] * radians, rotate[1] * radians, rotate.length > 2 ? rotate[2] * radians : 0);
	function forward(coordinates$1) {
		coordinates$1 = rotate(coordinates$1[0] * radians, coordinates$1[1] * radians);
		return coordinates$1[0] *= degrees, coordinates$1[1] *= degrees, coordinates$1;
	}
	forward.invert = function(coordinates$1) {
		coordinates$1 = rotate.invert(coordinates$1[0] * radians, coordinates$1[1] * radians);
		return coordinates$1[0] *= degrees, coordinates$1[1] *= degrees, coordinates$1;
	};
	return forward;
}

//#endregion
//#region node_modules/d3-geo/src/circle.js
function circleStream(stream, radius, delta, direction, t0$2, t1$2) {
	if (!delta) return;
	var cosRadius = cos$1(radius), sinRadius = sin$1(radius), step = direction * delta;
	if (t0$2 == null) {
		t0$2 = radius + direction * tau$1;
		t1$2 = radius - step / 2;
	} else {
		t0$2 = circleRadius(cosRadius, t0$2);
		t1$2 = circleRadius(cosRadius, t1$2);
		if (direction > 0 ? t0$2 < t1$2 : t0$2 > t1$2) t0$2 += direction * tau$1;
	}
	for (var point$5, t = t0$2; direction > 0 ? t > t1$2 : t < t1$2; t -= step) {
		point$5 = spherical([
			cosRadius,
			-sinRadius * cos$1(t),
			-sinRadius * sin$1(t)
		]);
		stream.point(point$5[0], point$5[1]);
	}
}
function circleRadius(cosRadius, point$5) {
	point$5 = cartesian(point$5), point$5[0] -= cosRadius;
	cartesianNormalizeInPlace(point$5);
	var radius = acos$1(-point$5[1]);
	return ((-point$5[2] < 0 ? -radius : radius) + tau$1 - epsilon$1) % tau$1;
}
function circle_default() {
	var center$1 = constant_default$3([0, 0]), radius = constant_default$3(90), precision = constant_default$3(2), ring, rotate, stream = { point: point$5 };
	function point$5(x$3, y$3) {
		ring.push(x$3 = rotate(x$3, y$3));
		x$3[0] *= degrees, x$3[1] *= degrees;
	}
	function circle() {
		var c$5 = center$1.apply(this, arguments), r = radius.apply(this, arguments) * radians, p = precision.apply(this, arguments) * radians;
		ring = [];
		rotate = rotateRadians(-c$5[0] * radians, -c$5[1] * radians, 0).invert;
		circleStream(stream, r, p, 1);
		c$5 = {
			type: "Polygon",
			coordinates: [ring]
		};
		ring = rotate = null;
		return c$5;
	}
	circle.center = function(_) {
		return arguments.length ? (center$1 = typeof _ === "function" ? _ : constant_default$3([+_[0], +_[1]]), circle) : center$1;
	};
	circle.radius = function(_) {
		return arguments.length ? (radius = typeof _ === "function" ? _ : constant_default$3(+_), circle) : radius;
	};
	circle.precision = function(_) {
		return arguments.length ? (precision = typeof _ === "function" ? _ : constant_default$3(+_), circle) : precision;
	};
	return circle;
}

//#endregion
//#region node_modules/d3-geo/src/clip/buffer.js
function buffer_default$1() {
	var lines = [], line;
	return {
		point: function(x$3, y$3, m$2) {
			line.push([
				x$3,
				y$3,
				m$2
			]);
		},
		lineStart: function() {
			lines.push(line = []);
		},
		lineEnd: noop,
		rejoin: function() {
			if (lines.length > 1) lines.push(lines.pop().concat(lines.shift()));
		},
		result: function() {
			var result = lines;
			lines = [];
			line = null;
			return result;
		}
	};
}

//#endregion
//#region node_modules/d3-geo/src/pointEqual.js
function pointEqual_default(a$3, b) {
	return abs$1(a$3[0] - b[0]) < epsilon$1 && abs$1(a$3[1] - b[1]) < epsilon$1;
}

//#endregion
//#region node_modules/d3-geo/src/clip/rejoin.js
function Intersection(point$5, points, other, entry) {
	this.x = point$5;
	this.z = points;
	this.o = other;
	this.e = entry;
	this.v = false;
	this.n = this.p = null;
}
function rejoin_default(segments, compareIntersection$1, startInside, interpolate, stream) {
	var subject = [], clip = [], i, n;
	segments.forEach(function(segment) {
		if ((n$1 = segment.length - 1) <= 0) return;
		var n$1, p0$1 = segment[0], p1 = segment[n$1], x$3;
		if (pointEqual_default(p0$1, p1)) {
			if (!p0$1[2] && !p1[2]) {
				stream.lineStart();
				for (i = 0; i < n$1; ++i) stream.point((p0$1 = segment[i])[0], p0$1[1]);
				stream.lineEnd();
				return;
			}
			p1[0] += 2 * epsilon$1;
		}
		subject.push(x$3 = new Intersection(p0$1, segment, null, true));
		clip.push(x$3.o = new Intersection(p0$1, null, x$3, false));
		subject.push(x$3 = new Intersection(p1, segment, null, false));
		clip.push(x$3.o = new Intersection(p1, null, x$3, true));
	});
	if (!subject.length) return;
	clip.sort(compareIntersection$1);
	link$1(subject);
	link$1(clip);
	for (i = 0, n = clip.length; i < n; ++i) clip[i].e = startInside = !startInside;
	var start$1 = subject[0], points, point$5;
	while (1) {
		var current = start$1, isSubject = true;
		while (current.v) if ((current = current.n) === start$1) return;
		points = current.z;
		stream.lineStart();
		do {
			current.v = current.o.v = true;
			if (current.e) {
				if (isSubject) for (i = 0, n = points.length; i < n; ++i) stream.point((point$5 = points[i])[0], point$5[1]);
				else interpolate(current.x, current.n.x, 1, stream);
				current = current.n;
			} else {
				if (isSubject) {
					points = current.p.z;
					for (i = points.length - 1; i >= 0; --i) stream.point((point$5 = points[i])[0], point$5[1]);
				} else interpolate(current.x, current.p.x, -1, stream);
				current = current.p;
			}
			current = current.o;
			points = current.z;
			isSubject = !isSubject;
		} while (!current.v);
		stream.lineEnd();
	}
}
function link$1(array$3) {
	if (!(n = array$3.length)) return;
	var n, i = 0, a$3 = array$3[0], b;
	while (++i < n) {
		a$3.n = b = array$3[i];
		b.p = a$3;
		a$3 = b;
	}
	a$3.n = b = array$3[0];
	b.p = a$3;
}

//#endregion
//#region node_modules/d3-geo/src/polygonContains.js
function longitude(point$5) {
	return abs$1(point$5[0]) <= pi$1 ? point$5[0] : sign$1(point$5[0]) * ((abs$1(point$5[0]) + pi$1) % tau$1 - pi$1);
}
function polygonContains_default(polygon, point$5) {
	var lambda = longitude(point$5), phi$1 = point$5[1], sinPhi = sin$1(phi$1), normal = [
		sin$1(lambda),
		-cos$1(lambda),
		0
	], angle$1 = 0, winding = 0;
	var sum$3 = new Adder();
	if (sinPhi === 1) phi$1 = halfPi$1 + epsilon$1;
	else if (sinPhi === -1) phi$1 = -halfPi$1 - epsilon$1;
	for (var i = 0, n = polygon.length; i < n; ++i) {
		if (!(m$2 = (ring = polygon[i]).length)) continue;
		var ring, m$2, point0 = ring[m$2 - 1], lambda0$3 = longitude(point0), phi0$1 = point0[1] / 2 + quarterPi, sinPhi0$2 = sin$1(phi0$1), cosPhi0$2 = cos$1(phi0$1);
		for (var j = 0; j < m$2; ++j, lambda0$3 = lambda1$1, sinPhi0$2 = sinPhi1, cosPhi0$2 = cosPhi1, point0 = point1) {
			var point1 = ring[j], lambda1$1 = longitude(point1), phi1$1 = point1[1] / 2 + quarterPi, sinPhi1 = sin$1(phi1$1), cosPhi1 = cos$1(phi1$1), delta = lambda1$1 - lambda0$3, sign$2 = delta >= 0 ? 1 : -1, absDelta = sign$2 * delta, antimeridian = absDelta > pi$1, k$1 = sinPhi0$2 * sinPhi1;
			sum$3.add(atan2$1(k$1 * sign$2 * sin$1(absDelta), cosPhi0$2 * cosPhi1 + k$1 * cos$1(absDelta)));
			angle$1 += antimeridian ? delta + sign$2 * tau$1 : delta;
			if (antimeridian ^ lambda0$3 >= lambda ^ lambda1$1 >= lambda) {
				var arc = cartesianCross(cartesian(point0), cartesian(point1));
				cartesianNormalizeInPlace(arc);
				var intersection$1 = cartesianCross(normal, arc);
				cartesianNormalizeInPlace(intersection$1);
				var phiArc = (antimeridian ^ delta >= 0 ? -1 : 1) * asin$1(intersection$1[2]);
				if (phi$1 > phiArc || phi$1 === phiArc && (arc[0] || arc[1])) winding += antimeridian ^ delta >= 0 ? 1 : -1;
			}
		}
	}
	return (angle$1 < -epsilon$1 || angle$1 < epsilon$1 && sum$3 < -epsilon2) ^ winding & 1;
}

//#endregion
//#region node_modules/d3-geo/src/clip/index.js
function clip_default(pointVisible, clipLine, interpolate, start$1) {
	return function(sink) {
		var line = clipLine(sink), ringBuffer = buffer_default$1(), ringSink = clipLine(ringBuffer), polygonStarted = false, polygon, segments, ring;
		var clip = {
			point: point$5,
			lineStart,
			lineEnd,
			polygonStart: function() {
				clip.point = pointRing;
				clip.lineStart = ringStart;
				clip.lineEnd = ringEnd;
				segments = [];
				polygon = [];
			},
			polygonEnd: function() {
				clip.point = point$5;
				clip.lineStart = lineStart;
				clip.lineEnd = lineEnd;
				segments = merge(segments);
				var startInside = polygonContains_default(polygon, start$1);
				if (segments.length) {
					if (!polygonStarted) sink.polygonStart(), polygonStarted = true;
					rejoin_default(segments, compareIntersection, startInside, interpolate, sink);
				} else if (startInside) {
					if (!polygonStarted) sink.polygonStart(), polygonStarted = true;
					sink.lineStart();
					interpolate(null, null, 1, sink);
					sink.lineEnd();
				}
				if (polygonStarted) sink.polygonEnd(), polygonStarted = false;
				segments = polygon = null;
			},
			sphere: function() {
				sink.polygonStart();
				sink.lineStart();
				interpolate(null, null, 1, sink);
				sink.lineEnd();
				sink.polygonEnd();
			}
		};
		function point$5(lambda, phi$1) {
			if (pointVisible(lambda, phi$1)) sink.point(lambda, phi$1);
		}
		function pointLine(lambda, phi$1) {
			line.point(lambda, phi$1);
		}
		function lineStart() {
			clip.point = pointLine;
			line.lineStart();
		}
		function lineEnd() {
			clip.point = point$5;
			line.lineEnd();
		}
		function pointRing(lambda, phi$1) {
			ring.push([lambda, phi$1]);
			ringSink.point(lambda, phi$1);
		}
		function ringStart() {
			ringSink.lineStart();
			ring = [];
		}
		function ringEnd() {
			pointRing(ring[0][0], ring[0][1]);
			ringSink.lineEnd();
			var clean = ringSink.clean(), ringSegments = ringBuffer.result(), i, n = ringSegments.length, m$2, segment, point$6;
			ring.pop();
			polygon.push(ring);
			ring = null;
			if (!n) return;
			if (clean & 1) {
				segment = ringSegments[0];
				if ((m$2 = segment.length - 1) > 0) {
					if (!polygonStarted) sink.polygonStart(), polygonStarted = true;
					sink.lineStart();
					for (i = 0; i < m$2; ++i) sink.point((point$6 = segment[i])[0], point$6[1]);
					sink.lineEnd();
				}
				return;
			}
			if (n > 1 && clean & 2) ringSegments.push(ringSegments.pop().concat(ringSegments.shift()));
			segments.push(ringSegments.filter(validSegment));
		}
		return clip;
	};
}
function validSegment(segment) {
	return segment.length > 1;
}
function compareIntersection(a$3, b) {
	return ((a$3 = a$3.x)[0] < 0 ? a$3[1] - halfPi$1 - epsilon$1 : halfPi$1 - a$3[1]) - ((b = b.x)[0] < 0 ? b[1] - halfPi$1 - epsilon$1 : halfPi$1 - b[1]);
}

//#endregion
//#region node_modules/d3-geo/src/clip/antimeridian.js
var antimeridian_default = clip_default(function() {
	return true;
}, clipAntimeridianLine, clipAntimeridianInterpolate, [-pi$1, -halfPi$1]);
function clipAntimeridianLine(stream) {
	var lambda0$3 = NaN, phi0$1 = NaN, sign0 = NaN, clean;
	return {
		lineStart: function() {
			stream.lineStart();
			clean = 1;
		},
		point: function(lambda1$1, phi1$1) {
			var sign1 = lambda1$1 > 0 ? pi$1 : -pi$1, delta = abs$1(lambda1$1 - lambda0$3);
			if (abs$1(delta - pi$1) < epsilon$1) {
				stream.point(lambda0$3, phi0$1 = (phi0$1 + phi1$1) / 2 > 0 ? halfPi$1 : -halfPi$1);
				stream.point(sign0, phi0$1);
				stream.lineEnd();
				stream.lineStart();
				stream.point(sign1, phi0$1);
				stream.point(lambda1$1, phi0$1);
				clean = 0;
			} else if (sign0 !== sign1 && delta >= pi$1) {
				if (abs$1(lambda0$3 - sign0) < epsilon$1) lambda0$3 -= sign0 * epsilon$1;
				if (abs$1(lambda1$1 - sign1) < epsilon$1) lambda1$1 -= sign1 * epsilon$1;
				phi0$1 = clipAntimeridianIntersect(lambda0$3, phi0$1, lambda1$1, phi1$1);
				stream.point(sign0, phi0$1);
				stream.lineEnd();
				stream.lineStart();
				stream.point(sign1, phi0$1);
				clean = 0;
			}
			stream.point(lambda0$3 = lambda1$1, phi0$1 = phi1$1);
			sign0 = sign1;
		},
		lineEnd: function() {
			stream.lineEnd();
			lambda0$3 = phi0$1 = NaN;
		},
		clean: function() {
			return 2 - clean;
		}
	};
}
function clipAntimeridianIntersect(lambda0$3, phi0$1, lambda1$1, phi1$1) {
	var cosPhi0$2, cosPhi1, sinLambda0Lambda1 = sin$1(lambda0$3 - lambda1$1);
	return abs$1(sinLambda0Lambda1) > epsilon$1 ? atan((sin$1(phi0$1) * (cosPhi1 = cos$1(phi1$1)) * sin$1(lambda1$1) - sin$1(phi1$1) * (cosPhi0$2 = cos$1(phi0$1)) * sin$1(lambda0$3)) / (cosPhi0$2 * cosPhi1 * sinLambda0Lambda1)) : (phi0$1 + phi1$1) / 2;
}
function clipAntimeridianInterpolate(from, to, direction, stream) {
	var phi$1;
	if (from == null) {
		phi$1 = direction * halfPi$1;
		stream.point(-pi$1, phi$1);
		stream.point(0, phi$1);
		stream.point(pi$1, phi$1);
		stream.point(pi$1, 0);
		stream.point(pi$1, -phi$1);
		stream.point(0, -phi$1);
		stream.point(-pi$1, -phi$1);
		stream.point(-pi$1, 0);
		stream.point(-pi$1, phi$1);
	} else if (abs$1(from[0] - to[0]) > epsilon$1) {
		var lambda = from[0] < to[0] ? pi$1 : -pi$1;
		phi$1 = direction * lambda / 2;
		stream.point(-lambda, phi$1);
		stream.point(0, phi$1);
		stream.point(lambda, phi$1);
	} else stream.point(to[0], to[1]);
}

//#endregion
//#region node_modules/d3-geo/src/clip/circle.js
function circle_default$1(radius) {
	var cr = cos$1(radius), delta = 2 * radians, smallRadius = cr > 0, notHemisphere = abs$1(cr) > epsilon$1;
	function interpolate(from, to, direction, stream) {
		circleStream(stream, radius, delta, direction, from, to);
	}
	function visible(lambda, phi$1) {
		return cos$1(lambda) * cos$1(phi$1) > cr;
	}
	function clipLine(stream) {
		var point0, c0, v0, v00, clean;
		return {
			lineStart: function() {
				v00 = v0 = false;
				clean = 1;
			},
			point: function(lambda, phi$1) {
				var point1 = [lambda, phi$1], point2, v$1 = visible(lambda, phi$1), c$5 = smallRadius ? v$1 ? 0 : code(lambda, phi$1) : v$1 ? code(lambda + (lambda < 0 ? pi$1 : -pi$1), phi$1) : 0;
				if (!point0 && (v00 = v0 = v$1)) stream.lineStart();
				if (v$1 !== v0) {
					point2 = intersect$1(point0, point1);
					if (!point2 || pointEqual_default(point0, point2) || pointEqual_default(point1, point2)) point1[2] = 1;
				}
				if (v$1 !== v0) {
					clean = 0;
					if (v$1) {
						stream.lineStart();
						point2 = intersect$1(point1, point0);
						stream.point(point2[0], point2[1]);
					} else {
						point2 = intersect$1(point0, point1);
						stream.point(point2[0], point2[1], 2);
						stream.lineEnd();
					}
					point0 = point2;
				} else if (notHemisphere && point0 && smallRadius ^ v$1) {
					var t;
					if (!(c$5 & c0) && (t = intersect$1(point1, point0, true))) {
						clean = 0;
						if (smallRadius) {
							stream.lineStart();
							stream.point(t[0][0], t[0][1]);
							stream.point(t[1][0], t[1][1]);
							stream.lineEnd();
						} else {
							stream.point(t[1][0], t[1][1]);
							stream.lineEnd();
							stream.lineStart();
							stream.point(t[0][0], t[0][1], 3);
						}
					}
				}
				if (v$1 && (!point0 || !pointEqual_default(point0, point1))) stream.point(point1[0], point1[1]);
				point0 = point1, v0 = v$1, c0 = c$5;
			},
			lineEnd: function() {
				if (v0) stream.lineEnd();
				point0 = null;
			},
			clean: function() {
				return clean | (v00 && v0) << 1;
			}
		};
	}
	function intersect$1(a$3, b, two) {
		var pa = cartesian(a$3), pb = cartesian(b);
		var n1 = [
			1,
			0,
			0
		], n2 = cartesianCross(pa, pb), n2n2 = cartesianDot(n2, n2), n1n2 = n2[0], determinant = n2n2 - n1n2 * n1n2;
		if (!determinant) return !two && a$3;
		var c1 = cr * n2n2 / determinant, c2 = -cr * n1n2 / determinant, n1xn2 = cartesianCross(n1, n2), A$1 = cartesianScale(n1, c1), B$2 = cartesianScale(n2, c2);
		cartesianAddInPlace(A$1, B$2);
		var u$3 = n1xn2, w = cartesianDot(A$1, u$3), uu = cartesianDot(u$3, u$3), t2$1 = w * w - uu * (cartesianDot(A$1, A$1) - 1);
		if (t2$1 < 0) return;
		var t = sqrt$2(t2$1), q = cartesianScale(u$3, (-w - t) / uu);
		cartesianAddInPlace(q, A$1);
		q = spherical(q);
		if (!two) return q;
		var lambda0$3 = a$3[0], lambda1$1 = b[0], phi0$1 = a$3[1], phi1$1 = b[1], z;
		if (lambda1$1 < lambda0$3) z = lambda0$3, lambda0$3 = lambda1$1, lambda1$1 = z;
		var delta$1 = lambda1$1 - lambda0$3, polar = abs$1(delta$1 - pi$1) < epsilon$1, meridian = polar || delta$1 < epsilon$1;
		if (!polar && phi1$1 < phi0$1) z = phi0$1, phi0$1 = phi1$1, phi1$1 = z;
		if (meridian ? polar ? phi0$1 + phi1$1 > 0 ^ q[1] < (abs$1(q[0] - lambda0$3) < epsilon$1 ? phi0$1 : phi1$1) : phi0$1 <= q[1] && q[1] <= phi1$1 : delta$1 > pi$1 ^ (lambda0$3 <= q[0] && q[0] <= lambda1$1)) {
			var q1 = cartesianScale(u$3, (-w + t) / uu);
			cartesianAddInPlace(q1, A$1);
			return [q, spherical(q1)];
		}
	}
	function code(lambda, phi$1) {
		var r = smallRadius ? radius : pi$1 - radius, code$1 = 0;
		if (lambda < -r) code$1 |= 1;
		else if (lambda > r) code$1 |= 2;
		if (phi$1 < -r) code$1 |= 4;
		else if (phi$1 > r) code$1 |= 8;
		return code$1;
	}
	return clip_default(visible, clipLine, interpolate, smallRadius ? [0, -radius] : [-pi$1, radius - pi$1]);
}

//#endregion
//#region node_modules/d3-geo/src/clip/line.js
function line_default$1(a$3, b, x0$5, y0$5, x1$1, y1$1) {
	var ax = a$3[0], ay = a$3[1], bx = b[0], by = b[1], t0$2 = 0, t1$2 = 1, dx = bx - ax, dy = by - ay, r = x0$5 - ax;
	if (!dx && r > 0) return;
	r /= dx;
	if (dx < 0) {
		if (r < t0$2) return;
		if (r < t1$2) t1$2 = r;
	} else if (dx > 0) {
		if (r > t1$2) return;
		if (r > t0$2) t0$2 = r;
	}
	r = x1$1 - ax;
	if (!dx && r < 0) return;
	r /= dx;
	if (dx < 0) {
		if (r > t1$2) return;
		if (r > t0$2) t0$2 = r;
	} else if (dx > 0) {
		if (r < t0$2) return;
		if (r < t1$2) t1$2 = r;
	}
	r = y0$5 - ay;
	if (!dy && r > 0) return;
	r /= dy;
	if (dy < 0) {
		if (r < t0$2) return;
		if (r < t1$2) t1$2 = r;
	} else if (dy > 0) {
		if (r > t1$2) return;
		if (r > t0$2) t0$2 = r;
	}
	r = y1$1 - ay;
	if (!dy && r < 0) return;
	r /= dy;
	if (dy < 0) {
		if (r > t1$2) return;
		if (r > t0$2) t0$2 = r;
	} else if (dy > 0) {
		if (r < t0$2) return;
		if (r < t1$2) t1$2 = r;
	}
	if (t0$2 > 0) a$3[0] = ax + t0$2 * dx, a$3[1] = ay + t0$2 * dy;
	if (t1$2 < 1) b[0] = ax + t1$2 * dx, b[1] = ay + t1$2 * dy;
	return true;
}

//#endregion
//#region node_modules/d3-geo/src/clip/rectangle.js
var clipMax = 1e9, clipMin = -clipMax;
function clipRectangle(x0$5, y0$5, x1$1, y1$1) {
	function visible(x$3, y$3) {
		return x0$5 <= x$3 && x$3 <= x1$1 && y0$5 <= y$3 && y$3 <= y1$1;
	}
	function interpolate(from, to, direction, stream) {
		var a$3 = 0, a1 = 0;
		if (from == null || (a$3 = corner(from, direction)) !== (a1 = corner(to, direction)) || comparePoint(from, to) < 0 ^ direction > 0) do
			stream.point(a$3 === 0 || a$3 === 3 ? x0$5 : x1$1, a$3 > 1 ? y1$1 : y0$5);
		while ((a$3 = (a$3 + direction + 4) % 4) !== a1);
		else stream.point(to[0], to[1]);
	}
	function corner(p, direction) {
		return abs$1(p[0] - x0$5) < epsilon$1 ? direction > 0 ? 0 : 3 : abs$1(p[0] - x1$1) < epsilon$1 ? direction > 0 ? 2 : 1 : abs$1(p[1] - y0$5) < epsilon$1 ? direction > 0 ? 1 : 0 : direction > 0 ? 3 : 2;
	}
	function compareIntersection$1(a$3, b) {
		return comparePoint(a$3.x, b.x);
	}
	function comparePoint(a$3, b) {
		var ca$2 = corner(a$3, 1), cb = corner(b, 1);
		return ca$2 !== cb ? ca$2 - cb : ca$2 === 0 ? b[1] - a$3[1] : ca$2 === 1 ? a$3[0] - b[0] : ca$2 === 2 ? a$3[1] - b[1] : b[0] - a$3[0];
	}
	return function(stream) {
		var activeStream = stream, bufferStream = buffer_default$1(), segments, polygon, ring, x__, y__, v__, x_, y_, v_, first, clean;
		var clipStream = {
			point: point$5,
			lineStart,
			lineEnd,
			polygonStart,
			polygonEnd
		};
		function point$5(x$3, y$3) {
			if (visible(x$3, y$3)) activeStream.point(x$3, y$3);
		}
		function polygonInside() {
			var winding = 0;
			for (var i = 0, n = polygon.length; i < n; ++i) for (var ring$1 = polygon[i], j = 1, m$2 = ring$1.length, point$6 = ring$1[0], a0, a1, b0$1 = point$6[0], b1$1 = point$6[1]; j < m$2; ++j) {
				a0 = b0$1, a1 = b1$1, point$6 = ring$1[j], b0$1 = point$6[0], b1$1 = point$6[1];
				if (a1 <= y1$1) {
					if (b1$1 > y1$1 && (b0$1 - a0) * (y1$1 - a1) > (b1$1 - a1) * (x0$5 - a0)) ++winding;
				} else if (b1$1 <= y1$1 && (b0$1 - a0) * (y1$1 - a1) < (b1$1 - a1) * (x0$5 - a0)) --winding;
			}
			return winding;
		}
		function polygonStart() {
			activeStream = bufferStream, segments = [], polygon = [], clean = true;
		}
		function polygonEnd() {
			var startInside = polygonInside(), cleanInside = clean && startInside, visible$1 = (segments = merge(segments)).length;
			if (cleanInside || visible$1) {
				stream.polygonStart();
				if (cleanInside) {
					stream.lineStart();
					interpolate(null, null, 1, stream);
					stream.lineEnd();
				}
				if (visible$1) rejoin_default(segments, compareIntersection$1, startInside, interpolate, stream);
				stream.polygonEnd();
			}
			activeStream = stream, segments = polygon = ring = null;
		}
		function lineStart() {
			clipStream.point = linePoint$1;
			if (polygon) polygon.push(ring = []);
			first = true;
			v_ = false;
			x_ = y_ = NaN;
		}
		function lineEnd() {
			if (segments) {
				linePoint$1(x__, y__);
				if (v__ && v_) bufferStream.rejoin();
				segments.push(bufferStream.result());
			}
			clipStream.point = point$5;
			if (v_) activeStream.lineEnd();
		}
		function linePoint$1(x$3, y$3) {
			var v$1 = visible(x$3, y$3);
			if (polygon) ring.push([x$3, y$3]);
			if (first) {
				x__ = x$3, y__ = y$3, v__ = v$1;
				first = false;
				if (v$1) {
					activeStream.lineStart();
					activeStream.point(x$3, y$3);
				}
			} else if (v$1 && v_) activeStream.point(x$3, y$3);
			else {
				var a$3 = [x_ = Math.max(clipMin, Math.min(clipMax, x_)), y_ = Math.max(clipMin, Math.min(clipMax, y_))], b = [x$3 = Math.max(clipMin, Math.min(clipMax, x$3)), y$3 = Math.max(clipMin, Math.min(clipMax, y$3))];
				if (line_default$1(a$3, b, x0$5, y0$5, x1$1, y1$1)) {
					if (!v_) {
						activeStream.lineStart();
						activeStream.point(a$3[0], a$3[1]);
					}
					activeStream.point(b[0], b[1]);
					if (!v$1) activeStream.lineEnd();
					clean = false;
				} else if (v$1) {
					activeStream.lineStart();
					activeStream.point(x$3, y$3);
					clean = false;
				}
			}
			x_ = x$3, y_ = y$3, v_ = v$1;
		}
		return clipStream;
	};
}

//#endregion
//#region node_modules/d3-geo/src/clip/extent.js
function extent_default() {
	var x0$5 = 0, y0$5 = 0, x1$1 = 960, y1$1 = 500, cache, cacheStream, clip;
	return clip = {
		stream: function(stream) {
			return cache && cacheStream === stream ? cache : cache = clipRectangle(x0$5, y0$5, x1$1, y1$1)(cacheStream = stream);
		},
		extent: function(_) {
			return arguments.length ? (x0$5 = +_[0][0], y0$5 = +_[0][1], x1$1 = +_[1][0], y1$1 = +_[1][1], cache = cacheStream = null, clip) : [[x0$5, y0$5], [x1$1, y1$1]];
		}
	};
}

//#endregion
//#region node_modules/d3-geo/src/length.js
var lengthSum$1, lambda0, sinPhi0, cosPhi0;
var lengthStream$1 = {
	sphere: noop,
	point: noop,
	lineStart: lengthLineStart,
	lineEnd: noop,
	polygonStart: noop,
	polygonEnd: noop
};
function lengthLineStart() {
	lengthStream$1.point = lengthPointFirst$1;
	lengthStream$1.lineEnd = lengthLineEnd;
}
function lengthLineEnd() {
	lengthStream$1.point = lengthStream$1.lineEnd = noop;
}
function lengthPointFirst$1(lambda, phi$1) {
	lambda *= radians, phi$1 *= radians;
	lambda0 = lambda, sinPhi0 = sin$1(phi$1), cosPhi0 = cos$1(phi$1);
	lengthStream$1.point = lengthPoint$1;
}
function lengthPoint$1(lambda, phi$1) {
	lambda *= radians, phi$1 *= radians;
	var sinPhi = sin$1(phi$1), cosPhi = cos$1(phi$1), delta = abs$1(lambda - lambda0), cosDelta = cos$1(delta), sinDelta = sin$1(delta), x$3 = cosPhi * sinDelta, y$3 = cosPhi0 * sinPhi - sinPhi0 * cosPhi * cosDelta, z = sinPhi0 * sinPhi + cosPhi0 * cosPhi * cosDelta;
	lengthSum$1.add(atan2$1(sqrt$2(x$3 * x$3 + y$3 * y$3), z));
	lambda0 = lambda, sinPhi0 = sinPhi, cosPhi0 = cosPhi;
}
function length_default(object$1) {
	lengthSum$1 = new Adder();
	stream_default(object$1, lengthStream$1);
	return +lengthSum$1;
}

//#endregion
//#region node_modules/d3-geo/src/distance.js
var coordinates = [null, null], object = {
	type: "LineString",
	coordinates
};
function distance_default(a$3, b) {
	coordinates[0] = a$3;
	coordinates[1] = b;
	return length_default(object);
}

//#endregion
//#region node_modules/d3-geo/src/contains.js
var containsObjectType = {
	Feature: function(object$1, point$5) {
		return containsGeometry(object$1.geometry, point$5);
	},
	FeatureCollection: function(object$1, point$5) {
		var features = object$1.features, i = -1, n = features.length;
		while (++i < n) if (containsGeometry(features[i].geometry, point$5)) return true;
		return false;
	}
};
var containsGeometryType = {
	Sphere: function() {
		return true;
	},
	Point: function(object$1, point$5) {
		return containsPoint(object$1.coordinates, point$5);
	},
	MultiPoint: function(object$1, point$5) {
		var coordinates$1 = object$1.coordinates, i = -1, n = coordinates$1.length;
		while (++i < n) if (containsPoint(coordinates$1[i], point$5)) return true;
		return false;
	},
	LineString: function(object$1, point$5) {
		return containsLine(object$1.coordinates, point$5);
	},
	MultiLineString: function(object$1, point$5) {
		var coordinates$1 = object$1.coordinates, i = -1, n = coordinates$1.length;
		while (++i < n) if (containsLine(coordinates$1[i], point$5)) return true;
		return false;
	},
	Polygon: function(object$1, point$5) {
		return containsPolygon(object$1.coordinates, point$5);
	},
	MultiPolygon: function(object$1, point$5) {
		var coordinates$1 = object$1.coordinates, i = -1, n = coordinates$1.length;
		while (++i < n) if (containsPolygon(coordinates$1[i], point$5)) return true;
		return false;
	},
	GeometryCollection: function(object$1, point$5) {
		var geometries = object$1.geometries, i = -1, n = geometries.length;
		while (++i < n) if (containsGeometry(geometries[i], point$5)) return true;
		return false;
	}
};
function containsGeometry(geometry, point$5) {
	return geometry && containsGeometryType.hasOwnProperty(geometry.type) ? containsGeometryType[geometry.type](geometry, point$5) : false;
}
function containsPoint(coordinates$1, point$5) {
	return distance_default(coordinates$1, point$5) === 0;
}
function containsLine(coordinates$1, point$5) {
	var ao, bo, ab$3;
	for (var i = 0, n = coordinates$1.length; i < n; i++) {
		bo = distance_default(coordinates$1[i], point$5);
		if (bo === 0) return true;
		if (i > 0) {
			ab$3 = distance_default(coordinates$1[i], coordinates$1[i - 1]);
			if (ab$3 > 0 && ao <= ab$3 && bo <= ab$3 && (ao + bo - ab$3) * (1 - Math.pow((ao - bo) / ab$3, 2)) < epsilon2 * ab$3) return true;
		}
		ao = bo;
	}
	return false;
}
function containsPolygon(coordinates$1, point$5) {
	return !!polygonContains_default(coordinates$1.map(ringRadians), pointRadians(point$5));
}
function ringRadians(ring) {
	return ring = ring.map(pointRadians), ring.pop(), ring;
}
function pointRadians(point$5) {
	return [point$5[0] * radians, point$5[1] * radians];
}
function contains_default(object$1, point$5) {
	return (object$1 && containsObjectType.hasOwnProperty(object$1.type) ? containsObjectType[object$1.type] : containsGeometry)(object$1, point$5);
}

//#endregion
//#region node_modules/d3-geo/src/graticule.js
function graticuleX(y0$5, y1$1, dy) {
	var y$3 = range(y0$5, y1$1 - epsilon$1, dy).concat(y1$1);
	return function(x$3) {
		return y$3.map(function(y$4) {
			return [x$3, y$4];
		});
	};
}
function graticuleY(x0$5, x1$1, dx) {
	var x$3 = range(x0$5, x1$1 - epsilon$1, dx).concat(x1$1);
	return function(y$3) {
		return x$3.map(function(x$4) {
			return [x$4, y$3];
		});
	};
}
function graticule() {
	var x1$1, x0$5, X1$2, X0$2, y1$1, y0$5, Y1$2, Y0$2, dx = 10, dy = dx, DX = 90, DY = 360, x$3, y$3, X$1, Y$1, precision = 2.5;
	function graticule$1() {
		return {
			type: "MultiLineString",
			coordinates: lines()
		};
	}
	function lines() {
		return range(ceil(X0$2 / DX) * DX, X1$2, DX).map(X$1).concat(range(ceil(Y0$2 / DY) * DY, Y1$2, DY).map(Y$1)).concat(range(ceil(x0$5 / dx) * dx, x1$1, dx).filter(function(x$4) {
			return abs$1(x$4 % DX) > epsilon$1;
		}).map(x$3)).concat(range(ceil(y0$5 / dy) * dy, y1$1, dy).filter(function(y$4) {
			return abs$1(y$4 % DY) > epsilon$1;
		}).map(y$3));
	}
	graticule$1.lines = function() {
		return lines().map(function(coordinates$1) {
			return {
				type: "LineString",
				coordinates: coordinates$1
			};
		});
	};
	graticule$1.outline = function() {
		return {
			type: "Polygon",
			coordinates: [X$1(X0$2).concat(Y$1(Y1$2).slice(1), X$1(X1$2).reverse().slice(1), Y$1(Y0$2).reverse().slice(1))]
		};
	};
	graticule$1.extent = function(_) {
		if (!arguments.length) return graticule$1.extentMinor();
		return graticule$1.extentMajor(_).extentMinor(_);
	};
	graticule$1.extentMajor = function(_) {
		if (!arguments.length) return [[X0$2, Y0$2], [X1$2, Y1$2]];
		X0$2 = +_[0][0], X1$2 = +_[1][0];
		Y0$2 = +_[0][1], Y1$2 = +_[1][1];
		if (X0$2 > X1$2) _ = X0$2, X0$2 = X1$2, X1$2 = _;
		if (Y0$2 > Y1$2) _ = Y0$2, Y0$2 = Y1$2, Y1$2 = _;
		return graticule$1.precision(precision);
	};
	graticule$1.extentMinor = function(_) {
		if (!arguments.length) return [[x0$5, y0$5], [x1$1, y1$1]];
		x0$5 = +_[0][0], x1$1 = +_[1][0];
		y0$5 = +_[0][1], y1$1 = +_[1][1];
		if (x0$5 > x1$1) _ = x0$5, x0$5 = x1$1, x1$1 = _;
		if (y0$5 > y1$1) _ = y0$5, y0$5 = y1$1, y1$1 = _;
		return graticule$1.precision(precision);
	};
	graticule$1.step = function(_) {
		if (!arguments.length) return graticule$1.stepMinor();
		return graticule$1.stepMajor(_).stepMinor(_);
	};
	graticule$1.stepMajor = function(_) {
		if (!arguments.length) return [DX, DY];
		DX = +_[0], DY = +_[1];
		return graticule$1;
	};
	graticule$1.stepMinor = function(_) {
		if (!arguments.length) return [dx, dy];
		dx = +_[0], dy = +_[1];
		return graticule$1;
	};
	graticule$1.precision = function(_) {
		if (!arguments.length) return precision;
		precision = +_;
		x$3 = graticuleX(y0$5, y1$1, 90);
		y$3 = graticuleY(x0$5, x1$1, precision);
		X$1 = graticuleX(Y0$2, Y1$2, 90);
		Y$1 = graticuleY(X0$2, X1$2, precision);
		return graticule$1;
	};
	return graticule$1.extentMajor([[-180, -90 + epsilon$1], [180, 90 - epsilon$1]]).extentMinor([[-180, -80 - epsilon$1], [180, 80 + epsilon$1]]);
}
function graticule10() {
	return graticule()();
}

//#endregion
//#region node_modules/d3-geo/src/interpolate.js
function interpolate_default(a$3, b) {
	var x0$5 = a$3[0] * radians, y0$5 = a$3[1] * radians, x1$1 = b[0] * radians, y1$1 = b[1] * radians, cy0 = cos$1(y0$5), sy0 = sin$1(y0$5), cy1 = cos$1(y1$1), sy1 = sin$1(y1$1), kx0 = cy0 * cos$1(x0$5), ky0 = cy0 * sin$1(x0$5), kx1 = cy1 * cos$1(x1$1), ky1 = cy1 * sin$1(x1$1), d = 2 * asin$1(sqrt$2(haversin(y1$1 - y0$5) + cy0 * cy1 * haversin(x1$1 - x0$5))), k$1 = sin$1(d);
	var interpolate = d ? function(t) {
		var B$2 = sin$1(t *= d) / k$1, A$1 = sin$1(d - t) / k$1, x$3 = A$1 * kx0 + B$2 * kx1, y$3 = A$1 * ky0 + B$2 * ky1, z = A$1 * sy0 + B$2 * sy1;
		return [atan2$1(y$3, x$3) * degrees, atan2$1(z, sqrt$2(x$3 * x$3 + y$3 * y$3)) * degrees];
	} : function() {
		return [x0$5 * degrees, y0$5 * degrees];
	};
	interpolate.distance = d;
	return interpolate;
}

//#endregion
//#region node_modules/d3-geo/src/identity.js
var identity_default$2 = (x$3) => x$3;

//#endregion
//#region node_modules/d3-geo/src/path/area.js
var areaSum = new Adder(), areaRingSum = new Adder(), x00$2, y00$2, x0$3, y0$3;
var areaStream = {
	point: noop,
	lineStart: noop,
	lineEnd: noop,
	polygonStart: function() {
		areaStream.lineStart = areaRingStart;
		areaStream.lineEnd = areaRingEnd;
	},
	polygonEnd: function() {
		areaStream.lineStart = areaStream.lineEnd = areaStream.point = noop;
		areaSum.add(abs$1(areaRingSum));
		areaRingSum = new Adder();
	},
	result: function() {
		var area = areaSum / 2;
		areaSum = new Adder();
		return area;
	}
};
function areaRingStart() {
	areaStream.point = areaPointFirst;
}
function areaPointFirst(x$3, y$3) {
	areaStream.point = areaPoint;
	x00$2 = x0$3 = x$3, y00$2 = y0$3 = y$3;
}
function areaPoint(x$3, y$3) {
	areaRingSum.add(y0$3 * x$3 - x0$3 * y$3);
	x0$3 = x$3, y0$3 = y$3;
}
function areaRingEnd() {
	areaPoint(x00$2, y00$2);
}
var area_default$3 = areaStream;

//#endregion
//#region node_modules/d3-geo/src/path/bounds.js
var x0$2 = Infinity, y0$2 = x0$2, x1 = -x0$2, y1 = x1;
var boundsStream = {
	point: boundsPoint,
	lineStart: noop,
	lineEnd: noop,
	polygonStart: noop,
	polygonEnd: noop,
	result: function() {
		var bounds = [[x0$2, y0$2], [x1, y1]];
		x1 = y1 = -(y0$2 = x0$2 = Infinity);
		return bounds;
	}
};
function boundsPoint(x$3, y$3) {
	if (x$3 < x0$2) x0$2 = x$3;
	if (x$3 > x1) x1 = x$3;
	if (y$3 < y0$2) y0$2 = y$3;
	if (y$3 > y1) y1 = y$3;
}
var bounds_default$1 = boundsStream;

//#endregion
//#region node_modules/d3-geo/src/path/centroid.js
var X0 = 0, Y0 = 0, Z0 = 0, X1 = 0, Y1 = 0, Z1 = 0, X2 = 0, Y2 = 0, Z2 = 0, x00$1, y00$1, x0$1, y0$1;
var centroidStream = {
	point: centroidPoint,
	lineStart: centroidLineStart,
	lineEnd: centroidLineEnd,
	polygonStart: function() {
		centroidStream.lineStart = centroidRingStart;
		centroidStream.lineEnd = centroidRingEnd;
	},
	polygonEnd: function() {
		centroidStream.point = centroidPoint;
		centroidStream.lineStart = centroidLineStart;
		centroidStream.lineEnd = centroidLineEnd;
	},
	result: function() {
		var centroid = Z2 ? [X2 / Z2, Y2 / Z2] : Z1 ? [X1 / Z1, Y1 / Z1] : Z0 ? [X0 / Z0, Y0 / Z0] : [NaN, NaN];
		X0 = Y0 = Z0 = X1 = Y1 = Z1 = X2 = Y2 = Z2 = 0;
		return centroid;
	}
};
function centroidPoint(x$3, y$3) {
	X0 += x$3;
	Y0 += y$3;
	++Z0;
}
function centroidLineStart() {
	centroidStream.point = centroidPointFirstLine;
}
function centroidPointFirstLine(x$3, y$3) {
	centroidStream.point = centroidPointLine;
	centroidPoint(x0$1 = x$3, y0$1 = y$3);
}
function centroidPointLine(x$3, y$3) {
	var dx = x$3 - x0$1, dy = y$3 - y0$1, z = sqrt$2(dx * dx + dy * dy);
	X1 += z * (x0$1 + x$3) / 2;
	Y1 += z * (y0$1 + y$3) / 2;
	Z1 += z;
	centroidPoint(x0$1 = x$3, y0$1 = y$3);
}
function centroidLineEnd() {
	centroidStream.point = centroidPoint;
}
function centroidRingStart() {
	centroidStream.point = centroidPointFirstRing;
}
function centroidRingEnd() {
	centroidPointRing(x00$1, y00$1);
}
function centroidPointFirstRing(x$3, y$3) {
	centroidStream.point = centroidPointRing;
	centroidPoint(x00$1 = x0$1 = x$3, y00$1 = y0$1 = y$3);
}
function centroidPointRing(x$3, y$3) {
	var dx = x$3 - x0$1, dy = y$3 - y0$1, z = sqrt$2(dx * dx + dy * dy);
	X1 += z * (x0$1 + x$3) / 2;
	Y1 += z * (y0$1 + y$3) / 2;
	Z1 += z;
	z = y0$1 * x$3 - x0$1 * y$3;
	X2 += z * (x0$1 + x$3);
	Y2 += z * (y0$1 + y$3);
	Z2 += z * 3;
	centroidPoint(x0$1 = x$3, y0$1 = y$3);
}
var centroid_default$2 = centroidStream;

//#endregion
//#region node_modules/d3-geo/src/path/context.js
function PathContext(context) {
	this._context = context;
}
PathContext.prototype = {
	_radius: 4.5,
	pointRadius: function(_) {
		return this._radius = _, this;
	},
	polygonStart: function() {
		this._line = 0;
	},
	polygonEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._point = 0;
	},
	lineEnd: function() {
		if (this._line === 0) this._context.closePath();
		this._point = NaN;
	},
	point: function(x$3, y$3) {
		switch (this._point) {
			case 0:
				this._context.moveTo(x$3, y$3);
				this._point = 1;
				break;
			case 1:
				this._context.lineTo(x$3, y$3);
				break;
			default:
				this._context.moveTo(x$3 + this._radius, y$3);
				this._context.arc(x$3, y$3, this._radius, 0, tau$1);
				break;
		}
	},
	result: noop
};

//#endregion
//#region node_modules/d3-geo/src/path/measure.js
var lengthSum = new Adder(), lengthRing, x00, y00, x0, y0;
var lengthStream = {
	point: noop,
	lineStart: function() {
		lengthStream.point = lengthPointFirst;
	},
	lineEnd: function() {
		if (lengthRing) lengthPoint(x00, y00);
		lengthStream.point = noop;
	},
	polygonStart: function() {
		lengthRing = true;
	},
	polygonEnd: function() {
		lengthRing = null;
	},
	result: function() {
		var length$2 = +lengthSum;
		lengthSum = new Adder();
		return length$2;
	}
};
function lengthPointFirst(x$3, y$3) {
	lengthStream.point = lengthPoint;
	x00 = x0 = x$3, y00 = y0 = y$3;
}
function lengthPoint(x$3, y$3) {
	x0 -= x$3, y0 -= y$3;
	lengthSum.add(sqrt$2(x0 * x0 + y0 * y0));
	x0 = x$3, y0 = y$3;
}
var measure_default = lengthStream;

//#endregion
//#region node_modules/d3-geo/src/path/string.js
var cacheDigits, cacheAppend, cacheRadius, cacheCircle;
var PathString = class {
	constructor(digits) {
		this._append = digits == null ? append : appendRound(digits);
		this._radius = 4.5;
		this._ = "";
	}
	pointRadius(_) {
		this._radius = +_;
		return this;
	}
	polygonStart() {
		this._line = 0;
	}
	polygonEnd() {
		this._line = NaN;
	}
	lineStart() {
		this._point = 0;
	}
	lineEnd() {
		if (this._line === 0) this._ += "Z";
		this._point = NaN;
	}
	point(x$3, y$3) {
		switch (this._point) {
			case 0:
				this._append`M${x$3},${y$3}`;
				this._point = 1;
				break;
			case 1:
				this._append`L${x$3},${y$3}`;
				break;
			default:
				this._append`M${x$3},${y$3}`;
				if (this._radius !== cacheRadius || this._append !== cacheAppend) {
					const r = this._radius;
					const s$1 = this._;
					this._ = "";
					this._append`m0,${r}a${r},${r} 0 1,1 0,${-2 * r}a${r},${r} 0 1,1 0,${2 * r}z`;
					cacheRadius = r;
					cacheAppend = this._append;
					cacheCircle = this._;
					this._ = s$1;
				}
				this._ += cacheCircle;
				break;
		}
	}
	result() {
		const result = this._;
		this._ = "";
		return result.length ? result : null;
	}
};
function append(strings) {
	let i = 1;
	this._ += strings[0];
	for (const j = strings.length; i < j; ++i) this._ += arguments[i] + strings[i];
}
function appendRound(digits) {
	const d = Math.floor(digits);
	if (!(d >= 0)) throw new RangeError(`invalid digits: ${digits}`);
	if (d > 15) return append;
	if (d !== cacheDigits) {
		const k$1 = 10 ** d;
		cacheDigits = d;
		cacheAppend = function append$2(strings) {
			let i = 1;
			this._ += strings[0];
			for (const j = strings.length; i < j; ++i) this._ += Math.round(arguments[i] * k$1) / k$1 + strings[i];
		};
	}
	return cacheAppend;
}

//#endregion
//#region node_modules/d3-geo/src/path/index.js
function path_default(projection$1, context) {
	let digits = 3, pointRadius = 4.5, projectionStream, contextStream;
	function path$1(object$1) {
		if (object$1) {
			if (typeof pointRadius === "function") contextStream.pointRadius(+pointRadius.apply(this, arguments));
			stream_default(object$1, projectionStream(contextStream));
		}
		return contextStream.result();
	}
	path$1.area = function(object$1) {
		stream_default(object$1, projectionStream(area_default$3));
		return area_default$3.result();
	};
	path$1.measure = function(object$1) {
		stream_default(object$1, projectionStream(measure_default));
		return measure_default.result();
	};
	path$1.bounds = function(object$1) {
		stream_default(object$1, projectionStream(bounds_default$1));
		return bounds_default$1.result();
	};
	path$1.centroid = function(object$1) {
		stream_default(object$1, projectionStream(centroid_default$2));
		return centroid_default$2.result();
	};
	path$1.projection = function(_) {
		if (!arguments.length) return projection$1;
		projectionStream = _ == null ? (projection$1 = null, identity_default$2) : (projection$1 = _).stream;
		return path$1;
	};
	path$1.context = function(_) {
		if (!arguments.length) return context;
		contextStream = _ == null ? (context = null, new PathString(digits)) : new PathContext(context = _);
		if (typeof pointRadius !== "function") contextStream.pointRadius(pointRadius);
		return path$1;
	};
	path$1.pointRadius = function(_) {
		if (!arguments.length) return pointRadius;
		pointRadius = typeof _ === "function" ? _ : (contextStream.pointRadius(+_), +_);
		return path$1;
	};
	path$1.digits = function(_) {
		if (!arguments.length) return digits;
		if (_ == null) digits = null;
		else {
			const d = Math.floor(_);
			if (!(d >= 0)) throw new RangeError(`invalid digits: ${_}`);
			digits = d;
		}
		if (context === null) contextStream = new PathString(digits);
		return path$1;
	};
	return path$1.projection(projection$1).digits(digits).context(context);
}

//#endregion
//#region node_modules/d3-geo/src/transform.js
function transform_default(methods) {
	return { stream: transformer$3(methods) };
}
function transformer$3(methods) {
	return function(stream) {
		var s$1 = new TransformStream();
		for (var key in methods) s$1[key] = methods[key];
		s$1.stream = stream;
		return s$1;
	};
}
function TransformStream() {}
TransformStream.prototype = {
	constructor: TransformStream,
	point: function(x$3, y$3) {
		this.stream.point(x$3, y$3);
	},
	sphere: function() {
		this.stream.sphere();
	},
	lineStart: function() {
		this.stream.lineStart();
	},
	lineEnd: function() {
		this.stream.lineEnd();
	},
	polygonStart: function() {
		this.stream.polygonStart();
	},
	polygonEnd: function() {
		this.stream.polygonEnd();
	}
};

//#endregion
//#region node_modules/d3-geo/src/projection/fit.js
function fit(projection$1, fitBounds, object$1) {
	var clip = projection$1.clipExtent && projection$1.clipExtent();
	projection$1.scale(150).translate([0, 0]);
	if (clip != null) projection$1.clipExtent(null);
	stream_default(object$1, projection$1.stream(bounds_default$1));
	fitBounds(bounds_default$1.result());
	if (clip != null) projection$1.clipExtent(clip);
	return projection$1;
}
function fitExtent(projection$1, extent$1, object$1) {
	return fit(projection$1, function(b) {
		var w = extent$1[1][0] - extent$1[0][0], h = extent$1[1][1] - extent$1[0][1], k$1 = Math.min(w / (b[1][0] - b[0][0]), h / (b[1][1] - b[0][1])), x$3 = +extent$1[0][0] + (w - k$1 * (b[1][0] + b[0][0])) / 2, y$3 = +extent$1[0][1] + (h - k$1 * (b[1][1] + b[0][1])) / 2;
		projection$1.scale(150 * k$1).translate([x$3, y$3]);
	}, object$1);
}
function fitSize(projection$1, size, object$1) {
	return fitExtent(projection$1, [[0, 0], size], object$1);
}
function fitWidth(projection$1, width, object$1) {
	return fit(projection$1, function(b) {
		var w = +width, k$1 = w / (b[1][0] - b[0][0]), x$3 = (w - k$1 * (b[1][0] + b[0][0])) / 2, y$3 = -k$1 * b[0][1];
		projection$1.scale(150 * k$1).translate([x$3, y$3]);
	}, object$1);
}
function fitHeight(projection$1, height, object$1) {
	return fit(projection$1, function(b) {
		var h = +height, k$1 = h / (b[1][1] - b[0][1]), x$3 = -k$1 * b[0][0], y$3 = (h - k$1 * (b[1][1] + b[0][1])) / 2;
		projection$1.scale(150 * k$1).translate([x$3, y$3]);
	}, object$1);
}

//#endregion
//#region node_modules/d3-geo/src/projection/resample.js
var maxDepth = 16, cosMinDistance = cos$1(30 * radians);
function resample_default(project, delta2) {
	return +delta2 ? resample(project, delta2) : resampleNone(project);
}
function resampleNone(project) {
	return transformer$3({ point: function(x$3, y$3) {
		x$3 = project(x$3, y$3);
		this.stream.point(x$3[0], x$3[1]);
	} });
}
function resample(project, delta2) {
	function resampleLineTo(x0$5, y0$5, lambda0$3, a0, b0$1, c0, x1$1, y1$1, lambda1$1, a1, b1$1, c1, depth, stream) {
		var dx = x1$1 - x0$5, dy = y1$1 - y0$5, d2 = dx * dx + dy * dy;
		if (d2 > 4 * delta2 && depth--) {
			var a$3 = a0 + a1, b = b0$1 + b1$1, c$5 = c0 + c1, m$2 = sqrt$2(a$3 * a$3 + b * b + c$5 * c$5), phi2 = asin$1(c$5 /= m$2), lambda2$1 = abs$1(abs$1(c$5) - 1) < epsilon$1 || abs$1(lambda0$3 - lambda1$1) < epsilon$1 ? (lambda0$3 + lambda1$1) / 2 : atan2$1(b, a$3), p = project(lambda2$1, phi2), x2 = p[0], y2 = p[1], dx2 = x2 - x0$5, dy2 = y2 - y0$5, dz = dy * dx2 - dx * dy2;
			if (dz * dz / d2 > delta2 || abs$1((dx * dx2 + dy * dy2) / d2 - .5) > .3 || a0 * a1 + b0$1 * b1$1 + c0 * c1 < cosMinDistance) {
				resampleLineTo(x0$5, y0$5, lambda0$3, a0, b0$1, c0, x2, y2, lambda2$1, a$3 /= m$2, b /= m$2, c$5, depth, stream);
				stream.point(x2, y2);
				resampleLineTo(x2, y2, lambda2$1, a$3, b, c$5, x1$1, y1$1, lambda1$1, a1, b1$1, c1, depth, stream);
			}
		}
	}
	return function(stream) {
		var lambda00$3, x00$3, y00$3, a00, b00, c00, lambda0$3, x0$5, y0$5, a0, b0$1, c0;
		var resampleStream = {
			point: point$5,
			lineStart,
			lineEnd,
			polygonStart: function() {
				stream.polygonStart();
				resampleStream.lineStart = ringStart;
			},
			polygonEnd: function() {
				stream.polygonEnd();
				resampleStream.lineStart = lineStart;
			}
		};
		function point$5(x$3, y$3) {
			x$3 = project(x$3, y$3);
			stream.point(x$3[0], x$3[1]);
		}
		function lineStart() {
			x0$5 = NaN;
			resampleStream.point = linePoint$1;
			stream.lineStart();
		}
		function linePoint$1(lambda, phi$1) {
			var c$5 = cartesian([lambda, phi$1]), p = project(lambda, phi$1);
			resampleLineTo(x0$5, y0$5, lambda0$3, a0, b0$1, c0, x0$5 = p[0], y0$5 = p[1], lambda0$3 = lambda, a0 = c$5[0], b0$1 = c$5[1], c0 = c$5[2], maxDepth, stream);
			stream.point(x0$5, y0$5);
		}
		function lineEnd() {
			resampleStream.point = point$5;
			stream.lineEnd();
		}
		function ringStart() {
			lineStart();
			resampleStream.point = ringPoint;
			resampleStream.lineEnd = ringEnd;
		}
		function ringPoint(lambda, phi$1) {
			linePoint$1(lambda00$3 = lambda, phi$1), x00$3 = x0$5, y00$3 = y0$5, a00 = a0, b00 = b0$1, c00 = c0;
			resampleStream.point = linePoint$1;
		}
		function ringEnd() {
			resampleLineTo(x0$5, y0$5, lambda0$3, a0, b0$1, c0, x00$3, y00$3, lambda00$3, a00, b00, c00, maxDepth, stream);
			resampleStream.lineEnd = lineEnd;
			lineEnd();
		}
		return resampleStream;
	};
}

//#endregion
//#region node_modules/d3-geo/src/projection/index.js
var transformRadians = transformer$3({ point: function(x$3, y$3) {
	this.stream.point(x$3 * radians, y$3 * radians);
} });
function transformRotate(rotate) {
	return transformer$3({ point: function(x$3, y$3) {
		var r = rotate(x$3, y$3);
		return this.stream.point(r[0], r[1]);
	} });
}
function scaleTranslate(k$1, dx, dy, sx, sy) {
	function transform$1(x$3, y$3) {
		x$3 *= sx;
		y$3 *= sy;
		return [dx + k$1 * x$3, dy - k$1 * y$3];
	}
	transform$1.invert = function(x$3, y$3) {
		return [(x$3 - dx) / k$1 * sx, (dy - y$3) / k$1 * sy];
	};
	return transform$1;
}
function scaleTranslateRotate(k$1, dx, dy, sx, sy, alpha) {
	if (!alpha) return scaleTranslate(k$1, dx, dy, sx, sy);
	var cosAlpha = cos$1(alpha), sinAlpha = sin$1(alpha), a$3 = cosAlpha * k$1, b = sinAlpha * k$1, ai = cosAlpha / k$1, bi = sinAlpha / k$1, ci = (sinAlpha * dy - cosAlpha * dx) / k$1, fi = (sinAlpha * dx + cosAlpha * dy) / k$1;
	function transform$1(x$3, y$3) {
		x$3 *= sx;
		y$3 *= sy;
		return [a$3 * x$3 - b * y$3 + dx, dy - b * x$3 - a$3 * y$3];
	}
	transform$1.invert = function(x$3, y$3) {
		return [sx * (ai * x$3 - bi * y$3 + ci), sy * (fi - bi * x$3 - ai * y$3)];
	};
	return transform$1;
}
function projection(project) {
	return projectionMutator(function() {
		return project;
	})();
}
function projectionMutator(projectAt) {
	var project, k$1 = 150, x$3 = 480, y$3 = 250, lambda = 0, phi$1 = 0, deltaLambda = 0, deltaPhi = 0, deltaGamma = 0, rotate, alpha = 0, sx = 1, sy = 1, theta = null, preclip = antimeridian_default, x0$5 = null, y0$5, x1$1, y1$1, postclip = identity_default$2, delta2 = .5, projectResample, projectTransform, projectRotateTransform, cache, cacheStream;
	function projection$1(point$5) {
		return projectRotateTransform(point$5[0] * radians, point$5[1] * radians);
	}
	function invert(point$5) {
		point$5 = projectRotateTransform.invert(point$5[0], point$5[1]);
		return point$5 && [point$5[0] * degrees, point$5[1] * degrees];
	}
	projection$1.stream = function(stream) {
		return cache && cacheStream === stream ? cache : cache = transformRadians(transformRotate(rotate)(preclip(projectResample(postclip(cacheStream = stream)))));
	};
	projection$1.preclip = function(_) {
		return arguments.length ? (preclip = _, theta = void 0, reset()) : preclip;
	};
	projection$1.postclip = function(_) {
		return arguments.length ? (postclip = _, x0$5 = y0$5 = x1$1 = y1$1 = null, reset()) : postclip;
	};
	projection$1.clipAngle = function(_) {
		return arguments.length ? (preclip = +_ ? circle_default$1(theta = _ * radians) : (theta = null, antimeridian_default), reset()) : theta * degrees;
	};
	projection$1.clipExtent = function(_) {
		return arguments.length ? (postclip = _ == null ? (x0$5 = y0$5 = x1$1 = y1$1 = null, identity_default$2) : clipRectangle(x0$5 = +_[0][0], y0$5 = +_[0][1], x1$1 = +_[1][0], y1$1 = +_[1][1]), reset()) : x0$5 == null ? null : [[x0$5, y0$5], [x1$1, y1$1]];
	};
	projection$1.scale = function(_) {
		return arguments.length ? (k$1 = +_, recenter()) : k$1;
	};
	projection$1.translate = function(_) {
		return arguments.length ? (x$3 = +_[0], y$3 = +_[1], recenter()) : [x$3, y$3];
	};
	projection$1.center = function(_) {
		return arguments.length ? (lambda = _[0] % 360 * radians, phi$1 = _[1] % 360 * radians, recenter()) : [lambda * degrees, phi$1 * degrees];
	};
	projection$1.rotate = function(_) {
		return arguments.length ? (deltaLambda = _[0] % 360 * radians, deltaPhi = _[1] % 360 * radians, deltaGamma = _.length > 2 ? _[2] % 360 * radians : 0, recenter()) : [
			deltaLambda * degrees,
			deltaPhi * degrees,
			deltaGamma * degrees
		];
	};
	projection$1.angle = function(_) {
		return arguments.length ? (alpha = _ % 360 * radians, recenter()) : alpha * degrees;
	};
	projection$1.reflectX = function(_) {
		return arguments.length ? (sx = _ ? -1 : 1, recenter()) : sx < 0;
	};
	projection$1.reflectY = function(_) {
		return arguments.length ? (sy = _ ? -1 : 1, recenter()) : sy < 0;
	};
	projection$1.precision = function(_) {
		return arguments.length ? (projectResample = resample_default(projectTransform, delta2 = _ * _), reset()) : sqrt$2(delta2);
	};
	projection$1.fitExtent = function(extent$1, object$1) {
		return fitExtent(projection$1, extent$1, object$1);
	};
	projection$1.fitSize = function(size, object$1) {
		return fitSize(projection$1, size, object$1);
	};
	projection$1.fitWidth = function(width, object$1) {
		return fitWidth(projection$1, width, object$1);
	};
	projection$1.fitHeight = function(height, object$1) {
		return fitHeight(projection$1, height, object$1);
	};
	function recenter() {
		var center$1 = scaleTranslateRotate(k$1, 0, 0, sx, sy, alpha).apply(null, project(lambda, phi$1)), transform$1 = scaleTranslateRotate(k$1, x$3 - center$1[0], y$3 - center$1[1], sx, sy, alpha);
		rotate = rotateRadians(deltaLambda, deltaPhi, deltaGamma);
		projectTransform = compose_default(project, transform$1);
		projectRotateTransform = compose_default(rotate, projectTransform);
		projectResample = resample_default(projectTransform, delta2);
		return reset();
	}
	function reset() {
		cache = cacheStream = null;
		return projection$1;
	}
	return function() {
		project = projectAt.apply(this, arguments);
		projection$1.invert = project.invert && invert;
		return recenter();
	};
}

//#endregion
//#region node_modules/d3-geo/src/projection/conic.js
function conicProjection(projectAt) {
	var phi0$1 = 0, phi1$1 = pi$1 / 3, m$2 = projectionMutator(projectAt), p = m$2(phi0$1, phi1$1);
	p.parallels = function(_) {
		return arguments.length ? m$2(phi0$1 = _[0] * radians, phi1$1 = _[1] * radians) : [phi0$1 * degrees, phi1$1 * degrees];
	};
	return p;
}

//#endregion
//#region node_modules/d3-geo/src/projection/cylindricalEqualArea.js
function cylindricalEqualAreaRaw(phi0$1) {
	var cosPhi0$2 = cos$1(phi0$1);
	function forward(lambda, phi$1) {
		return [lambda * cosPhi0$2, sin$1(phi$1) / cosPhi0$2];
	}
	forward.invert = function(x$3, y$3) {
		return [x$3 / cosPhi0$2, asin$1(y$3 * cosPhi0$2)];
	};
	return forward;
}

//#endregion
//#region node_modules/d3-geo/src/projection/conicEqualArea.js
function conicEqualAreaRaw(y0$5, y1$1) {
	var sy0 = sin$1(y0$5), n = (sy0 + sin$1(y1$1)) / 2;
	if (abs$1(n) < epsilon$1) return cylindricalEqualAreaRaw(y0$5);
	var c$5 = 1 + sy0 * (2 * n - sy0), r0 = sqrt$2(c$5) / n;
	function project(x$3, y$3) {
		var r = sqrt$2(c$5 - 2 * n * sin$1(y$3)) / n;
		return [r * sin$1(x$3 *= n), r0 - r * cos$1(x$3)];
	}
	project.invert = function(x$3, y$3) {
		var r0y = r0 - y$3, l = atan2$1(x$3, abs$1(r0y)) * sign$1(r0y);
		if (r0y * n < 0) l -= pi$1 * sign$1(x$3) * sign$1(r0y);
		return [l / n, asin$1((c$5 - (x$3 * x$3 + r0y * r0y) * n * n) / (2 * n))];
	};
	return project;
}
function conicEqualArea_default() {
	return conicProjection(conicEqualAreaRaw).scale(155.424).center([0, 33.6442]);
}

//#endregion
//#region node_modules/d3-geo/src/projection/albers.js
function albers_default() {
	return conicEqualArea_default().parallels([29.5, 45.5]).scale(1070).translate([480, 250]).rotate([96, 0]).center([-.6, 38.7]);
}

//#endregion
//#region node_modules/d3-geo/src/projection/albersUsa.js
function multiplex(streams) {
	var n = streams.length;
	return {
		point: function(x$3, y$3) {
			var i = -1;
			while (++i < n) streams[i].point(x$3, y$3);
		},
		sphere: function() {
			var i = -1;
			while (++i < n) streams[i].sphere();
		},
		lineStart: function() {
			var i = -1;
			while (++i < n) streams[i].lineStart();
		},
		lineEnd: function() {
			var i = -1;
			while (++i < n) streams[i].lineEnd();
		},
		polygonStart: function() {
			var i = -1;
			while (++i < n) streams[i].polygonStart();
		},
		polygonEnd: function() {
			var i = -1;
			while (++i < n) streams[i].polygonEnd();
		}
	};
}
function albersUsa_default() {
	var cache, cacheStream, lower48 = albers_default(), lower48Point, alaska = conicEqualArea_default().rotate([154, 0]).center([-2, 58.5]).parallels([55, 65]), alaskaPoint, hawaii = conicEqualArea_default().rotate([157, 0]).center([-3, 19.9]).parallels([8, 18]), hawaiiPoint, point$5, pointStream = { point: function(x$3, y$3) {
		point$5 = [x$3, y$3];
	} };
	function albersUsa(coordinates$1) {
		var x$3 = coordinates$1[0], y$3 = coordinates$1[1];
		return point$5 = null, (lower48Point.point(x$3, y$3), point$5) || (alaskaPoint.point(x$3, y$3), point$5) || (hawaiiPoint.point(x$3, y$3), point$5);
	}
	albersUsa.invert = function(coordinates$1) {
		var k$1 = lower48.scale(), t = lower48.translate(), x$3 = (coordinates$1[0] - t[0]) / k$1, y$3 = (coordinates$1[1] - t[1]) / k$1;
		return (y$3 >= .12 && y$3 < .234 && x$3 >= -.425 && x$3 < -.214 ? alaska : y$3 >= .166 && y$3 < .234 && x$3 >= -.214 && x$3 < -.115 ? hawaii : lower48).invert(coordinates$1);
	};
	albersUsa.stream = function(stream) {
		return cache && cacheStream === stream ? cache : cache = multiplex([
			lower48.stream(cacheStream = stream),
			alaska.stream(stream),
			hawaii.stream(stream)
		]);
	};
	albersUsa.precision = function(_) {
		if (!arguments.length) return lower48.precision();
		lower48.precision(_), alaska.precision(_), hawaii.precision(_);
		return reset();
	};
	albersUsa.scale = function(_) {
		if (!arguments.length) return lower48.scale();
		lower48.scale(_), alaska.scale(_ * .35), hawaii.scale(_);
		return albersUsa.translate(lower48.translate());
	};
	albersUsa.translate = function(_) {
		if (!arguments.length) return lower48.translate();
		var k$1 = lower48.scale(), x$3 = +_[0], y$3 = +_[1];
		lower48Point = lower48.translate(_).clipExtent([[x$3 - .455 * k$1, y$3 - .238 * k$1], [x$3 + .455 * k$1, y$3 + .238 * k$1]]).stream(pointStream);
		alaskaPoint = alaska.translate([x$3 - .307 * k$1, y$3 + .201 * k$1]).clipExtent([[x$3 - .425 * k$1 + epsilon$1, y$3 + .12 * k$1 + epsilon$1], [x$3 - .214 * k$1 - epsilon$1, y$3 + .234 * k$1 - epsilon$1]]).stream(pointStream);
		hawaiiPoint = hawaii.translate([x$3 - .205 * k$1, y$3 + .212 * k$1]).clipExtent([[x$3 - .214 * k$1 + epsilon$1, y$3 + .166 * k$1 + epsilon$1], [x$3 - .115 * k$1 - epsilon$1, y$3 + .234 * k$1 - epsilon$1]]).stream(pointStream);
		return reset();
	};
	albersUsa.fitExtent = function(extent$1, object$1) {
		return fitExtent(albersUsa, extent$1, object$1);
	};
	albersUsa.fitSize = function(size, object$1) {
		return fitSize(albersUsa, size, object$1);
	};
	albersUsa.fitWidth = function(width, object$1) {
		return fitWidth(albersUsa, width, object$1);
	};
	albersUsa.fitHeight = function(height, object$1) {
		return fitHeight(albersUsa, height, object$1);
	};
	function reset() {
		cache = cacheStream = null;
		return albersUsa;
	}
	return albersUsa.scale(1070);
}

//#endregion
//#region node_modules/d3-geo/src/projection/azimuthal.js
function azimuthalRaw(scale$1) {
	return function(x$3, y$3) {
		var cx = cos$1(x$3), cy = cos$1(y$3), k$1 = scale$1(cx * cy);
		if (k$1 === Infinity) return [2, 0];
		return [k$1 * cy * sin$1(x$3), k$1 * sin$1(y$3)];
	};
}
function azimuthalInvert(angle$1) {
	return function(x$3, y$3) {
		var z = sqrt$2(x$3 * x$3 + y$3 * y$3), c$5 = angle$1(z), sc = sin$1(c$5), cc$1 = cos$1(c$5);
		return [atan2$1(x$3 * sc, z * cc$1), asin$1(z && y$3 * sc / z)];
	};
}

//#endregion
//#region node_modules/d3-geo/src/projection/azimuthalEqualArea.js
var azimuthalEqualAreaRaw = azimuthalRaw(function(cxcy) {
	return sqrt$2(2 / (1 + cxcy));
});
azimuthalEqualAreaRaw.invert = azimuthalInvert(function(z) {
	return 2 * asin$1(z / 2);
});
function azimuthalEqualArea_default() {
	return projection(azimuthalEqualAreaRaw).scale(124.75).clipAngle(179.999);
}

//#endregion
//#region node_modules/d3-geo/src/projection/azimuthalEquidistant.js
var azimuthalEquidistantRaw = azimuthalRaw(function(c$5) {
	return (c$5 = acos$1(c$5)) && c$5 / sin$1(c$5);
});
azimuthalEquidistantRaw.invert = azimuthalInvert(function(z) {
	return z;
});
function azimuthalEquidistant_default() {
	return projection(azimuthalEquidistantRaw).scale(79.4188).clipAngle(179.999);
}

//#endregion
//#region node_modules/d3-geo/src/projection/mercator.js
function mercatorRaw(lambda, phi$1) {
	return [lambda, log$1(tan((halfPi$1 + phi$1) / 2))];
}
mercatorRaw.invert = function(x$3, y$3) {
	return [x$3, 2 * atan(exp(y$3)) - halfPi$1];
};
function mercator_default() {
	return mercatorProjection(mercatorRaw).scale(961 / tau$1);
}
function mercatorProjection(project) {
	var m$2 = projection(project), center$1 = m$2.center, scale$1 = m$2.scale, translate = m$2.translate, clipExtent = m$2.clipExtent, x0$5 = null, y0$5, x1$1, y1$1;
	m$2.scale = function(_) {
		return arguments.length ? (scale$1(_), reclip()) : scale$1();
	};
	m$2.translate = function(_) {
		return arguments.length ? (translate(_), reclip()) : translate();
	};
	m$2.center = function(_) {
		return arguments.length ? (center$1(_), reclip()) : center$1();
	};
	m$2.clipExtent = function(_) {
		return arguments.length ? (_ == null ? x0$5 = y0$5 = x1$1 = y1$1 = null : (x0$5 = +_[0][0], y0$5 = +_[0][1], x1$1 = +_[1][0], y1$1 = +_[1][1]), reclip()) : x0$5 == null ? null : [[x0$5, y0$5], [x1$1, y1$1]];
	};
	function reclip() {
		var k$1 = pi$1 * scale$1(), t = m$2(rotation_default(m$2.rotate()).invert([0, 0]));
		return clipExtent(x0$5 == null ? [[t[0] - k$1, t[1] - k$1], [t[0] + k$1, t[1] + k$1]] : project === mercatorRaw ? [[Math.max(t[0] - k$1, x0$5), y0$5], [Math.min(t[0] + k$1, x1$1), y1$1]] : [[x0$5, Math.max(t[1] - k$1, y0$5)], [x1$1, Math.min(t[1] + k$1, y1$1)]]);
	}
	return reclip();
}

//#endregion
//#region node_modules/d3-geo/src/projection/conicConformal.js
function tany(y$3) {
	return tan((halfPi$1 + y$3) / 2);
}
function conicConformalRaw(y0$5, y1$1) {
	var cy0 = cos$1(y0$5), n = y0$5 === y1$1 ? sin$1(y0$5) : log$1(cy0 / cos$1(y1$1)) / log$1(tany(y1$1) / tany(y0$5)), f = cy0 * pow$1(tany(y0$5), n) / n;
	if (!n) return mercatorRaw;
	function project(x$3, y$3) {
		if (f > 0) {
			if (y$3 < -halfPi$1 + epsilon$1) y$3 = -halfPi$1 + epsilon$1;
		} else if (y$3 > halfPi$1 - epsilon$1) y$3 = halfPi$1 - epsilon$1;
		var r = f / pow$1(tany(y$3), n);
		return [r * sin$1(n * x$3), f - r * cos$1(n * x$3)];
	}
	project.invert = function(x$3, y$3) {
		var fy = f - y$3, r = sign$1(n) * sqrt$2(x$3 * x$3 + fy * fy), l = atan2$1(x$3, abs$1(fy)) * sign$1(fy);
		if (fy * n < 0) l -= pi$1 * sign$1(x$3) * sign$1(fy);
		return [l / n, 2 * atan(pow$1(f / r, 1 / n)) - halfPi$1];
	};
	return project;
}
function conicConformal_default() {
	return conicProjection(conicConformalRaw).scale(109.5).parallels([30, 30]);
}

//#endregion
//#region node_modules/d3-geo/src/projection/equirectangular.js
function equirectangularRaw(lambda, phi$1) {
	return [lambda, phi$1];
}
equirectangularRaw.invert = equirectangularRaw;
function equirectangular_default() {
	return projection(equirectangularRaw).scale(152.63);
}

//#endregion
//#region node_modules/d3-geo/src/projection/conicEquidistant.js
function conicEquidistantRaw(y0$5, y1$1) {
	var cy0 = cos$1(y0$5), n = y0$5 === y1$1 ? sin$1(y0$5) : (cy0 - cos$1(y1$1)) / (y1$1 - y0$5), g = cy0 / n + y0$5;
	if (abs$1(n) < epsilon$1) return equirectangularRaw;
	function project(x$3, y$3) {
		var gy = g - y$3, nx = n * x$3;
		return [gy * sin$1(nx), g - gy * cos$1(nx)];
	}
	project.invert = function(x$3, y$3) {
		var gy = g - y$3, l = atan2$1(x$3, abs$1(gy)) * sign$1(gy);
		if (gy * n < 0) l -= pi$1 * sign$1(x$3) * sign$1(gy);
		return [l / n, g - sign$1(n) * sqrt$2(x$3 * x$3 + gy * gy)];
	};
	return project;
}
function conicEquidistant_default() {
	return conicProjection(conicEquidistantRaw).scale(131.154).center([0, 13.9389]);
}

//#endregion
//#region node_modules/d3-geo/src/projection/equalEarth.js
var A1 = 1.340264, A2 = -.081106, A3 = 893e-6, A4 = .003796, M = sqrt$2(3) / 2, iterations = 12;
function equalEarthRaw(lambda, phi$1) {
	var l = asin$1(M * sin$1(phi$1)), l2 = l * l, l6 = l2 * l2 * l2;
	return [lambda * cos$1(l) / (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2))), l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2))];
}
equalEarthRaw.invert = function(x$3, y$3) {
	var l = y$3, l2 = l * l, l6 = l2 * l2 * l2;
	for (var i = 0, delta, fy, fpy; i < iterations; ++i) {
		fy = l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2)) - y$3;
		fpy = A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2);
		l -= delta = fy / fpy, l2 = l * l, l6 = l2 * l2 * l2;
		if (abs$1(delta) < epsilon2) break;
	}
	return [M * x$3 * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2)) / cos$1(l), asin$1(sin$1(l) / M)];
};
function equalEarth_default() {
	return projection(equalEarthRaw).scale(177.158);
}

//#endregion
//#region node_modules/d3-geo/src/projection/gnomonic.js
function gnomonicRaw(x$3, y$3) {
	var cy = cos$1(y$3), k$1 = cos$1(x$3) * cy;
	return [cy * sin$1(x$3) / k$1, sin$1(y$3) / k$1];
}
gnomonicRaw.invert = azimuthalInvert(atan);
function gnomonic_default() {
	return projection(gnomonicRaw).scale(144.049).clipAngle(60);
}

//#endregion
//#region node_modules/d3-geo/src/projection/identity.js
function identity_default() {
	var k$1 = 1, tx = 0, ty = 0, sx = 1, sy = 1, alpha = 0, ca$2, sa, x0$5 = null, y0$5, x1$1, y1$1, kx$1 = 1, ky$1 = 1, transform$1 = transformer$3({ point: function(x$3, y$3) {
		var p = projection$1([x$3, y$3]);
		this.stream.point(p[0], p[1]);
	} }), postclip = identity_default$2, cache, cacheStream;
	function reset() {
		kx$1 = k$1 * sx;
		ky$1 = k$1 * sy;
		cache = cacheStream = null;
		return projection$1;
	}
	function projection$1(p) {
		var x$3 = p[0] * kx$1, y$3 = p[1] * ky$1;
		if (alpha) {
			var t = y$3 * ca$2 - x$3 * sa;
			x$3 = x$3 * ca$2 + y$3 * sa;
			y$3 = t;
		}
		return [x$3 + tx, y$3 + ty];
	}
	projection$1.invert = function(p) {
		var x$3 = p[0] - tx, y$3 = p[1] - ty;
		if (alpha) {
			var t = y$3 * ca$2 + x$3 * sa;
			x$3 = x$3 * ca$2 - y$3 * sa;
			y$3 = t;
		}
		return [x$3 / kx$1, y$3 / ky$1];
	};
	projection$1.stream = function(stream) {
		return cache && cacheStream === stream ? cache : cache = transform$1(postclip(cacheStream = stream));
	};
	projection$1.postclip = function(_) {
		return arguments.length ? (postclip = _, x0$5 = y0$5 = x1$1 = y1$1 = null, reset()) : postclip;
	};
	projection$1.clipExtent = function(_) {
		return arguments.length ? (postclip = _ == null ? (x0$5 = y0$5 = x1$1 = y1$1 = null, identity_default$2) : clipRectangle(x0$5 = +_[0][0], y0$5 = +_[0][1], x1$1 = +_[1][0], y1$1 = +_[1][1]), reset()) : x0$5 == null ? null : [[x0$5, y0$5], [x1$1, y1$1]];
	};
	projection$1.scale = function(_) {
		return arguments.length ? (k$1 = +_, reset()) : k$1;
	};
	projection$1.translate = function(_) {
		return arguments.length ? (tx = +_[0], ty = +_[1], reset()) : [tx, ty];
	};
	projection$1.angle = function(_) {
		return arguments.length ? (alpha = _ % 360 * radians, sa = sin$1(alpha), ca$2 = cos$1(alpha), reset()) : alpha * degrees;
	};
	projection$1.reflectX = function(_) {
		return arguments.length ? (sx = _ ? -1 : 1, reset()) : sx < 0;
	};
	projection$1.reflectY = function(_) {
		return arguments.length ? (sy = _ ? -1 : 1, reset()) : sy < 0;
	};
	projection$1.fitExtent = function(extent$1, object$1) {
		return fitExtent(projection$1, extent$1, object$1);
	};
	projection$1.fitSize = function(size, object$1) {
		return fitSize(projection$1, size, object$1);
	};
	projection$1.fitWidth = function(width, object$1) {
		return fitWidth(projection$1, width, object$1);
	};
	projection$1.fitHeight = function(height, object$1) {
		return fitHeight(projection$1, height, object$1);
	};
	return projection$1;
}

//#endregion
//#region node_modules/d3-geo/src/projection/naturalEarth1.js
function naturalEarth1Raw(lambda, phi$1) {
	var phi2 = phi$1 * phi$1, phi4 = phi2 * phi2;
	return [lambda * (.8707 - .131979 * phi2 + phi4 * (-.013791 + phi4 * (.003971 * phi2 - .001529 * phi4))), phi$1 * (1.007226 + phi2 * (.015085 + phi4 * (-.044475 + .028874 * phi2 - .005916 * phi4)))];
}
naturalEarth1Raw.invert = function(x$3, y$3) {
	var phi$1 = y$3, i = 25, delta;
	do {
		var phi2 = phi$1 * phi$1, phi4 = phi2 * phi2;
		phi$1 -= delta = (phi$1 * (1.007226 + phi2 * (.015085 + phi4 * (-.044475 + .028874 * phi2 - .005916 * phi4))) - y$3) / (1.007226 + phi2 * (.015085 * 3 + phi4 * (-.044475 * 7 + .028874 * 9 * phi2 - .005916 * 11 * phi4)));
	} while (abs$1(delta) > epsilon$1 && --i > 0);
	return [x$3 / (.8707 + (phi2 = phi$1 * phi$1) * (-.131979 + phi2 * (-.013791 + phi2 * phi2 * phi2 * (.003971 - .001529 * phi2)))), phi$1];
};
function naturalEarth1_default() {
	return projection(naturalEarth1Raw).scale(175.295);
}

//#endregion
//#region node_modules/d3-geo/src/projection/orthographic.js
function orthographicRaw(x$3, y$3) {
	return [cos$1(y$3) * sin$1(x$3), sin$1(y$3)];
}
orthographicRaw.invert = azimuthalInvert(asin$1);
function orthographic_default() {
	return projection(orthographicRaw).scale(249.5).clipAngle(90 + epsilon$1);
}

//#endregion
//#region node_modules/d3-geo/src/projection/stereographic.js
function stereographicRaw(x$3, y$3) {
	var cy = cos$1(y$3), k$1 = 1 + cos$1(x$3) * cy;
	return [cy * sin$1(x$3) / k$1, sin$1(y$3) / k$1];
}
stereographicRaw.invert = azimuthalInvert(function(z) {
	return 2 * atan(z);
});
function stereographic_default() {
	return projection(stereographicRaw).scale(250).clipAngle(142);
}

//#endregion
//#region node_modules/d3-geo/src/projection/transverseMercator.js
function transverseMercatorRaw(lambda, phi$1) {
	return [log$1(tan((halfPi$1 + phi$1) / 2)), -lambda];
}
transverseMercatorRaw.invert = function(x$3, y$3) {
	return [-y$3, 2 * atan(exp(x$3)) - halfPi$1];
};
function transverseMercator_default() {
	var m$2 = mercatorProjection(transverseMercatorRaw), center$1 = m$2.center, rotate = m$2.rotate;
	m$2.center = function(_) {
		return arguments.length ? center$1([-_[1], _[0]]) : (_ = center$1(), [_[1], -_[0]]);
	};
	m$2.rotate = function(_) {
		return arguments.length ? rotate([
			_[0],
			_[1],
			_.length > 2 ? _[2] + 90 : 90
		]) : (_ = rotate(), [
			_[0],
			_[1],
			_[2] - 90
		]);
	};
	return rotate([
		0,
		0,
		90
	]).scale(159.155);
}

//#endregion
//#region node_modules/d3-hierarchy/src/cluster.js
function defaultSeparation$1(a$3, b) {
	return a$3.parent === b.parent ? 1 : 2;
}
function meanX(children$1) {
	return children$1.reduce(meanXReduce, 0) / children$1.length;
}
function meanXReduce(x$3, c$5) {
	return x$3 + c$5.x;
}
function maxY(children$1) {
	return 1 + children$1.reduce(maxYReduce, 0);
}
function maxYReduce(y$3, c$5) {
	return Math.max(y$3, c$5.y);
}
function leafLeft(node) {
	var children$1;
	while (children$1 = node.children) node = children$1[0];
	return node;
}
function leafRight(node) {
	var children$1;
	while (children$1 = node.children) node = children$1[children$1.length - 1];
	return node;
}
function cluster_default() {
	var separation = defaultSeparation$1, dx = 1, dy = 1, nodeSize = false;
	function cluster(root$2) {
		var previousNode, x$3 = 0;
		root$2.eachAfter(function(node) {
			var children$1 = node.children;
			if (children$1) {
				node.x = meanX(children$1);
				node.y = maxY(children$1);
			} else {
				node.x = previousNode ? x$3 += separation(node, previousNode) : 0;
				node.y = 0;
				previousNode = node;
			}
		});
		var left$1 = leafLeft(root$2), right$1 = leafRight(root$2), x0$5 = left$1.x - separation(left$1, right$1) / 2, x1$1 = right$1.x + separation(right$1, left$1) / 2;
		return root$2.eachAfter(nodeSize ? function(node) {
			node.x = (node.x - root$2.x) * dx;
			node.y = (root$2.y - node.y) * dy;
		} : function(node) {
			node.x = (node.x - x0$5) / (x1$1 - x0$5) * dx;
			node.y = (1 - (root$2.y ? node.y / root$2.y : 1)) * dy;
		});
	}
	cluster.separation = function(x$3) {
		return arguments.length ? (separation = x$3, cluster) : separation;
	};
	cluster.size = function(x$3) {
		return arguments.length ? (nodeSize = false, dx = +x$3[0], dy = +x$3[1], cluster) : nodeSize ? null : [dx, dy];
	};
	cluster.nodeSize = function(x$3) {
		return arguments.length ? (nodeSize = true, dx = +x$3[0], dy = +x$3[1], cluster) : nodeSize ? [dx, dy] : null;
	};
	return cluster;
}

//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/count.js
function count$1(node) {
	var sum$3 = 0, children$1 = node.children, i = children$1 && children$1.length;
	if (!i) sum$3 = 1;
	else while (--i >= 0) sum$3 += children$1[i].value;
	node.value = sum$3;
}
function count_default() {
	return this.eachAfter(count$1);
}

//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/each.js
function each_default(callback, that) {
	let index$2 = -1;
	for (const node of this) callback.call(that, node, ++index$2, this);
	return this;
}

//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/eachBefore.js
function eachBefore_default(callback, that) {
	var node = this, nodes = [node], children$1, i, index$2 = -1;
	while (node = nodes.pop()) {
		callback.call(that, node, ++index$2, this);
		if (children$1 = node.children) for (i = children$1.length - 1; i >= 0; --i) nodes.push(children$1[i]);
	}
	return this;
}

//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/eachAfter.js
function eachAfter_default(callback, that) {
	var node = this, nodes = [node], next = [], children$1, i, n, index$2 = -1;
	while (node = nodes.pop()) {
		next.push(node);
		if (children$1 = node.children) for (i = 0, n = children$1.length; i < n; ++i) nodes.push(children$1[i]);
	}
	while (node = next.pop()) callback.call(that, node, ++index$2, this);
	return this;
}

//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/find.js
function find_default(callback, that) {
	let index$2 = -1;
	for (const node of this) if (callback.call(that, node, ++index$2, this)) return node;
}

//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/sum.js
function sum_default(value) {
	return this.eachAfter(function(node) {
		var sum$3 = +value(node.data) || 0, children$1 = node.children, i = children$1 && children$1.length;
		while (--i >= 0) sum$3 += children$1[i].value;
		node.value = sum$3;
	});
}

//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/sort.js
function sort_default(compare) {
	return this.eachBefore(function(node) {
		if (node.children) node.children.sort(compare);
	});
}

//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/path.js
function path_default$1(end) {
	var start$1 = this, ancestor = leastCommonAncestor(start$1, end), nodes = [start$1];
	while (start$1 !== ancestor) {
		start$1 = start$1.parent;
		nodes.push(start$1);
	}
	var k$1 = nodes.length;
	while (end !== ancestor) {
		nodes.splice(k$1, 0, end);
		end = end.parent;
	}
	return nodes;
}
function leastCommonAncestor(a$3, b) {
	if (a$3 === b) return a$3;
	var aNodes = a$3.ancestors(), bNodes = b.ancestors(), c$5 = null;
	a$3 = aNodes.pop();
	b = bNodes.pop();
	while (a$3 === b) {
		c$5 = a$3;
		a$3 = aNodes.pop();
		b = bNodes.pop();
	}
	return c$5;
}

//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/ancestors.js
function ancestors_default() {
	var node = this, nodes = [node];
	while (node = node.parent) nodes.push(node);
	return nodes;
}

//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/descendants.js
function descendants_default() {
	return Array.from(this);
}

//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/leaves.js
function leaves_default() {
	var leaves = [];
	this.eachBefore(function(node) {
		if (!node.children) leaves.push(node);
	});
	return leaves;
}

//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/links.js
function links_default() {
	var root$2 = this, links = [];
	root$2.each(function(node) {
		if (node !== root$2) links.push({
			source: node.parent,
			target: node
		});
	});
	return links;
}

//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/iterator.js
function* iterator_default() {
	var node = this, current, next = [node], children$1, i, n;
	do {
		current = next.reverse(), next = [];
		while (node = current.pop()) {
			yield node;
			if (children$1 = node.children) for (i = 0, n = children$1.length; i < n; ++i) next.push(children$1[i]);
		}
	} while (next.length);
}

//#endregion
//#region node_modules/d3-hierarchy/src/hierarchy/index.js
function hierarchy(data, children$1) {
	if (data instanceof Map) {
		data = [void 0, data];
		if (children$1 === void 0) children$1 = mapChildren;
	} else if (children$1 === void 0) children$1 = objectChildren;
	var root$2 = new Node(data), node, nodes = [root$2], child, childs, i, n;
	while (node = nodes.pop()) if ((childs = children$1(node.data)) && (n = (childs = Array.from(childs)).length)) {
		node.children = childs;
		for (i = n - 1; i >= 0; --i) {
			nodes.push(child = childs[i] = new Node(childs[i]));
			child.parent = node;
			child.depth = node.depth + 1;
		}
	}
	return root$2.eachBefore(computeHeight);
}
function node_copy() {
	return hierarchy(this).eachBefore(copyData);
}
function objectChildren(d) {
	return d.children;
}
function mapChildren(d) {
	return Array.isArray(d) ? d[1] : null;
}
function copyData(node) {
	if (node.data.value !== void 0) node.value = node.data.value;
	node.data = node.data.data;
}
function computeHeight(node) {
	var height = 0;
	do
		node.height = height;
	while ((node = node.parent) && node.height < ++height);
}
function Node(data) {
	this.data = data;
	this.depth = this.height = 0;
	this.parent = null;
}
Node.prototype = hierarchy.prototype = {
	constructor: Node,
	count: count_default,
	each: each_default,
	eachAfter: eachAfter_default,
	eachBefore: eachBefore_default,
	find: find_default,
	sum: sum_default,
	sort: sort_default,
	path: path_default$1,
	ancestors: ancestors_default,
	descendants: descendants_default,
	leaves: leaves_default,
	links: links_default,
	copy: node_copy,
	[Symbol.iterator]: iterator_default
};

//#endregion
//#region node_modules/d3-hierarchy/src/accessors.js
function optional(f) {
	return f == null ? null : required(f);
}
function required(f) {
	if (typeof f !== "function") throw new Error();
	return f;
}

//#endregion
//#region node_modules/d3-hierarchy/src/constant.js
function constantZero() {
	return 0;
}
function constant_default$2(x$3) {
	return function() {
		return x$3;
	};
}

//#endregion
//#region node_modules/d3-hierarchy/src/lcg.js
var a$1 = 1664525;
var c$3 = 1013904223;
var m = 4294967296;
function lcg_default() {
	let s$1 = 1;
	return () => (s$1 = (a$1 * s$1 + c$3) % m) / m;
}

//#endregion
//#region node_modules/d3-hierarchy/src/array.js
function array_default$2(x$3) {
	return typeof x$3 === "object" && "length" in x$3 ? x$3 : Array.from(x$3);
}
function shuffle(array$3, random) {
	let m$2 = array$3.length, t, i;
	while (m$2) {
		i = random() * m$2-- | 0;
		t = array$3[m$2];
		array$3[m$2] = array$3[i];
		array$3[i] = t;
	}
	return array$3;
}

//#endregion
//#region node_modules/d3-hierarchy/src/pack/enclose.js
function enclose_default(circles) {
	return packEncloseRandom(circles, lcg_default());
}
function packEncloseRandom(circles, random) {
	var i = 0, n = (circles = shuffle(Array.from(circles), random)).length, B$2 = [], p, e;
	while (i < n) {
		p = circles[i];
		if (e && enclosesWeak(e, p)) ++i;
		else e = encloseBasis(B$2 = extendBasis(B$2, p)), i = 0;
	}
	return e;
}
function extendBasis(B$2, p) {
	var i, j;
	if (enclosesWeakAll(p, B$2)) return [p];
	for (i = 0; i < B$2.length; ++i) if (enclosesNot(p, B$2[i]) && enclosesWeakAll(encloseBasis2(B$2[i], p), B$2)) return [B$2[i], p];
	for (i = 0; i < B$2.length - 1; ++i) for (j = i + 1; j < B$2.length; ++j) if (enclosesNot(encloseBasis2(B$2[i], B$2[j]), p) && enclosesNot(encloseBasis2(B$2[i], p), B$2[j]) && enclosesNot(encloseBasis2(B$2[j], p), B$2[i]) && enclosesWeakAll(encloseBasis3(B$2[i], B$2[j], p), B$2)) return [
		B$2[i],
		B$2[j],
		p
	];
	throw new Error();
}
function enclosesNot(a$3, b) {
	var dr = a$3.r - b.r, dx = b.x - a$3.x, dy = b.y - a$3.y;
	return dr < 0 || dr * dr < dx * dx + dy * dy;
}
function enclosesWeak(a$3, b) {
	var dr = a$3.r - b.r + Math.max(a$3.r, b.r, 1) * 1e-9, dx = b.x - a$3.x, dy = b.y - a$3.y;
	return dr > 0 && dr * dr > dx * dx + dy * dy;
}
function enclosesWeakAll(a$3, B$2) {
	for (var i = 0; i < B$2.length; ++i) if (!enclosesWeak(a$3, B$2[i])) return false;
	return true;
}
function encloseBasis(B$2) {
	switch (B$2.length) {
		case 1: return encloseBasis1(B$2[0]);
		case 2: return encloseBasis2(B$2[0], B$2[1]);
		case 3: return encloseBasis3(B$2[0], B$2[1], B$2[2]);
	}
}
function encloseBasis1(a$3) {
	return {
		x: a$3.x,
		y: a$3.y,
		r: a$3.r
	};
}
function encloseBasis2(a$3, b) {
	var x1$1 = a$3.x, y1$1 = a$3.y, r1 = a$3.r, x2 = b.x, y2 = b.y, r2 = b.r, x21 = x2 - x1$1, y21 = y2 - y1$1, r21 = r2 - r1, l = Math.sqrt(x21 * x21 + y21 * y21);
	return {
		x: (x1$1 + x2 + x21 / l * r21) / 2,
		y: (y1$1 + y2 + y21 / l * r21) / 2,
		r: (l + r1 + r2) / 2
	};
}
function encloseBasis3(a$3, b, c$5) {
	var x1$1 = a$3.x, y1$1 = a$3.y, r1 = a$3.r, x2 = b.x, y2 = b.y, r2 = b.r, x3 = c$5.x, y3 = c$5.y, r3 = c$5.r, a2 = x1$1 - x2, a3 = x1$1 - x3, b2$1 = y1$1 - y2, b3$1 = y1$1 - y3, c2 = r2 - r1, c3 = r3 - r1, d1 = x1$1 * x1$1 + y1$1 * y1$1 - r1 * r1, d2 = d1 - x2 * x2 - y2 * y2 + r2 * r2, d3 = d1 - x3 * x3 - y3 * y3 + r3 * r3, ab$3 = a3 * b2$1 - a2 * b3$1, xa = (b2$1 * d3 - b3$1 * d2) / (ab$3 * 2) - x1$1, xb = (b3$1 * c2 - b2$1 * c3) / ab$3, ya = (a3 * d2 - a2 * d3) / (ab$3 * 2) - y1$1, yb = (a2 * c3 - a3 * c2) / ab$3, A$1 = xb * xb + yb * yb - 1, B$2 = 2 * (r1 + xa * xb + ya * yb), C$1 = xa * xa + ya * ya - r1 * r1, r = -(Math.abs(A$1) > 1e-6 ? (B$2 + Math.sqrt(B$2 * B$2 - 4 * A$1 * C$1)) / (2 * A$1) : C$1 / B$2);
	return {
		x: x1$1 + xa + xb * r,
		y: y1$1 + ya + yb * r,
		r
	};
}

//#endregion
//#region node_modules/d3-hierarchy/src/pack/siblings.js
function place(b, a$3, c$5) {
	var dx = b.x - a$3.x, x$3, a2, dy = b.y - a$3.y, y$3, b2$1, d2 = dx * dx + dy * dy;
	if (d2) {
		a2 = a$3.r + c$5.r, a2 *= a2;
		b2$1 = b.r + c$5.r, b2$1 *= b2$1;
		if (a2 > b2$1) {
			x$3 = (d2 + b2$1 - a2) / (2 * d2);
			y$3 = Math.sqrt(Math.max(0, b2$1 / d2 - x$3 * x$3));
			c$5.x = b.x - x$3 * dx - y$3 * dy;
			c$5.y = b.y - x$3 * dy + y$3 * dx;
		} else {
			x$3 = (d2 + a2 - b2$1) / (2 * d2);
			y$3 = Math.sqrt(Math.max(0, a2 / d2 - x$3 * x$3));
			c$5.x = a$3.x + x$3 * dx - y$3 * dy;
			c$5.y = a$3.y + x$3 * dy + y$3 * dx;
		}
	} else {
		c$5.x = a$3.x + c$5.r;
		c$5.y = a$3.y;
	}
}
function intersects(a$3, b) {
	var dr = a$3.r + b.r - 1e-6, dx = b.x - a$3.x, dy = b.y - a$3.y;
	return dr > 0 && dr * dr > dx * dx + dy * dy;
}
function score(node) {
	var a$3 = node._, b = node.next._, ab$3 = a$3.r + b.r, dx = (a$3.x * b.r + b.x * a$3.r) / ab$3, dy = (a$3.y * b.r + b.y * a$3.r) / ab$3;
	return dx * dx + dy * dy;
}
function Node$1(circle) {
	this._ = circle;
	this.next = null;
	this.previous = null;
}
function packSiblingsRandom(circles, random) {
	if (!(n = (circles = array_default$2(circles)).length)) return 0;
	var a$3 = circles[0], b, c$5, n, aa$1, ca$2, i, j, k$1, sj, sk;
	a$3.x = 0, a$3.y = 0;
	if (!(n > 1)) return a$3.r;
	b = circles[1], a$3.x = -b.r, b.x = a$3.r, b.y = 0;
	if (!(n > 2)) return a$3.r + b.r;
	place(b, a$3, c$5 = circles[2]);
	a$3 = new Node$1(a$3), b = new Node$1(b), c$5 = new Node$1(c$5);
	a$3.next = c$5.previous = b;
	b.next = a$3.previous = c$5;
	c$5.next = b.previous = a$3;
	pack: for (i = 3; i < n; ++i) {
		place(a$3._, b._, c$5 = circles[i]), c$5 = new Node$1(c$5);
		j = b.next, k$1 = a$3.previous, sj = b._.r, sk = a$3._.r;
		do
			if (sj <= sk) {
				if (intersects(j._, c$5._)) {
					b = j, a$3.next = b, b.previous = a$3, --i;
					continue pack;
				}
				sj += j._.r, j = j.next;
			} else {
				if (intersects(k$1._, c$5._)) {
					a$3 = k$1, a$3.next = b, b.previous = a$3, --i;
					continue pack;
				}
				sk += k$1._.r, k$1 = k$1.previous;
			}
		while (j !== k$1.next);
		c$5.previous = a$3, c$5.next = b, a$3.next = b.previous = b = c$5;
		aa$1 = score(a$3);
		while ((c$5 = c$5.next) !== b) if ((ca$2 = score(c$5)) < aa$1) a$3 = c$5, aa$1 = ca$2;
		b = a$3.next;
	}
	a$3 = [b._], c$5 = b;
	while ((c$5 = c$5.next) !== b) a$3.push(c$5._);
	c$5 = packEncloseRandom(a$3, random);
	for (i = 0; i < n; ++i) a$3 = circles[i], a$3.x -= c$5.x, a$3.y -= c$5.y;
	return c$5.r;
}
function siblings_default(circles) {
	packSiblingsRandom(circles, lcg_default());
	return circles;
}

//#endregion
//#region node_modules/d3-hierarchy/src/pack/index.js
function defaultRadius(d) {
	return Math.sqrt(d.value);
}
function pack_default() {
	var radius = null, dx = 1, dy = 1, padding = constantZero;
	function pack(root$2) {
		const random = lcg_default();
		root$2.x = dx / 2, root$2.y = dy / 2;
		if (radius) root$2.eachBefore(radiusLeaf(radius)).eachAfter(packChildrenRandom(padding, .5, random)).eachBefore(translateChild(1));
		else root$2.eachBefore(radiusLeaf(defaultRadius)).eachAfter(packChildrenRandom(constantZero, 1, random)).eachAfter(packChildrenRandom(padding, root$2.r / Math.min(dx, dy), random)).eachBefore(translateChild(Math.min(dx, dy) / (2 * root$2.r)));
		return root$2;
	}
	pack.radius = function(x$3) {
		return arguments.length ? (radius = optional(x$3), pack) : radius;
	};
	pack.size = function(x$3) {
		return arguments.length ? (dx = +x$3[0], dy = +x$3[1], pack) : [dx, dy];
	};
	pack.padding = function(x$3) {
		return arguments.length ? (padding = typeof x$3 === "function" ? x$3 : constant_default$2(+x$3), pack) : padding;
	};
	return pack;
}
function radiusLeaf(radius) {
	return function(node) {
		if (!node.children) node.r = Math.max(0, +radius(node) || 0);
	};
}
function packChildrenRandom(padding, k$1, random) {
	return function(node) {
		if (children$1 = node.children) {
			var children$1, i, n = children$1.length, r = padding(node) * k$1 || 0, e;
			if (r) for (i = 0; i < n; ++i) children$1[i].r += r;
			e = packSiblingsRandom(children$1, random);
			if (r) for (i = 0; i < n; ++i) children$1[i].r -= r;
			node.r = e + r;
		}
	};
}
function translateChild(k$1) {
	return function(node) {
		var parent = node.parent;
		node.r *= k$1;
		if (parent) {
			node.x = parent.x + k$1 * node.x;
			node.y = parent.y + k$1 * node.y;
		}
	};
}

//#endregion
//#region node_modules/d3-hierarchy/src/treemap/round.js
function round_default$1(node) {
	node.x0 = Math.round(node.x0);
	node.y0 = Math.round(node.y0);
	node.x1 = Math.round(node.x1);
	node.y1 = Math.round(node.y1);
}

//#endregion
//#region node_modules/d3-hierarchy/src/treemap/dice.js
function dice_default(parent, x0$5, y0$5, x1$1, y1$1) {
	var nodes = parent.children, node, i = -1, n = nodes.length, k$1 = parent.value && (x1$1 - x0$5) / parent.value;
	while (++i < n) {
		node = nodes[i], node.y0 = y0$5, node.y1 = y1$1;
		node.x0 = x0$5, node.x1 = x0$5 += node.value * k$1;
	}
}

//#endregion
//#region node_modules/d3-hierarchy/src/partition.js
function partition_default() {
	var dx = 1, dy = 1, padding = 0, round = false;
	function partition(root$2) {
		var n = root$2.height + 1;
		root$2.x0 = root$2.y0 = padding;
		root$2.x1 = dx;
		root$2.y1 = dy / n;
		root$2.eachBefore(positionNode(dy, n));
		if (round) root$2.eachBefore(round_default$1);
		return root$2;
	}
	function positionNode(dy$1, n) {
		return function(node) {
			if (node.children) dice_default(node, node.x0, dy$1 * (node.depth + 1) / n, node.x1, dy$1 * (node.depth + 2) / n);
			var x0$5 = node.x0, y0$5 = node.y0, x1$1 = node.x1 - padding, y1$1 = node.y1 - padding;
			if (x1$1 < x0$5) x0$5 = x1$1 = (x0$5 + x1$1) / 2;
			if (y1$1 < y0$5) y0$5 = y1$1 = (y0$5 + y1$1) / 2;
			node.x0 = x0$5;
			node.y0 = y0$5;
			node.x1 = x1$1;
			node.y1 = y1$1;
		};
	}
	partition.round = function(x$3) {
		return arguments.length ? (round = !!x$3, partition) : round;
	};
	partition.size = function(x$3) {
		return arguments.length ? (dx = +x$3[0], dy = +x$3[1], partition) : [dx, dy];
	};
	partition.padding = function(x$3) {
		return arguments.length ? (padding = +x$3, partition) : padding;
	};
	return partition;
}

//#endregion
//#region node_modules/d3-hierarchy/src/stratify.js
var preroot = { depth: -1 }, ambiguous = {}, imputed = {};
function defaultId(d) {
	return d.id;
}
function defaultParentId(d) {
	return d.parentId;
}
function stratify_default() {
	var id$1 = defaultId, parentId = defaultParentId, path$1;
	function stratify(data) {
		var nodes = Array.from(data), currentId = id$1, currentParentId = parentId, n, d, i, root$2, parent, node, nodeId, nodeKey, nodeByKey = /* @__PURE__ */ new Map();
		if (path$1 != null) {
			const I = nodes.map((d$1, i$1) => normalize$1(path$1(d$1, i$1, data)));
			const P = I.map(parentof);
			const S = new Set(I).add("");
			for (const i$1 of P) if (!S.has(i$1)) {
				S.add(i$1);
				I.push(i$1);
				P.push(parentof(i$1));
				nodes.push(imputed);
			}
			currentId = (_, i$1) => I[i$1];
			currentParentId = (_, i$1) => P[i$1];
		}
		for (i = 0, n = nodes.length; i < n; ++i) {
			d = nodes[i], node = nodes[i] = new Node(d);
			if ((nodeId = currentId(d, i, data)) != null && (nodeId += "")) {
				nodeKey = node.id = nodeId;
				nodeByKey.set(nodeKey, nodeByKey.has(nodeKey) ? ambiguous : node);
			}
			if ((nodeId = currentParentId(d, i, data)) != null && (nodeId += "")) node.parent = nodeId;
		}
		for (i = 0; i < n; ++i) {
			node = nodes[i];
			if (nodeId = node.parent) {
				parent = nodeByKey.get(nodeId);
				if (!parent) throw new Error("missing: " + nodeId);
				if (parent === ambiguous) throw new Error("ambiguous: " + nodeId);
				if (parent.children) parent.children.push(node);
				else parent.children = [node];
				node.parent = parent;
			} else {
				if (root$2) throw new Error("multiple roots");
				root$2 = node;
			}
		}
		if (!root$2) throw new Error("no root");
		if (path$1 != null) {
			while (root$2.data === imputed && root$2.children.length === 1) root$2 = root$2.children[0], --n;
			for (let i$1 = nodes.length - 1; i$1 >= 0; --i$1) {
				node = nodes[i$1];
				if (node.data !== imputed) break;
				node.data = null;
			}
		}
		root$2.parent = preroot;
		root$2.eachBefore(function(node$1) {
			node$1.depth = node$1.parent.depth + 1;
			--n;
		}).eachBefore(computeHeight);
		root$2.parent = null;
		if (n > 0) throw new Error("cycle");
		return root$2;
	}
	stratify.id = function(x$3) {
		return arguments.length ? (id$1 = optional(x$3), stratify) : id$1;
	};
	stratify.parentId = function(x$3) {
		return arguments.length ? (parentId = optional(x$3), stratify) : parentId;
	};
	stratify.path = function(x$3) {
		return arguments.length ? (path$1 = optional(x$3), stratify) : path$1;
	};
	return stratify;
}
function normalize$1(path$1) {
	path$1 = `${path$1}`;
	let i = path$1.length;
	if (slash(path$1, i - 1) && !slash(path$1, i - 2)) path$1 = path$1.slice(0, -1);
	return path$1[0] === "/" ? path$1 : `/${path$1}`;
}
function parentof(path$1) {
	let i = path$1.length;
	if (i < 2) return "";
	while (--i > 1) if (slash(path$1, i)) break;
	return path$1.slice(0, i);
}
function slash(path$1, i) {
	if (path$1[i] === "/") {
		let k$1 = 0;
		while (i > 0 && path$1[--i] === "\\") ++k$1;
		if ((k$1 & 1) === 0) return true;
	}
	return false;
}

//#endregion
//#region node_modules/d3-hierarchy/src/tree.js
function defaultSeparation(a$3, b) {
	return a$3.parent === b.parent ? 1 : 2;
}
function nextLeft(v$1) {
	var children$1 = v$1.children;
	return children$1 ? children$1[0] : v$1.t;
}
function nextRight(v$1) {
	var children$1 = v$1.children;
	return children$1 ? children$1[children$1.length - 1] : v$1.t;
}
function moveSubtree(wm, wp, shift) {
	var change = shift / (wp.i - wm.i);
	wp.c -= change;
	wp.s += shift;
	wm.c += change;
	wp.z += shift;
	wp.m += shift;
}
function executeShifts(v$1) {
	var shift = 0, change = 0, children$1 = v$1.children, i = children$1.length, w;
	while (--i >= 0) {
		w = children$1[i];
		w.z += shift;
		w.m += shift;
		shift += w.s + (change += w.c);
	}
}
function nextAncestor(vim, v$1, ancestor) {
	return vim.a.parent === v$1.parent ? vim.a : ancestor;
}
function TreeNode(node, i) {
	this._ = node;
	this.parent = null;
	this.children = null;
	this.A = null;
	this.a = this;
	this.z = 0;
	this.m = 0;
	this.c = 0;
	this.s = 0;
	this.t = null;
	this.i = i;
}
TreeNode.prototype = Object.create(Node.prototype);
function treeRoot(root$2) {
	var tree = new TreeNode(root$2, 0), node, nodes = [tree], child, children$1, i, n;
	while (node = nodes.pop()) if (children$1 = node._.children) {
		node.children = new Array(n = children$1.length);
		for (i = n - 1; i >= 0; --i) {
			nodes.push(child = node.children[i] = new TreeNode(children$1[i], i));
			child.parent = node;
		}
	}
	(tree.parent = new TreeNode(null, 0)).children = [tree];
	return tree;
}
function tree_default() {
	var separation = defaultSeparation, dx = 1, dy = 1, nodeSize = null;
	function tree(root$2) {
		var t = treeRoot(root$2);
		t.eachAfter(firstWalk), t.parent.m = -t.z;
		t.eachBefore(secondWalk);
		if (nodeSize) root$2.eachBefore(sizeNode);
		else {
			var left$1 = root$2, right$1 = root$2, bottom$1 = root$2;
			root$2.eachBefore(function(node) {
				if (node.x < left$1.x) left$1 = node;
				if (node.x > right$1.x) right$1 = node;
				if (node.depth > bottom$1.depth) bottom$1 = node;
			});
			var s$1 = left$1 === right$1 ? 1 : separation(left$1, right$1) / 2, tx = s$1 - left$1.x, kx$1 = dx / (right$1.x + s$1 + tx), ky$1 = dy / (bottom$1.depth || 1);
			root$2.eachBefore(function(node) {
				node.x = (node.x + tx) * kx$1;
				node.y = node.depth * ky$1;
			});
		}
		return root$2;
	}
	function firstWalk(v$1) {
		var children$1 = v$1.children, siblings = v$1.parent.children, w = v$1.i ? siblings[v$1.i - 1] : null;
		if (children$1) {
			executeShifts(v$1);
			var midpoint = (children$1[0].z + children$1[children$1.length - 1].z) / 2;
			if (w) {
				v$1.z = w.z + separation(v$1._, w._);
				v$1.m = v$1.z - midpoint;
			} else v$1.z = midpoint;
		} else if (w) v$1.z = w.z + separation(v$1._, w._);
		v$1.parent.A = apportion(v$1, w, v$1.parent.A || siblings[0]);
	}
	function secondWalk(v$1) {
		v$1._.x = v$1.z + v$1.parent.m;
		v$1.m += v$1.parent.m;
	}
	function apportion(v$1, w, ancestor) {
		if (w) {
			var vip = v$1, vop = v$1, vim = w, vom = vip.parent.children[0], sip = vip.m, sop = vop.m, sim = vim.m, som = vom.m, shift;
			while (vim = nextRight(vim), vip = nextLeft(vip), vim && vip) {
				vom = nextLeft(vom);
				vop = nextRight(vop);
				vop.a = v$1;
				shift = vim.z + sim - vip.z - sip + separation(vim._, vip._);
				if (shift > 0) {
					moveSubtree(nextAncestor(vim, v$1, ancestor), v$1, shift);
					sip += shift;
					sop += shift;
				}
				sim += vim.m;
				sip += vip.m;
				som += vom.m;
				sop += vop.m;
			}
			if (vim && !nextRight(vop)) {
				vop.t = vim;
				vop.m += sim - sop;
			}
			if (vip && !nextLeft(vom)) {
				vom.t = vip;
				vom.m += sip - som;
				ancestor = v$1;
			}
		}
		return ancestor;
	}
	function sizeNode(node) {
		node.x *= dx;
		node.y = node.depth * dy;
	}
	tree.separation = function(x$3) {
		return arguments.length ? (separation = x$3, tree) : separation;
	};
	tree.size = function(x$3) {
		return arguments.length ? (nodeSize = false, dx = +x$3[0], dy = +x$3[1], tree) : nodeSize ? null : [dx, dy];
	};
	tree.nodeSize = function(x$3) {
		return arguments.length ? (nodeSize = true, dx = +x$3[0], dy = +x$3[1], tree) : nodeSize ? [dx, dy] : null;
	};
	return tree;
}

//#endregion
//#region node_modules/d3-hierarchy/src/treemap/slice.js
function slice_default(parent, x0$5, y0$5, x1$1, y1$1) {
	var nodes = parent.children, node, i = -1, n = nodes.length, k$1 = parent.value && (y1$1 - y0$5) / parent.value;
	while (++i < n) {
		node = nodes[i], node.x0 = x0$5, node.x1 = x1$1;
		node.y0 = y0$5, node.y1 = y0$5 += node.value * k$1;
	}
}

//#endregion
//#region node_modules/d3-hierarchy/src/treemap/squarify.js
var phi = (1 + Math.sqrt(5)) / 2;
function squarifyRatio(ratio, parent, x0$5, y0$5, x1$1, y1$1) {
	var rows = [], nodes = parent.children, row, nodeValue, i0 = 0, i1 = 0, n = nodes.length, dx, dy, value = parent.value, sumValue, minValue, maxValue, newRatio, minRatio, alpha, beta;
	while (i0 < n) {
		dx = x1$1 - x0$5, dy = y1$1 - y0$5;
		do
			sumValue = nodes[i1++].value;
		while (!sumValue && i1 < n);
		minValue = maxValue = sumValue;
		alpha = Math.max(dy / dx, dx / dy) / (value * ratio);
		beta = sumValue * sumValue * alpha;
		minRatio = Math.max(maxValue / beta, beta / minValue);
		for (; i1 < n; ++i1) {
			sumValue += nodeValue = nodes[i1].value;
			if (nodeValue < minValue) minValue = nodeValue;
			if (nodeValue > maxValue) maxValue = nodeValue;
			beta = sumValue * sumValue * alpha;
			newRatio = Math.max(maxValue / beta, beta / minValue);
			if (newRatio > minRatio) {
				sumValue -= nodeValue;
				break;
			}
			minRatio = newRatio;
		}
		rows.push(row = {
			value: sumValue,
			dice: dx < dy,
			children: nodes.slice(i0, i1)
		});
		if (row.dice) dice_default(row, x0$5, y0$5, x1$1, value ? y0$5 += dy * sumValue / value : y1$1);
		else slice_default(row, x0$5, y0$5, value ? x0$5 += dx * sumValue / value : x1$1, y1$1);
		value -= sumValue, i0 = i1;
	}
	return rows;
}
var squarify_default = (function custom(ratio) {
	function squarify(parent, x0$5, y0$5, x1$1, y1$1) {
		squarifyRatio(ratio, parent, x0$5, y0$5, x1$1, y1$1);
	}
	squarify.ratio = function(x$3) {
		return custom((x$3 = +x$3) > 1 ? x$3 : 1);
	};
	return squarify;
})(phi);

//#endregion
//#region node_modules/d3-hierarchy/src/treemap/index.js
function treemap_default() {
	var tile = squarify_default, round = false, dx = 1, dy = 1, paddingStack = [0], paddingInner = constantZero, paddingTop = constantZero, paddingRight = constantZero, paddingBottom = constantZero, paddingLeft = constantZero;
	function treemap(root$2) {
		root$2.x0 = root$2.y0 = 0;
		root$2.x1 = dx;
		root$2.y1 = dy;
		root$2.eachBefore(positionNode);
		paddingStack = [0];
		if (round) root$2.eachBefore(round_default$1);
		return root$2;
	}
	function positionNode(node) {
		var p = paddingStack[node.depth], x0$5 = node.x0 + p, y0$5 = node.y0 + p, x1$1 = node.x1 - p, y1$1 = node.y1 - p;
		if (x1$1 < x0$5) x0$5 = x1$1 = (x0$5 + x1$1) / 2;
		if (y1$1 < y0$5) y0$5 = y1$1 = (y0$5 + y1$1) / 2;
		node.x0 = x0$5;
		node.y0 = y0$5;
		node.x1 = x1$1;
		node.y1 = y1$1;
		if (node.children) {
			p = paddingStack[node.depth + 1] = paddingInner(node) / 2;
			x0$5 += paddingLeft(node) - p;
			y0$5 += paddingTop(node) - p;
			x1$1 -= paddingRight(node) - p;
			y1$1 -= paddingBottom(node) - p;
			if (x1$1 < x0$5) x0$5 = x1$1 = (x0$5 + x1$1) / 2;
			if (y1$1 < y0$5) y0$5 = y1$1 = (y0$5 + y1$1) / 2;
			tile(node, x0$5, y0$5, x1$1, y1$1);
		}
	}
	treemap.round = function(x$3) {
		return arguments.length ? (round = !!x$3, treemap) : round;
	};
	treemap.size = function(x$3) {
		return arguments.length ? (dx = +x$3[0], dy = +x$3[1], treemap) : [dx, dy];
	};
	treemap.tile = function(x$3) {
		return arguments.length ? (tile = required(x$3), treemap) : tile;
	};
	treemap.padding = function(x$3) {
		return arguments.length ? treemap.paddingInner(x$3).paddingOuter(x$3) : treemap.paddingInner();
	};
	treemap.paddingInner = function(x$3) {
		return arguments.length ? (paddingInner = typeof x$3 === "function" ? x$3 : constant_default$2(+x$3), treemap) : paddingInner;
	};
	treemap.paddingOuter = function(x$3) {
		return arguments.length ? treemap.paddingTop(x$3).paddingRight(x$3).paddingBottom(x$3).paddingLeft(x$3) : treemap.paddingTop();
	};
	treemap.paddingTop = function(x$3) {
		return arguments.length ? (paddingTop = typeof x$3 === "function" ? x$3 : constant_default$2(+x$3), treemap) : paddingTop;
	};
	treemap.paddingRight = function(x$3) {
		return arguments.length ? (paddingRight = typeof x$3 === "function" ? x$3 : constant_default$2(+x$3), treemap) : paddingRight;
	};
	treemap.paddingBottom = function(x$3) {
		return arguments.length ? (paddingBottom = typeof x$3 === "function" ? x$3 : constant_default$2(+x$3), treemap) : paddingBottom;
	};
	treemap.paddingLeft = function(x$3) {
		return arguments.length ? (paddingLeft = typeof x$3 === "function" ? x$3 : constant_default$2(+x$3), treemap) : paddingLeft;
	};
	return treemap;
}

//#endregion
//#region node_modules/d3-hierarchy/src/treemap/binary.js
function binary_default(parent, x0$5, y0$5, x1$1, y1$1) {
	var nodes = parent.children, i, n = nodes.length, sum$3, sums = new Array(n + 1);
	for (sums[0] = sum$3 = i = 0; i < n; ++i) sums[i + 1] = sum$3 += nodes[i].value;
	partition(0, n, parent.value, x0$5, y0$5, x1$1, y1$1);
	function partition(i$1, j, value, x0$6, y0$6, x1$2, y1$2) {
		if (i$1 >= j - 1) {
			var node = nodes[i$1];
			node.x0 = x0$6, node.y0 = y0$6;
			node.x1 = x1$2, node.y1 = y1$2;
			return;
		}
		var valueOffset = sums[i$1], valueTarget = value / 2 + valueOffset, k$1 = i$1 + 1, hi = j - 1;
		while (k$1 < hi) {
			var mid = k$1 + hi >>> 1;
			if (sums[mid] < valueTarget) k$1 = mid + 1;
			else hi = mid;
		}
		if (valueTarget - sums[k$1 - 1] < sums[k$1] - valueTarget && i$1 + 1 < k$1) --k$1;
		var valueLeft = sums[k$1] - valueOffset, valueRight = value - valueLeft;
		if (x1$2 - x0$6 > y1$2 - y0$6) {
			var xk = value ? (x0$6 * valueRight + x1$2 * valueLeft) / value : x1$2;
			partition(i$1, k$1, valueLeft, x0$6, y0$6, xk, y1$2);
			partition(k$1, j, valueRight, xk, y0$6, x1$2, y1$2);
		} else {
			var yk = value ? (y0$6 * valueRight + y1$2 * valueLeft) / value : y1$2;
			partition(i$1, k$1, valueLeft, x0$6, y0$6, x1$2, yk);
			partition(k$1, j, valueRight, x0$6, yk, x1$2, y1$2);
		}
	}
}

//#endregion
//#region node_modules/d3-hierarchy/src/treemap/sliceDice.js
function sliceDice_default(parent, x0$5, y0$5, x1$1, y1$1) {
	(parent.depth & 1 ? slice_default : dice_default)(parent, x0$5, y0$5, x1$1, y1$1);
}

//#endregion
//#region node_modules/d3-hierarchy/src/treemap/resquarify.js
var resquarify_default = (function custom(ratio) {
	function resquarify(parent, x0$5, y0$5, x1$1, y1$1) {
		if ((rows = parent._squarify) && rows.ratio === ratio) {
			var rows, row, nodes, i, j = -1, n, m$2 = rows.length, value = parent.value;
			while (++j < m$2) {
				row = rows[j], nodes = row.children;
				for (i = row.value = 0, n = nodes.length; i < n; ++i) row.value += nodes[i].value;
				if (row.dice) dice_default(row, x0$5, y0$5, x1$1, value ? y0$5 += (y1$1 - y0$5) * row.value / value : y1$1);
				else slice_default(row, x0$5, y0$5, value ? x0$5 += (x1$1 - x0$5) * row.value / value : x1$1, y1$1);
				value -= row.value;
			}
		} else {
			parent._squarify = rows = squarifyRatio(ratio, parent, x0$5, y0$5, x1$1, y1$1);
			rows.ratio = ratio;
		}
	}
	resquarify.ratio = function(x$3) {
		return custom((x$3 = +x$3) > 1 ? x$3 : 1);
	};
	return resquarify;
})(phi);

//#endregion
//#region node_modules/d3-polygon/src/area.js
function area_default$2(polygon) {
	var i = -1, n = polygon.length, a$3, b = polygon[n - 1], area = 0;
	while (++i < n) {
		a$3 = b;
		b = polygon[i];
		area += a$3[1] * b[0] - a$3[0] * b[1];
	}
	return area / 2;
}

//#endregion
//#region node_modules/d3-polygon/src/centroid.js
function centroid_default$1(polygon) {
	var i = -1, n = polygon.length, x$3 = 0, y$3 = 0, a$3, b = polygon[n - 1], c$5, k$1 = 0;
	while (++i < n) {
		a$3 = b;
		b = polygon[i];
		k$1 += c$5 = a$3[0] * b[1] - b[0] * a$3[1];
		x$3 += (a$3[0] + b[0]) * c$5;
		y$3 += (a$3[1] + b[1]) * c$5;
	}
	return k$1 *= 3, [x$3 / k$1, y$3 / k$1];
}

//#endregion
//#region node_modules/d3-polygon/src/cross.js
function cross_default$1(a$3, b, c$5) {
	return (b[0] - a$3[0]) * (c$5[1] - a$3[1]) - (b[1] - a$3[1]) * (c$5[0] - a$3[0]);
}

//#endregion
//#region node_modules/d3-polygon/src/hull.js
function lexicographicOrder(a$3, b) {
	return a$3[0] - b[0] || a$3[1] - b[1];
}
function computeUpperHullIndexes(points) {
	const n = points.length, indexes$1 = [0, 1];
	let size = 2, i;
	for (i = 2; i < n; ++i) {
		while (size > 1 && cross_default$1(points[indexes$1[size - 2]], points[indexes$1[size - 1]], points[i]) <= 0) --size;
		indexes$1[size++] = i;
	}
	return indexes$1.slice(0, size);
}
function hull_default(points) {
	if ((n = points.length) < 3) return null;
	var i, n, sortedPoints = new Array(n), flippedPoints = new Array(n);
	for (i = 0; i < n; ++i) sortedPoints[i] = [
		+points[i][0],
		+points[i][1],
		i
	];
	sortedPoints.sort(lexicographicOrder);
	for (i = 0; i < n; ++i) flippedPoints[i] = [sortedPoints[i][0], -sortedPoints[i][1]];
	var upperIndexes = computeUpperHullIndexes(sortedPoints), lowerIndexes = computeUpperHullIndexes(flippedPoints);
	var skipLeft = lowerIndexes[0] === upperIndexes[0], skipRight = lowerIndexes[lowerIndexes.length - 1] === upperIndexes[upperIndexes.length - 1], hull = [];
	for (i = upperIndexes.length - 1; i >= 0; --i) hull.push(points[sortedPoints[upperIndexes[i]][2]]);
	for (i = +skipLeft; i < lowerIndexes.length - skipRight; ++i) hull.push(points[sortedPoints[lowerIndexes[i]][2]]);
	return hull;
}

//#endregion
//#region node_modules/d3-polygon/src/contains.js
function contains_default$1(polygon, point$5) {
	var n = polygon.length, p = polygon[n - 1], x$3 = point$5[0], y$3 = point$5[1], x0$5 = p[0], y0$5 = p[1], x1$1, y1$1, inside = false;
	for (var i = 0; i < n; ++i) {
		p = polygon[i], x1$1 = p[0], y1$1 = p[1];
		if (y1$1 > y$3 !== y0$5 > y$3 && x$3 < (x0$5 - x1$1) * (y$3 - y1$1) / (y0$5 - y1$1) + x1$1) inside = !inside;
		x0$5 = x1$1, y0$5 = y1$1;
	}
	return inside;
}

//#endregion
//#region node_modules/d3-polygon/src/length.js
function length_default$1(polygon) {
	var i = -1, n = polygon.length, b = polygon[n - 1], xa, ya, xb = b[0], yb = b[1], perimeter = 0;
	while (++i < n) {
		xa = xb;
		ya = yb;
		b = polygon[i];
		xb = b[0];
		yb = b[1];
		xa -= xb;
		ya -= yb;
		perimeter += Math.hypot(xa, ya);
	}
	return perimeter;
}

//#endregion
//#region node_modules/d3-random/src/defaultSource.js
var defaultSource_default = Math.random;

//#endregion
//#region node_modules/d3-random/src/uniform.js
var uniform_default = (function sourceRandomUniform(source) {
	function randomUniform(min$3, max$4) {
		min$3 = min$3 == null ? 0 : +min$3;
		max$4 = max$4 == null ? 1 : +max$4;
		if (arguments.length === 1) max$4 = min$3, min$3 = 0;
		else max$4 -= min$3;
		return function() {
			return source() * max$4 + min$3;
		};
	}
	randomUniform.source = sourceRandomUniform;
	return randomUniform;
})(defaultSource_default);

//#endregion
//#region node_modules/d3-random/src/int.js
var int_default = (function sourceRandomInt(source) {
	function randomInt(min$3, max$4) {
		if (arguments.length < 2) max$4 = min$3, min$3 = 0;
		min$3 = Math.floor(min$3);
		max$4 = Math.floor(max$4) - min$3;
		return function() {
			return Math.floor(source() * max$4 + min$3);
		};
	}
	randomInt.source = sourceRandomInt;
	return randomInt;
})(defaultSource_default);

//#endregion
//#region node_modules/d3-random/src/normal.js
var normal_default = (function sourceRandomNormal(source) {
	function randomNormal(mu, sigma) {
		var x$3, r;
		mu = mu == null ? 0 : +mu;
		sigma = sigma == null ? 1 : +sigma;
		return function() {
			var y$3;
			if (x$3 != null) y$3 = x$3, x$3 = null;
			else do {
				x$3 = source() * 2 - 1;
				y$3 = source() * 2 - 1;
				r = x$3 * x$3 + y$3 * y$3;
			} while (!r || r > 1);
			return mu + sigma * y$3 * Math.sqrt(-2 * Math.log(r) / r);
		};
	}
	randomNormal.source = sourceRandomNormal;
	return randomNormal;
})(defaultSource_default);

//#endregion
//#region node_modules/d3-random/src/logNormal.js
var logNormal_default = (function sourceRandomLogNormal(source) {
	var N = normal_default.source(source);
	function randomLogNormal() {
		var randomNormal = N.apply(this, arguments);
		return function() {
			return Math.exp(randomNormal());
		};
	}
	randomLogNormal.source = sourceRandomLogNormal;
	return randomLogNormal;
})(defaultSource_default);

//#endregion
//#region node_modules/d3-random/src/irwinHall.js
var irwinHall_default = (function sourceRandomIrwinHall(source) {
	function randomIrwinHall(n) {
		if ((n = +n) <= 0) return () => 0;
		return function() {
			for (var sum$3 = 0, i = n; i > 1; --i) sum$3 += source();
			return sum$3 + i * source();
		};
	}
	randomIrwinHall.source = sourceRandomIrwinHall;
	return randomIrwinHall;
})(defaultSource_default);

//#endregion
//#region node_modules/d3-random/src/bates.js
var bates_default = (function sourceRandomBates(source) {
	var I = irwinHall_default.source(source);
	function randomBates(n) {
		if ((n = +n) === 0) return source;
		var randomIrwinHall = I(n);
		return function() {
			return randomIrwinHall() / n;
		};
	}
	randomBates.source = sourceRandomBates;
	return randomBates;
})(defaultSource_default);

//#endregion
//#region node_modules/d3-random/src/exponential.js
var exponential_default = (function sourceRandomExponential(source) {
	function randomExponential(lambda) {
		return function() {
			return -Math.log1p(-source()) / lambda;
		};
	}
	randomExponential.source = sourceRandomExponential;
	return randomExponential;
})(defaultSource_default);

//#endregion
//#region node_modules/d3-random/src/pareto.js
var pareto_default = (function sourceRandomPareto(source) {
	function randomPareto(alpha) {
		if ((alpha = +alpha) < 0) throw new RangeError("invalid alpha");
		alpha = 1 / -alpha;
		return function() {
			return Math.pow(1 - source(), alpha);
		};
	}
	randomPareto.source = sourceRandomPareto;
	return randomPareto;
})(defaultSource_default);

//#endregion
//#region node_modules/d3-random/src/bernoulli.js
var bernoulli_default = (function sourceRandomBernoulli(source) {
	function randomBernoulli(p) {
		if ((p = +p) < 0 || p > 1) throw new RangeError("invalid p");
		return function() {
			return Math.floor(source() + p);
		};
	}
	randomBernoulli.source = sourceRandomBernoulli;
	return randomBernoulli;
})(defaultSource_default);

//#endregion
//#region node_modules/d3-random/src/geometric.js
var geometric_default = (function sourceRandomGeometric(source) {
	function randomGeometric(p) {
		if ((p = +p) < 0 || p > 1) throw new RangeError("invalid p");
		if (p === 0) return () => Infinity;
		if (p === 1) return () => 1;
		p = Math.log1p(-p);
		return function() {
			return 1 + Math.floor(Math.log1p(-source()) / p);
		};
	}
	randomGeometric.source = sourceRandomGeometric;
	return randomGeometric;
})(defaultSource_default);

//#endregion
//#region node_modules/d3-random/src/gamma.js
var gamma_default = (function sourceRandomGamma(source) {
	var randomNormal = normal_default.source(source)();
	function randomGamma(k$1, theta) {
		if ((k$1 = +k$1) < 0) throw new RangeError("invalid k");
		if (k$1 === 0) return () => 0;
		theta = theta == null ? 1 : +theta;
		if (k$1 === 1) return () => -Math.log1p(-source()) * theta;
		var d = (k$1 < 1 ? k$1 + 1 : k$1) - 1 / 3, c$5 = 1 / (3 * Math.sqrt(d)), multiplier = k$1 < 1 ? () => Math.pow(source(), 1 / k$1) : () => 1;
		return function() {
			do {
				do
					var x$3 = randomNormal(), v$1 = 1 + c$5 * x$3;
				while (v$1 <= 0);
				v$1 *= v$1 * v$1;
				var u$3 = 1 - source();
			} while (u$3 >= 1 - .0331 * x$3 * x$3 * x$3 * x$3 && Math.log(u$3) >= .5 * x$3 * x$3 + d * (1 - v$1 + Math.log(v$1)));
			return d * v$1 * multiplier() * theta;
		};
	}
	randomGamma.source = sourceRandomGamma;
	return randomGamma;
})(defaultSource_default);

//#endregion
//#region node_modules/d3-random/src/beta.js
var beta_default = (function sourceRandomBeta(source) {
	var G = gamma_default.source(source);
	function randomBeta(alpha, beta) {
		var X$1 = G(alpha), Y$1 = G(beta);
		return function() {
			var x$3 = X$1();
			return x$3 === 0 ? 0 : x$3 / (x$3 + Y$1());
		};
	}
	randomBeta.source = sourceRandomBeta;
	return randomBeta;
})(defaultSource_default);

//#endregion
//#region node_modules/d3-random/src/binomial.js
var binomial_default = (function sourceRandomBinomial(source) {
	var G = geometric_default.source(source), B$2 = beta_default.source(source);
	function randomBinomial(n, p) {
		n = +n;
		if ((p = +p) >= 1) return () => n;
		if (p <= 0) return () => 0;
		return function() {
			var acc = 0, nn = n, pp = p;
			while (nn * pp > 16 && nn * (1 - pp) > 16) {
				var i = Math.floor((nn + 1) * pp), y$3 = B$2(i, nn - i + 1)();
				if (y$3 <= pp) {
					acc += i;
					nn -= i;
					pp = (pp - y$3) / (1 - y$3);
				} else {
					nn = i - 1;
					pp /= y$3;
				}
			}
			var sign$2 = pp < .5, pFinal = sign$2 ? pp : 1 - pp, g = G(pFinal);
			for (var s$1 = g(), k$1 = 0; s$1 <= nn; ++k$1) s$1 += g();
			return acc + (sign$2 ? k$1 : nn - k$1);
		};
	}
	randomBinomial.source = sourceRandomBinomial;
	return randomBinomial;
})(defaultSource_default);

//#endregion
//#region node_modules/d3-random/src/weibull.js
var weibull_default = (function sourceRandomWeibull(source) {
	function randomWeibull(k$1, a$3, b) {
		var outerFunc;
		if ((k$1 = +k$1) === 0) outerFunc = (x$3) => -Math.log(x$3);
		else {
			k$1 = 1 / k$1;
			outerFunc = (x$3) => Math.pow(x$3, k$1);
		}
		a$3 = a$3 == null ? 0 : +a$3;
		b = b == null ? 1 : +b;
		return function() {
			return a$3 + b * outerFunc(-Math.log1p(-source()));
		};
	}
	randomWeibull.source = sourceRandomWeibull;
	return randomWeibull;
})(defaultSource_default);

//#endregion
//#region node_modules/d3-random/src/cauchy.js
var cauchy_default = (function sourceRandomCauchy(source) {
	function randomCauchy(a$3, b) {
		a$3 = a$3 == null ? 0 : +a$3;
		b = b == null ? 1 : +b;
		return function() {
			return a$3 + b * Math.tan(Math.PI * source());
		};
	}
	randomCauchy.source = sourceRandomCauchy;
	return randomCauchy;
})(defaultSource_default);

//#endregion
//#region node_modules/d3-random/src/logistic.js
var logistic_default = (function sourceRandomLogistic(source) {
	function randomLogistic(a$3, b) {
		a$3 = a$3 == null ? 0 : +a$3;
		b = b == null ? 1 : +b;
		return function() {
			var u$3 = source();
			return a$3 + b * Math.log(u$3 / (1 - u$3));
		};
	}
	randomLogistic.source = sourceRandomLogistic;
	return randomLogistic;
})(defaultSource_default);

//#endregion
//#region node_modules/d3-random/src/poisson.js
var poisson_default = (function sourceRandomPoisson(source) {
	var G = gamma_default.source(source), B$2 = binomial_default.source(source);
	function randomPoisson(lambda) {
		return function() {
			var acc = 0, l = lambda;
			while (l > 16) {
				var n = Math.floor(.875 * l), t = G(n)();
				if (t > l) return acc + B$2(n - 1, l / t)();
				acc += n;
				l -= t;
			}
			for (var s$1 = -Math.log1p(-source()), k$1 = 0; s$1 <= l; ++k$1) s$1 -= Math.log1p(-source());
			return acc + k$1;
		};
	}
	randomPoisson.source = sourceRandomPoisson;
	return randomPoisson;
})(defaultSource_default);

//#endregion
//#region node_modules/d3-random/src/lcg.js
var mul = 1664525;
var inc = 1013904223;
var eps = 1 / 4294967296;
function lcg(seed = Math.random()) {
	let state = (0 <= seed && seed < 1 ? seed / eps : Math.abs(seed)) | 0;
	return () => (state = mul * state + inc | 0, eps * (state >>> 0));
}

//#endregion
//#region node_modules/d3-scale/src/init.js
function initRange(domain, range$3) {
	switch (arguments.length) {
		case 0: break;
		case 1:
			this.range(domain);
			break;
		default:
			this.range(range$3).domain(domain);
			break;
	}
	return this;
}
function initInterpolator(domain, interpolator) {
	switch (arguments.length) {
		case 0: break;
		case 1:
			if (typeof domain === "function") this.interpolator(domain);
			else this.range(domain);
			break;
		default:
			this.domain(domain);
			if (typeof interpolator === "function") this.interpolator(interpolator);
			else this.range(interpolator);
			break;
	}
	return this;
}

//#endregion
//#region node_modules/d3-scale/src/ordinal.js
const implicit = Symbol("implicit");
function ordinal() {
	var index$2 = new InternMap(), domain = [], range$3 = [], unknown = implicit;
	function scale$1(d) {
		let i = index$2.get(d);
		if (i === void 0) {
			if (unknown !== implicit) return unknown;
			index$2.set(d, i = domain.push(d) - 1);
		}
		return range$3[i % range$3.length];
	}
	scale$1.domain = function(_) {
		if (!arguments.length) return domain.slice();
		domain = [], index$2 = new InternMap();
		for (const value of _) {
			if (index$2.has(value)) continue;
			index$2.set(value, domain.push(value) - 1);
		}
		return scale$1;
	};
	scale$1.range = function(_) {
		return arguments.length ? (range$3 = Array.from(_), scale$1) : range$3.slice();
	};
	scale$1.unknown = function(_) {
		return arguments.length ? (unknown = _, scale$1) : unknown;
	};
	scale$1.copy = function() {
		return ordinal(domain, range$3).unknown(unknown);
	};
	initRange.apply(scale$1, arguments);
	return scale$1;
}

//#endregion
//#region node_modules/d3-scale/src/band.js
function band() {
	var scale$1 = ordinal().unknown(void 0), domain = scale$1.domain, ordinalRange = scale$1.range, r0 = 0, r1 = 1, step, bandwidth, round = false, paddingInner = 0, paddingOuter = 0, align = .5;
	delete scale$1.unknown;
	function rescale() {
		var n = domain().length, reverse$1 = r1 < r0, start$1 = reverse$1 ? r1 : r0, stop = reverse$1 ? r0 : r1;
		step = (stop - start$1) / Math.max(1, n - paddingInner + paddingOuter * 2);
		if (round) step = Math.floor(step);
		start$1 += (stop - start$1 - step * (n - paddingInner)) * align;
		bandwidth = step * (1 - paddingInner);
		if (round) start$1 = Math.round(start$1), bandwidth = Math.round(bandwidth);
		var values = range(n).map(function(i) {
			return start$1 + step * i;
		});
		return ordinalRange(reverse$1 ? values.reverse() : values);
	}
	scale$1.domain = function(_) {
		return arguments.length ? (domain(_), rescale()) : domain();
	};
	scale$1.range = function(_) {
		return arguments.length ? ([r0, r1] = _, r0 = +r0, r1 = +r1, rescale()) : [r0, r1];
	};
	scale$1.rangeRound = function(_) {
		return [r0, r1] = _, r0 = +r0, r1 = +r1, round = true, rescale();
	};
	scale$1.bandwidth = function() {
		return bandwidth;
	};
	scale$1.step = function() {
		return step;
	};
	scale$1.round = function(_) {
		return arguments.length ? (round = !!_, rescale()) : round;
	};
	scale$1.padding = function(_) {
		return arguments.length ? (paddingInner = Math.min(1, paddingOuter = +_), rescale()) : paddingInner;
	};
	scale$1.paddingInner = function(_) {
		return arguments.length ? (paddingInner = Math.min(1, _), rescale()) : paddingInner;
	};
	scale$1.paddingOuter = function(_) {
		return arguments.length ? (paddingOuter = +_, rescale()) : paddingOuter;
	};
	scale$1.align = function(_) {
		return arguments.length ? (align = Math.max(0, Math.min(1, _)), rescale()) : align;
	};
	scale$1.copy = function() {
		return band(domain(), [r0, r1]).round(round).paddingInner(paddingInner).paddingOuter(paddingOuter).align(align);
	};
	return initRange.apply(rescale(), arguments);
}
function pointish(scale$1) {
	var copy$2 = scale$1.copy;
	scale$1.padding = scale$1.paddingOuter;
	delete scale$1.paddingInner;
	delete scale$1.paddingOuter;
	scale$1.copy = function() {
		return pointish(copy$2());
	};
	return scale$1;
}
function point() {
	return pointish(band.apply(null, arguments).paddingInner(1));
}

//#endregion
//#region node_modules/d3-scale/src/constant.js
function constants(x$3) {
	return function() {
		return x$3;
	};
}

//#endregion
//#region node_modules/d3-scale/src/number.js
function number$1(x$3) {
	return +x$3;
}

//#endregion
//#region node_modules/d3-scale/src/continuous.js
var unit = [0, 1];
function identity$2(x$3) {
	return x$3;
}
function normalize(a$3, b) {
	return (b -= a$3 = +a$3) ? function(x$3) {
		return (x$3 - a$3) / b;
	} : constants(isNaN(b) ? NaN : .5);
}
function clamper(a$3, b) {
	var t;
	if (a$3 > b) t = a$3, a$3 = b, b = t;
	return function(x$3) {
		return Math.max(a$3, Math.min(b, x$3));
	};
}
function bimap(domain, range$3, interpolate) {
	var d0 = domain[0], d1 = domain[1], r0 = range$3[0], r1 = range$3[1];
	if (d1 < d0) d0 = normalize(d1, d0), r0 = interpolate(r1, r0);
	else d0 = normalize(d0, d1), r0 = interpolate(r0, r1);
	return function(x$3) {
		return r0(d0(x$3));
	};
}
function polymap(domain, range$3, interpolate) {
	var j = Math.min(domain.length, range$3.length) - 1, d = new Array(j), r = new Array(j), i = -1;
	if (domain[j] < domain[0]) {
		domain = domain.slice().reverse();
		range$3 = range$3.slice().reverse();
	}
	while (++i < j) {
		d[i] = normalize(domain[i], domain[i + 1]);
		r[i] = interpolate(range$3[i], range$3[i + 1]);
	}
	return function(x$3) {
		var i$1 = bisect_default(domain, x$3, 1, j) - 1;
		return r[i$1](d[i$1](x$3));
	};
}
function copy$1(source, target) {
	return target.domain(source.domain()).range(source.range()).interpolate(source.interpolate()).clamp(source.clamp()).unknown(source.unknown());
}
function transformer$2() {
	var domain = unit, range$3 = unit, interpolate = value_default, transform$1, untransform, unknown, clamp = identity$2, piecewise$1, output, input;
	function rescale() {
		var n = Math.min(domain.length, range$3.length);
		if (clamp !== identity$2) clamp = clamper(domain[0], domain[n - 1]);
		piecewise$1 = n > 2 ? polymap : bimap;
		output = input = null;
		return scale$1;
	}
	function scale$1(x$3) {
		return x$3 == null || isNaN(x$3 = +x$3) ? unknown : (output || (output = piecewise$1(domain.map(transform$1), range$3, interpolate)))(transform$1(clamp(x$3)));
	}
	scale$1.invert = function(y$3) {
		return clamp(untransform((input || (input = piecewise$1(range$3, domain.map(transform$1), number_default)))(y$3)));
	};
	scale$1.domain = function(_) {
		return arguments.length ? (domain = Array.from(_, number$1), rescale()) : domain.slice();
	};
	scale$1.range = function(_) {
		return arguments.length ? (range$3 = Array.from(_), rescale()) : range$3.slice();
	};
	scale$1.rangeRound = function(_) {
		return range$3 = Array.from(_), interpolate = round_default, rescale();
	};
	scale$1.clamp = function(_) {
		return arguments.length ? (clamp = _ ? true : identity$2, rescale()) : clamp !== identity$2;
	};
	scale$1.interpolate = function(_) {
		return arguments.length ? (interpolate = _, rescale()) : interpolate;
	};
	scale$1.unknown = function(_) {
		return arguments.length ? (unknown = _, scale$1) : unknown;
	};
	return function(t, u$3) {
		transform$1 = t, untransform = u$3;
		return rescale();
	};
}
function continuous() {
	return transformer$2()(identity$2, identity$2);
}

//#endregion
//#region node_modules/d3-scale/src/tickFormat.js
function tickFormat(start$1, stop, count$2, specifier) {
	var step = tickStep(start$1, stop, count$2), precision;
	specifier = formatSpecifier(specifier == null ? ",f" : specifier);
	switch (specifier.type) {
		case "s":
			var value = Math.max(Math.abs(start$1), Math.abs(stop));
			if (specifier.precision == null && !isNaN(precision = precisionPrefix_default(step, value))) specifier.precision = precision;
			return formatPrefix(specifier, value);
		case "":
		case "e":
		case "g":
		case "p":
		case "r":
			if (specifier.precision == null && !isNaN(precision = precisionRound_default(step, Math.max(Math.abs(start$1), Math.abs(stop))))) specifier.precision = precision - (specifier.type === "e");
			break;
		case "f":
		case "%":
			if (specifier.precision == null && !isNaN(precision = precisionFixed_default(step))) specifier.precision = precision - (specifier.type === "%") * 2;
			break;
	}
	return format(specifier);
}

//#endregion
//#region node_modules/d3-scale/src/linear.js
function linearish(scale$1) {
	var domain = scale$1.domain;
	scale$1.ticks = function(count$2) {
		var d = domain();
		return ticks(d[0], d[d.length - 1], count$2 == null ? 10 : count$2);
	};
	scale$1.tickFormat = function(count$2, specifier) {
		var d = domain();
		return tickFormat(d[0], d[d.length - 1], count$2 == null ? 10 : count$2, specifier);
	};
	scale$1.nice = function(count$2) {
		if (count$2 == null) count$2 = 10;
		var d = domain();
		var i0 = 0;
		var i1 = d.length - 1;
		var start$1 = d[i0];
		var stop = d[i1];
		var prestep;
		var step;
		var maxIter = 10;
		if (stop < start$1) {
			step = start$1, start$1 = stop, stop = step;
			step = i0, i0 = i1, i1 = step;
		}
		while (maxIter-- > 0) {
			step = tickIncrement(start$1, stop, count$2);
			if (step === prestep) {
				d[i0] = start$1;
				d[i1] = stop;
				return domain(d);
			} else if (step > 0) {
				start$1 = Math.floor(start$1 / step) * step;
				stop = Math.ceil(stop / step) * step;
			} else if (step < 0) {
				start$1 = Math.ceil(start$1 * step) / step;
				stop = Math.floor(stop * step) / step;
			} else break;
			prestep = step;
		}
		return scale$1;
	};
	return scale$1;
}
function linear$1() {
	var scale$1 = continuous();
	scale$1.copy = function() {
		return copy$1(scale$1, linear$1());
	};
	initRange.apply(scale$1, arguments);
	return linearish(scale$1);
}

//#endregion
//#region node_modules/d3-scale/src/identity.js
function identity(domain) {
	var unknown;
	function scale$1(x$3) {
		return x$3 == null || isNaN(x$3 = +x$3) ? unknown : x$3;
	}
	scale$1.invert = scale$1;
	scale$1.domain = scale$1.range = function(_) {
		return arguments.length ? (domain = Array.from(_, number$1), scale$1) : domain.slice();
	};
	scale$1.unknown = function(_) {
		return arguments.length ? (unknown = _, scale$1) : unknown;
	};
	scale$1.copy = function() {
		return identity(domain).unknown(unknown);
	};
	domain = arguments.length ? Array.from(domain, number$1) : [0, 1];
	return linearish(scale$1);
}

//#endregion
//#region node_modules/d3-scale/src/nice.js
function nice$1(domain, interval$1) {
	domain = domain.slice();
	var i0 = 0, i1 = domain.length - 1, x0$5 = domain[i0], x1$1 = domain[i1], t;
	if (x1$1 < x0$5) {
		t = i0, i0 = i1, i1 = t;
		t = x0$5, x0$5 = x1$1, x1$1 = t;
	}
	domain[i0] = interval$1.floor(x0$5);
	domain[i1] = interval$1.ceil(x1$1);
	return domain;
}

//#endregion
//#region node_modules/d3-scale/src/log.js
function transformLog(x$3) {
	return Math.log(x$3);
}
function transformExp(x$3) {
	return Math.exp(x$3);
}
function transformLogn(x$3) {
	return -Math.log(-x$3);
}
function transformExpn(x$3) {
	return -Math.exp(-x$3);
}
function pow10(x$3) {
	return isFinite(x$3) ? +("1e" + x$3) : x$3 < 0 ? 0 : x$3;
}
function powp(base) {
	return base === 10 ? pow10 : base === Math.E ? Math.exp : (x$3) => Math.pow(base, x$3);
}
function logp(base) {
	return base === Math.E ? Math.log : base === 10 && Math.log10 || base === 2 && Math.log2 || (base = Math.log(base), (x$3) => Math.log(x$3) / base);
}
function reflect(f) {
	return (x$3, k$1) => -f(-x$3, k$1);
}
function loggish(transform$1) {
	const scale$1 = transform$1(transformLog, transformExp);
	const domain = scale$1.domain;
	let base = 10;
	let logs;
	let pows;
	function rescale() {
		logs = logp(base), pows = powp(base);
		if (domain()[0] < 0) {
			logs = reflect(logs), pows = reflect(pows);
			transform$1(transformLogn, transformExpn);
		} else transform$1(transformLog, transformExp);
		return scale$1;
	}
	scale$1.base = function(_) {
		return arguments.length ? (base = +_, rescale()) : base;
	};
	scale$1.domain = function(_) {
		return arguments.length ? (domain(_), rescale()) : domain();
	};
	scale$1.ticks = (count$2) => {
		const d = domain();
		let u$3 = d[0];
		let v$1 = d[d.length - 1];
		const r = v$1 < u$3;
		if (r) [u$3, v$1] = [v$1, u$3];
		let i = logs(u$3);
		let j = logs(v$1);
		let k$1;
		let t;
		const n = count$2 == null ? 10 : +count$2;
		let z = [];
		if (!(base % 1) && j - i < n) {
			i = Math.floor(i), j = Math.ceil(j);
			if (u$3 > 0) for (; i <= j; ++i) for (k$1 = 1; k$1 < base; ++k$1) {
				t = i < 0 ? k$1 / pows(-i) : k$1 * pows(i);
				if (t < u$3) continue;
				if (t > v$1) break;
				z.push(t);
			}
			else for (; i <= j; ++i) for (k$1 = base - 1; k$1 >= 1; --k$1) {
				t = i > 0 ? k$1 / pows(-i) : k$1 * pows(i);
				if (t < u$3) continue;
				if (t > v$1) break;
				z.push(t);
			}
			if (z.length * 2 < n) z = ticks(u$3, v$1, n);
		} else z = ticks(i, j, Math.min(j - i, n)).map(pows);
		return r ? z.reverse() : z;
	};
	scale$1.tickFormat = (count$2, specifier) => {
		if (count$2 == null) count$2 = 10;
		if (specifier == null) specifier = base === 10 ? "s" : ",";
		if (typeof specifier !== "function") {
			if (!(base % 1) && (specifier = formatSpecifier(specifier)).precision == null) specifier.trim = true;
			specifier = format(specifier);
		}
		if (count$2 === Infinity) return specifier;
		const k$1 = Math.max(1, base * count$2 / scale$1.ticks().length);
		return (d) => {
			let i = d / pows(Math.round(logs(d)));
			if (i * base < base - .5) i *= base;
			return i <= k$1 ? specifier(d) : "";
		};
	};
	scale$1.nice = () => {
		return domain(nice$1(domain(), {
			floor: (x$3) => pows(Math.floor(logs(x$3))),
			ceil: (x$3) => pows(Math.ceil(logs(x$3)))
		}));
	};
	return scale$1;
}
function log() {
	const scale$1 = loggish(transformer$2()).domain([1, 10]);
	scale$1.copy = () => copy$1(scale$1, log()).base(scale$1.base());
	initRange.apply(scale$1, arguments);
	return scale$1;
}

//#endregion
//#region node_modules/d3-scale/src/symlog.js
function transformSymlog(c$5) {
	return function(x$3) {
		return Math.sign(x$3) * Math.log1p(Math.abs(x$3 / c$5));
	};
}
function transformSymexp(c$5) {
	return function(x$3) {
		return Math.sign(x$3) * Math.expm1(Math.abs(x$3)) * c$5;
	};
}
function symlogish(transform$1) {
	var c$5 = 1, scale$1 = transform$1(transformSymlog(c$5), transformSymexp(c$5));
	scale$1.constant = function(_) {
		return arguments.length ? transform$1(transformSymlog(c$5 = +_), transformSymexp(c$5)) : c$5;
	};
	return linearish(scale$1);
}
function symlog() {
	var scale$1 = symlogish(transformer$2());
	scale$1.copy = function() {
		return copy$1(scale$1, symlog()).constant(scale$1.constant());
	};
	return initRange.apply(scale$1, arguments);
}

//#endregion
//#region node_modules/d3-scale/src/pow.js
function transformPow(exponent$1) {
	return function(x$3) {
		return x$3 < 0 ? -Math.pow(-x$3, exponent$1) : Math.pow(x$3, exponent$1);
	};
}
function transformSqrt(x$3) {
	return x$3 < 0 ? -Math.sqrt(-x$3) : Math.sqrt(x$3);
}
function transformSquare(x$3) {
	return x$3 < 0 ? -x$3 * x$3 : x$3 * x$3;
}
function powish(transform$1) {
	var scale$1 = transform$1(identity$2, identity$2), exponent$1 = 1;
	function rescale() {
		return exponent$1 === 1 ? transform$1(identity$2, identity$2) : exponent$1 === .5 ? transform$1(transformSqrt, transformSquare) : transform$1(transformPow(exponent$1), transformPow(1 / exponent$1));
	}
	scale$1.exponent = function(_) {
		return arguments.length ? (exponent$1 = +_, rescale()) : exponent$1;
	};
	return linearish(scale$1);
}
function pow() {
	var scale$1 = powish(transformer$2());
	scale$1.copy = function() {
		return copy$1(scale$1, pow()).exponent(scale$1.exponent());
	};
	initRange.apply(scale$1, arguments);
	return scale$1;
}
function sqrt() {
	return pow.apply(null, arguments).exponent(.5);
}

//#endregion
//#region node_modules/d3-scale/src/radial.js
function square(x$3) {
	return Math.sign(x$3) * x$3 * x$3;
}
function unsquare(x$3) {
	return Math.sign(x$3) * Math.sqrt(Math.abs(x$3));
}
function radial() {
	var squared = continuous(), range$3 = [0, 1], round = false, unknown;
	function scale$1(x$3) {
		var y$3 = unsquare(squared(x$3));
		return isNaN(y$3) ? unknown : round ? Math.round(y$3) : y$3;
	}
	scale$1.invert = function(y$3) {
		return squared.invert(square(y$3));
	};
	scale$1.domain = function(_) {
		return arguments.length ? (squared.domain(_), scale$1) : squared.domain();
	};
	scale$1.range = function(_) {
		return arguments.length ? (squared.range((range$3 = Array.from(_, number$1)).map(square)), scale$1) : range$3.slice();
	};
	scale$1.rangeRound = function(_) {
		return scale$1.range(_).round(true);
	};
	scale$1.round = function(_) {
		return arguments.length ? (round = !!_, scale$1) : round;
	};
	scale$1.clamp = function(_) {
		return arguments.length ? (squared.clamp(_), scale$1) : squared.clamp();
	};
	scale$1.unknown = function(_) {
		return arguments.length ? (unknown = _, scale$1) : unknown;
	};
	scale$1.copy = function() {
		return radial(squared.domain(), range$3).round(round).clamp(squared.clamp()).unknown(unknown);
	};
	initRange.apply(scale$1, arguments);
	return linearish(scale$1);
}

//#endregion
//#region node_modules/d3-scale/src/quantile.js
function quantile$1() {
	var domain = [], range$3 = [], thresholds = [], unknown;
	function rescale() {
		var i = 0, n = Math.max(1, range$3.length);
		thresholds = new Array(n - 1);
		while (++i < n) thresholds[i - 1] = quantileSorted(domain, i / n);
		return scale$1;
	}
	function scale$1(x$3) {
		return x$3 == null || isNaN(x$3 = +x$3) ? unknown : range$3[bisect_default(thresholds, x$3)];
	}
	scale$1.invertExtent = function(y$3) {
		var i = range$3.indexOf(y$3);
		return i < 0 ? [NaN, NaN] : [i > 0 ? thresholds[i - 1] : domain[0], i < thresholds.length ? thresholds[i] : domain[domain.length - 1]];
	};
	scale$1.domain = function(_) {
		if (!arguments.length) return domain.slice();
		domain = [];
		for (let d of _) if (d != null && !isNaN(d = +d)) domain.push(d);
		domain.sort(ascending);
		return rescale();
	};
	scale$1.range = function(_) {
		return arguments.length ? (range$3 = Array.from(_), rescale()) : range$3.slice();
	};
	scale$1.unknown = function(_) {
		return arguments.length ? (unknown = _, scale$1) : unknown;
	};
	scale$1.quantiles = function() {
		return thresholds.slice();
	};
	scale$1.copy = function() {
		return quantile$1().domain(domain).range(range$3).unknown(unknown);
	};
	return initRange.apply(scale$1, arguments);
}

//#endregion
//#region node_modules/d3-scale/src/quantize.js
function quantize() {
	var x0$5 = 0, x1$1 = 1, n = 1, domain = [.5], range$3 = [0, 1], unknown;
	function scale$1(x$3) {
		return x$3 != null && x$3 <= x$3 ? range$3[bisect_default(domain, x$3, 0, n)] : unknown;
	}
	function rescale() {
		var i = -1;
		domain = new Array(n);
		while (++i < n) domain[i] = ((i + 1) * x1$1 - (i - n) * x0$5) / (n + 1);
		return scale$1;
	}
	scale$1.domain = function(_) {
		return arguments.length ? ([x0$5, x1$1] = _, x0$5 = +x0$5, x1$1 = +x1$1, rescale()) : [x0$5, x1$1];
	};
	scale$1.range = function(_) {
		return arguments.length ? (n = (range$3 = Array.from(_)).length - 1, rescale()) : range$3.slice();
	};
	scale$1.invertExtent = function(y$3) {
		var i = range$3.indexOf(y$3);
		return i < 0 ? [NaN, NaN] : i < 1 ? [x0$5, domain[0]] : i >= n ? [domain[n - 1], x1$1] : [domain[i - 1], domain[i]];
	};
	scale$1.unknown = function(_) {
		return arguments.length ? (unknown = _, scale$1) : scale$1;
	};
	scale$1.thresholds = function() {
		return domain.slice();
	};
	scale$1.copy = function() {
		return quantize().domain([x0$5, x1$1]).range(range$3).unknown(unknown);
	};
	return initRange.apply(linearish(scale$1), arguments);
}

//#endregion
//#region node_modules/d3-scale/src/threshold.js
function threshold() {
	var domain = [.5], range$3 = [0, 1], unknown, n = 1;
	function scale$1(x$3) {
		return x$3 != null && x$3 <= x$3 ? range$3[bisect_default(domain, x$3, 0, n)] : unknown;
	}
	scale$1.domain = function(_) {
		return arguments.length ? (domain = Array.from(_), n = Math.min(domain.length, range$3.length - 1), scale$1) : domain.slice();
	};
	scale$1.range = function(_) {
		return arguments.length ? (range$3 = Array.from(_), n = Math.min(domain.length, range$3.length - 1), scale$1) : range$3.slice();
	};
	scale$1.invertExtent = function(y$3) {
		var i = range$3.indexOf(y$3);
		return [domain[i - 1], domain[i]];
	};
	scale$1.unknown = function(_) {
		return arguments.length ? (unknown = _, scale$1) : unknown;
	};
	scale$1.copy = function() {
		return threshold().domain(domain).range(range$3).unknown(unknown);
	};
	return initRange.apply(scale$1, arguments);
}

//#endregion
//#region node_modules/d3-time/src/interval.js
var t0 = /* @__PURE__ */ new Date(), t1 = /* @__PURE__ */ new Date();
function timeInterval(floori, offseti, count$2, field) {
	function interval$1(date$1) {
		return floori(date$1 = arguments.length === 0 ? /* @__PURE__ */ new Date() : /* @__PURE__ */ new Date(+date$1)), date$1;
	}
	interval$1.floor = (date$1) => {
		return floori(date$1 = /* @__PURE__ */ new Date(+date$1)), date$1;
	};
	interval$1.ceil = (date$1) => {
		return floori(date$1 = /* @__PURE__ */ new Date(date$1 - 1)), offseti(date$1, 1), floori(date$1), date$1;
	};
	interval$1.round = (date$1) => {
		const d0 = interval$1(date$1), d1 = interval$1.ceil(date$1);
		return date$1 - d0 < d1 - date$1 ? d0 : d1;
	};
	interval$1.offset = (date$1, step) => {
		return offseti(date$1 = /* @__PURE__ */ new Date(+date$1), step == null ? 1 : Math.floor(step)), date$1;
	};
	interval$1.range = (start$1, stop, step) => {
		const range$3 = [];
		start$1 = interval$1.ceil(start$1);
		step = step == null ? 1 : Math.floor(step);
		if (!(start$1 < stop) || !(step > 0)) return range$3;
		let previous;
		do
			range$3.push(previous = /* @__PURE__ */ new Date(+start$1)), offseti(start$1, step), floori(start$1);
		while (previous < start$1 && start$1 < stop);
		return range$3;
	};
	interval$1.filter = (test) => {
		return timeInterval((date$1) => {
			if (date$1 >= date$1) while (floori(date$1), !test(date$1)) date$1.setTime(date$1 - 1);
		}, (date$1, step) => {
			if (date$1 >= date$1) if (step < 0) while (++step <= 0) while (offseti(date$1, -1), !test(date$1));
			else while (--step >= 0) while (offseti(date$1, 1), !test(date$1));
		});
	};
	if (count$2) {
		interval$1.count = (start$1, end) => {
			t0.setTime(+start$1), t1.setTime(+end);
			floori(t0), floori(t1);
			return Math.floor(count$2(t0, t1));
		};
		interval$1.every = (step) => {
			step = Math.floor(step);
			return !isFinite(step) || !(step > 0) ? null : !(step > 1) ? interval$1 : interval$1.filter(field ? (d) => field(d) % step === 0 : (d) => interval$1.count(0, d) % step === 0);
		};
	}
	return interval$1;
}

//#endregion
//#region node_modules/d3-time/src/millisecond.js
const millisecond = timeInterval(() => {}, (date$1, step) => {
	date$1.setTime(+date$1 + step);
}, (start$1, end) => {
	return end - start$1;
});
millisecond.every = (k$1) => {
	k$1 = Math.floor(k$1);
	if (!isFinite(k$1) || !(k$1 > 0)) return null;
	if (!(k$1 > 1)) return millisecond;
	return timeInterval((date$1) => {
		date$1.setTime(Math.floor(date$1 / k$1) * k$1);
	}, (date$1, step) => {
		date$1.setTime(+date$1 + step * k$1);
	}, (start$1, end) => {
		return (end - start$1) / k$1;
	});
};
const milliseconds = millisecond.range;

//#endregion
//#region node_modules/d3-time/src/duration.js
const durationSecond = 1e3;
const durationMinute = durationSecond * 60;
const durationHour = durationMinute * 60;
const durationDay = durationHour * 24;
const durationWeek = durationDay * 7;
const durationMonth = durationDay * 30;
const durationYear = durationDay * 365;

//#endregion
//#region node_modules/d3-time/src/second.js
const second = timeInterval((date$1) => {
	date$1.setTime(date$1 - date$1.getMilliseconds());
}, (date$1, step) => {
	date$1.setTime(+date$1 + step * durationSecond);
}, (start$1, end) => {
	return (end - start$1) / durationSecond;
}, (date$1) => {
	return date$1.getUTCSeconds();
});
const seconds = second.range;

//#endregion
//#region node_modules/d3-time/src/minute.js
const timeMinute = timeInterval((date$1) => {
	date$1.setTime(date$1 - date$1.getMilliseconds() - date$1.getSeconds() * durationSecond);
}, (date$1, step) => {
	date$1.setTime(+date$1 + step * durationMinute);
}, (start$1, end) => {
	return (end - start$1) / durationMinute;
}, (date$1) => {
	return date$1.getMinutes();
});
const timeMinutes = timeMinute.range;
const utcMinute = timeInterval((date$1) => {
	date$1.setUTCSeconds(0, 0);
}, (date$1, step) => {
	date$1.setTime(+date$1 + step * durationMinute);
}, (start$1, end) => {
	return (end - start$1) / durationMinute;
}, (date$1) => {
	return date$1.getUTCMinutes();
});
const utcMinutes = utcMinute.range;

//#endregion
//#region node_modules/d3-time/src/hour.js
const timeHour = timeInterval((date$1) => {
	date$1.setTime(date$1 - date$1.getMilliseconds() - date$1.getSeconds() * durationSecond - date$1.getMinutes() * durationMinute);
}, (date$1, step) => {
	date$1.setTime(+date$1 + step * durationHour);
}, (start$1, end) => {
	return (end - start$1) / durationHour;
}, (date$1) => {
	return date$1.getHours();
});
const timeHours = timeHour.range;
const utcHour = timeInterval((date$1) => {
	date$1.setUTCMinutes(0, 0, 0);
}, (date$1, step) => {
	date$1.setTime(+date$1 + step * durationHour);
}, (start$1, end) => {
	return (end - start$1) / durationHour;
}, (date$1) => {
	return date$1.getUTCHours();
});
const utcHours = utcHour.range;

//#endregion
//#region node_modules/d3-time/src/day.js
const timeDay = timeInterval((date$1) => date$1.setHours(0, 0, 0, 0), (date$1, step) => date$1.setDate(date$1.getDate() + step), (start$1, end) => (end - start$1 - (end.getTimezoneOffset() - start$1.getTimezoneOffset()) * durationMinute) / durationDay, (date$1) => date$1.getDate() - 1);
const timeDays = timeDay.range;
const utcDay = timeInterval((date$1) => {
	date$1.setUTCHours(0, 0, 0, 0);
}, (date$1, step) => {
	date$1.setUTCDate(date$1.getUTCDate() + step);
}, (start$1, end) => {
	return (end - start$1) / durationDay;
}, (date$1) => {
	return date$1.getUTCDate() - 1;
});
const utcDays = utcDay.range;
const unixDay = timeInterval((date$1) => {
	date$1.setUTCHours(0, 0, 0, 0);
}, (date$1, step) => {
	date$1.setUTCDate(date$1.getUTCDate() + step);
}, (start$1, end) => {
	return (end - start$1) / durationDay;
}, (date$1) => {
	return Math.floor(date$1 / durationDay);
});
const unixDays = unixDay.range;

//#endregion
//#region node_modules/d3-time/src/week.js
function timeWeekday(i) {
	return timeInterval((date$1) => {
		date$1.setDate(date$1.getDate() - (date$1.getDay() + 7 - i) % 7);
		date$1.setHours(0, 0, 0, 0);
	}, (date$1, step) => {
		date$1.setDate(date$1.getDate() + step * 7);
	}, (start$1, end) => {
		return (end - start$1 - (end.getTimezoneOffset() - start$1.getTimezoneOffset()) * durationMinute) / durationWeek;
	});
}
const timeSunday = timeWeekday(0);
const timeMonday = timeWeekday(1);
const timeTuesday = timeWeekday(2);
const timeWednesday = timeWeekday(3);
const timeThursday = timeWeekday(4);
const timeFriday = timeWeekday(5);
const timeSaturday = timeWeekday(6);
const timeSundays = timeSunday.range;
const timeMondays = timeMonday.range;
const timeTuesdays = timeTuesday.range;
const timeWednesdays = timeWednesday.range;
const timeThursdays = timeThursday.range;
const timeFridays = timeFriday.range;
const timeSaturdays = timeSaturday.range;
function utcWeekday(i) {
	return timeInterval((date$1) => {
		date$1.setUTCDate(date$1.getUTCDate() - (date$1.getUTCDay() + 7 - i) % 7);
		date$1.setUTCHours(0, 0, 0, 0);
	}, (date$1, step) => {
		date$1.setUTCDate(date$1.getUTCDate() + step * 7);
	}, (start$1, end) => {
		return (end - start$1) / durationWeek;
	});
}
const utcSunday = utcWeekday(0);
const utcMonday = utcWeekday(1);
const utcTuesday = utcWeekday(2);
const utcWednesday = utcWeekday(3);
const utcThursday = utcWeekday(4);
const utcFriday = utcWeekday(5);
const utcSaturday = utcWeekday(6);
const utcSundays = utcSunday.range;
const utcMondays = utcMonday.range;
const utcTuesdays = utcTuesday.range;
const utcWednesdays = utcWednesday.range;
const utcThursdays = utcThursday.range;
const utcFridays = utcFriday.range;
const utcSaturdays = utcSaturday.range;

//#endregion
//#region node_modules/d3-time/src/month.js
const timeMonth = timeInterval((date$1) => {
	date$1.setDate(1);
	date$1.setHours(0, 0, 0, 0);
}, (date$1, step) => {
	date$1.setMonth(date$1.getMonth() + step);
}, (start$1, end) => {
	return end.getMonth() - start$1.getMonth() + (end.getFullYear() - start$1.getFullYear()) * 12;
}, (date$1) => {
	return date$1.getMonth();
});
const timeMonths = timeMonth.range;
const utcMonth = timeInterval((date$1) => {
	date$1.setUTCDate(1);
	date$1.setUTCHours(0, 0, 0, 0);
}, (date$1, step) => {
	date$1.setUTCMonth(date$1.getUTCMonth() + step);
}, (start$1, end) => {
	return end.getUTCMonth() - start$1.getUTCMonth() + (end.getUTCFullYear() - start$1.getUTCFullYear()) * 12;
}, (date$1) => {
	return date$1.getUTCMonth();
});
const utcMonths = utcMonth.range;

//#endregion
//#region node_modules/d3-time/src/year.js
const timeYear = timeInterval((date$1) => {
	date$1.setMonth(0, 1);
	date$1.setHours(0, 0, 0, 0);
}, (date$1, step) => {
	date$1.setFullYear(date$1.getFullYear() + step);
}, (start$1, end) => {
	return end.getFullYear() - start$1.getFullYear();
}, (date$1) => {
	return date$1.getFullYear();
});
timeYear.every = (k$1) => {
	return !isFinite(k$1 = Math.floor(k$1)) || !(k$1 > 0) ? null : timeInterval((date$1) => {
		date$1.setFullYear(Math.floor(date$1.getFullYear() / k$1) * k$1);
		date$1.setMonth(0, 1);
		date$1.setHours(0, 0, 0, 0);
	}, (date$1, step) => {
		date$1.setFullYear(date$1.getFullYear() + step * k$1);
	});
};
const timeYears = timeYear.range;
const utcYear = timeInterval((date$1) => {
	date$1.setUTCMonth(0, 1);
	date$1.setUTCHours(0, 0, 0, 0);
}, (date$1, step) => {
	date$1.setUTCFullYear(date$1.getUTCFullYear() + step);
}, (start$1, end) => {
	return end.getUTCFullYear() - start$1.getUTCFullYear();
}, (date$1) => {
	return date$1.getUTCFullYear();
});
utcYear.every = (k$1) => {
	return !isFinite(k$1 = Math.floor(k$1)) || !(k$1 > 0) ? null : timeInterval((date$1) => {
		date$1.setUTCFullYear(Math.floor(date$1.getUTCFullYear() / k$1) * k$1);
		date$1.setUTCMonth(0, 1);
		date$1.setUTCHours(0, 0, 0, 0);
	}, (date$1, step) => {
		date$1.setUTCFullYear(date$1.getUTCFullYear() + step * k$1);
	});
};
const utcYears = utcYear.range;

//#endregion
//#region node_modules/d3-time/src/ticks.js
function ticker(year, month, week, day, hour, minute) {
	const tickIntervals = [
		[
			second,
			1,
			durationSecond
		],
		[
			second,
			5,
			5 * durationSecond
		],
		[
			second,
			15,
			15 * durationSecond
		],
		[
			second,
			30,
			30 * durationSecond
		],
		[
			minute,
			1,
			durationMinute
		],
		[
			minute,
			5,
			5 * durationMinute
		],
		[
			minute,
			15,
			15 * durationMinute
		],
		[
			minute,
			30,
			30 * durationMinute
		],
		[
			hour,
			1,
			durationHour
		],
		[
			hour,
			3,
			3 * durationHour
		],
		[
			hour,
			6,
			6 * durationHour
		],
		[
			hour,
			12,
			12 * durationHour
		],
		[
			day,
			1,
			durationDay
		],
		[
			day,
			2,
			2 * durationDay
		],
		[
			week,
			1,
			durationWeek
		],
		[
			month,
			1,
			durationMonth
		],
		[
			month,
			3,
			3 * durationMonth
		],
		[
			year,
			1,
			durationYear
		]
	];
	function ticks$1(start$1, stop, count$2) {
		const reverse$1 = stop < start$1;
		if (reverse$1) [start$1, stop] = [stop, start$1];
		const interval$1 = count$2 && typeof count$2.range === "function" ? count$2 : tickInterval(start$1, stop, count$2);
		const ticks$2 = interval$1 ? interval$1.range(start$1, +stop + 1) : [];
		return reverse$1 ? ticks$2.reverse() : ticks$2;
	}
	function tickInterval(start$1, stop, count$2) {
		const target = Math.abs(stop - start$1) / count$2;
		const i = bisector(([, , step$1]) => step$1).right(tickIntervals, target);
		if (i === tickIntervals.length) return year.every(tickStep(start$1 / durationYear, stop / durationYear, count$2));
		if (i === 0) return millisecond.every(Math.max(tickStep(start$1, stop, count$2), 1));
		const [t, step] = tickIntervals[target / tickIntervals[i - 1][2] < tickIntervals[i][2] / target ? i - 1 : i];
		return t.every(step);
	}
	return [ticks$1, tickInterval];
}
var [utcTicks, utcTickInterval] = ticker(utcYear, utcMonth, utcSunday, unixDay, utcHour, utcMinute);
var [timeTicks, timeTickInterval] = ticker(timeYear, timeMonth, timeSunday, timeDay, timeHour, timeMinute);

//#endregion
//#region node_modules/d3-time-format/src/locale.js
function localDate(d) {
	if (0 <= d.y && d.y < 100) {
		var date$1 = new Date(-1, d.m, d.d, d.H, d.M, d.S, d.L);
		date$1.setFullYear(d.y);
		return date$1;
	}
	return new Date(d.y, d.m, d.d, d.H, d.M, d.S, d.L);
}
function utcDate(d) {
	if (0 <= d.y && d.y < 100) {
		var date$1 = new Date(Date.UTC(-1, d.m, d.d, d.H, d.M, d.S, d.L));
		date$1.setUTCFullYear(d.y);
		return date$1;
	}
	return new Date(Date.UTC(d.y, d.m, d.d, d.H, d.M, d.S, d.L));
}
function newDate(y$3, m$2, d) {
	return {
		y: y$3,
		m: m$2,
		d,
		H: 0,
		M: 0,
		S: 0,
		L: 0
	};
}
function formatLocale(locale$2) {
	var locale_dateTime = locale$2.dateTime, locale_date = locale$2.date, locale_time = locale$2.time, locale_periods = locale$2.periods, locale_weekdays = locale$2.days, locale_shortWeekdays = locale$2.shortDays, locale_months = locale$2.months, locale_shortMonths = locale$2.shortMonths;
	var periodRe = formatRe(locale_periods), periodLookup = formatLookup(locale_periods), weekdayRe = formatRe(locale_weekdays), weekdayLookup = formatLookup(locale_weekdays), shortWeekdayRe = formatRe(locale_shortWeekdays), shortWeekdayLookup = formatLookup(locale_shortWeekdays), monthRe = formatRe(locale_months), monthLookup = formatLookup(locale_months), shortMonthRe = formatRe(locale_shortMonths), shortMonthLookup = formatLookup(locale_shortMonths);
	var formats = {
		"a": formatShortWeekday,
		"A": formatWeekday,
		"b": formatShortMonth,
		"B": formatMonth,
		"c": null,
		"d": formatDayOfMonth,
		"e": formatDayOfMonth,
		"f": formatMicroseconds,
		"g": formatYearISO,
		"G": formatFullYearISO,
		"H": formatHour24,
		"I": formatHour12,
		"j": formatDayOfYear,
		"L": formatMilliseconds,
		"m": formatMonthNumber,
		"M": formatMinutes,
		"p": formatPeriod,
		"q": formatQuarter,
		"Q": formatUnixTimestamp,
		"s": formatUnixTimestampSeconds,
		"S": formatSeconds,
		"u": formatWeekdayNumberMonday,
		"U": formatWeekNumberSunday,
		"V": formatWeekNumberISO,
		"w": formatWeekdayNumberSunday,
		"W": formatWeekNumberMonday,
		"x": null,
		"X": null,
		"y": formatYear,
		"Y": formatFullYear,
		"Z": formatZone,
		"%": formatLiteralPercent
	};
	var utcFormats = {
		"a": formatUTCShortWeekday,
		"A": formatUTCWeekday,
		"b": formatUTCShortMonth,
		"B": formatUTCMonth,
		"c": null,
		"d": formatUTCDayOfMonth,
		"e": formatUTCDayOfMonth,
		"f": formatUTCMicroseconds,
		"g": formatUTCYearISO,
		"G": formatUTCFullYearISO,
		"H": formatUTCHour24,
		"I": formatUTCHour12,
		"j": formatUTCDayOfYear,
		"L": formatUTCMilliseconds,
		"m": formatUTCMonthNumber,
		"M": formatUTCMinutes,
		"p": formatUTCPeriod,
		"q": formatUTCQuarter,
		"Q": formatUnixTimestamp,
		"s": formatUnixTimestampSeconds,
		"S": formatUTCSeconds,
		"u": formatUTCWeekdayNumberMonday,
		"U": formatUTCWeekNumberSunday,
		"V": formatUTCWeekNumberISO,
		"w": formatUTCWeekdayNumberSunday,
		"W": formatUTCWeekNumberMonday,
		"x": null,
		"X": null,
		"y": formatUTCYear,
		"Y": formatUTCFullYear,
		"Z": formatUTCZone,
		"%": formatLiteralPercent
	};
	var parses = {
		"a": parseShortWeekday,
		"A": parseWeekday,
		"b": parseShortMonth,
		"B": parseMonth,
		"c": parseLocaleDateTime,
		"d": parseDayOfMonth,
		"e": parseDayOfMonth,
		"f": parseMicroseconds,
		"g": parseYear,
		"G": parseFullYear,
		"H": parseHour24,
		"I": parseHour24,
		"j": parseDayOfYear,
		"L": parseMilliseconds,
		"m": parseMonthNumber,
		"M": parseMinutes,
		"p": parsePeriod,
		"q": parseQuarter,
		"Q": parseUnixTimestamp,
		"s": parseUnixTimestampSeconds,
		"S": parseSeconds,
		"u": parseWeekdayNumberMonday,
		"U": parseWeekNumberSunday,
		"V": parseWeekNumberISO,
		"w": parseWeekdayNumberSunday,
		"W": parseWeekNumberMonday,
		"x": parseLocaleDate,
		"X": parseLocaleTime,
		"y": parseYear,
		"Y": parseFullYear,
		"Z": parseZone,
		"%": parseLiteralPercent
	};
	formats.x = newFormat(locale_date, formats);
	formats.X = newFormat(locale_time, formats);
	formats.c = newFormat(locale_dateTime, formats);
	utcFormats.x = newFormat(locale_date, utcFormats);
	utcFormats.X = newFormat(locale_time, utcFormats);
	utcFormats.c = newFormat(locale_dateTime, utcFormats);
	function newFormat(specifier, formats$1) {
		return function(date$1) {
			var string = [], i = -1, j = 0, n = specifier.length, c$5, pad$2, format$1;
			if (!(date$1 instanceof Date)) date$1 = /* @__PURE__ */ new Date(+date$1);
			while (++i < n) if (specifier.charCodeAt(i) === 37) {
				string.push(specifier.slice(j, i));
				if ((pad$2 = pads[c$5 = specifier.charAt(++i)]) != null) c$5 = specifier.charAt(++i);
				else pad$2 = c$5 === "e" ? " " : "0";
				if (format$1 = formats$1[c$5]) c$5 = format$1(date$1, pad$2);
				string.push(c$5);
				j = i + 1;
			}
			string.push(specifier.slice(j, i));
			return string.join("");
		};
	}
	function newParse(specifier, Z) {
		return function(string) {
			var d = newDate(1900, void 0, 1), i = parseSpecifier(d, specifier, string += "", 0), week, day;
			if (i != string.length) return null;
			if ("Q" in d) return new Date(d.Q);
			if ("s" in d) return new Date(d.s * 1e3 + ("L" in d ? d.L : 0));
			if (Z && !("Z" in d)) d.Z = 0;
			if ("p" in d) d.H = d.H % 12 + d.p * 12;
			if (d.m === void 0) d.m = "q" in d ? d.q : 0;
			if ("V" in d) {
				if (d.V < 1 || d.V > 53) return null;
				if (!("w" in d)) d.w = 1;
				if ("Z" in d) {
					week = utcDate(newDate(d.y, 0, 1)), day = week.getUTCDay();
					week = day > 4 || day === 0 ? utcMonday.ceil(week) : utcMonday(week);
					week = utcDay.offset(week, (d.V - 1) * 7);
					d.y = week.getUTCFullYear();
					d.m = week.getUTCMonth();
					d.d = week.getUTCDate() + (d.w + 6) % 7;
				} else {
					week = localDate(newDate(d.y, 0, 1)), day = week.getDay();
					week = day > 4 || day === 0 ? timeMonday.ceil(week) : timeMonday(week);
					week = timeDay.offset(week, (d.V - 1) * 7);
					d.y = week.getFullYear();
					d.m = week.getMonth();
					d.d = week.getDate() + (d.w + 6) % 7;
				}
			} else if ("W" in d || "U" in d) {
				if (!("w" in d)) d.w = "u" in d ? d.u % 7 : "W" in d ? 1 : 0;
				day = "Z" in d ? utcDate(newDate(d.y, 0, 1)).getUTCDay() : localDate(newDate(d.y, 0, 1)).getDay();
				d.m = 0;
				d.d = "W" in d ? (d.w + 6) % 7 + d.W * 7 - (day + 5) % 7 : d.w + d.U * 7 - (day + 6) % 7;
			}
			if ("Z" in d) {
				d.H += d.Z / 100 | 0;
				d.M += d.Z % 100;
				return utcDate(d);
			}
			return localDate(d);
		};
	}
	function parseSpecifier(d, specifier, string, j) {
		var i = 0, n = specifier.length, m$2 = string.length, c$5, parse;
		while (i < n) {
			if (j >= m$2) return -1;
			c$5 = specifier.charCodeAt(i++);
			if (c$5 === 37) {
				c$5 = specifier.charAt(i++);
				parse = parses[c$5 in pads ? specifier.charAt(i++) : c$5];
				if (!parse || (j = parse(d, string, j)) < 0) return -1;
			} else if (c$5 != string.charCodeAt(j++)) return -1;
		}
		return j;
	}
	function parsePeriod(d, string, i) {
		var n = periodRe.exec(string.slice(i));
		return n ? (d.p = periodLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
	}
	function parseShortWeekday(d, string, i) {
		var n = shortWeekdayRe.exec(string.slice(i));
		return n ? (d.w = shortWeekdayLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
	}
	function parseWeekday(d, string, i) {
		var n = weekdayRe.exec(string.slice(i));
		return n ? (d.w = weekdayLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
	}
	function parseShortMonth(d, string, i) {
		var n = shortMonthRe.exec(string.slice(i));
		return n ? (d.m = shortMonthLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
	}
	function parseMonth(d, string, i) {
		var n = monthRe.exec(string.slice(i));
		return n ? (d.m = monthLookup.get(n[0].toLowerCase()), i + n[0].length) : -1;
	}
	function parseLocaleDateTime(d, string, i) {
		return parseSpecifier(d, locale_dateTime, string, i);
	}
	function parseLocaleDate(d, string, i) {
		return parseSpecifier(d, locale_date, string, i);
	}
	function parseLocaleTime(d, string, i) {
		return parseSpecifier(d, locale_time, string, i);
	}
	function formatShortWeekday(d) {
		return locale_shortWeekdays[d.getDay()];
	}
	function formatWeekday(d) {
		return locale_weekdays[d.getDay()];
	}
	function formatShortMonth(d) {
		return locale_shortMonths[d.getMonth()];
	}
	function formatMonth(d) {
		return locale_months[d.getMonth()];
	}
	function formatPeriod(d) {
		return locale_periods[+(d.getHours() >= 12)];
	}
	function formatQuarter(d) {
		return 1 + ~~(d.getMonth() / 3);
	}
	function formatUTCShortWeekday(d) {
		return locale_shortWeekdays[d.getUTCDay()];
	}
	function formatUTCWeekday(d) {
		return locale_weekdays[d.getUTCDay()];
	}
	function formatUTCShortMonth(d) {
		return locale_shortMonths[d.getUTCMonth()];
	}
	function formatUTCMonth(d) {
		return locale_months[d.getUTCMonth()];
	}
	function formatUTCPeriod(d) {
		return locale_periods[+(d.getUTCHours() >= 12)];
	}
	function formatUTCQuarter(d) {
		return 1 + ~~(d.getUTCMonth() / 3);
	}
	return {
		format: function(specifier) {
			var f = newFormat(specifier += "", formats);
			f.toString = function() {
				return specifier;
			};
			return f;
		},
		parse: function(specifier) {
			var p = newParse(specifier += "", false);
			p.toString = function() {
				return specifier;
			};
			return p;
		},
		utcFormat: function(specifier) {
			var f = newFormat(specifier += "", utcFormats);
			f.toString = function() {
				return specifier;
			};
			return f;
		},
		utcParse: function(specifier) {
			var p = newParse(specifier += "", true);
			p.toString = function() {
				return specifier;
			};
			return p;
		}
	};
}
var pads = {
	"-": "",
	"_": " ",
	"0": "0"
}, numberRe = /^\s*\d+/, percentRe = /^%/, requoteRe = /[\\^$*+?|[\]().{}]/g;
function pad(value, fill, width) {
	var sign$2 = value < 0 ? "-" : "", string = (sign$2 ? -value : value) + "", length$2 = string.length;
	return sign$2 + (length$2 < width ? new Array(width - length$2 + 1).join(fill) + string : string);
}
function requote(s$1) {
	return s$1.replace(requoteRe, "\\$&");
}
function formatRe(names) {
	return new RegExp("^(?:" + names.map(requote).join("|") + ")", "i");
}
function formatLookup(names) {
	return new Map(names.map((name, i) => [name.toLowerCase(), i]));
}
function parseWeekdayNumberSunday(d, string, i) {
	var n = numberRe.exec(string.slice(i, i + 1));
	return n ? (d.w = +n[0], i + n[0].length) : -1;
}
function parseWeekdayNumberMonday(d, string, i) {
	var n = numberRe.exec(string.slice(i, i + 1));
	return n ? (d.u = +n[0], i + n[0].length) : -1;
}
function parseWeekNumberSunday(d, string, i) {
	var n = numberRe.exec(string.slice(i, i + 2));
	return n ? (d.U = +n[0], i + n[0].length) : -1;
}
function parseWeekNumberISO(d, string, i) {
	var n = numberRe.exec(string.slice(i, i + 2));
	return n ? (d.V = +n[0], i + n[0].length) : -1;
}
function parseWeekNumberMonday(d, string, i) {
	var n = numberRe.exec(string.slice(i, i + 2));
	return n ? (d.W = +n[0], i + n[0].length) : -1;
}
function parseFullYear(d, string, i) {
	var n = numberRe.exec(string.slice(i, i + 4));
	return n ? (d.y = +n[0], i + n[0].length) : -1;
}
function parseYear(d, string, i) {
	var n = numberRe.exec(string.slice(i, i + 2));
	return n ? (d.y = +n[0] + (+n[0] > 68 ? 1900 : 2e3), i + n[0].length) : -1;
}
function parseZone(d, string, i) {
	var n = /^(Z)|([+-]\d\d)(?::?(\d\d))?/.exec(string.slice(i, i + 6));
	return n ? (d.Z = n[1] ? 0 : -(n[2] + (n[3] || "00")), i + n[0].length) : -1;
}
function parseQuarter(d, string, i) {
	var n = numberRe.exec(string.slice(i, i + 1));
	return n ? (d.q = n[0] * 3 - 3, i + n[0].length) : -1;
}
function parseMonthNumber(d, string, i) {
	var n = numberRe.exec(string.slice(i, i + 2));
	return n ? (d.m = n[0] - 1, i + n[0].length) : -1;
}
function parseDayOfMonth(d, string, i) {
	var n = numberRe.exec(string.slice(i, i + 2));
	return n ? (d.d = +n[0], i + n[0].length) : -1;
}
function parseDayOfYear(d, string, i) {
	var n = numberRe.exec(string.slice(i, i + 3));
	return n ? (d.m = 0, d.d = +n[0], i + n[0].length) : -1;
}
function parseHour24(d, string, i) {
	var n = numberRe.exec(string.slice(i, i + 2));
	return n ? (d.H = +n[0], i + n[0].length) : -1;
}
function parseMinutes(d, string, i) {
	var n = numberRe.exec(string.slice(i, i + 2));
	return n ? (d.M = +n[0], i + n[0].length) : -1;
}
function parseSeconds(d, string, i) {
	var n = numberRe.exec(string.slice(i, i + 2));
	return n ? (d.S = +n[0], i + n[0].length) : -1;
}
function parseMilliseconds(d, string, i) {
	var n = numberRe.exec(string.slice(i, i + 3));
	return n ? (d.L = +n[0], i + n[0].length) : -1;
}
function parseMicroseconds(d, string, i) {
	var n = numberRe.exec(string.slice(i, i + 6));
	return n ? (d.L = Math.floor(n[0] / 1e3), i + n[0].length) : -1;
}
function parseLiteralPercent(d, string, i) {
	var n = percentRe.exec(string.slice(i, i + 1));
	return n ? i + n[0].length : -1;
}
function parseUnixTimestamp(d, string, i) {
	var n = numberRe.exec(string.slice(i));
	return n ? (d.Q = +n[0], i + n[0].length) : -1;
}
function parseUnixTimestampSeconds(d, string, i) {
	var n = numberRe.exec(string.slice(i));
	return n ? (d.s = +n[0], i + n[0].length) : -1;
}
function formatDayOfMonth(d, p) {
	return pad(d.getDate(), p, 2);
}
function formatHour24(d, p) {
	return pad(d.getHours(), p, 2);
}
function formatHour12(d, p) {
	return pad(d.getHours() % 12 || 12, p, 2);
}
function formatDayOfYear(d, p) {
	return pad(1 + timeDay.count(timeYear(d), d), p, 3);
}
function formatMilliseconds(d, p) {
	return pad(d.getMilliseconds(), p, 3);
}
function formatMicroseconds(d, p) {
	return formatMilliseconds(d, p) + "000";
}
function formatMonthNumber(d, p) {
	return pad(d.getMonth() + 1, p, 2);
}
function formatMinutes(d, p) {
	return pad(d.getMinutes(), p, 2);
}
function formatSeconds(d, p) {
	return pad(d.getSeconds(), p, 2);
}
function formatWeekdayNumberMonday(d) {
	var day = d.getDay();
	return day === 0 ? 7 : day;
}
function formatWeekNumberSunday(d, p) {
	return pad(timeSunday.count(timeYear(d) - 1, d), p, 2);
}
function dISO(d) {
	var day = d.getDay();
	return day >= 4 || day === 0 ? timeThursday(d) : timeThursday.ceil(d);
}
function formatWeekNumberISO(d, p) {
	d = dISO(d);
	return pad(timeThursday.count(timeYear(d), d) + (timeYear(d).getDay() === 4), p, 2);
}
function formatWeekdayNumberSunday(d) {
	return d.getDay();
}
function formatWeekNumberMonday(d, p) {
	return pad(timeMonday.count(timeYear(d) - 1, d), p, 2);
}
function formatYear(d, p) {
	return pad(d.getFullYear() % 100, p, 2);
}
function formatYearISO(d, p) {
	d = dISO(d);
	return pad(d.getFullYear() % 100, p, 2);
}
function formatFullYear(d, p) {
	return pad(d.getFullYear() % 1e4, p, 4);
}
function formatFullYearISO(d, p) {
	var day = d.getDay();
	d = day >= 4 || day === 0 ? timeThursday(d) : timeThursday.ceil(d);
	return pad(d.getFullYear() % 1e4, p, 4);
}
function formatZone(d) {
	var z = d.getTimezoneOffset();
	return (z > 0 ? "-" : (z *= -1, "+")) + pad(z / 60 | 0, "0", 2) + pad(z % 60, "0", 2);
}
function formatUTCDayOfMonth(d, p) {
	return pad(d.getUTCDate(), p, 2);
}
function formatUTCHour24(d, p) {
	return pad(d.getUTCHours(), p, 2);
}
function formatUTCHour12(d, p) {
	return pad(d.getUTCHours() % 12 || 12, p, 2);
}
function formatUTCDayOfYear(d, p) {
	return pad(1 + utcDay.count(utcYear(d), d), p, 3);
}
function formatUTCMilliseconds(d, p) {
	return pad(d.getUTCMilliseconds(), p, 3);
}
function formatUTCMicroseconds(d, p) {
	return formatUTCMilliseconds(d, p) + "000";
}
function formatUTCMonthNumber(d, p) {
	return pad(d.getUTCMonth() + 1, p, 2);
}
function formatUTCMinutes(d, p) {
	return pad(d.getUTCMinutes(), p, 2);
}
function formatUTCSeconds(d, p) {
	return pad(d.getUTCSeconds(), p, 2);
}
function formatUTCWeekdayNumberMonday(d) {
	var dow = d.getUTCDay();
	return dow === 0 ? 7 : dow;
}
function formatUTCWeekNumberSunday(d, p) {
	return pad(utcSunday.count(utcYear(d) - 1, d), p, 2);
}
function UTCdISO(d) {
	var day = d.getUTCDay();
	return day >= 4 || day === 0 ? utcThursday(d) : utcThursday.ceil(d);
}
function formatUTCWeekNumberISO(d, p) {
	d = UTCdISO(d);
	return pad(utcThursday.count(utcYear(d), d) + (utcYear(d).getUTCDay() === 4), p, 2);
}
function formatUTCWeekdayNumberSunday(d) {
	return d.getUTCDay();
}
function formatUTCWeekNumberMonday(d, p) {
	return pad(utcMonday.count(utcYear(d) - 1, d), p, 2);
}
function formatUTCYear(d, p) {
	return pad(d.getUTCFullYear() % 100, p, 2);
}
function formatUTCYearISO(d, p) {
	d = UTCdISO(d);
	return pad(d.getUTCFullYear() % 100, p, 2);
}
function formatUTCFullYear(d, p) {
	return pad(d.getUTCFullYear() % 1e4, p, 4);
}
function formatUTCFullYearISO(d, p) {
	var day = d.getUTCDay();
	d = day >= 4 || day === 0 ? utcThursday(d) : utcThursday.ceil(d);
	return pad(d.getUTCFullYear() % 1e4, p, 4);
}
function formatUTCZone() {
	return "+0000";
}
function formatLiteralPercent() {
	return "%";
}
function formatUnixTimestamp(d) {
	return +d;
}
function formatUnixTimestampSeconds(d) {
	return Math.floor(+d / 1e3);
}

//#endregion
//#region node_modules/d3-time-format/src/defaultLocale.js
var locale;
var timeFormat;
var timeParse;
var utcFormat;
var utcParse;
defaultLocale$1({
	dateTime: "%x, %X",
	date: "%-m/%-d/%Y",
	time: "%-I:%M:%S %p",
	periods: ["AM", "PM"],
	days: [
		"Sunday",
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday"
	],
	shortDays: [
		"Sun",
		"Mon",
		"Tue",
		"Wed",
		"Thu",
		"Fri",
		"Sat"
	],
	months: [
		"January",
		"February",
		"March",
		"April",
		"May",
		"June",
		"July",
		"August",
		"September",
		"October",
		"November",
		"December"
	],
	shortMonths: [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec"
	]
});
function defaultLocale$1(definition) {
	locale = formatLocale(definition);
	timeFormat = locale.format;
	timeParse = locale.parse;
	utcFormat = locale.utcFormat;
	utcParse = locale.utcParse;
	return locale;
}

//#endregion
//#region node_modules/d3-time-format/src/isoFormat.js
var isoSpecifier = "%Y-%m-%dT%H:%M:%S.%LZ";
function formatIsoNative(date$1) {
	return date$1.toISOString();
}
var formatIso = Date.prototype.toISOString ? formatIsoNative : utcFormat(isoSpecifier);
var isoFormat_default = formatIso;

//#endregion
//#region node_modules/d3-time-format/src/isoParse.js
function parseIsoNative(string) {
	var date$1 = new Date(string);
	return isNaN(date$1) ? null : date$1;
}
var parseIso = +/* @__PURE__ */ new Date("2000-01-01T00:00:00.000Z") ? parseIsoNative : utcParse(isoSpecifier);
var isoParse_default = parseIso;

//#endregion
//#region node_modules/d3-scale/src/time.js
function date(t) {
	return new Date(t);
}
function number(t) {
	return t instanceof Date ? +t : +/* @__PURE__ */ new Date(+t);
}
function calendar(ticks$1, tickInterval, year, month, week, day, hour, minute, second$1, format$1) {
	var scale$1 = continuous(), invert = scale$1.invert, domain = scale$1.domain;
	var formatMillisecond = format$1(".%L"), formatSecond = format$1(":%S"), formatMinute = format$1("%I:%M"), formatHour = format$1("%I %p"), formatDay = format$1("%a %d"), formatWeek = format$1("%b %d"), formatMonth = format$1("%B"), formatYear$2 = format$1("%Y");
	function tickFormat$1(date$1) {
		return (second$1(date$1) < date$1 ? formatMillisecond : minute(date$1) < date$1 ? formatSecond : hour(date$1) < date$1 ? formatMinute : day(date$1) < date$1 ? formatHour : month(date$1) < date$1 ? week(date$1) < date$1 ? formatDay : formatWeek : year(date$1) < date$1 ? formatMonth : formatYear$2)(date$1);
	}
	scale$1.invert = function(y$3) {
		return new Date(invert(y$3));
	};
	scale$1.domain = function(_) {
		return arguments.length ? domain(Array.from(_, number)) : domain().map(date);
	};
	scale$1.ticks = function(interval$1) {
		var d = domain();
		return ticks$1(d[0], d[d.length - 1], interval$1 == null ? 10 : interval$1);
	};
	scale$1.tickFormat = function(count$2, specifier) {
		return specifier == null ? tickFormat$1 : format$1(specifier);
	};
	scale$1.nice = function(interval$1) {
		var d = domain();
		if (!interval$1 || typeof interval$1.range !== "function") interval$1 = tickInterval(d[0], d[d.length - 1], interval$1 == null ? 10 : interval$1);
		return interval$1 ? domain(nice$1(d, interval$1)) : scale$1;
	};
	scale$1.copy = function() {
		return copy$1(scale$1, calendar(ticks$1, tickInterval, year, month, week, day, hour, minute, second$1, format$1));
	};
	return scale$1;
}
function time() {
	return initRange.apply(calendar(timeTicks, timeTickInterval, timeYear, timeMonth, timeSunday, timeDay, timeHour, timeMinute, second, timeFormat).domain([new Date(2e3, 0, 1), new Date(2e3, 0, 2)]), arguments);
}

//#endregion
//#region node_modules/d3-scale/src/utcTime.js
function utcTime() {
	return initRange.apply(calendar(utcTicks, utcTickInterval, utcYear, utcMonth, utcSunday, utcDay, utcHour, utcMinute, second, utcFormat).domain([Date.UTC(2e3, 0, 1), Date.UTC(2e3, 0, 2)]), arguments);
}

//#endregion
//#region node_modules/d3-scale/src/sequential.js
function transformer$1() {
	var x0$5 = 0, x1$1 = 1, t0$2, t1$2, k10, transform$1, interpolator = identity$2, clamp = false, unknown;
	function scale$1(x$3) {
		return x$3 == null || isNaN(x$3 = +x$3) ? unknown : interpolator(k10 === 0 ? .5 : (x$3 = (transform$1(x$3) - t0$2) * k10, clamp ? Math.max(0, Math.min(1, x$3)) : x$3));
	}
	scale$1.domain = function(_) {
		return arguments.length ? ([x0$5, x1$1] = _, t0$2 = transform$1(x0$5 = +x0$5), t1$2 = transform$1(x1$1 = +x1$1), k10 = t0$2 === t1$2 ? 0 : 1 / (t1$2 - t0$2), scale$1) : [x0$5, x1$1];
	};
	scale$1.clamp = function(_) {
		return arguments.length ? (clamp = !!_, scale$1) : clamp;
	};
	scale$1.interpolator = function(_) {
		return arguments.length ? (interpolator = _, scale$1) : interpolator;
	};
	function range$3(interpolate) {
		return function(_) {
			var r0, r1;
			return arguments.length ? ([r0, r1] = _, interpolator = interpolate(r0, r1), scale$1) : [interpolator(0), interpolator(1)];
		};
	}
	scale$1.range = range$3(value_default);
	scale$1.rangeRound = range$3(round_default);
	scale$1.unknown = function(_) {
		return arguments.length ? (unknown = _, scale$1) : unknown;
	};
	return function(t) {
		transform$1 = t, t0$2 = t(x0$5), t1$2 = t(x1$1), k10 = t0$2 === t1$2 ? 0 : 1 / (t1$2 - t0$2);
		return scale$1;
	};
}
function copy(source, target) {
	return target.domain(source.domain()).interpolator(source.interpolator()).clamp(source.clamp()).unknown(source.unknown());
}
function sequential() {
	var scale$1 = linearish(transformer$1()(identity$2));
	scale$1.copy = function() {
		return copy(scale$1, sequential());
	};
	return initInterpolator.apply(scale$1, arguments);
}
function sequentialLog() {
	var scale$1 = loggish(transformer$1()).domain([1, 10]);
	scale$1.copy = function() {
		return copy(scale$1, sequentialLog()).base(scale$1.base());
	};
	return initInterpolator.apply(scale$1, arguments);
}
function sequentialSymlog() {
	var scale$1 = symlogish(transformer$1());
	scale$1.copy = function() {
		return copy(scale$1, sequentialSymlog()).constant(scale$1.constant());
	};
	return initInterpolator.apply(scale$1, arguments);
}
function sequentialPow() {
	var scale$1 = powish(transformer$1());
	scale$1.copy = function() {
		return copy(scale$1, sequentialPow()).exponent(scale$1.exponent());
	};
	return initInterpolator.apply(scale$1, arguments);
}
function sequentialSqrt() {
	return sequentialPow.apply(null, arguments).exponent(.5);
}

//#endregion
//#region node_modules/d3-scale/src/sequentialQuantile.js
function sequentialQuantile() {
	var domain = [], interpolator = identity$2;
	function scale$1(x$3) {
		if (x$3 != null && !isNaN(x$3 = +x$3)) return interpolator((bisect_default(domain, x$3, 1) - 1) / (domain.length - 1));
	}
	scale$1.domain = function(_) {
		if (!arguments.length) return domain.slice();
		domain = [];
		for (let d of _) if (d != null && !isNaN(d = +d)) domain.push(d);
		domain.sort(ascending);
		return scale$1;
	};
	scale$1.interpolator = function(_) {
		return arguments.length ? (interpolator = _, scale$1) : interpolator;
	};
	scale$1.range = function() {
		return domain.map((d, i) => interpolator(i / (domain.length - 1)));
	};
	scale$1.quantiles = function(n) {
		return Array.from({ length: n + 1 }, (_, i) => quantile(domain, i / n));
	};
	scale$1.copy = function() {
		return sequentialQuantile(interpolator).domain(domain);
	};
	return initInterpolator.apply(scale$1, arguments);
}

//#endregion
//#region node_modules/d3-scale/src/diverging.js
function transformer() {
	var x0$5 = 0, x1$1 = .5, x2 = 1, s$1 = 1, t0$2, t1$2, t2$1, k10, k21, interpolator = identity$2, transform$1, clamp = false, unknown;
	function scale$1(x$3) {
		return isNaN(x$3 = +x$3) ? unknown : (x$3 = .5 + ((x$3 = +transform$1(x$3)) - t1$2) * (s$1 * x$3 < s$1 * t1$2 ? k10 : k21), interpolator(clamp ? Math.max(0, Math.min(1, x$3)) : x$3));
	}
	scale$1.domain = function(_) {
		return arguments.length ? ([x0$5, x1$1, x2] = _, t0$2 = transform$1(x0$5 = +x0$5), t1$2 = transform$1(x1$1 = +x1$1), t2$1 = transform$1(x2 = +x2), k10 = t0$2 === t1$2 ? 0 : .5 / (t1$2 - t0$2), k21 = t1$2 === t2$1 ? 0 : .5 / (t2$1 - t1$2), s$1 = t1$2 < t0$2 ? -1 : 1, scale$1) : [
			x0$5,
			x1$1,
			x2
		];
	};
	scale$1.clamp = function(_) {
		return arguments.length ? (clamp = !!_, scale$1) : clamp;
	};
	scale$1.interpolator = function(_) {
		return arguments.length ? (interpolator = _, scale$1) : interpolator;
	};
	function range$3(interpolate) {
		return function(_) {
			var r0, r1, r2;
			return arguments.length ? ([r0, r1, r2] = _, interpolator = piecewise(interpolate, [
				r0,
				r1,
				r2
			]), scale$1) : [
				interpolator(0),
				interpolator(.5),
				interpolator(1)
			];
		};
	}
	scale$1.range = range$3(value_default);
	scale$1.rangeRound = range$3(round_default);
	scale$1.unknown = function(_) {
		return arguments.length ? (unknown = _, scale$1) : unknown;
	};
	return function(t) {
		transform$1 = t, t0$2 = t(x0$5), t1$2 = t(x1$1), t2$1 = t(x2), k10 = t0$2 === t1$2 ? 0 : .5 / (t1$2 - t0$2), k21 = t1$2 === t2$1 ? 0 : .5 / (t2$1 - t1$2), s$1 = t1$2 < t0$2 ? -1 : 1;
		return scale$1;
	};
}
function diverging() {
	var scale$1 = linearish(transformer()(identity$2));
	scale$1.copy = function() {
		return copy(scale$1, diverging());
	};
	return initInterpolator.apply(scale$1, arguments);
}
function divergingLog() {
	var scale$1 = loggish(transformer()).domain([
		.1,
		1,
		10
	]);
	scale$1.copy = function() {
		return copy(scale$1, divergingLog()).base(scale$1.base());
	};
	return initInterpolator.apply(scale$1, arguments);
}
function divergingSymlog() {
	var scale$1 = symlogish(transformer());
	scale$1.copy = function() {
		return copy(scale$1, divergingSymlog()).constant(scale$1.constant());
	};
	return initInterpolator.apply(scale$1, arguments);
}
function divergingPow() {
	var scale$1 = powish(transformer());
	scale$1.copy = function() {
		return copy(scale$1, divergingPow()).exponent(scale$1.exponent());
	};
	return initInterpolator.apply(scale$1, arguments);
}
function divergingSqrt() {
	return divergingPow.apply(null, arguments).exponent(.5);
}

//#endregion
//#region node_modules/d3-scale-chromatic/src/colors.js
function colors_default(specifier) {
	var n = specifier.length / 6 | 0, colors = new Array(n), i = 0;
	while (i < n) colors[i] = "#" + specifier.slice(i * 6, ++i * 6);
	return colors;
}

//#endregion
//#region node_modules/d3-scale-chromatic/src/categorical/category10.js
var category10_default = colors_default("1f77b4ff7f0e2ca02cd627289467bd8c564be377c27f7f7fbcbd2217becf");

//#endregion
//#region node_modules/d3-scale-chromatic/src/categorical/Accent.js
var Accent_default = colors_default("7fc97fbeaed4fdc086ffff99386cb0f0027fbf5b17666666");

//#endregion
//#region node_modules/d3-scale-chromatic/src/categorical/Dark2.js
var Dark2_default = colors_default("1b9e77d95f027570b3e7298a66a61ee6ab02a6761d666666");

//#endregion
//#region node_modules/d3-scale-chromatic/src/categorical/observable10.js
var observable10_default = colors_default("4269d0efb118ff725c6cc5b03ca951ff8ab7a463f297bbf59c6b4e9498a0");

//#endregion
//#region node_modules/d3-scale-chromatic/src/categorical/Paired.js
var Paired_default = colors_default("a6cee31f78b4b2df8a33a02cfb9a99e31a1cfdbf6fff7f00cab2d66a3d9affff99b15928");

//#endregion
//#region node_modules/d3-scale-chromatic/src/categorical/Pastel1.js
var Pastel1_default = colors_default("fbb4aeb3cde3ccebc5decbe4fed9a6ffffcce5d8bdfddaecf2f2f2");

//#endregion
//#region node_modules/d3-scale-chromatic/src/categorical/Pastel2.js
var Pastel2_default = colors_default("b3e2cdfdcdaccbd5e8f4cae4e6f5c9fff2aef1e2cccccccc");

//#endregion
//#region node_modules/d3-scale-chromatic/src/categorical/Set1.js
var Set1_default = colors_default("e41a1c377eb84daf4a984ea3ff7f00ffff33a65628f781bf999999");

//#endregion
//#region node_modules/d3-scale-chromatic/src/categorical/Set2.js
var Set2_default = colors_default("66c2a5fc8d628da0cbe78ac3a6d854ffd92fe5c494b3b3b3");

//#endregion
//#region node_modules/d3-scale-chromatic/src/categorical/Set3.js
var Set3_default = colors_default("8dd3c7ffffb3bebadafb807280b1d3fdb462b3de69fccde5d9d9d9bc80bdccebc5ffed6f");

//#endregion
//#region node_modules/d3-scale-chromatic/src/categorical/Tableau10.js
var Tableau10_default = colors_default("4e79a7f28e2ce1575976b7b259a14fedc949af7aa1ff9da79c755fbab0ab");

//#endregion
//#region node_modules/d3-scale-chromatic/src/ramp.js
var ramp_default = (scheme$27) => rgbBasis(scheme$27[scheme$27.length - 1]);

//#endregion
//#region node_modules/d3-scale-chromatic/src/diverging/BrBG.js
var scheme$1 = new Array(3).concat("d8b365f5f5f55ab4ac", "a6611adfc27d80cdc1018571", "a6611adfc27df5f5f580cdc1018571", "8c510ad8b365f6e8c3c7eae55ab4ac01665e", "8c510ad8b365f6e8c3f5f5f5c7eae55ab4ac01665e", "8c510abf812ddfc27df6e8c3c7eae580cdc135978f01665e", "8c510abf812ddfc27df6e8c3f5f5f5c7eae580cdc135978f01665e", "5430058c510abf812ddfc27df6e8c3c7eae580cdc135978f01665e003c30", "5430058c510abf812ddfc27df6e8c3f5f5f5c7eae580cdc135978f01665e003c30").map(colors_default);
var BrBG_default = ramp_default(scheme$1);

//#endregion
//#region node_modules/d3-scale-chromatic/src/diverging/PRGn.js
var scheme$9 = new Array(3).concat("af8dc3f7f7f77fbf7b", "7b3294c2a5cfa6dba0008837", "7b3294c2a5cff7f7f7a6dba0008837", "762a83af8dc3e7d4e8d9f0d37fbf7b1b7837", "762a83af8dc3e7d4e8f7f7f7d9f0d37fbf7b1b7837", "762a839970abc2a5cfe7d4e8d9f0d3a6dba05aae611b7837", "762a839970abc2a5cfe7d4e8f7f7f7d9f0d3a6dba05aae611b7837", "40004b762a839970abc2a5cfe7d4e8d9f0d3a6dba05aae611b783700441b", "40004b762a839970abc2a5cfe7d4e8f7f7f7d9f0d3a6dba05aae611b783700441b").map(colors_default);
var PRGn_default = ramp_default(scheme$9);

//#endregion
//#region node_modules/d3-scale-chromatic/src/diverging/PiYG.js
var scheme$10 = new Array(3).concat("e9a3c9f7f7f7a1d76a", "d01c8bf1b6dab8e1864dac26", "d01c8bf1b6daf7f7f7b8e1864dac26", "c51b7de9a3c9fde0efe6f5d0a1d76a4d9221", "c51b7de9a3c9fde0eff7f7f7e6f5d0a1d76a4d9221", "c51b7dde77aef1b6dafde0efe6f5d0b8e1867fbc414d9221", "c51b7dde77aef1b6dafde0eff7f7f7e6f5d0b8e1867fbc414d9221", "8e0152c51b7dde77aef1b6dafde0efe6f5d0b8e1867fbc414d9221276419", "8e0152c51b7dde77aef1b6dafde0eff7f7f7e6f5d0b8e1867fbc414d9221276419").map(colors_default);
var PiYG_default = ramp_default(scheme$10);

//#endregion
//#region node_modules/d3-scale-chromatic/src/diverging/PuOr.js
var scheme$13 = new Array(3).concat("998ec3f7f7f7f1a340", "5e3c99b2abd2fdb863e66101", "5e3c99b2abd2f7f7f7fdb863e66101", "542788998ec3d8daebfee0b6f1a340b35806", "542788998ec3d8daebf7f7f7fee0b6f1a340b35806", "5427888073acb2abd2d8daebfee0b6fdb863e08214b35806", "5427888073acb2abd2d8daebf7f7f7fee0b6fdb863e08214b35806", "2d004b5427888073acb2abd2d8daebfee0b6fdb863e08214b358067f3b08", "2d004b5427888073acb2abd2d8daebf7f7f7fee0b6fdb863e08214b358067f3b08").map(colors_default);
var PuOr_default = ramp_default(scheme$13);

//#endregion
//#region node_modules/d3-scale-chromatic/src/diverging/RdBu.js
var scheme$16 = new Array(3).concat("ef8a62f7f7f767a9cf", "ca0020f4a58292c5de0571b0", "ca0020f4a582f7f7f792c5de0571b0", "b2182bef8a62fddbc7d1e5f067a9cf2166ac", "b2182bef8a62fddbc7f7f7f7d1e5f067a9cf2166ac", "b2182bd6604df4a582fddbc7d1e5f092c5de4393c32166ac", "b2182bd6604df4a582fddbc7f7f7f7d1e5f092c5de4393c32166ac", "67001fb2182bd6604df4a582fddbc7d1e5f092c5de4393c32166ac053061", "67001fb2182bd6604df4a582fddbc7f7f7f7d1e5f092c5de4393c32166ac053061").map(colors_default);
var RdBu_default = ramp_default(scheme$16);

//#endregion
//#region node_modules/d3-scale-chromatic/src/diverging/RdGy.js
var scheme$17 = new Array(3).concat("ef8a62ffffff999999", "ca0020f4a582bababa404040", "ca0020f4a582ffffffbababa404040", "b2182bef8a62fddbc7e0e0e09999994d4d4d", "b2182bef8a62fddbc7ffffffe0e0e09999994d4d4d", "b2182bd6604df4a582fddbc7e0e0e0bababa8787874d4d4d", "b2182bd6604df4a582fddbc7ffffffe0e0e0bababa8787874d4d4d", "67001fb2182bd6604df4a582fddbc7e0e0e0bababa8787874d4d4d1a1a1a", "67001fb2182bd6604df4a582fddbc7ffffffe0e0e0bababa8787874d4d4d1a1a1a").map(colors_default);
var RdGy_default = ramp_default(scheme$17);

//#endregion
//#region node_modules/d3-scale-chromatic/src/diverging/RdYlBu.js
var scheme$19 = new Array(3).concat("fc8d59ffffbf91bfdb", "d7191cfdae61abd9e92c7bb6", "d7191cfdae61ffffbfabd9e92c7bb6", "d73027fc8d59fee090e0f3f891bfdb4575b4", "d73027fc8d59fee090ffffbfe0f3f891bfdb4575b4", "d73027f46d43fdae61fee090e0f3f8abd9e974add14575b4", "d73027f46d43fdae61fee090ffffbfe0f3f8abd9e974add14575b4", "a50026d73027f46d43fdae61fee090e0f3f8abd9e974add14575b4313695", "a50026d73027f46d43fdae61fee090ffffbfe0f3f8abd9e974add14575b4313695").map(colors_default);
var RdYlBu_default = ramp_default(scheme$19);

//#endregion
//#region node_modules/d3-scale-chromatic/src/diverging/RdYlGn.js
var scheme$20 = new Array(3).concat("fc8d59ffffbf91cf60", "d7191cfdae61a6d96a1a9641", "d7191cfdae61ffffbfa6d96a1a9641", "d73027fc8d59fee08bd9ef8b91cf601a9850", "d73027fc8d59fee08bffffbfd9ef8b91cf601a9850", "d73027f46d43fdae61fee08bd9ef8ba6d96a66bd631a9850", "d73027f46d43fdae61fee08bffffbfd9ef8ba6d96a66bd631a9850", "a50026d73027f46d43fdae61fee08bd9ef8ba6d96a66bd631a9850006837", "a50026d73027f46d43fdae61fee08bffffbfd9ef8ba6d96a66bd631a9850006837").map(colors_default);
var RdYlGn_default = ramp_default(scheme$20);

//#endregion
//#region node_modules/d3-scale-chromatic/src/diverging/Spectral.js
var scheme$22 = new Array(3).concat("fc8d59ffffbf99d594", "d7191cfdae61abdda42b83ba", "d7191cfdae61ffffbfabdda42b83ba", "d53e4ffc8d59fee08be6f59899d5943288bd", "d53e4ffc8d59fee08bffffbfe6f59899d5943288bd", "d53e4ff46d43fdae61fee08be6f598abdda466c2a53288bd", "d53e4ff46d43fdae61fee08bffffbfe6f598abdda466c2a53288bd", "9e0142d53e4ff46d43fdae61fee08be6f598abdda466c2a53288bd5e4fa2", "9e0142d53e4ff46d43fdae61fee08bffffbfe6f598abdda466c2a53288bd5e4fa2").map(colors_default);
var Spectral_default = ramp_default(scheme$22);

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-multi/BuGn.js
var scheme$2 = new Array(3).concat("e5f5f999d8c92ca25f", "edf8fbb2e2e266c2a4238b45", "edf8fbb2e2e266c2a42ca25f006d2c", "edf8fbccece699d8c966c2a42ca25f006d2c", "edf8fbccece699d8c966c2a441ae76238b45005824", "f7fcfde5f5f9ccece699d8c966c2a441ae76238b45005824", "f7fcfde5f5f9ccece699d8c966c2a441ae76238b45006d2c00441b").map(colors_default);
var BuGn_default = ramp_default(scheme$2);

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-multi/BuPu.js
var scheme$3 = new Array(3).concat("e0ecf49ebcda8856a7", "edf8fbb3cde38c96c688419d", "edf8fbb3cde38c96c68856a7810f7c", "edf8fbbfd3e69ebcda8c96c68856a7810f7c", "edf8fbbfd3e69ebcda8c96c68c6bb188419d6e016b", "f7fcfde0ecf4bfd3e69ebcda8c96c68c6bb188419d6e016b", "f7fcfde0ecf4bfd3e69ebcda8c96c68c6bb188419d810f7c4d004b").map(colors_default);
var BuPu_default = ramp_default(scheme$3);

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-multi/GnBu.js
var scheme$4 = new Array(3).concat("e0f3dba8ddb543a2ca", "f0f9e8bae4bc7bccc42b8cbe", "f0f9e8bae4bc7bccc443a2ca0868ac", "f0f9e8ccebc5a8ddb57bccc443a2ca0868ac", "f0f9e8ccebc5a8ddb57bccc44eb3d32b8cbe08589e", "f7fcf0e0f3dbccebc5a8ddb57bccc44eb3d32b8cbe08589e", "f7fcf0e0f3dbccebc5a8ddb57bccc44eb3d32b8cbe0868ac084081").map(colors_default);
var GnBu_default = ramp_default(scheme$4);

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-multi/OrRd.js
var scheme$7 = new Array(3).concat("fee8c8fdbb84e34a33", "fef0d9fdcc8afc8d59d7301f", "fef0d9fdcc8afc8d59e34a33b30000", "fef0d9fdd49efdbb84fc8d59e34a33b30000", "fef0d9fdd49efdbb84fc8d59ef6548d7301f990000", "fff7ecfee8c8fdd49efdbb84fc8d59ef6548d7301f990000", "fff7ecfee8c8fdd49efdbb84fc8d59ef6548d7301fb300007f0000").map(colors_default);
var OrRd_default = ramp_default(scheme$7);

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-multi/PuBuGn.js
var scheme$12 = new Array(3).concat("ece2f0a6bddb1c9099", "f6eff7bdc9e167a9cf02818a", "f6eff7bdc9e167a9cf1c9099016c59", "f6eff7d0d1e6a6bddb67a9cf1c9099016c59", "f6eff7d0d1e6a6bddb67a9cf3690c002818a016450", "fff7fbece2f0d0d1e6a6bddb67a9cf3690c002818a016450", "fff7fbece2f0d0d1e6a6bddb67a9cf3690c002818a016c59014636").map(colors_default);
var PuBuGn_default = ramp_default(scheme$12);

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-multi/PuBu.js
var scheme$11 = new Array(3).concat("ece7f2a6bddb2b8cbe", "f1eef6bdc9e174a9cf0570b0", "f1eef6bdc9e174a9cf2b8cbe045a8d", "f1eef6d0d1e6a6bddb74a9cf2b8cbe045a8d", "f1eef6d0d1e6a6bddb74a9cf3690c00570b0034e7b", "fff7fbece7f2d0d1e6a6bddb74a9cf3690c00570b0034e7b", "fff7fbece7f2d0d1e6a6bddb74a9cf3690c00570b0045a8d023858").map(colors_default);
var PuBu_default = ramp_default(scheme$11);

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-multi/PuRd.js
var scheme$14 = new Array(3).concat("e7e1efc994c7dd1c77", "f1eef6d7b5d8df65b0ce1256", "f1eef6d7b5d8df65b0dd1c77980043", "f1eef6d4b9dac994c7df65b0dd1c77980043", "f1eef6d4b9dac994c7df65b0e7298ace125691003f", "f7f4f9e7e1efd4b9dac994c7df65b0e7298ace125691003f", "f7f4f9e7e1efd4b9dac994c7df65b0e7298ace125698004367001f").map(colors_default);
var PuRd_default = ramp_default(scheme$14);

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-multi/RdPu.js
var scheme$18 = new Array(3).concat("fde0ddfa9fb5c51b8a", "feebe2fbb4b9f768a1ae017e", "feebe2fbb4b9f768a1c51b8a7a0177", "feebe2fcc5c0fa9fb5f768a1c51b8a7a0177", "feebe2fcc5c0fa9fb5f768a1dd3497ae017e7a0177", "fff7f3fde0ddfcc5c0fa9fb5f768a1dd3497ae017e7a0177", "fff7f3fde0ddfcc5c0fa9fb5f768a1dd3497ae017e7a017749006a").map(colors_default);
var RdPu_default = ramp_default(scheme$18);

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-multi/YlGnBu.js
var scheme$24 = new Array(3).concat("edf8b17fcdbb2c7fb8", "ffffcca1dab441b6c4225ea8", "ffffcca1dab441b6c42c7fb8253494", "ffffccc7e9b47fcdbb41b6c42c7fb8253494", "ffffccc7e9b47fcdbb41b6c41d91c0225ea80c2c84", "ffffd9edf8b1c7e9b47fcdbb41b6c41d91c0225ea80c2c84", "ffffd9edf8b1c7e9b47fcdbb41b6c41d91c0225ea8253494081d58").map(colors_default);
var YlGnBu_default = ramp_default(scheme$24);

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-multi/YlGn.js
var scheme$23 = new Array(3).concat("f7fcb9addd8e31a354", "ffffccc2e69978c679238443", "ffffccc2e69978c67931a354006837", "ffffccd9f0a3addd8e78c67931a354006837", "ffffccd9f0a3addd8e78c67941ab5d238443005a32", "ffffe5f7fcb9d9f0a3addd8e78c67941ab5d238443005a32", "ffffe5f7fcb9d9f0a3addd8e78c67941ab5d238443006837004529").map(colors_default);
var YlGn_default = ramp_default(scheme$23);

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-multi/YlOrBr.js
var scheme$25 = new Array(3).concat("fff7bcfec44fd95f0e", "ffffd4fed98efe9929cc4c02", "ffffd4fed98efe9929d95f0e993404", "ffffd4fee391fec44ffe9929d95f0e993404", "ffffd4fee391fec44ffe9929ec7014cc4c028c2d04", "ffffe5fff7bcfee391fec44ffe9929ec7014cc4c028c2d04", "ffffe5fff7bcfee391fec44ffe9929ec7014cc4c02993404662506").map(colors_default);
var YlOrBr_default = ramp_default(scheme$25);

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-multi/YlOrRd.js
var scheme$26 = new Array(3).concat("ffeda0feb24cf03b20", "ffffb2fecc5cfd8d3ce31a1c", "ffffb2fecc5cfd8d3cf03b20bd0026", "ffffb2fed976feb24cfd8d3cf03b20bd0026", "ffffb2fed976feb24cfd8d3cfc4e2ae31a1cb10026", "ffffccffeda0fed976feb24cfd8d3cfc4e2ae31a1cb10026", "ffffccffeda0fed976feb24cfd8d3cfc4e2ae31a1cbd0026800026").map(colors_default);
var YlOrRd_default = ramp_default(scheme$26);

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-single/Blues.js
var scheme = new Array(3).concat("deebf79ecae13182bd", "eff3ffbdd7e76baed62171b5", "eff3ffbdd7e76baed63182bd08519c", "eff3ffc6dbef9ecae16baed63182bd08519c", "eff3ffc6dbef9ecae16baed64292c62171b5084594", "f7fbffdeebf7c6dbef9ecae16baed64292c62171b5084594", "f7fbffdeebf7c6dbef9ecae16baed64292c62171b508519c08306b").map(colors_default);
var Blues_default = ramp_default(scheme);

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-single/Greens.js
var scheme$5 = new Array(3).concat("e5f5e0a1d99b31a354", "edf8e9bae4b374c476238b45", "edf8e9bae4b374c47631a354006d2c", "edf8e9c7e9c0a1d99b74c47631a354006d2c", "edf8e9c7e9c0a1d99b74c47641ab5d238b45005a32", "f7fcf5e5f5e0c7e9c0a1d99b74c47641ab5d238b45005a32", "f7fcf5e5f5e0c7e9c0a1d99b74c47641ab5d238b45006d2c00441b").map(colors_default);
var Greens_default = ramp_default(scheme$5);

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-single/Greys.js
var scheme$6 = new Array(3).concat("f0f0f0bdbdbd636363", "f7f7f7cccccc969696525252", "f7f7f7cccccc969696636363252525", "f7f7f7d9d9d9bdbdbd969696636363252525", "f7f7f7d9d9d9bdbdbd969696737373525252252525", "fffffff0f0f0d9d9d9bdbdbd969696737373525252252525", "fffffff0f0f0d9d9d9bdbdbd969696737373525252252525000000").map(colors_default);
var Greys_default = ramp_default(scheme$6);

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-single/Purples.js
var scheme$15 = new Array(3).concat("efedf5bcbddc756bb1", "f2f0f7cbc9e29e9ac86a51a3", "f2f0f7cbc9e29e9ac8756bb154278f", "f2f0f7dadaebbcbddc9e9ac8756bb154278f", "f2f0f7dadaebbcbddc9e9ac8807dba6a51a34a1486", "fcfbfdefedf5dadaebbcbddc9e9ac8807dba6a51a34a1486", "fcfbfdefedf5dadaebbcbddc9e9ac8807dba6a51a354278f3f007d").map(colors_default);
var Purples_default = ramp_default(scheme$15);

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-single/Reds.js
var scheme$21 = new Array(3).concat("fee0d2fc9272de2d26", "fee5d9fcae91fb6a4acb181d", "fee5d9fcae91fb6a4ade2d26a50f15", "fee5d9fcbba1fc9272fb6a4ade2d26a50f15", "fee5d9fcbba1fc9272fb6a4aef3b2ccb181d99000d", "fff5f0fee0d2fcbba1fc9272fb6a4aef3b2ccb181d99000d", "fff5f0fee0d2fcbba1fc9272fb6a4aef3b2ccb181da50f1567000d").map(colors_default);
var Reds_default = ramp_default(scheme$21);

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-single/Oranges.js
var scheme$8 = new Array(3).concat("fee6cefdae6be6550d", "feeddefdbe85fd8d3cd94701", "feeddefdbe85fd8d3ce6550da63603", "feeddefdd0a2fdae6bfd8d3ce6550da63603", "feeddefdd0a2fdae6bfd8d3cf16913d948018c2d04", "fff5ebfee6cefdd0a2fdae6bfd8d3cf16913d948018c2d04", "fff5ebfee6cefdd0a2fdae6bfd8d3cf16913d94801a636037f2704").map(colors_default);
var Oranges_default = ramp_default(scheme$8);

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-multi/cividis.js
function cividis_default(t) {
	t = Math.max(0, Math.min(1, t));
	return "rgb(" + Math.max(0, Math.min(255, Math.round(-4.54 - t * (35.34 - t * (2381.73 - t * (6402.7 - t * (7024.72 - t * 2710.57))))))) + ", " + Math.max(0, Math.min(255, Math.round(32.49 + t * (170.73 + t * (52.82 - t * (131.46 - t * (176.58 - t * 67.37))))))) + ", " + Math.max(0, Math.min(255, Math.round(81.24 + t * (442.36 - t * (2482.43 - t * (6167.24 - t * (6614.94 - t * 2475.67))))))) + ")";
}

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-multi/cubehelix.js
var cubehelix_default$1 = cubehelixLong(cubehelix(300, .5, 0), cubehelix(-240, .5, 1));

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-multi/rainbow.js
var warm = cubehelixLong(cubehelix(-100, .75, .35), cubehelix(80, 1.5, .8));
var cool = cubehelixLong(cubehelix(260, .75, .35), cubehelix(80, 1.5, .8));
var c$2 = cubehelix();
function rainbow_default(t) {
	if (t < 0 || t > 1) t -= Math.floor(t);
	var ts = Math.abs(t - .5);
	c$2.h = 360 * t - 100;
	c$2.s = 1.5 - 1.5 * ts;
	c$2.l = .8 - .9 * ts;
	return c$2 + "";
}

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-multi/sinebow.js
var c$1 = rgb(), pi_1_3 = Math.PI / 3, pi_2_3 = Math.PI * 2 / 3;
function sinebow_default(t) {
	var x$3;
	t = (.5 - t) * Math.PI;
	c$1.r = 255 * (x$3 = Math.sin(t)) * x$3;
	c$1.g = 255 * (x$3 = Math.sin(t + pi_1_3)) * x$3;
	c$1.b = 255 * (x$3 = Math.sin(t + pi_2_3)) * x$3;
	return c$1 + "";
}

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-multi/turbo.js
function turbo_default(t) {
	t = Math.max(0, Math.min(1, t));
	return "rgb(" + Math.max(0, Math.min(255, Math.round(34.61 + t * (1172.33 - t * (10793.56 - t * (33300.12 - t * (38394.49 - t * 14825.05))))))) + ", " + Math.max(0, Math.min(255, Math.round(23.31 + t * (557.33 + t * (1225.33 - t * (3574.96 - t * (1073.77 + t * 707.56))))))) + ", " + Math.max(0, Math.min(255, Math.round(27.2 + t * (3211.1 - t * (15327.97 - t * (27814 - t * (22569.18 - t * 6838.66))))))) + ")";
}

//#endregion
//#region node_modules/d3-scale-chromatic/src/sequential-multi/viridis.js
function ramp(range$3) {
	var n = range$3.length;
	return function(t) {
		return range$3[Math.max(0, Math.min(n - 1, Math.floor(t * n)))];
	};
}
var viridis_default = ramp(colors_default("44015444025645045745055946075a46085c460a5d460b5e470d60470e6147106347116447136548146748166848176948186a481a6c481b6d481c6e481d6f481f70482071482173482374482475482576482677482878482979472a7a472c7a472d7b472e7c472f7d46307e46327e46337f463480453581453781453882443983443a83443b84433d84433e85423f854240864241864142874144874045884046883f47883f48893e49893e4a893e4c8a3d4d8a3d4e8a3c4f8a3c508b3b518b3b528b3a538b3a548c39558c39568c38588c38598c375a8c375b8d365c8d365d8d355e8d355f8d34608d34618d33628d33638d32648e32658e31668e31678e31688e30698e306a8e2f6b8e2f6c8e2e6d8e2e6e8e2e6f8e2d708e2d718e2c718e2c728e2c738e2b748e2b758e2a768e2a778e2a788e29798e297a8e297b8e287c8e287d8e277e8e277f8e27808e26818e26828e26828e25838e25848e25858e24868e24878e23888e23898e238a8d228b8d228c8d228d8d218e8d218f8d21908d21918c20928c20928c20938c1f948c1f958b1f968b1f978b1f988b1f998a1f9a8a1e9b8a1e9c891e9d891f9e891f9f881fa0881fa1881fa1871fa28720a38620a48621a58521a68522a78522a88423a98324aa8325ab8225ac8226ad8127ad8128ae8029af7f2ab07f2cb17e2db27d2eb37c2fb47c31b57b32b67a34b67935b77937b87838b9773aba763bbb753dbc743fbc7340bd7242be7144bf7046c06f48c16e4ac16d4cc26c4ec36b50c46a52c56954c56856c66758c7655ac8645cc8635ec96260ca6063cb5f65cb5e67cc5c69cd5b6ccd5a6ece5870cf5773d05675d05477d1537ad1517cd2507fd34e81d34d84d44b86d54989d5488bd6468ed64590d74393d74195d84098d83e9bd93c9dd93ba0da39a2da37a5db36a8db34aadc32addc30b0dd2fb2dd2db5de2bb8de29bade28bddf26c0df25c2df23c5e021c8e020cae11fcde11dd0e11cd2e21bd5e21ad8e219dae319dde318dfe318e2e418e5e419e7e419eae51aece51befe51cf1e51df4e61ef6e620f8e621fbe723fde725"));
var magma = ramp(colors_default("00000401000501010601010802010902020b02020d03030f03031204041405041606051806051a07061c08071e0907200a08220b09240c09260d0a290e0b2b100b2d110c2f120d31130d34140e36150e38160f3b180f3d19103f1a10421c10441d11471e114920114b21114e22115024125325125527125829115a2a115c2c115f2d11612f116331116533106734106936106b38106c390f6e3b0f703d0f713f0f72400f74420f75440f764510774710784910784a10794c117a4e117b4f127b51127c52137c54137d56147d57157e59157e5a167e5c167f5d177f5f187f601880621980641a80651a80671b80681c816a1c816b1d816d1d816e1e81701f81721f817320817521817621817822817922827b23827c23827e24828025828125818326818426818627818827818928818b29818c29818e2a81902a81912b81932b80942c80962c80982d80992d809b2e7f9c2e7f9e2f7fa02f7fa1307ea3307ea5317ea6317da8327daa337dab337cad347cae347bb0357bb2357bb3367ab5367ab73779b83779ba3878bc3978bd3977bf3a77c03a76c23b75c43c75c53c74c73d73c83e73ca3e72cc3f71cd4071cf4070d0416fd2426fd3436ed5446dd6456cd8456cd9466bdb476adc4869de4968df4a68e04c67e24d66e34e65e44f64e55064e75263e85362e95462ea5661eb5760ec5860ed5a5fee5b5eef5d5ef05f5ef1605df2625df2645cf3655cf4675cf4695cf56b5cf66c5cf66e5cf7705cf7725cf8745cf8765cf9785df9795df97b5dfa7d5efa7f5efa815ffb835ffb8560fb8761fc8961fc8a62fc8c63fc8e64fc9065fd9266fd9467fd9668fd9869fd9a6afd9b6bfe9d6cfe9f6dfea16efea36ffea571fea772fea973feaa74feac76feae77feb078feb27afeb47bfeb67cfeb77efeb97ffebb81febd82febf84fec185fec287fec488fec68afec88cfeca8dfecc8ffecd90fecf92fed194fed395fed597fed799fed89afdda9cfddc9efddea0fde0a1fde2a3fde3a5fde5a7fde7a9fde9aafdebacfcecaefceeb0fcf0b2fcf2b4fcf4b6fcf6b8fcf7b9fcf9bbfcfbbdfcfdbf"));
var inferno = ramp(colors_default("00000401000501010601010802010a02020c02020e03021004031204031405041706041907051b08051d09061f0a07220b07240c08260d08290e092b10092d110a30120a32140b34150b37160b39180c3c190c3e1b0c411c0c431e0c451f0c48210c4a230c4c240c4f260c51280b53290b552b0b572d0b592f0a5b310a5c320a5e340a5f3609613809623909633b09643d09653e0966400a67420a68440a68450a69470b6a490b6a4a0c6b4c0c6b4d0d6c4f0d6c510e6c520e6d540f6d550f6d57106e59106e5a116e5c126e5d126e5f136e61136e62146e64156e65156e67166e69166e6a176e6c186e6d186e6f196e71196e721a6e741a6e751b6e771c6d781c6d7a1d6d7c1d6d7d1e6d7f1e6c801f6c82206c84206b85216b87216b88226a8a226a8c23698d23698f24699025689225689326679526679727669827669a28659b29649d29649f2a63a02a63a22b62a32c61a52c60a62d60a82e5fa92e5eab2f5ead305dae305cb0315bb1325ab3325ab43359b63458b73557b93556ba3655bc3754bd3853bf3952c03a51c13a50c33b4fc43c4ec63d4dc73e4cc83f4bca404acb4149cc4248ce4347cf4446d04545d24644d34743d44842d54a41d74b3fd84c3ed94d3dda4e3cdb503bdd513ade5238df5337e05536e15635e25734e35933e45a31e55c30e65d2fe75e2ee8602de9612bea632aeb6429eb6628ec6726ed6925ee6a24ef6c23ef6e21f06f20f1711ff1731df2741cf3761bf37819f47918f57b17f57d15f67e14f68013f78212f78410f8850ff8870ef8890cf98b0bf98c0af98e09fa9008fa9207fa9407fb9606fb9706fb9906fb9b06fb9d07fc9f07fca108fca309fca50afca60cfca80dfcaa0ffcac11fcae12fcb014fcb216fcb418fbb61afbb81dfbba1ffbbc21fbbe23fac026fac228fac42afac62df9c72ff9c932f9cb35f8cd37f8cf3af7d13df7d340f6d543f6d746f5d949f5db4cf4dd4ff4df53f4e156f3e35af3e55df2e661f2e865f2ea69f1ec6df1ed71f1ef75f1f179f2f27df2f482f3f586f3f68af4f88ef5f992f6fa96f8fb9af9fc9dfafda1fcffa4"));
var plasma = ramp(colors_default("0d088710078813078916078a19068c1b068d1d068e20068f2206902406912605912805922a05932c05942e05952f059631059733059735049837049938049a3a049a3c049b3e049c3f049c41049d43039e44039e46039f48039f4903a04b03a14c02a14e02a25002a25102a35302a35502a45601a45801a45901a55b01a55c01a65e01a66001a66100a76300a76400a76600a76700a86900a86a00a86c00a86e00a86f00a87100a87201a87401a87501a87701a87801a87a02a87b02a87d03a87e03a88004a88104a78305a78405a78606a68707a68808a68a09a58b0aa58d0ba58e0ca48f0da4910ea3920fa39410a29511a19613a19814a099159f9a169f9c179e9d189d9e199da01a9ca11b9ba21d9aa31e9aa51f99a62098a72197a82296aa2395ab2494ac2694ad2793ae2892b02991b12a90b22b8fb32c8eb42e8db52f8cb6308bb7318ab83289ba3388bb3488bc3587bd3786be3885bf3984c03a83c13b82c23c81c33d80c43e7fc5407ec6417dc7427cc8437bc9447aca457acb4679cc4778cc4977cd4a76ce4b75cf4c74d04d73d14e72d24f71d35171d45270d5536fd5546ed6556dd7566cd8576bd9586ada5a6ada5b69db5c68dc5d67dd5e66de5f65de6164df6263e06363e16462e26561e26660e3685fe4695ee56a5de56b5de66c5ce76e5be76f5ae87059e97158e97257ea7457eb7556eb7655ec7754ed7953ed7a52ee7b51ef7c51ef7e50f07f4ff0804ef1814df1834cf2844bf3854bf3874af48849f48948f58b47f58c46f68d45f68f44f79044f79143f79342f89441f89540f9973ff9983ef99a3efa9b3dfa9c3cfa9e3bfb9f3afba139fba238fca338fca537fca636fca835fca934fdab33fdac33fdae32fdaf31fdb130fdb22ffdb42ffdb52efeb72dfeb82cfeba2cfebb2bfebd2afebe2afec029fdc229fdc328fdc527fdc627fdc827fdca26fdcb26fccd25fcce25fcd025fcd225fbd324fbd524fbd724fad824fada24f9dc24f9dd25f8df25f8e125f7e225f7e425f6e626f6e826f5e926f5eb27f4ed27f3ee27f3f027f2f227f1f426f1f525f0f724f0f921"));

//#endregion
//#region node_modules/d3-shape/src/constant.js
function constant_default$1(x$3) {
	return function constant$1() {
		return x$3;
	};
}

//#endregion
//#region node_modules/d3-shape/src/math.js
const abs = Math.abs;
const atan2 = Math.atan2;
const cos = Math.cos;
const max$1 = Math.max;
const min$1 = Math.min;
const sin = Math.sin;
const sqrt$1 = Math.sqrt;
const epsilon = 1e-12;
const pi = Math.PI;
const halfPi = pi / 2;
const tau = 2 * pi;
function acos(x$3) {
	return x$3 > 1 ? 0 : x$3 < -1 ? pi : Math.acos(x$3);
}
function asin(x$3) {
	return x$3 >= 1 ? halfPi : x$3 <= -1 ? -halfPi : Math.asin(x$3);
}

//#endregion
//#region node_modules/d3-shape/src/path.js
function withPath(shape) {
	let digits = 3;
	shape.digits = function(_) {
		if (!arguments.length) return digits;
		if (_ == null) digits = null;
		else {
			const d = Math.floor(_);
			if (!(d >= 0)) throw new RangeError(`invalid digits: ${_}`);
			digits = d;
		}
		return shape;
	};
	return () => new Path(digits);
}

//#endregion
//#region node_modules/d3-shape/src/arc.js
function arcInnerRadius(d) {
	return d.innerRadius;
}
function arcOuterRadius(d) {
	return d.outerRadius;
}
function arcStartAngle(d) {
	return d.startAngle;
}
function arcEndAngle(d) {
	return d.endAngle;
}
function arcPadAngle(d) {
	return d && d.padAngle;
}
function intersect(x0$5, y0$5, x1$1, y1$1, x2, y2, x3, y3) {
	var x10 = x1$1 - x0$5, y10 = y1$1 - y0$5, x32 = x3 - x2, y32 = y3 - y2, t = y32 * x10 - x32 * y10;
	if (t * t < epsilon) return;
	t = (x32 * (y0$5 - y2) - y32 * (x0$5 - x2)) / t;
	return [x0$5 + t * x10, y0$5 + t * y10];
}
function cornerTangents(x0$5, y0$5, x1$1, y1$1, r1, rc, cw) {
	var x01 = x0$5 - x1$1, y01 = y0$5 - y1$1, lo = (cw ? rc : -rc) / sqrt$1(x01 * x01 + y01 * y01), ox = lo * y01, oy = -lo * x01, x11 = x0$5 + ox, y11 = y0$5 + oy, x10 = x1$1 + ox, y10 = y1$1 + oy, x00$3 = (x11 + x10) / 2, y00$3 = (y11 + y10) / 2, dx = x10 - x11, dy = y10 - y11, d2 = dx * dx + dy * dy, r = r1 - rc, D$2 = x11 * y10 - x10 * y11, d = (dy < 0 ? -1 : 1) * sqrt$1(max$1(0, r * r * d2 - D$2 * D$2)), cx0 = (D$2 * dy - dx * d) / d2, cy0 = (-D$2 * dx - dy * d) / d2, cx1 = (D$2 * dy + dx * d) / d2, cy1 = (-D$2 * dx + dy * d) / d2, dx0 = cx0 - x00$3, dy0 = cy0 - y00$3, dx1 = cx1 - x00$3, dy1 = cy1 - y00$3;
	if (dx0 * dx0 + dy0 * dy0 > dx1 * dx1 + dy1 * dy1) cx0 = cx1, cy0 = cy1;
	return {
		cx: cx0,
		cy: cy0,
		x01: -ox,
		y01: -oy,
		x11: cx0 * (r1 / r - 1),
		y11: cy0 * (r1 / r - 1)
	};
}
function arc_default() {
	var innerRadius = arcInnerRadius, outerRadius = arcOuterRadius, cornerRadius = constant_default$1(0), padRadius = null, startAngle = arcStartAngle, endAngle = arcEndAngle, padAngle = arcPadAngle, context = null, path$1 = withPath(arc);
	function arc() {
		var buffer, r, r0 = +innerRadius.apply(this, arguments), r1 = +outerRadius.apply(this, arguments), a0 = startAngle.apply(this, arguments) - halfPi, a1 = endAngle.apply(this, arguments) - halfPi, da$1 = abs(a1 - a0), cw = a1 > a0;
		if (!context) context = buffer = path$1();
		if (r1 < r0) r = r1, r1 = r0, r0 = r;
		if (!(r1 > epsilon)) context.moveTo(0, 0);
		else if (da$1 > tau - epsilon) {
			context.moveTo(r1 * cos(a0), r1 * sin(a0));
			context.arc(0, 0, r1, a0, a1, !cw);
			if (r0 > epsilon) {
				context.moveTo(r0 * cos(a1), r0 * sin(a1));
				context.arc(0, 0, r0, a1, a0, cw);
			}
		} else {
			var a01 = a0, a11 = a1, a00 = a0, a10 = a1, da0 = da$1, da1 = da$1, ap = padAngle.apply(this, arguments) / 2, rp = ap > epsilon && (padRadius ? +padRadius.apply(this, arguments) : sqrt$1(r0 * r0 + r1 * r1)), rc = min$1(abs(r1 - r0) / 2, +cornerRadius.apply(this, arguments)), rc0 = rc, rc1 = rc, t0$2, t1$2;
			if (rp > epsilon) {
				var p0$1 = asin(rp / r0 * sin(ap)), p1 = asin(rp / r1 * sin(ap));
				if ((da0 -= p0$1 * 2) > epsilon) p0$1 *= cw ? 1 : -1, a00 += p0$1, a10 -= p0$1;
				else da0 = 0, a00 = a10 = (a0 + a1) / 2;
				if ((da1 -= p1 * 2) > epsilon) p1 *= cw ? 1 : -1, a01 += p1, a11 -= p1;
				else da1 = 0, a01 = a11 = (a0 + a1) / 2;
			}
			var x01 = r1 * cos(a01), y01 = r1 * sin(a01), x10 = r0 * cos(a10), y10 = r0 * sin(a10);
			if (rc > epsilon) {
				var x11 = r1 * cos(a11), y11 = r1 * sin(a11), x00$3 = r0 * cos(a00), y00$3 = r0 * sin(a00), oc;
				if (da$1 < pi) if (oc = intersect(x01, y01, x00$3, y00$3, x11, y11, x10, y10)) {
					var ax = x01 - oc[0], ay = y01 - oc[1], bx = x11 - oc[0], by = y11 - oc[1], kc = 1 / sin(acos((ax * bx + ay * by) / (sqrt$1(ax * ax + ay * ay) * sqrt$1(bx * bx + by * by))) / 2), lc = sqrt$1(oc[0] * oc[0] + oc[1] * oc[1]);
					rc0 = min$1(rc, (r0 - lc) / (kc - 1));
					rc1 = min$1(rc, (r1 - lc) / (kc + 1));
				} else rc0 = rc1 = 0;
			}
			if (!(da1 > epsilon)) context.moveTo(x01, y01);
			else if (rc1 > epsilon) {
				t0$2 = cornerTangents(x00$3, y00$3, x01, y01, r1, rc1, cw);
				t1$2 = cornerTangents(x11, y11, x10, y10, r1, rc1, cw);
				context.moveTo(t0$2.cx + t0$2.x01, t0$2.cy + t0$2.y01);
				if (rc1 < rc) context.arc(t0$2.cx, t0$2.cy, rc1, atan2(t0$2.y01, t0$2.x01), atan2(t1$2.y01, t1$2.x01), !cw);
				else {
					context.arc(t0$2.cx, t0$2.cy, rc1, atan2(t0$2.y01, t0$2.x01), atan2(t0$2.y11, t0$2.x11), !cw);
					context.arc(0, 0, r1, atan2(t0$2.cy + t0$2.y11, t0$2.cx + t0$2.x11), atan2(t1$2.cy + t1$2.y11, t1$2.cx + t1$2.x11), !cw);
					context.arc(t1$2.cx, t1$2.cy, rc1, atan2(t1$2.y11, t1$2.x11), atan2(t1$2.y01, t1$2.x01), !cw);
				}
			} else context.moveTo(x01, y01), context.arc(0, 0, r1, a01, a11, !cw);
			if (!(r0 > epsilon) || !(da0 > epsilon)) context.lineTo(x10, y10);
			else if (rc0 > epsilon) {
				t0$2 = cornerTangents(x10, y10, x11, y11, r0, -rc0, cw);
				t1$2 = cornerTangents(x01, y01, x00$3, y00$3, r0, -rc0, cw);
				context.lineTo(t0$2.cx + t0$2.x01, t0$2.cy + t0$2.y01);
				if (rc0 < rc) context.arc(t0$2.cx, t0$2.cy, rc0, atan2(t0$2.y01, t0$2.x01), atan2(t1$2.y01, t1$2.x01), !cw);
				else {
					context.arc(t0$2.cx, t0$2.cy, rc0, atan2(t0$2.y01, t0$2.x01), atan2(t0$2.y11, t0$2.x11), !cw);
					context.arc(0, 0, r0, atan2(t0$2.cy + t0$2.y11, t0$2.cx + t0$2.x11), atan2(t1$2.cy + t1$2.y11, t1$2.cx + t1$2.x11), cw);
					context.arc(t1$2.cx, t1$2.cy, rc0, atan2(t1$2.y11, t1$2.x11), atan2(t1$2.y01, t1$2.x01), !cw);
				}
			} else context.arc(0, 0, r0, a10, a00, cw);
		}
		context.closePath();
		if (buffer) return context = null, buffer + "" || null;
	}
	arc.centroid = function() {
		var r = (+innerRadius.apply(this, arguments) + +outerRadius.apply(this, arguments)) / 2, a$3 = (+startAngle.apply(this, arguments) + +endAngle.apply(this, arguments)) / 2 - pi / 2;
		return [cos(a$3) * r, sin(a$3) * r];
	};
	arc.innerRadius = function(_) {
		return arguments.length ? (innerRadius = typeof _ === "function" ? _ : constant_default$1(+_), arc) : innerRadius;
	};
	arc.outerRadius = function(_) {
		return arguments.length ? (outerRadius = typeof _ === "function" ? _ : constant_default$1(+_), arc) : outerRadius;
	};
	arc.cornerRadius = function(_) {
		return arguments.length ? (cornerRadius = typeof _ === "function" ? _ : constant_default$1(+_), arc) : cornerRadius;
	};
	arc.padRadius = function(_) {
		return arguments.length ? (padRadius = _ == null ? null : typeof _ === "function" ? _ : constant_default$1(+_), arc) : padRadius;
	};
	arc.startAngle = function(_) {
		return arguments.length ? (startAngle = typeof _ === "function" ? _ : constant_default$1(+_), arc) : startAngle;
	};
	arc.endAngle = function(_) {
		return arguments.length ? (endAngle = typeof _ === "function" ? _ : constant_default$1(+_), arc) : endAngle;
	};
	arc.padAngle = function(_) {
		return arguments.length ? (padAngle = typeof _ === "function" ? _ : constant_default$1(+_), arc) : padAngle;
	};
	arc.context = function(_) {
		return arguments.length ? (context = _ == null ? null : _, arc) : context;
	};
	return arc;
}

//#endregion
//#region node_modules/d3-shape/src/array.js
var slice = Array.prototype.slice;
function array_default$1(x$3) {
	return typeof x$3 === "object" && "length" in x$3 ? x$3 : Array.from(x$3);
}

//#endregion
//#region node_modules/d3-shape/src/curve/linear.js
function Linear(context) {
	this._context = context;
}
Linear.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._point = 0;
	},
	lineEnd: function() {
		if (this._line || this._line !== 0 && this._point === 1) this._context.closePath();
		this._line = 1 - this._line;
	},
	point: function(x$3, y$3) {
		x$3 = +x$3, y$3 = +y$3;
		switch (this._point) {
			case 0:
				this._point = 1;
				this._line ? this._context.lineTo(x$3, y$3) : this._context.moveTo(x$3, y$3);
				break;
			case 1: this._point = 2;
			default:
				this._context.lineTo(x$3, y$3);
				break;
		}
	}
};
function linear_default(context) {
	return new Linear(context);
}

//#endregion
//#region node_modules/d3-shape/src/point.js
function x(p) {
	return p[0];
}
function y(p) {
	return p[1];
}

//#endregion
//#region node_modules/d3-shape/src/line.js
function line_default(x$3, y$3) {
	var defined = constant_default$1(true), context = null, curve = linear_default, output = null, path$1 = withPath(line);
	x$3 = typeof x$3 === "function" ? x$3 : x$3 === void 0 ? x : constant_default$1(x$3);
	y$3 = typeof y$3 === "function" ? y$3 : y$3 === void 0 ? y : constant_default$1(y$3);
	function line(data) {
		var i, n = (data = array_default$1(data)).length, d, defined0 = false, buffer;
		if (context == null) output = curve(buffer = path$1());
		for (i = 0; i <= n; ++i) {
			if (!(i < n && defined(d = data[i], i, data)) === defined0) if (defined0 = !defined0) output.lineStart();
			else output.lineEnd();
			if (defined0) output.point(+x$3(d, i, data), +y$3(d, i, data));
		}
		if (buffer) return output = null, buffer + "" || null;
	}
	line.x = function(_) {
		return arguments.length ? (x$3 = typeof _ === "function" ? _ : constant_default$1(+_), line) : x$3;
	};
	line.y = function(_) {
		return arguments.length ? (y$3 = typeof _ === "function" ? _ : constant_default$1(+_), line) : y$3;
	};
	line.defined = function(_) {
		return arguments.length ? (defined = typeof _ === "function" ? _ : constant_default$1(!!_), line) : defined;
	};
	line.curve = function(_) {
		return arguments.length ? (curve = _, context != null && (output = curve(context)), line) : curve;
	};
	line.context = function(_) {
		return arguments.length ? (_ == null ? context = output = null : output = curve(context = _), line) : context;
	};
	return line;
}

//#endregion
//#region node_modules/d3-shape/src/area.js
function area_default(x0$5, y0$5, y1$1) {
	var x1$1 = null, defined = constant_default$1(true), context = null, curve = linear_default, output = null, path$1 = withPath(area);
	x0$5 = typeof x0$5 === "function" ? x0$5 : x0$5 === void 0 ? x : constant_default$1(+x0$5);
	y0$5 = typeof y0$5 === "function" ? y0$5 : y0$5 === void 0 ? constant_default$1(0) : constant_default$1(+y0$5);
	y1$1 = typeof y1$1 === "function" ? y1$1 : y1$1 === void 0 ? y : constant_default$1(+y1$1);
	function area(data) {
		var i, j, k$1, n = (data = array_default$1(data)).length, d, defined0 = false, buffer, x0z = new Array(n), y0z = new Array(n);
		if (context == null) output = curve(buffer = path$1());
		for (i = 0; i <= n; ++i) {
			if (!(i < n && defined(d = data[i], i, data)) === defined0) if (defined0 = !defined0) {
				j = i;
				output.areaStart();
				output.lineStart();
			} else {
				output.lineEnd();
				output.lineStart();
				for (k$1 = i - 1; k$1 >= j; --k$1) output.point(x0z[k$1], y0z[k$1]);
				output.lineEnd();
				output.areaEnd();
			}
			if (defined0) {
				x0z[i] = +x0$5(d, i, data), y0z[i] = +y0$5(d, i, data);
				output.point(x1$1 ? +x1$1(d, i, data) : x0z[i], y1$1 ? +y1$1(d, i, data) : y0z[i]);
			}
		}
		if (buffer) return output = null, buffer + "" || null;
	}
	function arealine() {
		return line_default().defined(defined).curve(curve).context(context);
	}
	area.x = function(_) {
		return arguments.length ? (x0$5 = typeof _ === "function" ? _ : constant_default$1(+_), x1$1 = null, area) : x0$5;
	};
	area.x0 = function(_) {
		return arguments.length ? (x0$5 = typeof _ === "function" ? _ : constant_default$1(+_), area) : x0$5;
	};
	area.x1 = function(_) {
		return arguments.length ? (x1$1 = _ == null ? null : typeof _ === "function" ? _ : constant_default$1(+_), area) : x1$1;
	};
	area.y = function(_) {
		return arguments.length ? (y0$5 = typeof _ === "function" ? _ : constant_default$1(+_), y1$1 = null, area) : y0$5;
	};
	area.y0 = function(_) {
		return arguments.length ? (y0$5 = typeof _ === "function" ? _ : constant_default$1(+_), area) : y0$5;
	};
	area.y1 = function(_) {
		return arguments.length ? (y1$1 = _ == null ? null : typeof _ === "function" ? _ : constant_default$1(+_), area) : y1$1;
	};
	area.lineX0 = area.lineY0 = function() {
		return arealine().x(x0$5).y(y0$5);
	};
	area.lineY1 = function() {
		return arealine().x(x0$5).y(y1$1);
	};
	area.lineX1 = function() {
		return arealine().x(x1$1).y(y0$5);
	};
	area.defined = function(_) {
		return arguments.length ? (defined = typeof _ === "function" ? _ : constant_default$1(!!_), area) : defined;
	};
	area.curve = function(_) {
		return arguments.length ? (curve = _, context != null && (output = curve(context)), area) : curve;
	};
	area.context = function(_) {
		return arguments.length ? (_ == null ? context = output = null : output = curve(context = _), area) : context;
	};
	return area;
}

//#endregion
//#region node_modules/d3-shape/src/descending.js
function descending_default$1(a$3, b) {
	return b < a$3 ? -1 : b > a$3 ? 1 : b >= a$3 ? 0 : NaN;
}

//#endregion
//#region node_modules/d3-shape/src/identity.js
function identity_default$1(d) {
	return d;
}

//#endregion
//#region node_modules/d3-shape/src/pie.js
function pie_default() {
	var value = identity_default$1, sortValues = descending_default$1, sort$1 = null, startAngle = constant_default$1(0), endAngle = constant_default$1(tau), padAngle = constant_default$1(0);
	function pie(data) {
		var i, n = (data = array_default$1(data)).length, j, k$1, sum$3 = 0, index$2 = new Array(n), arcs = new Array(n), a0 = +startAngle.apply(this, arguments), da$1 = Math.min(tau, Math.max(-tau, endAngle.apply(this, arguments) - a0)), a1, p = Math.min(Math.abs(da$1) / n, padAngle.apply(this, arguments)), pa = p * (da$1 < 0 ? -1 : 1), v$1;
		for (i = 0; i < n; ++i) if ((v$1 = arcs[index$2[i] = i] = +value(data[i], i, data)) > 0) sum$3 += v$1;
		if (sortValues != null) index$2.sort(function(i$1, j$1) {
			return sortValues(arcs[i$1], arcs[j$1]);
		});
		else if (sort$1 != null) index$2.sort(function(i$1, j$1) {
			return sort$1(data[i$1], data[j$1]);
		});
		for (i = 0, k$1 = sum$3 ? (da$1 - n * pa) / sum$3 : 0; i < n; ++i, a0 = a1) j = index$2[i], v$1 = arcs[j], a1 = a0 + (v$1 > 0 ? v$1 * k$1 : 0) + pa, arcs[j] = {
			data: data[j],
			index: i,
			value: v$1,
			startAngle: a0,
			endAngle: a1,
			padAngle: p
		};
		return arcs;
	}
	pie.value = function(_) {
		return arguments.length ? (value = typeof _ === "function" ? _ : constant_default$1(+_), pie) : value;
	};
	pie.sortValues = function(_) {
		return arguments.length ? (sortValues = _, sort$1 = null, pie) : sortValues;
	};
	pie.sort = function(_) {
		return arguments.length ? (sort$1 = _, sortValues = null, pie) : sort$1;
	};
	pie.startAngle = function(_) {
		return arguments.length ? (startAngle = typeof _ === "function" ? _ : constant_default$1(+_), pie) : startAngle;
	};
	pie.endAngle = function(_) {
		return arguments.length ? (endAngle = typeof _ === "function" ? _ : constant_default$1(+_), pie) : endAngle;
	};
	pie.padAngle = function(_) {
		return arguments.length ? (padAngle = typeof _ === "function" ? _ : constant_default$1(+_), pie) : padAngle;
	};
	return pie;
}

//#endregion
//#region node_modules/d3-shape/src/curve/radial.js
var curveRadialLinear = curveRadial(linear_default);
function Radial(curve) {
	this._curve = curve;
}
Radial.prototype = {
	areaStart: function() {
		this._curve.areaStart();
	},
	areaEnd: function() {
		this._curve.areaEnd();
	},
	lineStart: function() {
		this._curve.lineStart();
	},
	lineEnd: function() {
		this._curve.lineEnd();
	},
	point: function(a$3, r) {
		this._curve.point(r * Math.sin(a$3), r * -Math.cos(a$3));
	}
};
function curveRadial(curve) {
	function radial$1(context) {
		return new Radial(curve(context));
	}
	radial$1._curve = curve;
	return radial$1;
}

//#endregion
//#region node_modules/d3-shape/src/lineRadial.js
function lineRadial(l) {
	var c$5 = l.curve;
	l.angle = l.x, delete l.x;
	l.radius = l.y, delete l.y;
	l.curve = function(_) {
		return arguments.length ? c$5(curveRadial(_)) : c$5()._curve;
	};
	return l;
}
function lineRadial_default() {
	return lineRadial(line_default().curve(curveRadialLinear));
}

//#endregion
//#region node_modules/d3-shape/src/areaRadial.js
function areaRadial_default() {
	var a$3 = area_default().curve(curveRadialLinear), c$5 = a$3.curve, x0$5 = a$3.lineX0, x1$1 = a$3.lineX1, y0$5 = a$3.lineY0, y1$1 = a$3.lineY1;
	a$3.angle = a$3.x, delete a$3.x;
	a$3.startAngle = a$3.x0, delete a$3.x0;
	a$3.endAngle = a$3.x1, delete a$3.x1;
	a$3.radius = a$3.y, delete a$3.y;
	a$3.innerRadius = a$3.y0, delete a$3.y0;
	a$3.outerRadius = a$3.y1, delete a$3.y1;
	a$3.lineStartAngle = function() {
		return lineRadial(x0$5());
	}, delete a$3.lineX0;
	a$3.lineEndAngle = function() {
		return lineRadial(x1$1());
	}, delete a$3.lineX1;
	a$3.lineInnerRadius = function() {
		return lineRadial(y0$5());
	}, delete a$3.lineY0;
	a$3.lineOuterRadius = function() {
		return lineRadial(y1$1());
	}, delete a$3.lineY1;
	a$3.curve = function(_) {
		return arguments.length ? c$5(curveRadial(_)) : c$5()._curve;
	};
	return a$3;
}

//#endregion
//#region node_modules/d3-shape/src/pointRadial.js
function pointRadial_default(x$3, y$3) {
	return [(y$3 = +y$3) * Math.cos(x$3 -= Math.PI / 2), y$3 * Math.sin(x$3)];
}

//#endregion
//#region node_modules/d3-shape/src/curve/bump.js
var Bump = class {
	constructor(context, x$3) {
		this._context = context;
		this._x = x$3;
	}
	areaStart() {
		this._line = 0;
	}
	areaEnd() {
		this._line = NaN;
	}
	lineStart() {
		this._point = 0;
	}
	lineEnd() {
		if (this._line || this._line !== 0 && this._point === 1) this._context.closePath();
		this._line = 1 - this._line;
	}
	point(x$3, y$3) {
		x$3 = +x$3, y$3 = +y$3;
		switch (this._point) {
			case 0:
				this._point = 1;
				if (this._line) this._context.lineTo(x$3, y$3);
				else this._context.moveTo(x$3, y$3);
				break;
			case 1: this._point = 2;
			default:
				if (this._x) this._context.bezierCurveTo(this._x0 = (this._x0 + x$3) / 2, this._y0, this._x0, y$3, x$3, y$3);
				else this._context.bezierCurveTo(this._x0, this._y0 = (this._y0 + y$3) / 2, x$3, this._y0, x$3, y$3);
				break;
		}
		this._x0 = x$3, this._y0 = y$3;
	}
};
var BumpRadial = class {
	constructor(context) {
		this._context = context;
	}
	lineStart() {
		this._point = 0;
	}
	lineEnd() {}
	point(x$3, y$3) {
		x$3 = +x$3, y$3 = +y$3;
		if (this._point === 0) this._point = 1;
		else {
			const p0$1 = pointRadial_default(this._x0, this._y0);
			const p1 = pointRadial_default(this._x0, this._y0 = (this._y0 + y$3) / 2);
			const p2 = pointRadial_default(x$3, this._y0);
			const p3 = pointRadial_default(x$3, y$3);
			this._context.moveTo(...p0$1);
			this._context.bezierCurveTo(...p1, ...p2, ...p3);
		}
		this._x0 = x$3, this._y0 = y$3;
	}
};
function bumpX(context) {
	return new Bump(context, true);
}
function bumpY(context) {
	return new Bump(context, false);
}
function bumpRadial(context) {
	return new BumpRadial(context);
}

//#endregion
//#region node_modules/d3-shape/src/link.js
function linkSource(d) {
	return d.source;
}
function linkTarget(d) {
	return d.target;
}
function link(curve) {
	let source = linkSource, target = linkTarget, x$3 = x, y$3 = y, context = null, output = null, path$1 = withPath(link$2);
	function link$2() {
		let buffer;
		const argv = slice.call(arguments);
		const s$1 = source.apply(this, argv);
		const t = target.apply(this, argv);
		if (context == null) output = curve(buffer = path$1());
		output.lineStart();
		argv[0] = s$1, output.point(+x$3.apply(this, argv), +y$3.apply(this, argv));
		argv[0] = t, output.point(+x$3.apply(this, argv), +y$3.apply(this, argv));
		output.lineEnd();
		if (buffer) return output = null, buffer + "" || null;
	}
	link$2.source = function(_) {
		return arguments.length ? (source = _, link$2) : source;
	};
	link$2.target = function(_) {
		return arguments.length ? (target = _, link$2) : target;
	};
	link$2.x = function(_) {
		return arguments.length ? (x$3 = typeof _ === "function" ? _ : constant_default$1(+_), link$2) : x$3;
	};
	link$2.y = function(_) {
		return arguments.length ? (y$3 = typeof _ === "function" ? _ : constant_default$1(+_), link$2) : y$3;
	};
	link$2.context = function(_) {
		return arguments.length ? (_ == null ? context = output = null : output = curve(context = _), link$2) : context;
	};
	return link$2;
}
function linkHorizontal() {
	return link(bumpX);
}
function linkVertical() {
	return link(bumpY);
}
function linkRadial() {
	const l = link(bumpRadial);
	l.angle = l.x, delete l.x;
	l.radius = l.y, delete l.y;
	return l;
}

//#endregion
//#region node_modules/d3-shape/src/symbol/asterisk.js
var sqrt3$2 = sqrt$1(3);
var asterisk_default = { draw(context, size) {
	const r = sqrt$1(size + min$1(size / 28, .75)) * .59436;
	const t = r / 2;
	const u$3 = t * sqrt3$2;
	context.moveTo(0, r);
	context.lineTo(0, -r);
	context.moveTo(-u$3, -t);
	context.lineTo(u$3, t);
	context.moveTo(-u$3, t);
	context.lineTo(u$3, -t);
} };

//#endregion
//#region node_modules/d3-shape/src/symbol/circle.js
var circle_default$2 = { draw(context, size) {
	const r = sqrt$1(size / pi);
	context.moveTo(r, 0);
	context.arc(0, 0, r, 0, tau);
} };

//#endregion
//#region node_modules/d3-shape/src/symbol/cross.js
var cross_default = { draw(context, size) {
	const r = sqrt$1(size / 5) / 2;
	context.moveTo(-3 * r, -r);
	context.lineTo(-r, -r);
	context.lineTo(-r, -3 * r);
	context.lineTo(r, -3 * r);
	context.lineTo(r, -r);
	context.lineTo(3 * r, -r);
	context.lineTo(3 * r, r);
	context.lineTo(r, r);
	context.lineTo(r, 3 * r);
	context.lineTo(-r, 3 * r);
	context.lineTo(-r, r);
	context.lineTo(-3 * r, r);
	context.closePath();
} };

//#endregion
//#region node_modules/d3-shape/src/symbol/diamond.js
var tan30 = sqrt$1(1 / 3);
var tan30_2 = tan30 * 2;
var diamond_default = { draw(context, size) {
	const y$3 = sqrt$1(size / tan30_2);
	const x$3 = y$3 * tan30;
	context.moveTo(0, -y$3);
	context.lineTo(x$3, 0);
	context.lineTo(0, y$3);
	context.lineTo(-x$3, 0);
	context.closePath();
} };

//#endregion
//#region node_modules/d3-shape/src/symbol/diamond2.js
var diamond2_default = { draw(context, size) {
	const r = sqrt$1(size) * .62625;
	context.moveTo(0, -r);
	context.lineTo(r, 0);
	context.lineTo(0, r);
	context.lineTo(-r, 0);
	context.closePath();
} };

//#endregion
//#region node_modules/d3-shape/src/symbol/plus.js
var plus_default = { draw(context, size) {
	const r = sqrt$1(size - min$1(size / 7, 2)) * .87559;
	context.moveTo(-r, 0);
	context.lineTo(r, 0);
	context.moveTo(0, r);
	context.lineTo(0, -r);
} };

//#endregion
//#region node_modules/d3-shape/src/symbol/square.js
var square_default = { draw(context, size) {
	const w = sqrt$1(size);
	const x$3 = -w / 2;
	context.rect(x$3, x$3, w, w);
} };

//#endregion
//#region node_modules/d3-shape/src/symbol/square2.js
var square2_default = { draw(context, size) {
	const r = sqrt$1(size) * .4431;
	context.moveTo(r, r);
	context.lineTo(r, -r);
	context.lineTo(-r, -r);
	context.lineTo(-r, r);
	context.closePath();
} };

//#endregion
//#region node_modules/d3-shape/src/symbol/star.js
var ka = .8908130915292852;
var kr = sin(pi / 10) / sin(7 * pi / 10);
var kx = sin(tau / 10) * kr;
var ky = -cos(tau / 10) * kr;
var star_default = { draw(context, size) {
	const r = sqrt$1(size * ka);
	const x$3 = kx * r;
	const y$3 = ky * r;
	context.moveTo(0, -r);
	context.lineTo(x$3, y$3);
	for (let i = 1; i < 5; ++i) {
		const a$3 = tau * i / 5;
		const c$5 = cos(a$3);
		const s$1 = sin(a$3);
		context.lineTo(s$1 * r, -c$5 * r);
		context.lineTo(c$5 * x$3 - s$1 * y$3, s$1 * x$3 + c$5 * y$3);
	}
	context.closePath();
} };

//#endregion
//#region node_modules/d3-shape/src/symbol/triangle.js
var sqrt3$1 = sqrt$1(3);
var triangle_default = { draw(context, size) {
	const y$3 = -sqrt$1(size / (sqrt3$1 * 3));
	context.moveTo(0, y$3 * 2);
	context.lineTo(-sqrt3$1 * y$3, -y$3);
	context.lineTo(sqrt3$1 * y$3, -y$3);
	context.closePath();
} };

//#endregion
//#region node_modules/d3-shape/src/symbol/triangle2.js
var sqrt3 = sqrt$1(3);
var triangle2_default = { draw(context, size) {
	const s$1 = sqrt$1(size) * .6824;
	const t = s$1 / 2;
	const u$3 = s$1 * sqrt3 / 2;
	context.moveTo(0, -s$1);
	context.lineTo(u$3, t);
	context.lineTo(-u$3, t);
	context.closePath();
} };

//#endregion
//#region node_modules/d3-shape/src/symbol/wye.js
var c = -.5;
var s = sqrt$1(3) / 2;
var k = 1 / sqrt$1(12);
var a = (k / 2 + 1) * 3;
var wye_default = { draw(context, size) {
	const r = sqrt$1(size / a);
	const x0$5 = r / 2, y0$5 = r * k;
	const x1$1 = x0$5, y1$1 = r * k + r;
	const x2 = -x1$1, y2 = y1$1;
	context.moveTo(x0$5, y0$5);
	context.lineTo(x1$1, y1$1);
	context.lineTo(x2, y2);
	context.lineTo(c * x0$5 - s * y0$5, s * x0$5 + c * y0$5);
	context.lineTo(c * x1$1 - s * y1$1, s * x1$1 + c * y1$1);
	context.lineTo(c * x2 - s * y2, s * x2 + c * y2);
	context.lineTo(c * x0$5 + s * y0$5, c * y0$5 - s * x0$5);
	context.lineTo(c * x1$1 + s * y1$1, c * y1$1 - s * x1$1);
	context.lineTo(c * x2 + s * y2, c * y2 - s * x2);
	context.closePath();
} };

//#endregion
//#region node_modules/d3-shape/src/symbol/times.js
var times_default = { draw(context, size) {
	const r = sqrt$1(size - min$1(size / 6, 1.7)) * .6189;
	context.moveTo(-r, -r);
	context.lineTo(r, r);
	context.moveTo(-r, r);
	context.lineTo(r, -r);
} };

//#endregion
//#region node_modules/d3-shape/src/symbol.js
const symbolsFill = [
	circle_default$2,
	cross_default,
	diamond_default,
	square_default,
	star_default,
	triangle_default,
	wye_default
];
const symbolsStroke = [
	circle_default$2,
	plus_default,
	times_default,
	triangle2_default,
	asterisk_default,
	square2_default,
	diamond2_default
];
function Symbol$1(type$1, size) {
	let context = null, path$1 = withPath(symbol);
	type$1 = typeof type$1 === "function" ? type$1 : constant_default$1(type$1 || circle_default$2);
	size = typeof size === "function" ? size : constant_default$1(size === void 0 ? 64 : +size);
	function symbol() {
		let buffer;
		if (!context) context = buffer = path$1();
		type$1.apply(this, arguments).draw(context, +size.apply(this, arguments));
		if (buffer) return context = null, buffer + "" || null;
	}
	symbol.type = function(_) {
		return arguments.length ? (type$1 = typeof _ === "function" ? _ : constant_default$1(_), symbol) : type$1;
	};
	symbol.size = function(_) {
		return arguments.length ? (size = typeof _ === "function" ? _ : constant_default$1(+_), symbol) : size;
	};
	symbol.context = function(_) {
		return arguments.length ? (context = _ == null ? null : _, symbol) : context;
	};
	return symbol;
}

//#endregion
//#region node_modules/d3-shape/src/noop.js
function noop_default() {}

//#endregion
//#region node_modules/d3-shape/src/curve/basis.js
function point$4(that, x$3, y$3) {
	that._context.bezierCurveTo((2 * that._x0 + that._x1) / 3, (2 * that._y0 + that._y1) / 3, (that._x0 + 2 * that._x1) / 3, (that._y0 + 2 * that._y1) / 3, (that._x0 + 4 * that._x1 + x$3) / 6, (that._y0 + 4 * that._y1 + y$3) / 6);
}
function Basis(context) {
	this._context = context;
}
Basis.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._y0 = this._y1 = NaN;
		this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 3: point$4(this, this._x1, this._y1);
			case 2:
				this._context.lineTo(this._x1, this._y1);
				break;
		}
		if (this._line || this._line !== 0 && this._point === 1) this._context.closePath();
		this._line = 1 - this._line;
	},
	point: function(x$3, y$3) {
		x$3 = +x$3, y$3 = +y$3;
		switch (this._point) {
			case 0:
				this._point = 1;
				this._line ? this._context.lineTo(x$3, y$3) : this._context.moveTo(x$3, y$3);
				break;
			case 1:
				this._point = 2;
				break;
			case 2:
				this._point = 3;
				this._context.lineTo((5 * this._x0 + this._x1) / 6, (5 * this._y0 + this._y1) / 6);
			default:
				point$4(this, x$3, y$3);
				break;
		}
		this._x0 = this._x1, this._x1 = x$3;
		this._y0 = this._y1, this._y1 = y$3;
	}
};
function basis_default(context) {
	return new Basis(context);
}

//#endregion
//#region node_modules/d3-shape/src/curve/basisClosed.js
function BasisClosed(context) {
	this._context = context;
}
BasisClosed.prototype = {
	areaStart: noop_default,
	areaEnd: noop_default,
	lineStart: function() {
		this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = NaN;
		this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 1:
				this._context.moveTo(this._x2, this._y2);
				this._context.closePath();
				break;
			case 2:
				this._context.moveTo((this._x2 + 2 * this._x3) / 3, (this._y2 + 2 * this._y3) / 3);
				this._context.lineTo((this._x3 + 2 * this._x2) / 3, (this._y3 + 2 * this._y2) / 3);
				this._context.closePath();
				break;
			case 3:
				this.point(this._x2, this._y2);
				this.point(this._x3, this._y3);
				this.point(this._x4, this._y4);
				break;
		}
	},
	point: function(x$3, y$3) {
		x$3 = +x$3, y$3 = +y$3;
		switch (this._point) {
			case 0:
				this._point = 1;
				this._x2 = x$3, this._y2 = y$3;
				break;
			case 1:
				this._point = 2;
				this._x3 = x$3, this._y3 = y$3;
				break;
			case 2:
				this._point = 3;
				this._x4 = x$3, this._y4 = y$3;
				this._context.moveTo((this._x0 + 4 * this._x1 + x$3) / 6, (this._y0 + 4 * this._y1 + y$3) / 6);
				break;
			default:
				point$4(this, x$3, y$3);
				break;
		}
		this._x0 = this._x1, this._x1 = x$3;
		this._y0 = this._y1, this._y1 = y$3;
	}
};
function basisClosed_default(context) {
	return new BasisClosed(context);
}

//#endregion
//#region node_modules/d3-shape/src/curve/basisOpen.js
function BasisOpen(context) {
	this._context = context;
}
BasisOpen.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._y0 = this._y1 = NaN;
		this._point = 0;
	},
	lineEnd: function() {
		if (this._line || this._line !== 0 && this._point === 3) this._context.closePath();
		this._line = 1 - this._line;
	},
	point: function(x$3, y$3) {
		x$3 = +x$3, y$3 = +y$3;
		switch (this._point) {
			case 0:
				this._point = 1;
				break;
			case 1:
				this._point = 2;
				break;
			case 2:
				this._point = 3;
				var x0$5 = (this._x0 + 4 * this._x1 + x$3) / 6, y0$5 = (this._y0 + 4 * this._y1 + y$3) / 6;
				this._line ? this._context.lineTo(x0$5, y0$5) : this._context.moveTo(x0$5, y0$5);
				break;
			case 3: this._point = 4;
			default:
				point$4(this, x$3, y$3);
				break;
		}
		this._x0 = this._x1, this._x1 = x$3;
		this._y0 = this._y1, this._y1 = y$3;
	}
};
function basisOpen_default(context) {
	return new BasisOpen(context);
}

//#endregion
//#region node_modules/d3-shape/src/curve/bundle.js
function Bundle(context, beta) {
	this._basis = new Basis(context);
	this._beta = beta;
}
Bundle.prototype = {
	lineStart: function() {
		this._x = [];
		this._y = [];
		this._basis.lineStart();
	},
	lineEnd: function() {
		var x$3 = this._x, y$3 = this._y, j = x$3.length - 1;
		if (j > 0) {
			var x0$5 = x$3[0], y0$5 = y$3[0], dx = x$3[j] - x0$5, dy = y$3[j] - y0$5, i = -1, t;
			while (++i <= j) {
				t = i / j;
				this._basis.point(this._beta * x$3[i] + (1 - this._beta) * (x0$5 + t * dx), this._beta * y$3[i] + (1 - this._beta) * (y0$5 + t * dy));
			}
		}
		this._x = this._y = null;
		this._basis.lineEnd();
	},
	point: function(x$3, y$3) {
		this._x.push(+x$3);
		this._y.push(+y$3);
	}
};
var bundle_default = (function custom(beta) {
	function bundle(context) {
		return beta === 1 ? new Basis(context) : new Bundle(context, beta);
	}
	bundle.beta = function(beta$1) {
		return custom(+beta$1);
	};
	return bundle;
})(.85);

//#endregion
//#region node_modules/d3-shape/src/curve/cardinal.js
function point$3(that, x$3, y$3) {
	that._context.bezierCurveTo(that._x1 + that._k * (that._x2 - that._x0), that._y1 + that._k * (that._y2 - that._y0), that._x2 + that._k * (that._x1 - x$3), that._y2 + that._k * (that._y1 - y$3), that._x2, that._y2);
}
function Cardinal(context, tension) {
	this._context = context;
	this._k = (1 - tension) / 6;
}
Cardinal.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN;
		this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 2:
				this._context.lineTo(this._x2, this._y2);
				break;
			case 3:
				point$3(this, this._x1, this._y1);
				break;
		}
		if (this._line || this._line !== 0 && this._point === 1) this._context.closePath();
		this._line = 1 - this._line;
	},
	point: function(x$3, y$3) {
		x$3 = +x$3, y$3 = +y$3;
		switch (this._point) {
			case 0:
				this._point = 1;
				this._line ? this._context.lineTo(x$3, y$3) : this._context.moveTo(x$3, y$3);
				break;
			case 1:
				this._point = 2;
				this._x1 = x$3, this._y1 = y$3;
				break;
			case 2: this._point = 3;
			default:
				point$3(this, x$3, y$3);
				break;
		}
		this._x0 = this._x1, this._x1 = this._x2, this._x2 = x$3;
		this._y0 = this._y1, this._y1 = this._y2, this._y2 = y$3;
	}
};
var cardinal_default = (function custom(tension) {
	function cardinal(context) {
		return new Cardinal(context, tension);
	}
	cardinal.tension = function(tension$1) {
		return custom(+tension$1);
	};
	return cardinal;
})(0);

//#endregion
//#region node_modules/d3-shape/src/curve/cardinalClosed.js
function CardinalClosed(context, tension) {
	this._context = context;
	this._k = (1 - tension) / 6;
}
CardinalClosed.prototype = {
	areaStart: noop_default,
	areaEnd: noop_default,
	lineStart: function() {
		this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._x5 = this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = this._y5 = NaN;
		this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 1:
				this._context.moveTo(this._x3, this._y3);
				this._context.closePath();
				break;
			case 2:
				this._context.lineTo(this._x3, this._y3);
				this._context.closePath();
				break;
			case 3:
				this.point(this._x3, this._y3);
				this.point(this._x4, this._y4);
				this.point(this._x5, this._y5);
				break;
		}
	},
	point: function(x$3, y$3) {
		x$3 = +x$3, y$3 = +y$3;
		switch (this._point) {
			case 0:
				this._point = 1;
				this._x3 = x$3, this._y3 = y$3;
				break;
			case 1:
				this._point = 2;
				this._context.moveTo(this._x4 = x$3, this._y4 = y$3);
				break;
			case 2:
				this._point = 3;
				this._x5 = x$3, this._y5 = y$3;
				break;
			default:
				point$3(this, x$3, y$3);
				break;
		}
		this._x0 = this._x1, this._x1 = this._x2, this._x2 = x$3;
		this._y0 = this._y1, this._y1 = this._y2, this._y2 = y$3;
	}
};
var cardinalClosed_default = (function custom(tension) {
	function cardinal(context) {
		return new CardinalClosed(context, tension);
	}
	cardinal.tension = function(tension$1) {
		return custom(+tension$1);
	};
	return cardinal;
})(0);

//#endregion
//#region node_modules/d3-shape/src/curve/cardinalOpen.js
function CardinalOpen(context, tension) {
	this._context = context;
	this._k = (1 - tension) / 6;
}
CardinalOpen.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN;
		this._point = 0;
	},
	lineEnd: function() {
		if (this._line || this._line !== 0 && this._point === 3) this._context.closePath();
		this._line = 1 - this._line;
	},
	point: function(x$3, y$3) {
		x$3 = +x$3, y$3 = +y$3;
		switch (this._point) {
			case 0:
				this._point = 1;
				break;
			case 1:
				this._point = 2;
				break;
			case 2:
				this._point = 3;
				this._line ? this._context.lineTo(this._x2, this._y2) : this._context.moveTo(this._x2, this._y2);
				break;
			case 3: this._point = 4;
			default:
				point$3(this, x$3, y$3);
				break;
		}
		this._x0 = this._x1, this._x1 = this._x2, this._x2 = x$3;
		this._y0 = this._y1, this._y1 = this._y2, this._y2 = y$3;
	}
};
var cardinalOpen_default = (function custom(tension) {
	function cardinal(context) {
		return new CardinalOpen(context, tension);
	}
	cardinal.tension = function(tension$1) {
		return custom(+tension$1);
	};
	return cardinal;
})(0);

//#endregion
//#region node_modules/d3-shape/src/curve/catmullRom.js
function point$2(that, x$3, y$3) {
	var x1$1 = that._x1, y1$1 = that._y1, x2 = that._x2, y2 = that._y2;
	if (that._l01_a > epsilon) {
		var a$3 = 2 * that._l01_2a + 3 * that._l01_a * that._l12_a + that._l12_2a, n = 3 * that._l01_a * (that._l01_a + that._l12_a);
		x1$1 = (x1$1 * a$3 - that._x0 * that._l12_2a + that._x2 * that._l01_2a) / n;
		y1$1 = (y1$1 * a$3 - that._y0 * that._l12_2a + that._y2 * that._l01_2a) / n;
	}
	if (that._l23_a > epsilon) {
		var b = 2 * that._l23_2a + 3 * that._l23_a * that._l12_a + that._l12_2a, m$2 = 3 * that._l23_a * (that._l23_a + that._l12_a);
		x2 = (x2 * b + that._x1 * that._l23_2a - x$3 * that._l12_2a) / m$2;
		y2 = (y2 * b + that._y1 * that._l23_2a - y$3 * that._l12_2a) / m$2;
	}
	that._context.bezierCurveTo(x1$1, y1$1, x2, y2, that._x2, that._y2);
}
function CatmullRom(context, alpha) {
	this._context = context;
	this._alpha = alpha;
}
CatmullRom.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN;
		this._l01_a = this._l12_a = this._l23_a = this._l01_2a = this._l12_2a = this._l23_2a = this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 2:
				this._context.lineTo(this._x2, this._y2);
				break;
			case 3:
				this.point(this._x2, this._y2);
				break;
		}
		if (this._line || this._line !== 0 && this._point === 1) this._context.closePath();
		this._line = 1 - this._line;
	},
	point: function(x$3, y$3) {
		x$3 = +x$3, y$3 = +y$3;
		if (this._point) {
			var x23 = this._x2 - x$3, y23 = this._y2 - y$3;
			this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
		}
		switch (this._point) {
			case 0:
				this._point = 1;
				this._line ? this._context.lineTo(x$3, y$3) : this._context.moveTo(x$3, y$3);
				break;
			case 1:
				this._point = 2;
				break;
			case 2: this._point = 3;
			default:
				point$2(this, x$3, y$3);
				break;
		}
		this._l01_a = this._l12_a, this._l12_a = this._l23_a;
		this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
		this._x0 = this._x1, this._x1 = this._x2, this._x2 = x$3;
		this._y0 = this._y1, this._y1 = this._y2, this._y2 = y$3;
	}
};
var catmullRom_default = (function custom(alpha) {
	function catmullRom(context) {
		return alpha ? new CatmullRom(context, alpha) : new Cardinal(context, 0);
	}
	catmullRom.alpha = function(alpha$1) {
		return custom(+alpha$1);
	};
	return catmullRom;
})(.5);

//#endregion
//#region node_modules/d3-shape/src/curve/catmullRomClosed.js
function CatmullRomClosed(context, alpha) {
	this._context = context;
	this._alpha = alpha;
}
CatmullRomClosed.prototype = {
	areaStart: noop_default,
	areaEnd: noop_default,
	lineStart: function() {
		this._x0 = this._x1 = this._x2 = this._x3 = this._x4 = this._x5 = this._y0 = this._y1 = this._y2 = this._y3 = this._y4 = this._y5 = NaN;
		this._l01_a = this._l12_a = this._l23_a = this._l01_2a = this._l12_2a = this._l23_2a = this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 1:
				this._context.moveTo(this._x3, this._y3);
				this._context.closePath();
				break;
			case 2:
				this._context.lineTo(this._x3, this._y3);
				this._context.closePath();
				break;
			case 3:
				this.point(this._x3, this._y3);
				this.point(this._x4, this._y4);
				this.point(this._x5, this._y5);
				break;
		}
	},
	point: function(x$3, y$3) {
		x$3 = +x$3, y$3 = +y$3;
		if (this._point) {
			var x23 = this._x2 - x$3, y23 = this._y2 - y$3;
			this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
		}
		switch (this._point) {
			case 0:
				this._point = 1;
				this._x3 = x$3, this._y3 = y$3;
				break;
			case 1:
				this._point = 2;
				this._context.moveTo(this._x4 = x$3, this._y4 = y$3);
				break;
			case 2:
				this._point = 3;
				this._x5 = x$3, this._y5 = y$3;
				break;
			default:
				point$2(this, x$3, y$3);
				break;
		}
		this._l01_a = this._l12_a, this._l12_a = this._l23_a;
		this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
		this._x0 = this._x1, this._x1 = this._x2, this._x2 = x$3;
		this._y0 = this._y1, this._y1 = this._y2, this._y2 = y$3;
	}
};
var catmullRomClosed_default = (function custom(alpha) {
	function catmullRom(context) {
		return alpha ? new CatmullRomClosed(context, alpha) : new CardinalClosed(context, 0);
	}
	catmullRom.alpha = function(alpha$1) {
		return custom(+alpha$1);
	};
	return catmullRom;
})(.5);

//#endregion
//#region node_modules/d3-shape/src/curve/catmullRomOpen.js
function CatmullRomOpen(context, alpha) {
	this._context = context;
	this._alpha = alpha;
}
CatmullRomOpen.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._x2 = this._y0 = this._y1 = this._y2 = NaN;
		this._l01_a = this._l12_a = this._l23_a = this._l01_2a = this._l12_2a = this._l23_2a = this._point = 0;
	},
	lineEnd: function() {
		if (this._line || this._line !== 0 && this._point === 3) this._context.closePath();
		this._line = 1 - this._line;
	},
	point: function(x$3, y$3) {
		x$3 = +x$3, y$3 = +y$3;
		if (this._point) {
			var x23 = this._x2 - x$3, y23 = this._y2 - y$3;
			this._l23_a = Math.sqrt(this._l23_2a = Math.pow(x23 * x23 + y23 * y23, this._alpha));
		}
		switch (this._point) {
			case 0:
				this._point = 1;
				break;
			case 1:
				this._point = 2;
				break;
			case 2:
				this._point = 3;
				this._line ? this._context.lineTo(this._x2, this._y2) : this._context.moveTo(this._x2, this._y2);
				break;
			case 3: this._point = 4;
			default:
				point$2(this, x$3, y$3);
				break;
		}
		this._l01_a = this._l12_a, this._l12_a = this._l23_a;
		this._l01_2a = this._l12_2a, this._l12_2a = this._l23_2a;
		this._x0 = this._x1, this._x1 = this._x2, this._x2 = x$3;
		this._y0 = this._y1, this._y1 = this._y2, this._y2 = y$3;
	}
};
var catmullRomOpen_default = (function custom(alpha) {
	function catmullRom(context) {
		return alpha ? new CatmullRomOpen(context, alpha) : new CardinalOpen(context, 0);
	}
	catmullRom.alpha = function(alpha$1) {
		return custom(+alpha$1);
	};
	return catmullRom;
})(.5);

//#endregion
//#region node_modules/d3-shape/src/curve/linearClosed.js
function LinearClosed(context) {
	this._context = context;
}
LinearClosed.prototype = {
	areaStart: noop_default,
	areaEnd: noop_default,
	lineStart: function() {
		this._point = 0;
	},
	lineEnd: function() {
		if (this._point) this._context.closePath();
	},
	point: function(x$3, y$3) {
		x$3 = +x$3, y$3 = +y$3;
		if (this._point) this._context.lineTo(x$3, y$3);
		else this._point = 1, this._context.moveTo(x$3, y$3);
	}
};
function linearClosed_default(context) {
	return new LinearClosed(context);
}

//#endregion
//#region node_modules/d3-shape/src/curve/monotone.js
function sign(x$3) {
	return x$3 < 0 ? -1 : 1;
}
function slope3(that, x2, y2) {
	var h0 = that._x1 - that._x0, h1 = x2 - that._x1, s0 = (that._y1 - that._y0) / (h0 || h1 < 0 && -0), s1 = (y2 - that._y1) / (h1 || h0 < 0 && -0), p = (s0 * h1 + s1 * h0) / (h0 + h1);
	return (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), .5 * Math.abs(p)) || 0;
}
function slope2(that, t) {
	var h = that._x1 - that._x0;
	return h ? (3 * (that._y1 - that._y0) / h - t) / 2 : t;
}
function point$1(that, t0$2, t1$2) {
	var x0$5 = that._x0, y0$5 = that._y0, x1$1 = that._x1, y1$1 = that._y1, dx = (x1$1 - x0$5) / 3;
	that._context.bezierCurveTo(x0$5 + dx, y0$5 + dx * t0$2, x1$1 - dx, y1$1 - dx * t1$2, x1$1, y1$1);
}
function MonotoneX(context) {
	this._context = context;
}
MonotoneX.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x0 = this._x1 = this._y0 = this._y1 = this._t0 = NaN;
		this._point = 0;
	},
	lineEnd: function() {
		switch (this._point) {
			case 2:
				this._context.lineTo(this._x1, this._y1);
				break;
			case 3:
				point$1(this, this._t0, slope2(this, this._t0));
				break;
		}
		if (this._line || this._line !== 0 && this._point === 1) this._context.closePath();
		this._line = 1 - this._line;
	},
	point: function(x$3, y$3) {
		var t1$2 = NaN;
		x$3 = +x$3, y$3 = +y$3;
		if (x$3 === this._x1 && y$3 === this._y1) return;
		switch (this._point) {
			case 0:
				this._point = 1;
				this._line ? this._context.lineTo(x$3, y$3) : this._context.moveTo(x$3, y$3);
				break;
			case 1:
				this._point = 2;
				break;
			case 2:
				this._point = 3;
				point$1(this, slope2(this, t1$2 = slope3(this, x$3, y$3)), t1$2);
				break;
			default:
				point$1(this, this._t0, t1$2 = slope3(this, x$3, y$3));
				break;
		}
		this._x0 = this._x1, this._x1 = x$3;
		this._y0 = this._y1, this._y1 = y$3;
		this._t0 = t1$2;
	}
};
function MonotoneY(context) {
	this._context = new ReflectContext(context);
}
(MonotoneY.prototype = Object.create(MonotoneX.prototype)).point = function(x$3, y$3) {
	MonotoneX.prototype.point.call(this, y$3, x$3);
};
function ReflectContext(context) {
	this._context = context;
}
ReflectContext.prototype = {
	moveTo: function(x$3, y$3) {
		this._context.moveTo(y$3, x$3);
	},
	closePath: function() {
		this._context.closePath();
	},
	lineTo: function(x$3, y$3) {
		this._context.lineTo(y$3, x$3);
	},
	bezierCurveTo: function(x1$1, y1$1, x2, y2, x$3, y$3) {
		this._context.bezierCurveTo(y1$1, x1$1, y2, x2, y$3, x$3);
	}
};
function monotoneX(context) {
	return new MonotoneX(context);
}
function monotoneY(context) {
	return new MonotoneY(context);
}

//#endregion
//#region node_modules/d3-shape/src/curve/natural.js
function Natural(context) {
	this._context = context;
}
Natural.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x = [];
		this._y = [];
	},
	lineEnd: function() {
		var x$3 = this._x, y$3 = this._y, n = x$3.length;
		if (n) {
			this._line ? this._context.lineTo(x$3[0], y$3[0]) : this._context.moveTo(x$3[0], y$3[0]);
			if (n === 2) this._context.lineTo(x$3[1], y$3[1]);
			else {
				var px = controlPoints(x$3), py = controlPoints(y$3);
				for (var i0 = 0, i1 = 1; i1 < n; ++i0, ++i1) this._context.bezierCurveTo(px[0][i0], py[0][i0], px[1][i0], py[1][i0], x$3[i1], y$3[i1]);
			}
		}
		if (this._line || this._line !== 0 && n === 1) this._context.closePath();
		this._line = 1 - this._line;
		this._x = this._y = null;
	},
	point: function(x$3, y$3) {
		this._x.push(+x$3);
		this._y.push(+y$3);
	}
};
function controlPoints(x$3) {
	var i, n = x$3.length - 1, m$2, a$3 = new Array(n), b = new Array(n), r = new Array(n);
	a$3[0] = 0, b[0] = 2, r[0] = x$3[0] + 2 * x$3[1];
	for (i = 1; i < n - 1; ++i) a$3[i] = 1, b[i] = 4, r[i] = 4 * x$3[i] + 2 * x$3[i + 1];
	a$3[n - 1] = 2, b[n - 1] = 7, r[n - 1] = 8 * x$3[n - 1] + x$3[n];
	for (i = 1; i < n; ++i) m$2 = a$3[i] / b[i - 1], b[i] -= m$2, r[i] -= m$2 * r[i - 1];
	a$3[n - 1] = r[n - 1] / b[n - 1];
	for (i = n - 2; i >= 0; --i) a$3[i] = (r[i] - a$3[i + 1]) / b[i];
	b[n - 1] = (x$3[n] + a$3[n - 1]) / 2;
	for (i = 0; i < n - 1; ++i) b[i] = 2 * x$3[i + 1] - a$3[i + 1];
	return [a$3, b];
}
function natural_default(context) {
	return new Natural(context);
}

//#endregion
//#region node_modules/d3-shape/src/curve/step.js
function Step(context, t) {
	this._context = context;
	this._t = t;
}
Step.prototype = {
	areaStart: function() {
		this._line = 0;
	},
	areaEnd: function() {
		this._line = NaN;
	},
	lineStart: function() {
		this._x = this._y = NaN;
		this._point = 0;
	},
	lineEnd: function() {
		if (0 < this._t && this._t < 1 && this._point === 2) this._context.lineTo(this._x, this._y);
		if (this._line || this._line !== 0 && this._point === 1) this._context.closePath();
		if (this._line >= 0) this._t = 1 - this._t, this._line = 1 - this._line;
	},
	point: function(x$3, y$3) {
		x$3 = +x$3, y$3 = +y$3;
		switch (this._point) {
			case 0:
				this._point = 1;
				this._line ? this._context.lineTo(x$3, y$3) : this._context.moveTo(x$3, y$3);
				break;
			case 1: this._point = 2;
			default:
				if (this._t <= 0) {
					this._context.lineTo(this._x, y$3);
					this._context.lineTo(x$3, y$3);
				} else {
					var x1$1 = this._x * (1 - this._t) + x$3 * this._t;
					this._context.lineTo(x1$1, this._y);
					this._context.lineTo(x1$1, y$3);
				}
				break;
		}
		this._x = x$3, this._y = y$3;
	}
};
function step_default(context) {
	return new Step(context, .5);
}
function stepBefore(context) {
	return new Step(context, 0);
}
function stepAfter(context) {
	return new Step(context, 1);
}

//#endregion
//#region node_modules/d3-shape/src/offset/none.js
function none_default(series, order) {
	if (!((n = series.length) > 1)) return;
	for (var i = 1, j, s0, s1 = series[order[0]], n, m$2 = s1.length; i < n; ++i) {
		s0 = s1, s1 = series[order[i]];
		for (j = 0; j < m$2; ++j) s1[j][1] += s1[j][0] = isNaN(s0[j][1]) ? s0[j][0] : s0[j][1];
	}
}

//#endregion
//#region node_modules/d3-shape/src/order/none.js
function none_default$1(series) {
	var n = series.length, o = new Array(n);
	while (--n >= 0) o[n] = n;
	return o;
}

//#endregion
//#region node_modules/d3-shape/src/stack.js
function stackValue(d, key) {
	return d[key];
}
function stackSeries(key) {
	const series = [];
	series.key = key;
	return series;
}
function stack_default() {
	var keys = constant_default$1([]), order = none_default$1, offset = none_default, value = stackValue;
	function stack(data) {
		var sz = Array.from(keys.apply(this, arguments), stackSeries), i, n = sz.length, j = -1, oz;
		for (const d of data) for (i = 0, ++j; i < n; ++i) (sz[i][j] = [0, +value(d, sz[i].key, j, data)]).data = d;
		for (i = 0, oz = array_default$1(order(sz)); i < n; ++i) sz[oz[i]].index = i;
		offset(sz, oz);
		return sz;
	}
	stack.keys = function(_) {
		return arguments.length ? (keys = typeof _ === "function" ? _ : constant_default$1(Array.from(_)), stack) : keys;
	};
	stack.value = function(_) {
		return arguments.length ? (value = typeof _ === "function" ? _ : constant_default$1(+_), stack) : value;
	};
	stack.order = function(_) {
		return arguments.length ? (order = _ == null ? none_default$1 : typeof _ === "function" ? _ : constant_default$1(Array.from(_)), stack) : order;
	};
	stack.offset = function(_) {
		return arguments.length ? (offset = _ == null ? none_default : _, stack) : offset;
	};
	return stack;
}

//#endregion
//#region node_modules/d3-shape/src/offset/expand.js
function expand_default(series, order) {
	if (!((n = series.length) > 0)) return;
	for (var i, n, j = 0, m$2 = series[0].length, y$3; j < m$2; ++j) {
		for (y$3 = i = 0; i < n; ++i) y$3 += series[i][j][1] || 0;
		if (y$3) for (i = 0; i < n; ++i) series[i][j][1] /= y$3;
	}
	none_default(series, order);
}

//#endregion
//#region node_modules/d3-shape/src/offset/diverging.js
function diverging_default(series, order) {
	if (!((n = series.length) > 0)) return;
	for (var i, j = 0, d, dy, yp, yn, n, m$2 = series[order[0]].length; j < m$2; ++j) for (yp = yn = 0, i = 0; i < n; ++i) if ((dy = (d = series[order[i]][j])[1] - d[0]) > 0) d[0] = yp, d[1] = yp += dy;
	else if (dy < 0) d[1] = yn, d[0] = yn += dy;
	else d[0] = 0, d[1] = dy;
}

//#endregion
//#region node_modules/d3-shape/src/offset/silhouette.js
function silhouette_default(series, order) {
	if (!((n = series.length) > 0)) return;
	for (var j = 0, s0 = series[order[0]], n, m$2 = s0.length; j < m$2; ++j) {
		for (var i = 0, y$3 = 0; i < n; ++i) y$3 += series[i][j][1] || 0;
		s0[j][1] += s0[j][0] = -y$3 / 2;
	}
	none_default(series, order);
}

//#endregion
//#region node_modules/d3-shape/src/offset/wiggle.js
function wiggle_default(series, order) {
	if (!((n = series.length) > 0) || !((m$2 = (s0 = series[order[0]]).length) > 0)) return;
	for (var y$3 = 0, j = 1, s0, m$2, n; j < m$2; ++j) {
		for (var i = 0, s1 = 0, s2 = 0; i < n; ++i) {
			var si = series[order[i]], sij0 = si[j][1] || 0, sij1 = si[j - 1][1] || 0, s3 = (sij0 - sij1) / 2;
			for (var k$1 = 0; k$1 < i; ++k$1) {
				var sk = series[order[k$1]], skj0 = sk[j][1] || 0, skj1 = sk[j - 1][1] || 0;
				s3 += skj0 - skj1;
			}
			s1 += sij0, s2 += s3 * sij0;
		}
		s0[j - 1][1] += s0[j - 1][0] = y$3;
		if (s1) y$3 -= s2 / s1;
	}
	s0[j - 1][1] += s0[j - 1][0] = y$3;
	none_default(series, order);
}

//#endregion
//#region node_modules/d3-shape/src/order/appearance.js
function appearance_default(series) {
	var peaks = series.map(peak);
	return none_default$1(series).sort(function(a$3, b) {
		return peaks[a$3] - peaks[b];
	});
}
function peak(series) {
	var i = -1, j = 0, n = series.length, vi, vj = -Infinity;
	while (++i < n) if ((vi = +series[i][1]) > vj) vj = vi, j = i;
	return j;
}

//#endregion
//#region node_modules/d3-shape/src/order/ascending.js
function ascending_default(series) {
	var sums = series.map(sum$1);
	return none_default$1(series).sort(function(a$3, b) {
		return sums[a$3] - sums[b];
	});
}
function sum$1(series) {
	var s$1 = 0, i = -1, n = series.length, v$1;
	while (++i < n) if (v$1 = +series[i][1]) s$1 += v$1;
	return s$1;
}

//#endregion
//#region node_modules/d3-shape/src/order/descending.js
function descending_default(series) {
	return ascending_default(series).reverse();
}

//#endregion
//#region node_modules/d3-shape/src/order/insideOut.js
function insideOut_default(series) {
	var n = series.length, i, j, sums = series.map(sum$1), order = appearance_default(series), top$1 = 0, bottom$1 = 0, tops = [], bottoms = [];
	for (i = 0; i < n; ++i) {
		j = order[i];
		if (top$1 < bottom$1) {
			top$1 += sums[j];
			tops.push(j);
		} else {
			bottom$1 += sums[j];
			bottoms.push(j);
		}
	}
	return bottoms.reverse().concat(tops);
}

//#endregion
//#region node_modules/d3-shape/src/order/reverse.js
function reverse_default(series) {
	return none_default$1(series).reverse();
}

//#endregion
//#region node_modules/d3-zoom/src/constant.js
var constant_default = (x$3) => () => x$3;

//#endregion
//#region node_modules/d3-zoom/src/event.js
function ZoomEvent(type$1, { sourceEvent, target, transform: transform$1, dispatch: dispatch$1 }) {
	Object.defineProperties(this, {
		type: {
			value: type$1,
			enumerable: true,
			configurable: true
		},
		sourceEvent: {
			value: sourceEvent,
			enumerable: true,
			configurable: true
		},
		target: {
			value: target,
			enumerable: true,
			configurable: true
		},
		transform: {
			value: transform$1,
			enumerable: true,
			configurable: true
		},
		_: { value: dispatch$1 }
	});
}

//#endregion
//#region node_modules/d3-zoom/src/transform.js
function Transform(k$1, x$3, y$3) {
	this.k = k$1;
	this.x = x$3;
	this.y = y$3;
}
Transform.prototype = {
	constructor: Transform,
	scale: function(k$1) {
		return k$1 === 1 ? this : new Transform(this.k * k$1, this.x, this.y);
	},
	translate: function(x$3, y$3) {
		return x$3 === 0 & y$3 === 0 ? this : new Transform(this.k, this.x + this.k * x$3, this.y + this.k * y$3);
	},
	apply: function(point$5) {
		return [point$5[0] * this.k + this.x, point$5[1] * this.k + this.y];
	},
	applyX: function(x$3) {
		return x$3 * this.k + this.x;
	},
	applyY: function(y$3) {
		return y$3 * this.k + this.y;
	},
	invert: function(location) {
		return [(location[0] - this.x) / this.k, (location[1] - this.y) / this.k];
	},
	invertX: function(x$3) {
		return (x$3 - this.x) / this.k;
	},
	invertY: function(y$3) {
		return (y$3 - this.y) / this.k;
	},
	rescaleX: function(x$3) {
		return x$3.copy().domain(x$3.range().map(this.invertX, this).map(x$3.invert, x$3));
	},
	rescaleY: function(y$3) {
		return y$3.copy().domain(y$3.range().map(this.invertY, this).map(y$3.invert, y$3));
	},
	toString: function() {
		return "translate(" + this.x + "," + this.y + ") scale(" + this.k + ")";
	}
};
var identity$1 = new Transform(1, 0, 0);
transform.prototype = Transform.prototype;
function transform(node) {
	while (!node.__zoom) if (!(node = node.parentNode)) return identity$1;
	return node.__zoom;
}

//#endregion
//#region node_modules/d3-zoom/src/noevent.js
function nopropagation(event) {
	event.stopImmediatePropagation();
}
function noevent_default(event) {
	event.preventDefault();
	event.stopImmediatePropagation();
}

//#endregion
//#region node_modules/d3-zoom/src/zoom.js
function defaultFilter(event) {
	return (!event.ctrlKey || event.type === "wheel") && !event.button;
}
function defaultExtent() {
	var e = this;
	if (e instanceof SVGElement) {
		e = e.ownerSVGElement || e;
		if (e.hasAttribute("viewBox")) {
			e = e.viewBox.baseVal;
			return [[e.x, e.y], [e.x + e.width, e.y + e.height]];
		}
		return [[0, 0], [e.width.baseVal.value, e.height.baseVal.value]];
	}
	return [[0, 0], [e.clientWidth, e.clientHeight]];
}
function defaultTransform() {
	return this.__zoom || identity$1;
}
function defaultWheelDelta(event) {
	return -event.deltaY * (event.deltaMode === 1 ? .05 : event.deltaMode ? 1 : .002) * (event.ctrlKey ? 10 : 1);
}
function defaultTouchable() {
	return navigator.maxTouchPoints || "ontouchstart" in this;
}
function defaultConstrain(transform$1, extent$1, translateExtent) {
	var dx0 = transform$1.invertX(extent$1[0][0]) - translateExtent[0][0], dx1 = transform$1.invertX(extent$1[1][0]) - translateExtent[1][0], dy0 = transform$1.invertY(extent$1[0][1]) - translateExtent[0][1], dy1 = transform$1.invertY(extent$1[1][1]) - translateExtent[1][1];
	return transform$1.translate(dx1 > dx0 ? (dx0 + dx1) / 2 : Math.min(0, dx0) || Math.max(0, dx1), dy1 > dy0 ? (dy0 + dy1) / 2 : Math.min(0, dy0) || Math.max(0, dy1));
}
function zoom_default$1() {
	var filter$2 = defaultFilter, extent$1 = defaultExtent, constrain = defaultConstrain, wheelDelta = defaultWheelDelta, touchable = defaultTouchable, scaleExtent = [0, Infinity], translateExtent = [[-Infinity, -Infinity], [Infinity, Infinity]], duration = 250, interpolate = zoom_default, listeners = dispatch_default("start", "zoom", "end"), touchstarting, touchfirst, touchending, touchDelay = 500, wheelDelay = 150, clickDistance2 = 0, tapDistance = 10;
	function zoom(selection$1) {
		selection$1.property("__zoom", defaultTransform).on("wheel.zoom", wheeled, { passive: false }).on("mousedown.zoom", mousedowned).on("dblclick.zoom", dblclicked).filter(touchable).on("touchstart.zoom", touchstarted).on("touchmove.zoom", touchmoved).on("touchend.zoom touchcancel.zoom", touchended).style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
	}
	zoom.transform = function(collection, transform$1, point$5, event) {
		var selection$1 = collection.selection ? collection.selection() : collection;
		selection$1.property("__zoom", defaultTransform);
		if (collection !== selection$1) schedule(collection, transform$1, point$5, event);
		else selection$1.interrupt().each(function() {
			gesture(this, arguments).event(event).start().zoom(null, typeof transform$1 === "function" ? transform$1.apply(this, arguments) : transform$1).end();
		});
	};
	zoom.scaleBy = function(selection$1, k$1, p, event) {
		zoom.scaleTo(selection$1, function() {
			var k0 = this.__zoom.k, k1 = typeof k$1 === "function" ? k$1.apply(this, arguments) : k$1;
			return k0 * k1;
		}, p, event);
	};
	zoom.scaleTo = function(selection$1, k$1, p, event) {
		zoom.transform(selection$1, function() {
			var e = extent$1.apply(this, arguments), t0$2 = this.__zoom, p0$1 = p == null ? centroid(e) : typeof p === "function" ? p.apply(this, arguments) : p, p1 = t0$2.invert(p0$1), k1 = typeof k$1 === "function" ? k$1.apply(this, arguments) : k$1;
			return constrain(translate(scale$1(t0$2, k1), p0$1, p1), e, translateExtent);
		}, p, event);
	};
	zoom.translateBy = function(selection$1, x$3, y$3, event) {
		zoom.transform(selection$1, function() {
			return constrain(this.__zoom.translate(typeof x$3 === "function" ? x$3.apply(this, arguments) : x$3, typeof y$3 === "function" ? y$3.apply(this, arguments) : y$3), extent$1.apply(this, arguments), translateExtent);
		}, null, event);
	};
	zoom.translateTo = function(selection$1, x$3, y$3, p, event) {
		zoom.transform(selection$1, function() {
			var e = extent$1.apply(this, arguments), t = this.__zoom, p0$1 = p == null ? centroid(e) : typeof p === "function" ? p.apply(this, arguments) : p;
			return constrain(identity$1.translate(p0$1[0], p0$1[1]).scale(t.k).translate(typeof x$3 === "function" ? -x$3.apply(this, arguments) : -x$3, typeof y$3 === "function" ? -y$3.apply(this, arguments) : -y$3), e, translateExtent);
		}, p, event);
	};
	function scale$1(transform$1, k$1) {
		k$1 = Math.max(scaleExtent[0], Math.min(scaleExtent[1], k$1));
		return k$1 === transform$1.k ? transform$1 : new Transform(k$1, transform$1.x, transform$1.y);
	}
	function translate(transform$1, p0$1, p1) {
		var x$3 = p0$1[0] - p1[0] * transform$1.k, y$3 = p0$1[1] - p1[1] * transform$1.k;
		return x$3 === transform$1.x && y$3 === transform$1.y ? transform$1 : new Transform(transform$1.k, x$3, y$3);
	}
	function centroid(extent$2) {
		return [(+extent$2[0][0] + +extent$2[1][0]) / 2, (+extent$2[0][1] + +extent$2[1][1]) / 2];
	}
	function schedule(transition$1, transform$1, point$5, event) {
		transition$1.on("start.zoom", function() {
			gesture(this, arguments).event(event).start();
		}).on("interrupt.zoom end.zoom", function() {
			gesture(this, arguments).event(event).end();
		}).tween("zoom", function() {
			var that = this, args = arguments, g = gesture(that, args).event(event), e = extent$1.apply(that, args), p = point$5 == null ? centroid(e) : typeof point$5 === "function" ? point$5.apply(that, args) : point$5, w = Math.max(e[1][0] - e[0][0], e[1][1] - e[0][1]), a$3 = that.__zoom, b = typeof transform$1 === "function" ? transform$1.apply(that, args) : transform$1, i = interpolate(a$3.invert(p).concat(w / a$3.k), b.invert(p).concat(w / b.k));
			return function(t) {
				if (t === 1) t = b;
				else {
					var l = i(t), k$1 = w / l[2];
					t = new Transform(k$1, p[0] - l[0] * k$1, p[1] - l[1] * k$1);
				}
				g.zoom(null, t);
			};
		});
	}
	function gesture(that, args, clean) {
		return !clean && that.__zooming || new Gesture(that, args);
	}
	function Gesture(that, args) {
		this.that = that;
		this.args = args;
		this.active = 0;
		this.sourceEvent = null;
		this.extent = extent$1.apply(that, args);
		this.taps = 0;
	}
	Gesture.prototype = {
		event: function(event) {
			if (event) this.sourceEvent = event;
			return this;
		},
		start: function() {
			if (++this.active === 1) {
				this.that.__zooming = this;
				this.emit("start");
			}
			return this;
		},
		zoom: function(key, transform$1) {
			if (this.mouse && key !== "mouse") this.mouse[1] = transform$1.invert(this.mouse[0]);
			if (this.touch0 && key !== "touch") this.touch0[1] = transform$1.invert(this.touch0[0]);
			if (this.touch1 && key !== "touch") this.touch1[1] = transform$1.invert(this.touch1[0]);
			this.that.__zoom = transform$1;
			this.emit("zoom");
			return this;
		},
		end: function() {
			if (--this.active === 0) {
				delete this.that.__zooming;
				this.emit("end");
			}
			return this;
		},
		emit: function(type$1) {
			var d = select_default(this.that).datum();
			listeners.call(type$1, this.that, new ZoomEvent(type$1, {
				sourceEvent: this.sourceEvent,
				target: zoom,
				type: type$1,
				transform: this.that.__zoom,
				dispatch: listeners
			}), d);
		}
	};
	function wheeled(event, ...args) {
		if (!filter$2.apply(this, arguments)) return;
		var g = gesture(this, args).event(event), t = this.__zoom, k$1 = Math.max(scaleExtent[0], Math.min(scaleExtent[1], t.k * Math.pow(2, wheelDelta.apply(this, arguments)))), p = pointer_default(event);
		if (g.wheel) {
			if (g.mouse[0][0] !== p[0] || g.mouse[0][1] !== p[1]) g.mouse[1] = t.invert(g.mouse[0] = p);
			clearTimeout(g.wheel);
		} else if (t.k === k$1) return;
		else {
			g.mouse = [p, t.invert(p)];
			interrupt_default(this);
			g.start();
		}
		noevent_default(event);
		g.wheel = setTimeout(wheelidled, wheelDelay);
		g.zoom("mouse", constrain(translate(scale$1(t, k$1), g.mouse[0], g.mouse[1]), g.extent, translateExtent));
		function wheelidled() {
			g.wheel = null;
			g.end();
		}
	}
	function mousedowned(event, ...args) {
		if (touchending || !filter$2.apply(this, arguments)) return;
		var currentTarget = event.currentTarget, g = gesture(this, args, true).event(event), v$1 = select_default(event.view).on("mousemove.zoom", mousemoved, true).on("mouseup.zoom", mouseupped, true), p = pointer_default(event, currentTarget), x0$5 = event.clientX, y0$5 = event.clientY;
		nodrag_default(event.view);
		nopropagation(event);
		g.mouse = [p, this.__zoom.invert(p)];
		interrupt_default(this);
		g.start();
		function mousemoved(event$1) {
			noevent_default(event$1);
			if (!g.moved) {
				var dx = event$1.clientX - x0$5, dy = event$1.clientY - y0$5;
				g.moved = dx * dx + dy * dy > clickDistance2;
			}
			g.event(event$1).zoom("mouse", constrain(translate(g.that.__zoom, g.mouse[0] = pointer_default(event$1, currentTarget), g.mouse[1]), g.extent, translateExtent));
		}
		function mouseupped(event$1) {
			v$1.on("mousemove.zoom mouseup.zoom", null);
			yesdrag(event$1.view, g.moved);
			noevent_default(event$1);
			g.event(event$1).end();
		}
	}
	function dblclicked(event, ...args) {
		if (!filter$2.apply(this, arguments)) return;
		var t0$2 = this.__zoom, p0$1 = pointer_default(event.changedTouches ? event.changedTouches[0] : event, this), p1 = t0$2.invert(p0$1), k1 = t0$2.k * (event.shiftKey ? .5 : 2), t1$2 = constrain(translate(scale$1(t0$2, k1), p0$1, p1), extent$1.apply(this, args), translateExtent);
		noevent_default(event);
		if (duration > 0) select_default(this).transition().duration(duration).call(schedule, t1$2, p0$1, event);
		else select_default(this).call(zoom.transform, t1$2, p0$1, event);
	}
	function touchstarted(event, ...args) {
		if (!filter$2.apply(this, arguments)) return;
		var touches = event.touches, n = touches.length, g = gesture(this, args, event.changedTouches.length === n).event(event), started, i, t, p;
		nopropagation(event);
		for (i = 0; i < n; ++i) {
			t = touches[i], p = pointer_default(t, this);
			p = [
				p,
				this.__zoom.invert(p),
				t.identifier
			];
			if (!g.touch0) g.touch0 = p, started = true, g.taps = 1 + !!touchstarting;
			else if (!g.touch1 && g.touch0[2] !== p[2]) g.touch1 = p, g.taps = 0;
		}
		if (touchstarting) touchstarting = clearTimeout(touchstarting);
		if (started) {
			if (g.taps < 2) touchfirst = p[0], touchstarting = setTimeout(function() {
				touchstarting = null;
			}, touchDelay);
			interrupt_default(this);
			g.start();
		}
	}
	function touchmoved(event, ...args) {
		if (!this.__zooming) return;
		var g = gesture(this, args).event(event), touches = event.changedTouches, n = touches.length, i, t, p, l;
		noevent_default(event);
		for (i = 0; i < n; ++i) {
			t = touches[i], p = pointer_default(t, this);
			if (g.touch0 && g.touch0[2] === t.identifier) g.touch0[0] = p;
			else if (g.touch1 && g.touch1[2] === t.identifier) g.touch1[0] = p;
		}
		t = g.that.__zoom;
		if (g.touch1) {
			var p0$1 = g.touch0[0], l0 = g.touch0[1], p1 = g.touch1[0], l1 = g.touch1[1], dp = (dp = p1[0] - p0$1[0]) * dp + (dp = p1[1] - p0$1[1]) * dp, dl = (dl = l1[0] - l0[0]) * dl + (dl = l1[1] - l0[1]) * dl;
			t = scale$1(t, Math.sqrt(dp / dl));
			p = [(p0$1[0] + p1[0]) / 2, (p0$1[1] + p1[1]) / 2];
			l = [(l0[0] + l1[0]) / 2, (l0[1] + l1[1]) / 2];
		} else if (g.touch0) p = g.touch0[0], l = g.touch0[1];
		else return;
		g.zoom("touch", constrain(translate(t, p, l), g.extent, translateExtent));
	}
	function touchended(event, ...args) {
		if (!this.__zooming) return;
		var g = gesture(this, args).event(event), touches = event.changedTouches, n = touches.length, i, t;
		nopropagation(event);
		if (touchending) clearTimeout(touchending);
		touchending = setTimeout(function() {
			touchending = null;
		}, touchDelay);
		for (i = 0; i < n; ++i) {
			t = touches[i];
			if (g.touch0 && g.touch0[2] === t.identifier) delete g.touch0;
			else if (g.touch1 && g.touch1[2] === t.identifier) delete g.touch1;
		}
		if (g.touch1 && !g.touch0) g.touch0 = g.touch1, delete g.touch1;
		if (g.touch0) g.touch0[1] = this.__zoom.invert(g.touch0[0]);
		else {
			g.end();
			if (g.taps === 2) {
				t = pointer_default(t, this);
				if (Math.hypot(touchfirst[0] - t[0], touchfirst[1] - t[1]) < tapDistance) {
					var p = select_default(this).on("dblclick.zoom");
					if (p) p.apply(this, arguments);
				}
			}
		}
	}
	zoom.wheelDelta = function(_) {
		return arguments.length ? (wheelDelta = typeof _ === "function" ? _ : constant_default(+_), zoom) : wheelDelta;
	};
	zoom.filter = function(_) {
		return arguments.length ? (filter$2 = typeof _ === "function" ? _ : constant_default(!!_), zoom) : filter$2;
	};
	zoom.touchable = function(_) {
		return arguments.length ? (touchable = typeof _ === "function" ? _ : constant_default(!!_), zoom) : touchable;
	};
	zoom.extent = function(_) {
		return arguments.length ? (extent$1 = typeof _ === "function" ? _ : constant_default([[+_[0][0], +_[0][1]], [+_[1][0], +_[1][1]]]), zoom) : extent$1;
	};
	zoom.scaleExtent = function(_) {
		return arguments.length ? (scaleExtent[0] = +_[0], scaleExtent[1] = +_[1], zoom) : [scaleExtent[0], scaleExtent[1]];
	};
	zoom.translateExtent = function(_) {
		return arguments.length ? (translateExtent[0][0] = +_[0][0], translateExtent[1][0] = +_[1][0], translateExtent[0][1] = +_[0][1], translateExtent[1][1] = +_[1][1], zoom) : [[translateExtent[0][0], translateExtent[0][1]], [translateExtent[1][0], translateExtent[1][1]]];
	};
	zoom.constrain = function(_) {
		return arguments.length ? (constrain = _, zoom) : constrain;
	};
	zoom.duration = function(_) {
		return arguments.length ? (duration = +_, zoom) : duration;
	};
	zoom.interpolate = function(_) {
		return arguments.length ? (interpolate = _, zoom) : interpolate;
	};
	zoom.on = function() {
		var value = listeners.on.apply(listeners, arguments);
		return value === listeners ? zoom : value;
	};
	zoom.clickDistance = function(_) {
		return arguments.length ? (clickDistance2 = (_ = +_) * _, zoom) : Math.sqrt(clickDistance2);
	};
	zoom.tapDistance = function(_) {
		return arguments.length ? (tapDistance = +_, zoom) : tapDistance;
	};
	return zoom;
}

//#endregion
export { Adder, Delaunay, FormatSpecifier, InternMap, InternSet, Node, Path, Voronoi, Transform as ZoomTransform, active_default as active, arc_default as arc, area_default as area, areaRadial_default as areaRadial, ascending, autoType, axisBottom, axisLeft, axisRight, axisTop, bin, bisect_default as bisect, bisectCenter, bisectLeft, bisectRight, bisector, blob_default as blob, blur, blur2, blurImage, brush_default as brush, brushSelection, brushX, brushY, buffer_default as buffer, chord_default as chord, chordDirected, chordTranspose, cluster_default as cluster, color, density_default as contourDensity, contours_default as contours, count, create_default as create, creator_default as creator, cross, csv, csvFormat, csvFormatBody, csvFormatRow, csvFormatRows, csvFormatValue, csvParse, csvParseRows, cubehelix, cumsum, basis_default as curveBasis, basisClosed_default as curveBasisClosed, basisOpen_default as curveBasisOpen, bumpX as curveBumpX, bumpY as curveBumpY, bundle_default as curveBundle, cardinal_default as curveCardinal, cardinalClosed_default as curveCardinalClosed, cardinalOpen_default as curveCardinalOpen, catmullRom_default as curveCatmullRom, catmullRomClosed_default as curveCatmullRomClosed, catmullRomOpen_default as curveCatmullRomOpen, linear_default as curveLinear, linearClosed_default as curveLinearClosed, monotoneX as curveMonotoneX, monotoneY as curveMonotoneY, natural_default as curveNatural, step_default as curveStep, stepAfter as curveStepAfter, stepBefore as curveStepBefore, descending, deviation, difference, disjoint, dispatch_default as dispatch, drag_default as drag, nodrag_default as dragDisable, yesdrag as dragEnable, dsv, dsv_default as dsvFormat, backInOut as easeBack, backIn as easeBackIn, backInOut as easeBackInOut, backOut as easeBackOut, bounceOut as easeBounce, bounceIn as easeBounceIn, bounceInOut as easeBounceInOut, bounceOut as easeBounceOut, circleInOut as easeCircle, circleIn as easeCircleIn, circleInOut as easeCircleInOut, circleOut as easeCircleOut, cubicInOut as easeCubic, cubicIn as easeCubicIn, cubicInOut as easeCubicInOut, cubicOut as easeCubicOut, elasticOut as easeElastic, elasticIn as easeElasticIn, elasticInOut as easeElasticInOut, elasticOut as easeElasticOut, expInOut as easeExp, expIn as easeExpIn, expInOut as easeExpInOut, expOut as easeExpOut, linear as easeLinear, polyInOut as easePoly, polyIn as easePolyIn, polyInOut as easePolyInOut, polyOut as easePolyOut, quadInOut as easeQuad, quadIn as easeQuadIn, quadInOut as easeQuadInOut, quadOut as easeQuadOut, sinInOut as easeSin, sinIn as easeSinIn, sinInOut as easeSinInOut, sinOut as easeSinOut, every, extent, fcumsum, filter, flatGroup, flatRollup, center_default as forceCenter, collide_default as forceCollide, link_default as forceLink, manyBody_default as forceManyBody, radial_default as forceRadial, simulation_default as forceSimulation, x_default as forceX, y_default as forceY, format, defaultLocale as formatDefaultLocale, locale_default as formatLocale, formatPrefix, formatSpecifier, fsum, albers_default as geoAlbers, albersUsa_default as geoAlbersUsa, area_default$1 as geoArea, azimuthalEqualArea_default as geoAzimuthalEqualArea, azimuthalEqualAreaRaw as geoAzimuthalEqualAreaRaw, azimuthalEquidistant_default as geoAzimuthalEquidistant, azimuthalEquidistantRaw as geoAzimuthalEquidistantRaw, bounds_default as geoBounds, centroid_default as geoCentroid, circle_default as geoCircle, antimeridian_default as geoClipAntimeridian, circle_default$1 as geoClipCircle, extent_default as geoClipExtent, clipRectangle as geoClipRectangle, conicConformal_default as geoConicConformal, conicConformalRaw as geoConicConformalRaw, conicEqualArea_default as geoConicEqualArea, conicEqualAreaRaw as geoConicEqualAreaRaw, conicEquidistant_default as geoConicEquidistant, conicEquidistantRaw as geoConicEquidistantRaw, contains_default as geoContains, distance_default as geoDistance, equalEarth_default as geoEqualEarth, equalEarthRaw as geoEqualEarthRaw, equirectangular_default as geoEquirectangular, equirectangularRaw as geoEquirectangularRaw, gnomonic_default as geoGnomonic, gnomonicRaw as geoGnomonicRaw, graticule as geoGraticule, graticule10 as geoGraticule10, identity_default as geoIdentity, interpolate_default as geoInterpolate, length_default as geoLength, mercator_default as geoMercator, mercatorRaw as geoMercatorRaw, naturalEarth1_default as geoNaturalEarth1, naturalEarth1Raw as geoNaturalEarth1Raw, orthographic_default as geoOrthographic, orthographicRaw as geoOrthographicRaw, path_default as geoPath, projection as geoProjection, projectionMutator as geoProjectionMutator, rotation_default as geoRotation, stereographic_default as geoStereographic, stereographicRaw as geoStereographicRaw, stream_default as geoStream, transform_default as geoTransform, transverseMercator_default as geoTransverseMercator, transverseMercatorRaw as geoTransverseMercatorRaw, gray, greatest, greatestIndex, group, groupSort, groups, hcl, hierarchy, bin as histogram, hsl, html, image_default as image, index, indexes, value_default as interpolate, array_default as interpolateArray, basis_default$1 as interpolateBasis, basisClosed_default$1 as interpolateBasisClosed, Blues_default as interpolateBlues, BrBG_default as interpolateBrBG, BuGn_default as interpolateBuGn, BuPu_default as interpolateBuPu, cividis_default as interpolateCividis, cool as interpolateCool, cubehelix_default as interpolateCubehelix, cubehelix_default$1 as interpolateCubehelixDefault, cubehelixLong as interpolateCubehelixLong, date_default as interpolateDate, discrete_default as interpolateDiscrete, GnBu_default as interpolateGnBu, Greens_default as interpolateGreens, Greys_default as interpolateGreys, hcl_default as interpolateHcl, hclLong as interpolateHclLong, hsl_default as interpolateHsl, hslLong as interpolateHslLong, hue_default as interpolateHue, inferno as interpolateInferno, lab as interpolateLab, magma as interpolateMagma, number_default as interpolateNumber, numberArray_default as interpolateNumberArray, object_default as interpolateObject, OrRd_default as interpolateOrRd, Oranges_default as interpolateOranges, PRGn_default as interpolatePRGn, PiYG_default as interpolatePiYG, plasma as interpolatePlasma, PuBu_default as interpolatePuBu, PuBuGn_default as interpolatePuBuGn, PuOr_default as interpolatePuOr, PuRd_default as interpolatePuRd, Purples_default as interpolatePurples, rainbow_default as interpolateRainbow, RdBu_default as interpolateRdBu, RdGy_default as interpolateRdGy, RdPu_default as interpolateRdPu, RdYlBu_default as interpolateRdYlBu, RdYlGn_default as interpolateRdYlGn, Reds_default as interpolateReds, rgb_default as interpolateRgb, rgbBasis as interpolateRgbBasis, rgbBasisClosed as interpolateRgbBasisClosed, round_default as interpolateRound, sinebow_default as interpolateSinebow, Spectral_default as interpolateSpectral, string_default as interpolateString, interpolateTransformCss, interpolateTransformSvg, turbo_default as interpolateTurbo, viridis_default as interpolateViridis, warm as interpolateWarm, YlGn_default as interpolateYlGn, YlGnBu_default as interpolateYlGnBu, YlOrBr_default as interpolateYlOrBr, YlOrRd_default as interpolateYlOrRd, zoom_default as interpolateZoom, interrupt_default as interrupt, intersection, interval_default as interval, isoFormat_default as isoFormat, isoParse_default as isoParse, json_default as json, lab$1 as lab, lch, least, leastIndex, line_default as line, lineRadial_default as lineRadial, link, linkHorizontal, linkRadial, linkVertical, local, map, matcher_default as matcher, max, maxIndex, mean, median, medianIndex, merge, min, minIndex, mode, namespace_default as namespace, namespaces_default as namespaces, nice, now, pack_default as pack, enclose_default as packEnclose, siblings_default as packSiblings, pairs, partition_default as partition, path, pathRound, permute, pie_default as pie, piecewise, pointRadial_default as pointRadial, pointer_default as pointer, pointers_default as pointers, area_default$2 as polygonArea, centroid_default$1 as polygonCentroid, contains_default$1 as polygonContains, hull_default as polygonHull, length_default$1 as polygonLength, precisionFixed_default as precisionFixed, precisionPrefix_default as precisionPrefix, precisionRound_default as precisionRound, quadtree, quantile, quantileIndex, quantileSorted, quantize_default as quantize, quickselect, areaRadial_default as radialArea, lineRadial_default as radialLine, bates_default as randomBates, bernoulli_default as randomBernoulli, beta_default as randomBeta, binomial_default as randomBinomial, cauchy_default as randomCauchy, exponential_default as randomExponential, gamma_default as randomGamma, geometric_default as randomGeometric, int_default as randomInt, irwinHall_default as randomIrwinHall, lcg as randomLcg, logNormal_default as randomLogNormal, logistic_default as randomLogistic, normal_default as randomNormal, pareto_default as randomPareto, poisson_default as randomPoisson, uniform_default as randomUniform, weibull_default as randomWeibull, range, rank, reduce, reverse, rgb, ribbon_default as ribbon, ribbonArrow, rollup, rollups, band as scaleBand, diverging as scaleDiverging, divergingLog as scaleDivergingLog, divergingPow as scaleDivergingPow, divergingSqrt as scaleDivergingSqrt, divergingSymlog as scaleDivergingSymlog, identity as scaleIdentity, implicit as scaleImplicit, linear$1 as scaleLinear, log as scaleLog, ordinal as scaleOrdinal, point as scalePoint, pow as scalePow, quantile$1 as scaleQuantile, quantize as scaleQuantize, radial as scaleRadial, sequential as scaleSequential, sequentialLog as scaleSequentialLog, sequentialPow as scaleSequentialPow, sequentialQuantile as scaleSequentialQuantile, sequentialSqrt as scaleSequentialSqrt, sequentialSymlog as scaleSequentialSymlog, sqrt as scaleSqrt, symlog as scaleSymlog, threshold as scaleThreshold, time as scaleTime, utcTime as scaleUtc, scan, Accent_default as schemeAccent, scheme as schemeBlues, scheme$1 as schemeBrBG, scheme$2 as schemeBuGn, scheme$3 as schemeBuPu, category10_default as schemeCategory10, Dark2_default as schemeDark2, scheme$4 as schemeGnBu, scheme$5 as schemeGreens, scheme$6 as schemeGreys, observable10_default as schemeObservable10, scheme$7 as schemeOrRd, scheme$8 as schemeOranges, scheme$9 as schemePRGn, Paired_default as schemePaired, Pastel1_default as schemePastel1, Pastel2_default as schemePastel2, scheme$10 as schemePiYG, scheme$11 as schemePuBu, scheme$12 as schemePuBuGn, scheme$13 as schemePuOr, scheme$14 as schemePuRd, scheme$15 as schemePurples, scheme$16 as schemeRdBu, scheme$17 as schemeRdGy, scheme$18 as schemeRdPu, scheme$19 as schemeRdYlBu, scheme$20 as schemeRdYlGn, scheme$21 as schemeReds, Set1_default as schemeSet1, Set2_default as schemeSet2, Set3_default as schemeSet3, scheme$22 as schemeSpectral, Tableau10_default as schemeTableau10, scheme$23 as schemeYlGn, scheme$24 as schemeYlGnBu, scheme$25 as schemeYlOrBr, scheme$26 as schemeYlOrRd, select_default as select, selectAll_default as selectAll, selection_default as selection, selector_default as selector, selectorAll_default as selectorAll, shuffle_default as shuffle, shuffler, some, sort, stack_default as stack, diverging_default as stackOffsetDiverging, expand_default as stackOffsetExpand, none_default as stackOffsetNone, silhouette_default as stackOffsetSilhouette, wiggle_default as stackOffsetWiggle, appearance_default as stackOrderAppearance, ascending_default as stackOrderAscending, descending_default as stackOrderDescending, insideOut_default as stackOrderInsideOut, none_default$1 as stackOrderNone, reverse_default as stackOrderReverse, stratify_default as stratify, styleValue as style, subset, sum, superset, svg, Symbol$1 as symbol, asterisk_default as symbolAsterisk, circle_default$2 as symbolCircle, cross_default as symbolCross, diamond_default as symbolDiamond, diamond2_default as symbolDiamond2, plus_default as symbolPlus, square_default as symbolSquare, square2_default as symbolSquare2, star_default as symbolStar, times_default as symbolTimes, triangle_default as symbolTriangle, triangle2_default as symbolTriangle2, wye_default as symbolWye, times_default as symbolX, symbolsFill as symbols, symbolsFill, symbolsStroke, text_default as text, thresholdFreedmanDiaconis, thresholdScott, thresholdSturges, tickFormat, tickIncrement, tickStep, ticks, timeDay, timeDays, timeFormat, defaultLocale$1 as timeFormatDefaultLocale, formatLocale as timeFormatLocale, timeFriday, timeFridays, timeHour, timeHours, timeInterval, millisecond as timeMillisecond, milliseconds as timeMilliseconds, timeMinute, timeMinutes, timeMonday, timeMondays, timeMonth, timeMonths, timeParse, timeSaturday, timeSaturdays, second as timeSecond, seconds as timeSeconds, timeSunday, timeSundays, timeThursday, timeThursdays, timeTickInterval, timeTicks, timeTuesday, timeTuesdays, timeWednesday, timeWednesdays, timeSunday as timeWeek, timeSundays as timeWeeks, timeYear, timeYears, timeout_default as timeout, timer, timerFlush, transition, transpose, tree_default as tree, treemap_default as treemap, binary_default as treemapBinary, dice_default as treemapDice, resquarify_default as treemapResquarify, slice_default as treemapSlice, sliceDice_default as treemapSliceDice, squarify_default as treemapSquarify, tsv, tsvFormat, tsvFormatBody, tsvFormatRow, tsvFormatRows, tsvFormatValue, tsvParse, tsvParseRows, union, unixDay, unixDays, utcDay, utcDays, utcFormat, utcFriday, utcFridays, utcHour, utcHours, millisecond as utcMillisecond, milliseconds as utcMilliseconds, utcMinute, utcMinutes, utcMonday, utcMondays, utcMonth, utcMonths, utcParse, utcSaturday, utcSaturdays, second as utcSecond, seconds as utcSeconds, utcSunday, utcSundays, utcThursday, utcThursdays, utcTickInterval, utcTicks, utcTuesday, utcTuesdays, utcWednesday, utcWednesdays, utcSunday as utcWeek, utcSundays as utcWeeks, utcYear, utcYears, variance, window_default as window, xml_default as xml, zip, zoom_default$1 as zoom, identity$1 as zoomIdentity, transform as zoomTransform };
//# sourceMappingURL=d3.js.map