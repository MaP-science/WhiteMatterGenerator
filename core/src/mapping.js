const map1 = (x, v1, v2) => v1.y + ((v2.y - v1.y) * (x - v1.x)) / (v2.x - v1.x);

const map2 = (values, x, i, j) => {
    if (i === j) return values[i].y;
    if (i + 1 === j) return map1(x, values[i], values[j]);
    const k = (i + j) / 2;
    if (x < values[k].x) return map2(values, x, i, k);
    return map2(values, x, k, j);
};

const map3 = (values, x) => map2(values, x, 0, values.length - 1);

const createMapping = ({ from, to }) => {
    const values = from.map((xv, i) => ({
        x: xv,
        y: to[i]
    }));
    const valuesInverse = values.map(value => ({ x: value.y, y: value.x }));
    const mapping = {
        values,
        valuesInverse,
        map: x => map3(values, x),
        mapInverse: y => map3(valuesInverse, y),
        toJSON: () => ({ from: values.map(v => v.x), to: values.map(v => v.y) })
    };
    return mapping;
};

export default createMapping;
