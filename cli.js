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

const data = JSON.parse(fs.readFileSync(options.src));
const iterations = options.iterations || 10;

const growSpeed = data.growSpeed;
const contractSpeed = data.contractSpeed;
const border = data.border;

const synthesizer = new Synthesizer(data);

const outputDir = "output";

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

for (let i = 0; i < iterations; ++i) {
    do synthesizer.update(growSpeed, contractSpeed, 0.01, 0.0001, 0);
    while ((synthesizer.updateState || {}).name !== "ready");
    const config = { growSpeed: growSpeed, contractSpeed: contractSpeed, border: border, ...synthesizer.toJSON() };
    fs.writeFileSync(`${outputDir}/config_output_${i + 1}.json`, JSON.stringify(config, null, 4));
}
