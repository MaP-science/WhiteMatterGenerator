import fs from "fs";
import Synthesizer from "./Toolbox/synthesizer.js";
import Mapping from "./Toolbox/mapping.js";
import PLYExporter from "./Toolbox/PLYExporter.js";
import THREE from "./Toolbox/three.js";
const { Geometry } = THREE;

const synthesizer = new Synthesizer(100, 0.1, new Mapping([0, 2], [0, 0.2]), new Mapping([0, 2], [0, 0.2]));
synthesizer.addAxonsRandomly(1);
synthesizer.addCellsRandomly(0);
synthesizer.update(0.02, 0.1, 0.01, 0.0001, 0);
synthesizer.draw("all", "pipes", "all", 3, 0);
fs.createWriteStream("test.ply").write(
    Buffer.from(
        new PLYExporter().parse(
            [synthesizer.axons.map(a => a.meshes[0].geometry), synthesizer.cells.map(c => c.mesh.geometry)]
                .flat()
                .reduce((result, geom) => {
                    result.merge(geom);
                    return result;
                }, new Geometry()),
            {
                binary: false,
                includeColors: true,
                includeNormals: true
            }
        )
    )
);
