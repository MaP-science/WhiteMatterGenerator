import { createSynthesizer } from "@axon-generator-toolbox/core/dist/index.js";
import arrayBufferToBuffer from "arraybuffer-to-buffer";

const configToSinglePly = (config, options) => {
    const synthesizer = createSynthesizer(config);
    synthesizer.draw("none", "pipes", "all", options.resolution, options.extended, 0, false);
    const result = synthesizer.toPLY(options.exportBinary, options.exportSimple);
    if (options.exportBinary) return arrayBufferToBuffer(result);
    return result;
};

const configToMultiplePly = (config, options) => {
    const synthesizer = createSynthesizer(config);
    synthesizer.draw("none", "pipes", "all", options.resolution, options.extended, 0, false);

    const result = [];

    const name = "@type_@index_@color.ply";

    for (let i = 0; i < synthesizer.axons.length; ++i) {
        const axon = synthesizer.axons[i];
        result.push({
            data: axon.toPLY(options.exportBinary, options.exportSimple, 0),
            name: name
                .replace(/@type/g, "myelin")
                .replace(/@index/g, i)
                .replace(/@color/g, axon.color)
        });
        if (Number(axon.gFactor) !== 1)
            result.push({
                data: axon.toPLY(options.exportBinary, options.exportSimple, 1),
                name: name
                    .replace(/@type/g, "axon")
                    .replace(/@index/g, i)
                    .replace(/@color/g, axon.color)
            });
    }
    for (let i = 0; i < synthesizer.cells.length; ++i) {
        const cell = synthesizer.cells[i];
        result.push({
            data: cell.toPLY(options.exportBinary, options.exportSimple),
            name: name
                .replace(/@type/g, "cell")
                .replace(/@index/g, i)
                .replace(/@color/g, cell.color)
        });
    }

    if (options.exportBinary) result.forEach(r => (r.data = arrayBufferToBuffer(r.data)));
    return result;
};

export default (config, options) => (options.multiple ? configToMultiplePly : configToSinglePly)(config, options);
