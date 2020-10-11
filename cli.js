import commandLineArgs from "command-line-args";
import fs from "fs";
import Synthesizer from "./src/core/synthesizer.js";
import Mapping from "./src/core/mapping.js";
import THREE from "./src/core/three.js";
const { Vector3, Matrix3 } = THREE;

const optionDefinitions = [
    { name: "src", type: String, defaultOption: true },
    { name: "iterations", alias: "i", type: Number }
];

const options = commandLineArgs(optionDefinitions);

// Load config file

const data = JSON.parse(fs.readFileSync(options.src));
const iterations = options.iterations || 10;

const voxelSize = data.voxelSize;
const ellipsoidDensity = data.ellipsoidDensity;
const growSpeed = data.growSpeed;
const contractSpeed = data.contractSpeed;
const mapFromDiameterToDeformationFactor = data.mapFromDiameterToDeformationFactor;
const mapFromMaxDiameterToMinDiameter = data.mapFromMaxDiameterToMinDiameter;

const synthesizer = new Synthesizer(
    data.voxelSize,
    data.ellipsoidDensity,
    new Mapping(data.mapFromDiameterToDeformationFactor),
    new Mapping(data.mapFromMaxDiameterToMinDiameter)
);
data.axons.forEach(axon => {
    synthesizer.addAxon(
        new Vector3(...axon.position),
        new Vector3(...axon.direction),
        axon.maxDiameter / 2,
        axon.color,
        axon.gFactor
    );
    const a = synthesizer.axons[synthesizer.axons.length - 1];
    if (axon.ellipsoids)
        axon.ellipsoids.forEach((ellipsoid, i) => {
            a.ellipsoids[i].pos = new Vector3(...ellipsoid.position);
            a.ellipsoids[i].shape = new Matrix3().set(...ellipsoid.shape);
        });
});
data.cells.forEach(cell =>
    synthesizer.addCell(new Vector3(...cell.position), new Matrix3().set(...cell.shape), cell.color)
);

const outputDir = "output";

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

for (let i = 0; i < iterations; ++i) {
    do synthesizer.update(growSpeed, contractSpeed, 0.01, 0.0001, 0);
    while ((synthesizer.updateState || {}).name !== "ready");

    const config = {
        voxelSize: synthesizer.voxelSize,
        ellipsoidDensity: synthesizer.ellipsoidDensity,
        growSpeed: growSpeed,
        contractSpeed: contractSpeed,
        mapFromDiameterToDeformationFactor: synthesizer.deformation.toJSON(),
        mapFromMaxDiameterToMinDiameter: synthesizer.minDiameter.toJSON(),
        axons: synthesizer.axons.map(axon => ({
            position: [axon.start.x, axon.start.y, axon.start.z],
            direction: [axon.end.x - axon.start.x, axon.end.y - axon.start.y, axon.end.z - axon.start.z],
            maxDiameter: axon.radius * axon.gFactor * 2,
            color: axon.color,
            gFactor: axon.gFactor,
            ellipsoids: axon.ellipsoids.map(ellipsoid => ({
                position: [ellipsoid.pos.x, ellipsoid.pos.y, ellipsoid.pos.z],
                shape: ellipsoid.shape.elements
            }))
        })),
        cells: synthesizer.cells.map(cell => ({
            position: [cell.pos.x, cell.pos.y, cell.pos.z],
            shape: cell.shape.elements,
            color: cell.color
        }))
    };

    fs.writeFileSync(`${outputDir}/config_output_${i + 1}.json`, JSON.stringify(config, null, 4));
}
