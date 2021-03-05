import THREE from "./three.js";
const { Vector3, Color, Geometry } = THREE;

export default (geom, options) => {
    const geometry = new Geometry().fromBufferGeometry(geom);
    const header = [
        `ply`,
        `format ${
            options.binary ? (options.littleEndian ? "binary_little_endian" : "binary_big_endian") : "ascii"
        } 1.0`,
        `element vertex ${geometry.vertices.length}`,
        `property float x`,
        `property float y`,
        `property float z`,
        options.includeNormals ? "property float nx\nproperty float ny\nproperty float nz" : "",
        options.includeColors ? "property uchar red\nproperty uchar green\nproperty uchar blue" : "",
        `element face ${geometry.faces.length}`,
        `property list uchar int vertex_index`,
        `end_header`
    ]
        .filter(s => s !== "")
        .join("\n");
    const colors = geometry.vertices.map(() => new Color(1, 1, 1));
    const normals = geometry.vertices.map(() => new Vector3(0, 0, 0));
    geometry.faces.forEach(f =>
        [f.a, f.b, f.c].forEach((index, i) => {
            colors[index] = f.vertexColors[i];
            normals[index] = f.vertexNormals[i];
        })
    );
    if (options.binary) {
        const vertices = geometry.vertices;
        const indexByteCount = 4;
        const headerBin = new TextEncoder().encode(header + "\n");
        const vertexListLength =
            vertices.length * (4 * 3 + (options.includeNormals ? 4 * 3 : 0) + (options.includeColors ? 3 : 0));
        const faceListLength = geometry.faces.length * (indexByteCount * 3 + 1);
        const output = new DataView(new ArrayBuffer(headerBin.length + vertexListLength + faceListLength));
        new Uint8Array(output.buffer).set(headerBin, 0);
        let offset = headerBin.length;
        vertices.forEach((vertex, i) => {
            vertex.toArray().forEach(v => {
                output.setFloat32(offset, v, options.littleEndian);
                offset += 4;
            });
            if (options.includeNormals)
                normals[i].toArray().forEach(v => {
                    output.setFloat32(offset, v, options.littleEndian);
                    offset += 4;
                });
            if (options.includeColors)
                colors[i].toArray().forEach(v => {
                    output.setUint8(offset, Math.floor(v * 255), options.littleEndian);
                    offset += 1;
                });
        });
        geometry.faces.forEach(f => {
            output.setUint8(offset, 3);
            offset += 1;
            [f.a, f.b, f.c].forEach(v => {
                output.setUint32(offset, v, options.littleEndian);
                offset += indexByteCount;
            });
        });
        return output.buffer;
    } else {
        const vertexList = geometry.vertices
            .map((vertex, i) =>
                [
                    vertex.toArray(),
                    options.includeNormals ? normals[i].toArray() : [],
                    options.includeColors ? colors[i].toArray().map(c => Math.floor(c * 255)) : []
                ]
                    .flat()
                    .map(v => v.toString())
                    .map(v => {
                        if (v.includes(".")) return v;
                        return v + ".0";
                    })
                    .join(" ")
            )
            .join("\n");
        const faceList = geometry.faces.map(f => `3 ${f.a} ${f.b} ${f.c}`).join("\n");
        return [header, vertexList, faceList].join("\n");
    }
};
