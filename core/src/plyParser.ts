import { Vector3, Color, Geometry, BufferGeometry } from "three";

const getGeometry = (geom: BufferGeometry) => new Geometry().fromBufferGeometry(geom);

type Options = {
    binary: boolean;
    littleEndian: boolean;
    includeNormals: boolean;
    includeColors: boolean;
};

export default (geoms: BufferGeometry[], options: Options) => {
    let verticesLength = 0;
    let facesLength = 0;
    for (let i = 0; i < geoms.length; ++i) {
        const g = getGeometry(geoms[i]);
        verticesLength += g.vertices.length;
        facesLength += g.faces.length;
        g.dispose();
    }
    const header = [
        `ply`,
        `format ${
            options.binary ? (options.littleEndian ? "binary_little_endian" : "binary_big_endian") : "ascii"
        } 1.0`,
        `element vertex ${verticesLength}`,
        `property float x`,
        `property float y`,
        `property float z`,
        options.includeNormals ? "property float nx\nproperty float ny\nproperty float nz" : "",
        options.includeColors ? "property uchar red\nproperty uchar green\nproperty uchar blue" : "",
        `element face ${facesLength}`,
        `property list uchar int vertex_index`,
        `end_header`
    ]
        .filter(s => s !== "")
        .join("\n");
    if (options.binary) {
        const indexByteCount = 4;
        const headerBin = new TextEncoder().encode(header + "\n");
        const vertexListLength =
            verticesLength * (4 * 3 + (options.includeNormals ? 4 * 3 : 0) + (options.includeColors ? 3 : 0));
        const faceListLength = facesLength * (indexByteCount * 3 + 1);
        const output = new DataView(new ArrayBuffer(headerBin.length + vertexListLength + faceListLength));
        new Uint8Array(output.buffer).set(headerBin, 0);
        let offset = headerBin.length;
        geoms.forEach(geom => {
            const g = getGeometry(geom);
            const colors = g.vertices.map(() => new Color(1, 1, 1));
            const normals = g.vertices.map(() => new Vector3(0, 0, 0));
            g.faces.forEach(f =>
                [f.a, f.b, f.c].forEach((index, i) => {
                    colors[index] = f.vertexColors[i];
                    normals[index] = f.vertexNormals[i];
                })
            );

            g.vertices.forEach((vertex, i) => {
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
                        output.setUint8(offset, Math.floor(v * 255));
                        offset += 1;
                    });
            });
            g.dispose();
        });
        let indexOffset = 0;
        geoms.forEach(geom => {
            const g = getGeometry(geom);
            g.faces.forEach(f => {
                output.setUint8(offset, 3);
                offset += 1;
                [f.a, f.b, f.c].forEach(v => {
                    output.setUint32(offset, indexOffset + v, options.littleEndian);
                    offset += indexByteCount;
                });
            });
            indexOffset += g.vertices.length;
            g.dispose();
        });
        return output.buffer;
    } else {
        let indexOffset = 0;
        let vertexList: string[][] = [];
        let faceList: string[][] = [];
        geoms.forEach(geom => {
            const g = getGeometry(geom);
            const colors = g.vertices.map(() => new Color(1, 1, 1));
            const normals = g.vertices.map(() => new Vector3(0, 0, 0));
            g.faces.forEach(f =>
                [f.a, f.b, f.c].forEach((index, i) => {
                    colors[index] = f.vertexColors[i];
                    normals[index] = f.vertexNormals[i];
                })
            );
            vertexList.push(
                g.vertices.map((vertex, i) =>
                    [
                        [vertex.toArray(), options.includeNormals ? normals[i].toArray() : []]
                            .flat()
                            .map(v => v.toString())
                            .map(v => {
                                if (v.includes(".")) return v;
                                return v + ".0";
                            }),
                        options.includeColors ? colors[i].toArray().map(c => Math.floor(c * 255)) : []
                    ]
                        .flat()
                        .join(" ")
                )
            );
            faceList.push(g.faces.map(f => `3 ${indexOffset + f.a} ${indexOffset + f.b} ${indexOffset + f.c}`));
            indexOffset += g.vertices.length;
            g.dispose();
        });
        return [header, vertexList.flat().join("\n"), faceList.flat().join("\n")].join("\n");
    }
};
