#!/usr/bin/env node

var { argv } = require("yargs")
    .scriptName("axon-generator-toolbox")
    .usage("Usage: $0 -f file [-i iterations]")
    .example("$0 -f config.json -i 10")
    .option("f", {
        alias: "file",
        describe: "Config file",
        demandOption: "Please specify a config file",
        type: "string",
        nargs: 1
    })
    .option("i", {
        alias: "iterations",
        default: 10,
        describe: "Number of iterations",
        type: "number",
        nargs: 1
    });

import fs from "fs";
import { Synthesizer } from "@axon-generator-toolbox/core/dist/index.js";

const data = JSON.parse(fs.readFileSync(argv.file));

const growSpeed = data.growSpeed;
const contractSpeed = data.contractSpeed;
const border = data.border;

const synthesizer = new Synthesizer(data);

const outputDir = argv.file.substring(0, argv.file.lastIndexOf("/")) + "/output";

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

for (let i = 0; i < argv.iterations; ++i) {
    do synthesizer.update(growSpeed, contractSpeed, 0.01, 0.0001, 0);
    while ((synthesizer.updateState || {}).name !== "ready");
    const config = { growSpeed: growSpeed, contractSpeed: contractSpeed, border: border, ...synthesizer.toJSON() };
    fs.writeFileSync(`${outputDir}/config_output_${i + 1}.json`, JSON.stringify(config, null, 4));
}
