type Vec2 = {
    x: number;
    y: number;
};

type Mapping = {
    values: Vec2[];
    valuesInverse: Vec2[];
    map: (x: number) => number;
    mapInverse: (x: number) => number;
    toJSON: () => {
        from: number[];
        to: number[];
    };
};

const map1 = (x: number, v1: Vec2, v2: Vec2) => v1.y + ((v2.y - v1.y) * (x - v1.x)) / (v2.x - v1.x);

const map2 = (values: Vec2[], x: number, i: number, j: number): number => {
    if (i === j) return values[i].y;
    if (i + 1 === j) return map1(x, values[i], values[j]);
    const k = (i + j) / 2;
    if (x < values[k].x) return map2(values, x, i, k);
    return map2(values, x, k, j);
};

const map3 = (values: Vec2[], x: number) => map2(values, x, 0, values.length - 1);

const createMapping = ({ from, to }: { from: number[]; to: number[] }) => {
    const values = from.map((xv, i) => ({
        x: xv,
        y: to[i]
    }));
    const valuesInverse = values.map(value => ({ x: value.y, y: value.x }));
    const mapping: Mapping = {
        values,
        valuesInverse,
        map: x => map3(values, x),
        mapInverse: y => map3(valuesInverse, y),
        toJSON: () => ({ from: values.map(v => v.x), to: values.map(v => v.y) })
    };
    return mapping;
};

export default createMapping;
